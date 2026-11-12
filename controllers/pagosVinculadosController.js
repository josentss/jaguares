'use strict';

const db = require('../config/db');
const { esEnteroPositivo } = require('../utils/validators');
const { cotizar } = require('../utils/cotizadorObligaciones');
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
    return obligacion.nombre_concepto || CONCEPTOS[obligacion.codigo_concepto] || 'Cargo';
}

// Entrada del mismo POST /api/pagos/reportar, siempre después de verificar
// sesión, multipart, magic bytes y datos básicos en pagosController.
// El importe nominal en USD jamás se cambia por los importes reales en Bs/COP.
exports.reportar = async (req, res, datos) => {
    if (req.usuarioRol !== 'representante' || !esEnteroPositivo(datos.id_obligacion)) {
        return denegar(req, res, 403, 'No autorizado para reportar esta obligación');
    }
    let cliente;
    let confirmado = false;
    let persistenciaIncierta = false;
    let rechazo;
    let respuesta;
    try {
        cliente = await db.pool.connect();
        await cliente.query('BEGIN');
        // La cotización se repite en la misma transacción y con bloqueo.
        // Nunca confiar en el importe que el navegador muestra.
        const valor = await cotizar(cliente, {
            id_obligacion:datos.id_obligacion, id_atleta:datos.id_atleta,
            id_representante:req.usuarioId,moneda:datos.moneda,
            fecha_pago:datos.fecha_pago,bloquear:true
        });
        if (valor.codigo) rechazo = [valor.codigo, valor.mensaje];
        else if (Math.round(Number(datos.monto)*100) !==
            Math.round(Number(valor.monto)*100)) {
            rechazo = [409, 'El importe cambió; actualiza el monto fijo y vuelve a intentar'];
        }
        if (!rechazo) {
            const insertado = await cliente.query(`
                INSERT INTO pagos
                    (id_atleta,id_obligacion,id_tasa_cobro,mes_pagado,metodo_pago,
                     fecha_pago,monto,moneda,referencia,ruta_captura,estado_pago)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pendiente')
                RETURNING id_pago,id_obligacion
            `,[
                Number(datos.id_atleta),Number(datos.id_obligacion),
                valor.id_tasa_cobro,tituloPago(valor.cargo),datos.metodo,
                datos.fecha_pago,valor.monto,datos.moneda,
                datos.referencia,datos.ruta_captura
            ]);
            persistenciaIncierta = true;
            await cliente.query('COMMIT');
            confirmado = true;
            confirmarCargas(req);
            respuesta = {
                success:true,message:'Pago enviado para revisión',
                id_pago:insertado.rows[0].id_pago,
                id_obligacion:Number(datos.id_obligacion),
                requiere_revision_moneda:datos.moneda!=='USD'
            };
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
