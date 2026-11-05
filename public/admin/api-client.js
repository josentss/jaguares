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
let sesionVigente = null;
const CLAVE_ACTIVIDAD_SESION = 'jaguares:actividad';

function metadatosSesionValidos(sesion) {
    return sesion && typeof sesion.id === 'string' && sesion.id &&
        [sesion.vence, sesion.limite, sesion.servidor].every(Number.isFinite) &&
        sesion.servidor > 0 && sesion.vence > sesion.servidor &&
        sesion.limite >= sesion.vence;
}

function registrarVigenciaSesion(sesion, recibidoEn = Date.now()) {
    if (sesionPanelFinalizada || !metadatosSesionValidos(sesion) || !Number.isFinite(recibidoEn)) return false;
    if (sesionVigente?.id === sesion.id && sesion.vence < sesionVigente.vence) return false;
    sesionVigente = { ...sesion, desfase: recibidoEn - sesion.servidor };
    return true;
}

function interpretarSesion(payload, rolesPermitidos) {
    const usuario = payload?.usuario;
    const id = typeof usuario?.id_usuario === 'number' ? usuario.id_usuario
        : typeof usuario?.id_usuario === 'string' && /^[1-9]\d*$/.test(usuario.id_usuario) ? Number(usuario.id_usuario) : NaN;
    if (payload?.success !== true || !usuario || !Number.isSafeInteger(id) || id <= 0 ||
        !rolesPermitidos.includes(usuario.rol) || !metadatosSesionValidos(payload.sesion)) {
        return { estado: 'invalida' };
    }
    return { estado: 'valida', usuario, sesion: payload.sesion };
}

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

        return interpretarSesion(await response.json(), rolesPermitidos);
    } catch (_) {
        return { estado: 'error' };
    } finally {
        clearTimeout(timeout);
    }
}

async function exigirSesionPanel(rolesPermitidos) {
    const inicial = document.getElementById('sesion-inicial');
    let resultado;
    if (inicial) {
        try { resultado = interpretarSesion(JSON.parse(inicial.textContent), rolesPermitidos); } catch (_) {}
        inicial.remove();
    }
    if (!resultado) resultado = await consultarSesionPanel(rolesPermitidos);
    if (sesionPanelFinalizada) return null;
    if (resultado.estado === 'valida') {
        registrarVigenciaSesion(resultado.sesion);
        return resultado.usuario;
    }
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
                    resultado.usuario.rol !== usuarioAutenticado.rol ||
                    (sesionVigente && resultado.sesion?.id !== sesionVigente.id)))) {
                redirigirLoginPorSesion();
                return;
            }
            if (resultado.estado === 'valida') {
                registrarVigenciaSesion(resultado.sesion);
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
            revalidar();
        }
    });
    actualizarEstadoPanelSesion('ready');
    vigilarInactividad(rolesPermitidos, usuarioAutenticado);
}

