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

// Códigos cerrados: los logs nunca incluyen URLs, claves ni respuestas crudas.
function fallo(code) {
    return Object.assign(new Error(code), {code});
}

const ERRORES_API = new Map([
    ['invalid-key','REFERENCIA_CLAVE_INVALIDA'],
    ['inactive-account','REFERENCIA_CUENTA_INACTIVA'],
    ['quota-reached','REFERENCIA_CUOTA_AGOTADA'],
    ['unsupported-code','REFERENCIA_MONEDA_NO_SOPORTADA'],
    ['malformed-request','REFERENCIA_SOLICITUD_INVALIDA']
]);

async function solicitar(base, key) {
    let respuesta;
    try {
        respuesta=await fetch('https://v6.exchangerate-api.com/v6/'+
            encodeURIComponent(key)+'/latest/'+base,{
            method:'GET',signal:AbortSignal.timeout(4500),
            headers:{Accept:'application/json'},redirect:'error'
        });
    } catch (error) {
        throw fallo(['TimeoutError','AbortError'].includes(error?.name)?
            'REFERENCIA_TIMEOUT':'REFERENCIA_RED');
    }
    let contenido;
    try { contenido=await respuesta.json(); }
    catch { throw fallo('REFERENCIA_JSON_INVALIDO'); }
    if(contenido?.result==='error')
        throw fallo(ERRORES_API.get(contenido['error-type'])||'REFERENCIA_PROVEEDOR');
    if(!respuesta.ok)
        throw fallo(respuesta.status===429?'REFERENCIA_CUOTA_AGOTADA':'REFERENCIA_HTTP');
    return contenido;
}

// El proveedor entrega un instante UTC, no una fecha civil venezolana.
// Normalizar ambas bases a Caracas antes de comparar con el día de cobro.
function interpretarCotizacion(data, base, hoy, ahora=Date.now()) {
    if(data?.result!=='success'||data.base_code!==base||
        !validarValor(data.conversion_rates?.VES)) {
        throw fallo('REFERENCIA_DATOS_INVALIDOS');
    }
    const segundos=data.time_last_update_unix;
    const instante=segundos*1000;
    if(!Number.isSafeInteger(segundos)||segundos<=0||
        !Number.isFinite(new Date(instante).getTime())||instante>ahora+60000)
        throw fallo('REFERENCIA_FECHA_INVALIDA');
    const fecha=hoyCaracas(new Date(instante));
    const antiguedad=diasEntre(fecha,hoy);
    if(!Number.isFinite(antiguedad)||antiguedad<0||antiguedad>3)
        throw fallo('REFERENCIA_FECHA_DESACTUALIZADA');
    return {fecha,ves:numeroSQL(data.conversion_rates.VES)};
}

async function descargar(hoy) {
    const key=(process.env.EXCHANGERATE_API_KEY||'').trim();
    if(!key) throw fallo('REFERENCIA_CLAVE_NO_CONFIGURADA');
    // Ambos valores son directos; no reconstruir EUR con una tasa cruzada.
    // Conservar la fila de caché como una unidad coherente y no guardar
    // resultados incompletos ni modificar las tasas de cobro publicadas.
    const [dataUSD,dataEUR]=await Promise.all([
        solicitar('USD',key),solicitar('EUR',key)
    ]);
    const ahora=Date.now();
    const usd=interpretarCotizacion(dataUSD,'USD',hoy,ahora);
    const eur=interpretarCotizacion(dataEUR,'EUR',hoy,ahora);
    if(usd.fecha!==eur.fecha)throw fallo('REFERENCIA_FECHAS_INCONSISTENTES');
    return {fecha_referencia:usd.fecha,usd_ves:usd.ves,eur_ves:eur.ves};
}

// Una transacción con advisory-lock evita llamadas simultáneas por la misma
// fuente/día en varias instancias serverless. Los errores no se almacenan.
// Cuando se cotiza un POST ya existe una transacción abierta. Reutilizar
// ese cliente evita agotar el pool (max=3) cuando varios representantes
// consultan por primera vez la tasa del día al mismo tiempo.
// El llamador sigue siendo responsable de COMMIT/ROLLBACK en ese caso.
async function obtenerReferencia(proveedor, hoy=hoyCaracas(), clienteExistente=null) {
    if(!PROVEEDORES.has(proveedor)||!fechaCivilValida(hoy))
        throw new TypeError('Proveedor o fecha no válidos');
    const propio=!clienteExistente;
    const client=clienteExistente||await db.pool.connect();
    let committed=false;
    try{
        if(propio)await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',
            ['jaguares:referencia:'+proveedor+':'+hoy]);
        const antigua=await client.query(`
            SELECT fecha_consulta,proveedor,fecha_referencia,
                usd_ves,eur_ves,capturado_en
            FROM referencias_cambio_diarias
            WHERE fecha_consulta=$1 AND proveedor=$2`,[hoy,proveedor]);
        if(antigua.rowCount){
            if(propio)await client.query('COMMIT');
            committed=true;
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
        if(propio)await client.query('COMMIT');
        committed=true;
        return {...rows[0],desde_cache:false};
    } finally {
        if(propio){
            if(!committed){
                try{await client.query('ROLLBACK');}
                catch(e){console.error('REFERENCIA_ROLLBACK',e.code||'INTERNAL');}
            }
            client.release();
        }
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
        console.warn('REFERENCIAS_NO_DISPONIBLES',err.code||'INTERNAL');
        return {
            fecha_consulta:hoy,
            principal:null,
            mercado:null,
            avisos:{principal:'ExchangeRate-API no disponible; utiliza una tasa manual verificada.'}
        };
    }
}

module.exports={obtenerReferencia,obtenerReferencias,diasEntre,interpretarCotizacion};
