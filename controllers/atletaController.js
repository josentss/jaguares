const db = require('../config/db');
const bcrypt = require('bcrypt');
const { inscribir } = require('../utils/inscripcion');
const { responderError } = require('../utils/integridad');
const { normalizarTexto, esEnteroPositivo, esEmailValido, esPasswordValida, esNombreValido, esCedulaValida, esTelefonoValido, normalizarTelefono, esEdadAtletaValida, esDireccionValida, esCondicionMedicaValida, esIndicadorFormularioValido } = require('../utils/validators');
const { crearNotificacion } = require('./notificacionesController');
const { enlaceAutorizado } = require('../utils/cloudinaryPrivado');

function urlDeArchivo(file) {
    if (!file) return null;
    return file.path || file.secure_url || null;
}

function validarCuerpo(req, res) {
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return true;
    res.status(400).json({ success: false, message: 'Envía los datos del formulario de inscripción' });
    return false;
}

exports.obtenerAtletasPorRepresentante = (req, res) => {
    const { id } = req.params;
    if (!esEnteroPositivo(id)) {
        return res.status(400).json({ success: false, message: 'Identificador de representante no válido' });
    }
    const esDirectiva = ['directiva', 'staff', 'admin'].includes(req.usuarioRol);
    const esDueño = String(req.usuarioId) === String(id);

    if (!esDueño && !esDirectiva) {
        return res.status(403).json({
            success: false,
            message: 'No puedes ver los atletas de otro representante'
        });
    }

    const query = `
        SELECT id_atleta, nombres, apellidos, cedula, cedula_heredada, estado,
               foto_url, fecha_nacimiento
        FROM atletas
        WHERE id_representante = ?
        ORDER BY id_atleta DESC
    `;

    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener atletas:', err.code, err.message);
            return res.status(500).json({ success: false, message: 'Error al consultar atletas' });
        }
        res.json({ success: true, atletas: results.map(a => ({
            ...a,
            foto_url: a.foto_url ? `/api/atletas/${a.id_atleta}/documentos/foto` : null
        })) });
    });
};

async function registrarAtletaBase(req, res, { id_representante, estado, mensaje, representanteNuevo }) {
    if (!validarCuerpo(req, res)) return;
    const nombres   = normalizarTexto(req.body.nombres, 80);
    const apellidos = normalizarTexto(req.body.apellidos, 80);
    const fecha_nac = typeof req.body.fecha_nac === 'string' ? req.body.fecha_nac.trim() : '';
    const direccion = normalizarTexto(req.body.direccion, 255);
    const telefono  = req.body.telefono ? normalizarTelefono(req.body.telefono) : '';
    const notaMedica = req.body.allergies_medicas ?? req.body.alergias_medicas ?? '';
    const alergias = normalizarTexto(notaMedica, 500);

    if (!esIndicadorFormularioValido(req.body.hereda_cedula)) {
        return res.status(400).json({ success: false, message: 'Selecciona si el atleta tiene cédula propia o heredada' });
    }
    // Ambos nombres son compatibles; nunca validar uno y persistir el otro.
    if (req.body.allergies_medicas != null && req.body.alergias_medicas != null &&
        (typeof req.body.allergies_medicas !== 'string' || typeof req.body.alergias_medicas !== 'string' ||
         req.body.allergies_medicas.trim() !== req.body.alergias_medicas.trim())) {
        return res.status(400).json({ success: false, message: 'Envía una sola observación médica, sin valores contradictorios' });
    }

    const heredaCedula = ['1', 'true', true, 'on'].includes(req.body.hereda_cedula);

    if (!esNombreValido(req.body.nombres) || !esNombreValido(req.body.apellidos)) {
        return res.status(400).json({ success: false, message: 'Nombres y apellidos inválidos: usa letras y separadores habituales (2–80 caracteres)' });
    }
    if (!esDireccionValida(req.body.direccion)) {
        return res.status(400).json({ success: false, message: 'Dirección incompleta: incluye calle, sector o referencia; no se admite solo números' });
    }
    if (!esCondicionMedicaValida(notaMedica)) {
        return res.status(400).json({ success: false, message: 'Condiciones médicas inválidas: describe la condición con palabras; puedes incluir números clínicos' });
    }
    if (req.body.telefono != null && req.body.telefono !== '' && !esTelefonoValido(req.body.telefono)) {
        return res.status(400).json({ success: false, message: 'Teléfono de contacto inválido' });
    }
    if (!heredaCedula && !esCedulaValida(req.body.cedula)) {
        return res.status(400).json({ success: false, message: 'Cédula incompleta o incorrecta: utiliza V- o E- seguido de 7 a 9 dígitos' });
    }

    if ((!id_representante && !representanteNuevo) || !nombres || !apellidos || !fecha_nac || !direccion) {
        return res.status(400).json({
            success: false,
            message: 'Faltan campos obligatorios (nombres, apellidos, fecha de nacimiento, dirección)'
        });
    }

    if (!esEdadAtletaValida(fecha_nac)) {
        return res.status(400).json({
            success: false,
            message: 'Fecha de nacimiento fuera del rango: el atleta debe tener entre 5 y 18 años cumplidos'
        });
    }

    const files = req.files || {};
    const fotoUrl    = urlDeArchivo(files.foto?.[0]);
    const cedulaUrl  = urlDeArchivo(files.cedula_archivo?.[0]);
    const partidaUrl = urlDeArchivo(files.partida_nacimiento?.[0]);

    try {
        const resultado = await inscribir({ idRepresentante: id_representante,
            representanteNuevo, estado, atleta: {
                nombres, apellidos, fecha: fecha_nac, direccion, telefono, alergias,
                cedula: heredaCedula ? null : req.body.cedula.trim().toUpperCase(),
                heredada: heredaCedula, foto: fotoUrl, documento: cedulaUrl, partida: partidaUrl
            } });
        if (estado === 'activo') {
            // Best effort, only after commit. A notification cannot undo an enrollment.
            try {
                crearNotificacion(resultado.idRepresentante,
                    `La directiva registró a ${nombres} ${apellidos} y ya está activo en el club.`, 'success');
                if (req.logAdmin) req.logAdmin({ action: 'registrarAtletaDirectiva',
                    id_atleta: resultado.idAtleta, id_representante: resultado.idRepresentante });
            } catch (error) { console.error('Error de notificación posterior al alta'); }
        }
        return res.json({ success: true, message: mensaje,
            id_atleta: resultado.idAtleta, cedula: resultado.cedula,
            cedula_heredada: heredaCedula,
            documentos: { foto: !!fotoUrl, cedula_archivo: !!cedulaUrl, partida_nacimiento: !!partidaUrl },
            ...(representanteNuevo ? { representante: {
                id_usuario: resultado.idRepresentante, correo: representanteNuevo.correo
            } } : {})
        });
    } catch (error) {
        return responderError(res, error);
    }
}

