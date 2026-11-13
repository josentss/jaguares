# Cuentas por cobrar — contrato inicial (12-11-2026)

## PR #58 — fuente de cambio principal, archivo de conceptos y fechas de tasas

**Fuente de cambio elegida por Directiva:** ExchangeRate-API es la única fuente externa consultada para los valores Bs por USD y Bs por EUR en Gestión de cobros; la consulta se comparte por día en PostgreSQL. El club adopta estas referencias por decisión operativa. No declarar la respuesta automáticamente «tasa oficial BCV» ni afirmar una certificación de su origen que la respuesta estándar no incluye; conservar **ExchangeRate-API**, fecha de actualización y confirmación de Directiva en la tasa registrada. La tasa EUR es solo informativa; los cargos continúan en USD, los reportes aceptan USD/Bs/COP. El antiguo servicio bcv.today no se consulta más, aunque sus datos almacenados se conservan.

`GET /api/directiva/cobros/tasas/referencias` retorna `principal` con importes USD/VES y EUR/VES de ExchangeRate-API. `POST /api/directiva/cobros/tasas/publicar-referencia` registra la referencia USD/VES solo cuando Directiva pulsa Registrar tasa y confirma; publica una fila inmutable de `tasas_cobro` indicando fuente y fecha. No se publican automáticamente datos de proveedores ni se inventan valores cuando hay errores. Las tasas manuales en Bs y COP siguen disponibles.

**Fechas manuales:** desde el primer día del mes actual en `America/Caracas` hasta **31 de diciembre del año siguiente**. Ejemplo: el 13/11/2026, mínimo 01/11/2026 y máximo 31/12/2027. Validar en el selector y de nuevo en el servidor. Son fechas de vigencia; permitir una tasa futura no permite reportar un pago futuro, y la cotización del pago exige tasa correspondiente a su fecha exacta.

**Retirar conceptos:** `DELETE /api/directiva/cobros/catalogo/:codigo` requiere Directiva/Admin. Si un concepto personalizado **nunca** estuvo vinculado a obligaciones, se elimina físicamente. Si tiene historial, se **archiva** (`activo=false`) y queda oculto de la tabla normal y del selector de cargos. Los cinco códigos institucionales siempre se archivan, nunca se destruyen. «Mostrar archivados» permite editarlos y reactivarlos. La papelera solo aparece durante la edición de una fila (no repetir íconos en todas las líneas). El servidor usa transacción y bloqueo de fila, y la emisión de cargos comparte bloqueo de lectura del concepto para evitar carreras. **Los cargos y pagos históricos se conservan**.

**Despliegue:** PR solo de código. No requiere migración SQL nueva ni actualiza pagos/obligaciones en Supabase. CI usa PostgreSQL temporal y pruebas de navegador. En Production comprobar primero lectura y navegación; después cambios de catálogo/tasas solo con pruebas autorizadas y respaldo.

