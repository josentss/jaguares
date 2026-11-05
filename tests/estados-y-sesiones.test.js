const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { esEstadoAtletaValido, esEstadoPagoValido } = require('../utils/validators');
process.env.JWT_SECRET = 'secreto-sintetico-estados-sesiones';
const { crearCredenciales } = require('../utils/sesion');
function reqSesion(id_usuario = 5, rol = 'representante') {
    return { cookies: crearCredenciales({ id_usuario, rol }).cookies };
}

function cargar(modulo, mocks) {
    const ruta = require.resolve(modulo);
    delete require.cache[ruta];
    const original = Module._load;
    Module._load = function (solicitud, padre, principal) {
        if (Object.prototype.hasOwnProperty.call(mocks, solicitud)) return mocks[solicitud];
        return original.call(this, solicitud, padre, principal);
    };
    try { return require(modulo); }
    finally { Module._load = original; }
}

function resMock() {
    return {
        statusCode: 200,
        body: null,
        redirectUrl: null,
        status(n) { this.statusCode = n; return this; },
        json(o) { this.body = o; return this; },
        redirect(p) { this.redirectUrl = p; return this; }
    };
}

test('estados: solo cadenas exactas conocidas', () => {
    for (const estado of ['activo', 'espera', 'inactivo']) assert.equal(esEstadoAtletaValido(estado), true);
    for (const estado of ['ACTIVO', ' activo ', ['activo'], null, 1, 'sancionado']) {
        assert.equal(esEstadoAtletaValido(estado), false);
    }
    for (const estado of ['pendiente', 'aprobado', 'rechazado']) assert.equal(esEstadoPagoValido(estado), true);
    for (const estado of ['APROBADO', ' aprobado ', ['aprobado'], null, 'anulado']) {
        assert.equal(esEstadoPagoValido(estado), false);
    }
});

test('JWT firmado: sesión vigente se verifica con BD y se reutiliza por solicitud', () => {
    let consultas = 0;
    const db = { query(sql, params, cb) {
        consultas++;
        assert.match(sql, /SELECT rol, estado FROM usuarios/);
        assert.deepEqual(params, [5]);
        cb(null, [{ rol: 'representante', estado: 'aprobado' }]);
    }};
    const auth = cargar('../middlewares/authMiddleware', { '../config/db': db });
    const req = reqSesion();
    const res = resMock();
    let llamadas = 0;
    auth.verificarSesion(req, res, () => { llamadas++; });
    auth.verificarSesionRole(['representante'])(req, res, () => { llamadas++; });
    assert.equal(llamadas, 2);
    assert.equal(consultas, 1);
    assert.equal(req.usuarioId, 5);
    assert.equal(req.usuarioRol, 'representante');
});

test('JWT previo: desactivar la cuenta revoca todas las nuevas solicitudes', () => {
    let estado = 'aprobado';
    const db = { query(sql, params, cb) { cb(null, [{ rol: 'representante', estado }]); } };
    const auth = cargar('../middlewares/authMiddleware', {
        '../config/db': db
    });
    let nexts = 0;
    auth.verificarSesion(reqSesion(), resMock(), () => { nexts++; });
    estado = 'inactivo';
    const res = resMock();
    auth.verificarSesion(reqSesion(), res, () => { nexts++; });
    assert.equal(nexts, 1);
    assert.equal(res.statusCode, 403);
});

test('JWT con rol desactualizado o usuario inexistente: sin acceso', () => {
    for (const rows of [
        [],
        [{ rol: 'representante', estado: 'aprobado' }],
        [{ rol: 'admin', estado: 'inactivo' }]
    ]) {
        const db = { query(sql, params, cb) { cb(null, rows); } };
        const auth = cargar('../middlewares/authMiddleware', {
            '../config/db': db
        });
        const res = resMock();
        let next = false;
        auth.verificarSesion(reqMock(), res, () => { next = true; });
        assert.equal(next, false);
        assert.ok([401, 403].includes(res.statusCode));
    }
    function reqMock() { return reqSesion(5, 'admin'); }
});

test('Fallo de BD al comprobar sesión: modo cerrado 503', () => {
    const db = { query(sql, params, cb) { cb(new Error('DB caída')); } };
    const auth = cargar('../middlewares/authMiddleware', {
        '../config/db': db
    });
    const res = resMock();
    const errOriginal = console.error; console.error = () => {};
    try { auth.verificarSesion(reqSesion(), res, () => assert.fail('No permitir')); }
    finally { console.error = errOriginal; }
    assert.equal(res.statusCode, 503);
});

test('Admin con rol de BD válido: sigue pudiendo acceder', () => {
    const db = { query(sql, params, cb) { cb(null, [{ rol: 'directiva', estado: 'activo' }]); } };
    const auth = cargar('../middlewares/authMiddleware', {
        '../config/db': db
    });
    let nexts = 0;
    const req = reqSesion(9, 'directiva');
    auth.verificarSesionRole(['admin', 'staff', 'directiva'])(req, resMock(), () => nexts++);
    assert.equal(nexts, 1);
});

test('Estados administrativos: no activar atleta de representante no aprobado', () => {
    const consultas = [];
    const db = { query(sql, params, cb) {
        consultas.push({ sql, params });
        if (/UPDATE atletas/.test(sql)) return cb(null, { affectedRows: 0 });
        if (/SELECT estado FROM atletas/.test(sql)) return cb(null, [{estado: 'inactivo'}]);
        assert.fail('Consulta inesperada');
    }};
    const c = cargar('../controllers/directivaController', {
        '../config/db': db, './notificacionesController': { crearNotificacion() { assert.fail('No notificar'); } }
    });
    const res = resMock();
    c.actualizarEstadoAtleta({body:{id_atleta:12,estado:'activo'}},res);
    assert.equal(res.statusCode,409);
    assert.match(consultas[0].sql, /u\.estado = 'aprobado'/);
    assert.match(consultas[0].sql, /u\.rol = 'representante'/);
});

test('No confirmar actualizaciones ficticias de pagos', () => {
    const db = { query(sql, params, cb) {
        if (/UPDATE pagos/.test(sql)) return cb(null, { affectedRows: 0 });
        if (/SELECT estado_pago FROM pagos/.test(sql)) return cb(null, []);
        assert.fail('Consulta inesperada');
    }};
    const c = cargar('../controllers/directivaController', {
        '../config/db': db, './notificacionesController': { crearNotificacion() { assert.fail('No notificar'); } }
    });
    const res = resMock();
    c.actualizarEstadoPago({body:{id_pago:999,estado_pago:'aprobado'}},res);
    assert.equal(res.statusCode,404);
});

test('Aprobación de cuentas: solo solicitudes de representantes', () => {
    let sqlUsado = '';
    const db = { query(sql, params, cb) {
        sqlUsado = sql;
        cb(null, { affectedRows: 0 });
    }};
    const c = cargar('../controllers/directivaController', {
        '../config/db': db, './notificacionesController': { crearNotificacion() { assert.fail('No notificar'); } }
    });
    const res = resMock();
    c.gestionarAprobacion({body:{id_usuario:5,accion:'aprobar'}},res);
    assert.match(sqlUsado, /AND rol = 'representante'/);
    assert.equal(res.statusCode,404);
});
