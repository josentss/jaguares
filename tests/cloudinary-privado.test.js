'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.CLOUDINARY_CLOUD_NAME = 'nube-sintetica';
process.env.CLOUDINARY_API_KEY = 'clave-publica-sintetica';
process.env.CLOUDINARY_API_SECRET = 'secreto-local-sintetico';
const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const { analizarAssetAutenticado, analizarAssetGuardado, enlaceAutorizado, normalizarUploadPrivado, esCargaPrivadaHabilitada } =
    require('../utils/cloudinaryPrivado');

const prefijo = 'https://res.cloudinary.com/nube-sintetica';
const foto = prefijo + '/image/authenticated/v123/jaguares/atletas/foto-sintetica.png';
const recibo = prefijo + '/image/authenticated/v123/jaguares_comprobantes/recibo.jpg';

test('cloudinary: se reconocen solo recursos authenticated de carpetas permitidas', () => {
    assert.deepEqual(analizarAssetAutenticado(foto, 'jaguares/atletas'), {
        public_id: 'jaguares/atletas/foto-sintetica',
        format: 'png', resource_type: 'image', type: 'authenticated'
    });
    assert.deepEqual(analizarAssetAutenticado(recibo, 'jaguares_comprobantes'), {
        public_id: 'jaguares_comprobantes/recibo',
        format: 'jpg', resource_type: 'image', type: 'authenticated'
    });
    assert.equal(analizarAssetAutenticado(foto, 'jaguares_comprobantes'), null);
    for (const malicioso of [
        'https://evil.invalid/image/authenticated/v1/jaguares/atletas/foto.png',
        prefijo + '/image/upload/v1/jaguares/atletas/foto.png',
        prefijo + '/image/authenticated/v1/otros/foto.png',
        prefijo + '/image/authenticated/v1/jaguares/atletas/archivo.svg',
        prefijo + '/image/authenticated/v1/jaguares/atletas/foto.png?token=ajeno',
        prefijo + '/video/authenticated/v1/jaguares/atletas/foto.png'
    ]) {
        assert.equal(analizarAssetAutenticado(malicioso, 'jaguares/atletas'), null);
    }
});

test('cloudinary: firma temporal y límites explícitos para archivos autenticados', () => {
    const fecha = Date.UTC(2026, 10, 7, 14, 0, 0);
    const firmado = enlaceAutorizado(foto, 'jaguares/atletas', fecha);
    assert.match(firmado, /^https:\/\/api\.cloudinary\.com\/v1_1\/nube-sintetica\/image\/download\?/);
    const parsed = new URL(firmado);
    assert.equal(parsed.searchParams.get('expires_at'), String(fecha / 1000 + 120));
    assert.ok(parsed.searchParams.get('signature'));
    assert.equal(parsed.searchParams.get('public_id'), 'jaguares/atletas/foto-sintetica');
    assert.equal(parsed.searchParams.get('format'), 'png');
    assert.equal(enlaceAutorizado(prefijo + '/image/upload/v1/jaguares/atletas/legado.jpg',
        'jaguares/atletas', fecha),
        prefijo + '/image/upload/v1/jaguares/atletas/legado.jpg');
});

test('cloudinary: la activación de privados requiere valor explícito', () => {
    const antes = process.env.CLOUDINARY_AUTHENTICATED_UPLOADS;
    try {
        delete process.env.CLOUDINARY_AUTHENTICATED_UPLOADS;
        assert.equal(esCargaPrivadaHabilitada(), false);
        process.env.CLOUDINARY_AUTHENTICATED_UPLOADS = '1';
        assert.equal(esCargaPrivadaHabilitada(), true);
    } finally {
        if (antes === undefined) delete process.env.CLOUDINARY_AUTHENTICATED_UPLOADS;
        else process.env.CLOUDINARY_AUTHENTICATED_UPLOADS = antes;
    }
});


