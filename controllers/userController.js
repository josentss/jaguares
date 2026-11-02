const db = require('../config/db');
const bcrypt = require('bcrypt');
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
        // 1. Si el usuario desea cambiar la contraseña, la encriptamos
        if (password) {
            const saltRounds = 10;
            const nuevoHash = await bcrypt.hash(password, saltRounds);

            const queryConPass = `
                UPDATE usuarios
                SET nombres = ?, apellidos = ?, cedula = ?, telefono1 = ?, telefono2 = ?, password_hash = ?
                WHERE id_usuario = ?
                  AND NOT EXISTS (
                      SELECT 1 FROM usuarios otro
                      WHERE UPPER(TRIM(otro.cedula)) = ?
                        AND otro.id_usuario <> ?
                  )
            `;

            db.query(queryConPass, [
                nombreLimpio,
                apellidoLimpio,
                cedulaLimpia,
                tel1Limpio,
                tel2Limpio,
                nuevoHash,
                id_usuario,
                cedulaLimpia,
                id_usuario
            ], (err, resultado) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({ success: false, message: 'La cédula ya está registrada' });
                    }
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Error al actualizar el perfil con contraseña' });
                }
                if (!resultado || resultado.affectedRows !== 1) {
                    return res.status(409).json({ success: false, message: 'La cédula ya pertenece a otro usuario o la cuenta ya no existe' });
                }
                return res.json({ success: true, message: 'Perfil y contraseña actualizados correctamente' });
            });

        } else {
            // 2. Si no envía contraseña, solo actualizamos los datos básicos
            const querySinPass = `
                UPDATE usuarios
                SET nombres = ?, apellidos = ?, cedula = ?, telefono1 = ?, telefono2 = ?
                WHERE id_usuario = ?
                  AND NOT EXISTS (
                      SELECT 1 FROM usuarios otro
                      WHERE UPPER(TRIM(otro.cedula)) = ?
                        AND otro.id_usuario <> ?
                  )
            `;

            db.query(querySinPass, [
                nombreLimpio,
                apellidoLimpio,
                cedulaLimpia,
                tel1Limpio,
                tel2Limpio,
                id_usuario,
                cedulaLimpia,
                id_usuario
            ], (err, resultado) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({ success: false, message: 'La cédula ya está registrada' });
                    }
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Error al actualizar los datos del perfil' });
                }
                if (!resultado || resultado.affectedRows !== 1) {
                    return res.status(409).json({ success: false, message: 'La cédula ya pertenece a otro usuario o la cuenta ya no existe' });
                }
                return res.json({ success: true, message: 'Perfil actualizado correctamente' });
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error en el proceso de actualización' });
    }
};
