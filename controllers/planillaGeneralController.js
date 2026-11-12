'use strict';

const db = require('../config/db');
const { CATEGORIAS, clasificar, hoyCaracasISO } = require('../public/admin/categorias-formativas');
const { esEnteroPositivo } = require('../utils/validators');

function atletasMinimos(filas) {
    return filas.map(({ nombres, apellidos, cedula, fecha_nacimiento }) => ({
        nombres, apellidos, cedula, fecha_nacimiento
    }));
}

async function consultarCategoria(codigo, hoy) {
    const categoria = CATEGORIAS.find(item => item.codigo === codigo);
    if (!categoria) return null;
    const resultado = await db.pool.query(`
        SELECT nombres, apellidos, cedula, fecha_nacimiento
        FROM atletas
        WHERE estado = $1
        ORDER BY apellidos, nombres, id_atleta
    `, ['activo']);
    return {
        alcance: { tipo: 'categoria', codigo, nombre: categoria.nombre,
            detalle: 'Categoría por edad' },
        atletas: atletasMinimos(resultado.rows.filter(atleta =>
            clasificar(atleta.fecha_nacimiento, hoy).categoria?.codigo === codigo
        ))
    };
}

async function consultarEquipo(idEquipo) {
    const equipo = await db.pool.query(`
        SELECT e.id_equipo, e.nombre, c.nombre AS categoria_nombre,
               t.id_temporada, t.nombre AS temporada_nombre
        FROM equipos_deportivos e
        JOIN categorias_deportivas c ON c.id_categoria = e.id_categoria
        JOIN temporadas_deportivas t ON t.id_temporada = c.id_temporada
        WHERE e.id_equipo = $1
    `, [idEquipo]);
    if (!equipo.rowCount) return null;
    const resultado = await db.pool.query(`
        SELECT a.nombres, a.apellidos, a.cedula, a.fecha_nacimiento
        FROM asignaciones_equipos ae
        JOIN atletas a ON a.id_atleta = ae.id_atleta
        WHERE ae.id_equipo = $1 AND ae.fin_en IS NULL AND a.estado = 'activo'
        ORDER BY a.apellidos, a.nombres, a.id_atleta
    `, [idEquipo]);
    const fila = equipo.rows[0];
    return {
        alcance: { tipo: 'equipo', id_equipo: fila.id_equipo, nombre: fila.nombre,
            detalle: `${fila.categoria_nombre} · ${fila.temporada_nombre}`,
            categoria: fila.categoria_nombre, temporada: fila.temporada_nombre,
            id_temporada: fila.id_temporada },
        atletas: atletasMinimos(resultado.rows)
    };
}

// Solo datos necesarios para esta planilla. La clasificación se calcula con el
// mismo día civil para todas las filas, incluso si la petición cruza medianoche.
exports.obtener = async (req, res) => {
    const claves = Object.keys(req.query);
    const porCategoria = claves.length === 1 && claves[0] === 'categoria' &&
        typeof req.query.categoria === 'string';
    const porEquipo = claves.length === 1 && claves[0] === 'equipo' &&
        esEnteroPositivo(req.query.equipo);
    if (!porCategoria && !porEquipo) return res.status(400).json({ success: false,
        message: 'Selecciona una categoría publicada o un equipo válido' });
    try {
        const hoy = hoyCaracasISO();
        const consulta = porCategoria
            ? await consultarCategoria(req.query.categoria, hoy)
            : await consultarEquipo(Number(req.query.equipo));
        if (!consulta) return res.status(porCategoria ? 400 : 404).json({ success: false,
            message: porCategoria ? 'Selecciona una categoría publicada' : 'Equipo no encontrado' });
        const { alcance, atletas } = consulta;
        if (atletas.length > 1000) {
            return res.status(413).json({ success: false,
                message: 'La plantilla supera el límite de 1000 atletas' });
        }
        res.set('Cache-Control', 'no-store');
        return res.json({ success: true, alcance, fecha: hoy, total: atletas.length, atletas });
    } catch (error) {
        if (error.code === '42P01' && porEquipo) return res.status(503).json({ success: false,
            message: 'Plantillas por equipo no disponibles: falta aplicar la migración deportiva' });
        console.error('Error al consultar planilla general:', error.code || 'INTERNAL');
        return res.status(500).json({ success: false, message: 'No se pudo consultar la planilla general' });
    }
};
