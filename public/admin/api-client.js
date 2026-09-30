async function apiFetch(url, options = {}) {
    const opts = { credentials: 'include', ...options };
    // Solo poner JSON si el body no es FormData
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
