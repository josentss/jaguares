const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'synthetic-session-header-test-secret';
process.env.DATABASE_URL = 'postgres://fixture:fixture@127.0.0.1:1/jaguares_test';
process.env.TRUST_PROXY = '0';
const dbPath = require.resolve('../config/db');
const noDatabase = () => { throw new Error('Esta prueba no debe consultar la base de datos'); };
require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: { query: noDatabase, promise: noDatabase, pool: { connect: noDatabase } }
};
const app = require('../index');

let server;
let baseUrl;

test.before(async () => {
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = 'http://127.0.0.1:' + server.address().port;
});

test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
});

for (const panel of ['directiva', 'representante']) {
    test(`el HTML del panel ${panel} lleva Cache-Control no-store`, async () => {
        const response = await fetch(baseUrl + '/admin/panel-' + panel + '.html');
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
    });
}

test('las APIs no almacenan respuestas de sesión, incluso al rechazar una solicitud anónima', async () => {
    const response = await fetch(baseUrl + '/api/auth/me');
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('el cierre real responde con una cookie de sesión caducada', async () => {
    const response = await fetch(baseUrl + '/api/auth/logout', {
        method: 'POST', headers: { Cookie: 'token=synthetic-session-fixture' }
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
    assert.match(response.headers.get('set-cookie'), /token=;.*expires=Thu, 01 Jan 1970/i);
    assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('un JSON inválido también recibe Cache-Control no-store', async () => {
    const response = await fetch(baseUrl + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{'
    });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
});
