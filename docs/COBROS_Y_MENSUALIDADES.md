# Cuentas por cobrar — contrato inicial (12-11-2026)

## Estado de implementación
Este documento especifica el bloque que sigue al PR #49. La migración `migrations/2026-11-12_cuentas_por_cobrar_base.sql` **solo prepara la base**; NO crea obligaciones para atletas, NO activa cobro, NO cambia API, NO toca interfaz, NO convierte registros históricos. Se ejecutará manualmente en el destino autorizado tras respaldo e inspección del esquema efectivo.

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
