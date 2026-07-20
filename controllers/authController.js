const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { esEmailValido, esPasswordValida, normalizarTexto } = require('../utils/validators');
const { logAdminRequest } = require('../utils/requestLogger');

const COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // en dev (http) el navegador rechazaría la cookie si esto fuera true
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000 // 12 horas, igual al expiresIn del token
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

        try {
            const match = await bcrypt.compare(password, usuario.password_hash);

            if (!match) {
                return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
            }

            // SEGURIDAD: Eliminamos el hash de la contraseña antes de mandarlo al frontend
            delete usuario.password_hash;

            // El token es la única fuente de verdad sobre quién eres y qué rol
            // tienes en el resto de la API. Va firmado, así que el cliente no
            // puede alterarlo (a diferencia de las viejas cabeceras x-user-id/x-user-role).
            const token = jwt.sign(
                { id_usuario: usuario.id_usuario, rol: usuario.rol },
                process.env.JWT_SECRET,
                { expiresIn: '12h' }
            );

            res.cookie('token', token, COOKIE_OPTS);

            // Enviamos los datos limpios (id, nombres, apellidos, correo, rol, etc.)
            // El frontend los sigue guardando en localStorage, pero solo para
            // mostrar en pantalla (nombre, bienvenida) — ya no se usan para
            // autenticar peticiones.
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
