'use strict';

// Cotización autoritativa: USD congelado × tasa de Bs/COP por USD.
// Primero respeta las tasas ya registradas. Si no hay tasa de Bs para
// la fecha del pago, emplea ExchangeRate-API (caché del día), sin usar
// una tasa actual para fechas históricas sin registro verificable.
// Solo el POST de pago confirma una nueva tasa automática en el libro.
const { esEnteroPositivo, esFechaISOValida } = require('./validators');
const { hoyCaracas, periodoDe, siguientePeriodo } = require('./cobrosMensuales');
const { obtenerReferencia, diasEntre } = require('./referenciasCambio');

const MONEDAS = new Set(['USD', 'Bs', 'COP']);

// Esta función solo obtiene una referencia. En cotizaciones GET no crea tasas.
// Nunca se solicita /latest/USD para reconstruir un día anterior.
async function referenciaParaFecha(cliente, fechaPago, bloquear) {
    try {
        let ref;
        if (fechaPago === hoyCaracas()) {
            ref = await obtenerReferencia('exchangerate_api',fechaPago,
                bloquear?cliente:null);
        } else {
            const anterior=await cliente.query(`
                SELECT fecha_referencia::text, usd_ves
                FROM referencias_cambio_diarias
                WHERE proveedor='exchangerate_api' AND fecha_consulta=$1
            `,[fechaPago]);
            ref=anterior.rows[0];
        }
        if (!ref || !Number.isFinite(Number(ref.usd_ves)) ||
            Number(ref.usd_ves) <= 0) return null;
        const dias=diasEntre(ref.fecha_referencia,fechaPago);
        if(!Number.isFinite(dias)||dias<0||dias>3)return null;
        return {
            id_tasa:null,
            tasa_por_usd:ref.usd_ves,
            fecha_vigencia:fechaPago,
            fuente:'ExchangeRate-API (fecha '+ref.fecha_referencia+')'
        };
    }catch(error){
        // Sin conexión/cuota/caché no inventar equivalencias.
        if(!['42P01','42703'].includes(error.code)){
            console.warn('COTIZACION_REFERENCIA_NO_DISPONIBLE',error.code||'INTERNAL');
        }
        return null;
    }
}


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
            o.monto_usd, o.fecha_emision, c.nombre AS nombre_concepto,
            a.id_representante, a.estado AS estado_atleta,
            u.rol AS rol_representante, u.estado AS estado_representante
        FROM obligaciones_cobro o
        JOIN conceptos_cobro c ON c.codigo = o.codigo_concepto
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

    let tasa=null;
    if(moneda!=='USD') {
        // El POST bloquea la fecha para que dos reportes simultáneos no
        // publiquen dos veces la misma tasa automática.
        if(moneda==='Bs' && bloquear) {
            await cliente.query('SELECT pg_advisory_xact_lock(hashtext($1))',
                ['jaguares:reporte-tasa:Bs:'+fecha_pago]);
        }
        // COP conserva la última tasa manual desde su fecha de vigencia,
        // hasta que Directiva publique una nueva. Bs nunca reutiliza una
        // tasa del día anterior: se calcula con la referencia de su fecha.
        const condicion=moneda==='COP'?'fecha_vigencia <= $2':'fecha_vigencia = $2';
        const registrada=await cliente.query(`
            SELECT id_tasa, tasa_por_usd, fuente, fecha_vigencia
            FROM tasas_cobro
            WHERE moneda=$1 AND ${condicion}
            ORDER BY fecha_vigencia DESC,id_tasa DESC LIMIT 1
        `,[moneda,fecha_pago]);
        tasa=registrada.rows[0]||null;

        if(!tasa && moneda==='Bs') {
            const automatica=await referenciaParaFecha(cliente,fecha_pago,bloquear);
            if(automatica) {
                if(bloquear) {
                    // La tasa solo se inserta dentro de la transacción del
                    // reporte. Un error, duplicado o importe incorrecto
                    // revierte tanto el pago como su tasa asociada.
                    const guardada=await cliente.query(`
                        INSERT INTO tasas_cobro
                            (moneda,fecha_vigencia,tasa_por_usd,fuente,creado_por)
                        VALUES ('Bs',$1,$2,$3,$4)
                        RETURNING id_tasa,tasa_por_usd,fuente,fecha_vigencia
                    `,[fecha_pago,automatica.tasa_por_usd,
                        automatica.fuente,Number(id_representante)]);
                    tasa=guardada.rows[0];
                }else tasa=automatica;
            }
        }
        if(!tasa) {
            return {codigo:409,mensaje:moneda==='Bs'?
                'No hay tasa para la fecha elegida. Usa la fecha de hoy o consulta al club.':
                'El club aún no ha fijado la tasa en COP para esta fecha.'};
        }
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
