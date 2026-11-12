'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
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

async function solicitar(consulta, credencial) {
    const headers = { Origin: base };
    if (credencial) headers.Cookie = credencial;
    const respuesta = await fetch(base + '/api/directiva/atletas/planilla-general?' + consulta,
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
    const catalogos = await fs.readFile(
        path.join(__dirname, '../migrations/2026-11-10_catalogos_deportivos.sql'), 'utf8');
    const asignaciones = await fs.readFile(
        path.join(__dirname, '../migrations/2026-11-11_asignaciones_equipos.sql'), 'utf8');
    await db.pool.query(catalogos);
    await db.pool.query(asignaciones);
    const [anio, mes, dia] = hoyCaracasISO().split('-');
    const fecha = edad => `${Number(anio) - edad}-${mes}-${dia}`;
    await db.pool.query(`INSERT INTO atletas (nombres, apellidos, cedula, fecha_nacimiento, estado)
        VALUES ($1, $2, $3, $4, 'activo'),
               ('Otra', 'Categoría', 'V-99900002', $5, 'activo'),
               ('En', 'Espera', 'V-99900003', $4, 'espera'),
               ('Ya', 'Inactivo', 'V-99900004', $4, 'inactivo')`,
        ['Niña <Prueba>', 'Álvarez & Sintética', 'V-99900001', fecha(8), fecha(10)]);
    await db.pool.query(`
        INSERT INTO temporadas_deportivas (nombre) VALUES ('2026-2027');
        INSERT INTO categorias_deportivas (id_temporada, nombre) VALUES (1, 'U-09');
        INSERT INTO equipos_deportivos (id_categoria, nombre) VALUES (1, 'Jaguares A'), (1, 'Jaguares B');
        INSERT INTO asignaciones_equipos (id_atleta, id_equipo, id_temporada, asignado_por)
            VALUES (1, 1, 1, 1), (2, 1, 1, 1), (3, 1, 1, 1), (4, 1, 1, 1);
        INSERT INTO asignaciones_equipos
            (id_atleta, id_equipo, id_temporada, inicio_en, fin_en, asignado_por, cerrado_por)
            VALUES (1, 2, 1, '2026-01-01T12:00:00Z', '2026-02-01T12:00:00Z', 1, 1);
    `);
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
    assert.equal((await solicitar('categoria=u9')).status, 401);
    assert.equal((await solicitar('categoria=u9', cookie(3, 'representante'))).status, 403);
    for (const rol of ['directiva', 'staff']) {
        const respuesta = await solicitar('categoria=u9', cookie(rol === 'staff' ? 2 : 1, rol));
        assert.equal(respuesta.status, 200);
        assert.equal(respuesta.headers.get('cache-control'), 'no-store');
        assert.equal(respuesta.data.alcance.nombre, 'U-9 Iniciación');
        assert.equal(respuesta.data.alcance.tipo, 'categoria');
        assert.equal(respuesta.data.total, 1);
        assert.equal(respuesta.data.atletas[0].nombres, 'Niña <Prueba>');
        assert.deepEqual(Object.keys(respuesta.data.atletas[0]).sort(),
            ['apellidos', 'cedula', 'fecha_nacimiento', 'nombres']);
        assert.match(respuesta.data.atletas[0].fecha_nacimiento, /^\d{4}-\d{2}-\d{2}$/);
    }
});

test('planilla de equipo usa asignaciones vigentes y solo atletas activos', async () => {
    for (const rol of ['directiva', 'staff']) {
        const respuesta = await solicitar('equipo=1', cookie(rol === 'staff' ? 2 : 1, rol));
        assert.equal(respuesta.status, 200);
        assert.equal(respuesta.data.alcance.tipo, 'equipo');
        assert.equal(respuesta.data.alcance.nombre, 'Jaguares A');
        assert.equal(respuesta.data.alcance.categoria, 'U-09');
        assert.equal(respuesta.data.alcance.temporada, '2026-2027');
        assert.equal(respuesta.data.total, 2);
        assert.deepEqual(respuesta.data.atletas.map(atleta => atleta.nombres), ['Niña <Prueba>', 'Otra']);
    }
    const historica = await solicitar('equipo=2', cookie(1, 'directiva'));
    assert.equal(historica.status, 200);
    assert.equal(historica.data.total, 0);
});

test('rechaza filtros no publicados y conserva resultado vacío sin exponer otras categorías', async () => {
    const directiva = cookie(1, 'directiva');
    for (const consulta of ['categoria=todos', 'categoria=sin_categoria', 'categoria=u8',
        'categoria=u9&estado=espera', 'equipo=0', 'equipo=abc', '']) {
        assert.equal((await solicitar(consulta, directiva)).status, 400, consulta);
    }
    assert.equal((await solicitar('equipo=99999', directiva)).status, 404);
    const vacia = await solicitar('categoria=u15', directiva);
    assert.equal(vacia.status, 200);
    assert.equal(vacia.data.total, 0);
    assert.deepEqual(vacia.data.atletas, []);
});
