const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { esMontoValido, esEnteroPositivo, esFechaISOValida, hoyCaracasISO,
    limitesFechaEvento } = require('../utils/validators');

function cargarConMocks(modulo, mocks) {
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

function respuesta() {
    return {
        statusCode: 200,
        body: null,
        status(codigo) { this.statusCode = codigo; return this; },
        json(datos) { this.body = datos; return this; },
        cookie() { return this; }
    };
}

function datosPago(cambios = {}) {
    return {
        id_atleta: '12', mes: 'Noviembre', metodo: 'Efectivo',
        monto: '25.50', moneda: 'USD', fecha_pago: '2026-11-02', ...cambios
    };
}

test('identificadores: solo enteros positivos seguros', () => {
    for (const valido of [1, '1', 999]) assert.equal(esEnteroPositivo(valido), true);
    for (const invalido of [0, -1, '1.2', '12abc', '1e3', '0x10', '01', null, [], {}, '9007199254740993']) {
        assert.equal(esEnteroPositivo(invalido), false, String(invalido));
    }
});

test('montos: decimales con hasta dos posiciones sin sufijos', () => {
    for (const valido of ['0.01', '25', '25.50', 125.7, '999999999']) {
        assert.equal(esMontoValido(valido), true, String(valido));
    }
    for (const invalido of ['0', '0.00', '-1', '2abc', '1e3', '10.001', 'NaN', 'Infinity', '1,20', [], {}, '']) {
        assert.equal(esMontoValido(invalido), false, String(invalido));
    }
});

test('fechas: calendario gregoriano válido, sin rollover ni formato ambiguo', () => {
    for (const valido of ['2024-02-29', '2026-11-02', '2000-02-29']) {
        assert.equal(esFechaISOValida(valido), true, valido);
    }
    for (const invalido of ['2026-02-29', '2026-04-31', '2026-13-01', '02/11/2026', '2026-1-2', '0000-01-01', '', null]) {
        assert.equal(esFechaISOValida(invalido), false, String(invalido));
    }
});

test('eventos: hoy en Caracas es válido; pasado, fecha imposible y tipos incorrectos no consultan SQL', async () => {
    const consultas = [];
    const db = { promise() { return { query: async (sql, params) => {
        consultas.push({sql, params});
        return [{insertId: 41, affectedRows: 1}];
    }}; }};
    const cms = cargarConMocks('../controllers/cmsController', {'../config/db': db});
    const hoy = hoyCaracasISO();
    const limites = limitesFechaEvento(hoy);
    const ayer = new Date(hoy + 'T12:00:00Z');
    ayer.setUTCDate(ayer.getUTCDate() - 1);

    for (const body of [
        undefined,
        {titulo: 'Encuentro', fecha_evento: '2026-02-30', hora_evento: '14:30', lugar: 'Cancha'},
        {titulo: 'Encuentro', fecha_evento: ayer.toISOString().slice(0, 10), hora_evento: '14:30', lugar: 'Cancha'},
        {titulo: 'Encuentro', fecha_evento: `${Number(hoy.slice(0, 4)) + 2}-01-01`, hora_evento: '14:30', lugar: 'Cancha'},
        {titulo: 123, fecha_evento: hoy, hora_evento: '14:30', lugar: 'Cancha'},
        {titulo: 'Encuentro', fecha_evento: hoy, hora_evento: '14:30', lugar: {nombre: 'Cancha'}},
        ...[undefined, null, '', '24:00', '9:00', '14:60', '14:30Z', '14:30:00', 1430, '04:55', '22:05', '23:00', '14:02', '16:59']
            .map(hora_evento => ({titulo: 'Encuentro', fecha_evento: hoy, hora_evento, lugar: 'Cancha'}))
    ]) {
        const res = respuesta();
        await cms.crearEventoAdmin({body, usuarioId: 9}, res);
        assert.equal(res.statusCode, 400, JSON.stringify(body));
    }
    assert.equal(consultas.length, 0);

    const res = respuesta();
    await cms.crearEventoAdmin({
        body: {titulo: 'Encuentro de hoy', fecha_evento: hoy, hora_evento: '05:00', lugar: 'Cancha principal'},
        usuarioId: 9
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(consultas.length, 1);
    assert.deepEqual(consultas[0].params, ['Encuentro de hoy', hoy, '05:00', 'Cancha principal']);
    assert.deepEqual(limites, {min: hoy, max: `${Number(hoy.slice(0, 4)) + 1}-12-31`});

    const resMaximo = respuesta();
    await cms.crearEventoAdmin({
        body: {titulo: 'Encuentro límite', fecha_evento: limites.max, hora_evento: '22:00', lugar: 'Cancha principal'},
        usuarioId: 9
    }, resMaximo);
    assert.equal(resMaximo.statusCode, 201);
    assert.deepEqual(consultas[1].params, ['Encuentro límite', limites.max, '22:00', 'Cancha principal']);
});

test('eventos públicos: la consulta excluye fechas vencidas usando el día civil de Caracas', async () => {
    let consulta;
    const db = { promise() { return { query: async (sql, params) => {
        consulta = {sql, params};
        return [[]];
    }}; }};
    const cms = cargarConMocks('../controllers/cmsController', {'../config/db': db});
    const res = respuesta();
    await cms.obtenerEventosPublicos({}, res);
    assert.equal(res.statusCode, 200);
    assert.match(consulta.sql, /fecha_evento >= \(\?::date::timestamp AT TIME ZONE 'UTC'\)/);
    assert.match(consulta.sql, /to_char\(fecha_evento AT TIME ZONE 'UTC', 'YYYY-MM-DD'\)/);
    assert.deepEqual(consulta.params, [hoyCaracasISO()]);
});

test('eventos: un identificador malformado se rechaza antes de actualizar', async () => {
    let consultas = 0;
    const db = { promise() { return { query: async () => { consultas++; return [{affectedRows: 1}]; } }; } };
    const cms = cargarConMocks('../controllers/cmsController', {'../config/db': db});
    const res = respuesta();
    await cms.actualizarEventoAdmin({params: {id: 'abc'}, body: {estado: 'cancelado'}}, res);
    assert.equal(res.statusCode, 400);
    assert.equal(consultas, 0);
});

test('eventos: el borrado valida ID, usa SQL parametrizado y distingue inexistentes', async () => {
    const consultas = [];
    let afectadas = 1;
    const db = { promise() { return { query: async (sql, params) => {
        consultas.push({sql, params});
        return [{affectedRows: afectadas}];
    }}; }};
    const cms = cargarConMocks('../controllers/cmsController', {'../config/db': db});
    const invalido = respuesta();
    await cms.eliminarEventoAdmin({params: {id: '1 OR 1=1'}, usuarioId: 1}, invalido);
    assert.equal(invalido.statusCode, 400);
    assert.equal(consultas.length, 0);

    const borrado = respuesta();
    await cms.eliminarEventoAdmin({params: {id: '12'}, usuarioId: 1}, borrado);
    assert.equal(borrado.statusCode, 200);
    assert.equal(borrado.body.success, true);
    assert.equal(consultas[0].sql, 'DELETE FROM eventos WHERE id_evento = ?');
    assert.deepEqual(consultas[0].params, ['12']);

    afectadas = 0;
    const inexistente = respuesta();
    await cms.eliminarEventoAdmin({params: {id: '12'}, usuarioId: 1}, inexistente);
    assert.equal(inexistente.statusCode, 404);
});

test('eventos: el panel calcula estados vencidos sin alterar datos SQL', async () => {
    let consulta;
    const db = { promise() { return { query: async (sql, params) => {
        consulta = {sql, params};
        return [[{id_evento:1, estado:'completado'}]];
    }}; }};
    const cms = cargarConMocks('../controllers/cmsController', {'../config/db': db});
    const res = respuesta();
    await cms.obtenerEventosAdmin({}, res);
    assert.equal(res.statusCode, 200);
    assert.match(consulta.sql, /CASE WHEN COALESCE\(estado, 'proximo'\)/);
    assert.match(consulta.sql, /fecha_evento < \(\?::date::timestamp AT TIME ZONE 'UTC'\)/);
    assert.match(consulta.sql, /THEN 'completado'/);
    assert.doesNotMatch(consulta.sql, /UPDATE eventos/);
    assert.deepEqual(consulta.params, [hoyCaracasISO()]);
});

test('pago válido: consulta restringida por propietario y ambos estados', () => {
    const consultas = [];
    const db = { query(sql, params, cb) {
        consultas.push({sql, params});
        cb(null, { affectedRows: 1, insertId: 77 });
    }};
    const pagos = cargarConMocks('../controllers/pagosController', {
        '../config/db': db,
        '../utils/auditLogger': { logUploadEvent() {} }
    });
    const res = respuesta();
    pagos.reportarPago({ body: datosPago(), usuarioId: 5, ip: '127.0.0.1' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(consultas.length, 1);
    const {sql, params} = consultas[0];
    assert.match(sql, /INSERT INTO pagos[\s\S]+SELECT a\.id_atleta/);
    assert.match(sql, /a\.estado = 'activo'/);
    assert.match(sql, /u\.estado = 'aprobado'/);
    assert.match(sql, /u\.rol = 'representante'/);
    assert.match(sql, /a\.id_representante = \?/);
    assert.match(sql, /RETURNING id_pago/);
    assert.equal(params.at(-2), '12');
    assert.equal(params.at(-1), 5);
});

test('pago no elegible: ninguna fila insertada devuelve 409', () => {
    const db = { query(sql, params, cb) { cb(null, { affectedRows: 0 }); } };
    const pagos = cargarConMocks('../controllers/pagosController', {
        '../config/db': db, '../utils/auditLogger': { logUploadEvent() {} }
    });
    const res = respuesta();
    pagos.reportarPago({ body: datosPago(), usuarioId: 5 }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
});

test('reporte: entradas inválidas devuelven 400 sin consulta SQL', () => {
    let consultas = 0;
    const db = { query() { consultas++; } };
    const pagos = cargarConMocks('../controllers/pagosController', {
        '../config/db': db, '../utils/auditLogger': { logUploadEvent() {} }
    });
    const casos = [
        { id_atleta: '12x' }, { monto: '25xyz' }, { monto: '0' },
        { monto: '10.222' }, { mes: 'Inexistente' },
        { fecha_pago: '2026-02-30' }, { fecha_pago: 'hoy' },
        { moneda: 'EUR' }, { metodo: 'Tarjeta' }
    ];
    for (const cambio of casos) {
        const res = respuesta();
        pagos.reportarPago({ body: datosPago(cambio), usuarioId: 5 }, res);
        assert.equal(res.statusCode, 400, JSON.stringify(cambio));
    }
    assert.equal(consultas, 0);
});

test('transferencia exige comprobante; el método controla la moneda', () => {
    const pagos = cargarConMocks('../controllers/pagosController', {
        '../config/db': { query() { throw new Error('No debe consultar'); } },
        '../utils/auditLogger': { logUploadEvent() {} }
    });
    for (const cambio of [
        { metodo: 'Transferencia Bancaria', moneda: 'Bs' },
        { metodo: 'Transferencia Bancaria', moneda: 'USD' },
        { metodo: 'Efectivo', moneda: 'EUR' }
    ]) {
        const res = respuesta();
        pagos.reportarPago({ body: datosPago(cambio), usuarioId: 5 }, res);
        assert.equal(res.statusCode, 400);
    }
});

test('fallo SQL de inserción devuelve 500 sin éxito falso', () => {
    const db = { query(sql, params, cb) { cb(new Error('simulado')); } };
    const pagos = cargarConMocks('../controllers/pagosController', {
        '../config/db': db, '../utils/auditLogger': { logUploadEvent() {} }
    });
    const res = respuesta();
    const oldError = console.error; console.error = () => {};
    try { pagos.reportarPago({ body: datosPago(), usuarioId: 5 }, res); }
    finally { console.error = oldError; }
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
});

test('login: cuenta inactiva o representante no aprobado no obtiene cookie', () => {
    const db = { query(sql, params, cb) {
        cb(null, [{ id_usuario: 5, rol: 'representante', estado: db.estado,
            password_hash: 'hash' }]);
    }};
    const auth = cargarConMocks('../controllers/authController', {
        '../config/db': db,
        bcrypt: { compare: async () => true, hash: async () => 'hash' },
        jsonwebtoken: { sign: () => 'token' },
        '../utils/requestLogger': { logAdminRequest() {} }
    });
    for (const estado of ['inactivo', 'pendiente', 'rechazado', 'otro']) {
        db.estado = estado;
        const res = respuesta();
        auth.login({ body: { email: 'rep@example.org', password: 'abc12345' } }, res);
        assert.equal(res.statusCode, 403, estado);
        assert.equal(res.body.success, false);
    }
});

// CORS no es un control de autorización, pero la lista de sitios que pueden
// leer respuestas con cookies y la protección de escritura deben ser exactas.
test('orígenes: permite producción configurada y el propio Preview, no otros Vercel', () => {
    const { crearPoliticaOrigen, origenCanonico } = require('../utils/origenesPermitidos');
    const politica = crearPoliticaOrigen({
        corsOrigin: 'https://jaguares-eta.vercel.app,https://otra-app.autorizada.example',
        vercel: true
    });
    const req = { protocol: 'http', get: nombre =>
        nombre.toLowerCase() === 'host' ? 'jaguares-git-preview-vercel.vercel.app' : undefined
    };
    for (const valido of [
        'https://jaguares-eta.vercel.app',
        'https://otra-app.autorizada.example',
        'https://jaguares-git-preview-vercel.vercel.app'
    ]) assert.equal(politica.permitido(req, valido), true, valido);

    for (const malo of [
        'https://atacante.vercel.app',
        'https://evil-onrender.com',
        'https://jaguares-eta.vercel.app.atacante.example',
        'https://otra-app.autorizada.example.evil.test',
        'https://jaguares-git-preview-vercel.vercel.app.evil.test',
        'https://jaguares-git-preview-vercel.vercel.app/',
        'http://jaguares-git-preview-vercel.vercel.app',
        'null', 'https://jaguares-eta.vercel.app/path', '',
        'https://atacante@jaguares-eta.vercel.app'
    ]) assert.equal(politica.permitido(req, malo), false, malo);
    assert.equal(origenCanonico('https://ejemplo.test/'), null);
});

test('orígenes: local solo acepta HTTP en host propio o CORS_ORIGIN explícito', () => {
    const { crearPoliticaOrigen } = require('../utils/origenesPermitidos');
    const politica = crearPoliticaOrigen({ corsOrigin: 'https://integracion.example', port: 3000 });
    const req = { protocol: 'http', get: n => n === 'host' ? '127.0.0.1:34343' : null };
    assert.equal(politica.permitido(req, 'http://127.0.0.1:34343'), true);
    assert.equal(politica.permitido(req, 'https://integracion.example'), true);
    assert.equal(politica.permitido(req, 'https://127.0.0.1:34343'), false);
    assert.equal(politica.permitido(req, 'http://evil.vercel.app'), false);
});

test('orígenes: POST cross-site falla con 403 incluso sin necesidad de CORS', () => {
    const { crearPoliticaOrigen } = require('../utils/origenesPermitidos');
    const politica = crearPoliticaOrigen({ corsOrigin: 'https://club.example', vercel: true });
    let siguientes = 0;
    const req = {
        method: 'POST', path: '/api/pagos/reportar',
        protocol: 'http',
        get: nombre => ({
            host: 'club.example',
            origin: 'https://atacante.vercel.app',
            'sec-fetch-site': 'cross-site'
        })[nombre]
    };
    const res = {codigo:200, payload:null,
        status(n) {this.codigo=n;return this},
        json(p) {this.payload=p;return this}
    };
    politica.protegerEscrituras(req,res,()=>siguientes++);
    assert.equal(res.codigo,403);
    assert.equal(res.payload.success,false);
    assert.equal(siguientes,0);

    req.get = nombre => ({
        host: 'club.example',
        origin: undefined,
        'sec-fetch-site': 'cross-site'
    })[nombre];
    res.codigo=200;
    politica.protegerEscrituras(req,res,()=>siguientes++);
    assert.equal(res.codigo,403);
    assert.equal(siguientes,0);

    req.get = nombre => ({
        host: 'club.example',
        origin: 'https://club.example',
        'sec-fetch-site': 'same-origin'
    })[nombre];
    politica.protegerEscrituras(req,res,()=>siguientes++);
    assert.equal(siguientes,1);
    req.method='GET';
    req.get=nombre => ({host:'club.example',origin:'https://atacante.vercel.app'})[nombre];
    politica.protegerEscrituras(req,res,()=>siguientes++);
    assert.equal(siguientes,2);
});
