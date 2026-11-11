'use strict';

(function (raiz) {
    const porId = id => document.getElementById(id);
    let permitido = false;
    let cargando = false;
    let catalogo = { temporadas: [], categorias: [], equipos: [] };
    let atletas = [];
    let movimientos = [];

    function estado(texto, error = false) {
        const nodo = porId('asignaciones-estado');
        nodo.textContent = texto;
        nodo.dataset.error = error ? 'true' : 'false';
    }

    function poblar(select, filas, id, etiqueta, vacio) {
        const anterior = select.value;
        select.replaceChildren(new Option(vacio, ''));
        for (const fila of filas) select.add(new Option(etiqueta(fila), String(fila[id])));
        if ([...select.options].some(opcion => opcion.value === anterior)) select.value = anterior;
    }

    function temporadaEquipo(equipo) {
        const categoria = catalogo.categorias.find(fila => fila.id_categoria === equipo.id_categoria);
        return categoria?.id_temporada;
    }

    function actualizarEquipos() {
        const temporada = Number(porId('asignaciones-temporada').value);
        const equipos = catalogo.equipos.filter(equipo => temporadaEquipo(equipo) === temporada);
        poblar(porId('asignaciones-equipo'), equipos, 'id_equipo', equipo => {
            const categoria = catalogo.categorias.find(fila => fila.id_categoria === equipo.id_categoria);
            return `${equipo.nombre} · ${categoria?.nombre || 'Categoría no disponible'}`;
        }, 'Seleccionar equipo');
        actualizarVista();
    }

    function fechaCaracas(valor) {
        if (!valor) return 'Actual';
        return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas',
            year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(valor));
    }

    function item(lista, texto) {
        const li = document.createElement('li');
        li.textContent = texto;
        lista.append(li);
    }

    function actualizarVista() {
        const idAtleta = Number(porId('asignaciones-atleta').value);
        const idTemporada = Number(porId('asignaciones-temporada').value);
        const atleta = atletas.find(fila => fila.id_atleta === idAtleta);
        const actual = movimientos.find(fila => fila.id_atleta === idAtleta &&
            fila.id_temporada === idTemporada && !fila.fin_en);
        const idEquipo = Number(porId('asignaciones-equipo').value);
        porId('asignaciones-guardar').disabled = !atleta || atleta.estado !== 'activo' ||
            !idTemporada || !idEquipo || actual?.id_equipo === idEquipo;
        porId('asignaciones-guardar').textContent = actual ? 'Cambiar equipo' : 'Asignar equipo';
        porId('asignaciones-actual').textContent = atleta && idTemporada
            ? `Equipo actual: ${actual?.equipo_nombre || 'Sin asignación en esta temporada'}` : '';
        const aviso = porId('asignaciones-aviso');
        if (atleta && atleta.estado !== 'activo') {
            aviso.textContent = 'Este atleta no está activo. Puedes consultar su historial, pero no asignarle equipo.';
        } else if (atleta) {
            const clasificacion = raiz.JaguaresCategoriasFormativas?.clasificar(atleta.fecha_nacimiento);
            aviso.textContent = `Categoría por edad: ${clasificacion?.categoria?.nombre || 'Sin categoría publicada'}. ` +
                (clasificacion?.estado === 'requiere_validacion' ? `${clasificacion.mensaje} ` : '') +
                'Confirma manualmente la categoría deportiva del equipo antes de guardar.';
        } else aviso.textContent = '';

        const plantilla = porId('asignaciones-plantilla');
        plantilla.replaceChildren();
        const actuales = movimientos.filter(fila => fila.id_temporada === idTemporada && !fila.fin_en);
        for (const fila of actuales) item(plantilla,
            `${fila.atleta_apellidos} ${fila.atleta_nombres} · ${fila.equipo_nombre} (${fila.categoria_nombre})` +
            (fila.atleta_estado === 'activo' ? '' : ` · ${fila.atleta_estado}`));
        if (!actuales.length) item(plantilla, 'Sin asignaciones en esta temporada.');

        const historial = porId('asignaciones-historial');
        historial.replaceChildren();
        const propios = movimientos.filter(fila => fila.id_atleta === idAtleta);
        for (const fila of propios) item(historial,
            `${fila.temporada_nombre} · ${fila.equipo_nombre} (${fila.categoria_nombre}) · ` +
            `${fechaCaracas(fila.inicio_en)} — ${fechaCaracas(fila.fin_en)}`);
        if (!propios.length) item(historial, idAtleta ? 'Sin movimientos registrados.' : 'Selecciona un atleta.');
    }

    async function cargar() {
        if (!permitido || cargando) return;
        cargando = true;
        estado('Cargando plantilla y asignaciones...');
        try {
            const [resCatalogo, resAsignaciones] = await Promise.all([
                raiz.apiFetch('/api/directiva/deportes/catalogo'),
                raiz.apiFetch('/api/directiva/deportes/asignaciones')
            ]);
            const [datosCatalogo, datosAsignaciones] = await Promise.all([
                resCatalogo.json(), resAsignaciones.json()
            ]);
            if (!resCatalogo.ok || !datosCatalogo.success) throw new Error(datosCatalogo.message || 'No se pudo cargar el catálogo');
            if (!resAsignaciones.ok || !datosAsignaciones.success) throw new Error(datosAsignaciones.message || 'No se pudieron cargar las asignaciones');
            catalogo = datosCatalogo;
            atletas = datosAsignaciones.atletas;
            movimientos = datosAsignaciones.movimientos;
            poblar(porId('asignaciones-temporada'), catalogo.temporadas, 'id_temporada',
                fila => fila.nombre, 'Seleccionar temporada');
            poblar(porId('asignaciones-atleta'), atletas, 'id_atleta',
                fila => `${fila.apellidos} ${fila.nombres}${fila.estado === 'activo' ? '' : ` · ${fila.estado}`}`,
                'Seleccionar atleta');
            actualizarEquipos();
            estado('');
        } catch (error) { estado(error.message || 'No se pudo cargar la plantilla', true); }
        finally { cargando = false; }
    }

    function inicializar(rol) {
        permitido = rol === 'directiva' || rol === 'admin';
        porId('asignaciones-panel').hidden = !permitido;
    }

    porId('asignaciones-temporada').addEventListener('change', actualizarEquipos);
    porId('asignaciones-atleta').addEventListener('change', actualizarVista);
    porId('asignaciones-equipo').addEventListener('change', actualizarVista);
    porId('asignaciones-form').addEventListener('submit', async evento => {
        evento.preventDefault();
        const form = evento.currentTarget;
        if (!form.reportValidity()) return;
        const idAtleta = Number(porId('asignaciones-atleta').value);
        const idEquipo = Number(porId('asignaciones-equipo').value);
        const atleta = atletas.find(fila => fila.id_atleta === idAtleta);
        if (!atleta || atleta.estado !== 'activo') return actualizarVista();
        const actual = movimientos.find(fila => fila.id_atleta === idAtleta &&
            fila.id_temporada === Number(porId('asignaciones-temporada').value) && !fila.fin_en);
        if (actual?.id_equipo === idEquipo) return estado('El atleta ya pertenece a ese equipo.', true);
        if (actual && !raiz.confirm(`¿Cambiar a ${atleta.nombres} ${atleta.apellidos} de ${actual.equipo_nombre} al equipo seleccionado? El movimiento anterior quedará en el historial.`)) return;
        const boton = porId('asignaciones-guardar');
        boton.disabled = true;
        try {
            const respuesta = await raiz.apiFetch('/api/directiva/deportes/asignaciones', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_atleta: idAtleta, id_equipo: idEquipo })
            });
            const datos = await respuesta.json();
            if (!respuesta.ok || !datos.success) throw new Error(datos.message || 'No se pudo asignar el equipo');
            await cargar();
            if (typeof raiz.showToast === 'function') raiz.showToast(datos.movimiento ? 'Equipo cambiado' : 'Equipo asignado');
        } catch (error) { estado(error.message || 'No se pudo asignar el equipo', true); }
        finally { actualizarVista(); }
    });

    raiz.JaguaresAsignaciones = Object.freeze({ inicializar, cargar });
})(window);