function vigilarInactividad(rolesPermitidos, usuarioAutenticado) {
    if (!sesionVigente) return;
    const idSesion = sesionVigente.id;
    let ultimaRenovacion = Date.now();
    let actividadPendiente = false;
    let ultimaInteraccion = 0;
    let solicitudEnCurso = false;
    const aviso = document.createElement('aside');
    aviso.id = 'session-idle-warning';
    aviso.className = 'session-idle-warning';
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('aria-live', 'polite');
    aviso.setAttribute('aria-atomic', 'true');
    aviso.hidden = true;
    const icono = document.createElement('span');
    icono.className = 'session-idle-icon';
    icono.setAttribute('aria-hidden', 'true');
    icono.textContent = '!';
    const contenido = document.createElement('div');
    contenido.className = 'session-idle-content';
    const titulo = document.createElement('strong');
    titulo.className = 'session-idle-title';
    titulo.textContent = 'Sesión por vencer';
    const mensaje = document.createElement('p');
    const continuar = document.createElement('button');
    continuar.type = 'button';
    continuar.textContent = 'Continuar sesión';
    contenido.append(titulo, mensaje, continuar);
    aviso.append(icono, contenido);
    document.body.append(aviso);
    const restantes = () => sesionVigente.vence - (Date.now() - sesionVigente.desfase);

    const comprobar = async () => {
        if (solicitudEnCurso || sesionPanelFinalizada) return;
        solicitudEnCurso = true;
        try {
            // Otra pestaña puede haber renovado la cookie, incluso sin localStorage.
            const resultado = await consultarSesionPanel(rolesPermitidos);
            if (sesionPanelFinalizada) return;
            if (resultado.estado === 'invalida' || (resultado.estado === 'valida' &&
                (String(resultado.usuario.id_usuario) !== String(usuarioAutenticado.id_usuario) ||
                resultado.usuario.rol !== usuarioAutenticado.rol || resultado.sesion?.id !== idSesion))) {
                redirigirLoginPorSesion();
            } else if (resultado.estado === 'valida') {
                registrarVigenciaSesion(resultado.sesion);
                if (restantes() <= 0) redirigirLoginPorSesion();
                else actualizarEstadoPanelSesion('ready');
            } else {
                actualizarEstadoPanelSesion('error', 'No se pudo comprobar si tu sesión sigue activa. Comprueba la conexión y reintenta.');
            }
        } finally { solicitudEnCurso = false; }
    };

    const renovar = async () => {
        if (solicitudEnCurso || sesionPanelFinalizada) return;
        solicitudEnCurso = true;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIEMPO_MAXIMO_SESION_MS);
        try {
            const response = await apiFetch('/api/auth/actividad', { method: 'POST',
                headers: { 'X-Jaguares-Activity': '1' }, signal: controller.signal });
            const payload = await response.json();
            if (sesionPanelFinalizada) return;
            if (response.ok && payload.success && payload.sesion?.id === idSesion) {
                registrarVigenciaSesion(payload.sesion);
                ultimaRenovacion = Date.now();
                actividadPendiente = false;
                aviso.hidden = true;
                try { localStorage.setItem(CLAVE_ACTIVIDAD_SESION, JSON.stringify({sesion:payload.sesion, recibidoEn:Date.now()})); } catch (_) {}
            } else if (response.status === 401 || response.status === 403 || (response.ok && payload.sesion?.id !== idSesion)) {
                redirigirLoginPorSesion();
            } else {
                titulo.textContent = 'No se pudo renovar la sesión';
                mensaje.textContent = 'No se pudo renovar la sesión. Comprueba tu conexión y vuelve a intentarlo.';
                aviso.hidden = false;
            }
        } catch (_) {
            titulo.textContent = 'No se pudo renovar la sesión';
            mensaje.textContent = 'No se pudo renovar la sesión. Comprueba tu conexión y vuelve a intentarlo.';
            aviso.hidden = false;
        } finally { clearTimeout(timeout); solicitudEnCurso = false; }
    };

    const revisar = () => {
        if (sesionPanelFinalizada || document.visibilityState !== 'visible') return;
        if (Date.now() - ultimaInteraccion > 35000) actividadPendiente = false;
        const tiempo = restantes();
        if (tiempo <= 0) {
            actualizarEstadoPanelSesion('checking', 'Comprobando la vigencia de tu sesión…');
            comprobar();
        } else if (actividadPendiente && Date.now() - ultimaRenovacion >= 30000) {
            renovar();
        } else {
            aviso.hidden = tiempo > 60000;
            const limiteCercano = sesionVigente.limite - (Date.now() - sesionVigente.desfase) <= 60000;
            continuar.hidden = limiteCercano;
            if (!aviso.hidden) {
                titulo.textContent = limiteCercano ? 'Sesión por finalizar' : 'Sesión por vencer';
                mensaje.textContent = limiteCercano
                    ? 'Alcanzará su duración máxima en menos de un minuto. Guarda tus cambios e inicia sesión de nuevo.'
                    : 'Se cerrará por inactividad en menos de un minuto.';
            }
        }
    };
    continuar.addEventListener('click', renovar);
    for (const evento of ['pointerdown', 'keydown', 'input', 'scroll']) {
        document.addEventListener(evento, event => {
            if (!event.isTrusted || document.visibilityState !== 'visible' || sesionPanelFinalizada) return;
            actividadPendiente = true;
            ultimaInteraccion = Date.now();
            if (restantes() > 0 && Date.now() - ultimaRenovacion >= 30000) renovar();
        }, { passive: true, capture: true });
    }
    window.addEventListener('storage', event => {
        if (event.key !== CLAVE_ACTIVIDAD_SESION || !event.newValue) return;
        try {
            const dato = JSON.parse(event.newValue);
            if (dato.sesion?.id === idSesion && dato.sesion.vence > sesionVigente.vence) {
                if (registrarVigenciaSesion(dato.sesion, dato.recibidoEn)) aviso.hidden = true;
            }
        } catch (_) {}
    });
    document.addEventListener('visibilitychange', revisar);
    const timer = setInterval(revisar, 5000);
    window.addEventListener('pagehide', event => { if (!event.persisted) clearInterval(timer); });
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
