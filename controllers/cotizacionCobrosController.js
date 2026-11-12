'use strict';
const db = require('../config/db');
const { cotizar } = require('../utils/cotizadorObligaciones');
const { esEnteroPositivo } = require('../utils/validators');

exports.consultar = async (req,res) => {
    if (req.usuarioRol !== 'representante') {
        return res.status(403).json({success:false,message:'No autorizado'});
    }
    const {moneda,fecha} = req.query || {};
    if (!esEnteroPositivo(req.params.id_obligacion)) {
        return res.status(400).json({success:false,message:'Cargo no válido'});
    }
    try {
        const valor=await cotizar(db.pool,{
            id_obligacion:req.params.id_obligacion,
            id_representante:req.usuarioId,
            moneda, fecha_pago:fecha
        });
        if (valor.codigo) {
            return res.status(valor.codigo).json({success:false,message:valor.mensaje});
        }
        res.set?.('Cache-Control','no-store');
        return res.json({
            success:true,id_obligacion:Number(req.params.id_obligacion),
            precio_usd:valor.precio_usd,monto:valor.monto,moneda:valor.moneda,
            tasa_por_usd:valor.tasa_por_usd,fecha_tasa:valor.fecha_tasa,
            fuente:valor.fuente
        });
    } catch(err) {
        if (['42P01','42703'].includes(err.code)) {
            return res.status(503).json({success:false,message:'Tasas de cobro no disponibles'});
        }
        console.error('COTIZACION_COBRO_SQL',err.code||'INTERNAL');
        return res.status(500).json({success:false,message:'No se pudo cotizar'});
    }
};
