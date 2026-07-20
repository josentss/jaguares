const express = require('express');
const router = express.Router();
const atletaController = require('../controllers/atletaController');
const { verificarSesion } = require('../middlewares/authMiddleware');

// Ambas rutas quedan protegidas por el middleware de sesión
router.get('/representante/:id', verificarSesion, atletaController.obtenerAtletasPorRepresentante);
router.post('/registrar-atleta', verificarSesion, atletaController.registrarAtleta);

module.exports = router;