## PR #56 — UX de tarifas y referencias de cambio (en revisión)
- Tarifa por concepto: muestra nombre, precio y estado **en modo lectura**, con solo un lápiz SVG discreto por fila. Al editar la fila aparecen **Guardar (disquete)** y **Cancelar (X)**. Solo una fila editable a la vez; cancelar no escribe. Si el servidor rechaza, el formulario permanece abierto.
- **USD 0,01–999,99**, hasta dos decimales: validación de navegador, endpoint y restricción PostgreSQL. El límite aplica a la tarifa de referencia del catálogo, **no convierte retroactivamente** cargos emitidos ni limita tasas en bolívares.
- «Asignar cargos»: campos y botones organizados en dos formularios compactos, distribución responsive sin bloques decorativos.
- Cotizaciones: **ExchangeRate-API no certifica tasa BCV**. Su cotización USD/VES es referencia comercial (usada también por la tarjeta informativa del dashboard; se retiró el fallback falso de 36,50). Una fuente secundaria **bcv.today** reproduce lo publicado por BCV y expone USD/Bs y EUR/Bs con fecha de vigencia. Es un servicio tercero y no un endpoint oficial BCV. EUR es informativo: las obligaciones siguen nominadas en USD, los pagos siguen admitiendo USD, Bs y COP.
- Nuevo endpoint administrativo `GET /api/directiva/cobros/tasas/referencias`: al desplegar la sección «Tasas de cobro», consulta por separado las dos fuentes; **cada proveedor se consulta como máximo una vez por fecha en Caracas** si tuvo éxito, con caché persistente de base de datos y advisory lock contra consultas simultáneas en Vercel. Las referencias fallidas no se guardan; el panel puede continuar con registro manual.
- `POST /api/directiva/cobros/tasas/publicar-bcv` exige sesión Directiva/Admin y confirmación explícita. Solo usa referencia BCV **cacheada para el día local**, con vigencia no futura ni más de siete días anterior; copia importe y fuente a `tasas_cobro` (inmutable), sin manipulación de monto en navegador ni duplicar la misma publicación. No se publican cotizaciones de ExchangeRate-API como BCV.
- Tasas manuales: siguen disponibles para **COP** y respaldo Bs. El registro de tasas BCV para cobros es **una acción consciente de Directiva**, no un ajuste automático invisible.
- El dashboard deja de solicitar una y otra vez la referencia comercial el mismo día; si falla el proveedor o falta clave, muestra «No disponible» y no realiza conversiones usando tasa ficticia. El total equivalente mostrado, cuando existe, es **estimación de mercado**, no conciliación histórica de todos los cambios de cada fecha.

### Migración necesaria (nueva, NO aplicada por el despliegue)
`migrations/2026-11-13_referencias_cambio_cache.sql` es aditiva: crea `referencias_cambio_diarias`, única por (fecha_consulta, proveedor), y la restricción del catálogo `conceptos_cobro_precio_max_999`. No borra ni modifica pagos, tasas, anclas u obligaciones. Primero comprobar respaldo y ejecutar **preflight solo lectura**:

```sql
SELECT
  (SELECT COUNT(*) FROM public.conceptos_cobro
   WHERE monto_referencia_usd < 0.01 OR monto_referencia_usd > 999.99) AS tarifas_fuera_de_rango,
  (SELECT COUNT(*) FROM public.pagos) AS pagos_antes,
  (SELECT COUNT(*) FROM public.obligaciones_cobro) AS obligaciones_antes,
  (SELECT COUNT(*) FROM public.tasas_cobro) AS tasas_antes,
  to_regclass('public.referencias_cambio_diarias') IS NOT NULL AS cache_existente;
```

Debe haber **0 tarifas fuera de rango**. Tras aplicar la migración manual, revisar que el conteo de pagos/obligaciones/tasas sea idéntico, el índice `referencias_cambio_diarias_pkey` esté presente y la restricción `conceptos_cobro_precio_max_999` exista.

No utilizar ninguna fuente comercial para etiquetar «BCV Oficial» ni registrar tasas de cambio sin confirmación. No desplegar antes de aplicar la migración, pues el endpoint de referencia y la tarjeta de tipo de cambio usan la nueva tabla.

## PR #55 — Catálogo, cargos asignados y montos fijos (en revisión)
Este PR reemplaza en el formulario del Representante la elección de cualquier mes por **concepto y cargo concreto pendiente**. Si no hay obligaciones asignadas, no aparece un período ficticio y no puede enviarse el formulario. El historial anterior continúa visible.

**Directiva — Gestión de cobros:** dentro de «Inicio de cobros» puede editar nombre/precio USD/activo de cada concepto; crear nuevos conceptos de tipo manual (código derivado del nombre), asignar inscripción o cargos variables a un atleta habilitado, y emitir la mensualidad del mes actual/siguiente. La emisión exige inicio de cobro configurado y confirmación. La inscripción es única y exige revisión histórica expresa; no se reconstruye el pasado a partir del nombre del mes.

