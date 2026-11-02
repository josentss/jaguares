const test = require('node:test');
const assert = require('node:assert/strict');
const { validarDestinoTemporal } = require('./helpers/postgres');

test('PostgreSQL de prueba: solo destino local explícito, sin parámetros que reemplacen la conexión', () => {
    for (const url of [
        'postgres://postgres@127.0.0.1:55439/jaguares_test?sslmode=disable',
        'postgresql://postgres:postgres@localhost/jaguares_test',
        'postgres://postgres@[::1]/jaguares_test'
    ]) assert.doesNotThrow(() => validarDestinoTemporal(url));
    for (const url of [undefined, '', 'no-es-url',
        'postgres://postgres@db.example.org/jaguares_test',
        'postgres://postgres@localhost/produccion',
        'https://localhost/jaguares_test',
        'postgres://postgres@localhost/jaguares_test?host=db.example.org',
        'postgres://postgres@localhost/jaguares_test?dbname=produccion',
        'postgres://postgres@localhost/jaguares_test?options=-csearch_path=public'
    ]) assert.throws(() => validarDestinoTemporal(url), /local desechable/);
});
