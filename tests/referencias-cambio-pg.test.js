'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {configurarPostgresTemporal}=require('./helpers/postgres');
const schema=configurarPostgresTemporal();
const db=require('../config/db');
const servicio=require('../utils/referenciasCambio');
const controller=require('../controllers/referenciasCobrosController');
const catalogo=require('../controllers/catalogoCobrosController');
const {hoyCaracas}=require('../utils/cobrosMensuales');
const hoy=hoyCaracas();
const admin={usuarioRol:'directiva',usuarioId:9};
let existe=false,bcvLlamadas=0,mercadoLlamadas=0;
const fetchAnterior=global.fetch;
const claveAnterior=process.env.EXCHANGERATE_API_KEY;

function fakeResponse(data) {return {ok:true,json:async()=>data};}
async function invocar(fn,req={}) {
    let resolve;
    const p=new Promise(r=>resolve=r);
    const res={
        codigo:200,
        status(n){this.codigo=n;return this;},
        set(){return this;},
        json(body){resolve({codigo:this.codigo,body});return this;}
    };
    await fn(req,res);
    return p;
}
test.before(async()=>{
    process.env.EXCHANGERATE_API_KEY='prueba-no-real';
    global.fetch=async(url)=>{
        const u=String(url);
        if(u.includes('bcv.today/api/v1/rate.json')){
            bcvLlamadas++;
            return fakeResponse({USD:980.123456,EUR:1140.654321,
                effective_date:hoy,updated_at:new Date().toISOString()});
        }
        if(u.startsWith('https://v6.exchangerate-api.com/')){
            mercadoLlamadas++;
            return fakeResponse({result:'success',base_code:'USD',
                conversion_rates:{VES:970.12,EUR:0.85},
                time_last_update_unix:Date.parse(hoy+'T12:00:00Z')/1000});
        }
        throw new Error('URL no autorizada en test '+u);
    };
    await db.pool.query(`CREATE SCHEMA ${schema}`);existe=true;
    await db.pool.query(`
        CREATE TABLE usuarios (id_usuario INT PRIMARY KEY,rol TEXT,estado TEXT);
        CREATE TABLE atletas (id_atleta INT PRIMARY KEY,
            id_representante INT REFERENCES usuarios(id_usuario),estado TEXT);
        CREATE TABLE pagos (id_pago SERIAL PRIMARY KEY,id_atleta INT REFERENCES atletas(id_atleta),
            mes_pagado TEXT,estado_pago TEXT,moneda TEXT,monto NUMERIC(12,2));
        INSERT INTO usuarios VALUES(9,'directiva','aprobado'),(5,'representante','aprobado');
        INSERT INTO atletas VALUES(11,5,'activo');
    `);
    for(const file of [
        '2026-11-12_cuentas_por_cobrar_base.sql',
        '2026-11-12_catalogo_y_tasas_cobro.sql',
        '2026-11-13_referencias_cambio_cache.sql'
    ])await db.pool.query(fs.readFileSync(
        path.join(__dirname,'../migrations',file),'utf8'));
});
test.after(async()=>{
    global.fetch=fetchAnterior;
    if(claveAnterior===undefined)delete process.env.EXCHANGERATE_API_KEY;
    else process.env.EXCHANGERATE_API_KEY=claveAnterior;
    try{if(existe)await db.pool.query(`DROP SCHEMA ${schema} CASCADE`);}
    finally{await db.pool.end();}
});

test('solo Directiva/Admin pueden consultar y publicar',async()=>{
    const rep={usuarioRol:'representante',usuarioId:5};
    assert.equal((await invocar(controller.consultar,rep)).codigo,403);
    assert.equal((await invocar(controller.publicarBCV,{
        ...rep,body:{confirmar:true}
    })).codigo,403);
    assert.equal(bcvLlamadas,0);
    assert.equal(mercadoLlamadas,0);
});

test('caché persistente impide nuevas peticiones al repetir el mismo día',async()=>{
    const primera=await invocar(controller.consultar,admin);
    assert.equal(primera.codigo,200);
    assert.equal(primera.body.bcv.usd_ves,'980.123456');
    assert.equal(primera.body.bcv.eur_ves,'1140.654321');
    assert.equal(primera.body.mercado.usd_ves,'970.120000');
    assert.equal(primera.body.bcv.desde_cache,false);
    assert.equal(bcvLlamadas,1);
    assert.equal(mercadoLlamadas,1);
    const segunda=await invocar(controller.consultar,admin);
    assert.equal(segunda.codigo,200);
    assert.equal(segunda.body.bcv.desde_cache,true);
    assert.equal(segunda.body.mercado.desde_cache,true);
    assert.equal(bcvLlamadas,1);
    assert.equal(mercadoLlamadas,1);
    const {rows}=await db.pool.query('SELECT proveedor FROM referencias_cambio_diarias');
    assert.equal(rows.length,2);
    assert.deepEqual(rows.map(x=>x.proveedor).sort(),
        ['bcv_republicacion','exchangerate_api']);
});

test('BCV guardado únicamente tras confirmar y sin duplicados',async()=>{
    const sin=await invocar(controller.publicarBCV,{
        ...admin,body:{confirmar:false}
    });
    assert.equal(sin.codigo,400);
    assert.equal((await db.pool.query('SELECT * FROM tasas_cobro')).rowCount,0);
    const publicado=await invocar(controller.publicarBCV,{
        ...admin,body:{confirmar:true}
    });
    assert.equal(publicado.codigo,201);
    assert.equal(publicado.body.tasa.moneda,'Bs');
    assert.equal(publicado.body.tasa.tasa_por_usd,'980.123456');
    assert.match(publicado.body.tasa.fuente,/bcv\.today/);
    const repetido=await invocar(controller.publicarBCV,{
        ...admin,body:{confirmar:true}
    });
    assert.equal(repetido.codigo,200);
    assert.equal(repetido.body.reutilizada,true);
    assert.equal((await db.pool.query('SELECT * FROM tasas_cobro')).rowCount,1);
    assert.equal(bcvLlamadas,1);
});

test('precios inválidos se rechazan y constraint DB protege el catálogo',async()=>{
    for(const monto_usd of ['1000','12000','10.999','1e2','0','-1','999.991']){
        const r=await invocar(catalogo.crear,{...admin,body:{
            codigo:'precio_invalido',nombre:'Precio inválido',monto_usd
        }});
        assert.equal(r.codigo,400,monto_usd);
    }
    const valido=await invocar(catalogo.crear,{...admin,body:{
        codigo:'precio_valido',nombre:'Precio válido',monto_usd:'999.99'
    }});
    assert.equal(valido.codigo,201);
    assert.equal((await invocar(catalogo.editar,{...admin,params:{
        codigo:'precio_valido'},body:{nombre:'Precio válido',
            monto_usd:'1000',activo:true}})).codigo,400);
    await assert.rejects(db.pool.query(`
        UPDATE conceptos_cobro SET monto_referencia_usd=1000
        WHERE codigo='precio_valido'`),error=>error.code==='23514');
});

test('valor comercial nunca se guarda como fuente BCV',async()=>{
    const {rows}=await db.pool.query('SELECT fuente FROM tasas_cobro');
    assert.equal(rows.length,1);
    assert.ok(rows.every(x=>!x.fuente.includes('ExchangeRate-API')));
});
