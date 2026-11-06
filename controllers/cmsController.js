// ==========================================
// CONTROLADORES DE CMS - VERSIÓN SIN AUTOR_ID
// Si tu tabla noticias NO tiene columna autor_id
// ==========================================

const db = require('../config/db');
const { esEnteroPositivo, esFechaISOValida, esHoraEventoValida, hoyCaracasISO, limitesFechaEvento } = require('../utils/validators');

// ==========================================
// UTILIDADES
// ==========================================

const logAccion = (accion, detalles = {}) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ✓ ${accion}`, detalles);
};

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

const validarEventoData = (titulo, fecha_evento, hora_evento, lugar) => {
    const errores = [];
    const limites = limitesFechaEvento();

    if (typeof titulo !== 'string' || titulo.trim().length === 0) {
        errores.push('El título del evento es obligatorio');
    } else if (titulo.trim().length > 255) {
        errores.push('El título no puede exceder 255 caracteres');
    }

    if (typeof fecha_evento !== 'string' || fecha_evento.length === 0) {
        errores.push('La fecha del evento es obligatoria');
    } else if (!esFechaISOValida(fecha_evento)) {
        errores.push('La fecha del evento tiene un formato inválido');
    } else if (fecha_evento < limites.min) {
        errores.push('La fecha del evento no puede ser en el pasado');
    } else if (fecha_evento > limites.max) {
        errores.push(`La fecha del evento no puede ser posterior al ${limites.max}`);
    }

    if (!esHoraEventoValida(hora_evento)) {
        errores.push('Selecciona una hora entre 05:00 y 22:00, en intervalos de 5 minutos (hora de Venezuela)');
    }

    if (typeof lugar !== 'string' || lugar.trim().length === 0) {
        errores.push('El lugar del evento es obligatorio');
    } else if (lugar.trim().length > 300) {
        errores.push('El lugar no puede exceder 300 caracteres');
    }

    return errores;
};

// ==========================================
// CONTROLADORES DE NOTICIAS (Público)
// ==========================================

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

const obtenerNoticiaDetalle = async (req, res) => {
    try {
        const { id } = req.params;

        const [noticia] = await db.promise().query(
            `SELECT id_noticia, titulo, resumen, contenido, imagen_url, fecha_publicacion
             FROM noticias
             WHERE id_noticia = ? AND estado = 'publicada'`,
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
 * Crea una nueva noticia SIN autor_id
 * Body: FormData con { titulo, resumen, contenido, imagen_noticia (file) }
 */
const crearNoticiaAdmin = async (req, res) => {
    try {
        const { titulo, resumen, contenido } = req.body;
        const usuario_id = req.usuarioId;  // Se usa solo para logs

        // Validar datos
        const erroresValidacion = validarNoticiaData(titulo, resumen, contenido);
        if (erroresValidacion.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Datos inválidos',
                detalles: erroresValidacion
            });
        }

        // Ya validamos archivo en middleware
        const imagen_url = req.file.path;

        // ==========================================
        // OPCIÓN 1: SIN autor_id (simple)
        // ==========================================
        const [result] = await db.promise().query(
            `INSERT INTO noticias (titulo, resumen, contenido, imagen_url, estado)
             VALUES (?, ?, ?, ?, 'publicada')`,
            [titulo.trim(), resumen.trim(), contenido.trim(), imagen_url]
        );

        logAccion('Noticia creada', {
            id: result.insertId,
            creador: usuario_id,
            titulo: titulo.substring(0, 50)
        });

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

// ==========================================
// ALTERNATIVA: CON autor_id (comentada)
// ==========================================
// Descomenta esto si ya agregaste la columna autor_id a tu tabla
/*
const crearNoticiaAdmin = async (req, res) => {
    try {
        const { titulo, resumen, contenido } = req.body;
        const usuario_id = req.usuarioId;

        const erroresValidacion = validarNoticiaData(titulo, resumen, contenido);
        if (erroresValidacion.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Datos inválidos',
                detalles: erroresValidacion
            });
        }

        const imagen_url = req.file.path;

        // CON autor_id
        const [result] = await db.promise().query(
            `INSERT INTO noticias (titulo, resumen, contenido, imagen_url, autor_id, estado)
             VALUES (?, ?, ?, ?, ?, 'publicada')`,
            [titulo.trim(), resumen.trim(), contenido.trim(), imagen_url, usuario_id]
        );

        logAccion('Noticia creada', {
            id: result.insertId,
            autor: usuario_id,
            titulo: titulo.substring(0, 50)
        });

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
*/

const obtenerNoticiasAdmin = async (req, res) => {
    try {
        // SIN autor_id - versión simple
        const [noticias] = await db.promise().query(
            `SELECT id_noticia, titulo, resumen, contenido, imagen_url,
                    estado, fecha_publicacion
             FROM noticias
             ORDER BY fecha_publicacion DESC`
        );

        res.status(200).json({
            success: true,
            cantidad: noticias.length,
            noticias: noticias
        });

        // CON autor_id - descomenta si tienes la columna
        /*
        const [noticias] = await db.promise().query(
            `SELECT n.*, u.nombres, u.apellidos
             FROM noticias n
             LEFT JOIN usuarios u ON n.autor_id = u.id_usuario
             ORDER BY n.fecha_publicacion DESC`
        );
        */
    } catch (error) {
        console.error('Error al obtener noticias (admin):', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener las noticias'
        });
    }
};

const eliminarNoticiaAdmin = async (req, res) => {
    try {
        const { id } = req.params;

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

        logAccion('Noticia archivada', { id });

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

// fecha_evento es TIMESTAMPTZ en Supabase, pero representa un día civil.
// Los históricos están a las 00:00 UTC: usar ese día conserva lo mostrado
// y evita que la zona de la conexión mueva el calendario. hora_evento es aparte.

const obtenerEventosPublicos = async (req, res) => {
    try {
        const hoy = hoyCaracasISO();
        const [eventos] = await db.promise().query(
            `SELECT id_evento, titulo,
                    to_char(fecha_evento AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS fecha_evento,
                    to_char(hora_evento, 'HH24:MI') AS hora_evento, lugar, estado
             FROM eventos
             WHERE COALESCE(estado, 'proximo') IN ('proximo', 'en_progreso')
               AND fecha_evento >= (?::date::timestamp AT TIME ZONE 'UTC')
             ORDER BY fecha_evento ASC, hora_evento ASC NULLS LAST`,
            [hoy]
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

const crearEventoAdmin = async (req, res) => {
    try {
        const { titulo, fecha_evento, hora_evento, lugar } = req.body || {};
        const usuario_id = req.usuarioId;

        const erroresValidacion = validarEventoData(titulo, fecha_evento, hora_evento, lugar);
        if (erroresValidacion.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Datos inválidos',
                detalles: erroresValidacion
            });
        }

        const [result] = await db.promise().query(
            `INSERT INTO eventos (titulo, fecha_evento, hora_evento, lugar, estado)
             VALUES (?, (?::date::timestamp AT TIME ZONE 'UTC'), ?, ?, 'proximo')`,
            [titulo.trim(), fecha_evento, hora_evento, lugar.trim()]
        );

        logAccion('Evento creado', {
            id: result.insertId,
            usuario: usuario_id,
            titulo: titulo.substring(0, 50)
        });

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

const obtenerEventosAdmin = async (req, res) => {
    try {
        // Estado efectivo calculado al leer: la última fecha civil ya pasó.
        // No muta históricos ni depende de cron (Vercel es serverless).
        // Se conserva el evento visible durante todo su día de celebración.
        const [eventos] = await db.promise().query(
            `SELECT id_evento, titulo,
                    to_char(fecha_evento AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS fecha_evento,
                    to_char(hora_evento, 'HH24:MI') AS hora_evento,
                    lugar,
                    CASE WHEN COALESCE(estado, 'proximo') IN ('proximo', 'en_progreso')
                          AND fecha_evento < (?::date::timestamp AT TIME ZONE 'UTC')
                         THEN 'completado' ELSE COALESCE(estado, 'proximo') END AS estado
             FROM eventos ORDER BY fecha_evento DESC, hora_evento ASC NULLS LAST`,
            [hoyCaracasISO()]
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

const actualizarEventoAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body || {};

        if (!esEnteroPositivo(id)) {
            return res.status(400).json({
                success: false,
                error: 'El identificador del evento es inválido'
            });
        }

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

        logAccion('Evento actualizado', { id, nuevoEstado: estado });

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

// Solo la directiva o administración puede eliminar definitivamente un evento.
// La ruta contiene la autorización; el controlador valida el ID y comprueba existencia.
const eliminarEventoAdmin = async (req, res) => {
    const { id } = req.params;
    if (!esEnteroPositivo(id)) {
        return res.status(400).json({ success: false, error: 'El identificador del evento es inválido' });
    }
    try {
        const [result] = await db.promise().query('DELETE FROM eventos WHERE id_evento = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'El evento no existe' });
        }
        logAccion('Evento eliminado definitivamente', { id: Number(id), usuario: req.usuarioId });
        return res.status(200).json({ success: true, mensaje: 'Evento eliminado del calendario' });
    } catch (error) {
        console.error('Error al eliminar evento:', error.code || 'INTERNAL');
        return res.status(500).json({ success: false, error: 'No se pudo eliminar el evento' });
    }
};

// ==========================================
// EXPORTAR CONTROLADORES
// ==========================================

module.exports = {
    obtenerNoticiasPublicas,
    obtenerNoticiaDetalle,
    crearNoticiaAdmin,
    obtenerNoticiasAdmin,
    eliminarNoticiaAdmin,
    obtenerEventosPublicos,
    crearEventoAdmin,
    obtenerEventosAdmin,
    actualizarEventoAdmin,
    eliminarEventoAdmin
};
