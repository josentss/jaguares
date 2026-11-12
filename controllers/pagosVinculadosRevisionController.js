'use strict';

// Revisión exclusiva de pagos vinculados: una sola transición desde pendiente.
// Ninguna tasa se calcula ni se toma del dashboard; Directiva debe comprobar
// manualmente cualquier conversión de Bs/COP a la obligación nominal en USD.
const db = require('../config/db');
const { esEnteroPositivo } = require('../utils/validators');
const { crearNotificacion } = require('./notificacionesController');

exports.revisar = async (req, res) => {
    if (!['directiva', 'admin'].includes(req.usuarioRol)) {
        return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    const { id_pago, estado_pago, revision_equivalencia } = req.body || {};
    if (!esEnteroPositivo(id_pago) || !['aprobado', 'rechazado'].includes(estado_pago)) {
        return res.status(400).json({ success: false, message: 'Pago o estado no válidos' });
    }

    let cliente;
    let confirmado = false;
    let rechazo;
    let aviso;
    try {
        cliente = await db.pool.connect();
        await cliente.query('BEGIN');
        const consulta = await cliente.query(`
            SELECT p.id_pago, p.estado_pago, p.moneda, p.monto,
                   p.mes_pagado, p.id_obligacion,
                   o.monto_usd, o.codigo_concepto, o.periodo_mes,
                   a.id_representante
            FROM pagos p
            JOIN obligaciones_cobro o ON o.id_obligacion = p.id_obligacion
            JOIN atletas a ON a.id_atleta = p.id_atleta
            WHERE p.id_pago = $1
            FOR UPDATE OF p
        `, [Number(id_pago)]);
        if (!consulta.rowCount) rechazo = [404, 'Pago vinculado no encontrado'];
        else {
            const pago = consulta.rows[0];
            if (pago.estado_pago !== 'pendiente') {
                rechazo = [409, 'Solo se pueden revisar reportes pendientes'];
            } else if (estado_pago === 'aprobado' && pago.moneda !== 'USD' &&
                revision_equivalencia !== true) {
                rechazo = [400, 'Confirma la revisión manual del importe y su equivalencia en USD'];
            }
            if (!rechazo) {
                const actualizado = await cliente.query(`
                    UPDATE pagos SET estado_pago = $2
                    WHERE id_pago = $1 AND estado_pago = 'pendiente'
                    RETURNING id_pago
                `, [Number(id_pago), estado_pago]);
                if (!actualizado.rowCount) rechazo = [409, 'El reporte ya fue revisado'];
                else {
                    aviso = {
                        id_representante: pago.id_representante,
                        texto: 'Tu reporte de ' +
                            (pago.codigo_concepto === 'mensualidad' ?
                                `${pago.mes_pagado} ${pago.periodo_mes.slice(0, 4)}` :
                                pago.mes_pagado) +
                            ` fue marcado como "${estado_pago}".`,
                        tipo: estado_pago === 'aprobado' ? 'success' : 'error',
                        manual: estado_pago === 'aprobado' && pago.moneda !== 'USD'
                    };
                }
            }
        }
        if (!rechazo) {
            await cliente.query('COMMIT');
            confirmado = true;
        }
    } catch (error) {
        console.error('REVISION_VINCULADA_SQL', error.code || 'INTERNAL');
        return res.status(500).json({ success: false, message: 'No se pudo revisar el pago' });
    } finally {
        if (cliente) {
            if (!confirmado) {
                try { await cliente.query('ROLLBACK'); }
                catch (e) { console.error('REVISION_VINCULADA_ROLLBACK', e.code || 'INTERNAL'); }
            }
            cliente.release();
        }
    }
    if (rechazo) return res.status(rechazo[0]).json({ success: false, message: rechazo[1] });
    // Nunca registrar valores bancarios o URL de comprobantes en logs.
    console.info('PAGO_VINCULADO_REVISADO', {
        id_pago: Number(id_pago), id_directiva: req.usuarioId,
        estado_pago, equivalencia_revisada_manualmente: aviso.manual
    });
    crearNotificacion(aviso.id_representante, aviso.texto, aviso.tipo);
    return res.json({ success: true, message: 'Pago revisado correctamente' });
};
