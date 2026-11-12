# Cuentas por cobrar — contrato inicial (12-11-2026)

## PR #53 — Vista de Estado de cuenta (en revisión)
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
