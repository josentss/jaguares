require('dotenv').config();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { storageConValidacion } = require('../utils/archivosSeguros');
const { esCargaPrivadaHabilitada } = require('../utils/cloudinaryPrivado');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ── Comprobantes de pago ───────────────────────────────────────────────────
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'jaguares_comprobantes',
        type: esCargaPrivadaHabilitada() ? 'authenticated' : 'upload',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1200, crop: 'limit' }]
    }
});

const upload = multer({
    storage: storageConValidacion(storage, { captura: ['jpg', 'png', 'webp'] }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});

// ── Noticias CMS ───────────────────────────────────────────────────────────
const storageNoticias = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'jaguares/cms/noticias',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ width: 1200, height: 630, crop: 'fill', quality: 'auto' }]
    }
});

const uploadNoticias = multer({
    storage: storageConValidacion(storageNoticias, { imagen_noticia: ['jpg', 'png', 'gif', 'webp'] }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP)'));
    }
});

// ── Documentos del atleta (foto + cédula + partida) ────────────────────────
const storageAtletas = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'jaguares/atletas',
        type: esCargaPrivadaHabilitada() ? 'authenticated' : 'upload',
        resource_type: 'auto',
        public_id: (req, file) =>
            `${Date.now()}-${file.fieldname}-${Math.random().toString(36).slice(2, 8)}`
    }
});

const uploadAtleta = multer({
    storage: storageConValidacion(storageAtletas, {
        foto: ['jpg', 'png', 'webp'],
        cedula_archivo: ['jpg', 'png', 'webp', 'pdf'],
        partida_nacimiento: ['jpg', 'png', 'webp', 'pdf']
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 3 },
    fileFilter: (req, file, cb) => {
        const okImage = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const okDoc = [...okImage, 'application/pdf', 'application/x-pdf'];

        if (file.fieldname === 'foto') {
            if (okImage.includes(file.mimetype)) return cb(null, true);
            return cb(new Error('La foto debe ser JPG, PNG o WebP'));
        }
        if (file.fieldname === 'cedula_archivo' || file.fieldname === 'partida_nacimiento') {
            if (okDoc.includes(file.mimetype)) return cb(null, true);
            return cb(new Error('Cédula y partida deben ser imagen (JPG/PNG/WebP) o PDF'));
        }
        return cb(new Error(`Campo de archivo no permitido: ${file.fieldname}`));
    }
});

const uploadAtletaFields = uploadAtleta.fields([
    { name: 'foto', maxCount: 1 },
    { name: 'cedula_archivo', maxCount: 1 },
    { name: 'partida_nacimiento', maxCount: 1 }
]);

const handleUploadError = (err, req, res, next) => {
    console.error('UPLOAD ERROR:', err?.code || '', err?.message || err);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Archivo demasiado grande (máximo 5 MB por archivo)'
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                message: 'Campo de archivo inesperado. Usa: foto, cedula_archivo, partida_nacimiento'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'Error de carga: ' + err.message
        });
    }
    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message || 'Error al subir archivo'
        });
    }
    next();
};

// Las firmas se comprueban antes del upload; el marcador solo existe tras
// la validación de bytes, MIME y extensión dentro de storageConValidacion.
async function validarMagicBytes(file) {
    return file?.firmaValidada === true;
}

module.exports = {
    upload,
    validarMagicBytes,
    uploadNoticias,
    uploadAtletaFields,
    handleUploadError,
    validarArchivoSubido: (req, res, next) => {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
        }
        next();
    },
    logUploadExitoso: (req, res, next) => {
        if (req.file) {
            console.log('[UPLOAD] Archivo validado y almacenado');
        }
        next();
    }
};