**Precios:** la referencia en `conceptos_cobro.monto_referencia_usd` determina los nuevos cargos; cada `obligaciones_cobro.monto_usd` queda congelado al emitirse. El Representante no edita ningún importe: el servidor calcula la cotización desde el cargo real y rechaza una cifra manipulada. No hay pagos parciales.

**Divisas:** para efectivo USD, monto = nominal USD. En Bs/COP, Directiva debe registrar en `tasas_cobro` la tasa «unidades de moneda por USD», fecha de vigencia y fuente declarada. Cada reporte nuevo guarda `pagos.id_tasa_cobro`; las tasas son inmutables y una corrección crea nueva fila. `GET /api/pagos/cotizacion/:id_obligacion?moneda=Bs&fecha=YYYY-MM-DD` responde el monto a pagar según la tasa de **esa fecha exacta**. Si falta tasa, el botón permanece bloqueado. No se consulta el proveedor externo del dashboard ni se usa el fallback 36,50. La fuente es ingresada por Directiva y no equivale a verificación automática de BCV.

**Migración manual obligatoria antes de fusionar:**
`migrations/2026-11-12_catalogo_y_tasas_cobro.sql`.
Afloja únicamente las restricciones antiguas de códigos fijos y preserva la modalidad de cinco conceptos institucionales; agrega índice único de cargos manuales y la tabla de tasas y FK nullable desde `pagos.id_tasa_cobro`. No modifica ni borra pagos, anclas, obligaciones o precios emitidos. Probada sobre PostgreSQL temporal; **NO se aplica automáticamente en Vercel**. Requiere respaldo, preflight y aprobación del propietario antes de ejecutarla en Supabase. Si Preview comparte Production, **NO probar escritura ni cambiar tarifas desde Preview**.

**Preflight de lectura obligatorio antes de la migración en Supabase:** confirmar que la base objetivo es Production, disponer de un respaldo restaurable y ejecutar:

```sql
SELECT
  to_regclass('public.conceptos_cobro') IS NOT NULL AS catalogo_existente,
  to_regclass('public.obligaciones_cobro') IS NOT NULL AS obligaciones_existentes,
  to_regclass('public.pagos') IS NOT NULL AS pagos_existentes,
  (SELECT COUNT(*) FROM public.conceptos_cobro) AS conceptos_actuales,
  (SELECT COUNT(*) FROM public.obligaciones_cobro) AS obligaciones_actuales,
  (SELECT COUNT(*) FROM public.pagos) AS pagos_antes;
```

```sql
SELECT lower(btrim(nombre)) AS nombre, COUNT(*) AS duplicados
FROM public.conceptos_cobro
GROUP BY lower(btrim(nombre))
HAVING COUNT(*) > 1;
```

La segunda consulta debe regresar **cero filas**, pues la migración crea un índice único por nombre normalizado. Si hay duplicados, **detener la migración** y conciliar el catálogo sin editar directamente obligaciones. Registrar también la distribución de estados y el número de pagos vinculados antes de continuar.

Después de ejecutar el SQL completo, verificar que `public.tasas_cobro` exista, que `public.pagos.id_tasa_cobro` sea nullable, que el índice `conceptos_cobro_nombre_unico` exista y que los conteos de pagos y obligaciones sean idénticos a los anteriores. No crear nuevas tasas, cargos o anclas hasta terminar las pruebas de lectura.

**Despliegue por fases:** Sin migración aplicada, los endpoints administrativos de tasas y nuevas tarifas no funcionan. No fusionar antes de aplicar la migración y validar integridad. Esta versión conserva el endpoint de reporte legado solo para cuentas sin ancla ni cargos, por compatibilidad del historial: **la interfaz no lo expone**. Tras activar y conciliar los atletas, debe retirarse también esa ruta legacy; jamás acepta reportes libres cuando el atleta ya tiene ancla o cargos. El nuevo flujo bloquea monedas sin tasa del día.

