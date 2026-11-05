const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');

const INACTIVIDAD_SEGUNDOS = 15 * 60;
const DURACION_SEGUNDOS = 12 * 60 * 60;
const ahoraSegundos = () => Math.floor(Date.now() / 1000);
const opcionesCookie = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
// La renovación nunca reemite el token principal. Cada login tiene su propia cookie
// de actividad: una respuesta antigua no restaura un logout ni sobrescribe otro login.
const nombreActividad = payload => `jaguares_actividad_${payload.jti}`;

function firmarActividad(payload, ahora = ahoraSegundos()) {
    return jwt.sign({ sesion: payload.jti, iat: ahora, exp: Math.min(ahora + INACTIVIDAD_SEGUNDOS, payload.exp) },
        process.env.JWT_SECRET, { algorithm: 'HS256', audience: 'jaguares-actividad' });
}

function crearCredenciales(usuario, ahora = ahoraSegundos()) {
    const payload = { id_usuario: usuario.id_usuario, rol: usuario.rol, jti: randomUUID(),
        iat: ahora, exp: ahora + DURACION_SEGUNDOS };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', audience: 'jaguares-sesion' });
    const actividad = firmarActividad(payload, ahora);
    return { token, actividad, payload, cookies: { token, [nombreActividad(payload)]: actividad } };
}

function verificarCredenciales(cookies, ahora = ahoraSegundos()) {
    const payload = jwt.verify(cookies?.token, process.env.JWT_SECRET,
        { algorithms: ['HS256'], audience: 'jaguares-sesion', clockTimestamp: ahora });
    const actividad = jwt.verify(cookies?.[nombreActividad(payload)], process.env.JWT_SECRET,
        { algorithms: ['HS256'], audience: 'jaguares-actividad', clockTimestamp: ahora });
    if (!Number.isSafeInteger(payload.id_usuario) || payload.id_usuario <= 0 || typeof payload.rol !== 'string' ||
        typeof payload.jti !== 'string' || !payload.jti || actividad.sesion !== payload.jti ||
        !Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.iat) || payload.iat > ahora ||
        payload.exp - payload.iat > DURACION_SEGUNDOS ||
        !Number.isSafeInteger(actividad.exp) || !Number.isSafeInteger(actividad.iat) || actividad.iat > ahora ||
        actividad.exp > payload.exp || actividad.exp - actividad.iat > INACTIVIDAD_SEGUNDOS) {
        throw new Error('Credenciales de sesión inválidas');
    }
    return { payload, actividad };
}

function establecerActividad(res, payload, ahora = ahoraSegundos()) {
    const exp = Math.min(ahora + INACTIVIDAD_SEGUNDOS, payload.exp);
    res.cookie(nombreActividad(payload), firmarActividad(payload, ahora), { ...opcionesCookie(), maxAge: (exp - ahora) * 1000 });
    return exp;
}

function limpiarActividad(res, cookies = {}) {
    for (const nombre of Object.keys(cookies)) {
        if (/^jaguares_actividad_[0-9a-f-]{36}$/.test(nombre)) res.clearCookie(nombre, opcionesCookie());
    }
}

function establecerSesion(res, usuario, cookies) {
    const credenciales = crearCredenciales(usuario);
    limpiarActividad(res, cookies);
    res.cookie('token', credenciales.token, { ...opcionesCookie(), maxAge: DURACION_SEGUNDOS * 1000 });
    res.cookie(nombreActividad(credenciales.payload), credenciales.actividad, { ...opcionesCookie(), maxAge: INACTIVIDAD_SEGUNDOS * 1000 });
}

function cerrarSesion(res, cookies) {
    res.clearCookie('token', opcionesCookie());
    limpiarActividad(res, cookies);
}

function informacionSesion(req) {
    return { id: req.sesionPayload.jti, vence: req.actividadExp * 1000,
        limite: req.sesionPayload.exp * 1000, servidor: Date.now() };
}

module.exports = { crearCredenciales, verificarCredenciales, establecerSesion, establecerActividad,
    cerrarSesion, informacionSesion, INACTIVIDAD_SEGUNDOS, DURACION_SEGUNDOS };
