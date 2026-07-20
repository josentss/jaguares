const express = require('express');
const router = express.Router();
const notificacionesController = require('../controllers/notificacionesController');
const { verificarSesion } = require('../middlewares/authMiddleware');

router.get('/:id', verificarSesion, notificacionesController.obtenerNotificaciones);
router.delete('/:id', verificarSesion, notificacionesController.borrarNotificaciones);

module.exports = router;