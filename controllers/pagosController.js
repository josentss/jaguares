const db = require('../config/db');
const path = require('path');
const { esEnteroPositivo, esMontoValido } = require('../utils/validators');
const { logUploadEvent } = require('../utils/auditLogger');

const METODOS_PAGO = ['Transferencia Bancaria', 'Efectivo'];

function insertarPago(res, datos) {
    const { id_atleta, mes, metodo, monto, moneda, referencia, fecha_pago, ruta_captura } = datos;
    const estado_pago = 'pendiente';

    const query = `
        INSERT INTO pagos
        (id_atleta, mes_pagado, metodo_pago, fecha_pago, monto, moneda, referencia, ruta_captura, estado_pago)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const valores = [id_atleta, mes, metodo, fecha_pago, monto, moneda, referencia, ruta_captura, estado_pago];

    db.query(query, valores, (err) => {
        if (err) {
            console.error('Error SQL:', err);
            return res.status(500).json({ success: false, message: 'Error en la base de datos' });
        }
        res.json({ success: true });
    });
}

// 1. REPORTAR UN PAGO (Transferencia o Efectivo)
exports.reportarPago = (req, res) => {
    const { id_atleta, mes, metodo, monto, moneda, referencia, fecha_pago } = req.body;

    if (!id_atleta || !monto || !mes || !metodo || !fecha_pago) {
        return res.status(400).json({ success: false, message: 'Faltan datos requeridos para reportar el pago' });
    }

    if (!esEnteroPositivo(id_atleta)) {
        return res.status(400).json({ success: false, message: 'Atleta no válido' });
    }

    if (!esMontoValido(monto)) {
        return res.status(400).json({ success: false, message: 'Monto no válido' });
    }

    if (!METODOS_PAGO.includes(metodo)) {
        return res.status(400).json({ success: false, message: 'Método de pago no válido' });
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
        return res.status(400).json({ success: false, message: 'Debe adjuntar la captura de la transferencia' });
    }

    // Guardar la URL completa de Cloudinary (req.file.path)
    const ruta_captura = req.file ? (req.file.path || req.file.filename) : null;

    // Solo puede reportar pagos de atletas que pertenezcan al representante logueado.
    db.query(
        'SELECT id_atleta FROM atletas WHERE id_atleta = ? AND id_representante = ?',
        [id_atleta, req.usuarioId],
        (err, rows) => {
            if (err) {
                console.error('Error al verificar atleta:', err.message);
                return res.status(500).json({ success: false, message: 'Error en la base de datos' });
            }

            if (rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'No puedes reportar pagos para un atleta que no te pertenece'
                });
            }

            insertarPago(res, {
                id_atleta,
                mes,
                metodo,
                monto,
                moneda,
                referencia,
                fecha_pago,
                ruta_captura
            });
        }
    );
};

// 2. OBTENER HISTORIAL DE PAGOS DE UN REPRESENTANTE
exports.obtenerHistorial = (req, res) => {
    const id_rep = req.params.id_rep;

    const esDirectiva = ['directiva', 'staff', 'admin'].includes(req.usuarioRol);
    const esDueño = String(req.usuarioId) === String(id_rep);

    if (!esDirectiva && !esDueño) {
        return res.status(403).json({ success: false, message: 'No puedes ver el historial de otro representante' });
    }

    const query = `
        SELECT p.*, a.nombres AS atl_nombres, a.apellidos AS atl_apellidos
        FROM pagos p
        INNER JOIN atletas a ON p.id_atleta = a.id_atleta
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
            datos: resultados
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

        // Responder con la URL limpia en JSON
        res.json({
            success: true,
            url: urlFinal
        });
    });
};
