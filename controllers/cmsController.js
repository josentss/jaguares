// Asegúrate de importar tu conexión a la base de datos TiDB
const db = require('../config/db');

// ==========================================
// CONTROLADORES DE NOTICIAS (Público y Admin)
// ==========================================

const obtenerNoticiasPublicas = async (req, res) => {
    try {
        // Obtenemos las 3 noticias más recientes para la página principal
        const [rows] = await db.query('SELECT * FROM noticias ORDER BY fecha_publicacion DESC LIMIT 3');
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error interno al obtener las noticias' });
    }
};

const crearNoticiaAdmin = async (req, res) => {
    try {
        const { titulo, resumen, contenido } = req.body;
        // Asumiendo que el middleware de Cloudinary guarda la URL en req.file.path (igual que los comprobantes)
        const imagen_url = req.file ? req.file.path : null;

        if (!imagen_url) return res.status(400).json({ error: 'La imagen es obligatoria' });

        const [result] = await db.query(
            'INSERT INTO noticias (titulo, resumen, contenido, imagen_url) VALUES (?, ?, ?, ?)',
            [titulo, resumen, contenido, imagen_url]
        );
        res.status(201).json({ mensaje: 'Noticia publicada con éxito', id_noticia: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'Error al registrar la noticia' });
    }
};

// ==========================================
// CONTROLADORES DE EVENTOS (Público y Admin)
// ==========================================

const obtenerEventosPublicos = async (req, res) => {
    try {
        // Obtenemos solo los eventos próximos ordenados por fecha
        const [rows] = await db.query('SELECT * FROM eventos WHERE estado = "Proximo" ORDER BY fecha_evento ASC LIMIT 5');
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el calendario' });
    }
};

const crearEventoAdmin = async (req, res) => {
    try {
        const { titulo, fecha_evento, lugar } = req.body;
        const [result] = await db.query(
            'INSERT INTO eventos (titulo, fecha_evento, lugar) VALUES (?, ?, ?)',
            [titulo, fecha_evento, lugar]
        );
        res.status(201).json({ mensaje: 'Evento agendado con éxito', id_evento: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear el evento' });
    }
};

module.exports = {
    obtenerNoticiasPublicas,
    crearNoticiaAdmin,
    obtenerEventosPublicos,
    crearEventoAdmin
};
