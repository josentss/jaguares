'use strict';

const db = require('../config/db');
const { esEnteroPositivo, esMontoValido, esFechaISOValida } = require('../utils/validators');
const { hoyCaracas } = require('../utils/cobrosMensuales');

const ADMIN = ['directiva', 'admin'];
const INSTITUCIONALES = new Set(['inscripcion','mensualidad','torneo','arbitraje','sancion']);
const CODIGO = /^[a-z][a-z0-9_]{2,39}$/;

function denegar(res) {
    return res.status(403).json({ success:false, message:'No autorizado' });
}
function fallo(res,err) {
    if (err.code === '23505' || err.code === '23514' || err.code === '23503') {
        return res.status(409).json({ success:false, message:'Existe un registro incompatible o duplicado' });
    }
    if (err.code === '42P01' || err.code === '42703') {
        return res.status(503).json({ success:false, message:'Aplica la migración de catálogo y tasas de cobro' });
    }
    console.error('CATALOGO_COBROS_SQL',err.code || 'INTERNAL');
    return res.status(500).json({ success:false, message:'No se pudo completar la operación' });
}
function validoPrecio(n) {
    return (typeof n === 'string' || typeof n === 'number') &&
        /^\d{1,3}(?:\.\d{1,2})?$/.test(String(n)) &&
        Number(n) >= 0.01 && Number(n) <= 999.99;
}
function validoNombre(n) {
    return typeof n === 'string' && n.trim().length >= 2 &&
        n.trim().length <= 60 && !/[<>\x00-\x1f]/.test(n);
}

exports.listar = async (req,res) => {
    if (!ADMIN.includes(req.usuarioRol)) return denegar(res);
    try {
        const {rows} = await db.pool.query(`
            SELECT codigo, nombre, modalidad, monto_referencia_usd, activo
            FROM conceptos_cobro
            ORDER BY CASE codigo WHEN 'inscripcion' THEN 0
                WHEN 'mensualidad' THEN 1 ELSE 2 END, nombre, codigo
        `);
        res.set?.('Cache-Control','no-store');
        return res.json({ success:true, conceptos:rows });
    } catch(err) {return fallo(res,err);}
};

exports.crear = async (req,res) => {
    if (!ADMIN.includes(req.usuarioRol)) return denegar(res);
    const {codigo,nombre,monto_usd} = req.body || {};
    if (typeof codigo !== 'string' || !CODIGO.test(codigo) ||
        INSTITUCIONALES.has(codigo) || !validoNombre(nombre) || !validoPrecio(monto_usd)) {
        return res.status(400).json({success:false,message:'Indica código, nombre y monto USD válidos'});
    }
    try {
        const {rows} = await db.pool.query(`
            INSERT INTO conceptos_cobro
                (codigo, nombre, modalidad, monto_referencia_usd, activo)
            VALUES ($1,$2,'manual',$3,TRUE)
            RETURNING codigo,nombre,modalidad,monto_referencia_usd,activo
        `,[codigo,nombre.trim(),monto_usd]);
        return res.status(201).json({success:true,concepto:rows[0]});
    } catch(err) {return fallo(res,err);}
};

exports.editar = async (req,res) => {
    if (!ADMIN.includes(req.usuarioRol)) return denegar(res);
    const codigo = req.params.codigo;
    const {nombre,monto_usd,activo} = req.body || {};
    if (!CODIGO.test(codigo) || !validoNombre(nombre) ||
        !validoPrecio(monto_usd) || typeof activo !== 'boolean') {
        return res.status(400).json({success:false,message:'Datos de concepto no válidos'});
    }
    try {
        const {rows} = await db.pool.query(`
            UPDATE conceptos_cobro
            SET nombre=$2,monto_referencia_usd=$3,activo=$4
            WHERE codigo=$1 RETURNING
                codigo,nombre,modalidad,monto_referencia_usd,activo
        `,[codigo,nombre.trim(),monto_usd,activo]);
        if (!rows.length) return res.status(404).json({success:false,message:'Concepto no encontrado'});
        return res.json({success:true,concepto:rows[0]});
    } catch(err) {return fallo(res,err);}
};

exports.listarTasas = async (req,res) => {
    if (!ADMIN.includes(req.usuarioRol)) return denegar(res);
    try {
        const {rows} = await db.pool.query(`
            SELECT id_tasa, moneda, fecha_vigencia,tasa_por_usd,fuente,creado_en
            FROM tasas_cobro ORDER BY fecha_vigencia DESC,id_tasa DESC LIMIT 20
        `);
        res.set?.('Cache-Control','no-store');
        return res.json({success:true,tasas:rows});
    } catch(err) {return fallo(res,err);}
};

