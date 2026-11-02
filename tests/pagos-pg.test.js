const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../config/db');
const pagos = require('../controllers/pagosController');
const directiva = require('../controllers/directivaController');
const auth = require('../middlewares/authMiddleware');
const jwt = require('jsonwebtoken');

function responder() {
    let resolver;
    const fin = new Promise(resolve => { resolver = resolve; });
    const res = {
        codigo: 200,
        status(n) { this.codigo = n; return this; },
        json(body) { resolver({ codigo: this.codigo, body }); return this; }
    };
    return {res, fin};
}

function reportar(id_atleta, usuarioId = 5) {
    const {res, fin} = responder();
    pagos.reportarPago({
        usuarioId, ip: '127.0.0.1', body: {
            id_atleta: String(id_atleta), mes: 'Noviembre',
            metodo: 'Efectivo', monto: '25.50', moneda: 'USD',
            fecha_pago: '2026-11-02'
        }
    }, res);
    return fin;
}

test.before(async () => {
    await db.pool.query(`
        CREATE TABLE usuarios (
            id_usuario INTEGER PRIMARY KEY, rol TEXT NOT NULL, estado TEXT NOT NULL
        );
        CREATE TABLE atletas (
            id_atleta INTEGER PRIMARY KEY, id_representante INTEGER REFERENCES usuarios(id_usuario),
            estado TEXT NOT NULL
        );
        CREATE TABLE pagos (
            id_pago SERIAL PRIMARY KEY,
            id_atleta INTEGER NOT NULL REFERENCES atletas(id_atleta),
            mes_pagado TEXT, metodo_pago TEXT, fecha_pago DATE, monto NUMERIC(12,2),
            moneda TEXT, referencia TEXT, ruta_captura TEXT, estado_pago TEXT
        );
        CREATE TABLE notificaciones (
            id_notificacion SERIAL PRIMARY KEY,
            id_usuario INTEGER, mensaje TEXT, tipo TEXT
        );
        INSERT INTO usuarios VALUES
            (5, 'representante', 'aprobado'),
            (6, 'representante', 'inactivo'),
            (7, 'representante', 'aprobado');
        INSERT INTO atletas VALUES
            (11, 5, 'activo'),
            (12, 5, 'inactivo'),
            (13, 5, 'espera'),
            (14, 6, 'activo'),
            (15, 7, 'activo');
    `);
});

test.after(async () => {
    await db.pool.end();
});

test('PostgreSQL: alta autorizada persiste una sola fila', async () => {
    const r = await reportar(11);
    assert.equal(r.codigo, 200);
    assert.equal(r.body.success, true);
    const {rows} = await db.pool.query("SELECT * FROM pagos WHERE id_atleta = 11");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].metodo_pago, 'Efectivo');
    assert.equal(rows[0].estado_pago, 'pendiente');
    assert.equal(rows[0].monto, '25.50');
});

test('PostgreSQL: bloquear inactivo, pendiente, cuenta inactiva y atleta ajeno', async () => {
    for (const id of [12, 13, 14, 15]) {
        const r = await reportar(id);
        assert.equal(r.codigo, 409, 'atleta ' + id);
        assert.equal(r.body.success, false);
    }
    const {rows} = await db.pool.query("SELECT COUNT(*)::int AS total FROM pagos");
    assert.equal(rows[0].total, 1);
});

test('PostgreSQL: cambio de estado de la cuenta revoca posibilidad de pagar', async () => {
    await db.pool.query("UPDATE usuarios SET estado = 'inactivo' WHERE id_usuario = 5");
    const r = await reportar(11);
    assert.equal(r.codigo, 409);
    const {rows} = await db.pool.query("SELECT COUNT(*)::int AS total FROM pagos");
    assert.equal(rows[0].total, 1);
});

function ejecutarControlador(fn, body) {
    const {res, fin} = responder();
    fn({body}, res);
    return fin;
}

test('PostgreSQL: no activar atleta de representante inactivo, sí tras habilitarlo', async () => {
    const bloqueado = await ejecutarControlador(directiva.actualizarEstadoAtleta,
        {id_atleta: 12, estado: 'activo'});
    assert.equal(bloqueado.codigo, 409);
    const antes = await db.pool.query('SELECT estado FROM atletas WHERE id_atleta = 12');
    assert.equal(antes.rows[0].estado, 'inactivo');

    await db.pool.query("UPDATE usuarios SET estado = 'aprobado' WHERE id_usuario = 5");
    const aprobado = await ejecutarControlador(directiva.actualizarEstadoAtleta,
        {id_atleta: 12, estado: 'activo'});
    assert.equal(aprobado.codigo, 200);
    const despues = await db.pool.query('SELECT estado FROM atletas WHERE id_atleta = 12');
    assert.equal(despues.rows[0].estado, 'activo');
    const repetido = await ejecutarControlador(directiva.actualizarEstadoAtleta,
        {id_atleta: 12, estado: 'activo'});
    assert.equal(repetido.codigo, 409);
});

