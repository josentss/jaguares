# Acceso al panel y caducidad por inactividad

Fecha actualizada: 2026-11-05. Implementación: PR #12, fusionado en `main` `1ac08b1` y desplegado a Production.

## Decisión vigente

Se permiten varias pestañas, ventanas y navegadores. El propietario descartó la exclusividad de ventana y eligió **15 minutos de inactividad con aviso previo**. La actividad en una pestaña mantiene vigente la sesión compartida por el mismo perfil de navegador. Otro navegador tiene sus propias cookies y su propio plazo. Se conserva el máximo absoluto de 12 horas por login.

## Implementación

- Express comprueba cookies, estado de cuenta y rol antes de enviar los HTML de los paneles. Sin sesión redirige al login; si falla SQL devuelve un error recuperable. También intercepta variantes codificadas de esas rutas antes de `express.static`.
- El HTML autorizado incluye únicamente usuario básico y vencimientos en JSON escapado, sin credenciales. El cliente lo consume al arrancar, evitando la consulta inicial duplicada y la tarjeta blanca de verificación. Todas las API conservan su autorización propia.
- La verificación al volver a una pestaña se ejecuta en segundo plano sobre el panel ya autorizado. Una respuesta inválida oculta y redirige. El regreso desde caché conserva la protección previa a la revalidación.
- El servidor exige dos cookies HttpOnly/SameSite=Lax (Secure en producción): el JWT principal de 12 horas y una credencial de actividad de 15 minutos, vinculadas por un identificador aleatorio de login. Se verifican firma, propósito, vínculo y vencimiento.
- `/api/auth/actividad` renueva únicamente la credencial de actividad, sin superar el límite absoluto. Exige sesión vigente, cabecera explícita y, si se recibe Origin, el mismo host. Una sesión vencida no puede renovarse.
- Cada login utiliza un nombre de cookie de actividad diferente. Una respuesta de renovación antigua no vuelve a emitir la cookie principal después de logout ni sobrescribe la actividad de un nuevo login. Al entrar/salir se limpian las cookies de actividad anteriores que acompañen la solicitud.
- El navegador registra interacción, sin guardar su contenido, y limita renovaciones a una cada 30 segundos; las consultas automáticas no cuentan. El plazo del servidor se mide desde la última renovación confirmada, por lo que el envío agrupado puede diferir unos segundos de la última pulsación.
- En el último minuto aparece un aviso discreto con «Continuar sesión». No borra el formulario. Al acercarse al límite absoluto indica que hay que guardar e iniciar sesión otra vez.
- Las pestañas comparten los vencimientos mediante almacenamiento local cuando está disponible. Antes de salir por vencimiento aparente, se consulta la cookie vigente en el servidor, cubriendo renovaciones de otra pestaña incluso sin almacenamiento local.
- Cerrar una pestaña no ejecuta logout ni interrumpe otras ventanas. Cerrar todas deja de renovar la actividad: el servidor rechazará solicitudes cuando venza. No se depende de `beforeunload`, de una IP fija ni de temporizadores del navegador para autorizar.

## Despliegue y límites

No requiere migración, variables nuevas ni nuevas dependencias. **Las cookies anteriores al cambio no cumplen el contrato nuevo: los usuarios deberán iniciar sesión una vez tras desplegarlo.** No se modifican atletas, pagos, perfiles ni documentos históricos.

El logout elimina las cookies del navegador, pero no hay registro central para revocar una copia robada de ambas credenciales. Esa copia podría usarse y renovarse hasta el límite absoluto mientras la cuenta siga habilitada. La revocación central y la auditoría general de seguridad continúan pendientes; este bloque no debe presentarse como si las implementara.

Un navegador suspendido puede retrasar el aviso visual. Al volver se verifica el tiempo y el servidor siempre comprueba la caducidad. Si no hay conexión al vencer el plazo, se oculta el panel y se permite reintentar; no se presume autorización por falta de respuesta.

## Validación

Pruebas nuevas de firma/vencimiento, actividad ajena/alterada/ausente, límite absoluto, autorización del HTML, rutas codificadas, escape de datos iniciales, revalidación de estado, fallo SQL, renovación explícita y respuestas tardías. Playwright comprueba inicio sin aviso, rechazo de metadatos incompletos, aviso/caducidad con reloj controlado, conservación del formulario y actividad entre pestañas. Las pruebas SQL existentes se adaptaron a las dos cookies reales.

Resultado local final en Node 24.15.0 y Node 22.23.4: **55/55 pruebas backend sin PostgreSQL y 59/59 de navegador** en cada versión; 46 archivos JavaScript con sintaxis correcta en ambas y `git diff --check` correcto. Playwright 1.56.1 se instaló en una carpeta temporal; no se cambiaron dependencias ni versiones del proyecto.

PostgreSQL 18 temporal volvió a fallar al enlazar el puerto local, también fuera del aislamiento. Las pruebas completas se ejecutaron en el CI con PostgreSQL 16; no se ha consultado ni alterado Supabase de producción.

**CI y despliegue del PR #12:** [ejecución final 41964532958](https://github.com/josentss/jaguares/actions/runs/41964532958), satisfactoria: sintaxis, 93/93 backend con Node 22/PostgreSQL 16 y 73/73 navegador con Chromium. Production `7565382672` completado; no se usó esta verificación para escribir datos productivos.

## Aceptación manual y pulido visual

El propietario confirmó en Production el aviso tras 14 minutos sin interacción, la renovación conservando el formulario, el cierre al dejar vencer el aviso, la coordinación entre pestañas y una inscripción sin regresiones. La coexistencia entre navegador normal e incógnito es intencional: son sesiones independientes y no se usa la IP como identidad.

El [PR #13](https://github.com/josentss/jaguares/pull/13) reduce el peso visual del aviso siguiendo el sistema existente de notificaciones: fondo blanco, franja naranja, icono, título y texto compactos, botón menor y márgenes seguros en móvil. No modifica la seguridad ni los plazos. Pruebas locales: 55/55 backend sin PostgreSQL en Node 24, 59/59 navegador en Node 24 y Node 22, sintaxis de 46 JavaScript en ambas versiones y revisión visual de capturas sintéticas.

## Comprobación manual después del despliegue autorizado

1. Iniciar sesión nuevamente en representante y directiva. La entrada normal no debe mostrar la tarjeta blanca de verificación.
2. Abrir dos pestañas, navegar entre secciones y recargar. Ambas conservan el acceso mientras la sesión esté vigente.
3. Dejar el panel sin interacción: el aviso aparece aproximadamente al minuto 14 desde la última renovación. Pulsar «Continuar sesión» conserva el acceso y el formulario.
4. Repetir sin pulsar continuar ni interactuar: al vencer los 15 minutos debe pedir iniciar sesión. Las notificaciones automáticas no deben prolongarlo.
5. Trabajar en una pestaña y dejar la otra quieta: la sesión compartida permanece vigente. Cerrar una pestaña no cierra la otra.
6. Cerrar todas y volver después de más de 15 minutos: debe exigir login. No es necesario esperar 12 horas.
7. Cerrar sesión expresamente en una pestaña: las demás del mismo perfil vuelven al login. El otro navegador mantiene su sesión independiente.
8. Revisar inscripción, consulta de pagos e impresión/PDF con las cuentas de prueba habituales, sin crear operaciones ficticias en producción.
