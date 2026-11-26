const db = require('../config/db');
const bcrypt = require('bcrypt');
const { inscribir, generarCedulaHeredada, nombreCompletoNormalizado } = require('../utils/inscripcion');
const { createHash } = require('node:crypto');
const { responderError, conIdentidades, ErrorIntegridad } = require('../utils/integridad');
const { normalizarTexto, esEnteroPositivo, esEmailValido, esPasswordValida, esNombreValido, esCedulaValida, esTelefonoValido, normalizarTelefono, esEdadAtletaValida, esFechaISOValida, esDireccionValida, esCondicionMedicaValida, esIndicadorFormularioValido } = require('../utils/validators');
const { crearNotificacion } = require('./notificacionesController');
const { enlaceAutorizado } = require('../utils/cloudinaryPrivado');
const { clasificar } = require('../public/admin/categorias-formativas');
const { compensarCargas, confirmarCargas, avisarEstadoIncierto } = require('../utils/compensacionCloudinary');

async function rechazarInscripcion(req, res, status, message) {
    await compensarCargas(req, 'validacion_inscripcion');
    return res.status(status).json({ success: false, message });
}

function urlDeArchivo(file) {
    if (!file) return null;
    return file.path || file.secure_url || null;
}

function validarCuerpo(req) {
    return !!(req.body && typeof req.body === 'object' && !Array.isArray(req.body));
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
            clasificacion: clasificar(a.fecha_nacimiento),
            foto_url: a.foto_url ? `/api/atletas/${a.id_atleta}/documentos/foto` : null
        })) });
    });
};

async function registrarAtletaBase(req, res, { id_representante, estado, mensaje, representanteNuevo }) {
    if (!validarCuerpo(req)) {
        return rechazarInscripcion(req, res, 400, 'Envía los datos del formulario de inscripción');
    }
    const nombres   = normalizarTexto(req.body.nombres, 80);
    const apellidos = normalizarTexto(req.body.apellidos, 80);
    const fecha_nac = typeof req.body.fecha_nac === 'string' ? req.body.fecha_nac.trim() : '';
    const direccion = normalizarTexto(req.body.direccion, 255);
    const telefono  = req.body.telefono ? normalizarTelefono(req.body.telefono) : '';
    const notaMedica = req.body.allergies_medicas ?? req.body.alergias_medicas ?? '';
    const alergias = normalizarTexto(notaMedica, 500);

    if (!esIndicadorFormularioValido(req.body.hereda_cedula)) {
        return rechazarInscripcion(req, res, 400, 'Selecciona si el atleta tiene cédula propia o heredada');
    }
    // Ambos nombres son compatibles; nunca validar uno y persistir el otro.
    if (req.body.allergies_medicas != null && req.body.alergias_medicas != null &&
        (typeof req.body.allergies_medicas !== 'string' || typeof req.body.alergias_medicas !== 'string' ||
         req.body.allergies_medicas.trim() !== req.body.alergias_medicas.trim())) {
        return rechazarInscripcion(req, res, 400, 'Envía una sola observación médica, sin valores contradictorios');
    }

    const heredaCedula = ['1', 'true', true, 'on'].includes(req.body.hereda_cedula);

    if (!esNombreValido(req.body.nombres) || !esNombreValido(req.body.apellidos)) {
        return rechazarInscripcion(req, res, 400, 'Nombres y apellidos inválidos: usa letras y separadores habituales (2–80 caracteres)');
    }
    if (!esDireccionValida(req.body.direccion)) {
        return rechazarInscripcion(req, res, 400, 'Dirección incompleta: incluye calle, sector o referencia; no se admite solo números');
    }
    if (!esCondicionMedicaValida(notaMedica)) {
        return rechazarInscripcion(req, res, 400, 'Condiciones médicas inválidas: describe la condición con palabras; puedes incluir números clínicos');
    }
    if (req.body.telefono != null && req.body.telefono !== '' && !esTelefonoValido(req.body.telefono)) {
        return rechazarInscripcion(req, res, 400, 'Teléfono de contacto inválido');
    }
    if (!heredaCedula && !esCedulaValida(req.body.cedula)) {
        return rechazarInscripcion(req, res, 400, 'Cédula incompleta o incorrecta: utiliza V- o E- seguido de 7 a 9 dígitos');
    }

    if ((!id_representante && !representanteNuevo) || !nombres || !apellidos || !fecha_nac || !direccion) {
        return rechazarInscripcion(req, res, 400, 'Faltan campos obligatorios (nombres, apellidos, fecha de nacimiento, dirección)');
    }

    if (!esEdadAtletaValida(fecha_nac)) {
        return rechazarInscripcion(req, res, 400, 'Fecha de nacimiento fuera del rango: el atleta debe tener entre 5 y 18 años cumplidos');
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
        // Solo el COMMIT exitoso marca las cargas como persistidas.
        confirmarCargas(req);
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
            clasificacion: clasificar(fecha_nac),
            cedula_heredada: heredaCedula,
            documentos: { foto: !!fotoUrl, cedula_archivo: !!cedulaUrl, partida_nacimiento: !!partidaUrl },
            ...(representanteNuevo ? { representante: {
                id_usuario: resultado.idRepresentante, correo: representanteNuevo.correo
            } } : {})
        });
    } catch (error) {
        if (error.compensacionConfirmada === true) {
            await compensarCargas(req, 'rollback_confirmado_inscripcion');
        } else {
            avisarEstadoIncierto(req, 'inscripcion_sql');
        }
        return responderError(res, error);
    }
}