test('cloudinary: reconocer recursos públicos históricos solo de carpeta y nube permitidas', () => {
    const url = prefijo + '/image/upload/v123/jaguares/atletas/foto-legada.jpg';
    assert.deepEqual(analizarAssetGuardado(url, 'jaguares/atletas'), {
        public_id: 'jaguares/atletas/foto-legada',
        format: 'jpg',
        resource_type: 'image',
        delivery_type: 'upload'
    });
    assert.equal(enlaceAutorizado(url, 'jaguares/atletas'), url);
    assert.equal(analizarAssetGuardado(prefijo + '/raw/upload/v22/jaguares/atletas/partida.pdf',
        'jaguares/atletas').public_id, 'jaguares/atletas/partida.pdf');
    assert.equal(analizarAssetGuardado(foto, 'jaguares/atletas').delivery_type, 'authenticated');
});

test('cloudinary: nunca redirigir hacia origen externo, carpeta ajena o URL manipulada', () => {
    for (const url of [
        'https://example.org/comprobante.pdf',
        'http://res.cloudinary.com/nube-sintetica/image/upload/jaguares/atletas/foto.jpg',
        'https://evil.invalid/image/upload/jaguares/atletas/foto.jpg',
        'https://res.cloudinary.com/otro-cloud/image/upload/jaguares/atletas/foto.jpg',
        prefijo + '/image/upload/v1/otra-carpeta/documento.jpg',
        prefijo + '/image/upload/c_scale,w_200/v1/jaguares/atletas/foto.jpg',
        prefijo + '/image/upload/v1/jaguares/atletas/documento.svg',
        prefijo + '/image/upload/v1/jaguares/atletas/foto.jpg?foo=bar',
        prefijo + '/image/private/v1/jaguares/atletas/foto.jpg',
        prefijo + '/image/upload/v1/jaguares/atletas/%2e%2e/foto.jpg',
        'javascript:alert(1)'
    ]) {
        assert.equal(analizarAssetGuardado(url, 'jaguares/atletas'), null, url);
        assert.throws(() => enlaceAutorizado(url, 'jaguares/atletas'), /Origen de archivo no permitido/);
    }
});


test('auditoría: resume referencias anonimizadas sin publicar links o identificadores', () => {
    const { resumir, clasificar } = require('../scripts/auditar-cloudinary');
    const publico = prefijo + '/image/upload/v123/jaguares/atletas/atleta-sintetico.png';
    const privado = prefijo + '/image/authenticated/v123/jaguares/atletas/atleta-sintetico.pdf';
    assert.equal(clasificar(publico, 'jaguares/atletas'), 'publico');
    assert.equal(clasificar(privado, 'jaguares/atletas'), 'autenticado');
    const salida = resumir([
        ['fotos', 'jaguares/atletas', [publico, privado, null, 'https://example.org/personal.png']],
        ['comprobantes', 'jaguares_comprobantes', ['jaguares_comprobantes/recibo.jpg']]
    ]);
    assert.equal(salida.fotos.total, 4);
    assert.equal(salida.fotos.publico, 1);
    assert.equal(salida.fotos.autenticado, 1);
    assert.equal(salida.fotos.sin_archivo, 1);
    assert.equal(salida.fotos.revisar_manual, 1);
    assert.equal(salida.comprobantes.referencia_legacy_sin_url, 1);
    assert.doesNotMatch(JSON.stringify(salida), /atleta-sintetico|recibo\.jpg|example\.org/);
});


test('inventario de terminal carga .env local sin abrir conexión ni imprimir secretos', () => {
    const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
    const { tmpdir } = require('node:os');
    const { join, resolve } = require('node:path');
    const { spawnSync } = require('node:child_process');
    const carpeta = mkdtempSync(join(tmpdir(), 'jaguares-env-prueba-'));
    try {
        writeFileSync(join(carpeta, '.env'),
            'CLOUDINARY_CLOUD_NAME=nube-prueba-local\nDATABASE_URL=postgres://prueba.invalid/base\n');
        const env = { ...process.env };
        delete env.CLOUDINARY_CLOUD_NAME;
        delete env.DATABASE_URL;
        const resultado = spawnSync(process.execPath, [
            '-e',
            "require(process.argv[1]);process.stdout.write(process.env.CLOUDINARY_CLOUD_NAME + '|' + process.env.DATABASE_URL)",
            resolve(__dirname, '../scripts/auditar-cloudinary.js')
        ], { cwd: carpeta, env, encoding: 'utf8', timeout: 10000 });
        assert.equal(resultado.status, 0, resultado.stderr);
        assert.equal(resultado.stdout,
            'nube-prueba-local|postgres://prueba.invalid/base');
    } finally {
        rmSync(carpeta, { recursive: true, force: true });
    }
});


