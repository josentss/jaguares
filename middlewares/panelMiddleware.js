const fs = require('node:fs/promises');
const path = require('node:path');
const db = require('../config/db');
const { verificarSesionRedirect } = require('./authMiddleware');
const { informacionSesion } = require('../utils/sesion');

const paneles = new Map([
    ['/admin/panel-directiva.html', ['admin', 'staff', 'directiva']],
    ['/admin/panel-representante.html', ['representante']]
]);
const plantillas = new Map();

// También interceptar rutas codificadas/normalizadas que express.static podría servir.
function rutaPanel(ruta) {
    try { return path.posix.normalize(decodeURIComponent(ruta).replace(/\\/g, '/')).toLowerCase(); }
    catch { return ''; }
}

function jsonSeguro(valor) {
    return JSON.stringify(valor).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

module.exports = function panelMiddleware(req, res, next) {
    const ruta = rutaPanel(req.path);
    const roles = paneles.get(ruta);
    if (!roles) return next();
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end();
    verificarSesionRedirect(req, res, () => {
        if (!roles.includes(req.usuarioRol)) return res.redirect('/admin/login.html');
        db.query('SELECT id_usuario, nombres, apellidos, correo, rol, estado FROM usuarios WHERE id_usuario = ?',
            [req.usuarioId], async (err, rows) => {
                if (err) return res.status(503).type('html').send('<!doctype html><html lang="es"><meta charset="utf-8"><title>Acceso temporalmente no disponible</title><body><h1>No se pudo cargar el panel</h1><p>Inténtalo de nuevo en unos momentos.</p><a href="">Reintentar</a></body></html>');
                const usuario = rows?.[0];
                if (!usuario || usuario.rol !== req.usuarioRol ||
                    ['pendiente', 'rechazado', 'inactivo'].includes(usuario.estado) ||
                    (usuario.rol === 'representante' && usuario.estado !== 'aprobado')) {
                    return res.redirect('/admin/login.html');
                }
                try {
                    let plantilla = plantillas.get(ruta);
                    if (!plantilla) {
                        plantilla = await fs.readFile(path.join(__dirname, '../public', ruta), 'utf8');
                        plantillas.set(ruta, plantilla);
                    }
                    const usuarioInicial = { id_usuario: usuario.id_usuario, nombres: usuario.nombres,
                        apellidos: usuario.apellidos, correo: usuario.correo, rol: usuario.rol };
                    const inicio = jsonSeguro({ success: true, usuario: usuarioInicial, sesion: informacionSesion(req) });
                    return res.type('html').send(plantilla
                        .replace('<!-- SESION_INICIAL -->', () => `<script id="sesion-inicial" type="application/json">${inicio}</script>`)
                        .replace('data-session-state="checking"', 'data-session-state="starting"'));
                } catch (error) { next(error); }
            });
    });
};
