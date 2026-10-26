const db = require('../config/db');
const bcrypt = require('bcrypt');

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
    const cedulaLimpia = String(cedula || '').trim();
    const tel1Limpio = String(telefono1 || '').trim();

    if (!String(nombres || '').trim() || !String(apellidos || '').trim()) {
        return res.status(400).json({ success: false, message: 'Nombres y apellidos son obligatorios' });
    }
    if (!cedulaLimpia) {
        return res.status(400).json({ success: false, message: 'La cédula es obligatoria' });
    }
    if (!tel1Limpio) {
        return res.status(400).json({ success: false, message: 'El teléfono principal es obligatorio' });
    }

    try {
        // 1. Si el usuario desea cambiar la contraseña, la encriptamos
        if (password && password.trim() !== "") {
            const saltRounds = 10;
            const nuevoHash = await bcrypt.hash(password, saltRounds);

            const queryConPass = `
                UPDATE usuarios
                SET nombres = ?, apellidos = ?, cedula = ?, telefono1 = ?, telefono2 = ?, password_hash = ?
                WHERE id_usuario = ?
            `;

            db.query(queryConPass, [
                String(nombres || '').trim(),
                String(apellidos || '').trim(),
                cedulaLimpia,
                tel1Limpio,
                String(telefono2 || '').trim() || null,
                nuevoHash,
                id_usuario
            ], (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Error al actualizar el perfil con contraseña' });
                }
                return res.json({ success: true, message: 'Perfil y contraseña actualizados correctamente' });
            });

        } else {
            // 2. Si no envía contraseña, solo actualizamos los datos básicos
            const querySinPass = `
                UPDATE usuarios
                SET nombres = ?, apellidos = ?, cedula = ?, telefono1 = ?, telefono2 = ?
                WHERE id_usuario = ?
            `;

            db.query(querySinPass, [
                String(nombres || '').trim(),
                String(apellidos || '').trim(),
                cedulaLimpia,
                tel1Limpio,
                String(telefono2 || '').trim() || null,
                id_usuario
            ], (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Error al actualizar los datos del perfil' });
                }
                return res.json({ success: true, message: 'Perfil actualizado correctamente' });
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error en el proceso de actualización' });
    }
};
