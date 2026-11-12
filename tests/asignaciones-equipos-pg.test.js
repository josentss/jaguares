'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { configurarPostgresTemporal } = require('./helpers/postgres');

const esquema = configurarPostgresTemporal();
process.env.JWT_SECRET = 'clave-sintetica-asignaciones-locales';
process.env.NODE_ENV = 'test';
process.env.TRUST_PROXY = '0';
const db = require('../config/db');
const { crearCredenciales } = require('../utils/sesion');
let servidor, base;

function cookie(id, rol) {
    const { cookies } = crearCredenciales({ id_usuario: id, rol });
    return Object.entries(cookies).map(([nombre, valor]) => nombre + '=' + valor).join('; ');
}

async function solicitar(ruta, { metodo = 'GET', credencial, body } = {}) {
    const headers = { Origin: base };
    if (credencial) headers.Cookie = credencial;
    if (body) headers['Content-Type'] = 'application/json';
    const respuesta = await fetch(base + ruta, {
        method: metodo, headers, ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: respuesta.status, data: await respuesta.json() };
}

test.before(async () => {
    await db.pool.query('CREATE SCHEMA ' + esquema);
    await db.pool.query(`CREATE TABLE usuarios (
        id_usuario SERIAL PRIMARY KEY, rol TEXT NOT NULL, estado TEXT NOT NULL
    )`);
    await db.pool.query(`CREATE TABLE atletas (
        id_atleta SERIAL PRIMARY KEY, nombres TEXT NOT NULL, apellidos TEXT NOT NULL,
        fecha_nacimiento DATE NOT NULL, estado TEXT NOT NULL
    )`);
    const catalogos = await fs.readFile(path.join(__dirname, '../migrations/2026-11-10_catalogos_deportivos.sql'), 'utf8');
    const asignaciones = await fs.readFile(path.join(__dirname, '../migrations/2026-11-11_asignaciones_equipos.sql'), 'utf8');
    await db.pool.query(catalogos);
    await db.pool.query(asignaciones);
    await db.pool.query(asignaciones);
    await db.pool.query(`INSERT INTO usuarios (rol, estado) VALUES
        ('directiva','aprobado'), ('admin','aprobado'),
        ('staff','aprobado'), ('representante','aprobado')`);
    await db.pool.query(`INSERT INTO atletas (nombres, apellidos, fecha_nacimiento, estado)
        VALUES ('Ana','Sintética','2018-05-11','activo'),
               ('Luis','Sintético','2018-05-11','espera'),
               ('Eva','Sintética','2018-05-11','activo')`);
    await db.pool.query(`INSERT INTO temporadas_deportivas (nombre) VALUES ('2026-2027'), ('2027-2028')`);
    await db.pool.query(`INSERT INTO categorias_deportivas (id_temporada, nombre)
        VALUES (1,'Formación'), (2,'Avanzado')`);
    await db.pool.query(`INSERT INTO equipos_deportivos (id_categoria, nombre)
        VALUES (1,'Equipo A'), (1,'Equipo B'), (2,'Equipo Futuro')`);
    servidor = require('../index').listen(0, '127.0.0.1');
    await new Promise(resolve => servidor.once('listening', resolve));
    base = 'http://127.0.0.1:' + servidor.address().port;
});

test.after(async () => {
    if (servidor) await new Promise(resolve => servidor.close(resolve));
    try { await db.pool.query('DROP SCHEMA ' + esquema + ' CASCADE'); }
    finally { await db.pool.end(); }
});

const ruta = '/api/directiva/deportes/asignaciones';

test('solo directiva y admin consultan y modifican asignaciones', async () => {
    assert.equal((await solicitar(ruta)).status, 401);
    for (const [id, rol] of [[3, 'staff'], [4, 'representante']]) {
        assert.equal((await solicitar(ruta, {credencial: cookie(id, rol)})).status, 403);
        assert.equal((await solicitar(ruta, {metodo:'POST',credencial:cookie(id,rol),
            body:{id_atleta:1,id_equipo:1}})).status, 403);
    }
    assert.equal((await solicitar(ruta,{credencial:cookie(1,'directiva')})).status,200);
    assert.equal((await solicitar(ruta,{credencial:cookie(2,'admin')})).status,200);
});

test('valida atleta activo, equipo existente y campos sin crear filas', async () => {
    const credencial = cookie(1, 'directiva');
    for (const body of [
        {id_atleta:0,id_equipo:1,id_asignacion_actual:null},
        {id_atleta:'1x',id_equipo:1,id_asignacion_actual:null},
        {id_atleta:1,id_equipo:0,id_asignacion_actual:null},
        {id_atleta:1,id_equipo:[],id_asignacion_actual:null},
        {id_atleta:1,id_equipo:1}
    ]) assert.equal((await solicitar(ruta,{metodo:'POST',credencial,body})).status,400);
    assert.equal((await solicitar(ruta,{metodo:'POST',credencial,
        body:{id_atleta:99,id_equipo:1,id_asignacion_actual:null}})).status,404);
    assert.equal((await solicitar(ruta,{metodo:'POST',credencial,
        body:{id_atleta:2,id_equipo:1,id_asignacion_actual:null}})).status,409);
    assert.equal((await solicitar(ruta,{metodo:'POST',credencial,
        body:{id_atleta:1,id_equipo:99,id_asignacion_actual:null}})).status,404);
    assert.equal((await db.pool.query('SELECT count(*)::int AS total FROM asignaciones_equipos')).rows[0].total,0);
});

test('asignación manual, cambio con historial y segunda temporada independiente', async () => {
    const credencial = cookie(1, 'directiva');
    const primera = await solicitar(ruta,{metodo:'POST',credencial,
        body:{id_atleta:1,id_equipo:1,id_asignacion_actual:null}});
    assert.equal(primera.status,201);
    assert.equal(primera.data.movimiento,false);
    assert.equal((await solicitar(ruta,{metodo:'POST',credencial,
        body:{id_atleta:1,id_equipo:1,id_asignacion_actual:primera.data.id_asignacion}})).status,409);
    const cambio = await solicitar(ruta,{metodo:'POST',credencial:cookie(2,'admin'),
        body:{id_atleta:1,id_equipo:2,id_asignacion_actual:primera.data.id_asignacion}});
    assert.equal(cambio.status,201);
    assert.equal(cambio.data.movimiento,true);
    const otraTemporada = await solicitar(ruta,{metodo:'POST',credencial,
        body:{id_atleta:1,id_equipo:3,id_asignacion_actual:null}});
    assert.equal(otraTemporada.status,201);
    const lista = await solicitar(ruta,{credencial});
    assert.equal(lista.data.atletas.length,2);
    assert.ok(lista.data.atletas.every(atleta => atleta.estado === 'activo'));
    assert.equal(lista.data.atletas.some(atleta => atleta.id_atleta === 2),false);
    assert.equal(lista.data.movimientos.length,3);
    assert.equal(lista.data.movimientos.filter(m=>!m.fin_en).length,2);
    assert.equal(lista.data.movimientos.filter(m=>m.id_temporada===1&&!m.fin_en)[0].equipo_nombre,'Equipo B');
    assert.equal(lista.data.movimientos.filter(m=>m.id_temporada===1&&m.fin_en)[0].equipo_nombre,'Equipo A');
    assert.deepEqual(Object.keys(lista.data.atletas[0]).sort(),
        ['apellidos','estado','fecha_nacimiento','id_atleta','nombres']);
    const sql = await db.pool.query(`SELECT id_equipo, asignado_por, cerrado_por, inicio_en, fin_en
        FROM asignaciones_equipos WHERE id_atleta = 1 AND id_temporada = 1 ORDER BY id_asignacion`);
    assert.equal(sql.rows[0].cerrado_por,2);
    assert.ok(sql.rows[0].fin_en >= sql.rows[0].inicio_en);
    assert.equal(sql.rows[1].asignado_por,2);
    assert.equal(sql.rows[1].fin_en,null);
    assert.equal((await solicitar(ruta,{metodo:'POST',credencial,
        body:{id_atleta:1,id_equipo:1,id_asignacion_actual:primera.data.id_asignacion}})).status,409);
});

test('cambios concurrentes dejan una sola asignación activa por temporada', async () => {
    const credencial = cookie(1,'directiva');
    const resultados = await Promise.all([1,2].map(id_equipo => solicitar(ruta,
        {metodo:'POST',credencial,body:{id_atleta:3,id_equipo,id_asignacion_actual:null}})));
    assert.deepEqual(resultados.map(r=>r.status).sort(),[201,409]);
    const sql = await db.pool.query(`SELECT count(*)::int AS total FROM asignaciones_equipos
        WHERE id_atleta = 3 AND id_temporada = 1 AND fin_en IS NULL`);
    assert.equal(sql.rows[0].total,1);
});
