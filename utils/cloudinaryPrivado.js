'use strict';

const cloudinary = require('cloudinary').v2;
const FORMATOS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);
const RECURSOS = new Set(['image', 'raw']);
const ENTREGAS = new Set(['upload', 'authenticated']);

/**
 * Reconoce estrictamente los assets de Cloudinary que utiliza Jaguares.
 * No se interpreta una URL arbitraria del cliente como destino de descarga.
 * También clasifica enlaces históricos "upload", pero NO los vuelve privados.
 */
function analizarAssetGuardado(url, carpeta) {
    if (typeof url !== 'string' || !url || url.length > 2048 ||
        typeof carpeta !== 'string' || !['jaguares/atletas', 'jaguares_comprobantes'].includes(carpeta)) return null;
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloud || !/^[a-zA-Z0-9_-]+$/.test(cloud)) return null;

    let parsed;
    try { parsed = new URL(url); } catch { return null; }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' ||
        parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash ||
        parsed.pathname.includes('%')) return null;

    const segmentos = parsed.pathname.split('/').slice(1);
    const [nombreCloud, recurso, entrega] = segmentos;
    if (nombreCloud !== cloud || !RECURSOS.has(recurso) || !ENTREGAS.has(entrega)) return null;

    const resto = segmentos.slice(3);
    if (/^v\d+$/.test(resto[0] || '')) resto.shift();
    if (resto.length < 2 || resto.some(segmento =>
        !segmento || segmento === '.' || segmento === '..' || !/^[a-zA-Z0-9_.-]+$/.test(segmento)
    )) return null;

    const ruta = resto.join('/');
    if (!ruta.startsWith(carpeta + '/')) return null;
    const ultimo = resto[resto.length - 1];
    const extension = /^(.+)\.([a-zA-Z0-9]{2,5})$/.exec(ultimo);
    if (!extension || !FORMATOS.has(extension[2].toLowerCase())) return null;

    return {
        public_id: recurso === 'raw' ? ruta : resto.slice(0, -1).concat(extension[1]).join('/'),
        format: extension[2].toLowerCase(),
        resource_type: recurso,
        delivery_type: entrega
    };
}

function analizarAssetAutenticado(url, carpeta) {
    const asset = analizarAssetGuardado(url, carpeta);
    if (!asset || asset.delivery_type !== 'authenticated') return null;
    return {
        public_id: asset.public_id,
        format: asset.format,
        resource_type: asset.resource_type,
        type: 'authenticated'
    };
}

/** Enlace temporal SOLO para assets autenticados de la cuenta propia. */
function enlaceAutorizado(valor, carpeta, fecha = Date.now()) {
    const asset = analizarAssetGuardado(valor, carpeta);
    if (!asset) {
        // No redirigir a hosts/paths inventados si el dato almacenado es anómalo.
        throw new Error('Origen de archivo no permitido');
    }
    if (asset.delivery_type === 'upload') {
        // Compatibilidad histórica. URL sigue siendo pública hasta su migración.
        return valor;
    }
    return cloudinary.utils.private_download_url(asset.public_id, asset.format, {
        type: asset.delivery_type,
        resource_type: asset.resource_type,
        expires_at: Math.floor(fecha / 1000) + 120,
        attachment: false
    });
}

function esCargaPrivadaHabilitada() {
    return process.env.CLOUDINARY_AUTHENTICATED_UPLOADS === '1';
}

module.exports = {
    analizarAssetGuardado,
    analizarAssetAutenticado,
    enlaceAutorizado,
    esCargaPrivadaHabilitada
};