**Puntos pendientes:** definir fuente institucional de tasa y responsabilidad de actualización diaria, tratamiento de fechas antiguas, y cuándo deshabilitar totalmente el endpoint legacy. No se activan mensualidades en lote, no se asigna inscripción automática, ni se aplican sanciones automáticas.

## PR #54 — Reportes vinculados a obligaciones (fusionado y validado en Production)
- **Sin migración nueva:** reutiliza `pagos.id_obligacion` y los índices del PR #50. No crea anclas ni nuevas obligaciones automáticamente.
- Representante: en **Mis pagos > Reportar pago**, al elegir un atleta con inicio de cobro u obligaciones existentes se muestra el **cargo concreto** (concepto, período con año e importe nominal USD). No se permite elegir un mes ambiguo ni reportar cargos ya pagados o en revisión; están disponibles vencidos, el período vigente y **como máximo el mes siguiente**. La comprobación definitiva está en el backend.
- Atletas **sin ancla ni obligaciones** conservan el reporte histórico por nombre de mes y montos declarados. El backend bloquea reportes históricos nuevos para atletas ya activados, para evitar que se salte el vínculo por petición manipulada.
- El POST `/api/pagos/reportar` acepta `id_obligacion` únicamente para reportes guiados: valida sesión/rol propietario, atleta activo y representante aprobado, cargo existente del mismo atleta, fecha de emisión, período, fecha de pago, importe, método y comprobante privado como antes. Inserta en transacción con estado `pendiente`.
- En **efectivo USD**, el importe tiene que ser exactamente el nominal de la obligación; no se aceptan pagos parciales. Para Bs/COP se registra el importe *realmente declarado en la moneda entregada*, **sin convertirlo automáticamente ni presentarlo como equivalencia garantizada**.
- Directiva puede aprobar o rechazar solo reportes vinculados `pendientes` mediante `PUT /api/directiva/pago/vinculado/estado`. **Para aprobar Bs/COP** debe confirmar expresamente que revisó manualmente el valor y su equivalencia con el nominal USD; la consulta del dashboard/fallback 36,50 **no se usa**. Esta confirmación es un control transitorio, **no guarda fuente/tasa verificable**: sigue pendiente de definición institucional para una etapa posterior.
- Rechazar conserva el intento y permite uno nuevo. Los aprobados no pueden reabrirse desde el panel. Los reportes vinculados rechazados no se eliminan para preservar el historial; las reglas anteriores de los pagos no vinculados se mantienen.
- Los historiales muestran período y nominal USD para reportes vinculados, sin alterar registros antiguos ni comprobantes Cloudinary.
- Tests: PostgreSQL temporal para propietario, desactivados, mes adelantado, montos USD, concurrencia, 409 por duplicidad, revisión manual, rechazo/reenvío, históricos; Playwright desktop/móvil para selección, bloqueo y modo legado.
- Preview puede compartir la base Production: **no activar anclas ni reportar pagos nuevos durante pruebas manuales**. La prueba completa de escrituras se realiza en PostgreSQL temporal.

## PR #53 — Vista de Estado de cuenta (fusionado y validado en Production)
- El Representante accede a **Mis pagos > Estado de cuenta**, con consulta de obligaciones de sus atletas exclusivamente. Cada fila muestra concepto, período, monto USD, vencimiento, último día del plazo y estado calculado.
- Si no existe ancla u obligación, no se presenta un saldo ficticio ni el mensaje "al día": la pantalla indica que está pendiente de configurar.
- **Solo lectura**: no hace POST, no crea mensuales y no enlaza pagos del formulario antiguo a `id_obligacion`.
- Simplifica el texto del módulo Directiva de conciliación y del formulario antiguo de pagos; los detalles del funcionamiento viven en [GUIA_ESTUDIO_SISTEMA.md](GUIA_ESTUDIO_SISTEMA.md).
- El flujo guiado para reportar pagos vinculados requiere resolver antes moneda, tasa y conciliación. No se debe simular un pago contra obligaciones usando el formulario antiguo.

