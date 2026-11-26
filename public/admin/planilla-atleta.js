/* Planilla de inscripción compartida. El servidor comprueba sesión y propietario. */
let planillaPdfEnCurso = false;
let planillaImpresionEnCurso = false;
function planilla_esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function planilla_soloDigitos(tel) {
    return String(tel || '').replace(/\D/g, '');
}

function planilla_telefonoParaWhatsApp(tel) {
    let d = planilla_soloDigitos(tel);
    if (!d) return null;

    if (d.startsWith('00')) d = d.slice(2);

    if (d.startsWith('58') && d.length >= 11 && d.length <= 13) {
        return d;
    }

    if (d.length === 11 && d.startsWith('0')) {
        const sinCero = d.slice(1);
        const prefijo = sinCero.slice(0, 3);
        const movilesVE = ['412', '414', '416', '422', '424', '426'];
        if (movilesVE.includes(prefijo)) {
            return '58' + sinCero;
        }
        return '58' + sinCero;
    }

    if (d.length === 10) {
        const prefijo = d.slice(0, 3);
        const movilesVE = ['412', '414', '416', '422', '424', '426'];
        if (movilesVE.includes(prefijo)) {
            return '58' + d;
        }
    }

    if (d.length >= 11 && d.length <= 15 && !d.startsWith('0')) {
        return d;
    }

    return null;
}

function planilla_primerTelefonoUtil(...candidatos) {
    for (const t of candidatos) {
        const n = planilla_telefonoParaWhatsApp(t);
        if (n) return n;
    }
    return null;
}

function planilla_formatFecha(fechaISO) {
    if (window.FechasJaguares) return window.FechasJaguares.formatearFechaCivil(fechaISO);
    const partes = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(String(fechaISO || ''));
    return partes ? `${Number(partes[3])}/${Number(partes[2])}/${partes[1]}` : 'N/A';
}

function renderPlanillaHTML(a) {
    const d = a.documentos || {};
    const r = a.representante || {};
    const nombre = `${a.nombres || ''} ${a.apellidos || ''}`.trim();
    const repNombre = `${r.nombres || ''} ${r.apellidos || ''}`.trim();
    const wa = planilla_primerTelefonoUtil(r.telefono1, r.telefono2);
    const telMostrar = r.telefono1 || r.telefono2 || '—';

    const filaWhatsApp = wa
        ? `<tr>
                <th>Contacto</th>
                <td>
                    ${planilla_esc(telMostrar)}
                </td>
           </tr>`
        : `<tr>
                <th>Contacto</th>
                <td>
                    ${planilla_esc(telMostrar)}
                    <span style="margin-left:8px;font-size:0.8rem;color:#999;">
                        (Sin teléfono válido en el perfil)
                    </span>
                </td>
           </tr>`;

    const foto = d.foto_url === '/api/atletas/' + Number(a.id_atleta) + '/documentos/foto'
        ? `<img src="${planilla_esc(d.foto_url)}" alt="Foto del atleta">`
        : `<div class="no-foto"><i class="fas fa-user"></i></div>`;

    return `
    <div class="planilla-sheet" id="planilla-print-root">
        <div class="planilla-header">
            <img class="planilla-header-logo" src="../img/logo-sinfondo.png" alt="Jaguares"
                 onerror="this.style.display='none'">
            <div class="planilla-header-text">
                <h2>Club de Voleibol Jaguares</h2>
                <p>Documento oficial de inscripción de atleta</p>
            </div>
        </div>

        <div class="planilla-title">Planilla de inscripción</div>

        <div class="planilla-body">
            <div class="planilla-foto-frame">
                <div class="planilla-foto-box">${foto}</div>
                <span class="planilla-foto-caption">Foto carnet</span>
            </div>
            <table class="planilla-table">
                <tr><th>Nombre completo</th><td><strong>${planilla_esc(nombre)}</strong></td></tr>
                <tr><th>Estado en el club</th><td>${planilla_esc(a.estado || '—')}</td></tr>
                <tr><th>Cédula de identidad</th>
                    <td>${planilla_esc(a.cedula || '—')}</td>
                </tr>
                <tr><th>Fecha de nacimiento</th><td>${planilla_esc(planilla_formatFecha(a.fecha_nacimiento))}</td></tr>
                <tr><th>Categoría por edad</th><td>${planilla_esc(a.clasificacion?.categoria?.nombre || 'Por definir')}</td></tr>
                <tr><th>Teléfono</th><td>${planilla_esc(a.telefono || '—')}</td></tr>
                <tr><th>Dirección</th><td>${planilla_esc(a.direccion || '—')}</td></tr>
                <tr><th>Alergias / condiciones</th><td>${planilla_esc(a.alergias_medicas || 'Ninguna registrada')}</td></tr>
            </table>
        </div>

        <div class="planilla-section">
            <p class="planilla-section-title">Datos del representante legal</p>
            <table class="planilla-table">
                <tr><th>Nombre</th><td>${planilla_esc(repNombre || '—')}</td></tr>
                <tr><th>Correo</th><td>${planilla_esc(r.correo || '—')}</td></tr>
                ${filaWhatsApp}
                <tr><th>Cédula</th><td>${planilla_esc(r.cedula || '—')}</td></tr>
            </table>
        </div>

        <div class="planilla-footer">
            <div><div class="planilla-firma">Firma del representante</div></div>
            <div><div class="planilla-firma">Sello / firma de la directiva</div></div>
        </div>

        <p class="planilla-generated">
            Generado digitalmente · Club Jaguares · ${planilla_esc(new Date().toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }))}
            · ID atleta: ${planilla_esc(a.id_atleta)}
        </p>
    </div>`;
}

