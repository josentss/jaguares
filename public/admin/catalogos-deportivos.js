'use strict';

(function () {
    const TIPOS = {
        temporadas: { campo: null, parent: null },
        categorias: { campo: 'id_temporada', parent: 'temporadas' },
        equipos: { campo: 'id_categoria', parent: 'categorias' }
    };
    let datos = { temporadas: [], categorias: [], equipos: [] };
    let cargando = false;
    const porId = id => document.getElementById(id);
    const formulario = tipo => porId('deportes-form-' + tipo);
    const NOMBRE_CATALOGO = /^[\p{L}\p{N}][\p{L}\p{N} .,'’_/()+&–-]*$/u;

    function normalizarNombre(valor) {
        return String(valor || '').normalize('NFC').trim().replace(/ +/g, ' ');
    }

    function validarNombre(input) {
        const nombre = normalizarNombre(input.value);
        const valido = nombre.length >= 2 && nombre.length <= 80 && NOMBRE_CATALOGO.test(nombre);
        input.setCustomValidity(valido ? '' :
            'Usa de 2 a 80 caracteres y comienza con una letra o número.');
        return valido;
    }

    function mensaje(texto, error = false) {
        const estado = porId('deportes-estado');
        estado.textContent = texto;
        estado.dataset.error = error ? 'true' : 'false';
    }

    function registroPorId(tipo, id) {
        const campo = { temporadas:'id_temporada', categorias:'id_categoria', equipos:'id_equipo' }[tipo];
        return datos[tipo].find(x => Number(x[campo]) === Number(id));
    }

    function contexto(tipo, fila) {
        if (tipo === 'categorias') {
            return registroPorId('temporadas', fila.id_temporada)?.nombre || 'Temporada no encontrada';
        }
        if (tipo === 'equipos') {
            const categoria = registroPorId('categorias', fila.id_categoria);
            const temporada = categoria && registroPorId('temporadas', categoria.id_temporada);
            return [categoria?.nombre, temporada?.nombre].filter(Boolean).join(' · ') || 'Categoría no encontrada';
        }
        return '';
    }

    function limpiarEdicion(tipo) {
        const form = formulario(tipo);
        form.reset();
        form.elements.nombre.setCustomValidity('');
        delete form.dataset.editId;
        form.querySelector('[data-guardar]').textContent = 'Agregar';
        form.querySelector('[data-cancelar]').hidden = true;
        const campo = TIPOS[tipo].campo;
        if (campo) form.elements[campo].disabled = false;
        renderTipo(tipo);
    }

    function opciones(tipo) {
        const meta = TIPOS[tipo];
        if (!meta.parent) return;
        const select = formulario(tipo).elements[meta.campo];
        const actual = select.value;
        select.replaceChildren();
        const elegir = document.createElement('option');
        elegir.value = '';
        elegir.textContent = meta.parent === 'temporadas' ? 'Seleccionar temporada' : 'Seleccionar categoría';
        select.append(elegir);
        for (const fila of datos[meta.parent]) {
            const option = document.createElement('option');
            option.value = String(fila[meta.campo]);
            option.textContent = fila.nombre + (meta.parent === 'categorias' ? ' · ' + contexto('categorias', fila) : '');
            select.append(option);
        }
        if ([...select.options].some(x => x.value === actual)) select.value = actual;
    }

    function renderTipo(tipo) {
        const lista = porId('deportes-lista-' + tipo);
        const meta = TIPOS[tipo];
        const seleccionPadre = meta.campo ? formulario(tipo).elements[meta.campo].value : '';
        const filas = seleccionPadre
            ? datos[tipo].filter(fila => Number(fila[meta.campo]) === Number(seleccionPadre))
            : datos[tipo];
        lista.replaceChildren();
        for (const fila of filas) {
            const li = document.createElement('li');
            const texto = document.createElement('div');
            texto.className = 'deportes-item-texto';
            const principal = document.createElement('strong');
            principal.textContent = fila.nombre;
            texto.append(principal);
            const ubicacion = contexto(tipo, fila);
            if (ubicacion) {
                const small = document.createElement('span');
                small.className = 'deportes-contexto';
                small.textContent = ubicacion;
                texto.append(small);
            }
            const editar = document.createElement('button');
            editar.type = 'button';
            editar.className = 'deportes-editar';
            editar.dataset.id = String(fila[{temporadas:'id_temporada', categorias:'id_categoria', equipos:'id_equipo'}[tipo]]);
            editar.textContent = 'Editar';
            editar.setAttribute('aria-label', 'Editar ' + fila.nombre);
            li.append(texto, editar);
            lista.append(li);
        }
        if (!filas.length) {
            const vacio = document.createElement('li');
            vacio.className = 'deportes-vacio';
            vacio.textContent = seleccionPadre ? 'No hay registros para esta selección.' : 'Todavía no hay registros.';
            lista.append(vacio);
        }
        const resumen = porId('deportes-mostrando-' + tipo);
        if (resumen) {
            resumen.textContent = seleccionPadre && filas.length !== datos[tipo].length
                ? `Mostrando ${filas.length} de ${datos[tipo].length}`
                : `${datos[tipo].length} ${datos[tipo].length === 1 ? 'registro' : 'registros'}`;
        }
        const parentDisponible = !meta.parent || datos[meta.parent].length > 0;
        formulario(tipo).querySelector('[data-guardar]').disabled = !parentDisponible;
        if (meta.parent) {
            formulario(tipo).querySelector('[data-aviso-padre]').hidden = parentDisponible;
        }
    }

    function render() {
        opciones('categorias');
        opciones('equipos');
        for (const tipo of Object.keys(TIPOS)) {
            renderTipo(tipo);
            const contador = porId('deportes-total-' + tipo);
            if (contador) contador.textContent = String(datos[tipo].length);
        }
    }

    async function cargar() {
        if (cargando) return;
        cargando = true;
        mensaje('Cargando temporadas, categorías y equipos...');
        try {
            const response = await window.apiFetch('/api/directiva/deportes/catalogo');
            const json = await response.json();
            if (!response.ok || json.success !== true) throw new Error(json.message || 'No se pudo cargar el catálogo');
            for (const tipo of Object.keys(TIPOS)) datos[tipo] = Array.isArray(json[tipo]) ? json[tipo] : [];
            render();
            mensaje('');
        } catch (error) {
            mensaje(error.message || 'No se pudieron cargar los catálogos.', true);
        } finally {
            cargando = false;
        }
    }

    async function guardar(tipo, evento) {
        evento.preventDefault();
        const form = formulario(tipo);
        const nombre = form.elements.nombre;
        nombre.value = normalizarNombre(nombre.value);
        validarNombre(nombre);
        if (!form.reportValidity()) return;
        const id = form.dataset.editId;
        const cuerpo = { nombre: nombre.value };
        const campo = TIPOS[tipo].campo;
        if (!id && campo) cuerpo[campo] = form.elements[campo].value;
        const boton = form.querySelector('[data-guardar]');
        boton.disabled = true;
        try {
            const response = await window.apiFetch(
                '/api/directiva/deportes/' + tipo + (id ? '/' + id : ''),
                { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cuerpo) }
            );
            const json = await response.json();
            if (!response.ok || json.success !== true) throw new Error(json.message || 'No se pudo guardar');
            limpiarEdicion(tipo);
            await cargar();
            window.JaguaresAsignaciones?.cargar();
            window.JaguaresPlanillaGeneral?.cargar();
            if (typeof window.showToast === 'function') window.showToast('Catálogo actualizado', 'success');
        } catch (error) {
            mensaje(error.message || 'No se pudo guardar el registro.', true);
        } finally {
            boton.disabled = false;
            // El listado puede bloquear equipos si no existe su categoría.
            if (!id && TIPOS[tipo].parent && !datos[TIPOS[tipo].parent].length) boton.disabled = true;
        }
    }

    function editar(tipo, evento) {
        const boton = evento.target.closest('button[data-id]');
        if (!boton) return;
        const fila = registroPorId(tipo, boton.dataset.id);
        if (!fila) return;
        const form = formulario(tipo);
        form.dataset.editId = boton.dataset.id;
        form.elements.nombre.value = fila.nombre;
        const campo = TIPOS[tipo].campo;
        if (campo) {
            form.elements[campo].value = String(fila[campo]);
            form.elements[campo].disabled = true;
            renderTipo(tipo);
        }
        form.querySelector('[data-guardar]').textContent = 'Guardar cambios';
        form.querySelector('[data-cancelar]').hidden = false;
        form.elements.nombre.focus();
    }

    for (const tipo of Object.keys(TIPOS)) {
        formulario(tipo).elements.nombre.addEventListener('input', evento => validarNombre(evento.currentTarget));
        formulario(tipo).addEventListener('submit', evento => guardar(tipo, evento));
        formulario(tipo).querySelector('[data-cancelar]')
            .addEventListener('click', () => limpiarEdicion(tipo));
        porId('deportes-lista-' + tipo).addEventListener('click', evento => editar(tipo, evento));
        const campo = TIPOS[tipo].campo;
        if (campo) formulario(tipo).elements[campo].addEventListener('change', () => renderTipo(tipo));
    }

    window.JaguaresCatalogos = Object.freeze({ cargar });
})();