## PR #52 — Conciliación histórica (fusionado en Production)
La migración del PR #50 y el motor del PR #51 ya están en Production. La directiva verificó en Supabase 5 conceptos, 0 anclas, 0 obligaciones, **16 pagos históricos** (6 pendientes, 8 aprobados, 2 rechazados), y 0 pagos vinculados. Las cuatro comprobaciones de lectura del PR #51 en Production resultaron correctas: representante propietario, representante ajeno, Directiva y visitante sin sesión.

**Esta propuesta no incorpora nuevas tablas ni modifica/importa pagos antiguos.**
- `GET /api/directiva/cobros/conciliacion/atletas`: Directiva/Admin, lista de atletas con estado, ancla existente y conteos por estado de pago; sin exponer datos de representantes ajenos.
- `GET /api/directiva/cobros/conciliacion/atletas/:id_atleta`: Directiva/Admin, detalle de pagos históricos y obligaciones nuevas del atleta; no sirve comprobantes ni datos de archivos, conserva el nombre del mes *sin inferir el año*.
- Sección compacta **Administración > Inicio de cobros**: buscar atleta, revisar movimientos y definir fecha/día de vencimiento. Solo permite registrar el ancla cuando se ha marcado la revisión individual y confirmado expresamente el cambio. La Directiva puede comprobar un pago en **Auditoría de pagos** si requiere el comprobante.
- No permite reemplazar anclas ya registradas, activar atletas inactivos ni representantes no aprobados. **El backend impide configurar inicio anterior al mes actual en Caracas**, para evitar altas retroactivas.
- El formulario no genera obligaciones, no cobra inscripción nuevamente, no activa cobros automáticos, no enlaza registros antiguos ni notifica a representantes.
- `POST /api/directiva/cobros/mensualidades` sigue siendo una API manual del PR #51, **sin botón en esta pantalla**. No ejecutar escrituras contra la base Production para una prueba: trabajar sobre datos sintéticos en un entorno PostgreSQL separado.
- La comprobación del mes sin año es necesariamente humana: la confirmación no prueba cuál era el período; ante dudas, **no activar** hasta conciliar por otro medio.
- Verificación prevista: CI PostgreSQL temporal, Playwright escritorio/móvil y validación humana de lecturas en Preview sin writes en base compartida. No fusionar sin autorización.

## PR #51 — Motor mensual (fusionado y validado en Production)
**Estado:** PR fusionado y desplegado, 184/184 pruebas backend y 104/104 interfaz en CI. Endpoints de consulta validados manualmente (4/4), migración previamente ejecutada en Supabase por el propietario. Reutiliza las tablas del PR #50 sin añadir migración propia ni ejecutar débitos.

### API y control de acceso
- `GET /api/pagos/obligaciones/:id_atleta`: usuario autenticado; representantes solo consultan atletas propios, Directiva/Staff/Admin pueden consultar. Nunca exponer datos de otra familia.
- `GET /api/directiva/cobros/atletas/:id_atleta`: consulta administrativa.
- `POST /api/directiva/cobros/anclas/:id_atleta`: **solo Directiva/Admin**, cuerpo JSON `{"fecha_inicio":"2026-11-01","dia_ancla":15,"historial_revisado":true}`. La fecha no se deduce de `pagos.mes_pagado`; quien activa confirma que revisó el historial y estableció una fecha que no duplica mensualidades ya pagadas. Solo atleta activo con representante aprobado. Una vez creada el ancla no puede sobreescribirse sin proceso de conciliación.
- `POST /api/directiva/cobros/mensualidades`: **solo Directiva/Admin**, cuerpo JSON `{"id_atleta":11,"periodo_mes":"2026-11-01","confirmar":true}`. Genera una única obligación para ese atleta y mes, con importe de catálogo congelado, fechas según su ancla, origen y creador. La misma petición repetida devuelve la obligación existente sin duplicarla. El motor serializa por atleta y el índice SQL actúa como defensa final.
- Las escrituras solo permiten mes actual o siguiente en **America/Caracas**, nunca meses antiguos; no se crean saldos retroactivos, inscripción ni cargos variables en esta etapa.
- Si el vencimiento del primer período es anterior a la `fecha_inicio` configurada, se rechaza esa mensualidad; no se inventa prorrateo.
- El estado de consulta se **deriva** de comprobantes vinculados: `pagada`, `en_revision`, `pendiente`, `en_plazo` o `morosa`. La mora se calcula a partir de la fecha límite, sin penalizaciones económicas.
- No se modifican los `pagos` históricos. Como el formulario anterior aún no está vinculado a `id_obligacion`, seguirá funcionando en paralelo hasta el próximo bloque. **No activar gestión de cobros al público antes de integrar el reporte guiado y conciliar los registros existentes.**

