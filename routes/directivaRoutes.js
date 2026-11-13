const express = require('express');
const router = express.Router();
const directivaController = require('../controllers/directivaController');
const atletaController = require('../controllers/atletaController');
const { verificarSesion, esDirectiva, verificarSesionRole } = require('../middlewares/authMiddleware');
const { uploadAtletaFields, handleUploadError } = require('../middlewares/uploadMiddleware');
const catalogosDeportivos = require('../controllers/catalogosDeportivosController');
const planillaGeneral = require('../controllers/planillaGeneralController');
const asignacionesEquipos = require('../controllers/asignacionesEquiposController');
const cobros = require('../controllers/cobrosController');
const pagosVinculadosRevision = require('../controllers/pagosVinculadosRevisionController');
const conciliacionCobros = require('../controllers/cobrosConciliacionController');
const catalogoCobros = require('../controllers/catalogoCobrosController');
const referenciasCobros = require('../controllers/referenciasCobrosController');

// El prefijo /api/directiva ya comprueba sesión y rol en index.js.
// Catálogo, cotizaciones manuales y cargos extraordinarios: solo Directiva/Admin.
router.get('/cobros/catalogo', verificarSesionRole(['directiva','admin']), catalogoCobros.listar);
router.post('/cobros/catalogo', verificarSesionRole(['directiva','admin']), catalogoCobros.crear);
router.patch('/cobros/catalogo/:codigo', verificarSesionRole(['directiva','admin']), catalogoCobros.editar);
router.delete('/cobros/catalogo/:codigo', verificarSesionRole(['directiva','admin']), catalogoCobros.retirar);
router.get('/cobros/tasas', verificarSesionRole(['directiva','admin']), catalogoCobros.listarTasas);
router.post('/cobros/tasas', verificarSesionRole(['directiva','admin']), catalogoCobros.registrarTasa);
router.get('/cobros/tasas/referencias', verificarSesionRole(['directiva','admin']), referenciasCobros.consultar);
router.post('/cobros/tasas/publicar-referencia', verificarSesionRole(['directiva','admin']), referenciasCobros.publicarReferencia);
router.post('/cobros/cargos', verificarSesionRole(['directiva','admin']), catalogoCobros.crearCargo);

// Lista de atletas y revisión individual del historial: únicamente Directiva/Admin.
router.get('/cobros/conciliacion/atletas', verificarSesionRole(['directiva', 'admin']), conciliacionCobros.listarAtletas);
router.get('/cobros/conciliacion/atletas/:id_atleta', verificarSesionRole(['directiva', 'admin']), conciliacionCobros.verDetalle);

// Motor de cobros: lectura autorizada y activación manual, sin automatismos.
router.get('/cobros/atletas/:id_atleta', cobros.consultar);
router.post('/cobros/anclas/:id_atleta', verificarSesionRole(['directiva', 'admin']), cobros.configurarAncla);
router.post('/cobros/mensualidades', verificarSesionRole(['directiva', 'admin']), cobros.generarMensualidad);

router.get('/deportes/catalogo', catalogosDeportivos.listar);
router.get('/deportes/asignaciones', verificarSesionRole(['directiva', 'admin']), asignacionesEquipos.listar);
router.post('/deportes/asignaciones', verificarSesionRole(['directiva', 'admin']), asignacionesEquipos.asignar);
router.get('/atletas/planilla-general', planillaGeneral.obtener);
router.post('/deportes/:tipo', catalogosDeportivos.crear);
router.put('/deportes/:tipo/:id', catalogosDeportivos.renombrar);

router.get('/auditoria', verificarSesion, esDirectiva, directivaController.obtenerAuditoria);
router.put('/atleta/estado', verificarSesion, esDirectiva, directivaController.actualizarEstadoAtleta);
router.put('/pago/estado', verificarSesion, esDirectiva, directivaController.actualizarEstadoPago);
router.put('/pago/vinculado/estado', verificarSesionRole(['directiva', 'admin']), pagosVinculadosRevision.revisar);
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
