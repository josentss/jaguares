'use strict';

const db = require('../config/db');
const { esEnteroPositivo } = require('../utils/validators');
const { hoyCaracas, periodoDe, siguientePeriodo } = require('../utils/cobrosMensuales');
const { compensarCargas, confirmarCargas, avisarEstadoIncierto } = require('../utils/compensacionCloudinary');

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CONCEPTOS = {
    inscripcion: 'Inscripción',
    torneo: 'Torneo',
    arbitraje: 'Arbitraje',
    sancion: 'Sanción'
};

async function denegar(req, res, codigo, mensaje) {
    await compensarCargas(req, 'reporte_obligacion_no_persistido');
    return res.status(codigo).json({ success: false, message: mensaje });
}

function tituloPago(obligacion) {
    if (obligacion.codigo_concepto === 'mensualidad') {
        return MESES[Number(obligacion.periodo_mes.slice(5, 7)) - 1];
    }
    return CONCEPTOS[obligacion.codigo_concepto] || 'Cargo';
}

// Entrada del mismo POST /api/pagos/reportar, siempre después de verificar
// sesión, multipart, magic bytes y datos básicos en pagosController.
// El importe nominal en USD jamás se cambia por los importes reales en Bs/COP.
exports.reportar = async (req, res, datos) => {
    if (req.usuarioRol !== 'representante' || !esEnteroPositivo(datos.id_obligacion)) {
        return denegar(req, res, 403, 'No autorizado para reportar esta obligación');
    }
    const hoy = hoyCaracas();
    if (datos.fecha_pago > hoy) {
        return denegar(req, res, 400, 'La fecha del pago no puede ser futura');
    }

    let cliente;
    let confirmado = false;
    let persistenciaIncierta = false;
    let rechazo;
    let respuesta;
    try {
        cliente = await db.pool.connect();
        await cliente.query('BEGIN');
        const validacion = await cliente.query(`
            SELECT o.id_obligacion, o.codigo_concepto, o.periodo_mes, o.monto_usd,
                o.fecha_emision, o.fecha_vencimiento, o.fecha_limite,
                a.id_representante, a.estado AS estado_atleta,
                u.estado AS estado_representante, u.rol AS rol_representante
            FROM obligaciones_cobro o
            JOIN atletas a ON a.id_atleta = o.id_atleta
            JOIN usuarios u ON u.id_usuario = a.id_representante
            WHERE o.id_obligacion = $1 AND o.id_atleta = $2
            FOR UPDATE OF o, a, u
        `, [Number(datos.id_obligacion), Number(datos.id_atleta)]);
        if (!validacion.rowCount) {
            rechazo = [404, 'Obligación no encontrada para este atleta'];
        } else {
            const o = validacion.rows[0];
            if (Number(o.id_representante) !== Number(req.usuarioId)) {
                rechazo = [403, 'No autorizado'];
            } else if (o.estado_atleta !== 'activo' ||
                o.estado_representante !== 'aprobado' || o.rol_representante !== 'representante') {
                rechazo = [409, 'Atleta o representante no habilitado'];
            } else if (o.fecha_emision > hoy) {
                rechazo = [409, 'El cargo todavía no está disponible'];
            } else if (o.codigo_concepto === 'mensualidad' &&
                o.periodo_mes > siguientePeriodo(periodoDe(hoy))) {
                rechazo = [409, 'Solo está disponible el siguiente mes como adelanto'];
            } else if (datos.moneda === 'USD' &&
                Math.round(Number(datos.monto) * 100) !== Math.round(Number(o.monto_usd) * 100)) {
                rechazo = [409, 'El monto en USD debe coincidir con el cargo asignado'];
            }

            if (!rechazo) {
                const previo = await cliente.query(`SELECT id_pago
                    FROM pagos WHERE id_obligacion = $1
                        AND estado_pago IN ('pendiente', 'aprobado') LIMIT 1`,
                [Number(datos.id_obligacion)]);
                if (previo.rowCount) rechazo = [409, 'Este cargo ya está pagado o en revisión'];
            }

            if (!rechazo) {
                const insertado = await cliente.query(`
                    INSERT INTO pagos
                        (id_atleta, id_obligacion, mes_pagado, metodo_pago, fecha_pago,
                         monto, moneda, referencia, ruta_captura, estado_pago)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendiente')
                    RETURNING id_pago, id_obligacion
                `, [
                    Number(datos.id_atleta), Number(datos.id_obligacion),
                    tituloPago(o), datos.metodo, datos.fecha_pago,
                    datos.monto, datos.moneda, datos.referencia, datos.ruta_captura
                ]);
                persistenciaIncierta = true;
                await cliente.query('COMMIT');
                confirmado = true;
                confirmarCargas(req);
                respuesta = {
                    success: true, message: 'Pago enviado para revisión',
                    id_pago: insertado.rows[0].id_pago,
                    id_obligacion: Number(datos.id_obligacion),
                    requiere_revision_moneda: datos.moneda !== 'USD'
                };
            }
        }
    } catch (error) {
        const unico = error.code === '23505';
        if (unico) rechazo = [409, 'Este cargo ya tiene un pago en revisión o aprobado'];
        else {
            // Un fallo de COMMIT o red puede haber confirmado el INSERT.
            if (persistenciaIncierta) avisarEstadoIncierto(req, 'pago_vinculado_sql');
            console.error('PAGO_VINCULADO_SQL', error.code || 'INTERNAL');
            respuesta = { success: false, message: 'No se pudo registrar el pago' };
            respuesta.codigo = 500;
        }
    } finally {
        if (cliente) {
            if (!confirmado) {
                try { await cliente.query('ROLLBACK'); }
                catch (e) { console.error('PAGO_VINCULADO_ROLLBACK', e.code || 'INTERNAL'); }
            }
            cliente.release();
        }
    }

    if (rechazo) return denegar(req, res, rechazo[0], rechazo[1]);
    if (!confirmado) {
        if (!persistenciaIncierta) await compensarCargas(req, 'reporte_obligacion_error_preinsert');
        return res.status(respuesta?.codigo || 500).json({
            success: false, message: respuesta?.message || 'No se pudo registrar el pago'
        });
    }
    res.set?.('Cache-Control', 'no-store');
    return res.json(respuesta);
};