### Validación
- Pruebas unitarias: calendario civil Caracas, cambio de año, febrero bisiesto y días 29–31, plazo de gracia.
- PostgreSQL temporal: ancla única, concurrencia e idempotencia, precios congelados, propiedad de atletas, representante inhabilitado, preservación de pagos históricos, sin nueva migración.
- Prueba manual recomendada en Preview/local con atleta sintético y respaldo: comprobar `GET` sin mutaciones en Production y los `POST` **solo en entorno aislado**. La API aún no tiene controles de UI ni conciliación histórica asistida.
- Revisar el CI del PR antes de merge. No fusionar ni desplegar sin autorización expresa.

## Estado de implementación
La migración base `migrations/2026-11-12_cuentas_por_cobrar_base.sql` **ya se aplicó manualmente en Supabase Production** después de respaldo y preflight, con datos históricos conservados. El PR #51 añadió el motor de obligaciones; el PR #52 propone su interfaz de revisión y configuración individual sin generar deudas automáticamente. Nada convierte registros históricos sin año.

## Reglas institucionales comunicadas
- Inscripción: USD 15, una vez por atleta al entrar, nunca por temporada. Para atletas existentes, comprobar si ya pagaron antes de generar un cargo: no inferir por ausencia de comprobante.
- Mensualidad: USD 15 por atleta, nominal en USD. El importe se congela en `obligaciones_cobro.monto_usd` al crear cada obligación.
- Fecha ancla individual: el caso comunicado (pago 15 de octubre) tiene próximo vencimiento el 15 de noviembre; el representante puede pagar hasta el 30 de noviembre sin entrar en mora. El **día de pago efectivo no cambia automáticamente el ancla**. El día 29, 30 o 31 se ajustará al último día de los meses más cortos (regla propuesta, pendiente de aprobación).
- Para una mensualidad con vencimiento el día D de mes M, `periodo_mes` identifica el primer día de M y `fecha_limite` el último día de M. El estado de morosidad se calcula si `hoy > fecha_limite` y sigue sin aprobar. No borrar obligaciones ni aumentar automáticamente su importe por mora.
- Torneo USD 40, arbitraje USD 9/juego y sanción USD 10 son **referencias**; la directiva decide cada cargo con importe concreto. No programar sanciones. Uniformes son pedidos externos y **no** son conceptos de deuda del club.
- No suspender al representante por deuda; cualquier inactivación deportiva requiere decisión separada.

## Transiciones propuestas para los siguientes PR
1. Obligación creada = pendiente; si está vencida en la fecha ancla pero dentro del plazo mensual, mostrar “En plazo”.
2. Reporte válido del representante = pago `pendiente` y obligación “En revisión”; se impide otro reporte simultáneo.
3. Directiva aprueba = pago `aprobado`, obligación “Pagada”.
4. Directiva rechaza = pago `rechazado`, obligación vuelve a “Pendiente” con posibilidad de nuevo reporte. Mantener trazabilidad del rechazo y de cada intento; no borrarlos en el nuevo flujo.
5. Los reportes históricos sin `id_obligacion` se mantienen. Conciliarlos individualmente antes de generar deuda retrospectiva para evitar doble cobro; nunca interpretar `mes_pagado` sin año como prueba suficiente.
6. En una primera versión proponer pago total por obligación; pagos parciales y múltiples obligaciones en una sola transacción quedan pendientes de decisión. No implementarlos sin definir la política.

