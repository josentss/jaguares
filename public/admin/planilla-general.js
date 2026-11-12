'use strict';

// Consulta y exportación de plantillas. El servidor vuelve a decidir qué
// atletas activos pertenecen a la categoría etaria o al equipo seleccionado.
(function (raiz) {
    let apiFetch;
    let showToast;
    let inicializado = false;
    let cargandoCatalogo = false;
    let catalogo = { temporadas: [], categorias: [], equipos: [] };
    let datosActuales = null;
    const porId = id => document.getElementById(id);

    const fechaLegible = iso => {
        const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : '—';
    };

    function estado(texto, error = false) {
        const nodo = porId('plantillas-estado');
        nodo.textContent = texto;
        nodo.dataset.error = error ? 'true' : 'false';
    }

    function limpiarResultado() {
        datosActuales = null;
        porId('plantillas-resultado').hidden = true;
        porId('plantillas-body').replaceChildren();
    }

    function poblarCategorias(select) {
        select.replaceChildren(new Option('Seleccionar categoría', ''));
        for (const categoria of raiz.JaguaresCategoriasFormativas?.CATEGORIAS || []) {
            select.add(new Option(categoria.nombre, categoria.codigo));
        }
    }

    function poblarEquipos(select) {
        select.replaceChildren(new Option('Seleccionar equipo', ''));
        for (const temporada of catalogo.temporadas) {
            const grupo = document.createElement('optgroup');
            grupo.label = temporada.nombre;
            const categorias = catalogo.categorias.filter(fila =>
                Number(fila.id_temporada) === Number(temporada.id_temporada));
            for (const categoria of categorias) {
                for (const equipo of catalogo.equipos.filter(fila =>
                    Number(fila.id_categoria) === Number(categoria.id_categoria))) {
                    grupo.append(new Option(`${categoria.nombre} · ${equipo.nombre}`, String(equipo.id_equipo)));
                }
            }
            if (grupo.children.length) select.append(grupo);
        }
    }

    function actualizarAlcances({ conservarResultado = false } = {}) {
        const tipo = porId('plantillas-tipo').value;
        const select = porId('plantillas-alcance');
        const anterior = select.value;
        porId('plantillas-alcance-label').textContent =
            tipo === 'equipo' ? 'Equipo' : 'Categoría';
        if (tipo === 'equipo') poblarEquipos(select);
        else poblarCategorias(select);
        if ([...select.options].some(opcion => opcion.value === anterior)) select.value = anterior;
        porId('plantillas-consultar').disabled = select.options.length <= 1;
        if (!conservarResultado) limpiarResultado();
        estado(tipo === 'equipo' && select.options.length <= 1
            ? 'Todavía no hay equipos disponibles.' : '');
    }

    async function cargar() {
        if (!apiFetch || cargandoCatalogo) return;
        cargandoCatalogo = true;
        estado('Cargando equipos...');
        try {
            const respuesta = await apiFetch('/api/directiva/deportes/catalogo');
            const datos = await respuesta.json();
            if (!respuesta.ok || !datos.success) throw new Error(datos.message || 'No se pudieron cargar los equipos');
            catalogo = {
                temporadas: Array.isArray(datos.temporadas) ? datos.temporadas : [],
                categorias: Array.isArray(datos.categorias) ? datos.categorias : [],
                equipos: Array.isArray(datos.equipos) ? datos.equipos : []
            };
            actualizarAlcances({ conservarResultado: porId('plantillas-tipo').value === 'categoria' });
        } catch (error) {
            estado(error.message || 'No se pudieron cargar las plantillas.', true);
        } finally {
            cargandoCatalogo = false;
        }
    }

    function renderizar(datos) {
        datosActuales = datos;
        porId('plantillas-titulo').textContent = datos.alcance.nombre;
        porId('plantillas-detalle').textContent = datos.alcance.detalle;
        porId('plantillas-total').textContent = `${datos.total} atletas activos`;
        const cuerpo = porId('plantillas-body');
        cuerpo.replaceChildren();
        for (const atleta of datos.atletas) {
            const fila = document.createElement('tr');
            for (const texto of [
                `${atleta.nombres} ${atleta.apellidos}`.trim(),
                atleta.cedula || 'Sin cédula propia',
                fechaLegible(atleta.fecha_nacimiento)
            ]) {
                const celda = document.createElement('td');
                celda.textContent = texto;
                fila.append(celda);
            }
            cuerpo.append(fila);
        }
        if (!datos.atletas.length) {
            const fila = document.createElement('tr');
            const celda = document.createElement('td');
            celda.colSpan = 3;
            celda.textContent = 'No hay atletas activos en esta plantilla.';
            fila.append(celda);
            cuerpo.append(fila);
        }
        porId('generar-planilla-general').disabled = !datos.atletas.length;
        porId('plantillas-resultado').hidden = false;
        estado('');
    }

    async function consultar(evento) {
        evento.preventDefault();
        const tipo = porId('plantillas-tipo').value;
        const valor = porId('plantillas-alcance').value;
        if (!valor) return porId('plantillas-alcance').reportValidity();
        const boton = porId('plantillas-consultar');
        boton.disabled = true;
        estado('Consultando plantilla...');
        limpiarResultado();
        try {
            const parametro = tipo === 'equipo' ? 'equipo' : 'categoria';
            const respuesta = await apiFetch('/api/directiva/atletas/planilla-general?' +
                parametro + '=' + encodeURIComponent(valor));
            const datos = await respuesta.json();
            if (!respuesta.ok || !datos.success) throw new Error(datos.message || 'No se pudo consultar la plantilla');
            renderizar(datos);
        } catch (error) {
            estado(error.message || 'No se pudo consultar la plantilla.', true);
        } finally {
            boton.disabled = false;
        }
    }

    function nombreArchivo(alcance) {
        const nombre = alcance.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
        const tipo = alcance.tipo === 'equipo' ? 'Equipo' : 'Categoria';
        return `Planilla_${tipo}_Jaguares_${nombre || 'Atletas'}.pdf`;
    }

    async function generar() {
        const boton = porId('generar-planilla-general');
        if (!datosActuales?.atletas?.length || boton.disabled) return;
        boton.disabled = true;
        boton.setAttribute('aria-busy', 'true');
        try {
            if (typeof raiz.html2pdf !== 'function') throw new Error('No se pudo cargar el generador de PDF');
            const documento = construirDocumento(datosActuales);
            document.body.append(documento);
            try {
                await raiz.html2pdf().set({
                    margin: 0,
                    filename: nombreArchivo(datosActuales.alcance),
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: ['css', 'legacy'], avoid: ['tr'] }
                }).from(documento).save();
            } finally {
                documento.remove();
            }
        } catch (error) {
            showToast(error.message || 'No se pudo generar la planilla', 'error');
        } finally {
            boton.disabled = false;
            boton.removeAttribute('aria-busy');
        }
    }

    function inicializar(dependencias) {
        if (inicializado) return;
        apiFetch = dependencias.apiFetch;
        showToast = dependencias.showToast;
        porId('plantillas-tipo').addEventListener('change', actualizarAlcances);
        porId('plantillas-alcance').addEventListener('change', limpiarResultado);
        porId('plantillas-consulta-form').addEventListener('submit', consultar);
        porId('generar-planilla-general').addEventListener('click', generar);
        actualizarAlcances();
        inicializado = true;
    }

    function construirDocumento(datos) {
        const raizDocumento = document.createElement('div');
        raizDocumento.className = 'planilla-general-export';
        const estilo = document.createElement('style');
        estilo.textContent = `
            .planilla-general-export { width: 210mm;
                background: #fff; color: #17242b; font: 12px Arial, sans-serif; }
            .planilla-general-pagina { box-sizing: border-box; width: 210mm; height: 296mm;
                padding: 17mm 15mm 14mm; overflow: hidden; page-break-after: always; }
            .planilla-general-pagina:last-child { page-break-after: auto; }
            .planilla-general-cabecera { display: flex; align-items: center; gap: 13px;
                border-bottom: 2px solid #145637; padding-bottom: 11px; margin-bottom: 17px; }
            .planilla-general-logo { width: 54px; height: 54px; object-fit: contain; }
            .planilla-general-cabecera h1 { font-size: 18px; margin: 0 0 4px; }
            .planilla-general-cabecera p, .planilla-general-detalle { margin: 0; color: #53636b; }
            .planilla-general-titulo { font-size: 16px; margin: 0 0 4px; }
            .planilla-general-detalle { margin-bottom: 12px; }
            .planilla-general-meta { display: flex; justify-content: space-between; margin-bottom: 13px; }
            .planilla-general-tabla { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .planilla-general-tabla th { background: #e8f1eb; text-align: left; }
            .planilla-general-tabla th, .planilla-general-tabla td { border: 1px solid #c8d3cd;
                padding: 6px 7px; overflow-wrap: anywhere; vertical-align: top; }
            .planilla-general-tabla th:first-child { width: 50%; }
            .planilla-general-tabla th:nth-child(2) { width: 24%; }
            .planilla-general-pie { margin-top: 12px; color: #53636b; text-align: right; }
        `;
        raizDocumento.append(estilo);
        const porPagina = 25;
        const paginas = Math.ceil(datos.atletas.length / porPagina);
        for (let numero = 0; numero < paginas; numero++) {
            const pagina = document.createElement('section');
            pagina.className = 'planilla-general-pagina';
            const cabecera = document.createElement('header');
            cabecera.className = 'planilla-general-cabecera';
            const logo = document.createElement('img');
            logo.className = 'planilla-general-logo';
            logo.src = '../img/logo-sinfondo.png';
            logo.alt = 'Jaguares';
            const marca = document.createElement('div');
            const h1 = document.createElement('h1');
            h1.textContent = 'Club Jaguares';
            const subtitulo = document.createElement('p');
            subtitulo.textContent = 'Planilla de atletas activos';
            marca.append(h1, subtitulo);
            cabecera.append(logo, marca);
            const titulo = document.createElement('h2');
            titulo.className = 'planilla-general-titulo';
            titulo.textContent = datos.alcance.nombre;
            const detalle = document.createElement('p');
            detalle.className = 'planilla-general-detalle';
            detalle.textContent = datos.alcance.detalle;
            const meta = document.createElement('div');
            meta.className = 'planilla-general-meta';
            const total = document.createElement('span');
            total.textContent = `Total: ${datos.total} atletas`;
            const fecha = document.createElement('span');
            fecha.textContent = `Fecha: ${fechaLegible(datos.fecha)}`;
            meta.append(total, fecha);
            const tabla = document.createElement('table');
            tabla.className = 'planilla-general-tabla';
            const encabezado = document.createElement('thead');
            const filaEncabezado = document.createElement('tr');
            for (const etiqueta of ['Nombre completo', 'Cédula', 'Fecha de nacimiento']) {
                const th = document.createElement('th');
                th.textContent = etiqueta;
                filaEncabezado.append(th);
            }
            encabezado.append(filaEncabezado);
            const cuerpo = document.createElement('tbody');
            for (const atleta of datos.atletas.slice(numero * porPagina, (numero + 1) * porPagina)) {
                const fila = document.createElement('tr');
                for (const texto of [
                    `${atleta.nombres} ${atleta.apellidos}`.trim(),
                    atleta.cedula || 'Sin cédula propia', fechaLegible(atleta.fecha_nacimiento)
                ]) {
                    const td = document.createElement('td');
                    td.textContent = texto;
                    fila.append(td);
                }
                cuerpo.append(fila);
            }
            tabla.append(encabezado, cuerpo);
            const pie = document.createElement('div');
            pie.className = 'planilla-general-pie';
            pie.textContent = `Página ${numero + 1} de ${paginas}`;
            pagina.append(cabecera, titulo, detalle, meta, tabla, pie);
            raizDocumento.append(pagina);
        }
        return raizDocumento;
    }

    raiz.JaguaresPlanillaGeneral = Object.freeze({ inicializar, cargar });
})(window);
