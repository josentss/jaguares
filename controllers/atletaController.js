const db = require('../config/db');
const { normalizarTexto } = require('../utils/validators');

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

exports.registrarAtleta = (req, res) => {
    const id_representante = req.usuarioId;

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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'espera')
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
            partidaUrl
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

            res.json({
                success: true,
                message: 'Atleta registrado con éxito, en espera de aprobación.',
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