## Tasas / moneda
- USD como valor base congelado; pagos pueden registrarse con moneda de pago, tasa aplicada, fuente y fecha verificable. No convertir con el valor fijo `36.50`.
- `controllers/directivaController.js` hoy consulta exchangerate-api.com con nombre “BCV” y fallback 36.50. Esta migración **no** modifica esa visualización histórica. Antes de publicar el flujo nuevo, separar tasa informativa de tasa oficial validada y eliminar el fallback ficticio en cálculos de cobro.
- Definir explícitamente fuente oficial, día de referencia, redondeo, monedas aceptadas y cómo tratar efectivo antes del PR de reporte guiado.

## Esquema base
- `conceptos_cobro`: catálogo extensible de conceptos institucionales y montos de referencia, USD.
- `anclas_cobro_atleta`: fecha de inicio y día de vencimiento individual; inicialmente vacía.
- `obligaciones_cobro`: cada deuda conserva concepto, atleta, período cuando es mensualidad, USD congelados, vencimiento, fecha límite y procedencia.
- `pagos.id_obligacion`: nullable para conservar históricos. FK compuesta asegura que el pago esté vinculado a una obligación del mismo atleta.
- Índices únicos: una inscripción por atleta, una mensualidad por atleta/mes, máximo un reporte `pendiente` o `aprobado` por obligación. Evitan dobles reportes concurrentes, pero el backend también deberá validar roles, fechas y estados en transacciones.
- La condición de `pagos.estado_pago` histórico y el permiso de borrar pagos rechazados no se alteran aún; la etapa posterior debe endurecer cambios de estado para registros vinculados (transiciones autorizadas y auditoría), y mantener la política histórica de eliminación separada.

## Preflight y validación antes de aplicar
Comprobar en el entorno destino las tablas `usuarios`, `atletas` y `pagos`, sus PK y tipo de `pagos.id_atleta`, índices y constraints existentes. Respaldar base y confirmar que no hay objetos con los nuevos nombres. Probar la migración primero en PostgreSQL temporal; después inspeccionar tablas, 3 índices únicos y FK; comprobar que el recuento y las filas de `pagos` no cambian. Jamás ejecutar migraciones por inicio de servidor.
La migración no hace backfill y requiere aprobación explícita antes de Supabase.

## Siguientes PR
1. PR base: migración, contrato, documentación; sin cambios de comportamiento.
2. Motor mensual: generación idempotente por atleta/período, ancla y alta de inscripción; previa conciliación de históricos, política de inicio, primer período y pagadores.
3. Panel representante: obligaciones elegibles, máximo siguiente período autorizado, reporte único guiado con monto fijo, estados y comprobantes privados.
4. Panel directiva: transiciones con control de concurrencia, morosidad real, filtros, WhatsApp manual sin envíos automáticos.
5. Cargos manuales; uniformes más adelante como pedidos externos.

## Pruebas de aceptación futuras
- Alta de inscripción única; segundo intento no la duplica.
- Fecha de ancla 15: vence 15/11, límite 30/11; pago el 28 no cambia 15/12.
- Dos reportes concurrentes sobre una obligación: solo uno persiste como activo.
- Rechazo y reenvío no dejan dos reportes activos; aprobación bloquea reenvío.
- Representante ajeno = 403; sin sesión = 401; archivos Cloudinary `authenticated` con firma temporal y compatibilidad histórica.
- Fecha civil en America/Caracas; meses con febrero/bisiesto; precios futuros no alteran pasados.
- Tests PostgreSQL temporal, CI Node 22 y Playwright escritorio/móvil antes de un cambio funcional.
