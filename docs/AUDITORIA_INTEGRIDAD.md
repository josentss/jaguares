# Auditoría P1 — identidades y altas

Fecha: 2026-11-02. Base: `main` `8a36279e150954136cdb02e05e22cce5401ceaff`.
Rama: `integridad/altas-atomicas-identidades`. Sin migraciones ni acceso a datos de producción.

**Actualización:** esta entrega se fusionó mediante [PR #6](https://github.com/josentss/jaguares/pull/6). El [seguimiento sobre main actualizado](AUDITORIA_INTEGRIDAD_SEGUIMIENTO.md) registra la verificación remota y las nuevas correcciones. Los límites de acceso remoto que se describen abajo corresponden a la primera entrega.

## Relaciones revisadas

- `usuarios.id_usuario` identifica la cuenta; el representante es un usuario con rol `representante`, no una entidad separada.
- `atletas.id_representante` enlaza al usuario. Las altas propias usan el ID de sesión; directiva selecciona un representante aprobado o crea uno en la misma operación.
- `pagos.id_atleta` enlaza al atleta y su propietario se obtiene mediante JOIN, no del body. El INSERT vigente exige atleta activo y representante aprobado.
- Foto, cédula escaneada y partida son columnas URL del atleta; el comprobante es una URL del pago. Los controladores toman archivos de Multer, no URLs arbitrarias del body.
- Notificaciones enlazan al usuario. Las notificaciones de inscripción son posteriores al commit y de mejor esfuerzo.
- Estas relaciones se verificaron en código y en PostgreSQL temporal con claves foráneas de prueba. No se verificaron los constraints reales de Supabase.

## Diagnóstico y correcciones

| Hallazgo | Evidencia y efecto | Corrección / regresión |
| --- | --- | --- |
| Confirmado: alta compuesta sin transacción | `registrarAtletaDirectiva` insertaba usuario, luego atleta y trataba de compensar con DELETE; un fallo del proceso o del borrado podía dejar una cuenta sin el alta solicitada | Una conexión, BEGIN/COMMIT/ROLLBACK; error SQL forzado mediante trigger revierte usuario y atleta; un conflicto posterior a crear usuario también revierte todo |
| Confirmado: carrera en cédulas heredadas | La secuencia se consultaba y luego insertaba sin coordinar solicitudes | Bloqueo transaccional PostgreSQL común; dos hermanos simultáneos obtienen sufijos distintos; se conservan `H-base` y sufijos anteriores |
| Confirmado: duplicados dependientes de constraints desconocidos | Alta de atleta y registro público confiaban en error de INSERT; directiva comprobaba correo/cédula fuera de transacción y perfil usaba NOT EXISTS sin coordinar escritores | Comprobaciones normalizadas dentro de la sección transaccional compartida por registro público, directiva y perfil; pruebas concurrentes sin UNIQUE para demostrar la protección de aplicación |
| Confirmado: repetición de atleta sin cédula propia | Cada envío repetido podía obtener otra cédula heredada | Se rechaza con 409 la coincidencia de representante, nombres, apellidos y fecha de nacimiento; trim y comparación de nombres sin distinguir mayúsculas. No se fusionan ni eliminan registros históricos |
| Confirmado: excepción antes de validar representante | `req.body.rep_cedula.trim()` precedía a la validación | Validar tipos antes de normalizar; ausente, null, objeto y número producen 400 sin escrituras |
| Controles existentes preservados | Planilla/perfil/atletas/historial/comprobante comprueban dueño o rol administrativo; el middleware vuelve a consultar sesión/estado/rol | Pruebas HTTP: 401 sin cookie, 403 a otro representante y a altas de directiva, 200 al dueño y personal autorizado. Intentos de cambiar dueño/estado/URL desde JSON no se persisten |

## Decisiones técnicas

- `utils/integridad.js` usa `pg_advisory_xact_lock(74219, 1)` y READ COMMITTED en una conexión prestada de `pg.Pool`. Coordina escritores en distintas conexiones/instancias, incluyendo el pool transaccional; no depende de memoria de Node.
- Se serializan solo altas y cambios de identidad de estos flujos. Es una solución conservadora inicial: el bloqueo global reduce paralelismo. Hash de contraseña y carga de archivos ocurren fuera del bloqueo.
- Esperar un bloqueo más de 5 segundos devuelve 503 recuperable y revierte la operación. La conexión se libera; si falla ROLLBACK, se descarta. Las violaciones de unicidad de PostgreSQL siguen devolviendo 409.
- El representante se valida y bloquea durante la inscripción. Debe existir, ser representante y estar aprobado al enlazar el atleta. No se cambia su estado para forzar el alta.
- Las cédulas heredadas históricas no se renumeran al modificar el perfil. Las siguientes altas usan la cédula vigente y comprueban colisiones. Una secuencia fuera del rango entero seguro se detiene para revisión.
- La comparación de nombre completo y fecha solo evita repetir un atleta dentro de la misma familia; no acredita identidad legal ni identifica duplicados entre familias. Casos históricos o excepcionales requieren revisión, sin fusiones automáticas.
- Los errores nuevos registran códigos, no parámetros SQL, documentos, contraseñas ni detalles de PostgreSQL que puedan contener datos personales.

## Validación local

- Node 22.23.4 y PostgreSQL 16 desechable; suite nueva `tests/integridad-pg.test.js` con esquema independiente, sin UNIQUE en las columnas de identidad.
- CI incorpora esa suite al comando existente; las pruebas anteriores siguen ejecutándose. La tabla usuarios de la prueba de pagos incluye ahora correo para representar el modelo usado por las comprobaciones de identidad.
- Playwright 1.56.1 con Chromium **del sistema 154**, no el Chromium 141 del CI, cuya descarga estaba bloqueada por red. Las pruebas del navegador conservan sus aserciones y cubren escritorio/móvil con APIs simuladas.
- Los resultados finales se registran en el contexto maestro. La validación local no equivale a validación con Supabase ni Cloudinary de producción.

## Pendientes y límites

1. Auditar en modo lectura, con acceso autorizado, duplicados y restricciones reales de Supabase. No se añadieron UNIQUE/FK ni migraciones: los bloqueos cooperativos no impiden escrituras SQL externas o versiones anteriores de la aplicación.
2. Registro público no captura cédula: no se puede inferir que correos diferentes pertenecen al mismo representante a partir del nombre. Duplicados históricos, diferencias ortográficas, cambios de representante y transferencias requieren diagnóstico específico.
3. Las URLs guardadas quedan asociadas a su registro y sus endpoints comprueban permisos, pero eso **no garantiza privacidad de la URL externa**. Cloudinary no se validó con credenciales reales.
4. Las cargas de Cloudinary ocurren antes del commit de BD. Una inscripción rechazada puede dejar archivos remotos huérfanos; la transacción SQL no revierte la carga. Pendiente diseñar almacenamiento privado y limpieza trazable, sin borrar activos de producción en esta tarea.
5. `validarMagicBytes` devuelve siempre true en el middleware actual: la validación real del contenido de archivos queda pendiente P0. El tipo MIME declarado no acredita el contenido.
6. Una desconexión exactamente durante COMMIT puede dejar resultado incierto. El reintento se protege contra duplicados mediante las mismas comprobaciones, pero no existe una clave persistente de idempotencia que recupere la respuesta original.
7. Estado de PR y despliegue remoto no confirmado: `api.github.com` está bloqueado por el proxy. Lectura Git de main sí comprobada. No hubo fusión, despliegue ni escrituras de producción.

## Comprobaciones antes de un despliegue autorizado

1. Revisar el diff y CI del PR; comprobar conexión transaccional y permisos de advisory locks en la base de desarrollo configurada para Vercel.
2. Con cuentas y documentos sintéticos, registrar desde ambos paneles, repetir envíos y simular fallo de BD. Confirmar 409/503 visibles y ausencia de cuentas parciales.
3. Comprobar que un representante ajeno no obtiene planillas/documentos/pagos y que directiva conserva los accesos previstos.
4. Planificar por separado auditoría de producción y restricciones de BD; no aplicar migraciones como parte de estas comprobaciones.