exports.registrarAtleta = (req, res) => registrarAtletaBase(req, res, {
    id_representante: req.usuarioId, estado: 'espera',
    mensaje: 'Atleta registrado con éxito, en espera de aprobación.'
});

exports.registrarAtletaDirectiva = async (req, res) => {
    if (!validarCuerpo(req)) {
        return rechazarInscripcion(req, res, 400, 'Envía los datos del formulario de inscripción');
    }
    let representanteNuevo;
    if (!esIndicadorFormularioValido(req.body.representante_nuevo)) {
        return rechazarInscripcion(req, res, 400, 'Selecciona un representante existente o nuevo');
    }
    if (['1', 'true', true, 'on'].includes(req.body.representante_nuevo)) {
        if (!esNombreValido(req.body.rep_nombres) || !esNombreValido(req.body.rep_apellidos) ||
            !esCedulaValida(req.body.rep_cedula) || !esTelefonoValido(req.body.rep_telefono) ||
            !esEmailValido(req.body.rep_correo) || req.body.rep_correo.length > 120 ||
            !esPasswordValida(req.body.rep_password)) {
            return rechazarInscripcion(req, res, 400, 'Datos del representante inválidos: verifica nombres, cédula, teléfono, correo y contraseña');
        }
        try {
            representanteNuevo = {
                nombres: req.body.rep_nombres.trim(), apellidos: req.body.rep_apellidos.trim(),
                correo: req.body.rep_correo.trim().toLowerCase(),
                cedula: req.body.rep_cedula.trim().toUpperCase(),
                telefono: normalizarTelefono(req.body.rep_telefono),
                hash: await bcrypt.hash(req.body.rep_password, 10)
            };
        } catch (error) {
            await compensarCargas(req, 'error_hash_representante');
            return responderError(res, error);
        }
    } else if (!esEnteroPositivo(req.body.id_representante)) {
        return rechazarInscripcion(req, res, 400, 'Selecciona un representante');
    }
    return registrarAtletaBase(req, res, {
        id_representante: representanteNuevo ? null : req.body.id_representante,
        representanteNuevo, estado: 'activo', mensaje: 'Atleta registrado y activado con éxito.'
    });
};

// Solo los datos de la ficha participan en la versión. No se exponen URLs ni
// se sobrescriben estado, propietario, documentos, pagos o asignaciones.
function versionFicha(a) {
    return createHash('sha256').update(JSON.stringify([
        String(a.id_atleta), String(a.id_representante), a.nombres, a.apellidos,
        a.cedula, Boolean(a.cedula_heredada), a.fecha_nacimiento,
        a.direccion, a.telefono, a.alergias_medicas
    ])).digest('hex');
}

