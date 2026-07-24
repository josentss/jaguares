// ==========================================
// CONTROLADORES DE CMS (NODE.JS + EXPRESS)
// Club Jaguares - Gestión Web
// ==========================================

const db = require('../config/db');

// ==========================================
// UTILIDADES DE VALIDACIÓN
// ==========================================

const validarNoticiaData = (titulo, resumen, contenido) => {
    const errores = [];

    if (!titulo || titulo.trim().length === 0) {
        errores.push('El título es obligatorio');
    } else if (titulo.trim().length > 255) {
        errores.push('El título no puede exceder 255 caracteres');
    }

    if (!resumen || resumen.trim().length === 0) {
        errores.push('El resumen es obligatorio');
    } else if (resumen.trim().length > 500) {
        errores.push('El resumen no puede exceder 500 caracteres');
    }

    if (!contenido || contenido.trim().length === 0) {
        errores.push('El contenido es obligatorio');
    }

    return errores;
};

const validarEventoData = (titulo, fecha_evento, lugar) => {
    const errores = [];

    if (!titulo || titulo.trim().length === 0) {
        errores.push('El título del evento es obligatorio');
    } else if (titulo.trim().length > 255) {
        errores.push('El título no puede exceder 255 caracteres');
    }

    if (!fecha_evento) {
        errores.push('La fecha del evento es obligatoria');
    } else {
        const fecha = new Date(fecha_evento);
        if (isNaN(fecha.getTime())) {
            errores.push('La fecha del evento tiene un formato inválido');
        } else if (fecha < new Date()) {
            errores.push('La fecha del evento no puede ser en el pasado');
        }
    }

    if (!lugar || lugar.trim().length === 0) {
        errores.push('El lugar del evento es obligatorio');
    } else if (lugar.trim().length > 300) {
        errores.push('El lugar no puede exceder 300 caracteres');
    }

    return errores;
};

// ==========================================
// CONTROLADORES DE NOTICIAS (Público)
// ==========================================

/**
 * GET /api/cms/public/noticias
 * Obtiene las 3 noticias más recientes para la página principal
 */
const obtenerNoticiasPublicas = async (req, res) => {
    try {
        const [noticias] = await db.promise().query(
            `SELECT id_noticia, titulo, resumen, imagen_url, fecha_publicacion
             FROM noticias
             WHERE estado = 'publicada'
             ORDER BY fecha_publicacion DESC
             LIMIT 3`
        );

        res.status(200).json({
            success: true,
            cantidad: noticias.length,
            noticias: noticias
        });
    } catch (error) {
        console.error('Error al obtener noticias públicas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al obtener las noticias'
        });
    }
};

/**
 * GET /api/cms/public/noticias/:id
 * Obtiene una noticia específica por ID (para página de detalle)
 */
const obtenerNoticiaDetalle = async (req, res) => {
    try {
        const { id } = req.params;

        const [noticia] = await db.promise().query(
            `SELECT n.*, u.nombres, u.apellidos
             FROM noticias n
             LEFT JOIN usuarios u ON n.autor_id = u.id_usuario
             WHERE n.id_noticia = ? AND n.estado = 'publicada'`,
            [id]
        );

        if (noticia.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'La noticia no existe o no está publicada'
            });
        }

        res.status(200).json({
            success: true,
            noticia: noticia[0]
        });
    } catch (error) {
        console.error('Error al obtener detalle de noticia:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al obtener la noticia'
        });
    }
};

// ==========================================
// CONTROLADORES DE NOTICIAS (Admin)
// ==========================================

/**
 * POST /api/cms/admin/noticias
 * Crea una nueva noticia (solo directiva/admin)
 * Body: FormData con { titulo, resumen, contenido, imagen_noticia (file) }
 */
const crearNoticiaAdmin = async (req, res) => {
    try {
        const { titulo, resumen, contenido } = req.body;
        const usuario_id = req.usuarioId;

        // Validar datos
        const erroresValidacion = validarNoticiaData(titulo, resumen, contenido);
        if (erroresValidacion.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Datos inválidos',
                detalles: erroresValidacion
            });
        }

        // Validar que se subió la imagen
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'La imagen es obligatoria para publicar una noticia'
            });
        }

        const imagen_url = req.file.path; // URL de Cloudinary

        // Insertar en base de datos
        const [result] = await db.promise().query(
            `INSERT INTO noticias (titulo, resumen, contenido, imagen_url, autor_id, estado)
             VALUES (?, ?, ?, ?, ?, 'publicada')`,
            [titulo.trim(), resumen.trim(), contenido.trim(), imagen_url, usuario_id]
        );

        console.log(`✓ Noticia creada exitosamente (ID: ${result.insertId}) por usuario ${usuario_id}`);

        res.status(201).json({
            success: true,
            mensaje: 'Noticia publicada con éxito',
            id_noticia: result.insertId,
            imagen_url: imagen_url
        });
    } catch (error) {
        console.error('Error al registrar noticia:', error);
        res.status(500).json({
            success: false,
            error: 'Error al registrar la noticia. Intenta de nuevo.'
        });
    }
};

/**
 * GET /api/cms/admin/noticias
 * Obtiene todas las noticias (para panel de administración)
 */
