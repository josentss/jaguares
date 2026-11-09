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

/**
 * Normaliza SOLO las nuevas subidas autenticadas desde metadatos del servidor.
 *
 * multer-storage-cloudinary entrega filename = public_id y path = secure_url.
 * En cuentas con carpetas dinámicas la ruta dentro de secure_url puede ser
 * distinta de filename. No almacenar esa ruta como referencia privada:
 * construir la identidad canónica con el public_id retornado por la subida.
 *
 * La versión /v1/ es el marcador documentado por Cloudinary para IDs con
 * subcarpetas cuando el adaptador no proporciona version. No se usa como
 * autorización: los GET privados se firman con private_download_url.
 */
function normalizarUploadPrivado(info, archivo, carpeta) {
    const fallo = () => { throw new Error('No se pudo validar la referencia del archivo privado'); };
    if (!info || typeof info !== 'object' || !archivo ||
        !['jaguares/atletas', 'jaguares_comprobantes'].includes(carpeta) ||
        typeof info.filename !== 'string' || typeof info.path !== 'string') return fallo();

    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloud || !/^[a-zA-Z0-9_-]+$/.test(cloud)) return fallo();

    let original;
    try { original = new URL(info.path); } catch { return fallo(); }
    if (original.protocol !== 'https:' || original.hostname !== 'res.cloudinary.com' ||
        original.port || original.username || original.password || original.search ||
        original.hash || original.pathname.includes('%')) return fallo();

    const segmentos = original.pathname.split('/').slice(1);
    if (segmentos[0] !== cloud || !RECURSOS.has(segmentos[1]) ||
        segmentos[2] !== 'authenticated' || segmentos.length < 5) return fallo();

    const recurso = segmentos[1];
    const nombreEntrega = segmentos[segmentos.length - 1];
    const extensionEntrega = /\.([a-zA-Z0-9]{2,5})$/.exec(nombreEntrega)?.[1]?.toLowerCase();
    const mime = archivo.mimetype;
    const formatosMime = {
        'image/jpeg': ['jpg', 'jpeg'],
        'image/jpg': ['jpg', 'jpeg'],
        'image/png': ['png'],
        'image/webp': ['webp'],
        'application/pdf': ['pdf'],
        'application/x-pdf': ['pdf']
    };
    const permitidos = formatosMime[mime];
    const extensionNombre = /\.([a-zA-Z0-9]{2,5})$/.exec(archivo.originalname || '')?.[1]?.toLowerCase();
    if (!permitidos || !permitidos.includes(extensionNombre) ||
        !permitidos.includes(extensionEntrega) || !FORMATOS.has(extensionEntrega)) return fallo();
    if (recurso === 'raw' && extensionEntrega !== 'pdf') return fallo();
    if (carpeta === 'jaguares_comprobantes' && (recurso !== 'image' || extensionEntrega === 'pdf')) return fallo();
    if (archivo.fieldname === 'foto' && (recurso !== 'image' || extensionEntrega === 'pdf')) return fallo();

    const publicId = info.filename;
    if (!publicId.startsWith(carpeta + '/') || publicId.length > 220) return fallo();
    const resto = publicId.slice(carpeta.length + 1).split('/');
    if (resto.some(part => !part || part === '.' || part === '..' ||
        !/^[A-Za-z0-9_.-]+$/.test(part))) return fallo();
    if (recurso === 'raw') {
        if (!publicId.endsWith('.pdf')) return fallo();
    } else if (/\.(?:png|jpg|jpeg|webp|pdf)$/i.test(publicId)) {
        // Las subidas image de Jaguares usan public_id SIN la extensión.
        return fallo();
    }

    // La versión es opcional en el adaptador de Multer. Si no viene, /v1/
    // separa de forma segura las subcarpetas de cualquier transformación.
    const version = /^v[1-9]\d*$/.test(segmentos[3] || '') ? segmentos[3] : 'v1';
    const nombreCanonico = recurso === 'raw' ? publicId : publicId + '.' + extensionEntrega;
    const url = 'https://res.cloudinary.com/' + cloud + '/' + recurso +
        '/authenticated/' + version + '/' + nombreCanonico;
    const validado = analizarAssetAutenticado(url, carpeta);
    if (!validado || validado.public_id !== publicId ||
        validado.resource_type !== recurso || validado.format !== extensionEntrega) return fallo();

    return { ...info, path: url, secure_url: url };
}

function esCargaPrivadaHabilitada() {
    return process.env.CLOUDINARY_AUTHENTICATED_UPLOADS === '1';
}

module.exports = {
    analizarAssetGuardado,
    analizarAssetAutenticado,
    enlaceAutorizado,
    normalizarUploadPrivado,
    esCargaPrivadaHabilitada
};
