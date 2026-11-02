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
    typeof estado === 'string' &&
    ['activo', 'inactivo', 'espera'].includes(estado);

exports.esEstadoPagoValido = (estado) =>
    typeof estado === 'string' &&
    ['pendiente', 'aprobado', 'rechazado'].includes(estado);

/**
 * Validaciones compartidas con el formulario web.
 * No truncar silenciosamente: los valores largos deben recibir un error explícito.
 */
const SIN_CONTROL = /^[^\u0000-\u001f\u007f-\u009f]*$/u;
const NOMBRE = /^[\p{L}\p{M}]+(?:[ '\u2019.\-][\p{L}\p{M}]+)*$/u;
const CEDULA = /^[VE]-[0-9]{5,9}$/;
const NUMERO_TELEFONO = /^(?:0[0-9]{10}|(?:\+?58)[1-9][0-9]{9}|\+[1-9][0-9]{7,14})$/;

exports.esNombreValido = value =>
    typeof value === 'string' && value.trim().length >= 2 &&
    value.trim().length <= 80 && NOMBRE.test(value.trim());

exports.esCedulaValida = value =>
    typeof value === 'string' && CEDULA.test(value.trim().toUpperCase());

exports.esTelefonoValido = value => {
    if (typeof value !== 'string' || !/^[+0-9() .-]{8,30}$/.test(value.trim())) return false;
    const limpio = value.trim().replace(/[() .-]/g, '');
    return NUMERO_TELEFONO.test(limpio);
};

exports.normalizarTelefono = value =>
    typeof value === 'string' ? value.trim().replace(/[() .-]/g, '') : '';

exports.esTextoLibreValido = (value, maxLength = 255, obligatorio = true) =>
    typeof value === 'string' &&
    value.trim().length <= maxLength &&
    (!obligatorio || value.trim().length > 0) &&
    SIN_CONTROL.test(value) &&
    !/[<>]/.test(value);
