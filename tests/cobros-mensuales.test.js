const test = require('node:test');
const assert = require('node:assert/strict');
const {
    fechaCivilValida, periodoValido, siguientePeriodo, planMensual,
    hoyCaracas, elegibilidad, estadoObligacion
} = require('../utils/cobrosMensuales');

test('fechas ISO estrictas y meses con o sin 29 de febrero', () => {
    assert.equal(fechaCivilValida('2026-02-29'), false);
    assert.equal(fechaCivilValida('2028-02-29'), true);
    assert.equal(fechaCivilValida('2026-13-01'), false);
    assert.equal(fechaCivilValida('2026-1-01'), false);
    assert.equal(periodoValido('2026-11-01'), true);
    assert.equal(periodoValido('2026-11-15'), false);
    assert.equal(siguientePeriodo('2026-12-01'), '2027-01-01');
});

test('ancla 15 mantiene vencimiento aunque se pague tarde; gracia hasta fin de mes', () => {
    const nov = planMensual('2026-11-01', 15);
    assert.deepEqual(nov, {
        periodo_mes: '2026-11-01', fecha_vencimiento: '2026-11-15',
        fecha_limite: '2026-11-30'
    });
    assert.equal(planMensual('2026-12-01', 15).fecha_vencimiento, '2026-12-15');
    assert.equal(estadoObligacion({ ...nov }, '2026-11-15'), 'pendiente');
    assert.equal(estadoObligacion({ ...nov }, '2026-11-28'), 'en_plazo');
    assert.equal(estadoObligacion({ ...nov }, '2026-12-01'), 'morosa');
    assert.equal(estadoObligacion({ ...nov, existe_pendiente: true }, '2026-12-01'), 'en_revision');
    assert.equal(estadoObligacion({ ...nov, existe_aprobado: true }, '2026-12-01'), 'pagada');
});

test('anclas 29, 30 y 31 se ajustan en meses cortos, incluyendo año bisiesto', () => {
    assert.equal(planMensual('2026-02-01', 31).fecha_vencimiento, '2026-02-28');
    assert.equal(planMensual('2028-02-01', 31).fecha_vencimiento, '2028-02-29');
    assert.equal(planMensual('2026-04-01', 31).fecha_vencimiento, '2026-04-30');
});

test('instante UTC de madrugada se interpreta según la fecha civil de Caracas', () => {
    assert.equal(hoyCaracas(new Date('2026-12-01T01:00:00Z')), '2026-11-30');
    assert.equal(hoyCaracas(new Date('2026-12-01T04:00:00Z')), '2026-12-01');
});

test('no backfill automático ni período posterior al mes siguiente', () => {
    assert.equal(elegibilidad('2026-10-01','2026-10-15',15,'2026-11-12').valida, false);
    assert.equal(elegibilidad('2027-01-01','2026-10-15',15,'2026-11-12').valida, false);
    assert.equal(elegibilidad('2026-11-01','2026-11-16',15,'2026-11-12').valida, false);
    assert.equal(elegibilidad('2026-11-01','2026-10-15',15,'2026-11-12').valida, true);
    assert.equal(elegibilidad('2026-12-01','2026-10-15',15,'2026-11-12').valida, true);
});
