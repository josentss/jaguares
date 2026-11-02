# Auditoría de integridad — seguimiento de PR #6

Fecha: 2026-11-02. Base verificada: `main` `46ce6bfe92ee0f2aba03d5d25165e7234ad6d78b`.
Rama: `integridad/auditoria-relaciones-permisos`. Complementa [la auditoría inicial](AUDITORIA_INTEGRIDAD.md).

**Actualización posterior a la entrega:** [PR #7](https://github.com/josentss/jaguares/pull/7) fusionado en `8d5855f`; [CI remoto](https://github.com/josentss/jaguares/actions/runs/41540524642) confirmado con 64 backend + 10 Playwright. Registro Vercel/GitHub del SHA en Production completado y navegación anónima de la web pública verificada en escritorio/móvil. Los estados «PR/CI pendiente» de este informe corresponden a la entrega inicial. La [guía de 75 casos manuales](PRUEBAS_MANUALES_WEB.md) distingue comprobaciones ya ejecutadas de flujos autenticados pendientes; no hubo escrituras de producción durante esta verificación.

## Estado contrastado

- Git remoto y local coinciden. Los PR [#1](https://github.com/josentss/jaguares/pull/1), [#2](https://github.com/josentss/jaguares/pull/2), [#3](https://github.com/josentss/jaguares/pull/3), [#4](https://github.com/josentss/jaguares/pull/4), [#5](https://github.com/josentss/jaguares/pull/5) y [#6](https://github.com/josentss/jaguares/pull/6) están fusionados y sus commits de fusión forman parte de `main`.
- El [CI del #6](https://github.com/josentss/jaguares/actions/runs/41489653686) terminó satisfactoriamente. El [estado Vercel del commit de main](https://vercel.com/josents-projects/jaguares/DKBpuWomrdMMLyJMwkaVCn9AKtiL) es satisfactorio. No se inspeccionaron variables, datos ni flujos funcionales en Vercel: ese estado no acredita una prueba de producción ni identifica por sí solo el entorno del despliegue.
- El contexto maestro todavía describía #6 como pendiente. Las transacciones, controles de duplicados, secuencias heredadas y permisos del #6 ya existen; no se reimplementaron.
- Al iniciar había cuatro comprobantes versionados ausentes/inaccesibles en `private_uploads`. Se conserva ese estado; los archivos no se abren ni se incluyen en esta entrega.

## Mapa de entidades y garantías verificadas

| Entidad / relación | Código actual y evidencia | Límite |
| --- | --- | --- |
| Usuario / representante | `usuarios.id_usuario`; rol y estado se vuelven a consultar por solicitud. Alta pública normaliza correo; perfil y alta de directiva comprueban cédula en la transacción compartida | No hay entidad independiente de representante. El registro público no captura cédula; nombres iguales con correos diferentes no acreditan la misma identidad |
| Atleta → representante | `atletas.id_representante`; la sesión decide el propietario de un alta propia. Directiva exige representante aprobado del rol correcto y bloquea su fila durante el alta | PK/FK reales no inspeccionadas; las FK se ejercitaron en el esquema temporal |
| Identidad del atleta | Cédula propia normalizada y única entre atletas mediante control cooperativo. Repetición de nombre, apellido y nacimiento dentro de una familia devuelve 409 | No hay cotejo de identidad entre familias ni equivalencia general de grafías/Unicode; no se fusionan personas automáticamente |
| Hermanos / cédula heredada | Servidor genera sufijos distintos bajo advisory lock; respeta `H-base`, el sufijo máximo y datos anteriores. El cambio de cédula del representante conserva las identidades ya emitidas | La base heredada histórica puede diferir de la cédula actual del representante sin que eso demuestre corrupción. Secuencias fuera del entero seguro requieren revisión |
| Pago → atleta → propietario | `pagos.id_atleta`; historial/comprobante derivan el representante con JOIN. Un reporte exige dueño, atleta activo, rol representante y cuenta aprobada | Sin modelo de cargos/año/temporada ni política de duplicados financieros definida; no se añade UNIQUE por atleta/mes |
| Documentos | URLs en columnas del atleta y comprobante en el pago, tomadas de Multer. Planilla y comprobante comprueban propietario/rol | URLs externas no implican almacenamiento privado. Carga Cloudinary y transacción SQL no son atómicas |
| Notificación → usuario | Creación posterior al cambio principal; consulta/borrado comprueban dueño o rol administrativo | Mejor esfuerzo: puede fallar tras un commit válido. Persistencia de lectura y auditoría histórica siguen pendientes |

Se recorrieron rutas, middleware de sesión/carga, controladores de identidad/pagos/directiva/notificaciones, adaptador PostgreSQL y validadores. Las consultas revisadas usan parámetros. No existen un esquema SQL canónico ni migraciones versionadas que acrediten las restricciones de Supabase.

No se encontró edición general, traspaso o eliminación de atletas/cuentas/pagos en las rutas actuales: creación, consulta y cambios de estado son los caminos vigentes. El perfil se edita mediante el ID de sesión; IDs, roles, estados y URLs incluidos en JSON no cambian dueño/rol/documentos. Las pruebas existentes de propiedad y concurrencia del #6 permanecen activas.

## Diagnóstico priorizado y reproducción

| Prioridad / estado | Causa y reproducción | Corrección / evidencia | Migración |
| --- | --- | --- | --- |
| P1, confirmado: pago sobre un estado anterior durante una modificación concurrente | `INSERT ... SELECT` consultaba estados sin bloquear filas. Una conexión mantiene `UPDATE` de estado/rol sin commit; otra reporta un pago y obtenía 200 antes de terminar ese cambio. Reproducido con cuenta revocada, rol revocado y atleta inactivo | `FOR SHARE OF a, u` espera los cambios y reevalúa elegibilidad; si se confirman devuelve 409 sin insertar, si se revierten permite pagar. Pruebas observan una espera real mediante `pg_blocking_pids` | No |
| P1, confirmado: activación mientras cambia el representante | `UPDATE atletas ... EXISTS` podía leer al representante aprobado anterior, aunque otra transacción lo estaba revocando | `FOR SHARE OF u` dentro de la comprobación. Se ejercitan estado, rol y rollback: tras revocación confirmada el atleta permanece inactivo | No |
| P1, confirmado: observación médica validada distinta de la guardada | Se elegía el campo con `??` al validar y con `||` al guardar. `allergies_medicas=''` y un segundo `alergias_medicas` no vacío eludían la validación del valor persistido | Una sola selección de valor para validar/persistir. Ambos nombres siguen admitidos individualmente; valores contradictorios se rechazan con 400 | No |
| P1, confirmado: prueba SQL sin protección de destino | `tests/pagos-pg.test.js` importaba la conexión configurada sin limitar host/base; podía intentar DDL fuera de una base de pruebas. La suite de integridad ya tenía un control parcial | Ambas exigen URL explícita de base local `jaguares_test`, rechazan parámetros que puedan sustituir host/base/options, usan esquemas aleatorios y solo eliminan el esquema que crearon. Prueba del guard sin conexión | No |
| P2, confirmado: coerción de entradas y selectores | Un array con una fecha se convertía en fecha válida; teléfono `0`/`false` se omitía; indicadores desconocidos se interpretaban como falso | Fecha de tipo string, teléfono opcional validado si está presente e indicadores limitados a representaciones de formulario/JSON conocidas. Ausencia de indicador conserva el valor falso predeterminado | No |
| P2, confirmado: IDs de consulta sin validación uniforme | Perfil, lista de atletas, historial y notificaciones enviaban IDs malformados a SQL si el rol tenía acceso | 400 antes de consultar SQL; no se modifican los permisos por dueño/rol. Prueba con rol administrativo y seis clases de ID inválido | No |
| P0, pendiente de bloque de archivos | `validarMagicBytes` devuelve siempre true; el filtro de atleta confía en MIME declarado y usa `resource_type: auto`. No se ha comprobado un acceso real no autorizado a Cloudinary | Sin cambio de almacenamiento en esta entrega; requiere validación antes de subir, almacenamiento privado y limpieza trazable. Priorizar un PR de archivos/dependencias | Por evaluar |
| Por verificar: datos y constraints históricos | Sin conexión a Supabase ni exportación anonimizada; desconocidos UNIQUE/FK/CHECK reales, huérfanos y duplicados históricos | Pendiente auditoría con permisos de lectura y resultados agregados, antes de proponer constraints o reparación | Por evaluar tras lectura |

Las carreras de revocación del representante se reprodujeron con transacciones SQL sintéticas. No se identificó un endpoint actual que permita a un representante modificar su propio rol/estado; no se presenta ese caso como un ataque HTTP demostrado. La carrera del estado del atleta afecta una operación administrativa existente.

El alcance y la priorización se comunicaron antes de modificar lógica. No se decidieron tarifas, categorías, sanciones, eliminación, transferencias ni comunicaciones.

## Transacciones, datos históricos y riesgos residuales

- Las altas compuestas continúan usando una conexión con BEGIN/COMMIT/ROLLBACK. El fallo SQL forzado revierte usuario y atleta; se conservan las pruebas del #6 de concurrencia, sufijos, conflictos y rollback.
- Los nuevos bloqueos duran hasta finalizar la sentencia SQL de pago/activación. No añaden transacciones entre solicitudes ni bloqueos en memoria. Pueden esperar escrituras administrativas largas; estos dos caminos no fijan un `lock_timeout` propio. Revisar tiempos en una base de desarrollo antes de desplegar; una interrupción/deadlock no debe declararse éxito.
- El advisory lock de identidades sigue siendo global y cooperativo: otras versiones/escrituras SQL pueden eludirlo. No sustituye los constraints futuros.
- No se migran, renumeran, fusionan, borran ni endurecen retrospectivamente registros. Usuarios con cédulas antiguas cortas o teléfonos incompletos pueden seguir necesitando revisión antes de editar el perfil/emitir una heredada.
- Una desconexión exactamente durante COMMIT puede dejar respuesta incierta; falta idempotencia persistente. El reintento de alta mantiene los controles de duplicados, sin recuperar necesariamente la respuesta original.
- No se garantiza compensación de archivos ya subidos al fallar SQL. No se borran archivos remotos. Revisar también comprobantes/logs privados versionados mediante un trabajo autorizado sin exponer su contenido.
- La consulta `npm audit --package-lock-only --json` confirmó 12 alertas (1 crítica, 7 altas, 2 moderadas, 2 bajas). Es un resultado del lockfile, no una demostración de explotación. No se ejecutó `audit fix`; evaluar actualizaciones y compatibilidad con Cloudinary en otro bloque.
- CORS/cookies/CSRF, tipos de entrada de autenticación/CMS, límites persistentes en Vercel y fechas de calendario en navegador requieren auditoría de seguridad adicional. No se consideran saneados por estas pruebas.

## Pruebas y reproducción local

Utilizar una instancia PostgreSQL creada exclusivamente para pruebas, base `jaguares_test` y una URL explícita de loopback con `sslmode=disable`. No usar `.env` de producción ni un túnel a producción. El guard reduce errores de configuración; el nombre/host por sí solos no acreditan que una instancia sea desechable.

```powershell
npm.cmd ci
$env:DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5432/jaguares_test?sslmode=disable'
node --test tests/seguridad.test.js tests/estados-y-sesiones.test.js tests/formularios.test.js tests/postgres-config.test.js tests/pagos-pg.test.js tests/integridad-pg.test.js

# Herramienta de navegador aislada; no modifica los manifiestos del proyecto.
npm.cmd install --prefix node_modules/.cache/jaguares-herramientas --no-save --package-lock=false playwright@1.56.1
$env:NODE_PATH = (Resolve-Path node_modules/.cache/jaguares-herramientas/node_modules).Path
node node_modules/.cache/jaguares-herramientas/node_modules/playwright/cli.js install chromium
node --test tests/interfaz.test.js
```

La base local fue PostgreSQL 18 temporal y solo loopback, con registros sintéticos; CI conserva PostgreSQL 16 y Node 22. Las pruebas de navegador usan APIs simuladas; las SQL/API usan PostgreSQL real temporal. Los errores sintéticos P0001/55P03 corresponden a regresiones de rollback/bloqueo, no a pruebas fallidas.

Resultados finales: 64/64 backend en Node 24.15.0 y 64/64 en Node 22.23.4; 10/10 Playwright con Chromium 141.0.7390.37 sobre Node 24; 37 archivos JavaScript con sintaxis correcta en ambas versiones; `git diff --check` correcto. Son 74 escenarios distintos, 11 nuevos de backend respecto a main. No se ejecutó PostgreSQL 16 localmente ni CI remoto para esta rama. Una ejecución intermedia detectó una notificación pendiente al eliminar el esquema de prueba; la versión final espera su persistencia y terminó sin ese error.

## Archivos de la entrega

- Lógica: `controllers/atletaController.js`, `controllers/directivaController.js`, `controllers/pagosController.js`, `controllers/userController.js`, `controllers/notificacionesController.js`, `utils/validators.js`.
- Pruebas: `tests/formularios.test.js`, `tests/pagos-pg.test.js`, `tests/integridad-pg.test.js`, nuevos `tests/helpers/postgres.js` y `tests/postgres-config.test.js`.
- CI y artefactos: `.github/workflows/verificacion.yml`, `.gitignore` (capturas generadas fuera del control de versiones).
- Documentación: este informe, `docs/AUDITORIA_INTEGRIDAD.md` y `docs/CONTEXTO_MAESTRO_CODEX.md`.

## Revisión y siguiente fase

1. Revisar esta rama y ejecutar CI al abrir el PR. Esta entrega local no acredita CI remoto del cambio.
2. Validar en una base de desarrollo la espera de bloqueos y mensajes 409 con ambos paneles, usando documentos y cuentas sintéticos.
3. Priorizar P0 de archivos/dependencias y preparar una auditoría de solo lectura: catálogo de PK/FK/UNIQUE/CHECK, grupos duplicados normalizados, referencias huérfanas, cédulas antiguas/flags y ausencia de campos obligatorios. Informar cantidades, sin volcar nombres, documentos ni salud.
4. Acordar reparación y constraints solo con ese diagnóstico; una edad actual superior al límite de inscripción o una base heredada antigua no justifican borrar/reescribir historia.
5. Conservar las decisiones institucionales pendientes del contexto maestro. No fusionar ni desplegar este cambio sin aprobación del propietario.
