'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { configurarPostgresTemporal } = require('./helpers/postgres');

const esquema = configurarPostgresTemporal();
process.env.JWT_SECRET = 'clave-sintetica-catalogos-locales';
process.env.NODE_ENV = 'test';
process.env.TRUST_PROXY = '0';

const db = require('../config/db');
const { crearCredenciales } = require('../utils/sesion');
let servidor, base;
let ids;

const cookieRol = (id, rol) => {
    const { cookies } = crearCredenciales({ id_usuario: id, rol });
    return Object.entries(cookies).map(([nombre, valor]) => nombre + '=' + valor).join('; ');
};

async function solicitar(ruta, { metodo = 'GET', cookie, body } = {}) {
    const headers = { Origin: base };
    if (cookie) headers.Cookie = cookie;
    if (body) headers['Content-Type'] = 'application/json';
    const respuesta = await fetch(base + ruta, {
        method: metodo, headers, ...(body ? {body: JSON.stringify(body)} : {}),
        redirect: 'manual'
    });
    return { status: respuesta.status, data: await respuesta.json() };
}

test.before(async () => {
    await db.pool.query('CREATE SCHEMA ' + esquema);
    const migracion = await fs.readFile(
        path.join(__dirname, '../migrations/2026-11-10_catalogos_deportivos.sql'), 'utf8');
    await db.pool.query(migracion);
    await db.pool.query(migracion); // La migración no modifica datos al repetirse.
    await db.pool.query(`CREATE TABLE usuarios (
        id_usuario SERIAL PRIMARY KEY, rol TEXT NOT NULL, estado TEXT NOT NULL
    )`);
    await db.pool.query(`INSERT INTO usuarios (rol, estado)
        VALUES ('directiva','aprobado'), ('staff','aprobado'), ('representante','aprobado')`);
    servidor = require('../index').listen(0, '127.0.0.1');
    await new Promise(resolve => servidor.once('listening', resolve));
    base = 'http://127.0.0.1:' + servidor.address().port;
    ids = {
        directiva: cookieRol(1, 'directiva'),
        staff: cookieRol(2, 'staff'),
        representante: cookieRol(3, 'representante')
    };
});

test.after(async () => {
    if (servidor) await new Promise(resolve => servidor.close(resolve));
    try { await db.pool.query('DROP SCHEMA ' + esquema + ' CASCADE'); }
    finally { await db.pool.end(); }
});

const baseApi = '/api/directiva/deportes';

test('solo personal autorizado puede consultar y escribir catálogos', async () => {
    assert.equal((await solicitar(baseApi + '/catalogo')).status, 401);
    assert.equal((await solicitar(baseApi + '/catalogo', {cookie: ids.representante})).status, 403);
    const staff = await solicitar(baseApi + '/catalogo', {cookie: ids.staff});
    assert.equal(staff.status, 200);
    assert.deepEqual(staff.data.temporadas, []);
    assert.deepEqual(staff.data.categorias, []);
    assert.deepEqual(staff.data.equipos, []);
    assert.equal((await solicitar(baseApi + '/temporadas', {
        metodo:'POST',cookie:ids.representante,body:{nombre:'2026–2027'}
    })).status,403);
});

test('alta manual temporada → categoría → equipo con relaciones correctas', async () => {
    const temporada = await solicitar(baseApi + '/temporadas', {
        metodo:'POST',cookie:ids.directiva,body:{nombre:' 2026–2027 '}
    });
    assert.equal(temporada.status,201);
    assert.equal(temporada.data.registro.nombre,'2026–2027');
    ids.temporada = temporada.data.registro.id_temporada;

    const categoria = await solicitar(baseApi + '/categorias', {
        metodo:'POST',cookie:ids.directiva,
        body:{nombre:'Sub-14',id_temporada:String(ids.temporada)}
    });
    assert.equal(categoria.status,201);
    ids.categoria = categoria.data.registro.id_categoria;

    const equipo = await solicitar(baseApi + '/equipos', {
        metodo:'POST',cookie:ids.directiva,
        body:{nombre:'Jaguares A',id_categoria:String(ids.categoria)}
    });
    assert.equal(equipo.status,201);
    ids.equipo = equipo.data.registro.id_equipo;

    const lista = await solicitar(baseApi + '/catalogo', {cookie:ids.directiva});
    assert.equal(lista.status,200);
    assert.equal(lista.data.temporadas.length,1);
    assert.equal(lista.data.categorias[0].id_temporada,ids.temporada);
    assert.equal(lista.data.equipos[0].id_categoria,ids.categoria);
});

test('repetidos, campos malformados y referencias inexistentes son rechazados', async () => {
    for (const body of [
        {nombre:'2026–2027'}, {nombre:'2026–2027'.toUpperCase()}
    ]) {
        assert.equal((await solicitar(baseApi+'/temporadas', {
            metodo:'POST',cookie:ids.directiva,body
        })).status,409);
    }
    for (const nombre of ['<script>', '\nEquipo', 'x', 'a'.repeat(81), {}, 12]) {
        assert.equal((await solicitar(baseApi+'/temporadas', {
            metodo:'POST',cookie:ids.directiva,body:{nombre}
        })).status,400);
    }
    assert.equal((await solicitar(baseApi+'/categorias', {
        metodo:'POST',cookie:ids.directiva,body:{nombre:'Sub-16',id_temporada:'12abc'}
    })).status,400);
    assert.equal((await solicitar(baseApi+'/equipos', {
        metodo:'POST',cookie:ids.directiva,body:{nombre:'Equipo B',id_categoria:999999}
    })).status,409);
    assert.equal((await solicitar(baseApi+'/inesperado', {
        metodo:'POST',cookie:ids.directiva,body:{nombre:'Otro'}
    })).status,404);
});

test('renombra sin cambiar relaciones ni borrar históricos', async () => {
    const cambio = await solicitar(baseApi+'/equipos/'+ids.equipo, {
        metodo:'PUT',cookie:ids.directiva,body:{nombre:'Jaguares Principal'}
    });
    assert.equal(cambio.status,200);
    assert.equal(cambio.data.registro.nombre,'Jaguares Principal');
    const copia = await solicitar(baseApi+'/equipos', {
        metodo:'POST',cookie:ids.directiva,
        body:{nombre:'JAGUARES PRINCIPAL',id_categoria:ids.categoria}
    });
    assert.equal(copia.status,409);
    assert.equal((await solicitar(baseApi+'/temporadas/0', {
        metodo:'PUT',cookie:ids.directiva,body:{nombre:'Errónea'}
    })).status,400);
    assert.equal((await solicitar(baseApi+'/categorias/999999', {
        metodo:'PUT',cookie:ids.directiva,body:{nombre:'Sub-18'}
    })).status,404);
    const final = await solicitar(baseApi+'/catalogo',{cookie:ids.directiva});
    assert.equal(final.data.temporadas.length,1);
    assert.equal(final.data.equipos[0].id_categoria,ids.categoria);
    assert.equal(final.data.equipos[0].nombre,'Jaguares Principal');
});
