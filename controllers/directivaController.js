const db = require('../config/db');
const { crearNotificacion } = require('./notificacionesController');
const { esEnteroPositivo, esEstadoAtletaValido, esEstadoPagoValido } = require('../utils/validators');

const BCV_API_KEY = process.env.EXCHANGERATE_API_KEY || 'TU_API_KEY_AQUI';
const BCV_API_URL = `https://v6.exchangerate-api.com/v6/${BCV_API_KEY}/latest/USD`;
const TASA_BCV_DEFAULT = 36.50;

async function obtenerTasaBCV() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(BCV_API_URL, { signal: controller.signal });

        if (!response.ok) {
            throw new Error(`Status HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.result !== 'success' || !data.conversion_rates || !data.conversion_rates.VES) {
            throw new Error('Formato de respuesta inesperado de exchangerate-api');
        }

        return {
            tasa_bcv: data.conversion_rates.VES,
            tasa_fecha: data.time_last_update_utc || new Date().toISOString()
        };
    } catch (err) {
        console.error('⚠️  No se pudo obtener la tasa BCV externa, usando valor por defecto:', err.message);
        return {
            tasa_bcv: TASA_BCV_DEFAULT,
            tasa_fecha: null
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

// 1. Obtener todas las métricas, atletas y pagos para el dashboard de administración
exports.obtenerAuditoria = async (req, res) => {
    try { if (req.logAdmin) req.logAdmin({ action: 'obtenerAuditoria_start' }); } catch(e) { console.error('logAdmin error', e); }

    const { tasa_bcv, tasa_fecha } = await obtenerTasaBCV();

    const qActivos = "SELECT COUNT(*) AS activos FROM atletas WHERE estado = 'activo'";
    const qEspera = "SELECT COUNT(*) AS espera FROM atletas WHERE estado = 'espera'";
    const qPagosPendientes = "SELECT COUNT(*) AS pendientes FROM pagos WHERE estado_pago = 'pendiente'";

    const qAtletas = `
        SELECT a.id_atleta, a.id_representante, a.nombres, a.apellidos,
               a.fecha_nacimiento AS fecha_nac, a.estado,
               u.nombres AS rep_nombres, u.apellidos AS rep_apellidos
        FROM atletas a
        LEFT JOIN usuarios u ON a.id_representante = u.id_usuario
        ORDER BY a.id_atleta DESC
    `;

    const qPagos = `
        SELECT p.id_pago, a.id_representante, p.mes_pagado, p.monto, p.moneda, p.ruta_captura, p.estado_pago,
               a.nombres AS atl_nombres, a.apellidos AS atl_apellidos
        FROM pagos p
        LEFT JOIN atletas a ON p.id_atleta = a.id_atleta
        ORDER BY p.id_pago DESC
    `;

    db.query(qActivos, (err, resActivos) => {
        if (err) {
            console.error("❌ Error en qActivos:", err.message);
            return res.status(500).json({ success: false, message: err.message });
        }

        db.query(qEspera, (err, resEspera) => {
            if (err) {
                console.error("❌ Error en qEspera:", err.message);
                return res.status(500).json({ success: false, message: err.message });
            }

            db.query(qPagosPendientes, (err, resPendientes) => {
                if (err) {
                    console.error("❌ Error en qPagosPendientes:", err.message);
                    return res.status(500).json({ success: false, message: err.message });
                }

                db.query(qAtletas, (err, listaAtletas) => {
                    if (err) {
                        console.error("❌ Error en qAtletas:", err.message);
                        return res.status(500).json({ success: false, message: err.message });
                    }

                    db.query(qPagos, (err, listaPagos) => {
                        if (err) {
                            console.error("❌ Error en qPagos:", err.message);
                            try { if (req.logAdmin) req.logAdmin({ action: 'obtenerAuditoria_qPagos_error', err: err.message }); } catch(e){}
                            return res.status(500).json({ success: false, message: err.message });
                        }

                        try { if (req.logAdmin) req.logAdmin({ action: 'obtenerAuditoria_success', atletas: listaAtletas.length, pagos: listaPagos.length }); } catch(e){}
                        res.json({
                            metricas: {
                                activos: resActivos[0]?.activos || 0,
                                espera: resEspera[0]?.espera || 0,
                                pagos_pendientes: resPendientes[0]?.pendientes || 0
                            },
                            tasa_bcv,
                            tasa_fecha,
                            atletas: listaAtletas,
                            pagos: listaPagos
                        });
                    });
                });
            });
        });
    });
};

// 2. Cambiar el estado de un atleta
exports.actualizarEstadoAtleta = (req, res) => {
    const { id_atleta, estado } = req.body;

    try { if (req.logAdmin) req.logAdmin({ action: 'actualizarEstadoAtleta_start', id_atleta, estado }); } catch(e){}

    if (!esEnteroPositivo(id_atleta) || !esEstadoAtletaValido(estado)) {
        return res.status(400).json({ success: false, message: 'Datos de atleta o estado no válidos' });
    }

    const query = 'UPDATE atletas SET estado = ? WHERE id_atleta = ?';

    db.query(query, [estado, id_atleta], (err, result) => {
        if (err) {
            console.error("Error al actualizar atleta:", err);
            try { if (req.logAdmin) req.logAdmin({ action: 'actualizarEstadoAtleta_db_error', err: err.message }); } catch(e){}
            return res.status(500).json({ success: false, message: 'Error en la base de datos' });
        }

        db.query('SELECT id_representante, nombres FROM atletas WHERE id_atleta = ?', [id_atleta], (errRep, rows) => {
            if (errRep || rows.length === 0) return;
            const mensaje = estado === 'activo'
                ? `El atleta ${rows[0].nombres} fue aprobado.`
                : `El atleta ${rows[0].nombres} cambió a estado "${estado}".`;
            crearNotificacion(rows[0].id_representante, mensaje, estado === 'activo' ? 'success' : 'info');
        });

        try { if (req.logAdmin) req.logAdmin({ action: 'actualizarEstadoAtleta_success', id_atleta, estado }); } catch(e){}
        res.json({ success: true, message: 'Estado del atleta actualizado con éxito' });
    });
};

// 3. Cambiar el estado de un pago
exports.actualizarEstadoPago = (req, res) => {
    const { id_pago, estado_pago } = req.body;

    try { if (req.logAdmin) req.logAdmin({ action: 'actualizarEstadoPago_start', id_pago, estado_pago }); } catch(e){}

    if (!esEnteroPositivo(id_pago) || !esEstadoPagoValido(estado_pago)) {
        return res.status(400).json({ success: false, message: 'Datos de pago o estado no válidos' });
    }

    const query = 'UPDATE pagos SET estado_pago = ? WHERE id_pago = ?';

    db.query(query, [estado_pago, id_pago], (err, result) => {
        if (err) {
            console.error("Error al auditar el pago:", err);
            try { if (req.logAdmin) req.logAdmin({ action: 'actualizarEstadoPago_db_error', err: err.message }); } catch(e){}
            return res.status(500).json({ success: false, message: 'Error en la base de datos' });
        }

        db.query(
            `SELECT a.id_representante, p.mes_pagado
             FROM pagos p INNER JOIN atletas a ON p.id_atleta = a.id_atleta
             WHERE p.id_pago = ?`,
            [id_pago],
            (errRep, rows) => {
                if (errRep || rows.length === 0) return;
                const tipo = estado_pago === 'aprobado' ? 'success' : (estado_pago === 'rechazado' ? 'error' : 'info');
                const mensaje = `Tu pago de ${rows[0].mes_pagado} fue marcado como "${estado_pago}".`;
                crearNotificacion(rows[0].id_representante, mensaje, tipo);
            }
        );

        try { if (req.logAdmin) req.logAdmin({ action: 'actualizarEstadoPago_success', id_pago, estado_pago }); } catch(e){}
        res.json({ success: true, message: 'Pago auditado con éxito' });
    });
};

// 4. Obtener lista de usuarios pendientes por aprobar
exports.obtenerUsuariosPendientes = (req, res) => {
    const query = `
        SELECT id_usuario, nombres, apellidos, correo, rol, estado
        FROM usuarios
        WHERE estado = 'pendiente'
        ORDER BY id_usuario DESC
    `;

    db.query(query, (err, resultados) => {
        if (err) {
            console.error('Error al consultar usuarios pendientes:', err);
            return res.status(500).json({ success: false, message: 'Error en la base de datos' });
        }
        res.json({ success: true, datos: resultados });
    });
};

// 5. Aprobar o Rechazar a un usuario
exports.gestionarAprobacion = (req, res) => {
    const { id_usuario, accion } = req.body;

    if (!['aprobar', 'rechazar'].includes(accion)) {
        return res.status(400).json({ success: false, message: 'Acción no válida' });
    }

    const nuevoEstado = accion === 'aprobar' ? 'aprobado' : 'rechazado';

    db.query(
        'UPDATE usuarios SET estado = ? WHERE id_usuario = ?',
        [nuevoEstado, id_usuario],
        (err, result) => {
            if (err) {
                console.error('Error al actualizar estado:', err);
                return res.status(500).json({ success: false, message: 'Error en la base de datos' });
            }

            res.json({
                success: true,
                message: `Usuario ${accion === 'aprobar' ? 'aprobado' : 'rechazado'} exitosamente`
            });
        }
    );
};
