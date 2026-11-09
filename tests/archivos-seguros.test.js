'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { validarContenidoArchivo, storageConValidacion, LIMITE_ARCHIVO } =
    require('../utils/archivosSeguros');
const { validarMagicBytes } = require('../middlewares/uploadMiddleware');

const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=',
    'base64'
);
const PDF = Buffer.from('%PDF-1.4\nDOCUMENTO SINTETICO\n%%EOF');
const TEXTO = Buffer.from('contenido ajeno que finge ser una imagen PNG');

function archivo(nombre, mimetype, fieldname = 'foto') {
    return { fieldname, originalname: nombre, mimetype };
}

test('firmas: acepta PNG y PDF sintéticos reales con extensión/MIME compatibles', async () => {
    assert.equal(await validarContenidoArchivo(PNG, archivo('foto.PNG', 'image/png'), ['png']), true);
    assert.equal(await validarContenidoArchivo(PDF, archivo('partida.PDF', 'application/pdf'), ['pdf']), true);
    assert.equal(await validarContenidoArchivo(PDF, archivo('partida.pdf', 'application/x-pdf'), ['pdf']), true);
});

test('firmas: ignora etiquetas inventadas y bloquea archivos mal tipados', async () => {
    const firmas = [
        [TEXTO, 'foto.png', 'image/png', ['png']],
        [PDF, 'foto.png', 'image/png', ['png']],
        [PNG, 'foto.pdf', 'application/pdf', ['pdf']],
        [PNG, 'foto.txt', 'image/png', ['png']],
        [PNG, 'foto.png', 'application/pdf', ['png']],
        [Buffer.alloc(0), 'foto.png', 'image/png', ['png']],
        [PNG, 'foto.png', 'image/png', ['pdf']],
        [Buffer.alloc(LIMITE_ARCHIVO + 1), 'foto.png', 'image/png', ['png']]
    ];
    for (const [buffer, nombre, mime, permitidas] of firmas) {
        assert.equal(await validarContenidoArchivo(buffer, archivo(nombre, mime), permitidas), false,
            nombre + ' debe rechazarse');
    }
});

function crearStorageDePrueba() {
    const enviados = [];
    const storage = {
        _handleFile(req, file, callback) {
            (async () => {
                const partes = [];
                for await (const chunk of file.stream) partes.push(chunk);
                enviados.push(Buffer.concat(partes));
                callback(null, {filename:'verificado', path:'https://example.invalid/prueba'});
            })().catch(callback);
        },
        _removeFile(req, file, callback) { callback(null); }
    };
    return { enviados, storage: storageConValidacion(storage, {
        foto: ['jpg','png','webp'],
        partida_nacimiento: ['jpg','png','webp','pdf']
    }) };
}

function intentarSubida(storage, buffer, originalname, mimetype, fieldname = 'foto', truncado = false) {
    return new Promise(resolve => {
        const stream = Readable.from([buffer]);
        stream.truncated = truncado;
        storage._handleFile({}, {stream, ...archivo(originalname,mimetype,fieldname)}, (error, info) => {
            resolve({error, info});
        });
    });
}

test('Multer/Cloudinary: archivos falsos nunca llegan al proveedor externo', async () => {
    const { storage, enviados } = crearStorageDePrueba();
    for (const [buffer, nombre, mime, campo] of [
        [TEXTO, 'falsa.png', 'image/png', 'foto'],
        [PDF, 'foto.jpg', 'image/jpeg', 'foto'],
        [PNG, 'foto.png', 'image/png', 'partida_ajena'],
    ]) {
        const {error, info} = await intentarSubida(storage, buffer, nombre, mime, campo);
        assert.ok(error);
        assert.equal(info, undefined);
    }
    assert.equal(enviados.length, 0);
});

test('Multer/Cloudinary: validación ocurre antes de delegar y marca subidas verificadas', async () => {
    const {storage, enviados} = crearStorageDePrueba();
    const ok = await intentarSubida(storage, PDF, 'partida.pdf', 'application/pdf','partida_nacimiento');
    assert.equal(ok.error, null);
    assert.equal(ok.info.firmaValidada, true);
    assert.deepEqual(enviados[0], PDF);
    assert.equal(await validarMagicBytes(ok.info), true);
    assert.equal(await validarMagicBytes({filename:'archivo-no-verificado'}), false);
    assert.equal(await validarMagicBytes(null), false);
});

