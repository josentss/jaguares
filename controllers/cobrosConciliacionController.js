'use strict';

// Conciliación asistida: lectura del historial, sin asumir año ni concepto a
// partir del nombre antiguo del mes. No convierte ni modifica pagos.
const db = require('../config/db');
const { esEnteroPositivo } = require('../utils/validators');

function autorizado(req, res) {
    if (['directiva', 'admin'].includes(req.usuarioRol)) return true;
    res.status(403).json({ success: false, message: 'No autorizado' });
    return false;
}

function fallo(res, error) {
    if (['42P01', '42703'].includes(error.code)) {
        return res.status(503).json({
            success: false, message: 'Conciliación no disponible: revisa la migración de cobros'
        });
    }
    console.error('CONCILIACION_COBROS_SQL', error.code || 'INTERNAL');
    return res.status(500).json({
        success: false, message: 'No se pudo consultar la conciliación'
    });
}

exports.listarAtletas = async (req, res) => {
    if (!autorizado(req, res)) return;
    try {
        const { rows } = await db.pool.query(`
            SELECT a.id_atleta, a.nombres, a.apellidos, a.estado,
                u.estado AS estado_representante,
                ac.fecha_inicio, ac.dia_ancla,
                COUNT(p.id_pago)::int AS total_pagos,
                COUNT(p.id_pago) FILTER (WHERE p.estado_pago = 'pendiente')::int AS pendientes,
                COUNT(p.id_pago) FILTER (WHERE p.estado_pago = 'aprobado')::int AS aprobados,
                COUNT(p.id_pago) FILTER (WHERE p.estado_pago = 'rechazado')::int AS rechazados
            FROM atletas a
            JOIN usuarios u ON u.id_usuario = a.id_representante
            LEFT JOIN anclas_cobro_atleta ac ON ac.id_atleta = a.id_atleta
            LEFT JOIN pagos p ON p.id_atleta = a.id_atleta
            GROUP BY a.id_atleta, u.estado, ac.fecha_inicio, ac.dia_ancla
            ORDER BY a.apellidos, a.nombres, a.id_atleta
        `);
        res.set('Cache-Control', 'no-store');
        return res.json({ success: true, atletas: rows });
    } catch (error) { return fallo(res, error); }
};

exports.verDetalle = async (req, res) => {
    if (!autorizado(req, res)) return;
    const id = req.params.id_atleta;
    if (!esEnteroPositivo(id)) {
        return res.status(400).json({ success: false, message: 'Atleta no válido' });
    }
    try {
        const atleta = await db.pool.query(`
            SELECT a.id_atleta, a.nombres, a.apellidos, a.estado,
                u.estado AS estado_representante, u.rol AS rol_representante,
                ac.fecha_inicio, ac.dia_ancla, ac.configurado_en
            FROM atletas a
            JOIN usuarios u ON u.id_usuario = a.id_representante
            LEFT JOIN anclas_cobro_atleta ac ON ac.id_atleta = a.id_atleta
            WHERE a.id_atleta = $1
        `, [Number(id)]);
        if (!atleta.rowCount) {
            return res.status(404).json({ success: false, message: 'Atleta no encontrado' });
        }
        const [pagos, obligaciones] = await Promise.all([
            db.pool.query(`
                SELECT id_pago, mes_pagado, fecha_pago, monto, moneda,
                    estado_pago, metodo_pago, id_obligacion
                FROM pagos WHERE id_atleta = $1
                ORDER BY fecha_pago DESC NULLS LAST, id_pago DESC
            `, [Number(id)]),
            db.pool.query(`
                SELECT id_obligacion, codigo_concepto, periodo_mes,
                    monto_usd, fecha_vencimiento, fecha_limite
                FROM obligaciones_cobro WHERE id_atleta = $1
                ORDER BY fecha_vencimiento DESC, id_obligacion DESC
            `, [Number(id)])
        ]);
        res.set('Cache-Control', 'no-store');
        return res.json({
            success: true,
            atleta: atleta.rows[0],
            pagos: pagos.rows,
            obligaciones: obligaciones.rows,
            historial_sin_periodo_anual: pagos.rows.some(p => !p.id_obligacion),
            mensaje: 'Los pagos antiguos registran el nombre del mes sin año: verifica su período real antes de activar cobros.'
        });
    } catch (error) { return fallo(res, error); }
};
