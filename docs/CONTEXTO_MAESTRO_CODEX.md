# Jaguares — contexto maestro y guía viva para Codex

> **Propósito:** documento persistente para continuar el desarrollo del sistema Club de Voleibol Jaguares. Codex debe leerlo al iniciar tareas de este repositorio y proponer actualizaciones cuando cambien el código, las reglas, las pruebas o el estado de los PR.
>
> **Última actualización documental:** 2026-11-02  
> **Base comprobada:** `main` local/remoto — commit `8d5855f5196b5575b0caed44bd49df38ec14c946`
> **Repositorio:** https://github.com/josentss/jaguares  
> **Estado:** PR #1–#7 fusionados. PR #7 y CI verificados; registro Vercel/GitHub del SHA actual en entorno Production completado. Lecturas y navegación anónima de la web pública verificadas; flujos autenticados y datos históricos reales pendientes de validación. Continuidad documental en rama `docs/verificacion-pr7-web`; esta sesión no fusionó ni desplegó cambios.

## 0. Prompt maestro: cómo debe trabajar Codex

Actúa como **ingeniero de software senior y arquitecto de sistemas**, con experiencia en Node.js, Express, PostgreSQL/Supabase, seguridad web, integridad de datos, interfaces accesibles y pruebas automatizadas.

Tu misión es ayudar a llevar este proyecto, ya avanzado y operativo, a una plataforma deportiva-administrativa robusta, coherente, segura y mantenible. **No lo reconstruyas desde cero. No cambies el stack sin justificación y aprobación.** Inspecciona el código real antes de concluir que existe o falta una funcionalidad.

Prioridades permanentes:

1. Integridad de los datos y lógica de negocio en el **backend**, no solamente en el navegador.
2. Autorización por rol, estado de cuenta y propiedad del recurso en cada operación.
3. Cambios incrementales, compatibles y reversibles cuando corresponda.
4. Pruebas unitarias, SQL, API y Playwright; no declarar comprobado lo que no se ejecutó.
5. Protección de información personal, especialmente documentación y salud de atletas menores de edad.
6. Trabajo en ramas y PR: no editar `main`, fusionar o desplegar sin autorización del propietario.
7. No inventar tarifas, categorías, sanciones, criterios de eliminación ni políticas de comunicación aún no acordadas.
8. Mantener este documento actualizado con decisiones, estado y limitaciones después de cada bloque.

**Primera tarea recomendada:** auditar relaciones, duplicados, cédulas heredadas, inscripciones simultáneas y consistencia de perfiles; implementar solo correcciones que no dependan de reglas comerciales aún pendientes; crear un PR con pruebas, sin fusionarlo.

## 1. Información técnica verificada

### Tecnologías e infraestructura

- Node.js / Express **5** (backend en `index.js`).
- PostgreSQL en **Supabase** usando paquete `pg`; conexión en `config/db.js`.
- Adaptador SQL heredado en `config/db.js` que transforma marcadores `?` en `$1`, `$2`, etc., y ofrece respuestas compatibles con `insertId` / `affectedRows`. **No suponer semántica MySQL real.** Revisar `RETURNING` y transacciones.
- Autenticación con JWT, cookies y bcrypt.
- Cloudinary y Multer para documentos/imágenes.
- HTML/CSS/JavaScript nativo y Font Awesome; no React ni framework SPA.
- Despliegue conocido: **Vercel**, con `vercel.json`; antes de cambios importantes confirmar variables e instancia reales.
- Zona horaria relevante para fechas del club: **America/Caracas**. Fechas de nacimiento tipo `DATE` no deben sufrir desplazamientos por UTC.
- CI: `.github/workflows/verificacion.yml`, Node 22, PostgreSQL 16 temporal y Playwright/Chromium.

### Archivos clave

