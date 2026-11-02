const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.esEmailValido = (email) => typeof email === 'string' && EMAIL_RE.test(email.trim());

exports.esPasswordValida = (password, minLength = 8) =>
    typeof password === 'string' && password.length >= minLength;

exports.esEnteroPositivo = (value) => {
    if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value.trim())) return false;
    return Number.isSafeInteger(Number(value.trim()));
};

exports.esMontoValido = (value) => {
    if (typeof value !== 'string' && typeof value !== 'number') return false;
    const texto = String(value).trim();
    if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(texto)) return false;
    const monto = Number(texto);
    return Number.isFinite(monto) && monto > 0 && monto <= 999999999;
};

exports.esFechaISOValida = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const fecha = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(fecha.getTime()) &&
        fecha.toISOString().slice(0, 10) === value &&
        Number(value.slice(0, 4)) >= 1900;
};

exports.normalizarTexto = (value, maxLength = 255) => {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLength);
};

exports.esEstadoAtletaValido = (estado) =>
    ['activo', 'inactivo', 'espera'].includes(String(estado).toLowerCase());

exports.esEstadoPagoValido = (estado) =>
    ['pendiente', 'aprobado', 'rechazado'].includes(String(estado).toLowerCase());
