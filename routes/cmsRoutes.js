const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cmsController');

// Importa aquí tus middlewares existentes (los mismos que usas para pagos y autenticación)
// const { verificarDirectivo } = require('../middlewares/authMiddleware');
// const { uploadCloudinary } = require('../middlewares/uploadMiddleware');

// ------------------------------------------
// RUTAS PÚBLICAS (Para el index.html del Visitante)
// ------------------------------------------
router.get('/public/noticias', cmsController.obtenerNoticiasPublicas);
router.get('/public/eventos', cmsController.obtenerEventosPublicos);

// ------------------------------------------
// RUTAS PROTEGIDAS (Para el Panel Directiva)
// ------------------------------------------
// Aquí aplicarás tu "anillo de seguridad" y la carga de imágenes
router.post(
    '/admin/noticias',
    /* verificarDirectivo, uploadCloudinary.single('imagen_noticia'), */
    cmsController.crearNoticiaAdmin
);

router.post(
    '/admin/eventos',
    /* verificarDirectivo, */
    cmsController.crearEventoAdmin
);

module.exports = router;
