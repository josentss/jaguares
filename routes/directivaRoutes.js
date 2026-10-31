const express = require('express');
const router = express.Router();
const directivaController = require('../controllers/directivaController');
const atletaController = require('../controllers/atletaController');
const { verificarSesion, esDirectiva } = require('../middlewares/authMiddleware');
const { uploadAtletaFields, handleUploadError } = require('../middlewares/uploadMiddleware');

router.get('/auditoria', verificarSesion, esDirectiva, directivaController.obtenerAuditoria);
router.put('/atleta/estado', verificarSesion, esDirectiva, directivaController.actualizarEstadoAtleta);
router.put('/pago/estado', verificarSesion, esDirectiva, directivaController.actualizarEstadoPago);
router.get('/pendientes', verificarSesion, esDirectiva, directivaController.obtenerUsuariosPendientes);
router.post('/gestionar-aprobacion', verificarSesion, esDirectiva, directivaController.gestionarAprobacion);
router.get('/representantes', verificarSesion, esDirectiva, directivaController.obtenerRepresentantes);
router.post(
    '/registrar-atleta',
    verificarSesion,
    esDirectiva,
    (req, res, next) => {
        uploadAtletaFields(req, res, (err) => {
            if (err) {
                console.error('UPLOAD ATLETA (directiva) ERROR:', err.message || err);
                return handleUploadError(err, req, res, next);
            }
            next();
        });
    },
    atletaController.registrarAtletaDirectiva
);

module.exports = router;
