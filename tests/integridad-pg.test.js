const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// Separate schema from pagos-pg.test.js, even when both files run in parallel.
// This suite must only run against the disposable CI/local PostgreSQL database.
const destino = new URL(process.env.DATABASE_URL || 'postgres://invalid/');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(destino.hostname) ||
    destino.pathname !== '/jaguares_test') {
    throw new Error('Integridad requiere PostgreSQL local desechable: base jaguares_test');
}
process.env.PGOPTIONS = '-c search_path=jaguares_integridad_test';
process.env.JWT_SECRET = 'clave-sintetica-solo-pruebas-integridad';
const db = require('../config/db');
const atletas = require('../controllers/atletaController');
const usuarios = require('../controllers/userController');
const auth = require('../controllers/authController');
const { conIdentidades } = require('../utils/integridad');
const jwt = require('jsonwebtoken');
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
    await db.pool.query('CREATE SCHEMA jaguares_integridad_test');
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
        if (esquemaCreado) await db.pool.query('DROP SCHEMA jaguares_integridad_test CASCADE');
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
    const token=id=>jwt.sign({id_usuario:id,rol:id===4?'staff':'representante'},process.env.JWT_SECRET);
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
