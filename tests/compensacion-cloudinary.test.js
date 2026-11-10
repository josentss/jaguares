'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cloudinary = require('cloudinary').v2;
const db = require('../config/db');
const {
    registrarCarga, confirmarCargas, compensarCargas, avisarEstadoIncierto
} = require('../utils/compensacionCloudinary');

const nubeOriginal = process.env.CLOUDINARY_CLOUD_NAME;
const consultaOriginal = db.pool.query;
const destruirOriginal = cloudinary.uploader.destroy;
const avisarOriginal = console.warn;
const advertencias = [];
const destruidos = [];
let filas = [{ referenciado: false }];
let errorSql = null;
let errorProveedor = null;

const info = (carpeta, tipo = 'authenticated', nombre = 'archivo-sintetico-001') => ({
    filename: carpeta + '/' + nombre,
    path: `https://res.cloudinary.com/solo-pruebas/image/${tipo}/v123456/ruta-dinamica/${nombre}.png`
});

test.before(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'solo-pruebas';
    db.pool.query = async (sql, params) => {
        assert.match(sql, /FROM atletas/);
        assert.match(sql, /FROM pagos/);
        assert.match(sql, /unnest/);
        assert.ok(Array.isArray(params[0]));
        if (errorSql) throw errorSql;
        return { rows: filas };
    };
    cloudinary.uploader.destroy = (publicId, options, callback) => {
        destruidos.push({ publicId, options });
        callback(errorProveedor, errorProveedor ? null : { result: 'ok' });
    };
    console.warn = (...args) => advertencias.push(args);
});

test.beforeEach(() => {
    destruidos.length = 0;
    advertencias.length = 0;
    filas = [{ referenciado: false }];
    errorSql = null;
    errorProveedor = null;
});

test.after(() => {
    db.pool.query = consultaOriginal;
    cloudinary.uploader.destroy = destruirOriginal;
    console.warn = avisarOriginal;
    if (nubeOriginal == null) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = nubeOriginal;
});

test('compensa solo el archivo authenticated de la solicitud y usa tipo correcto', async () => {
    const req = {};
    assert.equal(registrarCarga(req, info('jaguares/atletas'), 'jaguares/atletas'), true);
    assert.deepEqual(await compensarCargas(req), { estado: 'eliminado', eliminados: 1, pendientes: 0 });
    assert.equal(destruidos.length, 1);
    assert.equal(destruidos[0].publicId, 'jaguares/atletas/archivo-sintetico-001');
    assert.equal(destruidos[0].options.type, 'authenticated');
    assert.equal(destruidos[0].options.resource_type, 'image');
    assert.equal(destruidos[0].options.invalidate, true);
    assert.equal((await compensarCargas(req)).estado, 'sin_cargas');
});

test('compensa comprobante público NUEVO tras fallo, sin asumir authenticated', async () => {
    const req = {};
    assert.equal(registrarCarga(req, info('jaguares_comprobantes', 'upload'), 'jaguares_comprobantes'), true);
    await compensarCargas(req);
    assert.equal(destruidos.length, 1);
    assert.equal(destruidos[0].options.type, 'upload');
});

test('libera los tres documentos subidos en un formulario abortado', async () => {
    const req = {};
    for (const n of ['foto', 'cedula_archivo', 'partida_nacimiento']) {
        assert.equal(registrarCarga(req, info('jaguares/atletas', 'authenticated', n), 'jaguares/atletas'), true);
    }
    assert.equal((await compensarCargas(req)).eliminados, 3);
    assert.equal(new Set(destruidos.map(d => d.publicId)).size, 3);
});

test('no borra archivos si se persistió alguna referencia en tablas', async () => {
    const req = {};
    registrarCarga(req, info('jaguares/atletas'), 'jaguares/atletas');
    filas = [{ referenciado: true }];
    assert.equal((await compensarCargas(req)).estado, 'referencia_o_estado_incierto');
    assert.equal(destruidos.length, 0);
});

test('consulta SQL fallida: se conserva archivo para revisión', async () => {
    const req = {};
    registrarCarga(req, info('jaguares/atletas'), 'jaguares/atletas');
    errorSql = Object.assign(new Error('error interno privado'), { code: '08006' });
    assert.equal((await compensarCargas(req)).estado, 'pendiente_revision');
    assert.equal(destruidos.length, 0);
    assert.equal(advertencias.some(a => a[0] === 'CLOUDINARY_COMPENSACION_SIN_VERIFICACION_SQL'), true);
});

test('proveedor falla: no considera finalizada la eliminación; puede reintentarse explícitamente', async () => {
    const req = {};
    registrarCarga(req, info('jaguares_comprobantes'), 'jaguares_comprobantes');
    errorProveedor = new Error('falla sintética');
    assert.equal((await compensarCargas(req)).estado, 'pendiente_revision');
    errorProveedor = null;
    assert.equal((await compensarCargas(req)).estado, 'eliminado');
    assert.equal(destruidos.length, 2);
});

test('COMMIT confirmado: nunca elimina archivos, incluso ante una compensación posterior', async () => {
    const req = {};
    registrarCarga(req, info('jaguares/atletas'), 'jaguares/atletas');
    confirmarCargas(req);
    assert.equal((await compensarCargas(req)).estado, 'sin_cargas');
    avisarEstadoIncierto(req, 'test');
    assert.equal(destruidos.length, 0);
    assert.equal(advertencias.length, 0);
});

test('no toma una URL externa, otra carpeta o un public_id del cliente para borrar', async () => {
    const req = {};
    assert.equal(registrarCarga(req, { filename: 'otros/archivo', path: info('jaguares/atletas').path }, 'jaguares/atletas'), false);
    assert.equal(registrarCarga(req, { ...info('jaguares/atletas'), path: 'https://evil.example/image/authenticated/v1/file.png' }, 'jaguares/atletas'), false);
    assert.equal(registrarCarga(req, { ...info('jaguares/atletas'), filename: 'jaguares/atletas/../otra-cosa' }, 'jaguares/atletas'), false);
    assert.equal(registrarCarga(req, info('jaguares/atletas'), 'jaguares/cms/noticias'), false);
    assert.equal((await compensarCargas(req)).estado, 'sin_cargas');
    assert.equal(destruidos.length, 0);
});

test('registro duplicado en la misma solicitud no provoca eliminación repetida', async () => {
    const req = {};
    registrarCarga(req, info('jaguares/atletas'), 'jaguares/atletas');
    registrarCarga(req, info('jaguares/atletas'), 'jaguares/atletas');
    await compensarCargas(req);
    assert.equal(destruidos.length, 1);
});

test('no borrar si PostgreSQL no devuelve confirmación inequívoca de ausencia', async () => {
    const req = {};
    registrarCarga(req, info('jaguares/atletas'), 'jaguares/atletas');
    filas = [];
    assert.equal((await compensarCargas(req)).estado, 'referencia_o_estado_incierto');
    assert.equal(destruidos.length, 0);
});