test('inventario: clasifica red, credenciales y esquema sin revelar errores de PostgreSQL', () => {
    const { clasificarError, tipoConexion, diagnosticoEntorno } = require('../utils/diagnosticoInventario');
    assert.equal(clasificarError({ code: '28P01', message:'contraseña privada' }).categoria, 'AUTENTICACION');
    assert.equal(clasificarError({ code: '42P01', detail:'dato personal' }, 'consulta_atletas').categoria, 'TABLA_FALTANTE');
    assert.equal(clasificarError({ code: '42501' }, 'consulta_pagos').categoria, 'PERMISOS');
    assert.equal(clasificarError({ code: 'ENOTFOUND' }).categoria, 'DNS');
    assert.equal(clasificarError({ code: 'ETIMEDOUT' }).categoria, 'TIEMPO_AGOTADO');
    const compuesto = new AggregateError([Object.assign(new Error('URL secreta'), {
        code: 'ENETUNREACH'
    })], 'falló con credenciales');
    const diagnostico = clasificarError(compuesto);
    assert.equal(diagnostico.categoria, 'RED_NO_ALCANZABLE');
    assert.doesNotMatch(JSON.stringify(diagnostico), /URL secreta|credenciales/);

    assert.equal(tipoConexion('postgresql://u:secreto@db.ejemplo.supabase.co:5432/postgres'),
        'directa_ipv6_habitual');
    assert.equal(tipoConexion('postgresql://u:secreto@aws-0-us-east-1.pooler.supabase.com:5432/postgres'),
        'pooler_sesion_ipv4');
    assert.equal(tipoConexion('postgresql://u:secreto@aws-0-us-east-1.pooler.supabase.com:6543/postgres'),
        'pooler_transaccion_ipv4');
    assert.equal(tipoConexion('no-es-postgres'), 'configuracion_invalida');
    const entorno = diagnosticoEntorno({
        DATABASE_URL:'postgresql://u:CLAVE_SINTETICA@db.ejemplo.supabase.co:5432/postgres',
        CLOUDINARY_CLOUD_NAME:'nube-sintetica'
    });
    assert.equal(entorno.database_url, 'presente');
    assert.equal(entorno.tipo_conexion, 'directa_ipv6_habitual');
    assert.doesNotMatch(JSON.stringify(entorno), /CLAVE_SINTETICA|db\.ejemplo/);
});

test('inventario: solo lectura, una conexión y resultado agregado sin URL ni identificadores', async () => {
    const { auditar } = require('../scripts/auditar-cloudinary');
    const operaciones = [];
    const cliente = {
        async connect() { operaciones.push('connect'); },
        async query(sql) {
            operaciones.push(sql);
            if (sql.includes('FROM atletas')) {
                return {rows: [{
                    foto_url: prefijo + '/image/upload/v1/jaguares/atletas/sintetica.jpg',
                    cedula_archivo_url: null, partida_nacimiento_url: null
                }]};
            }
            if (sql.includes('FROM pagos')) {
                return {rows:[{ruta_captura:prefijo + '/image/authenticated/v1/jaguares_comprobantes/recibo.jpg'}]};
            }
            return {rows:[]};
        },
        async end() { operaciones.push('end'); }
    };
    let salida = '';
    const colecciones = await auditar({
        entorno:{
            DATABASE_URL:'postgresql://prueba:SECRETO_INVENTADO@db.ejemplo.supabase.co:5432/postgres',
            CLOUDINARY_CLOUD_NAME:'nube-sintetica'
        },
        crearCliente: () => cliente,
        escribir: t => { salida += t; }
    });
    assert.equal(colecciones.fotos.publico, 1);
    assert.equal(colecciones.comprobantes.autenticado, 1);
    assert.deepEqual(operaciones, [
        'connect', 'BEGIN READ ONLY',
        'SELECT foto_url, cedula_archivo_url, partida_nacimiento_url FROM atletas',
        'SELECT ruta_captura FROM pagos', 'ROLLBACK', 'end'
    ]);
    assert.doesNotMatch(salida,/SECRETO_INVENTADO|res\.cloudinary\.com|sintetica\.jpg|recibo\.jpg/);
});

