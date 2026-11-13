'use strict';

const db=require('../config/db');
const {hoyCaracas}=require('../utils/cobrosMensuales');
const {obtenerReferencias,diasEntre}=require('../utils/referenciasCambio');
const ADMIN=new Set(['directiva','admin']);

function autorizado(req,res) {
    if(ADMIN.has(req.usuarioRol))return true;
    res.status(403).json({success:false,message:'No autorizado'});
    return false;
}
function fallo(res,error) {
    if(['42P01','42703'].includes(error.code))return res.status(503).json({
        success:false,message:'Aplica la migración de referencias de cambio'
    });
    console.error('REFERENCIAS_COBRO',error.code||'INTERNAL');
    return res.status(503).json({
        success:false,message:'No se pudieron consultar las referencias'
    });
}

// GET solo consulta y cachea la referencia de ExchangeRate-API,
// sin crear ninguna tasa de cobro.
exports.consultar=async(req,res)=>{
    if(!autorizado(req,res))return;
    try{
        const referencias=await obtenerReferencias();
        res.set?.('Cache-Control','private, no-store');
        return res.json({success:true,...referencias});
    }catch(error){return fallo(res,error);}
};

// Publicación explícita de la referencia comercial que Directiva confirmó
// como tasa operativa del club. El proveedor NO certifica que sea una
// publicación oficial BCV. Los pagos guardan el id de la tasa inmutable.
exports.publicarReferencia=async(req,res)=>{
    if(!autorizado(req,res))return;
    if(req.body?.confirmar!==true)return res.status(400).json({
        success:false,message:'Confirma la tasa antes de registrarla'
    });
    const hoy=hoyCaracas();
    let client,committed=false;
    try {
        client=await db.pool.connect();
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',
            ['jaguares:publicar-exchangerate:'+hoy]);
        const r=await client.query(`
            SELECT fecha_referencia,usd_ves
            FROM referencias_cambio_diarias
            WHERE proveedor='exchangerate_api' AND fecha_consulta=$1
        `,[hoy]);
        if(!r.rowCount){
            return res.status(409).json({
                success:false,message:'Consulta primero ExchangeRate-API para hoy'
            });
        }
        const referencia=r.rows[0];
        const dias=diasEntre(referencia.fecha_referencia,hoy);
        if(!Number.isFinite(dias)||dias<0||dias>3) {
            return res.status(409).json({
                success:false,message:'La referencia está desactualizada o aún no es válida'
            });
        }
        const fuente='ExchangeRate-API (referencia confirmada por Directiva; fecha '+
            referencia.fecha_referencia+')';
        // Dos clics sobre la misma cifra/día devuelven la tasa existente.
        const publicada=await client.query(`
            SELECT id_tasa,moneda,fecha_vigencia,tasa_por_usd,fuente
            FROM tasas_cobro
            WHERE moneda='Bs' AND fecha_vigencia=$1
              AND tasa_por_usd=$2 AND fuente=$3
            ORDER BY id_tasa DESC LIMIT 1
        `,[hoy,referencia.usd_ves,fuente]);
        if(publicada.rowCount){
            await client.query('COMMIT');committed=true;
            return res.json({success:true,tasa:publicada.rows[0],reutilizada:true});
        }
        const guardada=await client.query(`
            INSERT INTO tasas_cobro
                (moneda,fecha_vigencia,tasa_por_usd,fuente,creado_por)
            VALUES ('Bs',$1,$2,$3,$4)
            RETURNING id_tasa,moneda,fecha_vigencia,tasa_por_usd,fuente
        `,[hoy,referencia.usd_ves,fuente,req.usuarioId]);
        await client.query('COMMIT');committed=true;
        res.set?.('Cache-Control','no-store');
        return res.status(201).json({
            success:true,tasa:guardada.rows[0],reutilizada:false
        });
    }catch(err){return fallo(res,err);}
    finally{
        if(client){
            if(!committed){
                try{await client.query('ROLLBACK');}
                catch(e){console.error('REFERENCIA_PUBLICACION_ROLLBACK',e.code||'INTERNAL');}
            }
            client.release();
        }
    }
};
