const db = require('../config/db');
const bcrypt = require('bcrypt');
const { normalizarTexto, esEnteroPositivo, esEmailValido, esPasswordValida } = require('../utils/validators');
const { crearNotificacion } = require('./notificacionesController');

function urlDeArchivo(file) {
    if (!file) return null;
    return file.path || file.secure_url || null;
}

function construirCedulaHeredada(cedulaRep) {
    const limpia = String(cedulaRep || '').trim();
    if (!limpia) return null;
    if (limpia.startsWith('H-')) return limpia;
    return `H-${limpia}`;
}

exports.obtenerAtletasPorRepresentante = (req, res) => {
    const { id } = req.params;
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
        res.json({ success: true, atletas: results });
    });
};

// Lógica común de registro. El representante la usa con estado 'espera'
// (pasa por aprobación); la directiva con 'activo' (queda aprobado al crearse).
function registrarAtletaBase(req, res, { id_representante, estado, mensaje, alRegistrar }) {
    const nombres   = normalizarTexto(req.body.nombres, 80);
    const apellidos = normalizarTexto(req.body.apellidos, 80);
    const fecha_nac = String(req.body.fecha_nac || '').trim();
    const direccion = normalizarTexto(req.body.direccion, 255);
    const telefono  = normalizarTexto(req.body.telefono, 30);
    const alergias  = normalizarTexto(
        req.body.allergies_medicas || req.body.alergias_medicas || '',
        500
    );

    const heredaCedula = ['1', 'true', true, 'on'].includes(req.body.hereda_cedula);

    if (!id_representante || !nombres || !apellidos || !fecha_nac || !direccion) {
        return res.status(400).json({
            success: false,
            message: 'Faltan campos obligatorios (nombres, apellidos, fecha de nacimiento, dirección)'
        });
    }

    const fecha = new Date(fecha_nac + 'T12:00:00');
    if (Number.isNaN(fecha.getTime()) || fecha > new Date()) {
        return res.status(400).json({ success: false, message: 'Fecha de nacimiento inválida' });
    }

    const files = req.files || {};
    const fotoUrl    = urlDeArchivo(files.foto?.[0]);
    const cedulaUrl  = urlDeArchivo(files.cedula_archivo?.[0]);
    const partidaUrl = urlDeArchivo(files.partida_nacimiento?.[0]);

    const continuarConCedula = (cedulaFinal, cedulaHeredadaFlag) => {
        const query = `
            INSERT INTO atletas (
                id_representante, nombres, apellidos, cedula, cedula_heredada,
                fecha_nacimiento, direccion, telefono, alergias_medicas,
                foto_url, cedula_archivo_url, partida_nacimiento_url, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const valores = [
            id_representante,
            nombres,
            apellidos,
            cedulaFinal,
            cedulaHeredadaFlag ? 1 : 0,
            fecha_nac,
            direccion,
            telefono || null,
            alergias || null,
            fotoUrl,
            cedulaUrl,
            partidaUrl,
            estado
        ];

        db.query(query, valores, (err, result) => {
            if (err) {
                console.error('Error al insertar atleta:', err.code, err.message);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({
                        success: false,
                        message: 'Ya existe un atleta con esa cédula'
                    });
                }
                return res.status(500).json({
                    success: false,
                    message: 'Error al registrar al atleta'
                });
            }

            if (alRegistrar) {
                try { alRegistrar(result.insertId, nombres, apellidos); } catch (e) { console.error('alRegistrar error', e.message); }
            }

            res.json({
                success: true,
                message: mensaje,
                id_atleta: result.insertId,
                cedula: cedulaFinal,
                cedula_heredada: !!cedulaHeredadaFlag,
                documentos: {
                    foto: !!fotoUrl,
                    cedula_archivo: !!cedulaUrl,
                    partida_nacimiento: !!partidaUrl
                }
            });
        });
    };

    if (heredaCedula) {
        db.query(
            'SELECT cedula FROM usuarios WHERE id_usuario = ? LIMIT 1',
            [id_representante],
            (err, rows) => {
                if (err || !rows || rows.length === 0) {
                    console.error('Error al obtener cédula del representante:', err?.message);
                    return res.status(500).json({
                        success: false,
                        message: 'No se pudo obtener la cédula del representante'
                    });
                }

                const cedulaRep = rows[0].cedula;
                if (!cedulaRep) {
                    return res.status(400).json({
                        success: false,
                        message: 'El representante no tiene cédula en su perfil. Actualízala primero.'
                    });
                }

                continuarConCedula(construirCedulaHeredada(cedulaRep), true);
            }
        );
    } else {
        let cedulaRaw = normalizarTexto(req.body.cedula, 30);
        if (!cedulaRaw) {
            return res.status(400).json({
                success: false,
                message: 'Debes indicar la cédula del atleta o marcar que hereda la del representante'
            });
        }
        cedulaRaw = cedulaRaw.replace(/\s+/g, '');
        continuarConCedula(cedulaRaw, false);
    }
}


exports.registrarAtleta = (req, res) => {
    registrarAtletaBase(req, res, {
        id_representante: req.usuarioId,
        estado: 'espera',
        mensaje: 'Atleta registrado con éxito, en espera de aprobación.'
    });
};

// Directiva registra a un atleta en nombre de un representante.
// Entra como 'activo': no necesita pasar por Gestión Atletas.
// Con representante_nuevo=1 también crea la cuenta del representante
// (ya aprobada) para que pueda entrar a reportar pagos o inscribir más atletas.
exports.registrarAtletaDirectiva = (req, res) => {
    const registrar = (idRep, resSalida) => registrarAtletaBase(req, resSalida, {
        id_representante: idRep,
        estado: 'activo',
        mensaje: 'Atleta registrado y activado con éxito.',
        alRegistrar: (idAtleta, nombres, apellidos) => {
            crearNotificacion(
                idRep,
                `La directiva registró a ${nombres} ${apellidos} y ya está activo en el club.`,
                'success'
            );
            try { if (req.logAdmin) req.logAdmin({ action: 'registrarAtletaDirectiva', id_atleta: idAtleta, id_representante: idRep }); } catch (e) {}
        }
    });

    if (!['1', 'true', true, 'on'].includes(req.body.representante_nuevo)) {
        const idRep = Number(req.body.id_representante);
        if (!esEnteroPositivo(idRep)) {
            return res.status(400).json({ success: false, message: 'Selecciona un representante' });
        }
        return db.query(
            "SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND rol = 'representante' AND estado = 'aprobado' LIMIT 1",
            [idRep],
            (err, rows) => {
                if (err) {
                    console.error('Error al validar representante:', err.message);
                    return res.status(500).json({ success: false, message: 'Error al validar al representante' });
                }
                if (!rows || rows.length === 0) {
                    return res.status(404).json({ success: false, message: 'Representante no encontrado o no aprobado' });
                }
                registrar(idRep, res);
            }
        );
    }

    // ── Representante nuevo ──
    const repNombres   = normalizarTexto(req.body.rep_nombres, 80);
    const repApellidos = normalizarTexto(req.body.rep_apellidos, 80);
    const repCedula    = normalizarTexto(req.body.rep_cedula, 30).replace(/\s+/g, '');
    const repCorreo    = normalizarTexto(req.body.rep_correo, 120).toLowerCase();
    const repTelefono  = normalizarTexto(req.body.rep_telefono, 30);
    const repPassword  = req.body.rep_password;

    if (!repNombres || !repApellidos || !repCedula || !repTelefono) {
        return res.status(400).json({ success: false, message: 'Completa nombres, apellidos, cédula y teléfono del representante' });
    }
    if (!esEmailValido(repCorreo)) {
        return res.status(400).json({ success: false, message: 'El correo del representante no es válido' });
    }
    if (!esPasswordValida(repPassword)) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    db.query(
        'SELECT correo, cedula FROM usuarios WHERE correo = ? OR cedula = ? LIMIT 1',
        [repCorreo, repCedula],
        async (err, rows) => {
            if (err) {
                console.error('Error al validar duplicados de representante:', err.message);
                return res.status(500).json({ success: false, message: 'Error al validar al representante' });
            }
            if (rows && rows.length) {
                const dupCorreo = rows[0].correo === repCorreo;
                return res.status(409).json({
                    success: false,
                    message: dupCorreo ? 'Ese correo ya está registrado' : 'Ya existe un usuario con esa cédula'
                });
            }

            let hash;
            try { hash = await bcrypt.hash(String(repPassword), 10); }
            catch (e) { return res.status(500).json({ success: false, message: 'Error de servidor' }); }

            db.query(
                `INSERT INTO usuarios (nombres, apellidos, correo, cedula, telefono1, password_hash, rol, estado)
                 VALUES (?, ?, ?, ?, ?, ?, 'representante', 'aprobado')`,
                [repNombres, repApellidos, repCorreo, repCedula, repTelefono, hash],
                (err2, result) => {
                    if (err2) {
                        console.error('Error al crear representante:', err2.code, err2.message);
                        if (err2.code === 'ER_DUP_ENTRY') {
                            return res.status(409).json({ success: false, message: 'Ese correo o cédula ya están registrados' });
                        }
                        return res.status(500).json({ success: false, message: 'Error al crear al representante' });
                    }
                    const idRep = result.insertId;

                    // Si el atleta falla, se deshace la cuenta recién creada para no dejarla huérfana.
                    const resProxy = {
                        status(c) { res.status(c); return resProxy; },
                        json(body) {
                            if (body && body.success) {
                                return res.json({ ...body, representante: { id_usuario: idRep, correo: repCorreo } });
                            }
                            db.query('DELETE FROM usuarios WHERE id_usuario = ?', [idRep], (e3) => {
                                if (e3) console.error('No se pudo deshacer el representante', idRep, e3.message);
                                res.json(body);
                            });
                        }
                    };
                    registrar(idRep, resProxy);
                }
            );
        }
    );
};

// ── Ficha completa (planilla) ──────────────────────────────────────────────
exports.obtenerAtletaPorId = (req, res) => {
    const { id } = req.params;
    const idNum = parseInt(id, 10);

    if (!idNum || idNum < 1) {
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

    db.query(query, [idNum], (err, rows) => {
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
                    foto_url: a.foto_url || null,
                    cedula_archivo_url: a.cedula_archivo_url || null,
                    partida_nacimiento_url: a.partida_nacimiento_url || null
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
