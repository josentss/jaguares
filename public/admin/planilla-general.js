'use strict';

// Exportación de una categoría publicada. El servidor decide qué atletas
// activos pertenecen a ella; esta vista solo dibuja los datos recibidos.
(function (raiz) {
    function inicializar({ apiFetch, showToast }) {
        const selector = document.getElementById('filter-categoria-atletas');
        const boton = document.getElementById('generar-planilla-general');
        const codigos = new Set((raiz.JaguaresCategoriasFormativas?.CATEGORIAS || []).map(c => c.codigo));
        const actualizar = () => {
            boton.hidden = !codigos.has(selector.value);
        };
        selector.addEventListener('change', actualizar);
        actualizar();

        boton.addEventListener('click', async () => {
            const codigo = selector.value;
            if (!codigos.has(codigo) || boton.disabled) return;
            boton.disabled = true;
            boton.setAttribute('aria-busy', 'true');
            try {
                const respuesta = await apiFetch('/api/directiva/atletas/planilla-general?categoria=' + encodeURIComponent(codigo));
                const datos = await respuesta.json();
                if (!respuesta.ok || !datos.success) throw new Error(datos.message || 'No se pudo consultar la planilla');
                if (!datos.atletas.length) {
                    showToast('No hay atletas activos en esta categoría.', 'error');
                    return;
                }
                if (typeof raiz.html2pdf !== 'function') throw new Error('No se pudo cargar el generador de PDF');
                const documento = construirDocumento(datos);
                document.body.append(documento);
                try {
                    await raiz.html2pdf().set({
                        margin: 0,
                        filename: `Planilla_General_Jaguares_${codigo.toUpperCase()}.pdf`,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr'] }
                    }).from(documento).save();
                } finally {
                    documento.remove();
                }
            } catch (error) {
                showToast(error.message || 'No se pudo generar la planilla general', 'error');
            } finally {
                boton.disabled = false;
                boton.removeAttribute('aria-busy');
            }
        });
    }

    const fechaLegible = iso => {
        const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : '—';
    };

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
            .planilla-general-cabecera p { margin: 0; color: #53636b; }
            .planilla-general-titulo { font-size: 16px; margin: 0 0 12px; }
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
            subtitulo.textContent = 'Planilla general de atletas activos';
            marca.append(h1, subtitulo);
            cabecera.append(logo, marca);
            const titulo = document.createElement('h2');
            titulo.className = 'planilla-general-titulo';
            titulo.textContent = datos.categoria.nombre;
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
            pagina.append(cabecera, titulo, meta, tabla, pie);
            raizDocumento.append(pagina);
        }
        return raizDocumento;
    }

    raiz.JaguaresPlanillaGeneral = { inicializar };
})(window);
