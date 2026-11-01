// Límites de intentos (en memoria, por instancia del servidor).
const VENTANA_MS = 15 * 60 * 1000; // 15 minutos

function crearContador() {
    const mapa = new Map();
    return {
        leer(clave) {
            const e = mapa.get(clave);
            if (!e) return 0;
            if (Date.now() - e.desde > VENTANA_MS) { mapa.delete(clave); return 0; }
            return e.cuenta;
        },
        sumar(clave) {
            const ahora = Date.now();
            const e = mapa.get(clave);
            if (!e || ahora - e.desde > VENTANA_MS) mapa.set(clave, { cuenta: 1, desde: ahora });
            else e.cuenta++;
            if (mapa.size > 5000) {
                for (const [k, v] of mapa) if (ahora - v.desde > VENTANA_MS) mapa.delete(k);
            }
        },
        borrar(clave) { mapa.delete(clave); }
    };
}

function ipDe(req) {
    return req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
}

function bloquear(res) {
    return res.status(429).json({
        success: false,
        message: `Demasiados intentos fallidos. Espera ${Math.ceil(VENTANA_MS / 60000)} minutos.`
    });
}

// ── Login: solo cuentan los intentos FALLIDOS ───────────────────────────────
// Entrar y salir de sesión (cambiar de panel) no gasta cupo. Un acierto limpia
// el contador de ese correo, pero no el total por IP.
const MAX_FALLOS_CORREO = 8;   // fallos por IP + correo
const MAX_FALLOS_IP     = 40;  // fallos por IP (cualquier correo)
const fallosCorreo = crearContador();
const fallosIp     = crearContador();

exports.limiteLogin = (req, res, next) => {
    const ip = ipDe(req);
    const correo = String((req.body && req.body.email) || '').trim().toLowerCase().slice(0, 120);
    const claveCorreo = `${ip}|${correo}`;

    if (fallosIp.leer(ip) >= MAX_FALLOS_IP || fallosCorreo.leer(claveCorreo) >= MAX_FALLOS_CORREO) {
        return bloquear(res);
    }

    res.on('finish', () => {
        if (res.statusCode === 200) fallosCorreo.borrar(claveCorreo);
        else if (res.statusCode === 400 || res.statusCode === 401) {
            fallosCorreo.sumar(claveCorreo);
            fallosIp.sumar(ip);
        }
    });
    next();
};

// ── Registro público: cuenta cada solicitud por IP ──────────────────────────
const MAX_REGISTROS = 20;
const registros = crearContador();

exports.limiteAuth = (req, res, next) => {
    const ip = ipDe(req);
    if (registros.leer(ip) >= MAX_REGISTROS) return bloquear(res);
    registros.sumar(ip);
    next();
};