const obtenerNoticiasAdmin = async (req, res) => {
    try {
        const [noticias] = await db.promise().query(
            `SELECT n.*, u.nombres, u.apellidos
             FROM noticias n
             LEFT JOIN usuarios u ON n.autor_id = u.id_usuario
             ORDER BY n.fecha_publicacion DESC`
        );

        res.status(200).json({
            success: true,
            cantidad: noticias.length,
            noticias: noticias
        });
    } catch (error) {
        console.error('Error al obtener noticias (admin):', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener las noticias'
        });
    }
};

/**
 * DELETE /api/cms/admin/noticias/:id
 * Elimina una noticia (la archiva)
 */
const eliminarNoticiaAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        // Cambiar estado a archivada en lugar de eliminar
        const [result] = await db.promise().query(
            `UPDATE noticias SET estado = 'archivada' WHERE id_noticia = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'La noticia no existe'
            });
        }

        console.log(`✓ Noticia archivada (ID: ${id})`);

        res.status(200).json({
            success: true,
            mensaje: 'Noticia archivada correctamente'
        });
    } catch (error) {
        console.error('Error al archivar noticia:', error);
        res.status(500).json({
            success: false,
            error: 'Error al archivar la noticia'
        });
    }
};

// ==========================================
// CONTROLADORES DE EVENTOS (Público)
// ==========================================

/**
 * GET /api/cms/public/eventos
 * Obtiene los próximos eventos ordenados por fecha
 */
const obtenerEventosPublicos = async (req, res) => {
    try {
        const [eventos] = await db.promise().query(
            `SELECT id_evento, titulo, fecha_evento, lugar, registrados, capacidad
             FROM eventos
             WHERE estado IN ('proximo', 'en_progreso')
             ORDER BY fecha_evento ASC
             LIMIT 5`
        );

        res.status(200).json({
            success: true,
            cantidad: eventos.length,
            eventos: eventos
        });
    } catch (error) {
        console.error('Error al obtener eventos públicos:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener el calendario de eventos'
        });
    }
};

// ==========================================
// CONTROLADORES DE EVENTOS (Admin)
// ==========================================

/**
 * POST /api/cms/admin/eventos
 * Crea un nuevo evento (solo directiva/admin)
 * Body: { titulo, fecha_evento, lugar, capacidad? }
 */
const crearEventoAdmin = async (req, res) => {
    try {
        const { titulo, fecha_evento, lugar, capacidad } = req.body;
        const usuario_id = req.usuarioId;

        // Validar datos
        const erroresValidacion = validarEventoData(titulo, fecha_evento, lugar);
        if (erroresValidacion.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Datos inválidos',
                detalles: erroresValidacion
            });
        }

        // Validar capacidad si se proporciona
        if (capacidad && (isNaN(capacidad) || capacidad < 1)) {
            return res.status(400).json({
                success: false,
                error: 'La capacidad debe ser un número mayor a 0'
            });
        }

        // Insertar en base de datos (sin organizador_id)
        const [result] = await db.promise().query(
            `INSERT INTO eventos (titulo, fecha_evento, lugar, capacidad, estado)
             VALUES (?, ?, ?, ?, 'proximo')`,
            [
                titulo.trim(),
                fecha_evento,
                lugar.trim(),
                capacidad || null
            ]
        );

        console.log(`✓ Evento creado exitosamente (ID: ${result.insertId}) por usuario ${usuario_id}`);

        res.status(201).json({
            success: true,
            mensaje: 'Evento agendado con éxito',
            id_evento: result.insertId
        });
    } catch (error) {
        console.error('Error al crear evento:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear el evento. Intenta de nuevo.'
        });
    }
};

/**
 * GET /api/cms/admin/eventos
 * Obtiene todos los eventos (para panel de administración)
 */
const obtenerEventosAdmin = async (req, res) => {
    try {
        const [eventos] = await db.promise().query(
            `SELECT * FROM eventos ORDER BY fecha_evento ASC`
        );

        res.status(200).json({
            success: true,
            cantidad: eventos.length,
            eventos: eventos
        });
    } catch (error) {
        console.error('Error al obtener eventos (admin):', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener los eventos'
        });
    }
};

/**
 * PUT /api/cms/admin/eventos/:id
 * Actualiza el estado de un evento
 */
const actualizarEventoAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        const estadosValidos = ['proximo', 'en_progreso', 'completado', 'cancelado'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({
                success: false,
                error: `Estado inválido. Debe ser uno de: ${estadosValidos.join(', ')}`
            });
        }

        const [result] = await db.promise().query(
            `UPDATE eventos SET estado = ? WHERE id_evento = ?`,
            [estado, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'El evento no existe'
            });
        }

        console.log(`✓ Evento actualizado (ID: ${id}) - Nuevo estado: ${estado}`);

        res.status(200).json({
            success: true,
            mensaje: 'Evento actualizado correctamente'
        });
    } catch (error) {
        console.error('Error al actualizar evento:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar el evento'
        });
    }
};

// ==========================================
// EXPORTAR CONTROLADORES
// ==========================================

module.exports = {
    // Noticias Públicas
    obtenerNoticiasPublicas,
    obtenerNoticiaDetalle,

    // Noticias Admin
    crearNoticiaAdmin,
    obtenerNoticiasAdmin,
    eliminarNoticiaAdmin,

    // Eventos Públicos
    obtenerEventosPublicos,

    // Eventos Admin
    crearEventoAdmin,
    obtenerEventosAdmin,
    actualizarEventoAdmin
};
