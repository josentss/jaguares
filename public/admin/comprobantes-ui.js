/* Visor de comprobantes idéntico en ambos paneles; autorización en backend. */
(function () {
    'use strict';
    const modal = document.createElement('dialog');
    modal.className = 'comprobante-dialog';
    modal.setAttribute('aria-labelledby', 'comprobante-dialog-titulo');
    modal.innerHTML = [
        '<div class="comprobante-dialog-header">',
        '  <h3 id="comprobante-dialog-titulo">Comprobante de pago</h3>',
        '  <button type="button" class="comprobante-dialog-cerrar" aria-label="Cerrar comprobante">&times;</button>',
        '</div>',
        '<p class="comprobante-dialog-estado" role="status" aria-live="polite"></p>',
        '<img class="comprobante-dialog-imagen" alt="Comprobante del pago" hidden>',
        '<a class="comprobante-dialog-abrir" target="_blank" rel="noopener noreferrer" hidden>Abrir archivo original</a>'
    ].join('');
    document.body.appendChild(modal);

    const estado = modal.querySelector('.comprobante-dialog-estado');
    const imagen = modal.querySelector('.comprobante-dialog-imagen');
    const enlace = modal.querySelector('.comprobante-dialog-abrir');
    let solicitud = 0;
    function cerrar() { modal.close(); }
    function limpiar() {
        solicitud++;
        imagen.removeAttribute('src');
        imagen.hidden = true;
        imagen.onload = null;
        imagen.onerror = null;
        enlace.removeAttribute('href');
        enlace.hidden = true;
        estado.textContent = '';
    }
    modal.querySelector('.comprobante-dialog-cerrar').addEventListener('click', cerrar);
    modal.addEventListener('click', (event) => { if (event.target === modal) cerrar(); });
    modal.addEventListener('close', limpiar);

    async function abrir(idPago) {
        const id = Number(idPago);
        if (!Number.isSafeInteger(id) || id <= 0 || typeof window.apiFetch !== 'function') return;
        if (modal.open) modal.close();
        limpiar();
        const turno = ++solicitud;
        estado.textContent = 'Cargando comprobante…';
        modal.showModal();
        try {
            const res = await window.apiFetch('/api/pagos/captura/' + id);
            const datos = await res.json();
            if (!res.ok || datos.success !== true) throw new Error(datos.message || 'No se pudo consultar el comprobante');
            const url = new URL(datos.url);
            if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' ||
                url.username || url.password || url.port) throw new Error('Origen de comprobante no permitido');
            if (turno !== solicitud || !modal.open) return;

            enlace.href = url.href;
            enlace.hidden = false;
            imagen.onload = () => {
                if (turno !== solicitud || !modal.open) return;
                imagen.hidden = false;
                estado.textContent = '';
            };
            imagen.onerror = () => {
                if (turno !== solicitud || !modal.open) return;
                imagen.hidden = true;
                estado.textContent = 'No se pudo mostrar la imagen. Puedes abrir el archivo original.';
            };
            imagen.referrerPolicy = 'no-referrer';
            imagen.src = url.href;
        } catch (err) {
            if (turno !== solicitud || !modal.open) return;
            estado.textContent = err?.message || 'No se pudo cargar el comprobante.';
        }
    }
    window.JaguaresComprobantes = Object.freeze({ abrir });
})();
