const db = require('../config/db');

// Lista las notificaciones del usuario. El :id de la URL es solo
// descriptivo del recurso; el control real es req.usuarioId/req.usuarioRol
// (verificados por el JWT), igual que en perfil y atletas.
exports.obtenerNotificaciones = (req, res) => {
    const { id } = req.params;
    const esDirectiva = ['directiva', 'staff', 'admin'].includes(req.usuarioRol);
    const esDueño = String(req.usuarioId) === String(id);

    if (!esDueño && !esDirectiva) {
        return res.status(403).json({ success: false, message: 'No puedes ver las notificaciones de otro usuario' });
    }

    const query = 'SELECT id_notificacion, mensaje, tipo, fecha FROM notificaciones WHERE id_usuario = ? ORDER BY fecha DESC LIMIT 50';

    db.query(query, [id], (err, resultados) => {
        if (err) {
            console.error('❌ Error al obtener notificaciones:', err.message);
            return res.status(500).json({ success: false, message: 'Error al obtener notificaciones' });
        }
        res.json({ success: true, notificaciones: resultados });
    });
};

exports.borrarNotificaciones = (req, res) => {
    const { id } = req.params;
    const esDirectiva = ['directiva', 'staff', 'admin'].includes(req.usuarioRol);
    const esDueño = String(req.usuarioId) === String(id);

    if (!esDueño && !esDirectiva) {
        return res.status(403).json({ success: false, message: 'No puedes borrar las notificaciones de otro usuario' });
    }

    db.query('DELETE FROM notificaciones WHERE id_usuario = ?', [id], (err) => {
        if (err) {
            console.error('❌ Error al borrar notificaciones:', err.message);
            return res.status(500).json({ success: false, message: 'Error al borrar notificaciones' });
        }
        res.json({ success: true, message: 'Notificaciones eliminadas' });
    });
};

// Helper interno (no es un endpoint HTTP) para que otros controladores,
// como directivaController.js, creen una notificación tras aprobar/rechazar
// un pago o un atleta. No bloquea la respuesta principal si falla.
exports.crearNotificacion = (id_usuario, mensaje, tipo = 'info') => {
    db.query(
        'INSERT INTO notificaciones (id_usuario, mensaje, tipo) VALUES (?, ?, ?)',
        [id_usuario, mensaje, tipo],
        (err) => {
            if (err) console.error('❌ Error al crear notificación:', err.message);
        }
    );
};