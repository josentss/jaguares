const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { limiteAuth, limiteLogin } = require('../middlewares/rateLimitMiddleware');

router.post('/login', limiteLogin, authController.login);
router.post('/register', limiteAuth, authController.register);
router.post('/logout', authController.logout);

// Ruta para que el frontend verifique la sesión actual (usa cookie httpOnly 'token')
const { verificarSesion } = require('../middlewares/authMiddleware');
router.get('/me', verificarSesion, authController.me);

module.exports = router;
