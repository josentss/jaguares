async function apiFetch(url, options = {}) {
    const opts = { credentials: 'include', cache: 'no-store', ...options };
    if (opts.body && !(opts.body instanceof FormData)) {
        opts.headers = {
            'Content-Type': 'application/json',
            ...(opts.headers || {})
        };
    } else {
        opts.headers = { ...(opts.headers || {}) };
    }
    const response = await fetch(url, opts);
    const path = new URL(url, window.location.href).pathname;
    if (response.status === 401 && path !== '/api/auth/me' && path !== '/api/auth/logout') {
        window.dispatchEvent(new Event('jaguares:sesion-invalida'));
    }
    return response;
}

// La validación del navegador mejora el formulario; el backend valida siempre.
// Un recurso de validación que no cargó no debe convertir el botón en un no-op.
function validarFormularioJaguares(formulario) {
    if (typeof window.ValidacionJaguares?.validarFormulario === 'function') {
        return window.ValidacionJaguares.validarFormulario(formulario);
    }
    return formulario.reportValidity();
}

const CLAVE_CIERRE_SESION = 'jaguares:sesion-cerrada';
const TIEMPO_MAXIMO_SESION_MS = 10000;
let sesionPanelFinalizada = false;

function actualizarEstadoPanelSesion(estado, mensaje) {
    if (!document.body) return;
    document.body.dataset.sessionState = estado;
    const aviso = document.getElementById('session-gate-message');
    if (aviso && mensaje) aviso.textContent = mensaje;
    const panelAviso = document.getElementById('session-gate');
    if (panelAviso) panelAviso.setAttribute('aria-busy', String(estado === 'checking'));
    const reintentar = document.getElementById('session-gate-retry');
    if (reintentar) reintentar.hidden = estado !== 'error';
}

function redirigirLoginPorSesion() {
    if (sesionPanelFinalizada) return;
    sesionPanelFinalizada = true;
    try { localStorage.removeItem('usuario'); } catch (_) {}
    actualizarEstadoPanelSesion('checking', 'Redirigiendo al inicio de sesión…');
    window.location.replace('/admin/login.html');
}

async function consultarSesionPanel(rolesPermitidos) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIEMPO_MAXIMO_SESION_MS);
    try {
        const response = await apiFetch('/api/auth/me', {
            cache: 'no-store',
            signal: controller.signal
        });
        if (response.status === 401 || response.status === 403) return { estado: 'invalida' };
        if (!response.ok) return { estado: 'error' };

        const payload = await response.json();
        const usuario = payload?.usuario;
        const idUsuario = typeof usuario?.id_usuario === 'number'
            ? usuario.id_usuario
            : typeof usuario?.id_usuario === 'string' && /^[1-9]\d*$/.test(usuario.id_usuario)
                ? Number(usuario.id_usuario) : NaN;
        if (!payload?.success || !usuario ||
            !Number.isSafeInteger(idUsuario) || idUsuario <= 0 ||
            !rolesPermitidos.includes(usuario.rol)) {
            return { estado: 'invalida' };
        }
        return { estado: 'valida', usuario };
    } catch (_) {
        return { estado: 'error' };
    } finally {
        clearTimeout(timeout);
    }
}

async function exigirSesionPanel(rolesPermitidos) {
    const resultado = await consultarSesionPanel(rolesPermitidos);
    if (sesionPanelFinalizada) return null;
    if (resultado.estado === 'valida') return resultado.usuario;
    if (resultado.estado === 'invalida') {
        redirigirLoginPorSesion();
        return null;
    }

    actualizarEstadoPanelSesion('error', 'No se pudo verificar tu sesión. Comprueba tu conexión e inténtalo de nuevo.');
    return null;
}

function protegerSesionPanel(rolesPermitidos, usuarioAutenticado) {
    let verificacionEnCurso = false;
    let secuenciaVerificacion = 0;

    const revalidar = async ({ ocultar = false } = {}) => {
        if (sesionPanelFinalizada) return;
        if (ocultar) actualizarEstadoPanelSesion('checking', 'Verificando tu sesión…');
        if (verificacionEnCurso && !ocultar) return;
        const secuencia = ++secuenciaVerificacion;
        verificacionEnCurso = true;

        try {
            const resultado = await consultarSesionPanel(rolesPermitidos);
            if (sesionPanelFinalizada || secuencia !== secuenciaVerificacion) return;
            if (resultado.estado === 'invalida' ||
                (resultado.estado === 'valida' &&
                    (String(resultado.usuario.id_usuario) !== String(usuarioAutenticado.id_usuario) ||
                    resultado.usuario.rol !== usuarioAutenticado.rol))) {
                redirigirLoginPorSesion();
                return;
            }
            if (resultado.estado === 'valida') {
                actualizarEstadoPanelSesion('ready');
            } else if (document.body.dataset.sessionState === 'checking') {
                actualizarEstadoPanelSesion('error', 'No se pudo verificar tu sesión. Inténtalo de nuevo.');
            }
        } finally {
            if (secuencia === secuenciaVerificacion) verificacionEnCurso = false;
        }
    };

    window.addEventListener('pagehide', (event) => {
        if (event.persisted && !sesionPanelFinalizada) {
            secuenciaVerificacion += 1;
            verificacionEnCurso = false;
            actualizarEstadoPanelSesion('checking', 'Verificando tu sesión…');
        }
    });
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) revalidar({ ocultar: true });
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && document.body.dataset.sessionState === 'ready') {
            revalidar({ ocultar: true });
        }
    });
    actualizarEstadoPanelSesion('ready');
}

async function cerrarSesionPanel(elemento) {
    if (!elemento || elemento.getAttribute('aria-busy') === 'true') return null;

    elemento.setAttribute('aria-busy', 'true');
    elemento.setAttribute('aria-disabled', 'true');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIEMPO_MAXIMO_SESION_MS);
    try {
        const response = await apiFetch('/api/auth/logout', {
            method: 'POST',
            cache: 'no-store',
            signal: controller.signal
        });
        const resultado = await response.json().catch(() => null);
        if (!response.ok || resultado?.success !== true) return false;

        try {
            localStorage.removeItem('usuario');
            localStorage.setItem(CLAVE_CIERRE_SESION, `${Date.now()}-${Math.random()}`);
        } catch (_) {}

        sesionPanelFinalizada = true;
        actualizarEstadoPanelSesion('checking', 'Sesión cerrada. Redirigiendo…');
        window.location.replace('/admin/login.html');
        return true;
    } catch (_) {
        return false;
    } finally {
        clearTimeout(timeout);
        elemento.removeAttribute('aria-busy');
        elemento.removeAttribute('aria-disabled');
    }
}

if (document.body?.classList.contains('panel-body')) {
    window.addEventListener('storage', (event) => {
        if (event.key === CLAVE_CIERRE_SESION && event.newValue) redirigirLoginPorSesion();
    });
    window.addEventListener('jaguares:sesion-invalida', redirigirLoginPorSesion);
}
document.getElementById('session-gate-retry')?.addEventListener('click', () => window.location.reload());
