# Jaguares — contexto maestro

> **Asignación manual de equipos — 11 de noviembre de 2026:** PR #45 fusionado
> en `main` (`cefb7c8`) y Vercel Production `success` para ese SHA; el propietario
> confirmó visualmente los ajustes. La rama local anterior recibió un
> `git pull --ff-only origin main` exitoso, pero la rama local llamada `main`
> permanece atrasada; crear nuevas ramas desde `origin/main` evita ese desfase.
> Rama `feat/asignaciones-equipos-20261111`: un equipo activo por atleta y
> temporada, solo atletas activos asignables, cambios por directiva/admin con
> historial, aviso de edad sin bloqueo. Migración aditiva separada y manual;
> **no se ha aplicado a Supabase**. Ver [contrato y ensayo](ASIGNACIONES_EQUIPOS.md).
> Próximo bloque tras validar este PR: reporte de pagos del representante,
> sin inferir tarifa, deuda ni política de cobro.

> **Ajustes de paneles — 11 de noviembre de 2026:** GitHub confirma PR #44
> fusionado en `main` (`64be09b`) y Vercel Production `success` para ese SHA.
> El propietario mostró una planilla general generada correctamente y pidió
> un PR de presentación: acciones de pagos en una fila; formularios de atleta
> con indicador de categoría junto a observaciones médicas en ambos roles;
> Solicitudes con rol informativo e iconos SVG; planilla individual sin los
> paréntesis redundantes de cédula/categoría. Rama
> `fix/ux-paneles-planilla-solicitudes-20261111`
> ([PR #45](https://github.com/josentss/jaguares/pull/45)). Sin SQL ni cambio de permisos.
> El propietario acordó separar la gestión de roles; asignar atletas a equipos
> requiere reglas deportivas y migración aditiva posterior. Ver
> [alcance y validación](AJUSTES_PANELES_20261111.md). Pruebas locales de
> interfaz y PDF: 31/31; CI del commit `14cf442` aprobada. El Preview está
> desplegado, pero su revisión visual por el propietario sigue pendiente.

> **Planilla general por categoría — 11 de noviembre de 2026:** GitHub confirma
> `main` en `5464cf9` (PR #43 fusionado), PR #42 aún abierto como borrador y
> despliegue Production `success` para `5464cf9`. Rama
> `feat/planilla-general-atletas-20261111` ([PR #44](https://github.com/josentss/jaguares/pull/44)) propone: botón visible
> solo al elegir U-7/U-9/U-11/U-13/U-15, API protegida que vuelve a consultar
> atletas **activos** de la categoría y PDF A4 con logotipo, nombre, cédula y
> nacimiento. Búsqueda y estado de la tabla no afectan el PDF, por decisión del
> propietario. Sin activos se avisa sin descargar. Sin SQL ni archivos privados.
> Pruebas locales de endpoint con PostgreSQL temporal y PDF Chromium escritorio/móvil
> aprobadas; Preview y Production no probados para este cambio. Ver
> [contrato de planilla general](UX_OPERATIVA_Y_PLANILLA_GENERAL.md).

> **UX operativa — 11 de noviembre de 2026:** la directiva reportó que PR #40 funciona en Preview pero el banner deportivo ocupa demasiado espacio, las tarjetas y formularios no están bien proporcionados, la navegación sin grupos crece excesivamente y falta filtro de categoría. Rama `fix/ux-deportiva-filtros-navegacion-20261111` corrige solo esos puntos: cabecera discreta sin hero, tarjetas alineadas, inscripción compacta, grupos de menú accesibles y filtro combinado por categoría etaria calculada. No cambia SQL, permisos, pagos ni Cloudinary. **Próximo PR:** planilla general PDF por categoría a partir de resultados filtrados, no la ficha individual; pendiente acordar criterios de estado/búsqueda. Especificación: [UX_OPERATIVA_Y_PLANILLA_GENERAL.md](UX_OPERATIVA_Y_PLANILLA_GENERAL.md).
> Mantener alcance acotado, CI, prueba breve móvil/escritorio y limpieza incremental de CSS/JS residual.


> **Bloque funcional — 10 de noviembre de 2026:** PR #39 fusionado en `main` y módulo Organización Deportiva probado manualmente en Preview por el propietario (alta y renombrado persistente).
> Rama nueva `feat/clasificacion-edad-ux-deportiva-20261110`: categoría **orientativa** por edad cumplida de Caracas al registrar atleta (no selector), resultados en listados/planilla y rediseño del panel deportivo. Ver [especificación y guía de pruebas](CLASIFICACION_FORMATIVA.md). U-15 indica modalidad masculina y exige validación; edades 16–18 no poseen categoría pública. No se asigna a temporadas/equipos ni se cambia SQL.
> Mantener PR acotados y limpiar código residual solo en los módulos modificados, con regresión automatizada y prueba humana breve.


> **Actualización funcional — 10 de noviembre de 2026.** GitHub confirma PR #38 fusionado con CI y ensayo de regresión real de archivos en Preview aprobados por el propietario. El texto histórico que menciona PR #35 o el ensayo pendiente ya no describe el estado actual.
>
> **Primer bloque de producto tras Cloudinary:** rama `feat/catalogos-deportivos-20261110` (PR de catálogos deportivos). Añade tres tablas **nuevas** mediante una migración manual, API con alta/renombrado protegidos, nueva sección «Organización Deportiva» y pruebas PostgreSQL/Chromium. No define edades ni reglas deportivas, no asigna atletas y no toca tablas históricas. Consulta [guía de catálogos](CATALOGOS_DEPORTIVOS.md). **Pendiente:** CI y ensayo humano del Preview; no confundir con funcionalidad desplegada en Production.
>
> **Norma de pulcritud:** en cada PR limpiar solo código redundante/residual del módulo que se toca, siempre con pruebas, sin refactorizaciones masivas de archivos estables. Entregar PR de alcance acotado, CI aprobado y una prueba humana breve.


> **Actualización prioritaria — 10 de noviembre de 2026.** Los párrafos históricos más abajo sobre PR #35 o sobre el ensayo pendiente describen estados anteriores; consultar GitHub y esta sección antes de actuar.

### Evidencia actual y trabajo en curso

- PR #36 y **PR #37 fusionados en main** (GitHub revisado); el visor de comprobantes utiliza `/api/pagos/captura/:id?abrir=1`.
- El propietario confirmó en **Vercel Preview con Cloudinary y Supabase reales**: atletas sintéticos 30 (referencias públicas, subida desde rama sin flag) y 31 (foto PNG + PDF `authenticated`); propietario/directiva acceden y representante ajeno/no autenticado reciben 403/401; planilla PDF conserva fotografía en escritorio y móvil.
- Pagos sintéticos 20 (`upload` por solicitud dirigida a Production) y 21 (`authenticated` desde Preview). Con PR #37, ambos abren desde el visor; 403/401 en comprobante 21; URL temporal vencida rechazada por Cloudinary y renovación autorizada satisfactoria.
- **Advertencia:** el ensayo web real se hizo con la **misma base Supabase de Production** por decisión del propietario, aunque con datos sintéticos. NO fue un entorno aislado y no debe tomarse como evidencia de aislamiento. Production mantuvo flag privado apagado. Pendientes: respaldos comprobados, limpieza puntual de pruebas, migración reversible de referencias públicas y pruebas bajo separación real.
- **PR de este bloque (rama `fix/cloudinary-compensacion-fallos-20261110`)**: compensación conservadora de nuevas cargas de inscripción y pagos ante rechazo de formulario, error multipart, rollback PostgreSQL confirmado y pago con `INSERT ... SELECT` sin filas. Solo tras confirmar que PostgreSQL no referencia el `public_id` se solicita `destroy` con `resource_type` y `type` correctos. Ante estado SQL ambiguo, consulta fallida o borrado Cloudinary fallido se conserva el recurso y se registra advertencia anónima para revisión; **no se garantiza cero huérfanos bajo fallos de red/commit**. No modifica esquema, filas históricas ni variable Production.
- **Estado de este PR:** código y pruebas propuestas, pendientes de CI completo y validación humana en Preview. No fusionar hasta verificar. La limpieza de archivos históricos y sintéticos NO está automatizada en este bloque.


Documento vivo para continuar el sistema sin reconstruir ni duplicar funcionalidades. El código actual es la fuente de verdad.

## 1. Estado comprobado

- Repositorio: <https://github.com/josentss/jaguares>
- Rama de producción: `main`.
- `main` remoto verificado el 9 de noviembre de 2026: `74da372851c3127accfcbad31b750f102c760a5a` (merge PR #35). GitHub no muestra PR abiertos. Vercel registró un despliegue de Production `success` para ese SHA; no se verificó aquí la configuración del flag ni un recorrido web en Production.
- PR #1 al #35 fusionados. El propietario probó PR #34 con 3 recursos sintéticos `authenticated`: foto PNG, PDF y comprobante; acceso sin firma bloqueado, con firma temporal permitido, vencido bloqueado. 3 eliminados y 0 pendientes. `url_original_reconocida=false` en los tres, `requiere_ajuste_de_url_web=true`. PR #35 normaliza nuevas referencias privadas antes de persistir; CI terminó en `success`, pero el proveedor estuvo simulado en las pruebas de integración.
- PR #15 limita eventos nuevos desde el día actual en Caracas hasta el 31 de diciembre del año siguiente.
- El propietario confirmó despliegue en Vercel de PR #22 tras fusionarlo. GitHub/Vercel reportó después `success` en Production para el merge PR #35 (`74da372`); no se comprobó desde navegador el comportamiento efectivo de esa versión. No equiparar Preview con Production.
- En el SHA del PR #19 pasó el CI `Sintaxis y pruebas backend` y su Preview estuvo disponible. El propietario compartió capturas de calendario y panel funcionando tras la fusión; falta una comprobación trazable en Production de que los nueve días históricos siguen iguales.
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
- Supabase ya contiene `hora_evento` nullable. El [PR #19](https://github.com/josentss/jaguares/pull/19) fue fusionado; el propietario verificó visualmente registro y presentación de evento con hora. Falta una comprobación trazable de fechas históricas en Production.
- **PR #20 fusionado y probado visualmente por el propietario:** horas de 05:00 a 22:00 (cada cinco minutos; a las 22:00 solo minuto 00), estado «Completado» derivado al día civil siguiente sin reescribir históricos, aviso, Programados/Historial, DELETE confirmado autorizado y listado público compacto/filtrable. No hay cron ni eliminación automática.
- **PR #21 fusionado:** introdujo el selector visual de hora a. m./p. m., manteniendo `HH:mm` en API, pero el propietario consideró su diálogo desplegable demasiado grande. Confirmó la funcionalidad y despliegue, sin validar aquí el SHA efectivo de Production.
- **PR #22 fusionado, probado visualmente y desplegado según el propietario:** popover compacto con hora en formato 12h, a. m./p. m. y minutos rápidos. El valor legible aparece solo en el campo; API conserva `HH:mm`. El propietario registró y verificó eventos correctamente.
- **PR #23 fusionado y validado visualmente por el propietario:** limpieza de textos y mejora táctil del reloj sin cambiar API, datos ni calendario público.
- Las notificaciones son informativas y de mejor esfuerzo; no hay lectura persistente.

## 5. Riesgos y deuda vigentes

### Críticos ante evidencia concreta

- Evitar publicación o registro de documentos, recibos y datos médicos reales.
- Revisar archivos privados presentes en la historia Git y acordar remediación antes de reescribirla. En `HEAD` del PR #35 se rastrean 4 PNG bajo `private_uploads/` y 2 logs; no se inspeccionó su contenido ni se determinó si contienen datos reales. No incluirlos en nuevas pruebas o PR por accidente.
- Confirmar en PostgreSQL real restricciones, claves foráneas y duplicados antes de migrar.
- Verificar en Production tras despliegue autorizado que se conserva la fecha civil del PR #19 y que los históricos no cambian; las pruebas temporales ya modelan `timestamptz`.
- Auditar estados `NULL` de cuentas privilegiadas y alinear autenticación, `CHECK` y pruebas sin asumir su estado legítimo.
- Mantener autorización backend en toda ruta nueva; la interfaz no es una barrera.

### Seguridad y operación

- **PR #24 fusionado y probado visualmente por el propietario:** firmas binarias, MIME y extensión se comprueban antes de Cloudinary en atletas, pagos y noticias; la firma no equivale a antivirus ni valida la autenticidad de documentos.
- **PR #25 fusionado y desplegado según el propietario:** rutas de documentos por ID de atleta con permiso de propietario/roles, botón «Documentos» en panel representante, planilla en directiva y enlaces temporales para `authenticated`. La variable `CLOUDINARY_AUTHENTICATED_UPLOADS` permanece apagada por defecto salvo configuración explícita. Los históricos `upload` siguen pudiendo ser accesibles mediante URL antiguas.
- **Capturas Cloudinary del 7 de noviembre:** opción de entrega PDF/ZIP marcada; ejemplo JPG en `jaguares/atletas` y ejemplo PNG en `jaguares_comprobantes` aparecen con control de acceso **Público**. Esto no demuestra el `resource_type` detallado de todos los archivos ni la posibilidad de servir cada PDF nuevo como `authenticated`; el plan no está confirmado.
- **PR #26 fusionado:** el analizador restringe las URL al Cloudinary y carpetas permitidas y existe un inventario SQL de solo lectura con salida agregada. Se verificó en CI con PostgreSQL temporal, sin ejecutar todavía inventario de Supabase de Production.
- **PR #27 y #31 fusionados:** el inventario carga `.env` desde terminal, hace solo lectura PostgreSQL y ofrece diagnóstico anónimo del tipo de conexión y fallos; el propietario lo ejecutó correctamente después de configurar sus variables locales.
- **Inventario real reportado el 9 de noviembre de 2026:** 29 registros de atletas en cada columna de documentos, 19 sin archivo y 10 referencias públicas en fotos, 10 en cédulas y 10 en partidas. Comprobantes: 15 filas, 11 sin archivo y 4 referencias públicas. **Total 34 referencias públicas, 0 `authenticated`, 0 pendientes de revisión manual**. No implica 34 archivos únicos ni inventaría los recursos huérfanos que solo existen en Cloudinary.
- **PR #32–#35 fusionados y preflight REAL aprobado:** tres archivos sintéticos authenticated, firma válida/vencida comprobadas y limpieza completa. La URL de subida no conserva el prefijo de `public_id`; PR #35 normaliza en Multer para nuevas cargas privadas usando `filename=public_id`, origen/tipo/extensión MIME verificados antes de SQL. El merge no prueba que el flag esté activado ni migra históricos. Falta el recorrido web real en Preview aislado.
- Los enlaces temporales pueden reutilizarse hasta caducar; no garantizan revocación inmediata. Las imágenes incrustadas y exportación PDF de planillas deben verificarse en Preview con recursos sintéticos.
- Cloudinary y SQL no forman una transacción única; pueden quedar archivos huérfanos. No borrar automáticamente documentos de terceros ni registros financieros por un fallo en SQL. Priorizar inventario y política de retención.
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
- [ENSAYO_PRIVACIDAD_PREVIEW.md](ENSAYO_PRIVACIDAD_PREVIEW.md): preparación del entorno aislado y criterios para la prueba real de archivos privados.
- [SESIONES_Y_ACCESO.md](SESIONES_Y_ACCESO.md): sesiones e inactividad.
- [README_DEPLOY.md](../README_DEPLOY.md): Vercel y Supabase.

Los informes de PR anteriores se retiraron porque duplicaban este estado. Siguen recuperables en Git y GitHub.

## 10. Próximo bloque recomendado

Preparar y ejecutar el [ensayo de privacidad en Preview](ENSAYO_PRIVACIDAD_PREVIEW.md) con una base PostgreSQL/Supabase **distinta de Production** y archivos/cuentas sintéticos. El propietario confirmó que ese entorno aislado aún no existe. Este bloque amplía la prueba local de navegador + PostgreSQL para cargas authenticated con Cloudinary simulado: **18/18 pruebas pasaron** en Node 24, PostgreSQL 18 desechable y Chromium el 9 de noviembre de 2026. Comprobó URL canónica en SQL, firma generada, propietario/directiva, rechazo a ajeno y anónimo para foto/PDF/comprobante; **no equivale a la prueba real de Preview** ni comprobó allí la exportación PDF. Confirmar propietario, staff/directiva, representante ajeno, PDF/planilla y comprobante antes de activar privadas en Production. Luego abordar compensación de archivos huérfanos. La migración reversible de 34 referencias públicas requiere inventario deduplicado, respaldo y autorización separada.

Evidencia actual: PR #1–#35 fusionados; Production reportó `success` para `74da372`, sin comprobación del flag. Inventario: 30 referencias públicas de atletas y 4 de comprobantes, 0 authenticated. Preflight Cloudinary real aprobado con 3 tipos y firmas; `requiere_ajuste_de_url_web=true`, limpieza 3/3. La normalización del PR #35 está fusionada; el flujo web con proveedor real sigue pendiente.