exports.registrarTasa = async (req,res) => {
    if (!ADMIN.includes(req.usuarioRol)) return denegar(res);
    const {moneda,fecha_vigencia,tasa_por_usd,fuente} = req.body || {};
    const tasaValida = typeof tasa_por_usd === 'string' || typeof tasa_por_usd === 'number';
    if (!['Bs','COP'].includes(moneda) || !esFechaISOValida(fecha_vigencia) ||
        fecha_vigencia > hoyCaracas() ||
        !tasaValida || !/^\d{1,9}(?:\.\d{1,6})?$/.test(String(tasa_por_usd)) ||
        Number(tasa_por_usd) <= 0 || Number(tasa_por_usd) > 999999999 ||
        typeof fuente !== 'string' || fuente.trim().length < 3 ||
        fuente.trim().length > 120 || /[<>\x00-\x1f]/.test(fuente)) {
        return res.status(400).json({success:false,message:'Moneda, fecha, tasa o fuente no válidas'});
    }
    try {
        const {rows} = await db.pool.query(`
            INSERT INTO tasas_cobro(moneda,fecha_vigencia,tasa_por_usd,fuente,creado_por)
            VALUES ($1,$2,$3,$4,$5)
            RETURNING id_tasa,moneda,fecha_vigencia,tasa_por_usd,fuente
        `,[moneda,fecha_vigencia,tasa_por_usd,fuente.trim(),req.usuarioId]);
        return res.status(201).json({success:true,tasa:rows[0]});
    } catch(err) {return fallo(res,err);}
};

exports.crearCargo = async (req,res) => {
    if (!ADMIN.includes(req.usuarioRol)) return denegar(res);
    const {id_atleta,codigo_concepto,detalle,fecha_vencimiento,fecha_limite,confirmar,historial_revisado} = req.body || {};
    if (!esEnteroPositivo(id_atleta) || typeof codigo_concepto !== 'string' ||
        !CODIGO.test(codigo_concepto) || codigo_concepto === 'mensualidad' ||
        !esFechaISOValida(fecha_vencimiento) || !esFechaISOValida(fecha_limite) ||
        fecha_vencimiento < hoyCaracas() || fecha_limite < fecha_vencimiento ||
        confirmar !== true || (codigo_concepto === 'inscripcion' && historial_revisado !== true) ||
        (detalle !== undefined && (typeof detalle !== 'string' ||
            detalle.trim().length > 160 || /[<>\x00-\x1f]/.test(detalle)))) {
        return res.status(400).json({success:false,message:'Revisa atleta, concepto, fechas y confirmación'});
    }
    let client,committed=false,rechazo;
    try {
        client=await db.pool.connect();
        await client.query('BEGIN');
        const {rows:atletas}=await client.query(`
            SELECT a.estado,u.estado AS rep_estado,u.rol AS rep_rol
            FROM atletas a JOIN usuarios u ON u.id_usuario=a.id_representante
            WHERE a.id_atleta=$1 FOR UPDATE OF a,u
        `,[Number(id_atleta)]);
        if (!atletas.length) rechazo=[404,'Atleta no encontrado'];
        else if (atletas[0].estado !== 'activo' || atletas[0].rep_estado !== 'aprobado' ||
            atletas[0].rep_rol !== 'representante') rechazo=[409,'Atleta no habilitado'];
        const ancla=await client.query('SELECT 1 FROM anclas_cobro_atleta WHERE id_atleta=$1',[Number(id_atleta)]);
        if (!rechazo && !ancla.rowCount) rechazo=[409,'Configura primero el inicio del cobro'];
        const concepto=await client.query(`
            SELECT nombre,monto_referencia_usd,modalidad,activo FROM conceptos_cobro WHERE codigo=$1
        `,[codigo_concepto]);
        if (!rechazo && (!concepto.rowCount || !concepto.rows[0].activo ||
            !['manual','unica'].includes(concepto.rows[0].modalidad))) {
            rechazo=[409,'Concepto no disponible para emisión manual'];
        }
        if (!rechazo) {
            const nuevo=await client.query(`
                INSERT INTO obligaciones_cobro
                    (id_atleta,codigo_concepto,detalle,monto_usd,fecha_emision,
                     fecha_vencimiento,fecha_limite,origen,creado_por)
                VALUES ($1,$2,$3,$4,$5,$6,$7,'directiva',$8)
                RETURNING id_obligacion,codigo_concepto,detalle,monto_usd,
                    fecha_vencimiento,fecha_limite
            `,[Number(id_atleta),codigo_concepto,detalle?.trim() || null,
                concepto.rows[0].monto_referencia_usd,hoyCaracas(),
                fecha_vencimiento,fecha_limite,req.usuarioId]);
            await client.query('COMMIT');committed=true;
            return res.status(201).json({success:true,obligacion:nuevo.rows[0]});
        }
    } catch(err) {return fallo(res,err);}
    finally {
        if(client) {
            if(!committed) {
                try{await client.query('ROLLBACK');}
                catch(e){console.error('CARGOS_ROLLBACK',e.code||'INTERNAL');}
            }
            client.release();
        }
    }
    return res.status(rechazo[0]).json({success:false,message:rechazo[1]});
};
