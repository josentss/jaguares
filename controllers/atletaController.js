const db = require('../config/db');

// Obtener los atletas asociados a un representante específico
exports.obtenerAtletasPorRepresentante = (req, res) => {
    const { id } = req.params;

    const esDirectiva = ['directiva', 'staff', 'admin'].includes(req.usuarioRol);
    const esDueño = String(req.usuarioId) === String(id);

    if (!esDueño && !esDirectiva) {
        return res.status(403).json({ success: false, message: 'No puedes ver los atletas de otro representante' });
    }

    const query = 'SELECT id_atleta, nombres, apellidos, cedula, estado FROM atletas WHERE id_representante = ?';

    db.query(query, [id], (err, results) => {
        if (err) {
            console.error("Error al obtener atletas:", err);
            return res.status(500).json({ success: false, message: 'Error interno del servidor al consultar atletas' });
        }
        res.json({ success: true, atletas: results });
    });
};

// Registrar un nuevo atleta en el sistema
exports.registrarAtleta = (req, res) => {
    // Recibimos los datos enviados desde el formulario del frontend
    const { nombres, apellidos, cedula, fecha_nac, direccion, telefono, allergies_medicas } = req.body;

    const id_representante = req.usuarioId;

    // Validación de campos obligatorios
    if (!id_representante || !nombres || !apellidos || !fecha_nac) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios para el registro' });
    }

    // CORRECCIÓN TOTAL: 'fecha_nacimiento' y 'alergias_medicas' exactamente como tu MySQL
    const query = `
        INSERT INTO atletas (id_representante, nombres, apellidos, cedula, fecha_nacimiento, direccion, telefono, alergias_medicas, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'espera')
    `;

    // Mapeamos los datos en el orden exacto de los signos de interrogación
    db.query(query, [id_representante, nombres, apellidos, cedula, fecha_nac, direccion, telefono, allergies_medicas], (err, result) => {
        if (err) {
            console.error("Error al insertar atleta:", err);
            return res.status(500).json({ success: false, message: 'Error al registrar al atleta en la base de datos' });
        }

        res.json({ success: true, message: 'Atleta registrado con éxito, en espera de aprobación.' });
    });
};
