const express = require('express');
const router = express.Router();
const directivaController = require('../controllers/directivaController');
const { verificarSesion, esDirectiva } = require('../middlewares/authMiddleware');

// Estas rutas exponen datos de todos los atletas/pagos y permiten aprobar
// o rechazar pagos: antes no tenían NINGÚN middleware de autenticación,
// así que cualquiera con la URL podía leerlas o llamarlas directamente.
router.get('/auditoria', verificarSesion, esDirectiva, directivaController.obtenerAuditoria);
router.put('/atleta/estado', verificarSesion, esDirectiva, directivaController.actualizarEstadoAtleta);
router.put('/pago/estado', verificarSesion, esDirectiva, directivaController.actualizarEstadoPago);

module.exports = router;