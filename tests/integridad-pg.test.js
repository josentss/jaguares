const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { configurarPostgresTemporal } = require('./helpers/postgres');
const esquema = configurarPostgresTemporal();
process.env.JWT_SECRET = 'clave-sintetica-solo-pruebas-integridad';
const db = require('../config/db');
const atletas = require('../controllers/atletaController');
const usuarios = require('../controllers/userController');
const auth = require('../controllers/authController');
const { conIdentidades } = require('../utils/integridad');
const { crearCredenciales } = require('../utils/sesion');
let esquemaCreado = false;

const atletaBase = {
    nombres: 'Prueba Atleta', apellidos: 'Sintético', fecha_nac: '2014-05-10',
    direccion: 'Calle de pruebas 12', telefono: '04141234567',
    allergies_medicas: '', hereda_cedula: '0', cedula: 'V-81000001'
};
const repNuevo = {
    representante_nuevo: '1', rep_nombres: 'Prueba Representante', rep_apellidos: 'Sintético',
    rep_correo: 'nuevo@example.org', rep_cedula: 'V-82000001',
    rep_telefono: '04141234567', rep_password: 'ClaveSintetica123'
};

async function ejecutar(fn, body, extras = {}) {
    let respuesta;
    const res = { codigo: 200,
        status(n) { this.codigo = n; return this; },
        json(datos) { respuesta = { codigo: this.codigo, body: datos }; return this; }
    };
    await fn({ body, usuarioId: 1, usuarioRol: 'representante', files: {}, ...extras }, res);
    assert.ok(respuesta, 'El controlador debe responder tras finalizar la transacción');
    return respuesta;
}

test.before(async () => {
    await db.pool.query(`CREATE SCHEMA ${esquema}`);
    esquemaCreado = true;
    await db.pool.query(`CREATE TABLE usuarios (
            id_usuario SERIAL PRIMARY KEY, nombres TEXT, apellidos TEXT, correo TEXT,
            cedula TEXT, telefono1 TEXT, telefono2 TEXT, password_hash TEXT,
            rol TEXT NOT NULL, estado TEXT NOT NULL
        );
        CREATE TABLE atletas (
            id_atleta SERIAL PRIMARY KEY, id_representante INTEGER REFERENCES usuarios(id_usuario),
            nombres TEXT, apellidos TEXT, cedula TEXT, cedula_heredada INTEGER,
            fecha_nacimiento DATE, direccion TEXT, telefono TEXT, alergias_medicas TEXT,
            foto_url TEXT, cedula_archivo_url TEXT, partida_nacimiento_url TEXT,
            estado TEXT NOT NULL
        );
        CREATE TABLE pagos (
            id_pago SERIAL PRIMARY KEY, id_atleta INTEGER REFERENCES atletas(id_atleta),
            ruta_captura TEXT
        );
        CREATE TABLE notificaciones (
            id_notificacion SERIAL PRIMARY KEY, id_usuario INTEGER REFERENCES usuarios(id_usuario),
            mensaje TEXT, tipo TEXT
        );
        INSERT INTO usuarios (id_usuario, nombres, apellidos, correo, cedula, rol, estado)
        VALUES (1, 'Prueba', 'Uno', 'uno@example.org', 'V-83000001', 'representante', 'aprobado'),
               (2, 'Prueba', 'Dos', 'dos@example.org', 'V-83000002', 'representante', 'aprobado'),
               (3, 'Prueba', 'Tres', 'tres@example.org', 'V-83000003', 'representante', 'inactivo'),
               (4, 'Prueba', 'Staff', 'staff@example.org', 'V-83000004', 'staff', 'activo');
        SELECT setval(pg_get_serial_sequence('usuarios', 'id_usuario'), 4);`);
});

test.after(async () => {
    try {
        if (esquemaCreado) await db.pool.query(`DROP SCHEMA ${esquema} CASCADE`);
    } finally { await db.pool.end(); }
});

