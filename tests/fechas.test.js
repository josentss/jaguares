const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fechas = require('../public/admin/fechas');
const { esEdadAtletaValida } = require('../utils/validators');

test('edad: servidor y navegador coinciden en cumpleaños de cinco y diecinueve años, incluidos bisiestos', () => {
    for (const [hoy, min, max] of [
        ['2026-11-02', '2007-11-03', '2021-11-02'],
        ['2028-02-29', '2009-03-01', '2023-02-28'],
        ['2027-02-28', '2008-02-29', '2022-02-28'],
        ['2027-03-01', '2008-03-02', '2022-03-01']
    ]) {
        assert.deepEqual(fechas.limitesNacimientoAtleta(hoy), {min, max});
        const anterior = new Date(min + 'T12:00:00Z');
        anterior.setUTCDate(anterior.getUTCDate() - 1);
        const posterior = new Date(max + 'T12:00:00Z');
        posterior.setUTCDate(posterior.getUTCDate() + 1);
        for (const [nacimiento, esperado] of [
            [min, true], [max, true], [anterior.toISOString().slice(0, 10), false],
            [posterior.toISOString().slice(0, 10), false], [hoy, false],
            ['2026-02-30', false], [null, false]
        ]) {
            assert.equal(fechas.esEdadValida(nacimiento, hoy), esperado, `${hoy}: ${nacimiento}`);
            assert.equal(esEdadAtletaValida(nacimiento, hoy), esperado, `${hoy}: ${nacimiento}`);
        }
    }
});

test('día del club: medianoche UTC todavía puede pertenecer al día anterior en Caracas', () => {
    assert.equal(fechas.hoyVenezuela(new Date('2026-11-03T03:59:59Z')), '2026-11-02');
    assert.equal(fechas.hoyVenezuela(new Date('2026-11-03T04:00:00Z')), '2026-11-03');
});

test('fechas civiles e instantes conservan su significado en diferentes zonas del proceso', () => {
    const script = `
        const fechas = require('./public/admin/fechas');
        const db = require('./config/db');
        const { Client, types } = require('pg');
        const cliente = new Client(db.pool.options);
        const civil = cliente.getTypeParser(types.builtins.DATE, 'text')('2026-11-02');
        const instante = cliente.getTypeParser(types.builtins.TIMESTAMPTZ, 'text')('2026-11-03 01:00:00+00');
        process.stdout.write(JSON.stringify({
            civil, tipoCivil: typeof civil,
            visual: fechas.formatearFechaCivil(civil),
            anterior: fechas.formatearFechaCivil('2026-11-02T00:00:00.000Z'),
            instante: instante.toISOString(), visualInstante: fechas.formatearInstante(instante),
            parserGlobalIntacto: types.getTypeParser(types.builtins.DATE, 'text')('2026-11-02') instanceof Date
        }));
    `;
    for (const TZ of ['UTC', 'America/Caracas', 'Asia/Tokyo', 'Pacific/Apia']) {
        const salida = execFileSync(process.execPath, ['-e', script], {
            cwd: path.resolve(__dirname, '..'),
            env: {...process.env, DATABASE_URL: '', TZ}, encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        assert.deepEqual(JSON.parse(salida), {
            civil: '2026-11-02', tipoCivil: 'string', visual: '2/11/2026', anterior: '2/11/2026',
            instante: '2026-11-03T01:00:00.000Z', visualInstante: '2/11/2026', parserGlobalIntacto: true
        }, TZ);
    }
});

test('formato civil: rechaza fechas imposibles y no interpreta entradas como HTML', () => {
    for (const invalida of ['2026-02-30', '2026-13-01', '02/11/2026', '', null, {},
        '<img src=x onerror=alert(1)>', '2026-11-02T<script>']) {
        assert.equal(fechas.formatearFechaCivil(invalida), 'N/A');
    }
});
