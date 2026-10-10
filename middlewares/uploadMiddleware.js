require('dotenv').config();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

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
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1200, crop: 'limit' }]
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }
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
    storage: storageNoticias,
    limits: { fileSize: 5 * 1024 * 1024 },
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
        resource_type: 'auto',
        // NO poner allowed_formats aquí: rompe la firma de Cloudinary
        public_id: (req, file) =>
            `${Date.now()}-${file.fieldname}-${Math.random().toString(36).slice(2, 8)}`
    }
});

const uploadAtleta = multer({
    storage: storageAtletas,
    limits: { fileSize: 5 * 1024 * 1024 },
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

async function validarMagicBytes() {
    return true;
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
            console.log(`[UPLOAD] ${req.file.originalname} → ${req.file.path}`);
        }
        next();
    }
};
