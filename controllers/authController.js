const db = require('../config/db');
const bcrypt = require('bcrypt');
const { conIdentidades, comprobarUsuario, responderError } = require('../utils/integridad');
const { establecerSesion, establecerActividad, cerrarSesion, informacionSesion } = require('../utils/sesion');
const { esEmailValido, esPasswordValida, normalizarTexto, esNombreValido } = require('../utils/validators');
const { logAdminRequest } = require('../utils/requestLogger');

// LOGIN
exports.login = (req, res) => {
    const email = normalizarTexto(req.body.email, 120).toLowerCase();
    const { password } = req.body;

    if (!esEmailValido(email) || !password) {
        return res.status(400).json({ success: false, message: 'Correo o contraseña inválidos' });
    }

    db.query('SELECT * FROM usuarios WHERE correo = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error de servidor' });
        if (results.length === 0) return res.status(401).json({ success: false, message: 'Usuario no encontrado' });

        const usuario = results[0];

        // --- VALIDACIÓN DEL ANILLO DE SEGURIDAD ---
        if (usuario.estado === 'pendiente') {
            return res.status(403).json({
                success: false,
                message: 'Tu cuenta está pendiente de aprobación por la directiva.'
            });
        }

        if (usuario.estado === 'rechazado') {
            return res.status(403).json({
                success: false,
                message: 'Tu solicitud de registro ha sido rechazada por la directiva.'
            });
        }
        if (usuario.estado === 'inactivo' ||
            (usuario.rol === 'representante' && usuario.estado !== 'aprobado')) {
            return res.status(403).json({
                success: false,
                message: 'Tu cuenta no está habilitada. Contacta a la directiva.'
            });
        }
        // ------------------------------------------

        try {
            const match = await bcrypt.compare(password, usuario.password_hash);

            if (!match) {
                return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
            }

            delete usuario.password_hash;

            establecerSesion(res, usuario, req.cookies);

            res.json({ success: true, message: 'Login exitoso', usuario });
        } catch (errCompare) {
            console.error('Error verificando contraseña:', errCompare.message);
            res.status(500).json({ success: false, message: 'Error de servidor' });
        }
    });
};

// LOGOUT
exports.logout = (req, res) => {
    cerrarSesion(res, req.cookies);
    res.json({ success: true, message: 'Sesión cerrada' });
};

// ME: retornar información del usuario autenticado
exports.me = (req, res) => {
    const id = req.usuarioId;
    if (!id) return res.status(401).json({ success: false, message: 'No autenticado' });

    db.query('SELECT id_usuario, nombres, apellidos, correo, rol FROM usuarios WHERE id_usuario = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error de servidor' });
        if (!results || results.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        res.json({ success: true, usuario: results[0], sesion: informacionSesion(req) });
    });
};

// Solo una interacción explícita renueva la actividad; las consultas automáticas no lo hacen.
exports.actividad = (req, res) => {
    let origenValido = true;
    const origen = req.get('origin');
    if (origen) {
        try { origenValido = new URL(origen).host === String(req.get('host') || '').toLowerCase(); }
        catch { origenValido = false; }
    }
    if (!origenValido || req.get('x-jaguares-activity') !== '1') {
        return res.status(403).json({ success: false, message: 'Solicitud de actividad no válida.' });
    }
    req.actividadExp = establecerActividad(res, req.sesionPayload);
    return res.json({ success: true, sesion: informacionSesion(req) });
};

// REGISTRO
exports.register = async (req, res) => {
    const nombres = normalizarTexto(req.body.nombres, 80);
    const apellidos = normalizarTexto(req.body.apellidos, 80);
    const email = normalizarTexto(req.body.email, 120).toLowerCase();
    const { password } = req.body;

    if (!esNombreValido(req.body.nombres) || !esNombreValido(req.body.apellidos) ||
        !esEmailValido(req.body.email) || req.body.email.length > 120 ||
        !esPasswordValida(password)) {
        return res.status(400).json({
            success: false,
            message: 'Datos inválidos. Nombres con letras (2–80), correo válido (máx. 120) y clave de 8–128 caracteres.'
        });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const id = await conIdentidades(async client => {
            await comprobarUsuario(client, { correo: email });
            const { rows } = await client.query(`
                INSERT INTO usuarios (nombres, apellidos, correo, password_hash, rol, estado)
                VALUES ($1, $2, $3, $4, 'representante', 'pendiente') RETURNING id_usuario`,
            [nombres, apellidos, email, passwordHash]);
            return rows[0].id_usuario;
        });
        return res.json({ success: true,
            message: 'Usuario registrado correctamente y en espera de aprobación', id_usuario: id });
    } catch (error) {
        return responderError(res, error);
    }
};
