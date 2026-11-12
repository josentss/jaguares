'use strict';

// Estado de cuenta informativo: nunca reporta pagos ni crea obligaciones.
(function (raiz) {
    const el = id => document.getElementById(id);
    const concepto = Object.freeze({
        inscripcion: 'Inscripción',
        mensualidad: 'Mensualidad',
        torneo: 'Torneo',
        arbitraje: 'Arbitraje',
        sancion: 'Sanción'
    });
    const estados = Object.freeze({
        pagada: 'Pagada',
        en_revision: 'En revisión',
        pendiente: 'Por pagar',
        en_plazo: 'En plazo',
        morosa: 'Vencida'
    });
    let idUsuario = null;
    let atletas = [];
    let cargando = false;
    let secuencia = 0;

    function fecha(valor) {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor || ''));
        return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
    }

    function mes(valor) {
        const m = /^(\d{4})-(\d{2})-01/.exec(String(valor || ''));
        return m ? `${m[2]}/${m[1]}` : '—';
    }

    function aviso(texto, error = false) {
        const nodo = el('cuenta-estado');
        nodo.textContent = texto;
        nodo.dataset.error = String(error);
    }

    function celda(fila, contenido) {
        const td = document.createElement('td');
        td.textContent = contenido;
        fila.append(td);
        return td;
    }

    function pintar(info) {
        const detalle = el('cuenta-detalle');
        const cuerpo = el('cuenta-obligaciones');
        const resumen = el('cuenta-resumen');
        const nota = el('cuenta-nota');
        cuerpo.replaceChildren();
        const obligaciones = Array.isArray(info.obligaciones) ? info.obligaciones : [];
        detalle.hidden = false;

        if (!obligaciones.length) {
            resumen.textContent = info.ancla ?
                'Aún no se han asignado cobros a este atleta.' :
                'Inicio de cobro pendiente de configurar.';
            const tr = document.createElement('tr');
            celda(tr, 'Sin obligaciones registradas').colSpan = 5;
            cuerpo.append(tr);
            nota.textContent = '';
            aviso('');
            return;
        }

        const porAtender = obligaciones.filter(o =>
            ['pendiente', 'en_plazo', 'morosa'].includes(o.estado)).length;
        const revision = obligaciones.filter(o => o.estado === 'en_revision').length;
        const pagadas = obligaciones.filter(o => o.estado === 'pagada').length;
        resumen.textContent = `${porAtender} por atender · ${revision} en revisión · ${pagadas} pagadas`;
        for (const obligacion of obligaciones) {
            const tr = document.createElement('tr');
            celda(tr, concepto[obligacion.codigo_concepto] || 'Otro cargo');
            celda(tr, obligacion.codigo_concepto === 'mensualidad' ?
                mes(obligacion.periodo_mes) : (obligacion.detalle || '—'));
            const monto = Number(obligacion.monto_usd);
            celda(tr, Number.isFinite(monto) && monto > 0 ? `USD ${monto.toFixed(2)}` : '—');
            const limite = fecha(obligacion.fecha_limite);
            celda(tr, `${fecha(obligacion.fecha_vencimiento)} · Límite ${limite}`);
            const estado = celda(tr, estados[obligacion.estado] || 'Por verificar');
            estado.className = 'cuenta-estado-' +
                (Object.hasOwn(estados, obligacion.estado) ? obligacion.estado : 'pendiente');
            cuerpo.append(tr);
        }
        nota.textContent = 'Los reportes de pago actuales aún no se vinculan al estado de cuenta.';
        aviso('');
    }

    async function consultarAtleta() {
        const id = el('cuenta-atleta').value;
        const actual = ++secuencia;
        el('cuenta-detalle').hidden = true;
        if (!id) { aviso('Selecciona un atleta.'); return; }
        if (!atletas.some(a => String(a.id_atleta) === id)) {
            aviso('Atleta no disponible.', true);
            return;
        }
        aviso('Consultando cobros…');
        try {
            const respuesta = await apiFetch('/api/pagos/obligaciones/' + encodeURIComponent(id));
            const datos = await respuesta.json();
            if (actual !== secuencia || id !== el('cuenta-atleta').value) return;
            if (!respuesta.ok || datos.success !== true || Number(datos.id_atleta) !== Number(id)) {
                throw new Error(datos.message || 'No se pudieron consultar las obligaciones');
            }
            pintar(datos);
        } catch (error) {
            if (actual === secuencia) aviso(error.message || 'No se pudieron cargar los cobros.', true);
        }
    }

    async function cargar() {
        if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0 || cargando) return;
        cargando = true;
        const actual = ++secuencia;
        const select = el('cuenta-atleta');
        const previo = select.value;
        const boton = el('cuenta-actualizar');
        boton.disabled = true;
        el('cuenta-detalle').hidden = true;
        aviso('Actualizando atletas…');
        try {
            const respuesta = await apiFetch('/api/atletas/representante/' + idUsuario);
            const datos = await respuesta.json();
            if (actual !== secuencia) return;
            if (!respuesta.ok || datos.success !== true || !Array.isArray(datos.atletas)) {
                throw new Error(datos.message || 'No se pudieron consultar los atletas');
            }
            atletas = datos.atletas.filter(a => Number.isSafeInteger(Number(a.id_atleta)) &&
                Number(a.id_atleta) > 0);
            select.replaceChildren(new Option('Seleccionar atleta', ''));
            for (const atleta of atletas) {
                select.add(new Option(`${atleta.nombres} ${atleta.apellidos}`,
                    String(atleta.id_atleta)));
            }
            if (atletas.some(a => String(a.id_atleta) === previo)) select.value = previo;
            else if (atletas.length === 1) select.value = String(atletas[0].id_atleta);
            if (!atletas.length) aviso('Aún no tienes atletas registrados.');
            else if (select.value) await consultarAtleta();
            else aviso('Selecciona un atleta.');
        } catch (error) {
            if (actual === secuencia) aviso(error.message || 'No se pudieron cargar los atletas.', true);
        } finally {
            cargando = false;
            boton.disabled = false;
        }
    }

    function inicializar(usuario) {
        const id = Number(usuario);
        if (!Number.isSafeInteger(id) || id <= 0 || idUsuario !== null) return;
        idUsuario = id;
        el('cuenta-actualizar').addEventListener('click', cargar);
        el('cuenta-atleta').addEventListener('change', consultarAtleta);
    }

    raiz.JaguaresEstadoCuenta = { inicializar, cargar };
})(window);
