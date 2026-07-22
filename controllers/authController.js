const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { esEmailValido, esPasswordValida, normalizarTexto } = require('../utils/validators');
const { logAdminRequest } = require('../utils/requestLogger');

const COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000
};

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
        // ------------------------------------------

        try {
            const match = await bcrypt.compare(password, usuario.password_hash);

            if (!match) {
                return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
            }

            delete usuario.password_hash;

            const token = jwt.sign(
                { id_usuario: usuario.id_usuario, rol: usuario.rol },
                process.env.JWT_SECRET,
                { expiresIn: '12h' }
            );

            res.cookie('token', token, COOKIE_OPTS);

            res.json({ success: true, message: 'Login exitoso', usuario });
        } catch (errCompare) {
            console.error('Error verificando contraseña:', errCompare.message);
            res.status(500).json({ success: false, message: 'Error de servidor' });
        }
    });
};

// LOGOUT
exports.logout = (req, res) => {
    res.clearCookie('token', COOKIE_OPTS);
    res.json({ success: true, message: 'Sesión cerrada' });
};

// ME: retornar información del usuario autenticado
exports.me = (req, res) => {
    const id = req.usuarioId;
    if (!id) return res.status(401).json({ success: false, message: 'No autenticado' });

    db.query('SELECT id_usuario, nombres, apellidos, correo, rol FROM usuarios WHERE id_usuario = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error de servidor' });
        if (!results || results.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        res.json({ success: true, usuario: results[0] });
    });
};

// REGISTRO
exports.register = async (req, res) => {
    const nombres = normalizarTexto(req.body.nombres, 80);
    const apellidos = normalizarTexto(req.body.apellidos, 80);
    const email = normalizarTexto(req.body.email, 120).toLowerCase();
    const { password } = req.body;

    if (!nombres || !apellidos || !esEmailValido(email) || !esPasswordValida(password)) {
        return res.status(400).json({
            success: false,
            message: 'Datos inválidos. Revisa nombres, correo y contraseña (mínimo 8 caracteres).'
        });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const query = 'INSERT INTO usuarios (nombres, apellidos, correo, password_hash, rol) VALUES (?, ?, ?, ?, "representante")';
    db.query(query, [nombres, apellidos, email, passwordHash], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: 'Ese correo ya está registrado' });
            }
            console.error(err);
            return res.status(500).json({ success: false, message: 'Error al registrar en BD' });
        }
        res.json({ success: true, message: 'Usuario registrado correctamente' });
    });
};
