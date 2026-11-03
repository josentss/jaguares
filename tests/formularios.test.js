const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const v = require('../utils/validators');

function cargar(modulo, mocks) {
    const ruta = require.resolve(modulo);
    delete require.cache[ruta];
    const original = Module._load;
    Module._load = function (solicitud, padre, principal) {
        if (Object.prototype.hasOwnProperty.call(mocks, solicitud)) return mocks[solicitud];
        return original.call(this, solicitud, padre, principal);
    };
    try { return require(modulo); }
    finally { Module._load = original; }
}

function respuesta() {
    return {
        statusCode: 200, body: null,
        status(n) { this.statusCode = n; return this; },
        json(o) { this.body = o; return this; }
    };
}

test('consultas por representante: IDs malformados devuelven 400 sin acceder a SQL, incluso con rol administrativo', () => {
    let consultas = 0;
    const mocks = {'../config/db': {query() {consultas++;}}};
    const notificaciones = cargar('../controllers/notificacionesController', mocks);
    const handlers = [cargar('../controllers/userController', mocks).obtenerPerfil,
        cargar('../controllers/atletaController', mocks).obtenerAtletasPorRepresentante,
        cargar('../controllers/pagosController', mocks).obtenerHistorial,
        notificaciones.obtenerNotificaciones, notificaciones.borrarNotificaciones];
    for (const fn of handlers) for (const id of ['abc', '0', '-1', '1.2', '1e3', '9007199254740993']) {
        const res = respuesta();
        fn({params:{id,id_rep:id},usuarioId:1,usuarioRol:'admin'},res);
        assert.equal(res.statusCode,400);
    }
    assert.equal(consultas,0);
});

test('nombres: letras Unicode, ñ, tildes y apóstrofes sin números ni HTML', () => {
    for (const x of ['Ana María', 'José-Luis', "O'Connor", 'Ñúñez', 'D’Angelo', 'María Elena']) {
        assert.equal(v.esNombreValido(x), true, x);
    }
    for (const x of ['A', 'Ana123', '<script>', 'Juan_2', '👋', 'Ana  ', ' '.repeat(3), 'A'.repeat(81), {}, null]) {
        if (x === 'Ana  ') continue;
        assert.equal(v.esNombreValido(x), false, String(x));
    }
});

test('cédulas: V/E y 7 a 9 dígitos sin sufijos', () => {
    for (const x of ['V-12345678', 'E-1234567', 'v-12345678']) assert.equal(v.esCedulaValida(x), true);
    for (const x of ['V-1234', 'V-578546', 'V-1234567890', 'X-12345678', 'V-123abc', 'V-12345678-1', '12345678', null]) {
        assert.equal(v.esCedulaValida(x), false, String(x));
    }
});

test('teléfonos: aceptan formatos nacionales/internacionales y rechazan letras', () => {
    for (const x of ['04141234567', '0414 123-4567', '+584141234567', '584141234567', '+573001234567']) {
        assert.equal(v.esTelefonoValido(x), true, x);
    }
    for (const x of ['12345', 'abc123456', '0414<script>', '0414;1234567', '000000', null]) {
        assert.equal(v.esTelefonoValido(x), false, String(x));
    }
    assert.equal(v.normalizarTelefono('0414 123-4567'), '04141234567');
});

test('direcciones y observaciones: admiten datos legítimos, rechazan control y etiquetas', () => {
    assert.equal(v.esTextoLibreValido('Calle 5, casa #22, Barinas', 255), true);
    assert.equal(v.esTextoLibreValido('Alergia a nueces\nUsa inhalador', 500, false), true);
    assert.equal(v.esTextoLibreValido('Calle <script>', 255), false);
    assert.equal(v.esTextoLibreValido('x'.repeat(256), 255), false);
    assert.equal(v.esTextoLibreValido('   ', 255), false);
    assert.equal(v.esTextoLibreValido('', 500, false), true);
    assert.equal(v.esPasswordValida(' '.repeat(8)), false);
    assert.equal(v.esPasswordValida('A'.repeat(129)), false);
});

