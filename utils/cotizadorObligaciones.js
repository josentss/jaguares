'use strict';

// Cotización autoritativa: monto = obligación congelada (USD) × tasa
// que Directiva registró expresamente para la fecha de pago.
// El servidor NUNCA usa el fallback ni la tarjeta "BCV" del dashboard.
const { esEnteroPositivo, esFechaISOValida } = require('./validators');
const { hoyCaracas, periodoDe, siguientePeriodo } = require('./cobrosMensuales');

const MONEDAS = new Set(['USD', 'Bs', 'COP']);

async function cotizar(cliente, {
    id_obligacion, id_atleta, id_representante, moneda, fecha_pago, bloquear = false
}) {
    if (!esEnteroPositivo(id_obligacion) || !MONEDAS.has(moneda) ||
        !esFechaISOValida(fecha_pago) || fecha_pago > hoyCaracas()) {
        return { codigo:400, mensaje:'Obligación, moneda o fecha no válidas' };
    }
    const filtroAtleta = id_atleta === undefined ? '' : ' AND o.id_atleta = $2';
    if (id_atleta !== undefined && !esEnteroPositivo(id_atleta)) {
        return { codigo:400, mensaje:'Atleta no válido' };
    }
    const { rows } = await cliente.query(`
        SELECT o.id_obligacion, o.id_atleta, o.codigo_concepto, o.periodo_mes,
            o.monto_usd, o.fecha_emision, a.id_representante, a.estado AS estado_atleta,
            u.rol AS rol_representante, u.estado AS estado_representante
        FROM obligaciones_cobro o
        JOIN atletas a ON a.id_atleta = o.id_atleta
        JOIN usuarios u ON u.id_usuario = a.id_representante
        WHERE o.id_obligacion = $1 ${filtroAtleta}
        ${bloquear ? 'FOR UPDATE OF o, a, u' : ''}
    `, id_atleta === undefined ? [Number(id_obligacion)] :
        [Number(id_obligacion), Number(id_atleta)]);
    if (!rows.length) return { codigo:404, mensaje:'Cargo no encontrado' };
    const cargo = rows[0];
    if (Number(cargo.id_representante) !== Number(id_representante)) {
        return { codigo:403, mensaje:'No autorizado' };
    }
    if (cargo.estado_atleta !== 'activo' || cargo.estado_representante !== 'aprobado' ||
        cargo.rol_representante !== 'representante') {
        return { codigo:409, mensaje:'Atleta o representante no habilitado' };
    }
    if (cargo.fecha_emision > hoyCaracas() || fecha_pago < cargo.fecha_emision) {
        return { codigo:409, mensaje:'El cargo no estaba disponible en esa fecha' };
    }
    if (cargo.codigo_concepto === 'mensualidad' &&
        cargo.periodo_mes > siguientePeriodo(periodoDe(hoyCaracas()))) {
        return { codigo:409, mensaje:'Solo se permite adelantar el mes siguiente' };
    }
    const { rowCount: reportesActivos } = await cliente.query(`
        SELECT id_pago FROM pagos
        WHERE id_obligacion = $1 AND estado_pago IN ('pendiente','aprobado')
        LIMIT 1
    `, [Number(id_obligacion)]);
    if (reportesActivos) return { codigo:409, mensaje:'Cargo pagado o en revisión' };

    let tasa = null;
    if (moneda !== 'USD') {
        const r = await cliente.query(`
            SELECT id_tasa, tasa_por_usd, fuente, fecha_vigencia
            FROM tasas_cobro
            WHERE moneda = $1 AND fecha_vigencia = $2
            ORDER BY id_tasa DESC LIMIT 1
        `, [moneda,fecha_pago]);
        if (!r.rows.length) {
            return { codigo:409, mensaje:'Directiva debe configurar una tasa para esta moneda y fecha' };
        }
        tasa = r.rows[0];
    }

    const monto = moneda === 'USD' ? cargo.monto_usd :
        (await cliente.query(`SELECT ROUND($1::numeric * $2::numeric,2)::text AS total`,
            [cargo.monto_usd,tasa.tasa_por_usd])).rows[0].total;
    if (Number(monto) <= 0 || Number(monto) > 999999999) {
        return { codigo:409, mensaje:'El importe calculado no está permitido' };
    }
    return { cargo, precio_usd:cargo.monto_usd, monto:Number(monto).toFixed(2),
        moneda, id_tasa_cobro:tasa?.id_tasa ?? null,
        tasa_por_usd:tasa?.tasa_por_usd ?? '1.000000',
        fuente:tasa?.fuente ?? 'Importe nominal USD',
        fecha_tasa:tasa?.fecha_vigencia ?? fecha_pago };
}

module.exports = { cotizar };
