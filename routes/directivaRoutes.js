const express = require('express');
const router = express.Router();
const directivaController = require('../controllers/directivaController');
const atletaController = require('../controllers/atletaController');
const { verificarSesion, esDirectiva, verificarSesionRole } = require('../middlewares/authMiddleware');
const { uploadAtletaFields, handleUploadError } = require('../middlewares/uploadMiddleware');
const catalogosDeportivos = require('../controllers/catalogosDeportivosController');
const planillaGeneral = require('../controllers/planillaGeneralController');

// El prefijo /api/directiva ya comprueba sesión y rol en index.js.
router.get('/deportes/catalogo', catalogosDeportivos.listar);
router.get('/atletas/planilla-general', planillaGeneral.obtener);
router.post('/deportes/:tipo', catalogosDeportivos.crear);
router.put('/deportes/:tipo/:id', catalogosDeportivos.renombrar);

router.get('/auditoria', verificarSesion, esDirectiva, directivaController.obtenerAuditoria);
router.put('/atleta/estado', verificarSesion, esDirectiva, directivaController.actualizarEstadoAtleta);
router.put('/pago/estado', verificarSesion, esDirectiva, directivaController.actualizarEstadoPago);
router.delete('/pago/:id_pago', verificarSesionRole(['admin', 'directiva']), directivaController.eliminarPagoRechazado);
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
