const express = require('express');
const router = express.Router();
const atletaController = require('../controllers/atletaController');
const { verificarSesion } = require('../middlewares/authMiddleware');
const { uploadAtletaFields, handleUploadError } = require('../middlewares/uploadMiddleware');

router.get(
    '/representante/:id',
    verificarSesion,
    atletaController.obtenerAtletasPorRepresentante
);

// multipart/form-data: texto + hasta 3 archivos
router.post(
    '/registrar-atleta',
    verificarSesion,
    (req, res, next) => {
        uploadAtletaFields(req, res, (err) => {
            if (err) return handleUploadError(err, req, res, next);
            next();
        });
    },
    atletaController.registrarAtleta
);

module.exports = router;
