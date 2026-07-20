const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const FileType = require('file-type');  // use FileType.fileTypeFromFile(...)

// Asegurar que la carpeta exista y que no esté dentro de ./public
const uploadDir = './private_uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Whitelist explícita: solo estos mimetypes se aceptan, y la extensión
// del archivo en disco SIEMPRE sale de este mapa, nunca del nombre
// original que envía el cliente. Esto evita:
//  - "foto.svg" (image/svg+xml puede llevar <script> embebido -> XSS)
//  - "foto.jpg.html" o dobles extensiones
//  - que el Content-Type con que luego se sirva el archivo no coincida
//    con su contenido real
const MIME_A_EXTENSION = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = MIME_A_EXTENSION[file.mimetype] || '';
        const sufijo = crypto.randomBytes(8).toString('hex');
        cb(null, `pago_${Date.now()}_${sufijo}${ext}`);
    }
});

// Filtro de archivos: solo pasan los mimetypes de la whitelist de arriba.
const fileFilter = (req, file, cb) => {
    if (MIME_A_EXTENSION[file.mimetype]) {
        cb(null, true);
    } else {
        cb(new Error('Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.'), false);
    }
};

const { execFile } = require('child_process');

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 3 * 1024 * 1024 } // 3MB para no forzar a representantes comunes
});

// Escanea un archivo con clamscan o clamdscan si alguno está disponible.
// Devuelve true si limpio, false si infectado. Si no hay escáner, devuelve true
// pero registra una advertencia.
function scanWithClam(filePath) {
    return new Promise((resolve) => {
        // Prefer explicit full path on Windows where clamscan.exe is typically installed.
        const possible = [
            'C:\\Program Files\\ClamAV\\clamscan.exe',
            'C:\\Program Files (x86)\\ClamAV\\clamscan.exe',
            'clamscan',
            'clamdscan'
        ];
        let tried = 0;
        function tryNext() {
            if (tried >= possible.length) {
                console.warn('No se encontró clamscan/clamdscan; no se realizó escaneo antivirus');
                return resolve(true);
            }
            const cmd = possible[tried++];
            execFile(cmd, ['--no-summary', filePath], (err, stdout, stderr) => {
                if (err) {
                    if (err.code === 1) {
                        console.warn(`${cmd} detectó infección en ${filePath}`);
                        return resolve(false);
                    }
                    if (err.code === 2) {
                        console.error(`${cmd} error al escanear:`, stderr || err.message);
                        return tryNext();
                    }
                    if (err.code === 'ENOENT' || err.code === 'ENOENT') {
                        return tryNext();
                    }
                    return tryNext();
                }
                // stdout may contain info; consider logging in verbose mode only
                console.log(`${cmd} scan output:`, stdout?.toString().slice(0,200));
                resolve(true);
            });
        }
        tryNext();
    });
}

// Valida los "magic bytes" del archivo ya en disco y realiza escaneo antivirus.
// Si no coincide o está infectado, devuelve false.
async function validarMagicBytes(filename, originalName) {
    try {
        const filePath = path.join(uploadDir, filename);
        const ft = await FileType.fileTypeFromFile(filePath);
        console.log('Validando archivo:', filePath, '=>', ft);
        if (!ft || !ft.mime) return false;
        // validar mime permitido
        const permitido = Boolean(MIME_A_EXTENSION[ft.mime]);
        if (!permitido) return false;

        // Detectar doble extensión peligrosa en el nombre original (p.ej. foto.jpg.php)
        if (originalName && typeof originalName === 'string') {
            const parts = originalName.toLowerCase().split('.');
            if (parts.length > 2) {
                const dangerous = ['php','php3','php4','phtml','exe','js','jsp','asp','aspx','html','htm','svg','sh','bat'];
                // comprobar si alguna parte intermedia tiene extensión peligrosa
                const middle = parts.slice(1, -1);
                if (middle.some(p => dangerous.includes(p))) {
                    console.warn('Nombre original con doble extensión peligrosa:', originalName);
                    return false;
                }
            }
        }

        // Escaneo antivirus (si disponible)
        const limpio = await scanWithClam(filePath);
        if (!limpio) return false;

        return true;
    } catch (err) {
        console.error('Error validando magic bytes o antivirus:', err);
        return false;
    }
}

module.exports = { upload, validarMagicBytes, uploadDir };