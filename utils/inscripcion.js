const { conIdentidades, comprobarUsuario, ErrorIntegridad } = require('./integridad');
const { esCedulaValida } = require('./validators');

async function inscribir({ idRepresentante, representanteNuevo, atleta, estado }) {
    return conIdentidades(async client => {
        let id = idRepresentante;
        if (representanteNuevo) {
            const r = representanteNuevo;
            await comprobarUsuario(client, r);
            const { rows } = await client.query(`INSERT INTO usuarios
                (nombres, apellidos, correo, cedula, telefono1, password_hash, rol, estado)
                VALUES ($1, $2, $3, $4, $5, $6, 'representante', 'aprobado') RETURNING id_usuario`,
            [r.nombres, r.apellidos, r.correo, r.cedula, r.telefono, r.hash]);
            id = rows[0].id_usuario;
        }

        // Prevent a concurrent deactivation/role change while linking the athlete.
        const { rows: representantes } = await client.query(`SELECT cedula FROM usuarios
            WHERE id_usuario = $1 AND rol = 'representante' AND estado = 'aprobado' FOR UPDATE`, [id]);
        if (!representantes.length) {
            throw new ErrorIntegridad(409, 'Representante no encontrado o no aprobado');
        }

        // Exact repeat within one family, not a global identity inference from
        // names. Different representatives sharing names are not merged.
        const { rows: repetidos } = await client.query(`SELECT id_atleta FROM atletas
            WHERE id_representante = $1 AND LOWER(TRIM(nombres)) = LOWER($2)
              AND LOWER(TRIM(apellidos)) = LOWER($3) AND fecha_nacimiento = $4::date LIMIT 1`,
        [id, atleta.nombres, atleta.apellidos, atleta.fecha]);
        if (repetidos.length) throw new ErrorIntegridad(409, 'Este atleta ya está registrado con el representante');

        let cedula = atleta.cedula;
        if (atleta.heredada) {
            const base = String(representantes[0].cedula || '').trim().toUpperCase();
            if (!esCedulaValida(base)) {
                throw new ErrorIntegridad(400, 'El representante no tiene cédula válida en su perfil. Actualízala primero.');
            }
            const { rows } = await client.query(`SELECT UPPER(TRIM(cedula)) AS cedula FROM atletas
                WHERE UPPER(TRIM(cedula)) LIKE $1 OR UPPER(TRIM(cedula)) = $2`,
            [`${base}-%`, `H-${base}`]);
            let max = 0;
            let antiguas = 0;
            for (const row of rows) {
                if (row.cedula === `H-${base}`) { antiguas++; continue; }
                const sufijo = row.cedula.slice(base.length + 1);
                if (/^\d+$/.test(sufijo)) {
                    const numero = Number(sufijo);
                    if (!Number.isSafeInteger(numero) || numero >= Number.MAX_SAFE_INTEGER) {
                        throw new ErrorIntegridad(409, 'La secuencia heredada requiere revisión administrativa');
                    }
                    max = Math.max(max, numero);
                }
            }
            cedula = `${base}-${Math.max(max, antiguas) + 1}`;
        }
        const { rows: cedulas } = await client.query(
            'SELECT id_atleta FROM atletas WHERE UPPER(TRIM(cedula)) = $1 LIMIT 1', [cedula]);
        if (cedulas.length) throw new ErrorIntegridad(409, 'Ya existe un atleta con esa cédula');

        const { rows } = await client.query(`INSERT INTO atletas (
            id_representante, nombres, apellidos, cedula, cedula_heredada,
            fecha_nacimiento, direccion, telefono, alergias_medicas,
            foto_url, cedula_archivo_url, partida_nacimiento_url, estado)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id_atleta`,
        [id, atleta.nombres, atleta.apellidos, cedula, atleta.heredada ? 1 : 0,
            atleta.fecha, atleta.direccion, atleta.telefono || null, atleta.alergias || null,
            atleta.foto, atleta.documento, atleta.partida, estado]);
        return { idAtleta: rows[0].id_atleta, idRepresentante: id, cedula };
    });
}

module.exports = { inscribir };