| Ámbito | Archivos |
| --- | --- |
| Inicio y configuración | `index.js`, `vercel.json`, `package.json`, `config/db.js` |
| Autenticación / seguridad | `controllers/authController.js`, `middlewares/authMiddleware.js`, `middlewares/rateLimitMiddleware.js` |
| Inscripciones | `controllers/atletaController.js`, `routes/atletaRoutes.js` |
| Perfiles | `controllers/userController.js`, `routes/userRoutes.js` |
| Pagos | `controllers/pagosController.js`, `routes/pagosRoutes.js` |
| Directiva | `controllers/directivaController.js`, `routes/directivaRoutes.js` |
| Notificaciones/CMS | `controllers/notificacionesController.js`, `controllers/cmsController.js`, rutas respectivas |
| Validaciones compartidas | `utils/validators.js`, `public/admin/validacion-formularios.js` |
| Interfaz | `public/admin/login.html`, `panel-representante.html`, `panel-directiva.html`, `api-client.js`, `admin-style.css` |
| Sitio público | `public/index.html`, `public/script.js` |
| Pruebas | `tests/seguridad.test.js`, `tests/estados-y-sesiones.test.js`, `tests/formularios.test.js`, `tests/pagos-pg.test.js`, `tests/interfaz.test.js` |

`README_DEPLOY.md` puede estar desactualizado: conserva referencias históricas a DigitalOcean/MySQL. No interpretarlo como configuración efectiva de producción.

### Roles

- `admin`
- `staff`
- `directiva`
- `representante`

Las rutas de directiva admiten los roles administrativos autorizados. Validar el rol actual, no solo el incluido originalmente en un JWT.

## 2. Cambios completados y fusionados

**Estos PR están fusionados en `main` a fecha 2026-11-02.** Codex debe comprobar la situación actual antes de intervenir.

