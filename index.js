require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cookieParser = require('cookie-parser');
const app = express();

// ── Guardia de arranque ─────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
    console.error('❌ Falta JWT_SECRET en .env. Genera uno con:\n   node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
}

const PORT = process.env.PORT || 3000;
const NODE_ENV    = process.env.NODE_ENV || 'development';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

// ── Proxy / HTTPS (solo producción con TRUST_PROXY=1) ──────────────────────
// En local NUNCA activar, o express creerá que viene de HTTPS y las cookies
// "secure" no se setearán en http://localhost.
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
        // Permitir peticiones sin origen (como apps móviles o Postman)
        // o si el origen está en la lista de permitidos
        if (!origin || allowedOrigins.includes(origin) || origin.includes('onrender.com')) {
            return cb(null, true);
        }
        cb(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// ── Body / cookies ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ── Estáticos ──────────────────────────────────────────────────────────────
// /public/admin queda atrás de la verificación de sesión en los paneles HTML;
// los paneles ya verifican el JWT ellos mismos en DOMContentLoaded y redirigen
// a login si no hay sesión, que es suficiente para desarrollo local.
// Para producción: activar verificarSesionRedirect en este middleware.
app.use(express.static(path.join(__dirname, './public')));

// ── Rutas API ──────────────────────────────────────────────────────────────
const { verificarSesionRole } = require('./middlewares/authMiddleware');

app.use('/api/auth',          require('./routes/authRoutes'));
app.use('/api/pagos',         require('./routes/pagosRoutes'));
app.use('/api/usuarios',      require('./routes/userRoutes'));
app.use('/api/atletas',       require('./routes/atletaRoutes'));
app.use('/api/notificaciones',require('./routes/notificacionesRoutes'));

// Las rutas de directiva exigen rol; verificarSesionRole ya lleva verificarSesion
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

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
