// Envía la cookie de sesión en todas las peticiones al mismo servidor.
window.apiFetch = function apiFetch(url, options = {}) {
    return fetch(url, {
        credentials: 'include',
        ...options
    });
};