let planillaRevision = 0;
let planillaOrigen = null;
function cerrarPlanilla() {
    if (planillaPdfEnCurso) return;
    ++planillaRevision;
    document.getElementById('planillaModal').classList.remove('active');
    document.getElementById('planilla-contenido').replaceChildren();
    planillaOrigen?.focus({preventScroll:true});
    planillaOrigen = null;
}

async function verPlanilla(idAtleta) {
    const id = Number(idAtleta);
    if (!Number.isSafeInteger(id) || id <= 0 || planillaPdfEnCurso) return;
    const modal = document.getElementById('planillaModal');
    const box = document.getElementById('planilla-contenido');
    const revision = ++planillaRevision;
    planillaOrigen = document.activeElement;
    const cerrar = '<div class="planilla-toolbar"><button type="button" class="btn-action planilla-cerrar" onclick="cerrarPlanilla()">Cerrar</button></div>';
    box.innerHTML = '<p class="planilla-aviso" role="status">Cargando planilla…</p>' + cerrar;
    modal.classList.add('active');
    box.querySelector('button').focus({preventScroll:true});
    const vigente = () => revision === planillaRevision && modal.classList.contains('active');
    try {
        const res = await apiFetch('/api/atletas/' + id);
        const data = await res.json();
        if (!vigente()) return;
        if (!res.ok || !data.success || !data.atleta || Number(data.atleta.id_atleta) !== id) {
            box.innerHTML = '<p class="planilla-aviso" role="alert">' + planilla_esc(data.message || 'No se pudo cargar la planilla') + '</p>' + cerrar;
            box.querySelector('button').focus({preventScroll:true});
            return;
        }
        const a = data.atleta;
        box.innerHTML = renderPlanillaHTML(a) + `
                    <div class="planilla-toolbar">
                        <button type="button" class="btn-action btn-view" onclick="imprimirPlanilla()">
                            Imprimir
                        </button>
                        <button type="button" class="btn-action btn-aprob" onclick="descargarPlanillaPDF()">
                            Descargar PDF
                        </button>
                        <button type="button" class="btn-action planilla-cerrar" onclick="cerrarPlanilla()">
                            Cerrar
                        </button>
                    </div>`;
        box.querySelector('.planilla-toolbar button')?.focus({preventScroll:true});
    } catch {
        if (!vigente()) return;
        box.innerHTML = '<p class="planilla-aviso" role="alert">No se pudo cargar la planilla. Inténtalo de nuevo.</p>' + cerrar;
        box.querySelector('button').focus({preventScroll:true});
    }
}

document.addEventListener('click', e => {
    const boton = e.target.closest('button[data-ficha-ver]');
    if (boton) verPlanilla(boton.dataset.fichaVer);
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('planillaModal').classList.contains('active')) cerrarPlanilla();
});

