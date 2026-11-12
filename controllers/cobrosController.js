'use strict';

const db = require('../config/db');
const { esEnteroPositivo } = require('../utils/validators');
const {
    fechaCivilValida, elegibilidad, hoyCaracas, periodoDe,
    siguientePeriodo, estadoObligacion, periodoValido
} = require('../utils/cobrosMensuales');

const ADMINISTRADORES = ['directiva', 'admin'];
const LECTORES = [...ADMINISTRADORES, 'staff'];

function mensajeError(res, error) {
    if (error.code === '23505' || error.code === '23503' || error.code === '23514') {
        return res.status(409).json({ success: false, message: 'Los datos de cobro cambiaron o no son compatibles' });
    }
    if (error.code === '42P01' || error.code === '42703') {
        return res.status(503).json({ success: false, message: 'Cuentas por cobrar no disponibles: revisa la migración' });
    }
    console.error('CUENTAS_COBRO_SQL', error.code || 'INTERNAL');
    return res.status(500).json({ success: false, message: 'No se pudo procesar la cuenta por cobrar' });
}

function denegar(res) {
    return res.status(403).json({ success: false, message: 'No autorizado' });
}

function idAtletaValido(id) {
    return esEnteroPositivo(id) && Number.isSafeInteger(Number(id));
}

exports.consultar = async (req, res) => {
    const id = req.params.id_atleta;
    if (!idAtletaValido(id)) {
        return res.status(400).json({ success: false, message: 'Atleta no válido' });
    }
    if (!LECTORES.includes(req.usuarioRol) && req.usuarioRol !== 'representante') return denegar(res);
    try {
        const atleta = await db.pool.query(
            'SELECT id_atleta, id_representante FROM atletas WHERE id_atleta = $1', [Number(id)]
        );
        if (!atleta.rowCount) return res.status(404).json({ success: false, message: 'Atleta no encontrado' });
        if (req.usuarioRol === 'representante' &&
            Number(atleta.rows[0].id_representante) !== Number(req.usuarioId)) return denegar(res);

        const [ancla, obligaciones] = await Promise.all([
            db.pool.query(`SELECT fecha_inicio, dia_ancla, configurado_en
                FROM anclas_cobro_atleta WHERE id_atleta = $1`, [Number(id)]),
            db.pool.query(`SELECT o.id_obligacion, o.codigo_concepto, o.periodo_mes,
                o.detalle, o.monto_usd, o.fecha_emision, o.fecha_vencimiento, o.fecha_limite,
                EXISTS (SELECT 1 FROM pagos p WHERE p.id_obligacion = o.id_obligacion
                    AND p.estado_pago = 'aprobado') AS existe_aprobado,
                EXISTS (SELECT 1 FROM pagos p WHERE p.id_obligacion = o.id_obligacion
                    AND p.estado_pago = 'pendiente') AS existe_pendiente
                FROM obligaciones_cobro o
                WHERE o.id_atleta = $1 ORDER BY o.fecha_vencimiento, o.id_obligacion`, [Number(id)])
        ]);
        const hoy = hoyCaracas();
        res.set?.('Cache-Control', 'no-store');
        return res.json({
            success: true, id_atleta: Number(id),
            ancla: ancla.rows[0] || null,
            obligaciones: obligaciones.rows.map(({ existe_aprobado, existe_pendiente, ...o }) => ({
                ...o,
                estado: estadoObligacion({ ...o, existe_aprobado, existe_pendiente }, hoy)
            }))
        });
    } catch (error) { return mensajeError(res, error); }
};

// Primera activación exclusivamente manual. No reprocesa pagos históricos.
exports.configurarAncla = async (req, res) => {
    if (!ADMINISTRADORES.includes(req.usuarioRol)) return denegar(res);
    const id = req.params.id_atleta;
    const { fecha_inicio: inicio, dia_ancla: dia, historial_revisado: revisado } = req.body || {};
    if (!idAtletaValido(id) || !fechaCivilValida(inicio) ||
        !Number.isInteger(dia) || dia < 1 || dia > 31 || revisado !== true) {
        return res.status(400).json({ success: false,
            message: 'Indica atleta, fecha de inicio, día 1-31 y confirma la revisión de pagos históricos' });
    }
    let cliente;
    let confirmada = false;
    try {
        cliente = await db.pool.connect();
        await cliente.query('BEGIN');
        const atleta = await cliente.query(`SELECT a.estado, u.estado AS estado_representante,
                u.rol AS rol_representante
            FROM atletas a JOIN usuarios u ON u.id_usuario = a.id_representante
            WHERE a.id_atleta = $1 FOR UPDATE OF a, u`, [Number(id)]);
        if (!atleta.rowCount) return res.status(404).json({ success: false, message: 'Atleta no encontrado' });
        const a = atleta.rows[0];
        if (a.estado !== 'activo' || a.estado_representante !== 'aprobado' ||
            a.rol_representante !== 'representante') {
            return res.status(409).json({ success: false,
                message: 'Se requiere atleta activo con representante aprobado' });
        }
        const ancla = await cliente.query(`INSERT INTO anclas_cobro_atleta
            (id_atleta, fecha_inicio, dia_ancla, configurado_por)
            VALUES ($1, $2, $3, $4) ON CONFLICT (id_atleta) DO NOTHING
            RETURNING fecha_inicio, dia_ancla`, [Number(id), inicio, dia, req.usuarioId]);
        if (!ancla.rowCount) return res.status(409).json({ success: false,
            message: 'Este atleta ya tiene un inicio de cobro; no se modifica sin conciliación' });
        await cliente.query('COMMIT');
        confirmada = true;
        return res.status(201).json({ success: true, id_atleta: Number(id), ancla: ancla.rows[0] });
    } catch (error) { return mensajeError(res, error); }
    finally {
        if (cliente) {
            if (!confirmada) {
                try { await cliente.query('ROLLBACK'); }
                catch (error) { console.error('CUENTAS_COBRO_ROLLBACK', error.code || 'INTERNAL'); }
            }
            cliente.release();
        }
    }
};

