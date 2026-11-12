'use strict';

// Conciliación visual; ninguna carga crea deuda por sí misma.
(function (raiz) {
    const porId = id => document.getElementById(id);
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
        'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    let habilitado = false;
    let cargando = false;
    let guardando = false;
    let atletas = [];
    let detalle = null;
    let versionDetalle = 0;

    function fechaCaracas() {
        const partes = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date());
        const dato = tipo => partes.find(p => p.type === tipo)?.value;
        return `${dato('year')}-${dato('month')}-${dato('day')}`;
    }

    function soloFecha(valor) {
        const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(valor || ''));
        return m ? m[1] : '';
    }

    function fechaVisible(valor) {
        const fecha = soloFecha(valor);
        if (!fecha) return '—';
        const [anio, mes, dia] = fecha.split('-');
        return `${dia}/${mes}/${anio}`;
    }

    function mostrar(texto, error = false, id = 'cobros-estado') {
        const nodo = porId(id);
        if (!nodo) return;
        nodo.textContent = texto;
        nodo.dataset.error = String(error);
    }

    function nodoVacio(texto, columnas) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = columnas;
        td.textContent = texto;
        tr.append(td);
        return tr;
    }

    function actualizarAviso() {
        const aviso = porId('cobros-aviso');
        if (!detalle || detalle.atleta.fecha_inicio) return;
        const fecha = porId('cobros-fecha-inicio').value;
        const mes = Number(fecha.slice(5, 7));
        const nombreMes = MESES[mes - 1];
        const repetidos = nombreMes ? detalle.pagos.filter(p =>
            String(p.mes_pagado || '').trim().toLocaleLowerCase('es') === nombreMes.toLocaleLowerCase('es') &&
            ['aprobado','pendiente'].includes(p.estado_pago)
        ) : [];
        if (repetidos.length) {
            aviso.textContent = `Atención: hay ${repetidos.length} pago(s) pendientes o aprobados declarados para ${nombreMes}.
                Como no consta el año, verifica que no estés cobrando de nuevo ese período.`;
            aviso.dataset.error = 'true';
        } else {
            aviso.textContent = 'La activación no modifica los pagos anteriores ni genera obligaciones.';
            aviso.dataset.error = 'false';
        }
    }

    function mostrarDetalle() {
        const contenedor = porId('cobros-detalle');
        const formulario = porId('cobros-form');
        const atleta = detalle?.atleta;
        contenedor.hidden = !atleta;
        formulario.reset();
        if (!atleta) return;

        porId('cobros-nombre').textContent = `${atleta.nombres} ${atleta.apellidos} · ID ${atleta.id_atleta}`;
        porId('cobros-condicion').textContent =
            `Atleta: ${atleta.estado}. Representante: ${atleta.estado_representante}.`;

        const pagos = detalle.pagos;
        const aprobados = pagos.filter(p => p.estado_pago === 'aprobado').length;
        const pendientes = pagos.filter(p => p.estado_pago === 'pendiente').length;
        const rechazados = pagos.filter(p => p.estado_pago === 'rechazado').length;
        porId('cobros-resumen-actual').textContent =
            `Pagos: ${pagos.length} (${aprobados} aprobados, ${pendientes} pendientes, ${rechazados} rechazados). ` +
            `Obligaciones nuevas: ${detalle.obligaciones.length}. ` +
            (atleta.fecha_inicio ? `Inicio ya configurado: ${fechaVisible(atleta.fecha_inicio)}, día ${atleta.dia_ancla}.` :
                'Inicio de cobro sin configurar.');

        const cuerpo = porId('cobros-pagos');
        cuerpo.replaceChildren();
        for (const pago of pagos) {
            const tr = document.createElement('tr');
            for (const valor of [
                `#${pago.id_pago}`,
                pago.mes_pagado || 'No indicado',
                fechaVisible(pago.fecha_pago),
                `${pago.monto ?? '—'} ${pago.moneda || ''}`.trim(),
                pago.estado_pago || '—'
            ]) {
                const td = document.createElement('td');
                td.textContent = valor;
                tr.append(td);
            }
            cuerpo.append(tr);
        }
        if (!pagos.length) cuerpo.append(nodoVacio('No hay pagos registrados para este atleta.', 5));

        const listo = atleta.estado === 'activo' && atleta.estado_representante === 'aprobado' &&
            atleta.rol_representante === 'representante' && !atleta.fecha_inicio;
        formulario.setAttribute('aria-disabled', String(!listo));
        for (const id of ['cobros-fecha-inicio','cobros-dia-ancla','cobros-historial-revisado','cobros-guardar']) {
            porId(id).disabled = !listo || guardando;
        }
        porId('cobros-fecha-inicio').min = fechaCaracas().slice(0, 7) + '-01';
        if (!listo) {
            mostrar(atleta.fecha_inicio ?
                'Este atleta ya tiene un inicio de cobro registrado. No se puede reemplazar desde el formulario.' :
                'Solo se puede activar a un atleta activo con representante aprobado.',
            false,'cobros-aviso');
        } else actualizarAviso();
    }

    async function cargarDetalle() {
        const id = porId('cobros-atleta').value;
        const revision = ++versionDetalle;
        detalle = null;
        porId('cobros-detalle').hidden = true;
        if (!id) { mostrar('Selecciona un atleta para consultar su historial.'); return; }
        mostrar('Consultando pagos y obligaciones…');
        try {
            const respuesta = await apiFetch(`/api/directiva/cobros/conciliacion/atletas/${encodeURIComponent(id)}`);
            const data = await respuesta.json();
            if (revision !== versionDetalle) return;
            if (!respuesta.ok || !data.success) throw new Error(data.message || 'No se pudo consultar');
            detalle = data;
            mostrarDetalle();
            mostrar('Historial cargado. La conciliación de pagos antiguos requiere revisión manual.');
        } catch (error) {
            if (revision === versionDetalle) mostrar(error.message || 'No se pudo cargar el historial.', true);
        }
    }

    function actualizarSelector() {
        const input = porId('cobros-buscar');
        const seleccion = porId('cobros-atleta');
        const previo = seleccion.value;
        const texto = input.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
        const filtrados = atletas.filter(a => {
            const nombre = `${a.apellidos} ${a.nombres}`.normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
            return !texto || nombre.includes(texto) || String(a.id_atleta) === texto;
        });
        seleccion.replaceChildren(new Option('Seleccionar atleta', ''));
        for (const atleta of filtrados) {
            const etiqueta = `${atleta.apellidos} ${atleta.nombres} · ID ${atleta.id_atleta}` +
                (atleta.fecha_inicio ? ' · Inicio configurado' : '');
            seleccion.add(new Option(etiqueta, String(atleta.id_atleta)));
        }
        if ([...seleccion.options].some(x => x.value === previo)) seleccion.value = previo;
        else if (previo) {
            detalle = null;
            ++versionDetalle;
            porId('cobros-detalle').hidden = true;
        }
        porId('cobros-total').textContent = `${filtrados.length} de ${atletas.length} atletas`;
    }

    async function cargar() {
        if (!habilitado || cargando || guardando) return;
        cargando = true;
        porId('cobros-recargar').disabled = true;
        mostrar('Cargando atletas…');
        try {
            const respuesta = await apiFetch('/api/directiva/cobros/conciliacion/atletas');
            const data = await respuesta.json();
            if (!respuesta.ok || !data.success) throw new Error(data.message || 'No se pudo consultar');
            atletas = Array.isArray(data.atletas) ? data.atletas : [];
            actualizarSelector();
            if (porId('cobros-atleta').value) await cargarDetalle();
            else mostrar('Selecciona un atleta para consultar su historial.');
        } catch (error) {
            mostrar(error.message || 'No se pudo cargar la lista.', true);
        } finally {
            cargando = false;
            porId('cobros-recargar').disabled = false;
        }
    }

    async function registrar(evento) {
        evento.preventDefault();
        if (!habilitado || guardando || !detalle || detalle.atleta.fecha_inicio) return;
        const atleta = detalle.atleta;
        const id = String(atleta.id_atleta);
        if (porId('cobros-atleta').value !== id) return;
        const fecha = porId('cobros-fecha-inicio').value;
        const dia = Number(porId('cobros-dia-ancla').value);
        if (!fecha || fecha < fechaCaracas().slice(0, 7) + '-01' ||
            !Number.isInteger(dia) || dia < 1 || dia > 31 ||
            !porId('cobros-historial-revisado').checked) {
            mostrar('Revisa la fecha, el día de vencimiento y confirma el historial.', true, 'cobros-aviso');
            return;
        }
        if (!raiz.confirm(`¿Confirmas el inicio de cobro del atleta ${atleta.nombres} ${atleta.apellidos} ` +
            `a partir del ${fechaVisible(fecha)}, con vencimiento el día ${dia} de cada mes?\n\n` +
            'No se crearán mensualidades, pero este inicio solo podrá conciliarse posteriormente.')) return;

        guardando = true;
        porId('cobros-guardar').disabled = true;
        mostrar('Registrando inicio de cobro…',false,'cobros-aviso');
        try {
            const respuesta = await apiFetch(`/api/directiva/cobros/anclas/${encodeURIComponent(id)}`, {
                method:'POST', body: JSON.stringify({
                    fecha_inicio: fecha, dia_ancla: dia, historial_revisado: true
                })
            });
            const data = await respuesta.json();
            if (!respuesta.ok || !data.success) throw new Error(data.message || 'No se pudo registrar');
            const fila = atletas.find(x => Number(x.id_atleta) === Number(id));
            if (fila) { fila.fecha_inicio = fecha; fila.dia_ancla = dia; }
            actualizarSelector();
            await cargarDetalle();
            mostrar('Inicio registrado correctamente. No se han creado obligaciones.');
        } catch (error) {
            mostrar(error.message || 'No se pudo registrar el inicio.',true,'cobros-aviso');
        } finally {
            guardando = false;
            const actual = detalle?.atleta;
            porId('cobros-guardar').disabled = !actual || !!actual.fecha_inicio ||
                actual.estado !== 'activo' || actual.estado_representante !== 'aprobado';
        }
    }

    function inicializar(rol) {
        habilitado = rol === 'directiva' || rol === 'admin';
        porId('nav-conciliacion-cobros').hidden = !habilitado;
        porId('cobros-panel').hidden = !habilitado;
        if (!habilitado) return;
        porId('cobros-recargar').addEventListener('click', cargar);
        porId('cobros-buscar').addEventListener('input', actualizarSelector);
        porId('cobros-atleta').addEventListener('change', cargarDetalle);
        porId('cobros-fecha-inicio').addEventListener('change', actualizarAviso);
        porId('cobros-form').addEventListener('submit', registrar);
    }

    raiz.JaguaresConciliacion = { inicializar, cargar };
})(window);
