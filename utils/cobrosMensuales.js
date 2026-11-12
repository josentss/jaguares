'use strict';

// Fechas civiles del club: no usar el huso horario del servidor ni Date.parse
// para decidir meses y vencimientos.
function fechaCivilValida(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const fecha = new Date(valor + 'T00:00:00.000Z');
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function periodoValido(valor) {
    return fechaCivilValida(valor) && valor.endsWith('-01');
}

function periodoDe(fecha) {
    return fecha.slice(0, 7) + '-01';
}

function siguientePeriodo(periodo) {
    if (!periodoValido(periodo)) throw new TypeError('Período inválido');
    const [anio, mes] = periodo.split('-').map(Number);
    const siguiente = mes === 12 ? [anio + 1, 1] : [anio, mes + 1];
    return `${siguiente[0]}-${String(siguiente[1]).padStart(2, '0')}-01`;
}

function ultimoDia(anio, mes) {
    return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function planMensual(periodo, diaAncla) {
    if (!periodoValido(periodo) || !Number.isInteger(diaAncla) ||
        diaAncla < 1 || diaAncla > 31) throw new TypeError('Período o día inválido');
    const [anio, mes] = periodo.split('-').map(Number);
    const ultimo = ultimoDia(anio, mes);
    const prefijo = periodo.slice(0, 7);
    return {
        periodo_mes: periodo,
        fecha_vencimiento: `${prefijo}-${String(Math.min(diaAncla, ultimo)).padStart(2, '0')}`,
        fecha_limite: `${prefijo}-${String(ultimo).padStart(2, '0')}`
    };
}

function hoyCaracas(instante = new Date()) {
    const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(instante);
    const dato = nombre => partes.find(p => p.type === nombre)?.value;
    return `${dato('year')}-${dato('month')}-${dato('day')}`;
}

// Periodos previos solo podrán generarse mediante una conciliación histórica
// posterior; no conceder una vía de backfill sin revisión individual.
function elegibilidad(periodo, fechaInicio, diaAncla, hoy = hoyCaracas()) {
    if (!periodoValido(periodo) || !fechaCivilValida(fechaInicio) ||
        !fechaCivilValida(hoy)) return { valida: false, motivo: 'Fecha o período inválido' };
    const mesActual = periodoDe(hoy);
    if (periodo < mesActual || periodo > siguientePeriodo(mesActual)) {
        return { valida: false, motivo: 'Solo se permite el mes actual o el siguiente' };
    }
    if (periodo < periodoDe(fechaInicio)) {
        return { valida: false, motivo: 'El período es anterior al inicio de cobro' };
    }
    const plan = planMensual(periodo, diaAncla);
    if (plan.fecha_vencimiento < fechaInicio) {
        return { valida: false, motivo: 'El vencimiento es anterior al inicio de cobro' };
    }
    return { valida: true, plan };
}

function estadoObligacion(obligacion, hoy = hoyCaracas()) {
    if (obligacion.existe_aprobado) return 'pagada';
    if (obligacion.existe_pendiente) return 'en_revision';
    if (hoy > obligacion.fecha_limite) return 'morosa';
    if (hoy > obligacion.fecha_vencimiento) return 'en_plazo';
    return 'pendiente';
}

module.exports = {
    fechaCivilValida, periodoValido, periodoDe, siguientePeriodo,
    planMensual, hoyCaracas, elegibilidad, estadoObligacion
};