/** Imprime / guarda PDF sin window.open (evita bloqueo de popups) */
function imprimirPlanilla() {
    const sheet = document.getElementById('planilla-print-root');
    if (!sheet) {
        showToast('No hay planilla para imprimir', 'error');
        return;
    }
    if (planillaImpresionEnCurso) return;
    planillaImpresionEnCurso = true;

    // Quitar iframe anterior si existe
    const old = document.getElementById('iframe-print-planilla');
    if (old) old.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'iframe-print-planilla';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;pointer-events:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const html = `<!DOCTYPE html><html lang="es"><head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Planilla — Club Jaguares</title>
        <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 16px; font-family: "Segoe UI", system-ui, sans-serif; color: #1a1a1a; }
            .planilla-sheet { max-width: 800px; margin: 0 auto; }
            .planilla-header { display: flex; align-items: center; gap: 12px; border-bottom: 3px double #1a1a1a; padding-bottom: 12px; margin-bottom: 14px; flex-wrap: wrap; }
            .planilla-header-logo { width: 48px; height: 48px; object-fit: contain; }
            .planilla-header-text h2 { margin: 0; font-size: 1.1rem; text-transform: uppercase; letter-spacing: .04em; }
            .planilla-header-text p { margin: 2px 0 0; font-size: .8rem; color: #555; }
            .planilla-title { text-align: center; font-size: 1rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 14px; padding: 8px; background: #f0f2f5; border: 1px solid #d0d5dd; }
            .planilla-body { display: grid; grid-template-columns: 120px 1fr; gap: 14px; margin-bottom: 14px; }
            .planilla-foto-box { border: 1px solid #bbb; padding: 4px; width: 120px; }
            .planilla-foto-box img { width: 100%; height: 140px; object-fit: cover; display: block; }
            .planilla-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
            .planilla-table th, .planilla-table td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; word-break: break-word; }
            .planilla-table th { width: 36%; background: #f7f8fa; text-align: left; }
            .planilla-section { margin-top: 14px; }
            .planilla-section-title { font-size: .75rem; font-weight: 700; text-transform: uppercase; background: #1a1a1a; color: #fff; padding: 6px 10px; margin: 0; }
            .planilla-footer { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: .8rem; }
            .planilla-firma { border-top: 1px solid #333; margin-top: 40px; padding-top: 6px; text-align: center; }
            a { color: #000; text-decoration: none; }
            @media print {
                body { padding: 0; }
                @page { size: A4; margin: 14mm; }
            }
        </style>
    </head><body>${sheet.outerHTML}</body></html>`;

    doc.open();
    doc.write(html);
    doc.close();

    const win = iframe.contentWindow;
    let impresionIniciada = false;
    let limpiezaRealizada = false;
    let timeoutLimpieza;
    const limpiar = () => {
        if (limpiezaRealizada) return;
        limpiezaRealizada = true;
        clearTimeout(timeoutLimpieza);
        iframe.remove();
        planillaImpresionEnCurso = false;
    };
    win.onafterprint = limpiar;
    timeoutLimpieza = setTimeout(limpiar, 60000);
    const triggerPrint = () => {
        if (impresionIniciada) return;
        impresionIniciada = true;
        try {
            win.focus();
            win.print();
        } catch (e) {
            console.error('No se pudo abrir la impresión de la planilla');
            limpiar();
            showToast('No se pudo abrir el diálogo de impresión', 'error');
        }
        // Limpiar después (no inmediato: el diálogo de print es async)
    };

    // Esperar a que carguen imágenes (foto Cloudinary)
    const imgs = doc.images ? Array.from(doc.images) : [];
    if (imgs.length === 0) {
        setTimeout(triggerPrint, 200);
        return;
    }

    let pending = imgs.length;
    const done = () => {
        pending -= 1;
        if (pending <= 0) setTimeout(triggerPrint, 150);
    };
    imgs.forEach((img) => {
        if (img.complete) done();
        else {
            img.onload = done;
            img.onerror = done;
        }
    });
    // Fallback por si alguna imagen no dispara evento
    setTimeout(triggerPrint, 2500);
}

document.getElementById('planillaModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'planillaModal') cerrarPlanilla();
});

