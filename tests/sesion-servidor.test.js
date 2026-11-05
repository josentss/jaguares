const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'secreto-sintetico-sesion-servidor';
process.env.DATABASE_URL = 'postgres://fixture:fixture@127.0.0.1:1/jaguares_test';
process.env.TRUST_PROXY = '0';
const { crearCredenciales, verificarCredenciales, establecerActividad } = require('../utils/sesion');
const usuarios = new Map([
    [1, {id_usuario:1,rol:'representante',estado:'aprobado',nombres:'Prueba',apellidos:'Sintética',correo:'prueba@example.org'}],
    [2, {id_usuario:2,rol:'directiva',estado:'activo',nombres:'Directiva',apellidos:'Sintética',correo:'directiva@example.org'}]
]);
let falloSql = false;
let estadoSoloPanel = null;
const dbPath = require.resolve('../config/db');
require.cache[dbPath] = { id:dbPath, filename:dbPath, loaded:true, exports:{
    query(sql, params, callback) {
        if (falloSql) return callback(new Error('fallo sintético'));
        assert.match(sql, /^SELECT (rol, estado|id_usuario, nombres, apellidos, correo, rol(?:, estado)?) FROM usuarios/);
        const user = usuarios.get(params[0]);
        const fila = user ? {...user} : null;
        if (fila && estadoSoloPanel && /rol, estado FROM usuarios/.test(sql)) fila.estado = estadoSoloPanel;
        callback(null, fila ? [fila] : []);
    }
} };
let server, base;
test.before(async () => {
    server = require('node:http').createServer();
    server.listen(0,'127.0.0.1');
    await new Promise(r=>server.once('listening',r));
    base = `http://127.0.0.1:${server.address().port}`;
    process.env.CORS_ORIGIN = base;
    server.on('request', require('../index'));
});
test.after(async () => { await new Promise(r=>server.close(r)); });
const cookie = c => Object.entries(c.cookies).map(([k,v])=>`${k}=${v}`).join('; ');
const credenciales = (id=1, ahora) => crearCredenciales(usuarios.get(id), ahora);

test('el servidor vence la actividad a los 15 minutos, aunque el JWT principal siga vigente', () => {
    const inicio = 1800000000;
    const c = credenciales(1, inicio);
    assert.equal(verificarCredenciales(c.cookies, inicio + 899).payload.id_usuario, 1);
    assert.throws(()=>verificarCredenciales(c.cookies, inicio + 900));
    assert.equal(jwt.verify(c.token, process.env.JWT_SECRET, {clockTimestamp:inicio + 900}).id_usuario, 1);
});

test('una actividad ajena, alterada, ausente o una sesión anterior al cambio no autentica', () => {
    const c = credenciales();
    for (const otra of [undefined, credenciales().actividad, c.actividad + 'alterada']) {
        assert.throws(()=>verificarCredenciales({...c.cookies, [`jaguares_actividad_${c.payload.jti}`]:otra}));
    }
    const anterior = jwt.sign({id_usuario:1,rol:'representante'},process.env.JWT_SECRET,{expiresIn:'12h'});
    assert.throws(()=>verificarCredenciales({...c.cookies,token:anterior}));
});

test('renovar actividad no excede las 12 horas ni vuelve a emitir la cookie principal', () => {
    const inicio = 1800000000;
    const c = credenciales(1, inicio);
    const cookies = [];
    const exp = establecerActividad({cookie:(...args)=>cookies.push(args)}, c.payload, inicio + 43100);
    assert.equal(exp, inicio + 43200);
    assert.equal(cookies.length, 1);
    assert.equal(cookies[0][0], `jaguares_actividad_${c.payload.jti}`);
    assert.equal(cookies[0][2].maxAge, 100000);
    assert.throws(()=>verificarCredenciales({token:c.token,[cookies[0][0]]:cookies[0][1]},inicio+43200));
});

for (const [id, panel] of [[1,'representante'],[2,'directiva']]) {
    test(`HTML ${panel}: autorización del servidor y datos iniciales sin exponer cookies`, async () => {
        const c = credenciales(id);
        const response = await fetch(`${base}/admin/panel-${panel}.html`,{headers:{cookie:cookie(c)}});
        assert.equal(response.status,200);
        assert.equal(response.headers.get('cache-control'),'no-store');
        const html = await response.text();
        assert.match(html, /id="sesion-inicial" type="application\/json"/);
        assert.match(html, /<body class="panel-body" data-session-state="starting">/);
        assert.equal(html.includes(c.token),false);
        assert.equal(html.includes(c.actividad),false);
        const payload = JSON.parse(/<script id="sesion-inicial" type="application\/json">(.*?)<\/script>/s.exec(html)[1]);
        assert.equal(payload.usuario.id_usuario,id);
        assert.equal(payload.sesion.id,c.payload.jti);
        assert.equal(response.headers.get('set-cookie'),null,'Abrir el panel no renueva la actividad automáticamente');
    });
}

test('HTML sin sesión, con rol ajeno o actividad vencida redirige antes de enviar el panel', async () => {
    for (const headers of [{},{cookie:cookie(credenciales(1))},{cookie:cookie(credenciales(2,Math.floor(Date.now()/1000)-901))}]) {
        const response = await fetch(base+'/admin/panel-directiva.html',{headers,redirect:'manual'});
        assert.equal(response.status,302);
        assert.equal(response.headers.get('location'),'/admin/login.html');
        assert.doesNotMatch(await response.text(),/Gestión Atletas/);
    }
});

