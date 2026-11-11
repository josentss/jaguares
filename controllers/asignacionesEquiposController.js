'use strict';

const db = require('../config/db');
const { esEnteroPositivo } = require('../utils/validators');

function errorSQL(res, error) {
    if (error.code === '42P01') return res.status(503).json({ success: false,
        message: 'Asignaciones no disponibles: falta aplicar la migración deportiva' });
    if (error.code === '23505' || error.code === '23503') return res.status(409).json({ success: false,
        message: 'La asignación cambió; actualiza la lista e inténtalo de nuevo' });
    console.error('ASIGNACIONES_EQUIPOS_SQL', error.code || 'INTERNAL');
    return res.status(500).json({ success: false, message: 'No se pudo procesar la asignación' });
}

exports.listar = async (_req, res) => {
    try {
        const [atletas, movimientos] = await Promise.all([
            db.pool.query(`SELECT id_atleta, nombres, apellidos, fecha_nacimiento, estado
                FROM atletas ORDER BY apellidos, nombres, id_atleta`),
            db.pool.query(`SELECT ae.id_asignacion, ae.id_atleta, ae.id_equipo, ae.id_temporada,
                    ae.inicio_en, ae.fin_en, a.nombres AS atleta_nombres,
                    a.apellidos AS atleta_apellidos, a.estado AS atleta_estado,
                    e.nombre AS equipo_nombre, c.nombre AS categoria_nombre,
                    t.nombre AS temporada_nombre
                FROM asignaciones_equipos ae
                JOIN atletas a ON a.id_atleta = ae.id_atleta
                JOIN equipos_deportivos e ON e.id_equipo = ae.id_equipo
                JOIN categorias_deportivas c ON c.id_categoria = e.id_categoria
                JOIN temporadas_deportivas t ON t.id_temporada = ae.id_temporada
                ORDER BY ae.inicio_en DESC, ae.id_asignacion DESC`)
        ]);
        res.set('Cache-Control', 'no-store');
        return res.json({ success: true, atletas: atletas.rows, movimientos: movimientos.rows });
    } catch (error) { return errorSQL(res, error); }
};

exports.asignar = async (req, res) => {
    const { id_atleta: idAtleta, id_equipo: idEquipo } = req.body || {};
    if (!esEnteroPositivo(idAtleta) || !esEnteroPositivo(idEquipo)) {
        return res.status(400).json({ success: false, message: 'Selecciona un atleta y equipo válidos' });
    }
    const cliente = await db.pool.connect().catch(error => {
        console.error('ASIGNACIONES_EQUIPOS_CONEXION', error.code || 'INTERNAL');
        return null;
    });
    if (!cliente) return res.status(503).json({ success: false, message: 'Base de datos no disponible' });
    let confirmada = false;
    try {
        await cliente.query('BEGIN');
        // Serializa cambios concurrentes para el mismo atleta, incluso entre equipos.
        const atleta = await cliente.query('SELECT estado FROM atletas WHERE id_atleta = $1 FOR UPDATE', [Number(idAtleta)]);
        if (!atleta.rowCount) return res.status(404).json({ success: false, message: 'Atleta no encontrado' });
        if (atleta.rows[0].estado !== 'activo') return res.status(409).json({ success: false,
            message: 'Solo se pueden asignar atletas activos' });
        const equipo = await cliente.query(`SELECT e.id_equipo, c.id_temporada
            FROM equipos_deportivos e JOIN categorias_deportivas c ON c.id_categoria = e.id_categoria
            WHERE e.id_equipo = $1`, [Number(idEquipo)]);
        if (!equipo.rowCount) return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
        const idTemporada = equipo.rows[0].id_temporada;
        const anterior = await cliente.query(`SELECT id_asignacion, id_equipo FROM asignaciones_equipos
            WHERE id_atleta = $1 AND id_temporada = $2 AND fin_en IS NULL FOR UPDATE`,
        [Number(idAtleta), idTemporada]);
        if (anterior.rows[0]?.id_equipo === Number(idEquipo)) return res.status(409).json({ success: false,
            message: 'El atleta ya pertenece a ese equipo en la temporada' });
        const instante = new Date().toISOString();
        if (anterior.rowCount) {
            await cliente.query(`UPDATE asignaciones_equipos SET fin_en = $1, cerrado_por = $2
                WHERE id_asignacion = $3`, [instante, req.usuarioId, anterior.rows[0].id_asignacion]);
        }
        const nueva = await cliente.query(`INSERT INTO asignaciones_equipos
            (id_atleta, id_equipo, id_temporada, inicio_en, asignado_por)
            VALUES ($1, $2, $3, $4, $5) RETURNING id_asignacion`,
        [Number(idAtleta), Number(idEquipo), idTemporada, instante, req.usuarioId]);
        await cliente.query('COMMIT');
        confirmada = true;
        return res.status(201).json({ success: true, id_asignacion: nueva.rows[0].id_asignacion,
            movimiento: anterior.rowCount > 0 });
    } catch (error) { return errorSQL(res, error); }
    finally {
        if (!confirmada) {
            try { await cliente.query('ROLLBACK'); }
            catch (error) { console.error('ASIGNACIONES_EQUIPOS_ROLLBACK', error.code || 'INTERNAL'); }
        }
        cliente.release();
    }
};