// Generación bajo orden expresa para UN atleta y UN mes. Sin cron ni backfill.
exports.generarMensualidad = async (req, res) => {
    if (!ADMINISTRADORES.includes(req.usuarioRol)) return denegar(res);
    const { id_atleta: id, periodo_mes: periodo, confirmar } = req.body || {};
    if (!idAtletaValido(id) || !periodoValido(periodo) || confirmar !== true) {
        return res.status(400).json({ success: false,
            message: 'Indica atleta, período YYYY-MM-01 y confirmación expresa' });
    }
    let cliente;
    let confirmada = false;
    try {
        cliente = await db.pool.connect();
        await cliente.query('BEGIN');
        // Todas las operaciones del mismo atleta serializan sobre su fila.
        const atleta = await cliente.query(`SELECT a.estado, u.estado AS estado_representante,
                u.rol AS rol_representante
            FROM atletas a JOIN usuarios u ON u.id_usuario = a.id_representante
            WHERE a.id_atleta = $1 FOR UPDATE OF a, u`, [Number(id)]);
        if (!atleta.rowCount) return res.status(404).json({ success: false, message: 'Atleta no encontrado' });
        const a = atleta.rows[0];
        if (a.estado !== 'activo' || a.estado_representante !== 'aprobado' ||
            a.rol_representante !== 'representante') {
            return res.status(409).json({ success: false, message: 'Atleta o representante no habilitado' });
        }
        const { rows: anclas } = await cliente.query(
            'SELECT fecha_inicio, dia_ancla FROM anclas_cobro_atleta WHERE id_atleta = $1',
            [Number(id)]
        );
        if (!anclas.length) return res.status(409).json({ success: false,
            message: 'Configura primero el inicio de cobro y revisa el historial del atleta' });

        const { fecha_inicio, dia_ancla } = anclas[0];
        const criterio = elegibilidad(periodo, fecha_inicio, dia_ancla, hoyCaracas());
        if (!criterio.valida) return res.status(409).json({ success: false, message: criterio.motivo });

        const concepto = await cliente.query(`SELECT monto_referencia_usd
            FROM conceptos_cobro WHERE codigo = 'mensualidad' AND activo = TRUE`);
        if (!concepto.rowCount) return res.status(409).json({ success: false,
            message: 'La mensualidad no está habilitada en el catálogo' });
        const { fecha_vencimiento, fecha_limite } = criterio.plan;
        const insertada = await cliente.query(`INSERT INTO obligaciones_cobro
            (id_atleta, codigo_concepto, periodo_mes, monto_usd, fecha_emision,
             fecha_vencimiento, fecha_limite, origen, creado_por)
            VALUES ($1, 'mensualidad', $2, $3, $4, $5, $6, 'directiva', $7)
            ON CONFLICT (id_atleta, periodo_mes) WHERE codigo_concepto = 'mensualidad'
            DO NOTHING RETURNING id_obligacion, monto_usd, periodo_mes,
                fecha_vencimiento, fecha_limite`, [
                Number(id), periodo, concepto.rows[0].monto_referencia_usd, hoyCaracas(),
                fecha_vencimiento, fecha_limite, req.usuarioId
            ]);
        const existente = insertada.rowCount ? insertada.rows[0] :
            (await cliente.query(`SELECT id_obligacion, monto_usd, periodo_mes,
                fecha_vencimiento, fecha_limite
                FROM obligaciones_cobro
                WHERE id_atleta = $1 AND codigo_concepto = 'mensualidad' AND periodo_mes = $2`,
            [Number(id), periodo])).rows[0];

        await cliente.query('COMMIT');
        confirmada = true;
        return res.status(insertada.rowCount ? 201 : 200).json({
            success: true, creada: insertada.rowCount === 1, obligacion: existente
        });
    } catch (error) { return mensajeError(res, error); }
    finally {
        if (cliente) {
            if (!confirmada) {
                try { await cliente.query('ROLLBACK'); }
                catch (error) { console.error('CUENTAS_COBRO_ROLLBACK', error.code || 'INTERNAL'); }
            }
            cliente.release();
        }
    }
};
