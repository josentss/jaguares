const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.esEmailValido = (email) => typeof email === 'string' && EMAIL_RE.test(email.trim());

exports.esPasswordValida = (password, minLength = 8) =>
    typeof password === 'string' && password.length >= minLength &&
    password.length <= 128 && password.trim().length > 0;

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

// Valores emitidos por los formularios multipart y clientes JSON. Ausente = no.
exports.esIndicadorFormularioValido = value =>
    value === undefined || [true, false, '1', '0', 'true', 'false', 'on', 'off'].includes(value);

/**
 * Validaciones compartidas con el formulario web.
 * No truncar silenciosamente: los valores largos deben recibir un error explícito.
 */
const SIN_CONTROL = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]*$/u;
const NOMBRE = /^[\p{L}\p{M}]+(?:[ '\u2019.\-][\p{L}\p{M}]+)*$/u;
// Política de captura para el club: 7 a 9 dígitos; no acredita la emisión oficial.
const CEDULA = /^[VE]-[0-9]{7,9}$/;
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


/** Edad cumplida en la fecha del registro (hora local de Venezuela).
 * La elegibilidad por temporada/categoría se configurará por separado.
 */
exports.esEdadAtletaValida = (fechaNacimiento, hoyISO) => {
    if (!exports.esFechaISOValida(fechaNacimiento)) return false;
    let hoy = hoyISO;
    if (hoy === undefined) {
        const partes = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date());
        const dato = tipo => partes.find(x => x.type === tipo)?.value;
        hoy = [dato('year'), dato('month'), dato('day')].join('-');
    }
    if (!exports.esFechaISOValida(hoy)) return false;
    const [an, mn, dn] = fechaNacimiento.split('-').map(Number);
    const [ah, mh, dh] = hoy.split('-').map(Number);
    const edad = ah - an - (mh < mn || (mh === mn && dh < dn) ? 1 : 0);
    return fechaNacimiento <= hoy && edad >= 5 && edad <= 18;
};

/** No validar la existencia de una dirección con expresiones regulares.
 * Se rechazan solo entradas insuficientes o claramente artificiales.
 */
exports.esDireccionValida = value => {
    if (!exports.esTextoLibreValido(value, 255)) return false;
    const texto = value.trim();
    const letras = texto.match(/\p{L}/gu) || [];
    return texto.length >= 7 && letras.length >= 3 && !/\d{15,}/.test(texto);
};

/** El campo médico admite cifras y códigos: diabetes tipo 1, B12, 500 mg, etc. */
exports.esCondicionMedicaValida = value => {
    if (!exports.esTextoLibreValido(value, 500, false)) return false;
    const texto = value.trim();
    if (!texto) return true;
    return /\p{L}/u.test(texto) && !/\p{L}\d{3,}\p{L}/u.test(texto);
};
