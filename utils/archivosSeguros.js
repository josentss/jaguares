'use strict';

const { Readable } = require('node:stream');
const { extname } = require('node:path');
const multer = require('multer');

const LIMITE_ARCHIVO = 5 * 1024 * 1024;
const EXTENSIONES = Object.freeze({
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf'
});

function normalizarMime(mime) {
    if (mime === 'image/jpg') return 'image/jpeg';
    if (mime === 'application/x-pdf') return 'application/pdf';
    return mime;
}

function extensionDeclarada(nombre) {
    const ext = extname(typeof nombre === 'string' ? nombre : '').slice(1).toLowerCase();
    return ext === 'jpeg' ? 'jpg' : ext;
}

/**
 * Rechaza archivos que solo simulan ser una imagen/PDF por el nombre o
 * Content-Type. Es una comprobación de firma, no un antivirus ni un parser.
 */
async function validarContenidoArchivo(buffer, archivo, extensiones) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.length > LIMITE_ARCHIVO ||
        !archivo || !Array.isArray(extensiones)) return false;

    const extension = extensionDeclarada(archivo.originalname);
    if (!extensiones.includes(extension) || !EXTENSIONES[extension]) return false;
    if (normalizarMime(archivo.mimetype) !== EXTENSIONES[extension]) return false;

    try {
        // file-type v18 es ESM; import dinámico conserva CommonJS en el backend.
        const { fileTypeFromBuffer } = await import('file-type');
        const detectado = await fileTypeFromBuffer(buffer);
        return Boolean(detectado &&
            detectado.ext === extension &&
            detectado.mime === EXTENSIONES[extension]);
    } catch {
        // Fallar cerrado si falla el detector o la firma no es interpretable.
        return false;
    }
}

/**
 * Multer entrega el stream a este adaptador. Primero se lee hasta el límite,
 * luego se verifica su firma y SOLO entonces se delega a CloudinaryStorage.
 * req.file recibe firmaValidada=true únicamente después de la verificación.
 */
function storageConValidacion(storageCloudinary, tiposPorCampo) {
    return {
        async _handleFile(req, file, callback) {
            let finalizado = false;
            const resolver = (err, info) => {
                if (finalizado) return;
                finalizado = true;
                callback(err, info);
            };
            try {
                const tipos = tiposPorCampo[file.fieldname];
                if (!tipos) return resolver(new Error('Campo de archivo no permitido'));
                let total = 0;
                const partes = [];
                for await (const trozo of file.stream) {
                    total += trozo.length;
                    if (total > LIMITE_ARCHIVO) {
                        return resolver(new multer.MulterError('LIMIT_FILE_SIZE', file.fieldname));
                    }
                    partes.push(trozo);
                }
                if (file.stream.truncated) {
                    return resolver(new multer.MulterError('LIMIT_FILE_SIZE', file.fieldname));
                }
                const buffer = Buffer.concat(partes, total);
                if (!(await validarContenidoArchivo(buffer, file, tipos))) {
                    return resolver(new Error('El archivo no coincide con un formato permitido'));
                }
                const archivoVerificado = { ...file, stream: Readable.from([buffer]) };
                storageCloudinary._handleFile(req, archivoVerificado, (err, info) => {
                    if (err) return resolver(err);
                    resolver(null, { ...info, firmaValidada: true });
                });
            } catch (err) {
                resolver(err);
            }
        },
        _removeFile(req, file, callback) {
            if (typeof storageCloudinary._removeFile === 'function') {
                return storageCloudinary._removeFile(req, file, callback);
            }
            callback(null);
        }
    };
}

module.exports = { validarContenidoArchivo, storageConValidacion, LIMITE_ARCHIVO };
