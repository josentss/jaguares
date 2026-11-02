const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../config/db');
const pagos = require('../controllers/pagosController');

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