// Deliberately no UNIQUE constraints on identity columns: these tests must
// demonstrate application protection rather than assume the production schema.
test('PG: dos altas simultáneas con la misma cédula propia persisten un atleta', async () => {
    const resultados = await Promise.all([
        ejecutar(atletas.registrarAtleta, atletaBase),
        ejecutar(atletas.registrarAtleta, { ...atletaBase, nombres: 'Otro Atleta' }, { usuarioId: 2 })
    ]);
    assert.deepEqual(resultados.map(r => r.codigo).sort(), [200, 409]);
    const { rows } = await db.pool.query('SELECT count(*)::int AS total FROM atletas WHERE cedula = $1', [atletaBase.cedula]);
    assert.equal(rows[0].total, 1);
});

test('PG: hermanos concurrentes tienen sufijos distintos y conservan documentos propios', async () => {
    const files = nombre => ({ foto: [{path: `https://example.org/${nombre}/foto`}],
        partida_nacimiento: [{path: `https://example.org/${nombre}/partida`}] });
    const resultados = await Promise.all(['Hermana Una', 'Hermana Dos'].map(nombres =>
        ejecutar(atletas.registrarAtleta, {...atletaBase, nombres, hereda_cedula:'1'},
            {files: files(nombres.replaceAll(' ', '-'))})));
    assert.deepEqual(resultados.map(r => r.codigo), [200, 200]);
    assert.deepEqual(resultados.map(r => r.body.cedula).sort(), ['V-83000001-1', 'V-83000001-2']);
    const { rows } = await db.pool.query("SELECT * FROM atletas WHERE cedula_heredada = 1 ORDER BY nombres");
    assert.equal(rows.length, 2);
    for (const row of rows) {
        assert.equal(row.id_representante, 1);
        assert.equal(row.foto_url, files(row.nombres.replaceAll(' ', '-')).foto[0].path);
        assert.equal(row.partida_nacimiento_url, files(row.nombres.replaceAll(' ', '-')).partida_nacimiento[0].path);
    }
});

test('PG: repetición simultánea de un atleta sin cédula propia se rechaza sin generar otra identidad', async () => {
    const body = {...atletaBase, nombres:'Atleta Repetida', hereda_cedula:'1'};
    const resultados = await Promise.all([ejecutar(atletas.registrarAtleta,body), ejecutar(atletas.registrarAtleta,body)]);
    assert.deepEqual(resultados.map(r => r.codigo).sort(), [200,409]);
});

test('PG: secuencia heredada conserva H-base y continúa después del sufijo mayor', async () => {
    await db.pool.query(`INSERT INTO atletas (id_representante, cedula, estado)
        VALUES (2, 'H-V-83000002', 'activo'), (2, 'V-83000002-8', 'inactivo')`);
    const r = await ejecutar(atletas.registrarAtleta,{...atletaBase,nombres:'Nueva Hermana',hereda_cedula:'1'},{usuarioId:2});
    assert.equal(r.codigo,200);
    assert.equal(r.body.cedula,'V-83000002-9');
    const anterior=await db.pool.query("SELECT count(*)::int AS total FROM atletas WHERE cedula = 'H-V-83000002'");
    assert.equal(anterior.rows[0].total,1);
});

test('PG: directiva recibe 400 ante cédula ausente, null, objeto o número', async () => {
    for (const cedula of [undefined,null,{},12345678]) {
        const r=await ejecutar(atletas.registrarAtletaDirectiva,{...atletaBase,...repNuevo,rep_cedula:cedula});
        assert.equal(r.codigo,400);
    }
    const {rows}=await db.pool.query('SELECT count(*)::int AS total FROM usuarios WHERE correo = $1',[repNuevo.rep_correo]);
    assert.equal(rows[0].total,0);
});

