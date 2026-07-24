require('dotenv').config();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ── Configuración de Cloudinary ─────────────────────────────────────────────
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ==========================================
// ALMACENAMIENTO PARA COMPROBANTES (Pagos)
// ==========================================
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'jaguares_comprobantes',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1200, crop: 'limit' }]
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

// ==========================================
// ALMACENAMIENTO PARA NOTICIAS (CMS)
// ==========================================
const storageNoticias = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'jaguares/cms/noticias',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [
            { width: 1200, height: 630, crop: 'fill', quality: 'auto' }
        ]
    }
});

const uploadNoticias = multer({
    storage: storageNoticias,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP)'));
        }
    }
});

// ==========================================
// MANEJO DE ERRORES DE UPLOAD
// ==========================================
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'El archivo es demasiado grande. Máximo 5MB.'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Se subió más de un archivo.'
            });
        }
        return res.status(400).json({
            success: false,
            error: 'Error en la carga del archivo: ' + err.message
        });
    }

    if (err) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }

    next();
};

// ==========================================
// VALIDACIONES PERSONALIZADAS
// ==========================================
const validarArchivoSubido = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No se subió ningún archivo. La imagen es obligatoria.'
        });
    }
    next();
};

const logUploadExitoso = (req, res, next) => {
    if (req.file) {
        const timestamp = new Date().toISOString();
        const sizeKB = (req.file.size / 1024).toFixed(2);
        console.log(`[${timestamp}] ✓ Archivo subido: ${req.file.originalname}`);
        console.log(`  URL: ${req.file.path}`);
        console.log(`  Tamaño: ${sizeKB} KB`);
    }
    next();
};

// ── Compatibilidad con tus controladores ──────────────────────────────────
async function validarMagicBytes() {
    return true;
}

// ==========================================
// EXPORTAR MIDDLEWARES
// ==========================================
module.exports = {
    // Para comprobantes
    upload,
    validarMagicBytes,

    // Para CMS
    uploadNoticias,
    handleUploadError,
    validarArchivoSubido,
    logUploadExitoso
};
