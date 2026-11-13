'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {configurarPostgresTemporal}=require('./helpers/postgres');
const db=require('../config/db');
const {obtenerReferencia}=require('../utils/referenciasCambio');
const {hoyCaracas}=require('../utils/cobrosMensuales');
const schema=configurarPostgresTemporal();
const hoy=hoyCaracas();
let creado=false,llamadas=0;
const originalFetch=global.fetch;
const originalKey=process.env.EXCHANGERATE_API_KEY;

test.before(async()=>{
    process.env.EXCHANGERATE_API_KEY='sintetica-no-real';
    global.fetch=async(url)=>{
        assert.ok(String(url).startsWith(
            'https://v6.exchangerate-api.com/v6/sintetica-no-real/latest/USD'));
        llamadas++;
        return {ok:true,json:async()=>({
            result:'success',base_code:'USD',
            conversion_rates:{VES:915.25,EUR:0.91},
            time_last_update_unix:Date.parse(hoy+'T12:00:00Z')/1000
        })};
    };
    await db.pool.query(`CREATE SCHEMA ${schema}`);
    creado=true;
    await db.pool.query(`
        CREATE TABLE conceptos_cobro(
            codigo TEXT PRIMARY KEY,
            monto_referencia_usd NUMERIC(12,2) NOT NULL
        )
    `);
    await db.pool.query(fs.readFileSync(
        path.join(__dirname,'../migrations/2026-11-13_referencias_cambio_cache.sql'),
        'utf8'));
});
test.after(async()=>{
    global.fetch=originalFetch;
    if(originalKey===undefined)delete process.env.EXCHANGERATE_API_KEY;
    else process.env.EXCHANGERATE_API_KEY=originalKey;
    try{if(creado)await db.pool.query(`DROP SCHEMA ${schema} CASCADE`);}
    finally{await db.pool.end();}
});

test('tres transacciones comparten pool y solicitan la referencia solo una vez',async()=>{
    // El pool Vercel tiene 3 conexiones. Si obtenerReferencia abre otra
    // conexión mientras estas tres ya están prestadas, agota el pool.
    const clientes=await Promise.all([0,1,2].map(()=>db.pool.connect()));
    try {
        const referencias=await Promise.all(clientes.map(async c=>{
            await c.query('BEGIN');
            // En pruebas concurrentes fijar el esquema temporal en cada
            // cliente, sin depender de la conexión reutilizada por el pool.
            await c.query("SELECT set_config('search_path',$1,true)",[schema]);
            const ref=await obtenerReferencia('exchangerate_api',hoy,c);
            // pg_advisory_xact_lock se libera al confirmar CADA transacción.
            await c.query('COMMIT');
            return ref;
        }));
        assert.ok(referencias.every(x=>x.usd_ves==='915.250000'));
        assert.equal(llamadas,1);
        const {rows}=await db.pool.query(
            "SELECT COUNT(*)::int AS total FROM ${schema}.referencias_cambio_diarias WHERE proveedor='exchangerate_api'");
        assert.equal(rows[0].total,1);
    }finally {
        await Promise.all(clientes.map(async c=>{
            try{await c.query('ROLLBACK');}catch{}
            c.release();
        }));
    }
});
