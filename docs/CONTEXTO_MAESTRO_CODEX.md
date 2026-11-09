# Jaguares — contexto maestro

Documento vivo para continuar el sistema sin reconstruir ni duplicar funcionalidades. El código actual es la fuente de verdad.

## 1. Estado comprobado

- Repositorio: <https://github.com/josentss/jaguares>
- Rama de producción: `main`.
- `main` remoto verificado el 8 de noviembre de 2026: `79bced77fca4fa953717ebe8dc1e36243bf91051` (merge PR #29).
- PR #1 al #29 fusionados. El propietario comprobó que el [PR #29](https://github.com/josentss/jaguares/pull/29) está fusionado y sus funciones se comportan correctamente en Vercel: visor de comprobantes en ambos paneles, cambios de estado y borrado confirmado de rechazados. [PR #30](https://github.com/josentss/jaguares/pull/30) preparado en borrador para reforzar CORS y escritura de API según Origin.
- PR #15 limita eventos nuevos desde el día actual en Caracas hasta el 31 de diciembre del año siguiente.
- El propietario confirmó despliegue en Vercel de PR #22 tras fusionarlo. No se ha comprobado independientemente el SHA exacto actualmente desplegado en Production; no equiparar Preview con Production.
- En el SHA del PR #19 pasó el CI `Sintaxis y pruebas backend` y su Preview estuvo disponible. El propietario compartió capturas de calendario y panel funcionando tras la fusión; no se ha verificado aquí el SHA efectivo en Production.
- Tras añadir `hora_evento` en Supabase, el propietario confirmó `time without time zone` nullable. `GET /api/cms/public/eventos` pasó de HTTP 500 a 200 el 6 de noviembre de 2026.
- El propietario confirmó manualmente en Production el comportamiento del PR #15.
- CI usa Node.js 22. El entorno local habitual usa Node.js 24; no cambiar versiones sin necesidad.

Este estado debe contrastarse con GitHub y Vercel al comenzar cada bloque.

## 2. Reglas de trabajo

1. Leer este documento y revisar el código antes de proponer cambios.
2. Trabajar en una rama; no editar `main`, fusionar ni desplegar sin autorización.
3. Mantener Express, PostgreSQL/Supabase, Cloudinary y Vercel salvo decisión explícita.
4. El backend valida datos, roles, propiedad, relaciones y estados.
5. Usar consultas parametrizadas y cambios de base compatibles y no destructivos.
6. No escribir en Supabase de producción durante desarrollo o pruebas.
7. Proteger especialmente datos personales, documentos y datos médicos de menores.
8. No inventar tarifas, categorías, sanciones, eliminación de datos personales ni comunicaciones. El propietario autorizó implementar un borrado manual y confirmado para eventos únicamente.
9. Conservar históricos personales; archivado y eliminación requieren política institucional. Los eventos se conservan hasta que la directiva/admin decide eliminarlos explícitamente.
10. No declarar probada una función si no se ejecutó la prueba correspondiente.

## 3. Arquitectura vigente

- Backend: Node.js, Express y controladores CommonJS.
- Base: PostgreSQL en Supabase mediante `pg` y `DATABASE_URL`.
- Autenticación: JWT en cookie `HttpOnly`, con guardas de rol y estado.
- Archivos: Cloudinary y almacenamiento privado temporal para comprobantes.
- Frontend: HTML, CSS y JavaScript sin framework en `public/`.
- Despliegue: Vercel mediante `vercel.json`; `index.js` es la entrada.
- Pruebas: `node:test`, PostgreSQL temporal y Playwright.

Las rutas, controladores y esquema reales prevalecen sobre descripciones históricas.

### Esquema SQL comunicado por el propietario (6 de noviembre de 2026)

Este inventario, preparado en [PR #18](https://github.com/josentss/jaguares/pull/18), resume el DDL compartido en conversación. No procede de una introspección completa de Supabase ni sustituye un volcado: no incluye definiciones de secuencias, índices independientes, disparadores, permisos ni políticas RLS. El propietario verificó posteriormente las columnas de `eventos` en el catálogo y añadió `hora_evento`. Verificar el catálogo efectivo antes de cada migración. Las claves primarias son enteros con `nextval(...)`; aparte de las PK, solo `usuarios.correo` declara `UNIQUE` en el DDL recibido.

| Tabla `public` | Relaciones declaradas | Tipos y restricciones que afectan al sistema |
| --- | --- | --- |
| `usuarios` | PK `id_usuario`; recibe atletas y notificaciones | `correo` único; `cedula` nullable sin unicidad declarada; `rol` restringido a representante, staff, directiva o admin; `estado` **nullable** con `CHECK` de pendiente, aprobado o rechazado; `fecha_registro` `timestamptz`. |
| `atletas` | PK `id_atleta`; `id_representante` obligatorio referencia `usuarios` | `fecha_nacimiento` `date`; `cedula` nullable sin unicidad declarada; `cedula_heredada` `smallint`; `estado` nullable con `CHECK` de espera, activo o inactivo; contiene URL de foto y documentos y observaciones médicas. |
| `pagos` | PK `id_pago`; `id_atleta` obligatorio referencia `atletas` | `fecha_pago` `date`; `monto` `numeric` sin precisión ni escala declaradas; `estado_pago` nullable con `CHECK` de pendiente, aprobado o rechazado; referencia y ruta de comprobante nullable. |
| `notificaciones` | PK `id_notificacion`; `id_usuario` obligatorio referencia `usuarios` | `fecha` `timestamptz`; `mensaje` y `tipo` obligatorios. |
| `noticias` | PK `id_noticia`; sin FK declarada | `fecha_publicacion` `timestamptz`; `estado` publicada, archivada o borrador; texto e imagen URL. |
| `eventos` | PK `id_evento`; sin FK declarada | `fecha_evento` **`timestamptz` NOT NULL**, no `date`; `hora_evento` `time without time zone` nullable, añadida después del DDL; `estado` proximo, en_progreso, completado o cancelado. |
| `audit_uploads` | PK `id`; `user_id` sin FK declarada | `ts` `timestamptz`; `success` booleano; `meta` `text`; nombres, IP y metadatos de cargas potencialmente sensibles. |

La ausencia de `UNIQUE` en una columna del DDL recibido no demuestra que no exista un índice único creado por separado. Tampoco se puede inferir la configuración RLS. No copiar filas, contraseñas, documentos, recibos ni registros de auditoría a pruebas o documentación.

Consulta inicial de **solo metadatos** para contrastar el calendario en SQL Editor (su `SHOW TimeZone` describe esa sesión, no necesariamente la conexión de Vercel):

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'eventos'
  AND column_name IN ('fecha_evento', 'hora_evento')
ORDER BY column_name;
```

Para auditar estados de cuentas privilegiadas sin mostrar identidades ni contraseñas:

```sql
SELECT rol, estado, count(*) AS cuentas
FROM public.usuarios
WHERE rol IN ('staff', 'directiva', 'admin')
GROUP BY rol, estado
ORDER BY rol, estado;
```

### Diferencias comprobadas entre el DDL recibido, el código y las pruebas

1. **Fecha de eventos (prioridad alta):** Supabase confirmó `eventos.fecha_evento timestamptz NOT NULL`, mientras `config/db.js` conserva como texto solo columnas `DATE` y las pruebas previas creaban `fecha_evento DATE`. El propietario ejecutó una consulta agregada: **9 eventos, los 9 a medianoche UTC y los 9 con día diferente en Caracas**. El día UTC es el que la API vigente serializa y la interfaz ha mostrado; convertir a día de Caracas desplazaría los nueve históricos. El [PR #19](https://github.com/josentss/jaguares/pull/19) fija explícitamente el día UTC como fecha civil sin alterar datos ni tipo SQL y cambia la prueba temporal a `timestamptz`.
2. **Hora de eventos:** `hora_evento TIME WITHOUT TIME ZONE` nullable ya existe en Supabase; el calendario público volvió a HTTP 200. Los históricos quedan sin hora y los nuevos la exigen en Express. La hora no se combina con el instante de `fecha_evento` para inferir otro día.
3. **Estado de cuentas (prioridad de acceso):** el `CHECK` recibido para `usuarios.estado` no permite `inactivo`, pero permite `NULL` porque la columna no es `NOT NULL`. La autenticación contempla `inactivo` y las pruebas lo usan; una prueba incluso simula directiva con estado `activo`, que tampoco figura en el `CHECK`. El middleware permite a staff, directiva o admin con `estado NULL` pasar la comprobación de estado. La consulta agregada del propietario mostró **una directiva aprobada y ninguna cuenta privilegiada con estado NULL**; el riesgo de futuras filas inválidas persiste. El controlador de directiva solo aprueba o rechaza solicitudes pendientes; la inactivación del panel corresponde a atletas.
4. **Identidades y pruebas:** el DDL recibido no declara unicidad de `usuarios.cedula` ni `atletas.cedula`; el código coordina altas con bloqueo asesor y comprobaciones, pero eso no protege escritores SQL ajenos. Los esquemas temporales de algunas pruebas sí declaran esas unicidades y no reproducen el `CHECK` de estados; no asumir que sus resultados certifican esas restricciones en producción.
5. **Auditoría:** el DDL recibido usa `audit_uploads.meta TEXT`, mientras la prueba web temporal crea `JSONB`; `utils/auditLogger.js` envía JSON serializado como texto. `scripts/purge_audit.js` contiene DDL y sintaxis MySQL incompatibles con PostgreSQL; no ejecutarlo ni definir retención por inferencia.

## 4. Capacidades implementadas

### Cuentas, permisos y sesiones

- Registro de representantes; la directiva aprueba o rechaza solicitudes pendientes. La inactivación implementada en el panel corresponde a atletas, no a cuentas.
- Acceso por rol y propiedad: cada representante opera solo sobre su familia.
- Sesión compartida entre pestañas, cierre sincronizado y recuperación tras recarga.
- Inactividad de 15 minutos con aviso previo; duración absoluta de 12 horas.
- La comprobación inicial evita exponer brevemente datos del panel.

Contrato y límites: [SESIONES_Y_ACCESO.md](SESIONES_Y_ACCESO.md).

### Atletas e inscripciones

- Altas desde representante y directiva con validación equivalente en backend.
- Edad de alta: 5 a 18 años cumplidos según la fecha civil de Caracas. Esto valida inscripción, no asigna categoría.
- Cédula propia venezolana `V`/`E` con 7 a 9 dígitos o heredada generada por el servidor.
- Hermanos pueden heredar la cédula del representante con sufijos únicos; los históricos no se renumeran.
- Se rechaza dentro de una familia el mismo nombre completo normalizado y fecha de nacimiento.
- Altas relacionadas usan transacciones y bloqueos cooperativos para reducir carreras.
- Los estados controlan disponibilidad en pagos y paneles.
- Planilla exportable a PDF con paginación y espera de recursos.

### Pagos

- Reporte en efectivo o transferencia, comprobante cuando corresponde y revisión por directiva.
- Solo se admiten pagos ordinarios de atletas activos con representante aprobado.
- Las fechas civiles se mantienen sin desplazamientos de zona horaria.
- Los montos actuales son libres; todavía no representan la mensualidad oficial.

### Calendario y notificaciones

- Directiva programa eventos; representantes y público ven los próximos. El PR #20 ya eliminó los controles manuales de «Completado/Cancelar» de la interfaz; la directiva/admin puede borrar eventos con confirmación mediante papelera.
- Eventos nuevos: desde hoy en Caracas hasta el 31 de diciembre del año siguiente.
- Los históricos fuera del rango se conservan.
- [PR #17](https://github.com/josentss/jaguares/pull/17) desplegó código que exige `HH:mm` para eventos nuevos y usa `hora_evento TIME WITHOUT TIME ZONE` nullable. La interfaz presenta la hora civil de Venezuela cuando existe; los históricos deben quedar sin hora.
- Supabase ya contiene `hora_evento` nullable. El [PR #19](https://github.com/josentss/jaguares/pull/19) fue fusionado; el propietario verificó visualmente registro y presentación de evento con hora. Falta una confirmación trazable del SHA de Production.
- **PR #20 fusionado y probado visualmente por el propietario:** horas de 05:00 a 22:00 (cada cinco minutos; a las 22:00 solo minuto 00), estado «Completado» derivado al día civil siguiente sin reescribir históricos, aviso, Programados/Historial, DELETE confirmado autorizado y listado público compacto/filtrable. No hay cron ni eliminación automática.
- **PR #21 fusionado:** introdujo el selector visual de hora a. m./p. m., manteniendo `HH:mm` en API, pero el propietario consideró su diálogo desplegable demasiado grande. Confirmó la funcionalidad y despliegue, sin validar aquí el SHA efectivo de Production.
- **PR #22 fusionado, probado visualmente y desplegado según el propietario:** popover compacto con hora en formato 12h, a. m./p. m. y minutos rápidos. El valor legible aparece solo en el campo; API conserva `HH:mm`. El propietario registró y verificó eventos correctamente.
- **PR #23 fusionado y validado visualmente por el propietario:** limpieza de textos y mejora táctil del reloj sin cambiar API, datos ni calendario público.
- Las notificaciones son informativas y de mejor esfuerzo; no hay lectura persistente.

## 5. Riesgos y deuda vigentes

### Críticos ante evidencia concreta

- Evitar publicación o registro de documentos, recibos y datos médicos reales.
- Revisar archivos privados presentes en la historia Git y acordar remediación antes de reescribirla.
- Confirmar en PostgreSQL real restricciones, claves foráneas y duplicados antes de migrar.
- Verificar en Production tras despliegue autorizado que se conserva la fecha civil del PR #19 y que los históricos no cambian; las pruebas temporales ya modelan `timestamptz`.
- Auditar estados `NULL` de cuentas privilegiadas y alinear autenticación, `CHECK` y pruebas sin asumir su estado legítimo.
- Mantener autorización backend en toda ruta nueva; la interfaz no es una barrera.

### Seguridad y operación

- **PR #24 fusionado y probado visualmente por el propietario:** firmas binarias, MIME y extensión se comprueban antes de Cloudinary en atletas, pagos y noticias; la firma no equivale a antivirus ni valida la autenticidad de documentos.
- **PR #25 fusionado y desplegado según el propietario:** rutas de documentos por ID de atleta con permiso de propietario/roles, botón «Documentos» en panel representante, planilla en directiva y enlaces temporales para `authenticated`. La variable `CLOUDINARY_AUTHENTICATED_UPLOADS` permanece apagada por defecto salvo configuración explícita. Los históricos `upload` siguen pudiendo ser accesibles mediante URL antiguas.
- **Capturas Cloudinary del 7 de noviembre:** opción de entrega PDF/ZIP marcada; ejemplo JPG en `jaguares/atletas` y ejemplo PNG en `jaguares_comprobantes` aparecen con control de acceso **Público**. Esto no demuestra el `resource_type` detallado de todos los archivos ni la posibilidad de servir cada PDF nuevo como `authenticated`; el plan no está confirmado.
- **PR #26 fusionado:** el analizador restringe las URL al Cloudinary y carpetas permitidas y existe un inventario SQL de solo lectura con salida agregada. Se verificó en CI con PostgreSQL temporal, sin ejecutar todavía inventario de Supabase de Production.
- **PR #27 en revisión:** corrige el arranque del inventario desde terminal cargando `.env` local antes de comprobar variables de conexión. Agrega prueba con un `.env` ficticio y proceso aislado sin conexión real.
- Los enlaces temporales pueden reutilizarse hasta caducar; no garantizan revocación inmediata. Las imágenes incrustadas y exportación PDF de planillas deben verificarse en Preview con recursos sintéticos.
- Cloudinary y SQL no forman una transacción única; pueden quedar archivos huérfanos.
- El limitador en memoria no es global entre instancias serverless.
- Falta revisión periódica de dependencias, `TRUST_PROXY`, CSRF y XSS. El PR #30 mejora CORS y bloquea escrituras con Origin no permitido o Fetch Metadata cross-site, pero no equivale a una auditoría CSRF completa de clientes sin Origin.
- El logout elimina cookies, pero no revoca centralmente un JWT copiado.
- No hay esquema/migración canónico versionado que demuestre todas las restricciones de producción.
- El DDL comunicado no declara unicidad de cédulas; comprobar índices reales y duplicados antes de proponer restricciones.
- `scripts/purge_audit.js` usa sintaxis MySQL y no debe ejecutarse contra PostgreSQL; la retención exige política institucional.
- El bloqueo asesor de altas es cooperativo; escritores futuros deben respetarlo.

### Producto y conservación

- No hay historial general de cambios, archivado ni eliminación definitiva controlada.
- No hay auditoría persistente de acciones administrativas.
- Categorías, tarifas, sanciones, retención y comunicaciones requieren decisiones.

## 6. Hoja de ruta por impacto en UX

Cada punto debe ir en un PR separado y conservar compatibilidad.

1. **Calendario: fase funcional cerrada.** PR #19–#23 fusionados y probados visualmente por el propietario. Mantener sin cambios los nueve días históricos y comprobar SHA de Production cuando corresponda.
2. **Pagos guiados por deuda.** Solo conceptos pendientes, monto oficial y conversión. Bloqueado hasta definir tarifa, moneda base, tasa, redondeo, vencimientos y pagos parciales.
3. **Categorías, equipos y temporadas.** Asignación por edad, temporada y rendimiento; requiere reglas deportivas.
4. **Traspasos y plantillas.** Historial de movimientos y plantillas por categoría, después del modelo anterior.
5. **Historial, archivado y auditoría.** Conservación y trazabilidad; eliminación solo con política aprobada.
6. **Historial y condiciones deportivas.** Torneos, títulos, lesiones, sanciones, `Lesionado` y `Sancionado`.
7. **Calendario ampliado.** Reuniones, recordatorios y lectura persistente.
8. **Integraciones.** WhatsApp y cumpleaños solo con consentimiento y política.

Los hallazgos reales de seguridad o integridad tienen prioridad sobre esta lista.

## 7. Decisiones institucionales pendientes

No implementar por inferencia:

- mensualidad, monedas, fuente de tasa, redondeo, mora y pagos parciales;
- categorías, temporadas, equipos, ascensos y excepciones;
- faltas, tarjetas, sanciones y cobros asociados;
- retención, archivado y eliminación definitiva;
- mensajes, destinatarios, consentimiento y horarios de comunicación.

## 8. Validación y entrega

- Sintaxis y pruebas existentes.
- PostgreSQL temporal para transacciones o esquema.
- Playwright escritorio/móvil si cambia una interfaz.
- Regresión proporcional de cuentas, inscripción, pagos y permisos.
- Sin secretos ni datos reales en código, pruebas, logs o documentos.
- Contexto actualizado con evidencia real y riesgo residual.
- Rama y PR preparados; no fusionar ni desplegar sin aprobación.

## 9. Documentación activa

- [README de documentación](README.md): índice y mantenimiento.
- [PRUEBAS_MANUALES_WEB.md](PRUEBAS_MANUALES_WEB.md): checklist manual vigente.
- [SESIONES_Y_ACCESO.md](SESIONES_Y_ACCESO.md): sesiones e inactividad.
- [README_DEPLOY.md](../README_DEPLOY.md): Vercel y Supabase.

Los informes de PR anteriores se retiraron porque duplicaban este estado. Siguen recuperables en Git y GitHub.

## 10. Próximo bloque recomendado

Revisar el [PR #30](https://github.com/josentss/jaguares/pull/30): restringir CORS al mismo origen de la instalación (incluido Preview) o a los orígenes exactos enumerados en `CORS_ORIGIN`, y responder HTTP 403 a escrituras de API provenientes de un Origin no permitido o `Sec-Fetch-Site: cross-site` sin Origin. Confirmar Preview, configuración de Production y la compatibilidad de login, registro, pagos y documentos; no modificar cookies ni credenciales. Después ejecutar inventario anónimo de referencias Cloudinary READ ONLY y pruebas de entrega `authenticated` sintética; no activar cargas privadas en Production ni migrar históricos sin aprobación.

Evidencia previa: `fecha_evento timestamptz NOT NULL`, `hora_evento time without time zone` nullable; los históricos se conservan. PR #19–#29 fusionados; el propietario validó PR #29 manualmente. PR #30 en borrador: CORS estricto y guardia de origen para escrituras. Los activos Cloudinary de tipo `upload` continúan accesibles mediante sus URL históricas, pendientes inventario y pruebas de `authenticated`.
