// ==========================================
// RUTAS DE CMS (NODE.JS + EXPRESS)
// Club Jaguares - Gestión Web
// ==========================================

const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cmsController');

// Importar middlewares
const { verificarSesion, verificarSesionRole } = require('../middlewares/authMiddleware');
const {
    uploadNoticias,
    handleUploadError,
    validarArchivoSubido,
    logUploadExitoso
} = require('../middlewares/uploadMiddleware');

// ==========================================
// RUTAS PÚBLICAS (Sin autenticación)
// ==========================================

/**
 * GET /api/cms/public/noticias
 * Obtiene las 3 noticias más recientes
 * Acceso: Público
 */
router.get('/public/noticias', cmsController.obtenerNoticiasPublicas);

/**
 * GET /api/cms/public/noticias/:id
 * Obtiene una noticia específica por ID
 * Acceso: Público
 */
router.get('/public/noticias/:id', cmsController.obtenerNoticiaDetalle);

/**
 * GET /api/cms/public/eventos
 * Obtiene los próximos eventos
 * Acceso: Público
 */
router.get('/public/eventos', cmsController.obtenerEventosPublicos);

// ==========================================
// RUTAS PROTEGIDAS - NOTICIAS (Admin)
// ==========================================

/**
 * POST /api/cms/admin/noticias
 * Crea una nueva noticia
 * Acceso: Solo Directiva, Staff, Admin
 * Body: FormData con titulo, resumen, contenido, imagen_noticia (file)
 */
 router.post(
     '/admin/noticias',
     verificarSesion,
     verificarSesionRole(['directiva', 'staff', 'admin']),
     uploadNoticias.single('imagen_noticia'),
     handleUploadError,
     validarArchivoSubido,
     logUploadExitoso,
     cmsController.crearNoticiaAdmin
 );

/**
 * GET /api/cms/admin/noticias
 * Obtiene todas las noticias (para panel admin)
 * Acceso: Solo Directiva, Staff, Admin
 */
router.get(
    '/admin/noticias',
    verificarSesion,
    verificarSesionRole(['directiva', 'staff', 'admin']),
    cmsController.obtenerNoticiasAdmin
);

/**
 * DELETE /api/cms/admin/noticias/:id
 * Archiva una noticia
 * Acceso: Solo Directiva, Admin
 */
router.delete(
    '/admin/noticias/:id',
    verificarSesion,
    verificarSesionRole(['directiva', 'admin']),
    cmsController.eliminarNoticiaAdmin
);

// ==========================================
// RUTAS PROTEGIDAS - EVENTOS (Admin)
// ==========================================

/**
 * POST /api/cms/admin/eventos
 * Crea un nuevo evento
 * Acceso: Solo Directiva, Staff, Admin
 * Body: { titulo, fecha_evento, lugar, descripcion?, capacidad? }
 */
router.post(
    '/admin/eventos',
    verificarSesion,
    verificarSesionRole(['directiva', 'staff', 'admin']),
    cmsController.crearEventoAdmin
);

/**
 * GET /api/cms/admin/eventos
 * Obtiene todos los eventos (para panel admin)
 * Acceso: Solo Directiva, Staff, Admin
 */
router.get(
    '/admin/eventos',
    verificarSesion,
    verificarSesionRole(['directiva', 'staff', 'admin']),
    cmsController.obtenerEventosAdmin
);

/**
 * PUT /api/cms/admin/eventos/:id
 * Actualiza el estado de un evento
 * Acceso: Solo Directiva, Admin
 * Body: { estado: 'proximo' | 'en_progreso' | 'completado' | 'cancelado' }
 */
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
    console.error('Error en rutas CMS:', err);

    // Errores de validación de multer
    if (err instanceof express.multer.MulterError) {
        return res.status(400).json({
            success: false,
            error: 'Error en la carga del archivo: ' + err.message
        });
    }

    // Errores genéricos
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
    });
});

module.exports = router;
