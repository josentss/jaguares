'use strict';

const db=require('../config/db');
const {hoyCaracas}=require('../utils/cobrosMensuales');
const {obtenerReferencias,diasEntre,MAX_EDAD_BCV_DIAS}=require('../utils/referenciasCambio');
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

// El GET nunca publica tasas de cobro: únicamente almacena referencias externas
// en una tabla independiente, una vez por día/proveedor.
exports.consultar=async(req,res)=>{
    if(!autorizado(req,res))return;
    try{
        const referencias=await obtenerReferencias();
        res.set?.('Cache-Control','private, no-store');
        return res.json({success:true,...referencias});
    }catch(error){return fallo(res,error);}
};

// La confirmación escribe en tasas_cobro, que es inmutable por trigger.
// No confundir referencia comercial de ExchangeRate-API con datos BCV.
exports.publicarBCV=async(req,res)=>{
    if(!autorizado(req,res))return;
    if(req.body?.confirmar!==true)return res.status(400).json({
        success:false,message:'Confirma la tasa BCV antes de publicarla'
    });
    const hoy=hoyCaracas();
    let client,committed=false;
    try {
        client=await db.pool.connect();
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',
            ['jaguares:publicar-bcv:'+hoy]);
        const r=await client.query(`
            SELECT fecha_referencia,usd_ves
            FROM referencias_cambio_diarias
            WHERE proveedor='bcv_republicacion' AND fecha_consulta=$1
        `,[hoy]);
        if(!r.rowCount)return res.status(409).json({
            success:false,message:'Consulta primero la referencia BCV de hoy'
        });
        const ref=r.rows[0];
        if(diasEntre(ref.fecha_referencia,hoy)<0||
            diasEntre(ref.fecha_referencia,hoy)>MAX_EDAD_BCV_DIAS){
            return res.status(409).json({
                success:false,message:'Referencia desactualizada: no se puede publicar'
            });
        }
        const fuente='BCV republicado por bcv.today (vigencia '+ref.fecha_referencia+')';
        // Si ya fue publicada esta referencia exacta, devolverla sin duplicarla.
        const publicada=await client.query(`
            SELECT id_tasa,fecha_vigencia,tasa_por_usd,fuente
            FROM tasas_cobro WHERE moneda='Bs' AND fecha_vigencia=$1
                AND tasa_por_usd=$2 AND fuente=$3
            ORDER BY id_tasa DESC LIMIT 1
        `,[hoy,ref.usd_ves,fuente]);
        if(publicada.rowCount){
            await client.query('COMMIT');committed=true;
            return res.json({success:true,tasa:publicada.rows[0],reutilizada:true});
        }
        const guardada=await client.query(`
            INSERT INTO tasas_cobro
                (moneda,fecha_vigencia,tasa_por_usd,fuente,creado_por)
            VALUES ('Bs',$1,$2,$3,$4)
            RETURNING id_tasa,moneda,fecha_vigencia,tasa_por_usd,fuente
        `,[hoy,ref.usd_ves,fuente,req.usuarioId]);
        await client.query('COMMIT');committed=true;
        res.set?.('Cache-Control','no-store');
        return res.status(201).json({success:true,tasa:guardada.rows[0],reutilizada:false});
    }catch(error){return fallo(res,error);}
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