test('registro: nombres no válidos no se insertan en base de datos', async () => {
    let consultas = 0;
    const db = {query() { consultas++; }};
    const auth = cargar('../controllers/authController', {
        '../config/db': db,
        '../utils/requestLogger': {logAdminRequest() {}}
    });
    const req = {body:{nombres: 'Juan💣', apellidos: 'Pérez', email: 'test@example.com', password: 'claveSegura123'}};
    const res = respuesta();
    await auth.register(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(consultas, 0);
});

test('perfil: cédula, teléfono y nombres incorrectos se rechazan sin actualizar', async () => {
    let consultas = 0;
    const users = cargar('../controllers/userController', {'../config/db': {query() {consultas++;}}});
    const base = {nombres: 'Ana María', apellidos: 'Pérez', cedula: 'V-12345678',
        telefono1: '04141234567', telefono2: '', password: ''};
    for (const alter of [
        {nombres:'Ana1'}, {apellidos:'Pérez 💣'}, {cedula:'V-12'},
        {telefono1:'abc123'}, {telefono2:'0414asdasdas'},
        {password:'corta'}, {nombres:'A'.repeat(81)}
    ]) {
        const res = respuesta();
        await users.actualizarPerfil({usuarioId:5,body:{...base,...alter}},res);
        assert.equal(res.statusCode, 400, JSON.stringify(alter));
    }
    assert.equal(consultas, 0);
});

test('perfil válido: normaliza teléfono y devuelve éxito; duplicado devuelve 409', async () => {
    const consultas = [];
    let duplicada = false;
    const client = { async query(sql, params) {
        consultas.push({sql, params});
        return { rows: sql.includes('SELECT') ? [{id_usuario: 5}] : [], rowCount: 1 };
    }};
    const user=cargar('../controllers/userController', {'../utils/integridad': {
        async conIdentidades(fn) { return fn(client); },
        async comprobarUsuario() {
            if (duplicada) throw Object.assign(new Error('Duplicada'), {code:'23505'});
        },
        responderError(res) { return res.status(409).json({success:false}); }
    }});
    const body={nombres:'Ana María',apellidos:'Pérez-López',cedula:'v-12345678',
        telefono1:'0414 123-4567',telefono2:'',password:''};
    const res=respuesta();
    await user.actualizarPerfil({usuarioId:5,body},res);
    assert.equal(res.statusCode,200);
    const actualizacion = consultas.find(x => x.sql.includes('UPDATE usuarios'));
    assert.ok(actualizacion.params.includes('V-12345678'));
    assert.ok(actualizacion.params.includes('04141234567'));
    duplicada = true;
    const duplicate=respuesta();
    await user.actualizarPerfil({usuarioId:5,body},duplicate);
    assert.equal(duplicate.statusCode,409);
});

test('inscripción: no admite datos inválidos, sin ejecutar INSERT', () => {
    let consultas=0;
    const atleta=cargar('../controllers/atletaController', {
        '../config/db':{query(){consultas++;}},
        './notificacionesController':{crearNotificacion(){}}
    });
    const base={nombres:'Ana María',apellidos:'Pérez',cedula:'V-12345678',
        hereda_cedula:'0',fecha_nac:'2012-09-12',
        direccion:'Calle 5 #2-2',telefono:'04141234567',
        allergies_medicas:'Ninguna'};
    const cambios=[
        {nombres:'Ana123'}, {apellidos:'<b>Hola</b>'},
        {cedula:'V-123abc'}, {cedula:'V-578546'}, {direccion:' '.repeat(256)},
        {direccion:'2356'}, {direccion:'Calle ' + '3'.repeat(30)},
        {allergies_medicas:'s43678ikjhgf'}, {allergies_medicas:'435534'},
        {fecha_nac:'1908-06-16'},
        {telefono:'abc12'}, {allergies_medicas:'X'.repeat(501)},
        {fecha_nac:'2026-02-30'}
    ];
    for(const cambio of cambios) {
        const res=respuesta();
        atleta.registrarAtleta({body:{...base,...cambio},usuarioId:5,files:{}},res);
        assert.equal(res.statusCode,400,JSON.stringify(cambio).slice(0,90));
    }
    assert.equal(consultas,0);
});

test('inscripción: rechaza tipos y selectores ambiguos antes de intentar persistir', async () => {
    let altas = 0;
    const atleta = cargar('../controllers/atletaController', {
        '../config/db': {},
        '../utils/inscripcion': { async inscribir() { altas++; return {}; } },
        './notificacionesController': { crearNotificacion() {} }
    });
    const base = { nombres:'Atleta Prueba', apellidos:'Sintético', cedula:'V-81000001',
        hereda_cedula:'0', fecha_nac:'2014-05-10', direccion:'Calle de pruebas 12' };
    for (const cambio of [
        {fecha_nac:['2014-05-10']}, {telefono:0}, {telefono:false},
        {hereda_cedula:{}}, {hereda_cedula:'quizas'},
        {representante_nuevo:'quizas', id_representante:1},
        {allergies_medicas:'', alergias_medicas:'<script>'},
        {allergies_medicas:'Asma', alergias_medicas:'Ninguna'}
    ]) {
        const res = respuesta();
        const fn = 'representante_nuevo' in cambio ? atleta.registrarAtletaDirectiva : atleta.registrarAtleta;
        await fn({body:{...base,...cambio},usuarioId:1,files:{}},res);
        assert.equal(res.statusCode,400,JSON.stringify(cambio));
    }
    assert.equal(altas,0);
});

test('inscripción: valida y guarda la misma observación médica con cualquiera de sus nombres compatibles', async () => {
    const altas = [];
    const atleta = cargar('../controllers/atletaController', {
        '../config/db': {},
        '../utils/inscripcion': { async inscribir(datos) { altas.push(datos.atleta); return {}; } },
        './notificacionesController': { crearNotificacion() {} }
    });
    const base = {nombres:'Atleta Prueba',apellidos:'Sintético',cedula:'V-81000001',
        fecha_nac:'2014-05-10',direccion:'Calle de pruebas 12'};
    for (const datos of [ {}, {allergies_medicas:' Asma '}, {alergias_medicas:' Asma '},
        {allergies_medicas:'Asma',alergias_medicas:'Asma'}, {telefono:null} ]) {
        const res = respuesta();
        await atleta.registrarAtleta({body:{...base,...datos},usuarioId:1,files:{}},res);
        assert.equal(res.statusCode,200);
        assert.equal(altas.at(-1).alergias, Object.keys(datos).some(x=>x.includes('medicas')) ? 'Asma' : '');
    }
});


test('edad real: entre 5 y 18 años cumplidos, sin permitir menores de 5 ni fechas futuras', () => {
    const hoy = '2026-11-02';
    for (const fecha of ['2007-11-03', '2008-11-02', '2010-01-01', '2021-11-02']) {
        assert.equal(v.esEdadAtletaValida(fecha, hoy), true, fecha);
    }
    for (const fecha of ['2007-11-02', '1908-06-16', '2021-11-03', '2026-11-02', '2026-11-03', '2026-02-30']) {
        assert.equal(v.esEdadAtletaValida(fecha, hoy), false, fecha);
    }
});

test('textos de inscripción: direcciones descriptivas y datos médicos auténticos', () => {
    for (const direccion of ['Barrio 1', 'Calle 5, casa #22, Barinas', 'Av. 23 de Enero, piso 2']) {
        assert.equal(v.esDireccionValida(direccion), true, direccion);
    }
    for (const direccion of ['2356', '123456789', 'Calle ' + '3'.repeat(30), 'A', '<script>alert(1)</script>']) {
        assert.equal(v.esDireccionValida(direccion), false, direccion);
    }
    for (const nota of ['', 'Ninguna', 'Asma', 'Diabetes tipo 1', 'Vitamina B12', 'Alérgico a 500 mg de medicamento']) {
        assert.equal(v.esCondicionMedicaValida(nota), true, nota);
    }
    for (const nota of ['s43678ikjhgf', '23334', '<img onerror=alert(1)>']) {
        assert.equal(v.esCondicionMedicaValida(nota), false, nota);
    }
});