test('Multer/Cloudinary: límites y flujos truncados se rechazan antes del upload', async () => {
    const {storage, enviados} = crearStorageDePrueba();
    const grande = await intentarSubida(storage, Buffer.alloc(LIMITE_ARCHIVO + 1), 'foto.png','image/png');
    assert.equal(grande.error.code,'LIMIT_FILE_SIZE');
    const truncado = await intentarSubida(storage, PNG, 'foto.png','image/png', 'foto', true);
    assert.equal(truncado.error.code,'LIMIT_FILE_SIZE');
    assert.equal(enviados.length,0);
});


test('Multer: subidas privadas retornan la URL canónica a los controladores', async () => {
    const anterior = process.env.CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_CLOUD_NAME = 'nube-sintetica';
    try {
        const { normalizarUploadPrivado, analizarAssetGuardado } =
            require('../utils/cloudinaryPrivado');
        const guardar = {
            _handleFile(req,file,cb) {
                (async () => {
                    for await (const _ of file.stream) { /* consumir el archivo de prueba */ }
                    cb(null,{
                        filename:'jaguares/atletas/foto_sintetica_1',
                        path:'https://res.cloudinary.com/nube-sintetica/image/authenticated/v456/' +
                            'otra_carpeta/foto_sintetica_1.png'
                    });
                })().catch(cb);
            }
        };
        const almacen = storageConValidacion(guardar, {foto:['png']},
            (info,file) => normalizarUploadPrivado(info,file,'jaguares/atletas'));
        const {error,info} = await intentarSubida(almacen, PNG, 'foto.png','image/png');
        assert.equal(error,null);
        assert.equal(info.firmaValidada,true);
        assert.equal(info.filename,'jaguares/atletas/foto_sintetica_1');
        assert.equal(info.path,'https://res.cloudinary.com/nube-sintetica/' +
            'image/authenticated/v456/jaguares/atletas/foto_sintetica_1.png');
        assert.equal(analizarAssetGuardado(info.path,'jaguares/atletas').delivery_type,'authenticated');
    } finally {
        if (anterior === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
        else process.env.CLOUDINARY_CLOUD_NAME = anterior;
    }
});

test('Multer: un upload privado sin public_id válido falla cerrado, sin guardar URL', async () => {
    const anterior=process.env.CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_CLOUD_NAME='nube-sintetica';
    try {
        const {normalizarUploadPrivado}=require('../utils/cloudinaryPrivado');
        const guardar={
            _handleFile(req,file,cb) {
                (async()=>{
                    for await(const _ of file.stream) {}
                    cb(null,{
                        filename:'carpeta_ajena/foto_sintetica',
                        path:'https://res.cloudinary.com/nube-sintetica/image/authenticated/v456/' +
                            'otra_carpeta/foto_sintetica.png'
                    });
                })().catch(cb);
            }
        };
        const almacen=storageConValidacion(guardar,{foto:['png']},
            (info,file)=>normalizarUploadPrivado(info,file,'jaguares/atletas'));
        const {error,info}=await intentarSubida(almacen,PNG,'foto.png','image/png');
        assert.equal(error.message,'No se pudo verificar la referencia del archivo privado');
        assert.equal(info,undefined);
        assert.doesNotMatch(error.message,/carpeta_ajena|foto_sintetica|cloudinary/);
    } finally {
        if(anterior===undefined)delete process.env.CLOUDINARY_CLOUD_NAME;
        else process.env.CLOUDINARY_CLOUD_NAME=anterior;
    }
});

test('Multer: sin normalizador mantiene las URL públicas históricas', async () => {
    const {storage}=crearStorageDePrueba();
    const {error,info}=await intentarSubida(storage,PNG,'foto.png','image/png');
    assert.equal(error,null);
    assert.equal(info.path,'https://example.invalid/prueba');
    assert.equal(info.filename,'verificado');
    assert.equal(info.firmaValidada,true);
});