| PR | Estado | Alcance | Pruebas del CI de ese PR |
| --- | --- | --- | --- |
| [#1](https://github.com/josentss/jaguares/pull/1) | Fusionado | Bloquear pagos de atletas inactivos y cuentas no aprobadas; validación estricta de importe, fecha y selector | 15/15 |
| [#2](https://github.com/josentss/jaguares/pull/2) | Fusionado | Revocar sesiones al cambiar cuenta/rol, coherencia de estados, errores y escapado en directiva | 30/30 |
| [#3](https://github.com/josentss/jaguares/pull/3) | Fusionado | Formularios, perfiles, nombres Unicode, teléfonos, cédulas, contraseñas, errores y validación compartida | 42/42 |
| [#4](https://github.com/josentss/jaguares/pull/4) | Fusionado | Cédula 7–9 dígitos, edad 0–18 cumplidos, dirección descriptiva, condiciones médicas razonables | **46/46** |
| [#5](https://github.com/josentss/jaguares/pull/5) | Fusionado | Contexto maestro y AGENTS.md | Solo documentación |
| [#6](https://github.com/josentss/jaguares/pull/6) | Fusionado | Altas atómicas, duplicados normalizados, cédulas heredadas y concurrencia | CI satisfactorio; 53 backend + 10 navegador documentadas en la entrega |
| [#7](https://github.com/josentss/jaguares/pull/7) | Fusionado | Carreras de estados en pagos/activaciones, consistencia de entradas e aislamiento SQL | **74/74**, logs revisados: 64 backend + 10 Playwright, Node 22/PostgreSQL 16 |

Última ejecución remota verificada: [CI del PR #7](https://github.com/josentss/jaguares/actions/runs/41540524642), satisfactoria, sin fallos ni omisiones; logs y pasos revisados sobre `31e71ac`. El árbol de archivos de la fusión `8d5855f` es idéntico al de ese commit. El [CI previo del PR #6](https://github.com/josentss/jaguares/actions/runs/41489653686) también terminó satisfactoriamente. El conector GitHub permitió verificar los PR y CI que antes estaban bloqueados por la red de la primera entrega.

La ejecución anterior [del PR #4](https://github.com/josentss/jaguares/actions/runs/41410222708) comprendía 36 pruebas backend/PostgreSQL y 10 Chromium, además de sintaxis JavaScript. Los CI no equivalen a pruebas con la base Supabase o archivos Cloudinary de producción.

[Despliegue Vercel del PR #7](https://vercel.com/josents-projects/jaguares/9Mjkuedn449MHrPjCPdFadEWirpX): registro GitHub `7505441054`, SHA `8d5855f`, entorno **Production**, estado **success / Deployment has completed**. El endpoint de despliegues no estaba disponible en el conector; se consultó con GitHub CLI en modo lectura. No se inspeccionaron variables de Vercel ni datos privados.

La [URL pública configurada en el repositorio](https://jaguares-eta.vercel.app) respondió a lecturas anónimas de portada/login/recursos/calendario/noticias y denegó tres APIs sin sesión con 401. Playwright sobre la web real comprobó navegación anónima en escritorio/móvil, calendario, menú, login/registro y redirección de paneles; sin errores JS/5xx durante esas interacciones, sin formularios, cargas ni escrituras. La URL individual del despliegue exige autenticación Vercel. Esto no sustituye las pruebas autenticadas de inscripciones, perfiles, permisos entre cuentas, pagos o archivos.

El propietario probó manualmente en Vercel la restricción de pagos, cambios de estado y sesiones para escenarios disponibles y comunicó resultados correctos. No se pudo probar manualmente todo escenario de cuentas pendientes/inactivas por falta de cuentas de prueba; se añadieron pruebas automatizadas.

### Reglas funcionales ya presentes

- Solo cuentas aprobadas/habilitadas acceden a rutas autorizadas; cambio de estado o rol revoca el acceso en nuevas solicitudes.
- Un atleta inactivo no puede generar nuevos reportes de pago ordinarios.
- Activar un atleta requiere representante aprobado.
- Evitar éxitos ficticios en cambios de estado repetidos/inexistentes.
- Nombres y apellidos con letras Unicode, tildes, ñ y separadores habituales.
- Cédula propia operativa: `V-` / `E-` seguida de **7 a 9 dígitos**. **No certifica identidad ante SAIME**, ni prueba que el documento exista; revisar excepciones legales por edad.
- Nacimiento admitido para inscripción: edad **0 a 18 años cumplidos** al registrar, no futura, evaluada en fecha venezolana. **Esto NO define por sí solo elegibilidad de torneo Sub-18:** falta fecha de corte de temporada.
- Direcciones: no aceptar solo cifras o secuencias numéricas arbitrarias; permitir números de casa, calle, barrio y código postal.
- Observaciones médicas opcionales: permitir números clínicos y texto legítimo (por ejemplo «Diabetes tipo 1» o «500 mg»). Las heurísticas **no verifican veracidad médica**.
- Contraseñas nuevas con longitud mínima y máxima; datos con validación de navegador y servidor.
- Cédulas heredadas de atletas: la generación la realiza el servidor; preservar compatibilidad y auditar el algoritmo antes de cambiarlo.

**No reimplementar ni endurecer ciegamente estas reglas**. Revisar casos fronterizos legítimos y datos históricos antes de ajustar. En particular, las restricciones heurísticas de direcciones y notas médicas pueden producir falsos rechazos: mejorarlas solo con casos reales y pruebas.

## 3. Riesgos pendientes de auditar

Las siguientes son **áreas pendientes de verificación o mejora**, no afirmaciones de que todas sean fallas explotables:

### Integridad de datos y modelo

- Duplicados de usuarios/representantes/atletas y de cédulas.
- Identificación de hermanos con cédulas heredadas, secuencias y colisiones.
- Restricciones `UNIQUE` y claves foráneas reales en PostgreSQL; datos anteriores incompatibles.
- Registro simultáneo y condiciones de carrera; operaciones multitabla con transacciones y rollback.
- Permisos en todos los endpoints para consultar/editar datos de otros representantes.
- Documentos adjuntos vinculados al atleta correcto, su acceso y vigencia.
- Errores y estados de cuentas, pagos y atletas al eliminar, suspender o transferir.
- Consistencia frontend/backend para todos los formularios y exportaciones.
- Registro de cambios, auditoría e historial que no se pierda al cambiar equipo o categoría.

**No crear índices únicos, constraints ni ejecutar migraciones en producción antes de auditar datos históricos, impacto y estrategia de aplicación.**

### Seguridad y mantenimiento

- En la última ejecución de `npm ci` observada: **12 alertas de dependencias (1 crítica, 7 altas, 2 moderadas, 2 bajas)**. Investigar con `npm audit` actual; no aplicar `npm audit fix --force` indiscriminadamente.
- Limitador de login y registro conocido en `middlewares/rateLimitMiddleware.js` usa contadores **en memoria por instancia**; evaluar solución persistente para Vercel.
- CSRF, CORS, cookies y configuración `TRUST_PROXY`; proteger sesiones y acciones que cambian datos.
- Tipos reales/`magic bytes` y permisos al subir archivos, límites y acceso a documentos/comprobantes.
- XSS restante en plantillas con `innerHTML`, `onclick` y contenido de usuarios.
- Archivos o logs privados potencialmente versionados: revisar historial, exposición y medidas de remediación **sin exponer datos sensibles en informes**.
- Secretos, configuración y observabilidad; no introducir tokens ni PII en el repositorio.
- Protección y acceso mínimo de datos médicos de menores.
- Estado de lectura persistente y ciclo de vida de notificaciones.
- Flujo de cambio obligatorio de claves temporales / recuperación de cuenta.
- Migraciones idempotentes: revisar si existen y cuál es el esquema vigente; la arquitectura deseada contemplaba `utils/migraciones.js` y espejo SQL, pero **no estaban en el `main` examinado**.
- Documentación de despliegue desactualizada y accesibilidad/responsive.

### Auditoría P1 y primera implementación (2026-11-02)

Informe detallado: **[AUDITORIA_INTEGRIDAD.md](AUDITORIA_INTEGRIDAD.md)**, con relaciones, hallazgos confirmados, límites y comprobaciones para un futuro despliegue autorizado.

Entrega original: [rama de integridad](https://github.com/josentss/jaguares/tree/integridad/altas-atomicas-identidades), implementación `4cd951c`. La primera creación de PR mediante `gh pr create` devolvió Forbidden para `api.github.com/graphql`. **Estado actualizado:** [PR #6](https://github.com/josentss/jaguares/pull/6) fusionado en `46ce6bf`, CI remoto satisfactorio. El bloqueo y la ausencia de PR descritos anteriormente corresponden a la entrega inicial, no al estado actual.

En la rama `integridad/altas-atomicas-identidades` se implementaron altas atómicas de representante/atleta, comprobaciones normalizadas de duplicados coordinadas con los cambios de perfil, secuencias heredadas protegidas frente a concurrencia y validación de datos incompletos de representante. Se conserva la arquitectura y la interfaz, sin migraciones ni alteración de datos de producción.

Los escritores de identidad comparten un advisory lock transaccional PostgreSQL, con espera máxima de 5 segundos (503 recuperable). Se evita repetir un atleta de la misma familia con los mismos nombres, apellidos y nacimiento. No se renumeran cédulas históricas. Las notificaciones se emiten después del commit. El bloqueo es cooperativo y global: requiere revisar rendimiento y complementarlo con constraints después de auditar los datos reales.

**Validación local:** comprobación sintáctica; 53/53 pruebas backend (17 nuevas en PostgreSQL temporal/API) y 10/10 Playwright escritorio/móvil. Chromium del sistema 154 con Playwright 1.56.1, distinto del Chromium 141 del CI. Sin pruebas de producción ni acceso a archivos reales. CI actualizado para ejecutar la nueva suite; estado remoto pendiente de consulta.

**Pendientes confirmados:** `validarMagicBytes` aún devuelve true; no hay atomicidad entre carga Cloudinary y commit SQL ni limpieza garantizada de archivos huérfanos. La autorización del endpoint no garantiza privacidad del enlace externo. Registro público no captura cédula; no se identifica a una misma persona con diferentes correos por su nombre. Constraints reales, duplicados históricos y escrituras externas siguen pendientes de auditoría autorizada.

### Seguimiento P1 sobre PR #6 (2026-11-02)

Diagnóstico priorizado, mapa de entidades, causas/reproducciones, límites históricos y pasos de revisión: **[AUDITORIA_INTEGRIDAD_SEGUIMIENTO.md](AUDITORIA_INTEGRIDAD_SEGUIMIENTO.md)**.

Entrega de `integridad/auditoria-relaciones-permisos`, **fusionada mediante PR #7** en `8d5855f`. Se corrigieron carreras adicionales de pagos/activaciones frente a estados o roles concurrentes mediante bloqueos SQL de filas. Se comprobó el fallo anterior con dos conexiones: la operación devolvía 200 sin esperar la revocación; las pruebas nuevas observan la espera real y verifican 409 sin escritura tras commit, o éxito tras rollback. Las carreras de revocación del representante se ejercitaron con SQL sintético, no con un supuesto endpoint público de cambio de rol.

Las inscripciones ahora validan y guardan la misma observación médica, conservando ambos nombres de campo compatibles y rechazando valores contradictorios. Se rechazan fechas con tipo incorrecto, teléfonos falsy incorrectos e indicadores desconocidos. Perfil/lista de atletas/historial/notificaciones rechazan IDs malformados antes de SQL. Los permisos existentes se conservan.

Ambas suites PostgreSQL exigen destino explícito local `jaguares_test`, sin parámetros de conexión que puedan sustituir host/base/options, y usan esquemas aleatorios separados. Se espera la notificación posterior a la última activación de prueba antes de eliminar su esquema. No hay migraciones ni cambios de datos históricos/productivos, arquitectura, interfaz, versiones del proyecto ni reglas institucionales.

**Pruebas finales ejecutadas:** 64/64 backend en Node 24.15.0 y 64/64 en Node 22.23.4 (las mismas pruebas repetidas para compatibilidad; 11 nuevas respecto a main), con PostgreSQL 18 temporal local. Sintaxis de 37 archivos JavaScript correcta en ambas versiones y `git diff --check` correcto. Playwright 1.56.1 con Chromium 141.0.7390.37: 10/10 aprobadas en escritorio/móvil sobre Node 24, APIs simuladas. Total de escenarios: 74. CI conserva PostgreSQL 16/Node 22; no se ejecutó PostgreSQL 16 localmente. `npm ci` restauró las dependencias del lockfile y Playwright se instaló como herramienta local aislada, sin editar manifiestos.

**Validación remota posterior a la fusión:** CI del PR #7 aprobado con Node 22.23.4/PostgreSQL 16, 64 backend + 10 Playwright. Despliegue Production del SHA de main completado según registro GitHub/Vercel; consultas y navegación anónimas de la URL pública comprobadas. El estado «PR/CI pendiente» de la entrega inicial queda reemplazado por esta verificación.

**Riesgo residual:** restricciones/duplicados reales sin consultar; almacenamiento/privacidad de archivos pendiente P0; bloqueos cooperativos y espera de modificaciones largas; idempotencia y notificaciones de mejor esfuerzo. `npm audit --package-lock-only --json` confirmó 12 alertas (1 crítica, 7 altas, 2 moderadas, 2 bajas); no se aplicaron actualizaciones automáticas. Pruebas autenticadas con recursos de desarrollo y comprobación manual por el propietario siguen pendientes.

### Guía de pruebas web posterior al PR #7

**[PRUEBAS_MANUALES_WEB.md](PRUEBAS_MANUALES_WEB.md)** contiene 75 casos con pasos y resultados esperados: sitio público, cuentas/sesiones, perfil, inscripción, representantes/hermanos, directiva/estados, documentos/PDF, pagos/historial, permisos entre familias, notificaciones, calendario y móvil. Incluye casos técnicos opcionales y funcionalidades todavía ausentes para no confundirlas con regresiones.

Las casillas representan pruebas pendientes del propietario; no equivalen a pruebas ejecutadas. Las operaciones que guardan/cambian datos se reservan para un entorno con BD y archivos de pruebas. No se crean registros ficticios ni se fuerzan fallos contra producción para completar el listado.


## 4. Backlog funcional completo — por decidir e implementar

Las siguientes necesidades fueron expresadas por el propietario. No omitirlas al planificar, ni inventar sus reglas oficiales.

| Área | Requisitos pendientes |
| --- | --- |
| Historial y eliminación | Auditoría de creación/cambio/borrado; desactivación, archivado, botón de eliminación definitiva autorizado; dependencias, retención y anonimización cuando corresponda |
| Finanzas | Tarifas **fijas** (sin montos individuales arbitrarios), vigencia histórica, moneda, método de pago por tipo de cargo, cobros duplicados, deudas, comprobantes y sanciones monetarias |
| Categorías | Catálogo oficial, edad y fecha de corte de temporada, actividad/rendimiento, promoción/traspaso, elegibilidad, temporadas y asignaciones sin duplicados |
| Plantillas | Generador de plantilla completa por categoría/equipo/temporada, actualización y edición, PDF y CSV, permisos y datos minimizados |
| Trayectoria deportiva | Historial longitudinal del atleta: equipos, traspasos, torneos, títulos, lesiones, amonestaciones, sanciones y responsables |
| Condición deportiva | Separar `Apto`, `Lesionado` y `Sancionado` de `Inscripción activa/inactiva/en espera` y del estado de la cuenta |
| Calendario y eventos | Reuniones públicas/privadas, eventos y convocatorias a participantes específicos |
| Notificaciones | Estado de lectura persistente, destinatarios y trazabilidad |
| WhatsApp (posterior) | Convocatorias y recordatorios; felicitaciones de cumpleaños opcionales; consentimiento y requisitos de WhatsApp Business; no envíos masivos sin autorización |
| Accesibilidad y UX | Modales accesibles de confirmación, mensajes de error uniformes, responsividad, exportaciones seguras y formularios consistentes |

### Reglas aún NO acordadas

Codex debe solicitar al propietario, **cuando corresponda a la fase**, los siguientes datos oficiales:

1. Categorías, rango y fecha de corte por temporada; traspasos y excepciones autorizadas.
2. Tarifas, moneda, vigencia, métodos y política de deuda o excepciones.
3. Eliminación definitiva: quién autoriza, qué se conserva y por cuánto tiempo.
4. Tarjetas/amonestaciones: tipos, consecuencias, importes, suspensión y revisión.
5. Comunicaciones: destinatarios, consentimiento, horarios y modelos de mensajes.

No bloquear fases técnicas independientes por la ausencia de estas decisiones.

## 5. Hoja de ruta recomendada

| Prioridad | Bloque | Criterio de finalización |
| --- | --- | --- |
| P0 | Seguridad crítica y protección de datos | Hallazgos confirmados corregidos, secretos/archivos seguros, dependencias evaluadas, autorización revisada y pruebas |
| P1 — PR #6/#7 fusionados; esquema real pendiente | Integridad de identidades, cédulas, atletas y perfiles | CI confirmado; completar pruebas manuales autenticadas y auditar duplicados/constraints históricos con acceso de lectura |
| P2 | Migraciones, auditoría y ciclo de vida | Esquema reproducible, eventos trazables, archivado y política de borrado definida |
| P3 | Modelo de temporadas y categorías | Reglas oficiales acordadas, elegibilidad comprobada y traspasos históricos |
| P4 | Finanzas centralizadas | Tarifas y reglas oficiales acordadas, servidor calcula, trazabilidad y conciliación |
| P5 | Plantillas e historial deportivo | Fichas editables, datos longitudinales y exportaciones confiables |
| P6 | Calendario, notificaciones y WhatsApp | Roles, consentimiento, seguimiento y comportamiento verificable |

P0 y P1 pueden coexistir en PR separados; priorizar riesgos graves confirmados.

## 6. Primera tarea para Codex: auditoría de integridad y siguientes correcciones

**No inicies con un rediseño visual ni con la implementación de todas las funciones pendientes.**

1. **Inspeccionar:** leer rutas, middlewares, controladores, adaptador PostgreSQL y validadores; comprobar esquema real solo con accesos de lectura autorizados y sin imprimir PII.
2. **Mapear entidades:** usuarios/representantes, atletas, pagos, documentos y notificaciones. Identificar PK, FK, unicidad, estados y responsables.
3. **Probar casos:** atleta inscrito dos veces, misma cédula en usuarios distintos, varios hermanos con cédula heredada, inscripción nueva de directiva con representante creado en la misma operación, alta concurrente, error a mitad de proceso y edición de datos ajenos.
4. **Diagnosticar:** matriz por hallazgo que distinga confirmado/hipótesis; ubicación exacta, impacto, reproducción, causa, solución, migración necesaria y prueba de regresión.
5. **Implementar de forma acotada:** escoger correcciones independientes de políticas deportivas/financieras aún no definidas. Trabajar en una **nueva rama**, sin tocar `main`.
6. **Validar:** `node --check`, pruebas Node, PostgreSQL temporal, escenarios de concurrencia cuando se pueda, Playwright desktop/móvil y comprobaciones sobre datos no productivos. No inventar resultados ni simular pruebas que no se ejecutaron.
7. **Entregar:** PR sin fusionar; resumen de cambios, riesgos, pruebas aprobadas/fallidas, limitaciones, efecto en datos históricos, migraciones propuestas y checklist manual para Vercel.

**Nunca ejecutar escrituras destructivas ni migraciones irreversibles en Supabase de producción sin autorización expresa.** Si una regla institucional es necesaria, presentar la pregunta precisa y continuar con tareas independientes.

## 7. Contrato de trabajo y definición de terminado

- Leer primero el código y este documento; no asumir que el estado histórico sigue siendo el vigente.
- Formular cambios pequeños que no rompan rutas, contratos API, diseños ni integraciones.
- Preferir consultas parametrizadas, permisos por entidad, errores HTTP claros, transacciones cuando corresponda e idempotencia.
- Conservar interfaz en español, diseño naranja del club, responsive y accesibilidad.
- No usar validación de texto como sustituto de escape al renderizar, autorización o consultas parametrizadas.
- Tratar datos personales, cédulas, imágenes y salud como información sensible; registros de prueba deben ser sintéticos.
- No afirmar «seguro», «completo», «sin errores» o «probado en producción» sin evidencia suficiente.
- Cada cambio funcional requiere prueba positiva, negativa y de regresión; si se cambia UI, probar escritorio y móvil.
- Ningún PR se considera terminado sin revisión del resultado del CI y documentación de lo que quedó pendiente.
- Nunca fusionar, desplegar ni alterar `main` por decisión unilateral de Codex.

## 8. Cómo mantener este documento actualizado

**Este archivo es la memoria operativa viva del proyecto**, no un informe inmutable. Codex debe proponer su edición en cada PR que cambie reglas, arquitectura, capacidades o prioridades, y después de que se confirme una fusión:

- Actualizar la fecha y commit de `main` únicamente cuando se verifiquen.
- Mover tareas de «Pendiente» a «Completado» solo con evidencia (PR/commit/pruebas).
- Anotar cambios en reglas de negocio únicamente con la decisión expresa del propietario.
- Registrar nuevas hipótesis separadas de problemas confirmados.
- Registrar pruebas, limitaciones, riesgos residuales y efecto en datos existentes.
- No eliminar decisiones antiguas importantes: marcarlas como reemplazadas y conservar motivo/fecha.
- Mantener referencias y enlaces de PRs y ejecuciones CI.
- Evitar documentar contraseñas, tokens, registros de salud o cédulas personales auténticas.
- Mantener la guía legible: si una sección crece demasiado, mover detalles técnicos a documentos vinculados y conservar aquí un índice actualizado.

### Registro de decisiones

| Fecha | Decisión | Motivo / referencia | Estado |
| --- | --- | --- | --- |
| 2026-11-02 | Bloquear pagos ordinarios de atletas inactivos y representantes no aprobados | PR #1 | Implementado |
| 2026-11-02 | Revalidar estado y rol por solicitud autenticada | PR #2 | Implementado |
| 2026-11-02 | Validación compartida frontend/backend de formularios | PR #3 | Implementado |
| 2026-11-02 | Cédula V-/E- con 7–9 dígitos para captura operativa | PR #4 | Implementado; revisar excepciones legítimas |
| 2026-11-02 | Inscripción: 0–18 años cumplidos a fecha de registro | PR #4 | Implementado; fecha de corte competitiva pendiente |
| 2026-11-02 | Altas compuestas atómicas, identidades coordinadas y sufijos heredados preservados | PR #6 | Fusionado; constraints reales pendientes |
| 2026-11-02 | Revalidar estados concurrentes de pagos/activaciones y unificar valores médicos validados/persistidos | PR #7 | Fusionado; despliegue Production completado según registro, prueba manual autenticada pendiente |
| 2026-11-02 | Montos fijos, categorías y sanciones | Pendiente de política oficial del club | No definido |
| 2026-11-02 | Eliminación definitiva y WhatsApp | Pendiente de políticas y consentimiento | No definido |

### Bitácora de entregas (actualizar tras cada PR)

| Fecha | PR / commit | Resultado y pruebas | Pendientes |
| --- | --- | --- | --- |
| 2026-11-02 | #1 a #4; `main` `29174dd3` | Correcciones de estados/pagos/formularios/coherencia; último CI 46/46 | Integridad de registros, seguridad restante y backlog |
| 2026-11-02 | PR #6, main `46ce6bf` | P1: transacciones, duplicados y concurrencia; 53 backend + 10 interfaz locales; CI remoto satisfactorio | Estado inicial «PR pendiente/API bloqueada» reemplazado por verificación actual; constraints/Cloudinary pendientes |
| 2026-11-02 | PR #7, main `8d5855f` | Seguimiento: 64/64 backend local en Node 22/24; CI Node 22/PostgreSQL 16 con 64 backend + 10 Playwright. Production completado; navegación anónima web real escritorio/móvil satisfactoria | Pruebas autenticadas manuales, archivos/privacidad y constraints reales pendientes; no equivale a validación integral de producción |
| 2026-11-02 | Rama documental `docs/verificacion-pr7-web` | Evidencia de fusión/CI/Production y guía de 75 casos manuales, sin cambios de código | Documentación local para revisión; resultados manuales del propietario por registrar |

### Plantilla breve de actualización futura

**Fecha:** AAAA-MM-DD  
**Rama / PR:** ...  
**Objetivo:** ...  
**Cambios:** ...  
**Base de datos / migraciones:** ...  
**Pruebas ejecutadas:** ...  
**Problemas detectados / riesgo residual:** ...  
**Reglas pendientes de confirmación:** ...  
**Impacto en el siguiente bloque:** ...  
**Estado:** propuesto / en pruebas / aprobado / fusionado / desplegado.

---

**Instrucción final a Codex:** al comenzar, compara esta guía con `main`, presenta diferencias verificables y desarrolla el siguiente bloque P1 en una rama con pruebas. Al finalizar, actualiza la guía y prepara un PR sin fusionar, dejando todo listo para revisión del propietario.
