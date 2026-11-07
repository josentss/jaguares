'use strict';

const cloudinary = require('cloudinary').v2;

// No utilizar un URL genérico recibido del cliente para firmar recursos.
// El único origen válido para recursos nuevos es el cloud configurado.
function analizarAssetAutenticado(url, carpeta) {
    if (typeof url !== 'string' || !url || !process.env.CLOUDINARY_CLOUD_NAME) return null;
    let parsed;
    try { parsed = new URL(url); } catch { return null; }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' ||
        parsed.username || parsed.password || parsed.search || parsed.hash) return null;

    const partes = parsed.pathname.split('/').slice(1);
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (partes[0] !== cloud || !['image', 'raw'].includes(partes[1]) ||
        partes[2] !== 'authenticated') return null;

    let restantes = partes.slice(3);
    if (/^v\d+$/.test(restantes[0] || '')) restantes = restantes.slice(1);
    // El public ID debe ser una ruta directa dentro de una carpeta controlada;
    // no aceptar transformaciones ni referencias a recursos de otra aplicación.
    const ruta = restantes.join('/');
    if (!ruta.startsWith(carpeta + '/') || restantes.some(p => !p || p === '..' || p === '.')) return null;
    const ultimo = restantes[restantes.length - 1];
    const match = /^(.*)\.([A-Za-z0-9]{2,5})$/.exec(ultimo || '');
    if (!match || !match[1]) return null;
    const formato = match[2].toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(formato)) return null;
    const idSinExtension = restantes.slice(0, -1).concat(match[1]).join('/');
    return {
        public_id: partes[1] === 'raw' ? ruta : idSinExtension,
        format: formato,
        resource_type: partes[1],
        type: 'authenticated'
    };
}

/** Enlaces temporales, nunca una firma CDN permanente. */
function enlaceAutorizado(valor, carpeta, fecha = Date.now()) {
    const asset = analizarAssetAutenticado(valor, carpeta);
    if (!asset) return valor; // Activos históricos: compatibilidad hasta migración planificada.
    return cloudinary.utils.private_download_url(asset.public_id, asset.format, {
        type: asset.type,
        resource_type: asset.resource_type,
        expires_at: Math.floor(fecha / 1000) + 120,
        attachment: false
    });
}

function esCargaPrivadaHabilitada() {
    return process.env.CLOUDINARY_AUTHENTICATED_UPLOADS === '1';
}

module.exports = { analizarAssetAutenticado, enlaceAutorizado, esCargaPrivadaHabilitada };
