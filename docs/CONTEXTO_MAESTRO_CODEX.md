# Jaguares — contexto maestro

Documento vivo para continuar el sistema sin reconstruir ni duplicar funcionalidades. El código actual es la fuente de verdad.

## 1. Estado comprobado

- Repositorio: <https://github.com/josentss/jaguares>
- Rama de producción: `main`.
- `main` remoto verificado el 6 de noviembre de 2026: `4d250430860eed35fe1f826d65007c2e580eb1f2` (merge PR #19).
- PR #1 al #19 fusionados. [PR #19](https://github.com/josentss/jaguares/pull/19) se fusionó el 6 de noviembre de 2026. [PR #20](https://github.com/josentss/jaguares/pull/20) abierto como borrador para UX, horario y gestión del calendario; no fusionado.
- PR #15 limita eventos nuevos desde el día actual en Caracas hasta el 31 de diciembre del año siguiente.
- El último despliegue Production, asociado al PR #18, figura como `success`; el CI del PR #18 pasó.
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

- Directiva programa eventos; representantes y público ven los próximos. La rama pendiente elimina los controles manuales de «Completado/Cancelar» de la interfaz y propone papelera confirmada solo para directiva/admin.
- Eventos nuevos: desde hoy en Caracas hasta el 31 de diciembre del año siguiente.
- Los históricos fuera del rango se conservan.
- [PR #17](https://github.com/josentss/jaguares/pull/17) desplegó código que exige `HH:mm` para eventos nuevos y usa `hora_evento TIME WITHOUT TIME ZONE` nullable. La interfaz presenta la hora civil de Venezuela cuando existe; los históricos deben quedar sin hora.
- Supabase ya contiene `hora_evento` nullable. El [PR #19](https://github.com/josentss/jaguares/pull/19) fue fusionado; el propietario verificó visualmente registro y presentación de evento con hora. Falta una confirmación trazable del SHA de Production.
- **PR #20 en revisión:** horas de 05:00 a 22:00 (cada cinco minutos; a las 22:00 solo minuto 00), estado «Completado» derivado al día civil siguiente sin reescribir históricos, aviso en directiva, separación Programados/Historial, DELETE confirmado con autorización directiva/admin y listado público limitado inicialmente a tres elementos con ampliación. No hay cron ni eliminación automática.
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

- Falta validar firmas o bytes mágicos de cargas, no solo tipo/extensión.
- Debe auditarse la privacidad efectiva de URL de Cloudinary.
- Cloudinary y SQL no forman una transacción única; pueden quedar archivos huérfanos.
- El limitador en memoria no es global entre instancias serverless.
- Falta revisión periódica de dependencias, CORS, `TRUST_PROXY`, CSRF y XSS.
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

1. **Cerrar calendario y experiencia.** PR #19 fusionado; probar rama de horario, historial derivado, eliminación protegida y listado público; después comprobar CI, revisar diff y solicitar autorización para merge. Mantener sin cambios los nueve días históricos.
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

Revisar el [PR #20](https://github.com/josentss/jaguares/pull/20): validar UI responsive, rango de 05:00 a 22:00 cada cinco minutos, estado derivado desde el día siguiente, permiso de DELETE solo para directiva/admin, confirmación y calendario público compacto. No se ejecuta DELETE automáticamente ni se modifican históricos. Ejecutar CI/Playwright/PostgreSQL temporal, contrastar el diff y solicitar autorización antes de fusionar o desplegar.

Evidencia previa: `fecha_evento timestamptz NOT NULL`, `hora_evento time without time zone` nullable; nueve eventos históricos a medianoche UTC, todos con fecha de Caracas del día anterior; una directiva aprobada y ninguna cuenta privilegiada `NULL`. El PR #19 pasó validaciones anteriores a su fusión; el propietario compartió capturas del funcionamiento posterior. La rama actual debe aportar sus propios resultados de CI; no atribuirle todavía pruebas que no se hayan ejecutado.