test('PG: error SQL después de insertar representante revierte toda el alta y permite reintentar', async () => {
    await db.pool.query(`CREATE FUNCTION rechazar_alta_prueba() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Fallo sintetico de prueba'; END; $$;
        CREATE TRIGGER fallo_prueba BEFORE INSERT ON atletas FOR EACH ROW EXECUTE FUNCTION rechazar_alta_prueba()`);
    try {
        const r = await ejecutar(atletas.registrarAtletaDirectiva,{...atletaBase,...repNuevo,cedula:'V-81000002'});
        assert.equal(r.codigo,500);
        const {rows}=await db.pool.query('SELECT count(*)::int AS total FROM usuarios WHERE correo = $1',[repNuevo.rep_correo]);
        assert.equal(rows[0].total,0);
        const notificaciones=await db.pool.query('SELECT count(*)::int AS total FROM notificaciones');
        assert.equal(notificaciones.rows[0].total,0);
    } finally {
        await db.pool.query('DROP TRIGGER fallo_prueba ON atletas; DROP FUNCTION rechazar_alta_prueba()');
    }
    const r = await ejecutar(atletas.registrarAtletaDirectiva,{...atletaBase,...repNuevo,cedula:'V-81000002'});
    assert.equal(r.codigo,200);
    assert.ok(r.body.representante.id_usuario);
    const {rows}=await db.pool.query('SELECT id_representante, estado FROM atletas WHERE id_atleta = $1',[r.body.id_atleta]);
    assert.equal(rows[0].id_representante,r.body.representante.id_usuario);
    assert.equal(rows[0].estado,'activo');
});

test('PG: nuevos representantes concurrentes con la misma cédula y correos distintos dejan una sola cuenta', async () => {
    const resultados=await Promise.all(['a','b'].map(sufijo=>ejecutar(atletas.registrarAtletaDirectiva,{
        ...atletaBase,...repNuevo,rep_cedula:'V-82000002',rep_correo:`rep-${sufijo}@example.org`,
        cedula:sufijo==='a'?'V-81000003':'V-81000004',nombres:`Atleta ${sufijo.toUpperCase()}`
    })));
    assert.deepEqual(resultados.map(r=>r.codigo).sort(),[200,409]);
    const {rows}=await db.pool.query("SELECT count(*)::int AS total FROM usuarios WHERE cedula = 'V-82000002'");
    assert.equal(rows[0].total,1);
});

test('PG: conflicto del atleta revierte también el representante nuevo', async () => {
    const r=await ejecutar(atletas.registrarAtletaDirectiva,{
        ...atletaBase,...repNuevo,rep_correo:'conflicto@example.org',rep_cedula:'V-82000009'
    });
    assert.equal(r.codigo,409);
    const {rows}=await db.pool.query("SELECT count(*)::int AS total FROM usuarios WHERE correo = 'conflicto@example.org'");
    assert.equal(rows[0].total,0);
});

test('PG: registro público y directiva coordinan el correo normalizado', async () => {
    const email='competencia@example.org';
    const resultados=await Promise.all([
        ejecutar(auth.register,{nombres:'Prueba Pública',apellidos:'Sintético',email:'  COMPETENCIA@example.org ',password:'ClaveSintetica123'}),
        ejecutar(atletas.registrarAtletaDirectiva,{...atletaBase,...repNuevo,rep_correo:email,
            rep_cedula:'V-82000003',cedula:'V-81000005',nombres:'Atleta Competencia'})
    ]);
    assert.deepEqual(resultados.map(r=>r.codigo).sort(),[200,409]);
    const {rows}=await db.pool.query('SELECT count(*)::int AS total FROM usuarios WHERE LOWER(TRIM(correo)) = $1',[email]);
    assert.equal(rows[0].total,1);
});

test('PG: perfiles simultáneos no pueden reclamar la misma cédula; IDs y roles del body no cambian el dueño', async () => {
    const body={nombres:'Perfil Prueba',apellidos:'Sintético',cedula:'V-84000001',telefono1:'04141234567',
        telefono2:'',password:'',id_usuario:4,rol:'admin'};
    const resultados=await Promise.all([1,2].map(usuarioId=>ejecutar(usuarios.actualizarPerfil,body,{usuarioId})));
    assert.deepEqual(resultados.map(r=>r.codigo).sort(),[200,409]);
    const {rows}=await db.pool.query("SELECT id_usuario,cedula,rol FROM usuarios WHERE cedula = 'V-84000001' OR id_usuario = 4 ORDER BY id_usuario");
    assert.equal(rows.length,2);
    assert.equal(rows[1].id_usuario,4);
    assert.equal(rows[1].rol,'staff');
    assert.equal(rows[1].cedula,'V-83000004');
});

