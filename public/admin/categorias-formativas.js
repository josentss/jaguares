'use strict';

// ÚNICA regla etaria compartida por Express y los dos formularios.
// Valores verificados contra las tarjetas de /index.html el 10-11-2026.
// Es clasificación informativa por edad cumplida hoy en Caracas;
// NO determina elegibilidad competitiva ni asigna equipo/temporada.
(function (raiz, crear) {
    const modulo = crear();
    if (typeof module === 'object' && module.exports) module.exports = modulo;
    if (raiz) raiz.JaguaresCategoriasFormativas = modulo;
})(typeof window !== 'undefined' ? window : null, function () {
    const CATEGORIAS = Object.freeze([
        Object.freeze({ codigo: 'u7', nombre: 'U-7 Semillitas', edadMin: 5, edadMax: 7 }),
        Object.freeze({ codigo: 'u9', nombre: 'U-9 Iniciación', edadMin: 8, edadMax: 9 }),
        Object.freeze({ codigo: 'u11', nombre: 'U-11 Formación', edadMin: 10, edadMax: 11 }),
        Object.freeze({ codigo: 'u13', nombre: 'U-13 Mini Voleibol', edadMin: 12, edadMax: 13 }),
        Object.freeze({ codigo: 'u15', nombre: 'U-15 Infantil (M)', edadMin: 14, edadMax: 15,
            condicion: 'La categoría publicada es masculina: verificar elegibilidad con la directiva.' })
    ]);
    const fechaValida = valor => {
        if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
        const fecha = new Date(valor + 'T12:00:00Z');
        return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
    };
    function hoyCaracasISO(ahora = new Date()) {
        const partes = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(ahora);
        const dato = tipo => partes.find(x => x.type === tipo)?.value;
        return [dato('year'), dato('month'), dato('day')].join('-');
    }
    function clasificar(fechaNacimiento, hoy = hoyCaracasISO()) {
        if (!fechaValida(fechaNacimiento) || !fechaValida(hoy) || fechaNacimiento > hoy) {
            return { estado: 'fecha_invalida', edad: null, categoria: null,
                mensaje: 'Introduce una fecha de nacimiento válida.' };
        }
        const [an, mn, dn] = fechaNacimiento.split('-').map(Number);
        const [ah, mh, dh] = hoy.split('-').map(Number);
        const edad = ah - an - (mh < mn || (mh === mn && dh < dn) ? 1 : 0);
        if (edad < 5 || edad > 18) {
            return { estado: 'fuera_rango_inscripcion', edad, categoria: null,
                mensaje: 'La inscripción admite atletas de 5 a 18 años cumplidos.' };
        }
        const categoria = CATEGORIAS.find(c => edad >= c.edadMin && edad <= c.edadMax) || null;
        if (!categoria) return { estado: 'sin_categoria_publicada', edad, categoria: null,
            mensaje: 'La portada aún no indica una categoría para esta edad. Consultar a directiva.' };
        if (categoria.condicion) return { estado: 'requiere_validacion', edad,
            categoria: {codigo:categoria.codigo,nombre:categoria.nombre},
            mensaje: categoria.condicion };
        return { estado: 'orientativa', edad,
            categoria: {codigo:categoria.codigo,nombre:categoria.nombre},
            mensaje: 'Clasificación por edad cumplida; no asigna equipo ni temporada.' };
    }
    return Object.freeze({ CATEGORIAS, clasificar, hoyCaracasISO });
});
