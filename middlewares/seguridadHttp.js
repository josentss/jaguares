'use strict';

const path = require('node:path');

const PAGINAS = new Set(['/', '/index.html', '/galeria.html', '/admin/login.html']);
const PANELES = new Set(['/admin/panel-directiva.html', '/admin/panel-representante.html']);
const RECURSOS_RAIZ = new Set(['/style.css', '/script.js', '/robots.txt', '/sitemap.xml']);
const HTML_404 = path.join(__dirname, '../public/404.html');

function normalizarRuta(ruta) {
    try {
        const decodificada = decodeURIComponent(ruta);
        if (!decodificada.startsWith('/') || /[\x00-\x1f\x7f]/.test(decodificada)) return null;
        return path.posix.normalize(decodificada.replace(/\\/g, '/'));
    } catch {
        return null;
    }
}

function esApi(ruta) {
    return typeof ruta === 'string' && /^\/api(?:\/|$)/i.test(ruta);
}

function cabeceras(req, res, next) {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        // Compatible con los scripts existentes, PDF y Google Maps.
        // La política estricta de scripts queda para modularización (PR #64).
        'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'none'"
    });
    const ruta = normalizarRuta(req.path);
    if (esApi(req.path) || esApi(ruta) || PANELES.has(ruta?.toLowerCase())) {
        res.set('Cache-Control', 'no-store');
    }
    next();
}

// Los únicos HTML públicos son las entradas explícitas. Los paneles privados
// se sirven mediante panelMiddleware, nunca como recurso estático.
function recursoPublico(ruta) {
    return PAGINAS.has(ruta) || RECURSOS_RAIZ.has(ruta) ||
        /^\/admin\/[a-zA-Z0-9_-]+\.(?:css|js)$/.test(ruta) ||
        /^\/img\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|avif|ico|svg)$/i.test(ruta);
}

function noEncontrado(req, res, next) {
    res.set('Cache-Control', 'no-store');
    const ruta = normalizarRuta(req.path);
    if (esApi(req.path) || esApi(ruta) || !['GET','HEAD'].includes(req.method)) {
        return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
    }
    return res.status(404).sendFile(HTML_404, err => { if (err) next(err); });
}

// Después de proteger paneles: conservar sus alias históricos autorizados,
// pero no servir rutas ambiguas, HTML nuevos o directorios privados por accidente.
function filtrarRutas(req, res, next) {
    const ruta = normalizarRuta(req.path);
    if (!ruta || ruta !== req.path || /[%\\]/.test(req.path)) {
        return noEncontrado(req, res, next);
    }
    if (esApi(ruta) || recursoPublico(ruta)) return next();
    return noEncontrado(req, res, next);
}

module.exports = { cabeceras, filtrarRutas, noEncontrado, normalizarRuta, esApi };