test('PG: normalización detecta correo/cédula heredados en mayúsculas o con espacios', async () => {
    await db.pool.query("INSERT INTO usuarios (correo,cedula,rol,estado) VALUES (' LEGACY@example.org ', ' v-85000001 ', 'representante','aprobado')");
    const correo=await ejecutar(auth.register,{nombres:'Prueba Legacy',apellidos:'Sintético',email:'legacy@example.org',password:'ClaveSintetica123'});
    assert.equal(correo.codigo,409);
    const cedula=await ejecutar(atletas.registrarAtletaDirectiva,{...atletaBase,...repNuevo,rep_correo:'sin-colision@example.org',rep_cedula:'V-85000001'});
    assert.equal(cedula.codigo,409);
});

test('PG: alta de representante y cambio de perfil coordinan la misma cédula', async () => {
    const resultados=await Promise.all([
        ejecutar(usuarios.actualizarPerfil,{nombres:'Perfil Concurrente',apellidos:'Sintético',
            cedula:'V-87000001',telefono1:'04141234567',password:''},{usuarioId:2}),
        ejecutar(atletas.registrarAtletaDirectiva,{...atletaBase,...repNuevo,
            rep_correo:'perfil-concurrente@example.org',rep_cedula:'V-87000001',
            nombres:'Alta Concurrente',cedula:'V-81000009'})
    ]);
    assert.deepEqual(resultados.map(r=>r.codigo).sort(),[200,409]);
    const {rows}=await db.pool.query("SELECT count(*)::int AS total FROM usuarios WHERE cedula = 'V-87000001'");
    assert.equal(rows[0].total,1);
});

test('PG: representante inactivo, inexistente o de otro rol no recibe atletas activos', async () => {
    for (const id of [3,4,999999]) {
        const r=await ejecutar(atletas.registrarAtletaDirectiva,{...atletaBase,id_representante:id});
        assert.equal(r.codigo,409);
    }
});

test('PG: un cambio de cédula del representante no renumera atletas anteriores', async () => {
    const antes=await db.pool.query('SELECT id_atleta,cedula FROM atletas WHERE id_representante = 2 ORDER BY id_atleta');
    const r=await ejecutar(usuarios.actualizarPerfil,{nombres:'Prueba Dos',apellidos:'Sintético',cedula:'V-86000002',telefono1:'04141234567',password:''},{usuarioId:2});
    assert.equal(r.codigo,200);
    const despues=await db.pool.query('SELECT id_atleta,cedula FROM atletas WHERE id_representante = 2 ORDER BY id_atleta');
    assert.deepEqual(despues.rows,antes.rows);
});

test('PG: transacción fallida libera la conexión y el bloqueo para operaciones posteriores', async () => {
    await assert.rejects(conIdentidades(async client=>{
        await client.query("INSERT INTO usuarios (correo,rol,estado) VALUES ('rollback@example.org','representante','pendiente')");
        throw new Error('Fallo sintetico');
    }));
    const {rows}=await db.pool.query("SELECT count(*)::int AS total FROM usuarios WHERE correo = 'rollback@example.org'");
    assert.equal(rows[0].total,0);
    assert.equal(await conIdentidades(async client=>(await client.query('SELECT 42 AS n')).rows[0].n),42);
});

