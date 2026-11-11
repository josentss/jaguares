'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { configurarPostgresTemporal } = require('./helpers/postgres');

const esquema = configurarPostgresTemporal();
process.env.JWT_SECRET = 'clave-sintetica-planilla-general';
process.env.NODE_ENV = 'test';
process.env.TRUST_PROXY = '0';

const db = require('../config/db');
const { crearCredenciales } = require('../utils/sesion');
const { hoyCaracasISO } = require('../public/admin/categorias-formativas');
let servidor, base;

function cookie(id, rol) {
    const { cookies } = crearCredenciales({ id_usuario: id, rol });
    return Object.entries(cookies).map(([nombre, valor]) => nombre + '=' + valor).join('; ');
}

async function solicitar(categoria, credencial) {
    const headers = { Origin: base };
    if (credencial) headers.Cookie = credencial;
    const respuesta = await fetch(base + '/api/directiva/atletas/planilla-general?categoria=' + categoria,
        { headers });
    return { status: respuesta.status, headers: respuesta.headers, data: await respuesta.json() };
}

test.before(async () => {
    await db.pool.query('CREATE SCHEMA ' + esquema);
    await db.pool.query(`CREATE TABLE usuarios (
        id_usuario SERIAL PRIMARY KEY, rol TEXT NOT NULL, estado TEXT NOT NULL
    )`);
    await db.pool.query(`CREATE TABLE atletas (
        id_atleta SERIAL PRIMARY KEY, nombres TEXT NOT NULL, apellidos TEXT NOT NULL,
        cedula TEXT, fecha_nacimiento DATE NOT NULL, estado TEXT NOT NULL
    )`);
    await db.pool.query(`INSERT INTO usuarios (rol, estado) VALUES
        ('directiva','aprobado'), ('staff','aprobado'), ('representante','aprobado')`);
    const [anio, mes, dia] = hoyCaracasISO().split('-');
    const fecha = edad => `${Number(anio) - edad}-${mes}-${dia}`;
    await db.pool.query(`INSERT INTO atletas (nombres, apellidos, cedula, fecha_nacimiento, estado)
        VALUES ($1, $2, $3, $4, 'activo'),
               ('Otra', 'Categoría', 'V-99900002', $5, 'activo'),
               ('En', 'Espera', 'V-99900003', $4, 'espera'),
               ('Ya', 'Inactivo', 'V-99900004', $4, 'inactivo')`,
        ['Niña <Prueba>', 'Álvarez & Sintética', 'V-99900001', fecha(8), fecha(10)]);
    servidor = require('../index').listen(0, '127.0.0.1');
    await new Promise(resolve => servidor.once('listening', resolve));
    base = 'http://127.0.0.1:' + servidor.address().port;
});

test.after(async () => {
    if (servidor) await new Promise(resolve => servidor.close(resolve));
    try { await db.pool.query('DROP SCHEMA ' + esquema + ' CASCADE'); }
    finally { await db.pool.end(); }
});

test('solo personal autorizado obtiene datos mínimos de atletas activos de la categoría', async () => {
    assert.equal((await solicitar('u9')).status, 401);
    assert.equal((await solicitar('u9', cookie(3, 'representante'))).status, 403);
    for (const rol of ['directiva', 'staff']) {
        const respuesta = await solicitar('u9', cookie(rol === 'staff' ? 2 : 1, rol));
        assert.equal(respuesta.status, 200);
        assert.equal(respuesta.headers.get('cache-control'), 'no-store');
        assert.equal(respuesta.data.categoria.nombre, 'U-9 Iniciación');
        assert.equal(respuesta.data.total, 1);
        assert.equal(respuesta.data.atletas[0].nombres, 'Niña <Prueba>');
        assert.deepEqual(Object.keys(respuesta.data.atletas[0]).sort(),
            ['apellidos', 'cedula', 'fecha_nacimiento', 'nombres']);
        assert.match(respuesta.data.atletas[0].fecha_nacimiento, /^\d{4}-\d{2}-\d{2}$/);
    }
});

test('rechaza filtros no publicados y conserva resultado vacío sin exponer otras categorías', async () => {
    const directiva = cookie(1, 'directiva');
    for (const codigo of ['todos', 'sin_categoria', 'u8', 'u9&estado=espera', '']) {
        assert.equal((await solicitar(codigo, directiva)).status, 400, codigo);
    }
    const vacia = await solicitar('u15', directiva);
    assert.equal(vacia.status, 200);
    assert.equal(vacia.data.total, 0);
    assert.deepEqual(vacia.data.atletas, []);
});
