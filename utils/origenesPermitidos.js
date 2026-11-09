'use strict';

// Enlaces de producción, previews de Vercel y desarrollo funcionan en su
// PROPIO origen. Solo CORS_ORIGIN autoriza llamadas entre sitios distintos.
// No usar substring/sufijo genérico: cualquier atacante puede desplegar su
// propio sitio en vercel.app u onrender.com.
const METODOS_ESCRITURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function origenCanonico(valor) {
    if (typeof valor !== 'string' || valor.length > 2048) return null;
    try {
        const url = new URL(valor);
        if (!['https:', 'http:'].includes(url.protocol) ||
            url.origin !== valor || url.username || url.password) return null;
        return url.origin;
    } catch {
        return null;
    }
}

function crearPoliticaOrigen({ corsOrigin = '', port = 3000, vercel = false } = {}) {
    // Compatibilidad local. Configuración explícita prevalece sobre fallback.
    const permitidos = new Set((corsOrigin || ('http://localhost:' + port))
        .split(',').map(item => origenCanonico(item.trim())).filter(Boolean));

    function mismoOrigen(req, origin) {
        const host = req.get('host');
        if (typeof host !== 'string' || !host || /[\\/\\\\\\s@?#]/.test(host)) return false;
        const protocolo = vercel ? 'https:' : req.protocol + ':';
        if (!['https:', 'http:'].includes(protocolo)) return false;
        // Normaliza host, IPv6 y puerto sin confiar en un patrón *.vercel.app.
        try {
            const actual = new URL(protocolo + '//' + host);
            return actual.origin === origin && actual.pathname === '/' &&
                !actual.username && !actual.password;
        } catch {
            return false;
        }
    }

    function permitido(req, origen) {
        const normalizado = origenCanonico(origen);
        if (!normalizado) return false;
        return permitidos.has(normalizado) || mismoOrigen(req, normalizado);
    }

    function protegerEscrituras(req, res, next) {
        if (!METODOS_ESCRITURA.has(req.method) ||
            !(req.path === '/api' || req.path.startsWith('/api/'))) return next();

        const origen = req.get('origin');
        if ((origen && !permitido(req, origen)) ||
            (!origen && req.get('sec-fetch-site') === 'cross-site')) {
            return res.status(403).json({
                success: false, message: 'Origen de solicitud no autorizado'
            });
        }
        next();
    }

    // CORS solo establece permisos de lectura para el navegador; protegerEscrituras
    // es necesario porque un POST simple puede ejecutarse sin exponer su respuesta.
    function opcionesCors(req, callback) {
        const origin = req.get('origin');
        callback(null, {
            origin: Boolean(origin && permitido(req, origin)) ? origin : false,
            credentials: true
        });
    }

    return { permitido, protegerEscrituras, opcionesCors };
}

module.exports = { crearPoliticaOrigen, origenCanonico };
