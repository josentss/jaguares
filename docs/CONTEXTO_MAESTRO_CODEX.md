# Jaguares — contexto maestro y guía viva para Codex

> **Propósito:** documento persistente para continuar el desarrollo del sistema Club de Voleibol Jaguares. Codex debe leerlo al iniciar tareas de este repositorio y proponer actualizaciones cuando cambien el código, las reglas, las pruebas o el estado de los PR.
>
> **Última actualización documental:** 2026-11-04
> **Base comprobada:** `main` remoto `39960c1b9e5ade540eeb9799bd660b0ecb8b07a5`; árbol `c01b337f198a3cf0af05879360c8631fc4b4eac3`, idéntico al head probado del PR #11. Despliegue Vercel Production `7555067963` en estado `success / Deployment has completed`. La referencia `main` local se conserva sin cambios.
> **Repositorio:** https://github.com/josentss/jaguares  
> **Estado:** PR #1–#11 fusionados. El propietario confirmó después del despliegue del PR #10 que las planillas que fallaban y una nueva se generan correctamente. El [PR #11](https://github.com/josentss/jaguares/pull/11) tiene [CI final satisfactorio](https://github.com/josentss/jaguares/actions/runs/41873432620) y despliegue Production completado; quedan pendientes las pruebas autenticadas del propietario. No fusionar ni desplegar sin autorización.

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

**Bloque actual tras PR #11:** esperar las pruebas autenticadas del propietario sobre las sesiones. Después corresponde la validación civil de fechas del calendario; la hora de eventos requiere otro bloque. La auditoría inicial de integridad se entregó en PR #6/#7; sus riesgos de esquema/archivos siguen abiertos.

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

**Estos PR están fusionados en `main` a fecha 2026-11-04.** Codex debe comprobar la situación actual antes de intervenir.

