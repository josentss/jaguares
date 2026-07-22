const express = require('express');
const router = express.Router();
const pagosController = require('../controllers/pagosController');
const { verificarSesion } = require('../middlewares/authMiddleware');
const { upload, validarMagicBytes } = require('../middlewares/uploadMiddleware');
const { logUploadEvent } = require('../utils/auditLogger');

function manejarUpload(req, res, next) {
    upload.single('captura')(req, res, async (err) => {
        if (err) {
            try {
                logUploadEvent({
                    success: false,
                    reason: err.message || 'multer_error',
                    userId: req.usuarioId || null,
                    originalName: req.file?.originalname || null,
                    storedFilename: req.file?.filename || null,
                    ip: req.ip
                });
            } catch (e) { /* ignore logging errors */ }

            return res.status(400).json({
                success: false,
                message: err.message || 'Error al procesar el archivo adjunto'
            });
        }

        if (!req.file) return next();

        try {
            const valido = await validarMagicBytes(req.file.filename, req.file.originalname);
            if (!valido) {
                try {
                    logUploadEvent({
                        success: false,
                        reason: 'invalid_magic_bytes_or_disallowed',
                        userId: req.usuarioId || null,
                        originalName: req.file.originalname || null,
                        storedFilename: req.file.filename || null,
                        ip: req.ip
                    });
                } catch (e) { /* ignore logging errors */ }

                return res.status(400).json({ success: false, message: 'Archivo inválido o contenido no permitido' });
            }
        } catch (errVal) {
            console.error('Error validando archivo:', errVal);
            try {
                logUploadEvent({
                    success: false,
                    reason: 'validation_error',
                    userId: req.usuarioId || null,
                    originalName: req.file?.originalname || null,
                    storedFilename: req.file?.filename || null,
                    ip: req.ip,
                    extra: String(errVal?.message || errVal)
                });
            } catch (e) { /* ignore logging errors */ }

            return res.status(500).json({ success: false, message: 'Error procesando el archivo' });
        }

        next();
    });
}

router.post('/reportar', verificarSesion, manejarUpload, pagosController.reportarPago);

router.get('/historial/:id_rep', verificarSesion, pagosController.obtenerHistorial);

router.get('/captura/:id_pago', verificarSesion, pagosController.obtenerCaptura);

module.exports = router;
