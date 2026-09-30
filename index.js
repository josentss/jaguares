require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cookieParser = require('cookie-parser');
const app = express();

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

// ── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || `http://localhost:${PORT}`)
    .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
    origin(origin, cb) {
        if (!origin || allowedOrigins.includes(origin) ||
            origin.includes('vercel.app') || origin.includes('onrender.com')) {
            return cb(null, true);
        }
        cb(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// ── Body / cookies ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ── Estáticos (en Vercel se sirven automáticamente desde /public) ──────────
app.use(express.static(path.join(__dirname, './public')));

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

// ── Manejo de errores global ───────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message || err);
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