exports.registrarAtleta = (req, res) => registrarAtletaBase(req, res, {
    id_representante: req.usuarioId, estado: 'espera',
    mensaje: 'Atleta registrado con éxito, en espera de aprobación.'
});

exports.registrarAtletaDirectiva = async (req, res) => {
    if (!validarCuerpo(req, res)) return;
    let representanteNuevo;
    if (!esIndicadorFormularioValido(req.body.representante_nuevo)) {
        return res.status(400).json({ success: false, message: 'Selecciona un representante existente o nuevo' });
    }
    if (['1', 'true', true, 'on'].includes(req.body.representante_nuevo)) {
        if (!esNombreValido(req.body.rep_nombres) || !esNombreValido(req.body.rep_apellidos) ||
            !esCedulaValida(req.body.rep_cedula) || !esTelefonoValido(req.body.rep_telefono) ||
            !esEmailValido(req.body.rep_correo) || req.body.rep_correo.length > 120 ||
            !esPasswordValida(req.body.rep_password)) {
            return res.status(400).json({ success: false, message: 'Datos del representante inválidos: verifica nombres, cédula, teléfono, correo y contraseña' });
        }
        try {
            representanteNuevo = {
                nombres: req.body.rep_nombres.trim(), apellidos: req.body.rep_apellidos.trim(),
                correo: req.body.rep_correo.trim().toLowerCase(),
                cedula: req.body.rep_cedula.trim().toUpperCase(),
                telefono: normalizarTelefono(req.body.rep_telefono),
                hash: await bcrypt.hash(req.body.rep_password, 10)
            };
        } catch (error) { return responderError(res, error); }
    } else if (!esEnteroPositivo(req.body.id_representante)) {
        return res.status(400).json({ success: false, message: 'Selecciona un representante' });
    }
    return registrarAtletaBase(req, res, {
        id_representante: representanteNuevo ? null : req.body.id_representante,
        representanteNuevo, estado: 'activo', mensaje: 'Atleta registrado y activado con éxito.'
    });
};

