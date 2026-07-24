// ==========================================
// RUTAS DE CMS (NODE.JS + EXPRESS)
// Club Jaguares - Gestión Web
// ==========================================

const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cmsController');
const { verificarSesion, verificarSesionRole } = require('../middlewares/authMiddleware');
const { uploadNoticias, handleUploadError, validarArchivoSubido } = require('../middlewares/uploadMiddleware');

// ==========================================
// RUTAS PÚBLICAS (Sin autenticación)
// ==========================================

router.get('/public/noticias', cmsController.obtenerNoticiasPublicas);
router.get('/public/noticias/:id', cmsController.obtenerNoticiaDetalle);
router.get('/public/eventos', cmsController.obtenerEventosPublicos);

// ==========================================
// RUTAS PROTEGIDAS - NOTICIAS (Admin)
// ==========================================

router.post(
    '/admin/noticias',
    verificarSesion,
    verificarSesionRole(['directiva', 'staff', 'admin']),
    uploadNoticias.single('imagen_noticia'),
    handleUploadError,
    validarArchivoSubido,
    cmsController.crearNoticiaAdmin
);

router.get(
    '/admin/noticias',
    verificarSesion,
    verificarSesionRole(['directiva', 'staff', 'admin']),
    cmsController.obtenerNoticiasAdmin
);

router.delete(
    '/admin/noticias/:id',
    verificarSesion,
    verificarSesionRole(['directiva', 'admin']),
    cmsController.eliminarNoticiaAdmin
);

// ==========================================
// RUTAS PROTEGIDAS - EVENTOS (Admin)
// ==========================================

router.post(
    '/admin/eventos',
    verificarSesion,
    verificarSesionRole(['directiva', 'staff', 'admin']),
    cmsController.crearEventoAdmin
);

router.get(
    '/admin/eventos',
    verificarSesion,
    verificarSesionRole(['directiva', 'staff', 'admin']),
    cmsController.obtenerEventosAdmin
);

router.put(
    '/admin/eventos/:id',
    verificarSesion,
    verificarSesionRole(['directiva', 'admin']),
    cmsController.actualizarEventoAdmin
);

// ==========================================
// MANEJO DE ERRORES GLOBAL
// ==========================================

router.use((err, req, res, next) => {
    console.error('[ERROR CMS]', err.message || err);

    if (!res.headersSent) {
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

module.exports = router;