// Imagen de origen protegido convertida a datos locales, sin enviar
// información a servicios externos de PDF. Si CORS no permite leerla,
// la exportación puede continuar sin incluir la foto.
async function imagenPdfSegura(origen, anchoMaximo = 900) {
    if (!origen) return null;
    return new Promise((resolve) => {
        const imagen = new Image();
        imagen.crossOrigin = 'anonymous';
        let terminado = false;
        const finalizar = (valor) => {
            if (terminado) return;
            terminado = true;
            clearTimeout(limite);
            imagen.onload = null;
            imagen.onerror = null;
            resolve(valor);
        };
        const limite = setTimeout(() => finalizar(null), 7500);
        imagen.onload = () => {
            try {
                if (!imagen.naturalWidth || !imagen.naturalHeight) return finalizar(null);
                const escala = Math.min(1, anchoMaximo / imagen.naturalWidth);
                const lienzo = document.createElement('canvas');
                lienzo.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
                lienzo.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
                const ctx = lienzo.getContext('2d');
                if (!ctx) return finalizar(null);
                ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
                finalizar(lienzo.toDataURL('image/png'));
            } catch {
                finalizar(null);
            }
        };
        imagen.onerror = () => finalizar(null);
        imagen.src = origen;
    });
}

async function descargarPlanillaPDF() {
    const sheet = document.getElementById('planilla-print-root');
    if (!sheet) {
        showToast('No hay planilla para descargar', 'error');
        return;
    }
    if (typeof html2pdf === 'undefined') {
        showToast('No se pudo cargar el generador de PDF', 'error');
        return;
    }
    if (planillaPdfEnCurso) return;

    const nombre = (sheet.querySelector('.planilla-table td strong')?.textContent || 'atleta')
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/[._]+$/g, '')
        .slice(0, 80) || 'atleta';

    const boton = sheet.parentElement?.querySelector('.planilla-toolbar button[onclick="descargarPlanillaPDF()"]');
    const botonEstabaDeshabilitado = boton?.disabled;
    const imagenesOriginales = Array.from(sheet.querySelectorAll('img'));
    const overlaysAnteriores = new Set(document.querySelectorAll('.html2pdf__overlay'));
    let imagenesParaPdf = [];
    let fotoOmitida = false;
    const estilosExportacion = `
        .planilla-export-document {
            box-sizing: border-box !important;
            width: 190mm !important;
            min-width: 190mm !important;
            max-width: 190mm !important;
            margin: 0 !important;
            padding: 16px !important;
            clear: none !important;
            float: none !important;
            position: relative !important;
            left: auto !important;
            right: auto !important;
            transform: none !important;
            overflow: visible !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
        }
        .planilla-export-document .planilla-header {
            flex-wrap: nowrap !important;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .planilla-export-document .planilla-header-text { min-width: 0 !important; }
        .planilla-export-document .planilla-title,
        .planilla-export-document .planilla-section-title,
        .planilla-export-document .planilla-footer,
        .planilla-export-document .planilla-generated {
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .planilla-export-document .planilla-body {
            display: grid !important;
            grid-template-columns: 120px minmax(0, 1fr) !important;
            justify-items: stretch !important;
            gap: 14px !important;
            align-items: start !important;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .planilla-export-document .planilla-foto-frame { width: 120px !important; }
        .planilla-export-document .planilla-foto-box { flex: none !important; }
        .planilla-export-document .planilla-table {
            width: 100% !important;
            table-layout: fixed !important;
            font-size: 10pt !important;
        }
        .planilla-export-document .planilla-table th { width: 36% !important; }
        .planilla-export-document .planilla-table th,
        .planilla-export-document .planilla-table td {
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
        }
        .planilla-export-document .planilla-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .planilla-export-document .planilla-footer {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .planilla-export-document .no-foto {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            height: 100% !important;
            color: #666 !important;
            background: #f5f5f5 !important;
            font: 12px sans-serif !important;
        }
    `;
    const opt = {
        margin:       [10, 10, 12, 10],
        filename:     `Planilla_Jaguares_${nombre}.pdf`,
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: Math.max(Math.ceil(210 / 25.4 * 96), document.documentElement.clientWidth),
            imageTimeout: 10000,
            scrollX: 0,
            scrollY: 0,
            onrendered: (canvas) => {
                let contexto;
                try { contexto = canvas.getContext('2d'); } catch { return; }
                if (!contexto || canvas.height === 0) return;
                let ultimaFilaVisible = -1;
                for (let y = canvas.height - 1; y >= 0 && ultimaFilaVisible < 0; y -= 1) {
                    let pixelesFila;
                    try { pixelesFila = contexto.getImageData(0, y, canvas.width, 1).data; }
                    catch { return; }
                    for (let indice = 0; indice < pixelesFila.length; indice += 4) {
                        if (pixelesFila[indice] < 250 || pixelesFila[indice + 1] < 250 || pixelesFila[indice + 2] < 250) {
                            ultimaFilaVisible = y;
                            break;
                        }
                    }
                }
                if (ultimaFilaVisible >= 0 && ultimaFilaVisible < canvas.height - 1) {
                    try {
                        const contenido = contexto.getImageData(0, 0, canvas.width, ultimaFilaVisible + 1);
                        canvas.height = ultimaFilaVisible + 1;
                        canvas.getContext('2d').putImageData(contenido, 0, 0);
                    } catch { /* el PDF todavía se genera sin recorte si el canvas no se puede leer */ }
                }
            },
            onclone: (clonedDocument) => {
                const bodyClonado = clonedDocument.body;
                bodyClonado.className = '';
                bodyClonado.style.setProperty('display', 'block', 'important');
                bodyClonado.style.setProperty('position', 'static', 'important');
                bodyClonado.style.setProperty('width', 'auto', 'important');
                bodyClonado.style.setProperty('min-width', '0', 'important');
                bodyClonado.style.setProperty('overflow', 'visible', 'important');
                bodyClonado.style.setProperty('padding', '0', 'important');
                bodyClonado.style.setProperty('margin', '0', 'important');
                bodyClonado.style.setProperty('background', '#fff', 'important');
                clonedDocument.documentElement.style.setProperty('overflow', 'visible', 'important');

                const planillaClonada = clonedDocument.querySelector('.html2pdf__container .planilla-sheet');
                if (!planillaClonada) return;
                planillaClonada.classList.add('planilla-export-document');
                planillaClonada.removeAttribute('id');
                planillaClonada.querySelectorAll('[id]').forEach((elemento) => elemento.removeAttribute('id'));
                const estilos = clonedDocument.createElement('style');
                estilos.textContent = estilosExportacion;
                planillaClonada.prepend(estilos);

                const imagenesClonadas = Array.from(planillaClonada.querySelectorAll('img'));
                imagenesClonadas.forEach((imagenClonada, indice) => {
                    const datos = imagenesParaPdf[indice];
                    if (datos) {
                        imagenClonada.src = datos;
                        imagenClonada.removeAttribute('onerror');
                        return;
                    }
                    if (imagenClonada.classList.contains('planilla-header-logo')) {
                        imagenClonada.remove();
                        return;
                    }
                    fotoOmitida = true;
                    const caja = imagenClonada.closest('.planilla-foto-box');
                    if (caja) caja.innerHTML = '<div class="no-foto">Foto no disponible</div>';
                    else imagenClonada.remove();
                });
            }
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    {
            mode: ['css', 'legacy'],
            avoid: [
                '.planilla-header',
                '.planilla-title',
                '.planilla-body',
                '.planilla-section-title',
                '.planilla-table tr',
                '.planilla-footer',
                '.planilla-generated'
            ]
        }
    };

    try {
        planillaPdfEnCurso = true;
        if (boton) {
            boton.disabled = true;
            boton.setAttribute('aria-busy', 'true');
        }

        showToast('Generando PDF...', 'success');
        if (document.fonts?.ready) {
            await Promise.race([
                document.fonts.ready,
                new Promise((resolve) => setTimeout(resolve, 5000))
            ]);
        }

        imagenesParaPdf = await Promise.all(
            imagenesOriginales.map(imagen => imagenPdfSegura(imagen.src))
        );
        await html2pdf().set(opt).from(sheet).save();
        if (fotoOmitida) {
            showToast('PDF descargado sin foto. Puedes usar Imprimir para incluirla.', 'error');
        } else {
            showToast('PDF descargado correctamente', 'success');
        }
    } catch (err) {
        console.error('Falló la generación de PDF:', err?.name || 'Error', err?.message || '');
        showToast('No se pudo generar el PDF. Puedes usar Imprimir.', 'error');
    } finally {
        document.querySelectorAll('.html2pdf__overlay').forEach((overlay) => {
            if (!overlaysAnteriores.has(overlay)) overlay.remove();
        });
        if (boton) {
            boton.disabled = Boolean(botonEstabaDeshabilitado);
            boton.removeAttribute('aria-busy');
        }
        planillaPdfEnCurso = false;
    }
}

