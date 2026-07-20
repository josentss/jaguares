const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.esEmailValido = (email) => typeof email === 'string' && EMAIL_RE.test(email.trim());

exports.esPasswordValida = (password, minLength = 8) =>
    typeof password === 'string' && password.length >= minLength;

exports.esEnteroPositivo = (value) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0;
};

exports.esMontoValido = (value) => {
    const n = parseFloat(value);
    return !Number.isNaN(n) && n > 0 && n <= 999999999;
};

exports.normalizarTexto = (value, maxLength = 255) => {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLength);
};

exports.esEstadoAtletaValido = (estado) =>
    ['activo', 'inactivo', 'espera'].includes(String(estado).toLowerCase());

exports.esEstadoPagoValido = (estado) =>
    ['pendiente', 'aprobado', 'rechazado'].includes(String(estado).toLowerCase());
