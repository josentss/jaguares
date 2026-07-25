const contadores = new Map();
const VENTANA_MS  = 15 * 60 * 1000; // 15 minutos
const MAX_INTENTOS = 5;

exports.limiteAuth = (req, res, next) => {
    const ip  = req.ip || req.connection.remoteAddress || 'unknown';
    const ahora = Date.now();
    const entrada = contadores.get(ip) || { cuenta: 0, desde: ahora };

    if (ahora - entrada.desde > VENTANA_MS) {
        entrada.cuenta = 0;
        entrada.desde  = ahora;
    }

    entrada.cuenta++;
    contadores.set(ip, entrada);

    if (entrada.cuenta > MAX_INTENTOS) {
        return res.status(429).json({
            success: false,
            message: `Demasiados intentos. Espera ${Math.ceil(VENTANA_MS / 60000)} minutos.`
        });
    }

    next();
};