test('las rutas codificadas del panel no evitan la autorización', async () => {
    for (const ruta of ['/admin/%70anel-directiva.html','/admin%2fpanel-representante.html','/ADMIN/PANEL-DIRECTIVA.HTML']) {
        const response = await fetch(base+ruta,{redirect:'manual'});
        assert.equal(response.status,302);
        assert.equal(response.headers.get('cache-control'),'no-store');
    }
});

test('los datos iniciales no pueden cerrar el script JSON ni ejecutar HTML', async () => {
    const anterior = usuarios.get(1).nombres;
    usuarios.get(1).nombres = '</script><script>alert(1)</script>&\u2028';
    try {
        const response = await fetch(base+'/admin/panel-representante.html',{headers:{cookie:cookie(credenciales())}});
        const html = await response.text();
        const contenido = /<script id="sesion-inicial" type="application\/json">(.*?)<\/script>/s.exec(html)[1];
        assert.equal(contenido.includes('<'),false);
        assert.equal(JSON.parse(contenido).usuario.nombres,usuarios.get(1).nombres);
    } finally { usuarios.get(1).nombres = anterior; }
});

test('el panel vuelve a comprobar el estado antes de insertar los datos iniciales', async () => {
    estadoSoloPanel = 'inactivo';
    try {
        const response = await fetch(base+'/admin/panel-representante.html',{
            headers:{cookie:cookie(credenciales())},redirect:'manual'
        });
        assert.equal(response.status,302);
        assert.equal(response.headers.get('location'),'/admin/login.html');
        assert.doesNotMatch(await response.text(),/sesion-inicial|Mi Historial/);
    } finally { estadoSoloPanel = null; }
});

test('un fallo SQL durante la entrada entrega error recuperable sin datos del panel', async () => {
    falloSql = true;
    const errorOriginal = console.error;
    console.error = () => {};
    try {
        const response = await fetch(base+'/admin/panel-representante.html',{headers:{cookie:cookie(credenciales())}});
        assert.equal(response.status,503);
        const html = await response.text();
        assert.match(html,/Reintentar/);
        assert.doesNotMatch(html,/sesion-inicial|Mi Historial/);
    } finally { falloSql = false; console.error = errorOriginal; }
});

test('me y consultas de estado no renuevan; solo actividad explícita renueva sin reemitir token', async () => {
    const headers = {cookie:cookie(credenciales())};
    const me = await fetch(base+'/api/auth/me',{headers});
    assert.equal(me.status,200);
    assert.equal(me.headers.get('set-cookie'),null);
    const actividad = await fetch(base+'/api/auth/actividad',{method:'POST',headers:{...headers,'X-Jaguares-Activity':'1',Origin:base}});
    assert.equal(actividad.status,200);
    const cookies = actividad.headers.getSetCookie();
    assert.equal(cookies.length,1);
    assert.match(cookies[0],/^jaguares_actividad_/);
    assert.match(cookies[0],/HttpOnly/);
    assert.equal((await actividad.json()).success,true);
    for (const extra of [{},{'X-Jaguares-Activity':'1',Origin:'https://ajeno.vercel.app'}]) {
        const rechazo = await fetch(base+'/api/auth/actividad',{method:'POST',headers:{...headers,...extra}});
        assert.equal(rechazo.status,403);
        assert.equal(rechazo.headers.get('set-cookie'),null);
    }
});

test('una renovación tardía después de cerrar sesión no autentica sin la cookie principal', async () => {
    const c = credenciales();
    const salida = await fetch(base+'/api/auth/logout',{method:'POST',headers:{cookie:cookie(c)}});
    assert.equal(salida.headers.getSetCookie().length,2);
    assert.ok(salida.headers.getSetCookie().every(v=>/Expires=Thu, 01 Jan 1970/i.test(v)));
    const response = await fetch(base+'/api/auth/me',{headers:{cookie:`jaguares_actividad_${c.payload.jti}=${c.actividad}`}});
    assert.equal(response.status,401);
});

test('una renovación tardía de la sesión anterior no sobrescribe la actividad de un nuevo login', () => {
    const anterior = credenciales();
    const nueva = credenciales();
    const combinadas = {...anterior.cookies,...nueva.cookies};
    assert.equal(verificarCredenciales(combinadas).payload.jti,nueva.payload.jti);
});

test('la API no renueva una sesión inactiva o vencida aunque se envíen sus cookies manualmente', async () => {
    const vencidas = credenciales(1,Math.floor(Date.now()/1000)-901);
    for (const ruta of ['/api/auth/me','/api/auth/actividad']) {
        const response = await fetch(base+ruta,{method:ruta.endsWith('actividad')?'POST':'GET',
            headers:{cookie:cookie(vencidas),'X-Jaguares-Activity':'1'}});
        assert.equal(response.status,401);
        assert.equal(response.headers.get('set-cookie'),null);
    }
    usuarios.get(1).estado = 'inactivo';
    try {
        const response = await fetch(base+'/api/auth/actividad',{method:'POST',headers:{cookie:cookie(credenciales()),'X-Jaguares-Activity':'1'}});
        assert.equal(response.status,403);
        assert.equal(response.headers.get('set-cookie'),null);
    } finally { usuarios.get(1).estado = 'aprobado'; }
});
