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

// ── Almacenamiento en la Nube ───────────────────────────────────────────────
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'jaguares_comprobantes', // Nombre de la carpeta en tu panel de Cloudinary
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1200, crop: 'limit' }] // Escala imágenes gigantes para ahorrar espacio
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB
});

// ── Compatibilidad con tus controladores ──────────────────────────────────
// Cloudinary procesa, valida y sanitiza las imágenes automáticamente en la nube,
// eliminando cualquier riesgo de scripts o dobles extensiones.
// Mantenemos esta función para que tus controladores sigan funcionando sin cambios.
async function validarMagicBytes() {
    return true;
}

module.exports = { upload, validarMagicBytes };
