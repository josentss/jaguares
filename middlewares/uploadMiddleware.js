require('dotenv').config();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ── Comprobantes de pago (existente) ───────────────────────────────────────
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

// ── Noticias CMS (existente) ───────────────────────────────────────────────
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

// ── Documentos del atleta (NUEVO) ──────────────────────────────────────────
// Foto: solo imágenes
// Cédula y partida: imágenes o PDF
const storageAtletas = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        const isPdf = file.mimetype === 'application/pdf';
        return {
            folder: 'jaguares/atletas',
            resource_type: isPdf ? 'raw' : 'image',
            allowed_formats: isPdf ? ['pdf'] : ['jpg', 'jpeg', 'png', 'webp'],
            public_id: `${Date.now()}-${file.fieldname}-${Math.random().toString(36).slice(2, 8)}`,
            ...(isPdf ? {} : { transformation: [{ width: 1600, crop: 'limit', quality: 'auto' }] })
        };
    }
});

const uploadAtleta = multer({
    storage: storageAtletas,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
    fileFilter: (req, file, cb) => {
        const allowedImages = ['image/jpeg', 'image/png', 'image/webp'];
        const allowedDocs = [...allowedImages, 'application/pdf'];

        if (file.fieldname === 'foto') {
            if (allowedImages.includes(file.mimetype)) return cb(null, true);
            return cb(new Error('La foto debe ser JPG, PNG o WebP'));
        }
        if (['cedula_archivo', 'partida_nacimiento'].includes(file.fieldname)) {
            if (allowedDocs.includes(file.mimetype)) return cb(null, true);
            return cb(new Error('Cédula y partida deben ser imagen o PDF'));
        }
        return cb(new Error('Campo de archivo no permitido'));
    }
});

// Campos esperados del formulario de atleta
const uploadAtletaFields = uploadAtleta.fields([
    { name: 'foto', maxCount: 1 },
    { name: 'cedula_archivo', maxCount: 1 },
    { name: 'partida_nacimiento', maxCount: 1 }
]);

const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'Archivo demasiado grande (máx. 8 MB)' });
        }
        return res.status(400).json({ success: false, message: 'Error de carga: ' + err.message });
    }
    if (err) {
        return res.status(400).json({ success: false, message: err.message || 'Error al subir archivo' });
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