test('inventario: cierra la sesión y vuelve atrás al fallar consulta sin revelar SQL ni secretos', async () => {
    const { auditar } = require('../scripts/auditar-cloudinary');
    const operaciones = [];
    const cliente = {
        async connect() { operaciones.push('connect'); },
        async query(sql) {
            operaciones.push(sql);
            if (sql.startsWith('SELECT')) {
                throw Object.assign(new Error('Credenciales/URLs privadas en mensaje'), {code:'42P01'});
            }
            return {rows:[]};
        },
        async end() { operaciones.push('end'); }
    };
    await assert.rejects(() => auditar({
        entorno:{
            DATABASE_URL:'postgresql://prueba:CLAVE_SECRETA@db.ejemplo.supabase.co:5432/postgres',
            CLOUDINARY_CLOUD_NAME:'nube-sintetica'
        },
        crearCliente: () => cliente
    }), error => {
        assert.equal(error.categoria,'TABLA_FALTANTE');
        assert.equal(error.fase,'consulta_atletas');
        assert.doesNotMatch(String(error), /Credenciales|CLAVE_SECRETA|SQL/);
        return true;
    });
    assert.equal(operaciones.filter(op => op === 'ROLLBACK').length, 1);
    assert.equal(operaciones.at(-1), 'end');
});

test('inventario: error de conexión agrupado conserva diagnóstico seguro y libera cliente', async () => {
    const { auditar } = require('../scripts/auditar-cloudinary');
    let cerrado = false;
    await assert.rejects(() => auditar({
        entorno:{
            DATABASE_URL:'postgresql://prueba:CLAVE_SECRETA@db.ejemplo.supabase.co:5432/postgres',
            CLOUDINARY_CLOUD_NAME:'nube-sintetica'
        },
        crearCliente:()=>({
            async connect() {
                throw new AggregateError([
                    Object.assign(new Error('no mostrar url'),{code:'ENETUNREACH'})
                ],'secreto');
            },
            async end() { cerrado = true; }
        })
    }), err => err.categoria === 'RED_NO_ALCANZABLE' &&
        err.fase === 'conexion' && !String(err).includes('secreto'));
    assert.equal(cerrado,true);
});


test('uploads privados: Cloudinary devuelve carpeta distinta, pero filename permite URL canónica firmable', () => {
    const original = {
        filename: 'jaguares/atletas/atleta_sintetico',
        path: prefijo + '/image/authenticated/v123/otra_carpeta/atleta_sintetico.png',
        size: 1250
    };
    const file = {originalname:'foto.png', mimetype:'image/png', fieldname:'foto'};
    const resultado = normalizarUploadPrivado(original,file,'jaguares/atletas');
    assert.equal(resultado.path,
        prefijo + '/image/authenticated/v123/jaguares/atletas/atleta_sintetico.png');
    assert.equal(resultado.filename, original.filename);
    assert.equal(resultado.size, original.size);
    assert.equal(resultado.secure_url, resultado.path);
    assert.equal(analizarAssetGuardado(resultado.path,'jaguares/atletas').public_id,
        original.filename);
    const firmado = enlaceAutorizado(resultado.path,'jaguares/atletas');
    const consulta = new URL(firmado);
    assert.equal(consulta.searchParams.get('public_id'),original.filename);
    assert.equal(consulta.searchParams.get('format'),'png');
    assert.equal(consulta.searchParams.get('signature')?.length > 5,true);
    assert.equal(original.path.includes('/otra_carpeta/'),true);
});

