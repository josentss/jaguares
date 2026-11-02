const jwt = require('jsonwebtoken');
const db = require('../config/db');

function denegar(req, res, codigo, mensaje, redirigir) {
    if (redirigir && codigo !== 503) return res.redirect('/admin/login.html');
    return res.status(codigo).json({ success: false, message: mensaje });
}

function validarSesion(req, res, next, redirigir = false) {
    if (req.sesionVerificada) return next();

    const token = req.cookies?.token;
    if (!token) return denegar(req, res, 401, 'Acceso denegado. Inicia sesión.', redirigir);

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return denegar(req, res, 401, 'Sesión inválida o expirada.', redirigir);
    }

    if (!Number.isSafeInteger(payload?.id_usuario) || payload.id_usuario <= 0 ||
        typeof payload.rol !== 'string') {
        return denegar(req, res, 401, 'Sesión inválida.', redirigir);
    }

    db.query('SELECT rol, estado FROM usuarios WHERE id_usuario = ?', [payload.id_usuario], (err, rows) => {
        if (err) {
            console.error('Error verificando sesión:', err.message);
            return denegar(req, res, 503, 'No se pudo verificar la sesión.', redirigir);
        }

        const usuario = rows?.[0];
        if (!usuario || usuario.rol !== payload.rol) {
            return denegar(req, res, 401, 'La sesión ya no es válida.', redirigir);
        }

        if (['pendiente', 'rechazado', 'inactivo'].includes(usuario.estado) ||
            (usuario.rol === 'representante' && usuario.estado !== 'aprobado')) {
            return denegar(req, res, 403, 'Cuenta no habilitada. Contacta a la directiva.', redirigir);
        }

        req.usuarioId = payload.id_usuario;
        req.usuarioRol = usuario.rol;
        req.usuarioEstado = usuario.estado;
        req.sesionVerificada = true;
        next();
    });
}

exports.verificarSesion = (req, res, next) => validarSesion(req, res, next);

exports.verificarSesionRedirect = (req, res, next) =>
    validarSesion(req, res, next, true);

exports.verificarSesionRole = (roles = []) => (req, res, next) => {
    validarSesion(req, res, () => {
        if (roles.length && !roles.includes(req.usuarioRol)) {
            return res.status(403).json({ success: false, message: 'No autorizado (rol)' });
        }
        next();
    });
};

exports.esDirectiva = (req, res, next) => {
    if (!['admin', 'staff', 'directiva'].includes(req.usuarioRol)) {
        return res.status(403).json({
            success: false,
            message: 'Acceso prohibido. Requiere privilegios de administración.'
        });
    }
    next();
};