// ── Ficha completa (planilla) ──────────────────────────────────────────────
exports.obtenerAtletaPorId = (req, res) => {
    const { id } = req.params;
    if (!esEnteroPositivo(id)) {
        return res.status(400).json({ success: false, message: 'ID de atleta no válido' });
    }

    const query = `
        SELECT
            a.id_atleta,
            a.id_representante,
            a.nombres,
            a.apellidos,
            a.cedula,
            a.cedula_heredada,
            a.fecha_nacimiento,
            a.direccion,
            a.telefono,
            a.alergias_medicas,
            a.foto_url,
            a.cedula_archivo_url,
            a.partida_nacimiento_url,
            a.estado,
            u.nombres   AS rep_nombres,
            u.apellidos AS rep_apellidos,
            u.correo    AS rep_correo,
            u.telefono1 AS rep_telefono1,
            u.telefono2 AS rep_telefono2,
            u.cedula    AS rep_cedula
        FROM atletas a
        LEFT JOIN usuarios u ON a.id_representante = u.id_usuario
        WHERE a.id_atleta = ?
        LIMIT 1
    `;

    db.query(query, [Number(id)], (err, rows) => {
        if (err) {
            console.error('Error al obtener planilla:', err.code, err.message);
            return res.status(500).json({ success: false, message: 'Error al consultar el atleta' });
        }

        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Atleta no encontrado' });
        }

        const a = rows[0];
        const esDirectiva = ['directiva', 'staff', 'admin'].includes(req.usuarioRol);
        const esDueño = String(req.usuarioId) === String(a.id_representante);

        if (!esDirectiva && !esDueño) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para ver esta planilla'
            });
        }

        res.json({
            success: true,
            atleta: {
                id_atleta: a.id_atleta,
                nombres: a.nombres,
                apellidos: a.apellidos,
                cedula: a.cedula,
                cedula_heredada: !!a.cedula_heredada,
                fecha_nacimiento: a.fecha_nacimiento,
                direccion: a.direccion,
                telefono: a.telefono,
                alergias_medicas: a.alergias_medicas,
                estado: a.estado,
                documentos: {
                    foto_url: a.foto_url ? `/api/atletas/${a.id_atleta}/documentos/foto` : null,
                    cedula_archivo_url: a.cedula_archivo_url ? `/api/atletas/${a.id_atleta}/documentos/cedula_archivo` : null,
                    partida_nacimiento_url: a.partida_nacimiento_url ? `/api/atletas/${a.id_atleta}/documentos/partida_nacimiento` : null
                },
                representante: {
                    id_representante: a.id_representante,
                    nombres: a.rep_nombres,
                    apellidos: a.rep_apellidos,
                    correo: a.rep_correo,
                    telefono1: a.rep_telefono1,
                    telefono2: a.rep_telefono2,
                    cedula: a.rep_cedula
                }
            }
        });
    });
};

// Entrega de documentos del atleta: sin IDs arbitrarios de Cloudinary,
// siempre a partir del propietario obtenido directamente desde PostgreSQL.
const COLUMNAS_DOCUMENTO = Object.freeze({
    foto: 'foto_url',
    cedula_archivo: 'cedula_archivo_url',
    partida_nacimiento: 'partida_nacimiento_url'
});

exports.abrirDocumentoAtleta = (req, res) => {
    const { id, tipo } = req.params;
    const columna = COLUMNAS_DOCUMENTO[tipo];
    if (!esEnteroPositivo(id) || !columna) {
        return res.status(400).json({ success: false, message: 'Documento no válido' });
    }

    db.query(`SELECT id_representante, ${columna} AS archivo FROM atletas WHERE id_atleta = ?`,
        [Number(id)], (error, rows) => {
        if (error) {
            console.error('Error al consultar documento de atleta:', error.code || 'INTERNAL');
            return res.status(500).json({ success: false, message: 'No se pudo consultar el archivo' });
        }
        const atleta = rows?.[0];
        if (!atleta) return res.status(404).json({ success: false, message: 'Atleta no encontrado' });
        const autorizado = ['directiva', 'staff', 'admin'].includes(req.usuarioRol) ||
            String(req.usuarioId) === String(atleta.id_representante);
        if (!autorizado) return res.status(403).json({ success: false, message: 'No autorizado' });
        if (!atleta.archivo) return res.status(404).json({ success: false, message: 'Documento no adjunto' });

        try {
            const enlace = enlaceAutorizado(atleta.archivo, 'jaguares/atletas');
            res.set('Referrer-Policy', 'no-referrer');
            res.set('Cache-Control', 'no-store');
            return res.redirect(302, enlace);
        } catch {
            return res.status(503).json({ success: false, message: 'El documento no está disponible' });
        }
    });
};