test('uploads privados: PDF como image y raw, y comprobante usan identidades correctas', () => {
    for(const [info,file,carpeta,publicId,recurso] of [
        [
            {filename:'jaguares/atletas/partida_abc',path:prefijo +
                '/image/authenticated/v333/otra_carpeta/partida.pdf'},
            {originalname:'partida.pdf',mimetype:'application/pdf',fieldname:'partida_nacimiento'},
            'jaguares/atletas','jaguares/atletas/partida_abc','image'
        ],
        [
            {filename:'jaguares/atletas/cedula_abc.pdf',path:prefijo +
                '/raw/authenticated/v222/otra_carpeta/cedula_abc.pdf'},
            {originalname:'cedula.pdf',mimetype:'application/pdf',fieldname:'cedula_archivo'},
            'jaguares/atletas','jaguares/atletas/cedula_abc.pdf','raw'
        ],
        [
            {filename:'jaguares_comprobantes/comprobante_abc',path:prefijo +
                '/image/authenticated/v456/sin_carpeta/comprobante_abc.jpg'},
            {originalname:'comprobante.jpeg',mimetype:'image/jpeg',fieldname:'captura'},
            'jaguares_comprobantes','jaguares_comprobantes/comprobante_abc','image'
        ]
    ]) {
        const ref = normalizarUploadPrivado(info,file,carpeta);
        const asset=analizarAssetGuardado(ref.path,carpeta);
        assert.equal(asset.public_id, publicId);
        assert.equal(asset.resource_type,recurso);
        assert.equal(asset.delivery_type,'authenticated');
        assert.equal(new URL(enlaceAutorizado(ref.path,carpeta)).searchParams.get('public_id'),publicId);
    }
});

test('uploads privados: omisión de versión genera marcador v1, sin perder firma', () => {
    const info={
        filename:'jaguares/atletas/test_456',
        path:prefijo + '/image/authenticated/otra_carpeta/test_456.png'
    };
    const salida=normalizarUploadPrivado(info,{
        originalname:'foto.png', mimetype:'image/png', fieldname:'foto'
    },'jaguares/atletas');
    assert.equal(salida.path,prefijo+'/image/authenticated/v1/jaguares/atletas/test_456.png');
    assert.match(enlaceAutorizado(salida.path,'jaguares/atletas'),/signature=/);
});

test('uploads privados: rechaza público, host externo, carpeta e identidades engañosas', () => {
    const correcto={
        filename:'jaguares/atletas/foto_123',
        path:prefijo+'/image/authenticated/v123/otra_carpeta/foto_123.png'
    };
    const archivo={originalname:'foto.png', mimetype:'image/png', fieldname:'foto'};
    const cambios=[
        {...correcto,filename:'jaguares_comprobantes/foto_123'},
        {...correcto,filename:'jaguares/atletas/../foto_123'},
        {...correcto,filename:'jaguares/atletas//foto_123'},
        {...correcto,filename:'jaguares/atletas/otro.png'},
        {...correcto,path:correcto.path.replace('/authenticated/','/upload/')},
        {...correcto,path:correcto.path.replace('res.cloudinary.com','externo.test')},
        {...correcto,path:correcto.path.replace('nube-sintetica','nube-ajena')},
        {...correcto,path:correcto.path+'?firma=desconocida'},
        {...correcto,path:correcto.path.replace('/image/','/video/')},
        {...correcto,path:'javascript:alert(1)'},
        {...correcto,filename:null}
    ];
    for(const info of cambios) {
        assert.throws(() => normalizarUploadPrivado(info,archivo,'jaguares/atletas'),
            /No se pudo validar la referencia del archivo privado/);
    }
    assert.throws(() => normalizarUploadPrivado(correcto,{
        ...archivo,mimetype:'application/pdf'
    },'jaguares/atletas'));
    assert.throws(() => normalizarUploadPrivado(correcto,{
        ...archivo,originalname:'foto.svg'
    },'jaguares/atletas'));
});