test('PostgreSQL: el pago inexistente o repetido no reporta éxito', async () => {
    const primera = await ejecutarControlador(directiva.actualizarEstadoPago,
        {id_pago: 1, estado_pago: 'aprobado'});
    assert.equal(primera.codigo, 200);
    const duplicada = await ejecutarControlador(directiva.actualizarEstadoPago,
        {id_pago: 1, estado_pago: 'aprobado'});
    assert.equal(duplicada.codigo, 409);
    const inexistente = await ejecutarControlador(directiva.actualizarEstadoPago,
        {id_pago: 999, estado_pago: 'aprobado'});
    assert.equal(inexistente.codigo, 404);
    const {rows} = await db.pool.query('SELECT estado_pago FROM pagos WHERE id_pago = 1');
    assert.equal(rows[0].estado_pago, 'aprobado');
});

test('PostgreSQL: solicitudes ajenas al rol representante no pueden aprobarse', async () => {
    await db.pool.query("INSERT INTO usuarios VALUES (21, 'staff', 'pendiente'), (22, 'representante', 'pendiente')");
    const indebido = await ejecutarControlador(directiva.gestionarAprobacion,
        {id_usuario: 21, accion: 'aprobar'});
    assert.equal(indebido.codigo, 404);
    const correcto = await ejecutarControlador(directiva.gestionarAprobacion,
        {id_usuario: 22, accion: 'aprobar'});
    assert.equal(correcto.codigo, 200);
    const {rows} = await db.pool.query('SELECT id_usuario, estado FROM usuarios WHERE id_usuario IN (21, 22) ORDER BY id_usuario');
    assert.deepEqual(rows.map(x => x.estado), ['pendiente', 'aprobado']);
});

function probarSesion(token) {
    return new Promise(resolve => {
        const req = {cookies:{token}};
        const {res, fin} = responder();
        auth.verificarSesion(req, res, () => resolve({codigo:200, usuarioId:req.usuarioId}));
        fin.then(resolve);
    });
}

test('PostgreSQL: revocar cuenta invalida JWT previamente emitido', async () => {
    process.env.JWT_SECRET = 'clave-temporal-ci-pruebas-internas';
    const token = jwt.sign({id_usuario: 5, rol: 'representante'}, process.env.JWT_SECRET);
    const vigente = await probarSesion(token);
    assert.equal(vigente.codigo, 200);
    await db.pool.query("UPDATE usuarios SET estado = 'inactivo' WHERE id_usuario = 5");
    const revocado = await probarSesion(token);
    assert.equal(revocado.codigo, 403);
    await db.pool.query("UPDATE usuarios SET estado = 'aprobado' WHERE id_usuario = 5");
});

test('PostgreSQL: el perfil impide cédulas duplicadas y conserva los datos previos', async () => {
    const usuarios = require('../controllers/userController');
    await db.pool.query(`
        ALTER TABLE usuarios
        ADD COLUMN nombres TEXT, ADD COLUMN apellidos TEXT, ADD COLUMN correo TEXT,
        ADD COLUMN cedula TEXT, ADD COLUMN telefono1 TEXT,
        ADD COLUMN telefono2 TEXT, ADD COLUMN password_hash TEXT;
        UPDATE usuarios SET cedula = 'V-12345678' WHERE id_usuario = 5;
        UPDATE usuarios SET cedula = 'V-99999999' WHERE id_usuario = 7;
    `);
    const datos = {nombres:'Ana María', apellidos:'Pérez-López',
        cedula:'V-99999999',telefono1:'04141234567',telefono2:'',password:''};
    let salida = responder();
    await usuarios.actualizarPerfil({usuarioId:5,body:datos},salida.res);
    const duplicado = await salida.fin;
    assert.equal(duplicado.codigo,409);
    const antes=await db.pool.query('SELECT cedula FROM usuarios WHERE id_usuario = 5');
    assert.equal(antes.rows[0].cedula,'V-12345678');

    salida = responder();
    await usuarios.actualizarPerfil({usuarioId:5,body:{...datos,cedula:'V-12345678'}},salida.res);
    const correcto=await salida.fin;
    assert.equal(correcto.codigo,200);
    const despues=await db.pool.query('SELECT nombres, telefono1 FROM usuarios WHERE id_usuario = 5');
    assert.equal(despues.rows[0].nombres,'Ana María');
    assert.equal(despues.rows[0].telefono1,'04141234567');
});
