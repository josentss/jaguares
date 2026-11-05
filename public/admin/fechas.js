/* Una fecha civil (DATE) conserva su día; un instante sí tiene zona horaria. */
(function (raiz, crear) {
    const fechas = crear();
    if (typeof module === 'object' && module.exports) module.exports = fechas;
    else raiz.FechasJaguares = fechas;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function esFechaISOValida(fecha) {
        if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
        const dia = new Date(fecha + 'T12:00:00Z');
        return !Number.isNaN(dia.getTime()) && dia.toISOString().slice(0, 10) === fecha &&
            Number(fecha.slice(0, 4)) >= 1900;
    }

    function hoyVenezuela(ahora = new Date()) {
        const partes = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(ahora);
        const parte = tipo => partes.find(p => p.type === tipo)?.value;
        return [parte('year'), parte('month'), parte('day')].join('-');
    }

    function limitesNacimientoAtleta(hoy = hoyVenezuela()) {
        if (!esFechaISOValida(hoy)) return null;
        const [year, mes, dia] = hoy.split('-').map(Number);
        // Si hoy es 29/02, el año de destino puede no ser bisiesto.
        const aniversario = edad => new Date(Date.UTC(year - edad, mes - 1,
            Math.min(dia, new Date(Date.UTC(year - edad, mes, 0)).getUTCDate())));
        const minimo = aniversario(19);
        minimo.setUTCDate(minimo.getUTCDate() + 1);
        return { min: minimo.toISOString().slice(0, 10), max: aniversario(5).toISOString().slice(0, 10) };
    }

    function limitesFechaEvento(hoy = hoyVenezuela()) {
        if (!esFechaISOValida(hoy)) return null;
        return { min: hoy, max: `${Number(hoy.slice(0, 4)) + 1}-12-31` };
    }

    function esEdadValida(fecha, hoy = hoyVenezuela()) {
        if (!esFechaISOValida(fecha)) return false;
        const limites = limitesNacimientoAtleta(hoy);
        return Boolean(limites && fecha >= limites.min && fecha <= limites.max);
    }

    function formatearFechaCivil(valor, opciones = {}) {
        // Admite la representación ISO anterior durante la transición del API.
        // No convierte ese texto en un instante ni desplaza su día.
        const texto = typeof valor === 'string' &&
            /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(valor)
            ? valor.slice(0, 10) : '';
        if (!esFechaISOValida(texto)) return 'N/A';
        return new Date(texto + 'T12:00:00Z').toLocaleDateString('es-VE', {
            ...opciones, timeZone: 'UTC'
        });
    }

    function formatearInstante(valor, opciones = {}) {
        if (!valor) return 'N/A';
        const instante = new Date(valor);
        if (Number.isNaN(instante.getTime())) return 'N/A';
        return instante.toLocaleDateString('es-VE', { ...opciones, timeZone: 'America/Caracas' });
    }

    return { esFechaISOValida, hoyVenezuela, limitesNacimientoAtleta, limitesFechaEvento, esEdadValida,
        formatearFechaCivil, formatearInstante };
});