const ROLES_EDICION = new Set(['representante','directiva','staff','admin']);
exports.editarFicha = async (req, res) => {
    const id = req.params.id;
    if (!esEnteroPositivo(id)) return res.status(400).json({success:false,message:'ID de atleta no válido'});
    if (!ROLES_EDICION.has(req.usuarioRol)) return res.status(403).json({success:false,message:'No autorizado'});
    const d = req.body;
    const campos = new Set(['version','nombres','apellidos','cedula','hereda_cedula',
        'fecha_nac','direccion','telefono','alergias_medicas']);
    if (!validarCuerpo(req) || Object.keys(d).some(k=>!campos.has(k)) ||
        typeof d.version !== 'string' || !/^[a-f0-9]{64}$/.test(d.version) ||
        typeof d.hereda_cedula !== 'boolean' ||
        !esNombreValido(d.nombres) || !esNombreValido(d.apellidos) ||
        !esFechaISOValida(d.fecha_nac) || !esDireccionValida(d.direccion) ||
        !esCondicionMedicaValida(d.alergias_medicas) ||
        typeof d.telefono !== 'string' || (d.telefono !== '' && !esTelefonoValido(d.telefono)) ||
        (d.hereda_cedula ? d.cedula !== null : !esCedulaValida(d.cedula))) {
        return res.status(400).json({success:false,message:'Revisa los datos de la ficha. No se permiten campos adicionales.'});
    }
    try {
        const resultado = await conIdentidades(async client => {
            const {rows} = await client.query(`SELECT id_atleta,id_representante,nombres,apellidos,cedula,
                cedula_heredada,fecha_nacimiento,direccion,telefono,alergias_medicas,estado
                FROM atletas WHERE id_atleta=$1 FOR UPDATE`,[Number(id)]);
            const anterior=rows[0];
            if (!anterior) throw new ErrorIntegridad(404,'Atleta no encontrado');
            if (req.usuarioRol==='representante' && String(req.usuarioId)!==String(anterior.id_representante))
                throw new ErrorIntegridad(403,'No tienes permiso para editar esta ficha');
            if (versionFicha(anterior)!==d.version)
                throw new ErrorIntegridad(409,'La ficha cambió. Vuelve a abrirla antes de guardar.');
            // Un atleta que ha cumplido 19 años puede corregir otros datos sin
            // alterar su fecha histórica; una fecha nueva debe cumplir la regla.
            if (d.fecha_nac!==anterior.fecha_nacimiento && !esEdadAtletaValida(d.fecha_nac))
                throw new ErrorIntegridad(400,'La fecha corregida debe corresponder a un atleta de 5 a 18 años.');
            const nombres=d.nombres.trim(), apellidos=d.apellidos.trim();
            const candidatos=await client.query(`SELECT nombres,apellidos FROM atletas
                WHERE id_representante=$1 AND fecha_nacimiento=$2::date AND id_atleta<>$3`,
                [anterior.id_representante,d.fecha_nac,Number(id)]);
            if (candidatos.rows.some(x=>nombreCompletoNormalizado(x)===nombreCompletoNormalizado({nombres,apellidos})))
                throw new ErrorIntegridad(409,'Este atleta ya está registrado con el representante');
            let cedula=d.hereda_cedula ? anterior.cedula : d.cedula.trim().toUpperCase();
            if (d.hereda_cedula && !anterior.cedula_heredada) {
                const representante=await client.query('SELECT cedula FROM usuarios WHERE id_usuario=$1 FOR UPDATE',[anterior.id_representante]);
                cedula=await generarCedulaHeredada(client,representante.rows[0]?.cedula);
            }
            const duplicada=await client.query('SELECT id_atleta FROM atletas WHERE UPPER(TRIM(cedula))=$1 AND id_atleta<>$2 LIMIT 1',
                [String(cedula).trim().toUpperCase(),Number(id)]);
            if(duplicada.rowCount) throw new ErrorIntegridad(409,'Ya existe un atleta con esa cédula');
            await client.query(`UPDATE atletas SET nombres=$1,apellidos=$2,cedula=$3,cedula_heredada=$4,
                fecha_nacimiento=$5,direccion=$6,telefono=$7,alergias_medicas=$8 WHERE id_atleta=$9`,
                [nombres,apellidos,cedula,d.hereda_cedula?1:0,d.fecha_nac,d.direccion.trim(),
                normalizarTelefono(d.telefono)||null,d.alergias_medicas.trim()||null,Number(id)]);
            return {id_atleta:Number(id),cedula,clasificacion:clasificar(d.fecha_nac)};
        });
        // No registrar datos personales/medicos ni cambios de cédula en logs.
        return res.json({success:true,message:'Ficha actualizada',...resultado});
    } catch(error) {return responderError(res,error);}
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
                version_ficha: versionFicha(a),
                nombres: a.nombres,
                apellidos: a.apellidos,
                cedula: a.cedula,
                cedula_heredada: !!a.cedula_heredada,
                fecha_nacimiento: a.fecha_nacimiento,
                direccion: a.direccion,
                telefono: a.telefono,
                alergias_medicas: a.alergias_medicas,
                estado: a.estado,
                clasificacion: clasificar(a.fecha_nacimiento),
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
    const columna = Object.hasOwn(COLUMNAS_DOCUMENTO, tipo) ? COLUMNAS_DOCUMENTO[tipo] : null;
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
