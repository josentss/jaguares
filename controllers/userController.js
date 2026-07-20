const db = require('../config/db');
const bcrypt = require('bcrypt');

// Obtener los datos del perfil de un usuario
exports.obtenerPerfil = (req, res) => {
    const { id } = req.params;

    // req.usuarioId / req.usuarioRol vienen del JWT verificado, no del cliente.
    // Sin esto, cualquier usuario logueado podía ver el perfil de cualquier
    // otro con solo cambiar el :id de la URL.
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

    // CRÍTICO: id_usuario ya NO se toma del body. Antes, cualquier usuario
    // logueado podía mandar el id_usuario de otra persona junto con una
    // password nueva y tomar el control de esa cuenta. Ahora solo se puede
    // editar (y solo puede cambiar su propia contraseña) el dueño de la sesión.
    const id_usuario = req.usuarioId;

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
            
            db.query(queryConPass, [nombres, apellidos, cedula, telefono1, telefono2, nuevoHash, id_usuario], (err) => {
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
            
            db.query(querySinPass, [nombres, apellidos, cedula, telefono1, telefono2, id_usuario], (err) => {
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