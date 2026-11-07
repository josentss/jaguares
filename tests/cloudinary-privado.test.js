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
const { analizarAssetAutenticado, analizarAssetGuardado, enlaceAutorizado, esCargaPrivadaHabilitada } =
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