| PR | Estado | Alcance | Pruebas del CI de ese PR |
| --- | --- | --- | --- |
| [#1](https://github.com/josentss/jaguares/pull/1) | Fusionado | Bloquear pagos de atletas inactivos y cuentas no aprobadas; validación estricta de importe, fecha y selector | 15/15 |
| [#2](https://github.com/josentss/jaguares/pull/2) | Fusionado | Revocar sesiones al cambiar cuenta/rol, coherencia de estados, errores y escapado en directiva | 30/30 |
| [#3](https://github.com/josentss/jaguares/pull/3) | Fusionado | Formularios, perfiles, nombres Unicode, teléfonos, cédulas, contraseñas, errores y validación compartida | 42/42 |
| [#4](https://github.com/josentss/jaguares/pull/4) | Fusionado | Cédula 7–9 dígitos, edad 0–18 cumplidos, dirección descriptiva, condiciones médicas razonables | **46/46** |
| [#5](https://github.com/josentss/jaguares/pull/5) | Fusionado | Contexto maestro y AGENTS.md | Solo documentación |
| [#6](https://github.com/josentss/jaguares/pull/6) | Fusionado | Altas atómicas, duplicados normalizados, cédulas heredadas y concurrencia | CI satisfactorio; 53 backend + 10 navegador documentadas en la entrega |
| [#7](https://github.com/josentss/jaguares/pull/7) | Fusionado | Carreras de estados en pagos/activaciones, consistencia de entradas e aislamiento SQL | **74/74**, logs revisados: 64 backend + 10 Playwright, Node 22/PostgreSQL 16 |
| [#8](https://github.com/josentss/jaguares/pull/8) | Fusionado | Recuperar envíos de inscripción, errores visibles, respaldo del validador y flujos completos | **89/89**: 64 backend + 25 navegador, Node 22/PostgreSQL 16 |
| [#9](https://github.com/josentss/jaguares/pull/9) | Fusionado | Fechas civiles, duplicados familiares y nuevas altas de 5–18 años | **105/105**, Node 22/PostgreSQL 16; aceptación manual del propietario |
| [#10](https://github.com/josentss/jaguares/pull/10) | Fusionado | Exportación e impresión de planillas A4, recursos fallidos y paginación | [CI final satisfactorio](https://github.com/josentss/jaguares/actions/runs/41582920053), Node 22/PostgreSQL 16/Chromium; generación validada por el propietario |
| [#11](https://github.com/josentss/jaguares/pull/11) | Fusionado | Entrada, revalidación y cierre de sesión en ambos paneles; cabeceras de privacidad | [CI final satisfactorio](https://github.com/josentss/jaguares/actions/runs/41873432620), 79 backend + 63 navegador, sin omisiones; pruebas autenticadas manuales pendientes |

**Verificación posterior al PR #11:** fusión `39960c1`, con árbol idéntico a `5d41f6f`; deployment GitHub `7555067963` a Production con estado success. Las respuestas GET anónimas de portada, paneles y cliente API fueron 200; `/api/auth/me` respondió 401. Ambos paneles y esa API entregaron `Cache-Control: no-store`. Cinco recursos del panel coincidieron con Git. Chromium anónimo de escritorio y móvil verificó en ambos paneles que el contenido permanecía oculto durante una comprobación de sesión demorada y después redirigía al login, sin errores JavaScript observados. No se usaron cuentas ni se ejecutaron formularios o escrituras en producción.

**Verificación posterior al PR #10:** fusión `3ff6923`, árbol idéntico a `733eabb`; CI de ese head satisfactorio. Deployment GitHub `7511100715`, SHA de la fusión, entorno Production, completado según registro. El propietario confirma la generación de las planillas antes defectuosas y una nueva. No se marcaron como realizadas todas las variantes de la matriz manual ni se ejecutaron formularios contra producción durante esta revisión.

**Verificación posterior al PR #8:** [CI 41548450422](https://github.com/josentss/jaguares/actions/runs/41548450422) satisfactorio sobre `512eccb`; fusión `d6d8c38` con árbol idéntico. Registro de despliegue GitHub `7506497104`, entorno Production, estado success / Deployment has completed; [Vercel](https://vercel.com/josents-projects/jaguares/BLobrZ5NXcHMVrRTJsoJPi5k1ejM). En la URL pública, ambos paneles, login, validador, cliente API, script de acceso y CSS devolvieron 200 y contenido idéntico al PR #8. Solo se hicieron GET; no se ejecutaron formularios autenticados en producción.

Ejecución remota anterior: [CI del PR #7](https://github.com/josentss/jaguares/actions/runs/41540524642), satisfactoria, sin fallos ni omisiones; logs y pasos revisados sobre `31e71ac`. El árbol de archivos de la fusión `8d5855f` es idéntico al de ese commit. El [CI previo del PR #6](https://github.com/josentss/jaguares/actions/runs/41489653686) también terminó satisfactoriamente. El conector GitHub permitió verificar los PR y CI que antes estaban bloqueados por la red de la primera entrega.

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
- Nacimiento: PR #4/#8 admitían **0–18 años**. El propietario precisó mínimo cinco y máximo dieciocho; PR #9 aplica **5–18 años cumplidos** en Caracas a nuevas altas, sin cambiar datos históricos ni definir la elegibilidad competitiva Sub-18 (la fecha de corte por temporada sigue pendiente). PR #9 está fusionado y el propietario confirma el resultado manual.
- Direcciones: no aceptar solo cifras o secuencias numéricas arbitrarias; permitir números de casa, calle, barrio y código postal.
- Observaciones médicas opcionales: permitir números clínicos y texto legítimo (por ejemplo «Diabetes tipo 1» o «500 mg»). Las heurísticas **no verifican veracidad médica**.
- Contraseñas nuevas con longitud mínima y máxima; datos con validación de navegador y servidor.
- Cédulas heredadas de atletas: la generación la realiza el servidor; preservar compatibilidad y auditar el algoritmo antes de cambiarlo.

**No reimplementar ni endurecer ciegamente estas reglas**. Revisar casos fronterizos legítimos y datos históricos antes de ajustar. En particular, las restricciones heurísticas de direcciones y notas médicas pueden producir falsos rechazos: mejorarlas solo con casos reales y pruebas.

## 3. Riesgos pendientes de auditar

Las siguientes son **áreas pendientes de verificación o mejora**, no afirmaciones de que todas sean fallas explotables:

### Integridad de datos y modelo

Los PR #6/#7/#9 ya protegen altas, duplicados normalizados, cédulas heredadas y varias carreras de estados. La lista siguiente conserva líneas de auditoría sobre históricos, restricciones reales y caminos aún no cubiertos; no implica que esas correcciones deban repetirse.

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

**Validación local de aquella entrega:** comprobación sintáctica; 53/53 pruebas backend (17 nuevas en PostgreSQL temporal/API) y 10/10 Playwright escritorio/móvil. Chromium del sistema 154 con Playwright 1.56.1, distinto del Chromium 141 del CI. Sin pruebas de producción ni acceso a archivos reales. El estado remoto inicialmente pendiente se verificó después: PR #6 fusionado y CI satisfactorio.

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

### Bloqueador funcional de inscripción — corrección prioritaria

Reporte del propietario: botón sin respuesta en ambos paneles, tanto con cédula propia como heredada; pagos de atletas aprobados sí funcionan. La navegación anónima y las pruebas de campos aislados anteriores **no acreditaban una inscripción completa**. Se amplió la cobertura para comprobar clic → HTTP → sesión/roles → Multer → transacción SQL → persistencia/recarga.

Diagnóstico, revisión por módulos, evidencia y límites: **[REVISION_FUNCIONAL_INSCRIPCIONES.md](REVISION_FUNCIONAL_INSCRIPCIONES.md)**. Se reprodujo un bloqueo por errores personalizados retenidos en controles ocultos y por valores corregidos sin evento de entrada. También se reprodujo, bloqueando el recurso de validación en la prueba, un `ReferenceError` anterior al manejo de errores que deja ambos botones sin POST. La consulta pública encontró los archivos presentes e iguales al main previo: no se afirma que faltasen en el navegador concreto del propietario.

Cambios locales: recalcular validación antes del envío nativo; deshabilitar campos que no aplican; limpiar errores al resetear; mostrar error visible; respaldo de validación HTML si no carga el validador, manteniendo la validación backend obligatoria; versionar recursos cambiados. Se sincronizaron las restricciones ya existentes de pagos con el formulario, sin definir tarifas nuevas. Body ausente/incorrecto y JSON inválido reciben 400, exceso del límite existente 413; no provocan falsos errores internos.

**Pruebas locales ejecutadas:** 64 backend + 25 navegador (14 con APIs simuladas y 11 con aplicación/PostgreSQL reales) en Node 24.15.0 y Node 22.23.4, todas aprobadas; 38 archivos JS con sintaxis correcta en ambas versiones. PostgreSQL 18 desechable, Chromium 141/Playwright 1.56.1, escritorio/móvil. Cloudinary y tasa externa simulados únicamente en su frontera; no se hicieron escrituras productivas. CI mantiene PostgreSQL 16/Node 22 e incorpora la nueva suite de flujos completos, con Playwright aislado para no actualizar las dependencias del lockfile.

Recorridos comprobados: aprobación de cuenta pendiente, onboarding, inscripciones sucesivas propias/heredadas desde ambos paneles, nuevo representante, rollback SQL y reintento, carga/error/reintento de documentos, activación, efectivo, transferencia, auditoría e historial, rechazo de pago tras inactivación, permisos entre familias, notificaciones y creación/cancelación de evento. No equivale a probar datos históricos/constraints reales de Supabase, Cloudinary real ni todos los estados del proyecto.

Entrega publicada en [PR #8](https://github.com/josentss/jaguares/pull/8), implementación `4dfbb8d`, fusionada en `d6d8c38`; CI 89/89 y Production completado, verificados posteriormente. La aceptación posterior del propietario confirma inscripciones y el recorrido activar → pagar; los nuevos hallazgos se tratan en el bloque siguiente, manteniendo los módulos nuevos separados.

### Resultados del propietario y primer bloque de fechas/identidades

**Confirmación recibida:** inscripción en ambos paneles, validaciones, herencia entre hermanos y cambios de cédula, aprobación de cuentas/atletas, efectivo/transferencia/comprobantes, auditoría de pagos, rechazo tras inactivación, sesiones y móvil funcionan en los escenarios comunicados. La separación entre representantes observada no sustituye una auditoría completa de autorización. Queda superado el bloqueo de inscripción del PR #8.

Diagnóstico priorizado, evidencia, límites y aceptación: **[SEGUIMIENTO_PRUEBAS_WEB.md](SEGUIMIENTO_PRUEBAS_WEB.md)**. Se confirma el desplazamiento DATE → Date → JSON → formato local; no hay resta intencional para evitar duplicados. La repetición exacta ya se rechazaba, pero se reprodujeron escapes por Unicode equivalente y por repartir el mismo nombre completo entre campos. Las capturas no acreditan por sí solas que se enviara la misma fecha.

**Alcance de `fix/fechas-duplicados-atletas`:** parser DATE aislado al pool, formato civil sin UTC/local en nacimientos/pagos/planillas/fechas de eventos; timestamps de tasa/notificaciones conservados como instantes. Comparación de nombre completo NFC/espacios/mayúsculas por familia y nacimiento dentro del bloqueo/transacción existentes. Nuevas altas de 5–18 años, con límites de cumpleaños/bisiestos en ambos formularios y backend; sin categorías automáticas ni año fijo. Se conserva respaldo si falta el helper de fechas, para no reintroducir botones sin envío.

**Pruebas locales ejecutadas:** 74/74 backend + 31/31 navegador tanto en Node 24.15.0 como en Node 22.23.4: **105 escenarios diferentes**, repetidos para compatibilidad, sin fallos ni omisiones. Sintaxis de 40 archivos JS y scripts inline de ambos paneles/login correcta en ambas versiones; `git diff --check` correcto. PostgreSQL 18 local temporal, Chromium 141/Playwright 1.56.1. **CI remoto verificado:** [41563276506](https://github.com/josentss/jaguares/actions/runs/41563276506) sobre implementación `5772beb`, satisfactorio, logs revisados: Node 22.23.4, PostgreSQL 16, sintaxis e instalación correctas, 74 backend + 31 navegador, sin fallos ni omisiones. Antes de corregir backend fallaron las regresiones nuevas de edad, DATE y ambos escapes de duplicados, y pasó el rechazo exacto. Se probaron cumpleaños/bisiestos, concurrencia, cuatro husos del proceso, navegador Caracas/UTC/Tokio, falta del helper y flujos con aplicación/SQL reales desde inscripción hasta pagos y planilla. Cloudinary/tasa externa simulados solo en sus fronteras. Sin proveedores productivos ni escrituras de producción. PostgreSQL temporal detenido.

**Siguientes bloques separados:** ocultar el panel hasta validar sesión (HTML estático visible antes del fetch, sin fuga de datos demostrada); eventos con validación estricta/día Caracas y `min`, después hora con migración aditiva revisada. El validador actual de eventos rechaza hoy y acepta fechas imposibles normalizadas: reproducido con reloj fijo/controlador real y SQL simulado. Cancelados/completados permanecen en administración para conservar historia. Finanzas requiere política oficial; se guarda la propuesta posterior de mensualidad fija convertida según moneda y mostrar al representante solo cargos adeudados, sin implementarla en este bloque.

**Históricos y límites:** no se corrigen fechas ni duplicados existentes, ni se desactivan atletas fuera del nuevo rango. Parser aplicable a columnas DATE, no a TIMESTAMP/DATE[]/binario; esquema real pendiente de auditoría autorizada. Bloqueos cooperativos/constraints, privacidad de archivos, dependencias y consistencia Cloudinary/SQL siguen pendientes. No hay migraciones, dependencias o versiones del proyecto nuevas.


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
| Calendario y eventos | Reuniones públicas/privadas, eventos y convocatorias; límites de fecha Caracas y hora explícita con compatibilidad histórica |
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
| P0 — recuperación confirmada por el propietario | Recuperar la inscripción y comprobar los recorridos principales | PR #8 fusionado/desplegado, CI 89/89; propietario confirma inscripciones y recorridos habituales. Nuevos hallazgos registrados por separado |
| P1 — completado | Fechas civiles, duplicados familiares y altas de 5–18 años | PR #9 fusionado en `52cd290`; CI 105/105 y Production completado. El propietario confirma el resultado manual. |
| P1 — completado | PDF e impresión de planillas | PR #10 fusionado en `3ff6923`, CI final y Production satisfactorios; propietario confirma generación de planillas anteriores y nueva. |
| P1 — fusionado; verificación manual pendiente | Sesiones de ambos paneles | PR #11 fusionado y desplegado; CI y navegación anónima satisfactorios. El propietario debe comprobar los flujos autenticados en producción. |
| P1 — después de sesiones | Fechas de eventos y, en otro bloque, hora explícita | Validación civil estricta en Caracas y límites del formulario; después contrato de hora y migración aditiva revisados, preservando históricos. |
| P0 | Seguridad crítica y protección de datos | Hallazgos confirmados corregidos, secretos/archivos seguros, dependencias evaluadas, autorización revisada y pruebas |
| P1 — PR #6/#7 fusionados; esquema real pendiente | Integridad de identidades, cédulas, atletas y perfiles | CI confirmado; completar pruebas manuales autenticadas y auditar duplicados/constraints históricos con acceso de lectura |
| P2 | Migraciones, auditoría y ciclo de vida | Esquema reproducible, eventos trazables, archivado y política de borrado definida |
| P3 | Modelo de temporadas y categorías | Reglas oficiales acordadas, elegibilidad comprobada y traspasos históricos |
| P4 | Finanzas centralizadas | Tarifas y reglas oficiales acordadas, servidor calcula, trazabilidad y conciliación |
| P5 | Plantillas e historial deportivo | Fichas editables, datos longitudinales y exportaciones confiables |
| P6 | Calendario, notificaciones y WhatsApp | Roles, consentimiento, seguimiento y comportamiento verificable |

P0 y P1 pueden coexistir en PR separados; priorizar riesgos graves confirmados.

## 6. Próximo bloque y método para las siguientes correcciones

**Sesiones — PR #11 fusionado y desplegado; pruebas autenticadas pendientes:**

- Ambos paneles ocultan su contenido mientras comprueban sesión y rol, incluso si falta la hoja de estilos; un error temporal o la falta del cliente de sesión ofrece reintentar. El backend conserva la autoridad sobre el acceso.
- Se oculta y revalida al volver a la pestaña y al restaurar desde caché; un 401 de una API protegida y el cierre comunicado por otra pestaña llevan al login. La caché HTTP se desactiva en los HTML de panel y las respuestas API servidas por Express.
- El cierre verifica la respuesta del servidor, evita solicitudes simultáneas y permite reintentar si falla; solo tras confirmación elimina la copia local de usuario y navega al login. Login, perfil y pagos no dependen de poder guardar esa copia en `localStorage`.
- Playwright cubre ambos paneles en escritorio/móvil, autenticación lenta/fallida, rol ajeno, cierre exitoso/fallido, otra pestaña, navegación atrás, eventos de restauración simulados, falta de recursos/JavaScript y login/perfil/pago con almacenamiento bloqueado. No equivale a probar todas las variantes de caché de cada navegador real.

**Pruebas de esta rama:** Node 24.15.0 y Node 22.23.4: 41/41 backend sin PostgreSQL y 49/49 navegador en cada versión, más una prueba posterior de recuperación tras error de revalidación ejecutada por separado en ambas versiones; sintaxis correcta de 43 JS y scripts inline de ambos paneles en ambas versiones. PostgreSQL 18 temporal no inició porque el entorno denegó el socket TCP loopback; `pagos-pg`, `integridad-pg` y `flujos-web-pg` se ejecutan en CI con PostgreSQL 16. No se consultó ni alteró la base productiva.

**Ejecuciones del PR:** [CI final 41873432620](https://github.com/josentss/jaguares/actions/runs/41873432620), Node 22/PostgreSQL 16/Chromium, aprobó 79/79 backend y 63/63 navegador sin omisiones. El [primer CI 41594079402](https://github.com/josentss/jaguares/actions/runs/41594079402) aprobó backend y falló en una prueba móvil que consultaba el menú antes de terminar la verificación de sesión; se corrigió la espera y se añadieron casos de navegación y revalidación lenta. Este fallo no demostró por sí solo un fallo de la aplicación.

**Límites de sesión:** el cierre elimina la cookie del navegador; el JWT es autónomo y un token copiado antes del cierre puede seguir siendo válido hasta su vencimiento si cuenta y rol siguen habilitados. La señal entre pestañas usa almacenamiento local cuando está disponible; la revalidación al recuperar visibilidad y la autorización backend siguen siendo necesarias. Se verificó `no-store` en Vercel para ambos paneles y la respuesta anónima de `/api/auth/me`; no se probaron todas las respuestas autenticadas.

**Evidencia anterior a la corrección:** Chromium local sobre el HTML previo, APIs y cookie sintéticas, sin cargar la aplicación/BD de producción: en los dos paneles y ambos tamaños, el contenido era visible mientras `/api/auth/me` esperaba; al devolver 401 redirigía al login. Con logout 503, ambos redirigían igualmente y conservaban la cookie sintética. Esto reproduce fallos de interfaz/cierre, no un bypass de autorización. No se ejecutó una auditoría integral ni se actualizaron dependencias.

Después: corregir fechas del calendario; añadir hora en un bloque separado. Mantener como prioridad de seguridad la validación y privacidad de documentos, dependencias y consistencia Cloudinary/SQL; una exposición concreta de datos personales desplazaría el orden funcional. La mensualidad fija, conversión y deuda individual siguen aplazadas por decisión del propietario.

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
| 2026-11-02 | Inscripción: 0–18 años cumplidos a fecha de registro | PR #4 | Regla histórica; sustituida por la regla 5–18 de PR #9, fusionado |
| 2026-11-02 | Inscripción: 5–18 años cumplidos hoy en Caracas, sin cambiar históricos ni categorías | Reporte y decisión del propietario: U-7 empieza a los cinco | PR #9 fusionado; el propietario confirma el resultado manualmente |
| 2026-11-02 | Altas compuestas atómicas, identidades coordinadas y sufijos heredados preservados | PR #6 | Fusionado; constraints reales pendientes |
| 2026-11-02 | Revalidar estados concurrentes de pagos/activaciones y unificar valores médicos validados/persistidos | PR #7 | Fusionado; despliegue Production completado según registro, prueba manual autenticada pendiente |
| 2026-11-02 | Priorizar inscripciones funcionales y pruebas completas de navegador/API/BD | Reporte del propietario; PR #8 | Fusionado, CI 89/89, Production completado; inscripción confirmada manualmente por el propietario |
| 2026-11-03 | Mensualidad fija, conversión según moneda seleccionada y solo cargos adeudados en el panel del representante | Solicitud futura del propietario | Guardado para fase financiera; no implementar hasta acordar tarifa, vigencia, fuente/tasa de conversión y excepciones |
| 2026-11-02 | Eliminación definitiva y WhatsApp | Pendiente de políticas y consentimiento | No definido |

### Bitácora de entregas (actualizar tras cada PR)

| Fecha | PR / commit | Resultado y pruebas | Pendientes |
| --- | --- | --- | --- |
| 2026-11-02 | #1 a #4; `main` `29174dd3` | Correcciones de estados/pagos/formularios/coherencia; último CI 46/46 | Integridad de registros, seguridad restante y backlog |
| 2026-11-02 | PR #6, main `46ce6bf` | P1: transacciones, duplicados y concurrencia; 53 backend + 10 interfaz locales; CI remoto satisfactorio | Estado inicial «PR pendiente/API bloqueada» reemplazado por verificación actual; constraints/Cloudinary pendientes |
| 2026-11-02 | PR #7, main `8d5855f` | Seguimiento: 64/64 backend local en Node 22/24; CI Node 22/PostgreSQL 16 con 64 backend + 10 Playwright. Production completado; navegación anónima web real escritorio/móvil satisfactoria | Pruebas autenticadas manuales, archivos/privacidad y constraints reales pendientes; no equivale a validación integral de producción |
| 2026-11-02 | Rama documental `docs/verificacion-pr7-web` | Evidencia de fusión/CI/Production y guía de 75 casos manuales, sin cambios de código | Documentación local para revisión; resultados manuales del propietario por registrar |
| 2026-11-02 | PR #8 / main `d6d8c38` | CI 64 backend + 25 navegador aprobado; Production completado; siete recursos coinciden; propietario confirma inscripción y recorridos habituales | Nuevos hallazgos registrados; proveedores/constraints productivos sin validar |
| 2026-11-03 | [PR #9](https://github.com/josentss/jaguares/pull/9), main `52cd290` | Fechas civiles, duplicados familiares NFC/nombre completo y edad mínima cinco; 74 backend + 31 navegador locales Node 22/24; CI 105/105 en [run 41563588392](https://github.com/josentss/jaguares/actions/runs/41563588392); Production completado | El propietario confirma pruebas web satisfactorias. PDF, entrada visual, eventos/hora y finanzas continúan en bloques separados |
| 2026-11-03 | [PR #10](https://github.com/josentss/jaguares/pull/10), main `3ff6923` | Exportación PDF A4 e impresión; 22 interfaz y 36 backend sin PostgreSQL por Node 22/24. 41 JS + script inline con sintaxis válida. CI final Node 22 + PostgreSQL 16 satisfactorio ([run 41582920053](https://github.com/josentss/jaguares/actions/runs/41582920053)); Production completado. PostgreSQL local no pudo enlazar loopback | Propietario confirma generación correcta de planillas antes defectuosas y nueva; sesiones, calendario y auditoría de archivos/dependencias pendientes |
| 2026-11-03 | Revisión `docs/seguimiento-pr10-prioridades` | Confirmadas fusión/despliegue/CI y aceptación del PR #10; reproducción local en ambos paneles, escritorio/móvil, de contenido previo a auth y redirección con cookie conservada tras logout 503 simulado | Actualización documental; corrección de sesiones propuesta, aún no implementada |
| 2026-11-04 | [PR #11](https://github.com/josentss/jaguares/pull/11), main `39960c1` | Protección inicial y revalidación, cierre con confirmación y `no-store`; CI 79 backend + 63 navegador y Production completado; navegación anónima comprobada | Pruebas autenticadas del propietario pendientes; JWT copiado no se revoca al cerrar sesión |

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
