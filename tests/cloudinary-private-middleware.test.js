'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const express = require('express');

// Proceso aislado de test: activa el flag antes de cargar los middlewares.
// El mock evita conexiones con Cloudinary/Supabase; ejercita Multer real,
// CloudinaryStorage real, validación binaria y el normalizador del PR.
process.env.CLOUDINARY_AUTHENTICATED_UPLOADS = '1';
process.env.CLOUDINARY_CLOUD_NAME = 'nube-sintetica';
process.env.CLOUDINARY_API_KEY = 'publica-sintetica';
process.env.CLOUDINARY_API_SECRET = 'secreta-sintetica';
const cloudinary = require('cloudinary').v2;
const originalUpload = cloudinary.uploader.upload_stream;
let contador = 0;
const opcionesCapturadas = [];

cloudinary.uploader.upload_stream = (opciones, callback) => {
    opcionesCapturadas.push(opciones);
    const indice = ++contador;
    const carpeta = opciones.folder;
    const recurso = opciones.resource_type === 'auto' ? 'image' : (opciones.resource_type || 'image');
    const extension = opciones.folder === 'jaguares_comprobantes' ? 'png' :
        indice === 3 ? 'pdf' : 'png';
    const publicId = carpeta + '/archivo_sintetico_' + indice;
    return new Writable({
        write(chunk, encoding, done) {done();},
        final(done) {
            callback(null, {
                bytes: 100,
                public_id: publicId,
                secure_url: 'https://res.cloudinary.com/nube-sintetica/' +
                    recurso + '/authenticated/v123456/otra_carpeta/archivo_sintetico_' +
                    indice + '.' + extension,
                format: extension, version: 123456,
                resource_type: recurso, type: 'authenticated'
            });
            done();
        }
    });
};

const {upload, uploadAtletaFields} = require('../middlewares/uploadMiddleware');
const {analizarAssetAutenticado, enlaceAutorizado} = require('../utils/cloudinaryPrivado');
const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=',
    'base64'
);
const pdf = Buffer.from('%PDF-1.4\nDOCUMENTO SINTETICO\n%%EOF');
const app = express();
app.post('/captura',upload.single('captura'),(req,res) => {
    res.json({path:req.file.path,filename:req.file.filename,validado:req.file.firmaValidada});
});
app.post('/atleta',uploadAtletaFields,(req,res) => {
    res.json(Object.fromEntries(Object.entries(req.files).map(([tipo,files]) =>
        [tipo,{path:files[0].path,filename:files[0].filename,validado:files[0].firmaValidada}])));
});
let server,base;
test.before(async()=>{
    server=await new Promise(resolve=>{
        const listening=app.listen(0,'127.0.0.1',()=>resolve(listening));
    });
    base='http://127.0.0.1:'+server.address().port;
});
test.after(async()=>{
    if(server) await new Promise(resolve=>server.close(resolve));
    cloudinary.uploader.upload_stream=originalUpload;
});

test('flujo privado real de Multer: comprobante conserva URL canónica firmable',async()=>{
    const form=new FormData();
    form.append('captura',new Blob([png],{type:'image/png'}),'comprobante.png');
    const respuesta=await fetch(base+'/captura',{method:'POST',body:form});
    assert.equal(respuesta.status,200);
    const resultado=await respuesta.json();
    assert.equal(resultado.validado,true);
    assert.equal(resultado.filename,'jaguares_comprobantes/archivo_sintetico_1');
    assert.equal(resultado.path,'https://res.cloudinary.com/nube-sintetica/image/' +
        'authenticated/v123456/jaguares_comprobantes/archivo_sintetico_1.png');
    assert.equal(analizarAssetAutenticado(resultado.path,'jaguares_comprobantes').public_id,
        resultado.filename);
    const signed=new URL(enlaceAutorizado(resultado.path,'jaguares_comprobantes'));
    assert.equal(signed.searchParams.get('public_id'),resultado.filename);
    assert.equal(signed.searchParams.get('format'),'png');
});

test('flujo privado real de Multer: atleta foto y PDF quedan con URL canónica',async()=>{
    const form=new FormData();
    form.append('foto',new Blob([png],{type:'image/png'}),'foto.png');
    form.append('partida_nacimiento',new Blob([pdf],{type:'application/pdf'}),'partida.pdf');
    const respuesta=await fetch(base+'/atleta',{method:'POST',body:form});
    assert.equal(respuesta.status,200);
    const data=await respuesta.json();
    for(const [campo,formato] of [['foto','png'],['partida_nacimiento','pdf']]) {
        const item=data[campo];
        assert.equal(item.validado,true);
        const info=analizarAssetAutenticado(item.path,'jaguares/atletas');
        assert.equal(info.public_id,item.filename);
        assert.equal(info.format,formato);
        assert.equal(new URL(enlaceAutorizado(item.path,'jaguares/atletas'))
            .searchParams.get('format'),formato);
        assert.ok(item.path.startsWith('https://res.cloudinary.com/nube-sintetica/' +
            'image/authenticated/v123456/jaguares/atletas/'));
    }
    assert.ok(opcionesCapturadas.every(x=>x.type==='authenticated'));
    assert.equal(opcionesCapturadas.length,3);
});