test('PG: bloqueo ocupado devuelve 503 sin alta parcial y permite reintentar', async () => {
    const bloqueo=await db.pool.connect();
    const body={...atletaBase,nombres:'Espera Prueba',cedula:'V-81000011'};
    try {
        await bloqueo.query('BEGIN');
        await bloqueo.query('SELECT pg_advisory_xact_lock(74219, 1)');
        const r=await ejecutar(atletas.registrarAtleta,body);
        assert.equal(r.codigo,503);
        assert.equal(r.body.success,false);
    } finally {
        await bloqueo.query('ROLLBACK');
        bloqueo.release();
    }
    const antes=await db.pool.query('SELECT count(*)::int AS total FROM atletas WHERE cedula = $1',[body.cedula]);
    assert.equal(antes.rows[0].total,0);
    assert.equal((await ejecutar(atletas.registrarAtleta,body)).codigo,200);
});

test('API: sesiones, roles y propiedad protegen planilla, documentos, perfil e historial', async () => {
    const app=require('../index');
    const server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    const token=id=> {
        const credenciales = crearCredenciales({id_usuario:id,rol:id===4?'staff':'representante'});
        return `${credenciales.token}; jaguares_actividad_${credenciales.payload.jti}=${credenciales.actividad}`;
    };
    try {
        const {rows}=await db.pool.query('SELECT id_atleta FROM atletas WHERE id_representante = 1 LIMIT 1');
        const id=rows[0].id_atleta;
        const pago=await db.pool.query('INSERT INTO pagos (id_atleta,ruta_captura) VALUES ($1,$2) RETURNING id_pago',
            [id,'https://example.org/comprobante-sintetico']);
        const captura=`/api/pagos/captura/${pago.rows[0].id_pago}`;
        for (const ruta of [`/api/atletas/${id}`,'/api/usuarios/perfil/1','/api/atletas/representante/1','/api/pagos/historial/1',captura]) {
            assert.equal((await fetch(base+ruta)).status,401);
            const ajeno=await fetch(base+ruta,{headers:{cookie:`token=${token(2)}`}});
            assert.equal(ajeno.status,403,ruta);
            const propio=await fetch(base+ruta,{headers:{cookie:`token=${token(1)}`}});
            assert.equal(propio.status,200,ruta);
        }
        const prohibido=await fetch(base+'/api/directiva/registrar-atleta',{
            method:'POST',headers:{cookie:`token=${token(1)}`,'Content-Type':'application/json'},body:JSON.stringify(atletaBase)});
        assert.equal(prohibido.status,403);
        const ficha=await fetch(`${base}/api/atletas/${id}`,{headers:{cookie:`token=${token(4)}`}});
        assert.equal(ficha.status,200);
        assert.equal((await ficha.json()).atleta.representante.id_representante,1);

        // Los archivos se resuelven por ID y propiedad en PostgreSQL, no por
        // URL/Cloudinary public_id aportado por el cliente.
        await db.pool.query('UPDATE atletas SET foto_url=$1, cedula_archivo_url=$2 WHERE id_atleta=$3',
            ['https://example.org/foto-sintetica.png', 'https://example.org/cedula-sintetica.pdf', id]);
        const rutaFoto = `/api/atletas/${id}/documentos/foto`;
        for (const ruta of [rutaFoto, `/api/atletas/${id}/documentos/cedula_archivo`]) {
            assert.equal((await fetch(base + ruta, {redirect:'manual'})).status,401);
            assert.equal((await fetch(base + ruta, {
                headers:{cookie:`token=${token(2)}`},redirect:'manual'
            })).status,403);
            for (const usuario of [1,4]) {
                const permitido = await fetch(base + ruta, {
                    headers:{cookie:`token=${token(usuario)}`},redirect:'manual'
                });
                assert.equal(permitido.status,302);
                assert.match(permitido.headers.get('location'),/^https:\/\/example\.org\//);
                assert.equal(permitido.headers.get('cache-control'),'no-store');
            }
        }
        const fichaAutorizada = await fetch(base+`/api/atletas/${id}`,{
            headers:{cookie:`token=${token(1)}`}});
        const doc = (await fichaAutorizada.json()).atleta.documentos;
        assert.equal(doc.foto_url,rutaFoto);
        assert.equal(doc.cedula_archivo_url,`/api/atletas/${id}/documentos/cedula_archivo`);
        assert.equal(doc.partida_nacimiento_url,null);
        const familia = await fetch(base+'/api/atletas/representante/1',{
            headers:{cookie:`token=${token(1)}`}});
        assert.ok((await familia.json()).atletas.some(a=>a.id_atleta===id&&a.foto_url===rutaFoto));
        const historial = await fetch(base+'/api/pagos/historial/1',{
            headers:{cookie:`token=${token(1)}`}});
        const pagoLista=(await historial.json()).datos.find(p=>p.id_pago===pago.rows[0].id_pago);
        assert.equal(pagoLista.ruta_captura,captura);
        assert.equal((await fetch(base+`/api/atletas/${id}/documentos/otro`,{
            headers:{cookie:`token=${token(1)}`}})).status,400);
        await db.pool.query('UPDATE atletas SET foto_url=NULL, cedula_archivo_url=NULL WHERE id_atleta=$1',[id]);

        // Owner/state come from the session/server. Document URLs come only
        // from Multer's req.files, never from client-supplied JSON fields.
        const alta=await fetch(base+'/api/atletas/registrar-atleta',{
            method:'POST',headers:{cookie:`token=${token(1)}`,'Content-Type':'application/json'},
            body:JSON.stringify({...atletaBase,nombres:'Alta API',cedula:'V-81000010',
                id_representante:2,estado:'activo',foto_url:'https://example.org/documento-ajeno'})
        });
        assert.equal(alta.status,200);
        const creada=await alta.json();
        const fila=await db.pool.query('SELECT id_representante,estado,foto_url FROM atletas WHERE id_atleta = $1',[creada.id_atleta]);
        assert.deepEqual(fila.rows[0],{id_representante:1,estado:'espera',foto_url:null});
    } finally {
        await new Promise(resolve=>server.close(resolve));
    }
});

test('PG: repetir identidad familiar con otra cédula propia o heredada no cambia el nacimiento ni crea otra ficha', async () => {
    const body = {...atletaBase, nombres:'Repetición Exacta', cedula:'V-89100011'};
    const primera = await ejecutar(atletas.registrarAtleta, body);
    assert.equal(primera.codigo,200);
    for (const cambio of [{cedula:'V-89100012'}, {hereda_cedula:'1',cedula:undefined}]) {
        const repetida = await ejecutar(atletas.registrarAtleta,{...body,...cambio});
        assert.equal(repetida.codigo,409);
        assert.match(repetida.body.message,/ya está registrado/i);
    }
    const {rows} = await db.pool.query(`SELECT id_atleta, cedula, fecha_nacimiento::text AS fecha
        FROM atletas WHERE id_representante = 1 AND nombres = $1`,[body.nombres]);
    assert.deepEqual(rows,[{id_atleta:primera.body.id_atleta,cedula:body.cedula,fecha:body.fecha_nac}]);
});

test('PG: variantes Unicode concurrentes de un nombre familiar no generan dos identidades', async () => {
    const variantes = [
        {nombres:'Prueba Núñez', apellidos:'Unicode', cedula:'V-89100021'},
        {nombres:'Prueba Nu\u0301ñez', apellidos:'Unicode', cedula:'V-89100022'}
    ];
    const resultados = await Promise.all(variantes.map((variante,i) => ejecutar(
        i ? atletas.registrarAtletaDirectiva : atletas.registrarAtleta,
        {...atletaBase,...variante,id_representante:1},
        i ? {usuarioId:4,usuarioRol:'staff'} : {}
    )));
    assert.deepEqual(resultados.map(r=>r.codigo).sort(),[200,409]);
    const {rows} = await db.pool.query('SELECT count(*)::int AS total FROM atletas WHERE cedula = ANY($1::text[])',
        [variantes.map(v=>v.cedula)]);
    assert.equal(rows[0].total,1);
});

test('PG: repartir el mismo nombre completo entre nombres y apellidos se coordina entre ambos paneles', async () => {
    const variantes = [
        {nombres:'Prueba María',apellidos:'Segmentada',cedula:'V-89100031'},
        {nombres:'Prueba',apellidos:'María Segmentada',cedula:'V-89100032'}
    ];
    const resultados = await Promise.all(variantes.map((variante,i) => ejecutar(
        i ? atletas.registrarAtletaDirectiva : atletas.registrarAtleta,
        {...atletaBase,...variante,id_representante:1},
        i ? {usuarioId:4,usuarioRol:'staff'} : {}
    )));
    assert.deepEqual(resultados.map(r=>r.codigo).sort(),[200,409]);
    const {rows} = await db.pool.query('SELECT count(*)::int AS total FROM atletas WHERE cedula = ANY($1::text[])',
        [variantes.map(v=>v.cedula)]);
    assert.equal(rows[0].total,1);
});

test('PG: coincidencias en otra familia y nacimientos diferentes se admiten conservando el día enviado', async () => {
    const body = {...atletaBase,nombres:'Coincidencia Permitida',cedula:'V-89100041'};
    const peticiones = [
        {body,usuarioId:1},
        {body:{...body,cedula:'V-89100042'},usuarioId:2},
        {body:{...body,cedula:'V-89100043',fecha_nac:'2014-05-11'},usuarioId:1}
    ];
    const ids = [];
    for (const peticion of peticiones) {
        const r = await ejecutar(atletas.registrarAtleta,peticion.body,{usuarioId:peticion.usuarioId});
        assert.equal(r.codigo,200);
        ids.push(r.body.id_atleta);
    }
    const {rows} = await db.pool.query(`SELECT id_representante, fecha_nacimiento::text AS fecha
        FROM atletas WHERE id_atleta = ANY($1::int[]) ORDER BY id_atleta`,[ids]);
    assert.deepEqual(rows,peticiones.map(p=>({id_representante:p.usuarioId,fecha:p.body.fecha_nac})));
});

test('PG: ambos controladores rechazan cuatro años y admiten cinco sin crear altas parciales', async () => {
    const partes = new Intl.DateTimeFormat('en-US', {
        timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(new Date());
    const parte = tipo => Number(partes.find(p=>p.type===tipo).value);
    const nacimiento = edad => {
        const year = parte('year') - edad;
        const month = parte('month');
        const day = Math.min(parte('day'),new Date(Date.UTC(year,month,0)).getUTCDate());
        return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    };
    for (const [i,fn] of [atletas.registrarAtleta,atletas.registrarAtletaDirectiva].entries()) {
        const body = {...atletaBase,nombres:i?'Edad Directiva':'Edad Representante',
            id_representante:1,cedula:`V-${89100051+i}`};
        const rechazada = await ejecutar(fn,{...body,fecha_nac:nacimiento(4)});
        assert.equal(rechazada.codigo,400);
        assert.match(rechazada.body.message,/5.*18/);
        const previa = await db.pool.query('SELECT count(*)::int AS total FROM atletas WHERE cedula = $1',[body.cedula]);
        assert.equal(previa.rows[0].total,0);
        const admitida = await ejecutar(fn,{...body,fecha_nac:nacimiento(5)});
        assert.equal(admitida.codigo,200);
        const persistida = await db.pool.query('SELECT fecha_nacimiento::text AS fecha FROM atletas WHERE id_atleta = $1',
            [admitida.body.id_atleta]);
        assert.equal(persistida.rows[0].fecha,nacimiento(5));
    }
});

test('PG: DATE se devuelve como fecha civil y TIMESTAMPTZ conserva su instante', async () => {
    const {rows} = await db.pool.query(`SELECT DATE '2026-11-02' AS fecha,
        TIMESTAMPTZ '2026-11-02 13:00:00+00' AS instante`);
    assert.equal(rows[0].fecha,'2026-11-02');
    assert.ok(rows[0].instante instanceof Date);
    assert.equal(rows[0].instante.toISOString(),'2026-11-02T13:00:00.000Z');
    assert.deepEqual(JSON.parse(JSON.stringify(rows[0])),{
        fecha:'2026-11-02',instante:'2026-11-02T13:00:00.000Z'
    });
});
