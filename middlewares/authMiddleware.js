const jwt = require('jsonwebtoken');

// Verifica la cookie httpOnly "token". Si la firma no es válida (o no
// existe, o expiró), se rechaza. A diferencia de la versión anterior,
// esto ya NO puede falsificarse con un curl mandando cabeceras a mano:
// el token solo lo pudo emitir el servidor en /api/auth/login, con una
// clave secreta que el cliente nunca ve.
exports.verificarSesion = (req, res, next) => {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Acceso denegado. No se ha iniciado sesión en el sistema.'
        });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.usuarioId = payload.id_usuario;
        req.usuarioRol = payload.rol;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Sesión inválida o expirada. Vuelve a iniciar sesión.'
        });
    }
};

// Variante para proteger recursos HTML: redirige a login si no hay sesión.
exports.verificarSesionRedirect = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) return res.redirect('/admin/login.html');
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.usuarioId = payload.id_usuario;
        req.usuarioRol = payload.rol;
        next();
    } catch (err) {
        return res.redirect('/admin/login.html');
    }
};

// Middleware factory que verifica sesión y además obliga a roles específicos
exports.verificarSesionRole = function (roles = []) {
    return (req, res, next) => {
        const token = req.cookies?.token;
        if (!token) return res.status(401).json({ success: false, message: 'Acceso denegado' });
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            req.usuarioId = payload.id_usuario;
            req.usuarioRol = payload.rol;
            if (roles.length && !roles.includes(req.usuarioRol)) {
                return res.status(403).json({ success: false, message: 'No autorizado (rol)' });
            }
            next();
        } catch (err) {
            return res.status(401).json({ success: false, message: 'Sesión inválida o expirada' });
        }
    };
};

// Este middleware es más estricto: solo deja pasar a la Directiva o Staff.
// Debe usarse SIEMPRE después de verificarSesion en la cadena de la ruta.
exports.esDirectiva = (req, res, next) => {
    const rolesAutorizados = ['admin', 'staff', 'directiva'];

    if (!rolesAutorizados.includes(req.usuarioRol)) {
        return res.status(403).json({
            success: false,
            message: 'Acceso prohibido. Requiere privilegios de administración.'
        });
    }

    next();
};