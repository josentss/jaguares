'use strict';

// ExchangeRate-API como referencia operativa seleccionada por el club.
// Nunca introducir un tipo de cambio en pagos desde este módulo sin aprobación
// explícita de Directiva. Caché en PostgreSQL para todas las réplicas Vercel.
const db = require('../config/db');
const { hoyCaracas, fechaCivilValida } = require('./cobrosMensuales');

// La tabla mantiene referencias históricas de proveedores anteriores, pero
// solo ExchangeRate-API se consulta a partir de esta versión.
const PROVEEDORES = new Set(['exchangerate_api']);

function diasEntre(fecha1, fecha2) {
    const a=Date.parse(fecha1+'T00:00:00Z');
    const b=Date.parse(fecha2+'T00:00:00Z');
    return Math.round((b-a)/86400000);
}

function validarValor(n) {
    return typeof n === 'number' && Number.isFinite(n) && n>0 && n<=999999999;
}
function numeroSQL(n) { return Number(n).toFixed(6); }

async function solicitar(url) {
    const respuesta=await fetch(url,{
        method:'GET',
        signal:AbortSignal.timeout(4500),
        headers:{Accept:'application/json'},
        redirect:'error'
    });
    if (!respuesta.ok) throw new Error('HTTP '+respuesta.status);
    const contenido=await respuesta.json();
    if (!contenido || typeof contenido!=='object') throw new Error('Respuesta no válida');
    return contenido;
}

async function descargar(hoy) {
    const key=process.env.EXCHANGERATE_API_KEY;
    if(!key) throw new Error('ExchangeRate-API no configurada');
    const data=await solicitar('https://v6.exchangerate-api.com/v6/'+
        encodeURIComponent(key)+'/latest/USD');
    const ves=data.conversion_rates?.VES;
    const eur=data.conversion_rates?.EUR;
    if(data.result!=='success'||data.base_code && data.base_code!=='USD' ||
        !validarValor(ves)||!validarValor(eur)||!validarValor(ves/eur)) {
        throw new Error('Cotización referencial no válida');
    }
    let fecha=hoy;
    if(Number.isSafeInteger(data.time_last_update_unix)) {
        fecha=new Date(data.time_last_update_unix*1000).toISOString().slice(0,10);
        if(diasEntre(fecha,hoy)<0||diasEntre(fecha,hoy)>3)
            throw new Error('Cotización referencial desactualizada');
    }
    return {fecha_referencia:fecha,
        usd_ves:numeroSQL(ves),eur_ves:numeroSQL(ves/eur)};
}

// Una transacción con advisory-lock evita llamadas simultáneas por la misma
// fuente/día en varias instancias serverless. Los errores no se almacenan.
async function obtenerReferencia(proveedor, hoy=hoyCaracas()) {
    if(!PROVEEDORES.has(proveedor)||!fechaCivilValida(hoy))
        throw new TypeError('Proveedor o fecha no válidos');
    const client=await db.pool.connect();
    let committed=false;
    try{
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',
            ['jaguares:referencia:'+proveedor+':'+hoy]);
        const antigua=await client.query(`
            SELECT fecha_consulta,proveedor,fecha_referencia,
                usd_ves,eur_ves,capturado_en
            FROM referencias_cambio_diarias
            WHERE fecha_consulta=$1 AND proveedor=$2`,[hoy,proveedor]);
        if(antigua.rowCount){
            await client.query('COMMIT');committed=true;
            return {...antigua.rows[0],desde_cache:true};
        }
        const d=await descargar(hoy);
        const {rows}=await client.query(`
            INSERT INTO referencias_cambio_diarias
                (fecha_consulta,proveedor,fecha_referencia,usd_ves,eur_ves)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT(fecha_consulta,proveedor) DO NOTHING
            RETURNING fecha_consulta,proveedor,fecha_referencia,
                usd_ves,eur_ves,capturado_en
        `,[hoy,proveedor,d.fecha_referencia,d.usd_ves,d.eur_ves]);
        await client.query('COMMIT');committed=true;
        return {...rows[0],desde_cache:false};
    } finally {
        if(!committed) {
            try{await client.query('ROLLBACK');}
            catch(e){console.error('REFERENCIA_ROLLBACK',e.code||'INTERNAL');}
        }
        client.release();
    }
}

// ExchangeRate-API es la fuente primaria elegida por el club. La caché
// histórica de fuentes secundarias se conserva para trazabilidad, pero no
// se consulta bcv.today cada vez que se abre el panel.
async function obtenerReferencias(hoy=hoyCaracas()) {
    try {
        const principal=await obtenerReferencia('exchangerate_api',hoy);
        return {
            fecha_consulta:hoy,
            principal,
            // Alias de solo lectura para compatibilidad con reportes antiguos.
            mercado:principal,
            avisos:{principal:null}
        };
    } catch(err) {
        return {
            fecha_consulta:hoy,
            principal:null,
            mercado:null,
            avisos:{principal:'ExchangeRate-API no disponible; utiliza una tasa manual verificada.'}
        };
    }
}

module.exports={obtenerReferencia,obtenerReferencias,diasEntre};
