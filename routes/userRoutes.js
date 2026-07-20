const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verificarSesion } = require('../middlewares/authMiddleware'); 

// Rutas blindadas del perfil de usuario
router.get('/perfil/:id', verificarSesion, userController.obtenerPerfil);
router.put('/perfil', verificarSesion, userController.actualizarPerfil);

module.exports = router;