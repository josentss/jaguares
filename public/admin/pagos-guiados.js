'use strict';

// Interfaz de reportes ligada a obligaciones: no decide montos de conversión.
// El backend valida propiedad, periodo, estado y duplicados por separado.
(function (root) {
    const byId = id => document.getElementById(id);
    const CONCEPTOS = Object.freeze({
        inscripcion: 'Inscripción',
        mensualidad: 'Mensualidad',
        torneo: 'Torneo',
        arbitraje: 'Arbitraje',
        sancion: 'Sanción'
    });
    const DISPONIBLES = new Set(['pendiente','en_plazo','morosa']);
    let iniciado = false;
    let estado = 'sin-atleta';
    let secuencia = 0;
    let obligaciones = [];
    let monedaAnterior = '';
    let seleccionAnterior = '';

    function hoyCaracas() {
        const partes = new Intl.DateTimeFormat('en-US', {
            timeZone:'America/Caracas', year:'numeric',month:'2-digit',day:'2-digit'
        }).formatToParts(new Date());
        const valor = nombre => partes.find(p => p.type === nombre)?.value;
        return `${valor('year')}-${valor('month')}-${valor('day')}`;
    }

    function periodoDe(hoy) { return hoy.slice(0,7) + '-01'; }

    function siguientePeriodo(periodo) {
        const [anio, mes] = periodo.split('-').map(Number);
        return `${anio + (mes === 12 ? 1 : 0)}-${String(mes === 12 ? 1 : mes + 1).padStart(2, '0')}-01`;
    }

    function rotulo(o) {
        const concepto = CONCEPTOS[o.codigo_concepto] || 'Cargo';
        const periodo = o.codigo_concepto === 'mensualidad' && o.periodo_mes ?
            ' · ' + o.periodo_mes.slice(0, 7) : '';
        return `${concepto}${periodo} · USD ${Number(o.monto_usd).toFixed(2)}`;
    }

    function mensaje(texto, error = false) {
        const nodo = byId('pay-guia-estado');
        nodo.textContent = texto;
        nodo.dataset.error = String(error);
    }

    function setMode(nuevo) {
        estado = nuevo;
        const vinculado = nuevo === 'vinculado' || nuevo === 'sin-obligaciones';
        const legacy = !vinculado;
        byId('pay-mes-wrap').hidden = !legacy;
        byId('pay-mes').disabled = !legacy;
        byId('pay-mes').required = legacy;
        byId('pay-obligacion-wrap').hidden = !vinculado;
        byId('pay-obligacion').disabled = !vinculado || nuevo !== 'vinculado';
        byId('pay-obligacion').required = nuevo === 'vinculado';
        byId('pay-intro').textContent = vinculado ?
            'Selecciona el cargo y reporta el pago para revisión.' :
            'Reporta tu pago para revisión.';
        const boton = byId('form-report-pago').querySelector('button[type="submit"]');
        boton.disabled = !['legacy','vinculado'].includes(nuevo) ||
            (nuevo === 'vinculado' && !byId('pay-obligacion').value) ||
            !byId('pay-atleta').value;
        actualizarMonto();
    }

    function actualizarMonto() {
        const vinculado = estado === 'vinculado';
        const seleccion = obligaciones.find(o =>
            String(o.id_obligacion) === byId('pay-obligacion').value);
        const moneda = byId('pay-metodo').value === 'Transferencia Bancaria' ?
            'Bs' : byId('pay-moneda-efec').value;
        const clave = [vinculado ? 'vinculado' : 'legacy', seleccion?.id_obligacion || '',
            byId('pay-metodo').value, moneda].join('|');
        const efectivo = byId('pay-monto-efec');
        if (clave !== seleccionAnterior) {
            efectivo.readOnly = false;
            if (vinculado && seleccion && moneda === 'USD' &&
                byId('pay-metodo').value === 'Efectivo') {
                efectivo.value = Number(seleccion.monto_usd).toFixed(2);
                efectivo.readOnly = true;
            } else if (vinculado && seleccion && monedaAnterior === 'USD' &&
                moneda !== 'USD') {
                efectivo.value = '';
            }
        }
        seleccionAnterior = clave;
        monedaAnterior = moneda;
        const aviso = byId('pay-guia-monto');
        if (!vinculado || !seleccion) { aviso.textContent = ''; return; }
        aviso.textContent = `Cargo: USD ${Number(seleccion.monto_usd).toFixed(2)}` +
            (moneda !== 'USD' ? ' · Indica el importe entregado; Directiva validará la equivalencia.' : '');
    }

    function seleccion() {
        if (estado === 'legacy') return { modo: 'legacy' };
        if (estado !== 'vinculado') return { modo: 'bloqueado' };
        const id = byId('pay-obligacion').value;
        if (!id || !obligaciones.some(o => String(o.id_obligacion) === id)) {
            return { modo: 'bloqueado' };
        }
        return { modo: 'vinculado', id_obligacion: id };
    }

    async function refrescar() {
        const id = byId('pay-atleta').value;
        const actual = ++secuencia;
        obligaciones = [];
        byId('pay-obligacion').replaceChildren(new Option('Seleccionar cargo', ''));
        if (!id) {
            mensaje('');
            setMode('sin-atleta');
            return;
        }
        setMode('cargando');
        mensaje('Consultando cobros…');
        try {
            const respuesta = await apiFetch('/api/pagos/obligaciones/' + encodeURIComponent(id));
            const data = await respuesta.json();
            if (actual !== secuencia || id !== byId('pay-atleta').value) return;
            if (!respuesta.ok || !data.success) throw new Error(data.message || 'No se pudo consultar');
            const todas = Array.isArray(data.obligaciones) ? data.obligaciones : [];
            if (!data.ancla && !todas.length) {
                mensaje('');
                setMode('legacy');
                return;
            }
            const actualMes = periodoDe(hoyCaracas());
            const siguiente = siguientePeriodo(actualMes);
            obligaciones = todas.filter(o => DISPONIBLES.has(o.estado) &&
                (!o.fecha_emision || o.fecha_emision <= hoyCaracas()) &&
                (o.codigo_concepto !== 'mensualidad' ||
                    (o.periodo_mes && o.periodo_mes <= siguiente)));
            for (const obligacion of obligaciones) {
                byId('pay-obligacion').add(new Option(
                    rotulo(obligacion), String(obligacion.id_obligacion)));
            }
            if (!obligaciones.length) {
                mensaje('No hay cargos disponibles para reportar.');
                setMode('sin-obligaciones');
                return;
            }
            byId('pay-obligacion').value = String(obligaciones[0].id_obligacion);
            mensaje('');
            setMode('vinculado');
        } catch (error) {
            if (actual !== secuencia) return;
            mensaje(error.message || 'Error al consultar cobros.', true);
            setMode('error');
        }
    }

    function iniciar() {
        if (iniciado) return;
        iniciado = true;
        byId('pay-atleta').addEventListener('change', refrescar);
        byId('pay-obligacion').addEventListener('change', () => {
            setMode(estado);
        });
        byId('pay-metodo').addEventListener('change', actualizarMonto);
        byId('pay-moneda-efec').addEventListener('change', actualizarMonto);
        setMode('sin-atleta');
    }

    root.JaguaresPagosGuiados = { iniciar, refrescar, seleccion };
})(window);
