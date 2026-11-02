const db = require('../config/db');
const { crearNotificacion } = require('./notificacionesController');
const { esEnteroPositivo, esEstadoAtletaValido, esEstadoPagoValido } = require('../utils/validators');

const BCV_API_KEY = process.env.EXCHANGERATE_API_KEY;
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
               u.nombres AS rep_nombres, u.apellidos AS rep_apellidos,
               u.telefono1 AS rep_telefono1, u.telefono2 AS rep_telefono2
        FROM atletas a
        LEFT JOIN usuarios u ON a.id_representante = u.id_usuario
        ORDER BY a.id_atleta DESC
    `;

    const qPagos = `
        SELECT p.id_pago, a.id_representante,
               p.mes_pagado, p.metodo_pago, p.fecha_pago,
               p.monto, p.moneda, p.referencia, p.ruta_captura, p.estado_pago,
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

// 2. Cambiar estado de atleta sin activar registros de representantes no aprobados.
exports.actualizarEstadoAtleta = (req, res) => {
    const { id_atleta, estado } = req.body;

    if (!esEnteroPositivo(id_atleta) || !esEstadoAtletaValido(estado)) {
        return res.status(400).json({ success: false, message: 'Datos de atleta o estado no válidos' });
    }

    // Al activar, esperar también una revocación concurrente del representante.
    const query = `
        UPDATE atletas a SET estado = ?
        WHERE a.id_atleta = ? AND a.estado IS DISTINCT FROM ?
          AND (? <> 'activo' OR EXISTS (
              SELECT 1 FROM usuarios u
              WHERE u.id_usuario = a.id_representante
                AND u.rol = 'representante' AND u.estado = 'aprobado'
              FOR SHARE OF u
          ))
    `;

    db.query(query, [estado, id_atleta, estado, estado], (err, result) => {
        if (err) {
            console.error('Error al actualizar atleta:', err.message);
            return res.status(500).json({ success: false, message: 'Error en la base de datos' });
        }

        if (!result || result.affectedRows === 0) {
            return db.query('SELECT estado FROM atletas WHERE id_atleta = ?', [id_atleta], (errBusca, rows) => {
                if (errBusca) return res.status(500).json({ success: false, message: 'Error al verificar atleta' });
                if (!rows?.length) return res.status(404).json({ success: false, message: 'Atleta no encontrado' });
                return res.status(409).json({
                    success: false,
                    message: rows[0].estado === estado
                        ? 'El atleta ya tiene ese estado'
                        : 'No se puede activar un atleta sin representante aprobado'
                });
            });
        }

        db.query('SELECT id_representante, nombres FROM atletas WHERE id_atleta = ?', [id_atleta], (errRep, rows) => {
            if (errRep || !rows?.length) return;
            const mensaje = estado === 'activo'
                ? `El atleta ${rows[0].nombres} fue aprobado.`
                : `El atleta ${rows[0].nombres} cambió a estado "${estado}".`;
            crearNotificacion(rows[0].id_representante, mensaje, estado === 'activo' ? 'success' : 'info');
        });

        res.json({ success: true, message: 'Estado del atleta actualizado con éxito' });
    });
};

// 3. Evitar cambios ficticios y notificaciones repetidas en pagos.
exports.actualizarEstadoPago = (req, res) => {
    const { id_pago, estado_pago } = req.body;

    if (!esEnteroPositivo(id_pago) || !esEstadoPagoValido(estado_pago)) {
        return res.status(400).json({ success: false, message: 'Datos de pago o estado no válidos' });
    }

    db.query(
        'UPDATE pagos SET estado_pago = ? WHERE id_pago = ? AND estado_pago IS DISTINCT FROM ?',
        [estado_pago, id_pago, estado_pago],
        (err, result) => {
            if (err) {
                console.error('Error al auditar el pago:', err.message);
                return res.status(500).json({ success: false, message: 'Error en la base de datos' });
            }

            if (!result || result.affectedRows === 0) {
                return db.query('SELECT estado_pago FROM pagos WHERE id_pago = ?', [id_pago], (errBusca, rows) => {
                    if (errBusca) return res.status(500).json({ success: false, message: 'Error al verificar pago' });
                    if (!rows?.length) return res.status(404).json({ success: false, message: 'Pago no encontrado' });
                    return res.status(409).json({ success: false, message: 'El pago ya tiene ese estado' });
                });
            }

            db.query(
                `SELECT a.id_representante, p.mes_pagado
                 FROM pagos p INNER JOIN atletas a ON p.id_atleta = a.id_atleta
                 WHERE p.id_pago = ?`,
                [id_pago],
                (errRep, rows) => {
                    if (errRep || !rows?.length) return;
                    const tipo = estado_pago === 'aprobado' ? 'success' : (estado_pago === 'rechazado' ? 'error' : 'info');
                    const mensaje = `Tu pago de ${rows[0].mes_pagado} fue marcado como "${estado_pago}".`;
                    crearNotificacion(rows[0].id_representante, mensaje, tipo);
                }
            );

            res.json({ success: true, message: 'Pago auditado con éxito' });
        }
    );
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

// 5. Aprobar o Rechazar a un usuario (representante)
exports.gestionarAprobacion = (req, res) => {
    const { id_usuario, accion } = req.body;

    if (!['aprobar', 'rechazar'].includes(accion)) {
        return res.status(400).json({ success: false, message: 'Acción no válida' });
    }

    if (!esEnteroPositivo(id_usuario)) {
        return res.status(400).json({ success: false, message: 'Usuario no válido' });
    }

    const nuevoEstado = accion === 'aprobar' ? 'aprobado' : 'rechazado';

    db.query(
        'UPDATE usuarios SET estado = ? WHERE id_usuario = ? AND estado = ? AND rol = \'representante\'',
        [nuevoEstado, id_usuario, 'pendiente'],
        (err, result) => {
            if (err) {
                console.error('Error al actualizar estado:', err);
                return res.status(500).json({ success: false, message: 'Error en la base de datos' });
            }

            if (!result || result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No hay una solicitud pendiente para ese usuario'
                });
            }

            const mensaje = accion === 'aprobar'
                ? 'Tu registro en Club Jaguares fue aprobado. Ya puedes iniciar sesión y registrar atletas.'
                : 'Tu solicitud de registro en Club Jaguares fue rechazada. Si crees que es un error, contacta a la directiva.';

            const tipo = accion === 'aprobar' ? 'success' : 'error';
            crearNotificacion(id_usuario, mensaje, tipo);

            res.json({
                success: true,
                message: `Usuario ${accion === 'aprobar' ? 'aprobado' : 'rechazado'} exitosamente`
            });
        }
    );
};

// Representantes aprobados, para el selector de "Registrar Atleta".
exports.obtenerRepresentantes = (req, res) => {
    const sql = `
        SELECT id_usuario, nombres, apellidos, cedula, telefono1
        FROM usuarios
        WHERE rol = 'representante' AND estado = 'aprobado'
        ORDER BY apellidos, nombres
    `;
    db.query(sql, [], (err, rows) => {
        if (err) {
            console.error('Error al obtener representantes:', err.message);
            return res.status(500).json({ success: false, message: 'Error al obtener representantes' });
        }
        res.json({ success: true, datos: rows });
    });
};
