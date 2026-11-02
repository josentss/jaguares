async function apiFetch(url, options = {}) {
    const opts = { credentials: 'include', ...options };
    if (opts.body && !(opts.body instanceof FormData)) {
        opts.headers = {
            'Content-Type': 'application/json',
            ...(opts.headers || {})
        };
    } else {
        opts.headers = { ...(opts.headers || {}) };
    }
    return fetch(url, opts);
}

// La validación del navegador mejora el formulario; el backend valida siempre.
// Un recurso de validación que no cargó no debe convertir el botón en un no-op.
function validarFormularioJaguares(formulario) {
    if (typeof window.ValidacionJaguares?.validarFormulario === 'function') {
        return window.ValidacionJaguares.validarFormulario(formulario);
    }
    return formulario.reportValidity();
}
