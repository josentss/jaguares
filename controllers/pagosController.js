const db = require('../config/db');
const path = require('path');
const { esEnteroPositivo, esMontoValido, esFechaISOValida } = require('../utils/validators');
const { logUploadEvent } = require('../utils/auditLogger');
const { enlaceAutorizado } = require('../utils/cloudinaryPrivado');
const { compensarCargas, confirmarCargas, avisarEstadoIncierto } = require('../utils/compensacionCloudinary');
const pagosVinculados = require('./pagosVinculadosController');

async function rechazarPago(req, res, status, message) {
    await compensarCargas(req, 'validacion_pago');
    return res.status(status).json({ success: false, message });
}

const METODOS_PAGO = ['Transferencia Bancaria', 'Efectivo'];
const MESES_PAGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONEDAS_EFECTIVO = ['Bs', 'USD', 'COP'];

async function insertarPago(req, res, datos) {
    const { id_atleta, id_representante, mes, metodo, monto, moneda, referencia, fecha_pago, ruta_captura } = datos;

    // FOR SHARE espera cambios concurrentes y conserva la elegibilidad hasta
    // terminar la inserción; un SELECT sin bloqueo puede leer el estado anterior.
    const query = `
        INSERT INTO pagos
        (id_atleta, mes_pagado, metodo_pago, fecha_pago, monto, moneda, referencia, ruta_captura, estado_pago)
        SELECT a.id_atleta, ?, ?, ?, ?, ?, ?, ?, 'pendiente'
        FROM atletas a
        JOIN usuarios u ON u.id_usuario = a.id_representante
        WHERE a.id_atleta = ? AND a.id_representante = ?
          AND a.estado = 'activo'
          AND u.rol = 'representante' AND u.estado = 'aprobado'
          AND NOT EXISTS (SELECT 1 FROM anclas_cobro_atleta ac
                          WHERE ac.id_atleta = a.id_atleta)
          AND NOT EXISTS (SELECT 1 FROM obligaciones_cobro oc
                          WHERE oc.id_atleta = a.id_atleta)
        FOR SHARE OF a, u
        RETURNING id_pago
    `;

    const valores = [mes, metodo, fecha_pago, monto, moneda, referencia,
        ruta_captura, id_atleta, id_representante];

    try {
        const [resultado] = await db.promise().query(query, valores);
        if (!resultado || resultado.affectedRows !== 1) {
            // INSERT ... SELECT confirmó cero filas: no existe pago persistido.
            return rechazarPago(req, res, 409,
                'Solo se admiten pagos de atletas activos con representante aprobado');
        }
        // Solo marcar persistencia tras respuesta SQL confirmada.
        confirmarCargas(req);
        return res.json({ success: true });
    } catch (err) {
        // Un error de red/SQL durante INSERT puede dejar resultado ambiguo.
        // Evitar un borrado automático que pueda invalidar un pago confirmado.
        avisarEstadoIncierto(req, 'insert_pago_sql');
        console.error('Error al reportar pago:', err.code || 'INTERNAL');
        return res.status(500).json({ success: false, message: 'Error en la base de datos' });
    }
}

// 1. REPORTAR UN PAGO (Transferencia o Efectivo)
exports.reportarPago = async (req, res) => {
    const { id_atleta, id_obligacion, mes, metodo, monto, moneda, referencia, fecha_pago } = req.body || {};
    const esVinculado = id_obligacion !== undefined;

    if (!id_atleta || !monto || (!esVinculado && !mes) || !metodo || !fecha_pago) {
        return rechazarPago(req, res, 400, 'Faltan datos requeridos para reportar el pago');
    }

    if (!esEnteroPositivo(id_atleta)) {
        return rechazarPago(req, res, 400, 'Atleta no válido');
    }

    if (!esMontoValido(monto)) {
        return rechazarPago(req, res, 400, 'Monto no válido');
    }

    if (!METODOS_PAGO.includes(metodo)) {
        return rechazarPago(req, res, 400, 'Método de pago no válido');
    }

    if ((!esVinculado && !MESES_PAGO.includes(mes)) || !esFechaISOValida(fecha_pago)) {
        return rechazarPago(req, res, 400, 'Mes o fecha de pago no válidos');
    }
    if ((metodo === 'Transferencia Bancaria' && moneda !== 'Bs') ||
        (metodo === 'Efectivo' && !MONEDAS_EFECTIVO.includes(moneda))) {
        return rechazarPago(req, res, 400, 'Moneda no válida para el método de pago');
    }
    if (referencia != null && (typeof referencia !== 'string' || referencia.trim().length > 80)) {
        return rechazarPago(req, res, 400, 'Referencia no válida');
    }

    if (metodo === 'Transferencia Bancaria' && !req.file) {
        try {
            logUploadEvent({
                success: false,
                reason: 'missing_capture_for_transfer',
                userId: req.usuarioId || null,
                originalName: null,
                storedFilename: null,
                ip: req.ip
            });
        } catch (e) { /* ignore logging errors */ }
        return rechazarPago(req, res, 400, 'Debe adjuntar la captura de la transferencia');
    }

    // Guardar la URL completa de Cloudinary (req.file.path)
    const ruta_captura = req.file ? (req.file.path || req.file.filename) : null;

    if (esVinculado) {
        if (!esEnteroPositivo(id_obligacion)) {
            return rechazarPago(req, res, 400, 'Identificador de obligación no válido');
        }
        return pagosVinculados.reportar(req, res, {
            id_atleta, id_obligacion, metodo, monto, moneda,
            referencia: referencia ? referencia.trim() : null,
            fecha_pago, ruta_captura
        });
    }

    return insertarPago(req, res, {
        id_atleta,
        id_representante: req.usuarioId,
        mes,
        metodo,
        monto,
        moneda,
        referencia: referencia ? referencia.trim() : null,
        fecha_pago,
        ruta_captura
    });
};

