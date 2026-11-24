require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cookieParser = require('cookie-parser');
const app = express();
const { cabeceras, filtrarRutas, noEncontrado, esApi } = require('./middlewares/seguridadHttp');
app.disable('x-powered-by');
app.use(cabeceras);

// ── Guardia de arranque (solo avisa, no mata el proceso en Vercel) ──────────
if (!process.env.JWT_SECRET) {
    console.error('❌ Falta JWT_SECRET. Configúralo en las Environment Variables de Vercel.');
    // En Vercel NO hacemos process.exit(1) porque tumba la función
    // Solo lo hacemos en local
    if (process.env.VERCEL !== '1') {
        process.exit(1);
    }
}

const PORT = process.env.PORT || 3000;
const NODE_ENV    = process.env.NODE_ENV || 'development';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

// ── Proxy / HTTPS ──────────────────────────────────────────────────────────
if (TRUST_PROXY) {
    app.set('trust proxy', 1);
    app.use((req, res, next) => {
        const proto = req.headers['x-forwarded-proto'] || 'http';
        if (proto !== 'https') {
            return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
        }
        next();
    });
}

// ── Origenes autorizados / CORS y protección de escrituras ─────────────────
const { crearPoliticaOrigen } = require('./utils/origenesPermitidos');
const politicaOrigen = crearPoliticaOrigen({
    corsOrigin: process.env.CORS_ORIGIN || '',
    port: PORT,
    vercel: process.env.VERCEL === '1'
});
// Verifica ORIGIN antes de que POST/PUT/PATCH/DELETE toquen login, registros,
// pagos, archivos u otras rutas API. Las páginas en su propio dominio (incluido
// Preview) siguen funcionando; solo CORS_ORIGIN autoriza otros dominios.
app.use(politicaOrigen.protegerEscrituras);
app.use(cors(politicaOrigen.opcionesCors));

// ── Body / cookies ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Autorizar los HTML privados antes de que el servidor de archivos pueda entregarlos.
app.use(require('./middlewares/panelMiddleware'));

// Vercel enruta las solicitudes a Express según vercel.json.
app.use(filtrarRutas);
const servirPublico = express.static(path.join(__dirname, './public'), { dotfiles: 'deny', redirect: false });
app.use((req, res, next) => esApi(req.path) ? next() : servirPublico(req, res, next));

// ── Rutas API ──────────────────────────────────────────────────────────────
const { verificarSesionRole } = require('./middlewares/authMiddleware');

app.use('/api/auth',          require('./routes/authRoutes'));
app.use('/api/pagos',         require('./routes/pagosRoutes'));
app.use('/api/usuarios',      require('./routes/userRoutes'));
app.use('/api/atletas',       require('./routes/atletaRoutes'));
app.use('/api/notificaciones', require('./routes/notificacionesRoutes'));
app.use('/api/cms',           require('./routes/cmsRoutes'));

app.use('/api/directiva',
    verificarSesionRole(['admin', 'staff', 'directiva']),
    require('./routes/directivaRoutes')
);

// La tabla de rutas de Express determina qué endpoints existen.
app.use(noEncontrado);

// ── Manejo de errores global ───────────────────────────────────────────────
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof URIError || err.status === 400 && err.type !== 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: 'Solicitud no válida' });
    }
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
        return res.status(err.type === 'entity.too.large' ? 413 : 400).json({
            success: false, message: err.type === 'entity.too.large'
                ? 'La solicitud supera el tamaño permitido' : 'El formato de la solicitud no es válido'
        });
    }
    console.error('[ERROR HTTP]', req.method, err.code || err.type || 'INTERNAL');
    if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// ── Exportar para Vercel + listen solo en local ────────────────────────────
module.exports = app;

// Solo arrancar servidor cuando se ejecuta directamente (local / Docker)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
}
