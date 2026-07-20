// utils/requestLogger.js
// Logger mínimo: escribe a consola en desarrollo, fácil de reemplazar
// con winston/pino cuando el proyecto llegue a producción.
exports.logAdminRequest = (req, res, extra = {}) => {
    if (process.env.NODE_ENV === 'production') return; // silenciar en prod si se prefiere
    const { method, originalUrl } = req;
    console.log(`[ADMIN] ${method} ${originalUrl}`, Object.keys(extra).length ? extra : '');
};

exports.logError = (err, req) => {
    console.error(`[ERROR] ${req?.method || '-'} ${req?.originalUrl || '-'}:`, err?.message || err);
};