// 2. OBTENER HISTORIAL DE PAGOS DE UN REPRESENTANTE
exports.obtenerHistorial = (req, res) => {
    const id_rep = req.params.id_rep;
    if (!esEnteroPositivo(id_rep)) {
        return res.status(400).json({ success: false, message: 'Identificador de representante no válido' });
    }

    const esDirectiva = ['directiva', 'staff', 'admin'].includes(req.usuarioRol);
    const esDueño = String(req.usuarioId) === String(id_rep);

    if (!esDirectiva && !esDueño) {
        return res.status(403).json({ success: false, message: 'No puedes ver el historial de otro representante' });
    }

    const query = `
        SELECT p.*, a.nombres AS atl_nombres, a.apellidos AS atl_apellidos,
               o.codigo_concepto, o.periodo_mes, o.monto_usd AS obligacion_monto_usd
        FROM pagos p
        INNER JOIN atletas a ON p.id_atleta = a.id_atleta
        LEFT JOIN obligaciones_cobro o ON o.id_obligacion = p.id_obligacion
        WHERE a.id_representante = ?
        ORDER BY p.id_pago DESC
    `;

    db.query(query, [id_rep], (err, resultados) => {
        if (err) {
            console.error('❌ Error al consultar el historial de pagos:', err.message);
            return res.status(500).json({ success: false, message: 'Error al obtener el historial.' });
        }

        res.json({
            success: true,
            datos: resultados.map(p => ({
                ...p,
                ruta_captura: p.ruta_captura ? `/api/pagos/captura/${p.id_pago}` : null
            }))
        });
    });
};

// 3. SERVIR LA URL DEL COMPROBANTE DE UN PAGO
exports.obtenerCaptura = (req, res) => {
    const { id_pago } = req.params;

    if (!esEnteroPositivo(id_pago)) {
        return res.status(400).json({ success: false, message: 'Identificador de pago no válido' });
    }

    const requesterId = req.usuarioId;
    const requesterRole = req.usuarioRol;

    const query = `
        SELECT p.ruta_captura, a.id_representante
        FROM pagos p
        INNER JOIN atletas a ON p.id_atleta = a.id_atleta
        WHERE p.id_pago = ?
    `;

    db.query(query, [id_pago], (err, rows) => {
        if (err) {
            console.error('❌ Error al buscar comprobante:', err.message);
            return res.status(500).json({ success: false, message: 'Error en la base de datos' });
        }

        if (rows.length === 0 || !rows[0].ruta_captura) {
            return res.status(404).json({ success: false, message: 'Comprobante no encontrado' });
        }

        const { ruta_captura, id_representante } = rows[0];

        const esDueño = String(id_representante) === String(requesterId);
        const esDirectiva = ['directiva', 'staff', 'admin'].includes(requesterRole);

        if (!esDueño && !esDirectiva) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para ver este comprobante' });
        }

        // Construcción de la URL de Cloudinary
        let urlFinal = ruta_captura;
        if (!ruta_captura.startsWith('http://') && !ruta_captura.startsWith('https://')) {
            if (ruta_captura.includes('jaguares_comprobantes/')) {
                const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
                urlFinal = `https://res.cloudinary.com/${cloudName}/image/upload/${ruta_captura}`;
            }
        }

        try {
            // Para nuevos assets authenticated, firma por 120s SOLO después
            // de comprobar propiedad/rol. Activos anteriores siguen públicos
            // hasta la migración acordada: no simular privacidad retroactiva.
            const url = enlaceAutorizado(urlFinal, 'jaguares_comprobantes');
            res.set('Cache-Control', 'no-store');
            res.set('Referrer-Policy', 'no-referrer');
            // Apertura directa desde un enlace de historial. Se comprueban
            // propietario y rol ANTES de redirigir, igual que en modo JSON.
            if (req.query?.abrir === '1') return res.redirect(302, url);
            return res.json({ success: true, url });
        } catch {
            return res.status(503).json({ success: false, message: 'Comprobante no disponible' });
        }
    });
};
