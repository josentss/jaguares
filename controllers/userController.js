const db = require('../config/db');
const bcrypt = require('bcrypt');
const { conIdentidades, comprobarUsuario, ErrorIntegridad, responderError } = require('../utils/integridad');
const { esNombreValido, esCedulaValida, esTelefonoValido, normalizarTelefono, esPasswordValida } = require('../utils/validators');

// Obtener los datos del perfil de un usuario
exports.obtenerPerfil = (req, res) => {
    const { id } = req.params;

    const esDirectiva = ['directiva', 'staff', 'admin'].includes(req.usuarioRol);
    const esDueño = String(req.usuarioId) === String(id);

    if (!esDueño && !esDirectiva) {
        return res.status(403).json({ success: false, message: 'No puedes ver el perfil de otro usuario' });
    }

    // Seleccionamos los campos necesarios (NUNCA el password_hash por seguridad)
    const query = 'SELECT id_usuario, nombres, apellidos, correo, cedula, telefono1, telefono2, rol FROM usuarios WHERE id_usuario = ?';

    db.query(query, [id], (err, results) => {
        if (err) {
            console.error("Error al obtener perfil:", err);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        res.json({ success: true, perfil: results[0] });
    });
};

// Actualizar los datos del perfil del usuario
exports.actualizarPerfil = async (req, res) => {
    const { nombres, apellidos, cedula, telefono1, telefono2, password } = req.body;

    const id_usuario = req.usuarioId;
    if (!esNombreValido(nombres) || !esNombreValido(apellidos)) {
        return res.status(400).json({ success: false, message: 'Nombres y apellidos: solo letras, espacios, tildes, guiones o apóstrofes (2–80 caracteres)' });
    }
    if (!esCedulaValida(cedula)) {
        return res.status(400).json({ success: false, message: 'Cédula inválida. Utiliza V- o E- y de 7 a 9 dígitos' });
    }
    if (!esTelefonoValido(telefono1) ||
        (telefono2 != null && telefono2 !== '' && !esTelefonoValido(telefono2))) {
        return res.status(400).json({ success: false, message: 'Teléfono inválido. Usa un número completo con código de área o país' });
    }
    if (password !== undefined && password !== null && password !== '' && !esPasswordValida(password)) {
        return res.status(400).json({ success: false, message: 'La contraseña nueva debe contener entre 8 y 128 caracteres válidos' });
    }

    const nombreLimpio = nombres.trim();
    const apellidoLimpio = apellidos.trim();
    const cedulaLimpia = cedula.trim().toUpperCase();
    const tel1Limpio = normalizarTelefono(telefono1);
    const tel2Limpio = telefono2 ? normalizarTelefono(telefono2) : null;

    try {
        const hash = password ? await bcrypt.hash(password, 10) : null;
        await conIdentidades(async client => {
            // Lock the current row too: role/state changes must finish before we
            // read/write it. Never accept an ID or role from the request body.
            const { rows } = await client.query(
                'SELECT id_usuario FROM usuarios WHERE id_usuario = $1 FOR UPDATE', [id_usuario]);
            if (!rows.length) throw new ErrorIntegridad(404, 'Usuario no encontrado');
            await comprobarUsuario(client, { cedula: cedulaLimpia, excluirId: id_usuario });
            await client.query(`UPDATE usuarios SET nombres = $1, apellidos = $2,
                cedula = $3, telefono1 = $4, telefono2 = $5
                ${hash ? ', password_hash = $7' : ''} WHERE id_usuario = $6`,
            [nombreLimpio, apellidoLimpio, cedulaLimpia, tel1Limpio, tel2Limpio,
                id_usuario, ...(hash ? [hash] : [])]);
        });
        return res.json({ success: true, message: password
            ? 'Perfil y contraseña actualizados correctamente' : 'Perfil actualizado correctamente' });
    } catch (error) {
        return responderError(res, error);
    }
};
