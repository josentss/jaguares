# Seguimiento de las pruebas del propietario — bloque de fechas e identidades

Fecha: 2026-11-02. Base remota verificada: `main` `d6d8c38` (PR #8 fusionado), Vercel Production completado. Rama de trabajo: `fix/fechas-duplicados-atletas`. Este bloque no está fusionado ni desplegado.

## Resultados comunicados por el propietario

Inscripciones funcionales en ambos paneles, cédulas propias/heredadas y avisos de validación; hermanos heredan correctamente la cédula actual del representante. También funcionan aprobación de cuentas/atletas, exclusión de inactivos, reportes efectivo/transferencia, comprobantes, aprobación/rechazo de pagos, sesiones y comportamiento móvil. El intento de pago desde una pestaña antigua tras inactivar al atleta recibe el conflicto esperado. En el uso habitual, cada representante ve su información.

Esto es confirmación manual del propietario, no una auditoría completa de seguridad, del esquema productivo ni de todos los escenarios. No se copian nombres, correos, cédulas, teléfonos, archivos personales o capturas del reporte a este documento.

## Diagnóstico priorizado y secuencia de bloques

| Prioridad / bloque | Hallazgo | Estado y causa | Tratamiento |
| --- | --- | --- | --- |
| 1 — actual | Nacimientos y pagos se muestran un día antes | **Reproducido.** `pg` convierte DATE a `Date`; el JSON y `new Date(...).toLocaleDateString` dependen de los husos de servidor/navegador. No hay código que reste un día para resolver duplicados. | DATE como texto civil en el pool; formato civil sin desplazamiento. Los instantes conservan su significado. |
| 1 — actual | Alta de menores de cinco años | **Confirmado.** Regla anterior de PR #4 permitía 0–18 años. El propietario precisa mínimo cinco, máximo dieciocho. | Nuevas inscripciones: 5–18 años cumplidos hoy en Caracas. Misma regla en API y ambos formularios. No asignar categorías ni fijar años absolutos. |
| 1 — actual | Atletas visualmente iguales dentro de una familia | La repetición exacta ya devolvía 409. **Reproducidos otros dos escapes:** Unicode equivalente y reparto del mismo nombre completo entre nombres/apellidos. La captura por sí sola no prueba que se enviara exactamente la misma fecha. | Comparar nombre completo NFC, espacios y mayúsculas normalizados, misma fecha y representante, dentro del bloqueo/transacción existente. |
| 2 — siguiente | PDF incompleto/recortado | **Reportado por el propietario.** Exportación del DOM responsive del modal con html2pdf `avoid-all`, sin preparación explícita de ancho/fuentes/imágenes. La causa concreta del recorte requiere reproducción. | Bloque separado: documento de exportación estable, paginación y pruebas reales de PDF con contenido largo, escritorio/móvil y recursos fallidos. No marcar corregido en este bloque. |
| 3 | Pantallazo del panel sin sesión | **Confirmado en código:** HTML estático visible antes de resolver `/api/auth/me`. Las APIs conservan permisos y los datos se solicitan tras autenticar; el pantallazo no demuestra fuga de datos. | Ocultar contenido hasta validar sesión/rol y comprobar retrasos, errores, navegación atrás y cierre de sesión. |
| 4 | Eventos: límites y hora | **Confirmados:** fecha sin `min` y hora ausente. El backend compara una medianoche UTC con el instante actual; rechaza hoy y normaliza fechas imposibles. | Validación civil estricta en Caracas y límites nativos. Después, hora con contrato y migración aditiva revisados; no inventar hora para eventos históricos. |
| 5 — requiere política oficial | Deudas, mensualidad fija y selector de períodos | Solicitud funcional válida, **pendiente de definición** de tarifa, moneda, vigencia, períodos y excepciones. No es una corrección aislada del calendario. | Modelo de cargos/deudas y cálculo del servidor, con historia; PR separado después de acordar reglas. |

Los eventos cancelados/completados permanecen en administración y salen del calendario público: conservar ese historial es coherente. Los controles nativos de fecha pueden mostrar años deshabilitados aunque `min/max` impidan seleccionarlos; no hace falta crear otro calendario para aplicar límites.

## Correcciones de este bloque

- `config/db.js`: parser de texto PostgreSQL DATE/OID 1082 aislado al pool. Los campos DATE se devuelven como `YYYY-MM-DD`. No modificar los parsers globales ni los timestamps.
- `public/admin/fechas.js`: formato de fechas civiles, día de Caracas, límites de nacimiento y formato separado de instantes. Ambos paneles muestran el día original en nacimiento, planilla, pagos y fechas de eventos; la tasa externa se sigue tratando como instante.
- `utils/validators.js` y `controllers/atletaController.js`: mínimo cinco y máximo dieciocho años cumplidos para las nuevas altas, incluso llamando directamente a la API.
- Validador/navegador: límites dinámicos al cargar, enfocar y validar, con fronteras de cumpleaños/bisiestos. Respaldo si no carga el helper, sin dejar botones inoperantes. Los recursos cambiados tienen versión nueva.
- `utils/inscripcion.js`: consulta parametrizada de candidatos por familia y fecha, comparación del nombre completo normalizado. Conserva tildes; no usa coincidencia aproximada ni compara entre representantes. No fusiona ni elimina filas históricas.
- CI incorpora pruebas de fechas y mantiene Node 22/PostgreSQL 16 y el lockfile de la aplicación.

Ejemplo calculado para **02/11/2026 en Caracas**: nacimientos admitidos del **03/11/2007 al 02/11/2021**, incluidos ambos extremos. Mañana el intervalo cambia. Esto es edad de inscripción; las temporadas y categorías competitivas siguen pendientes.

## Evidencia y límites

Antes de cambiar backend, las regresiones PostgreSQL reprodujeron ambos escapes de duplicados (dos éxitos donde debía haber un conflicto), aceptación de cuatro años y DATE como objeto `Date`. La repetición exacta ya quedaba bloqueada, sin cambiar el nacimiento. Las pruebas unitarias nuevas también fallaron inicialmente por edad y contrato DATE.

Verificación local final: **74/74 backend y 31/31 navegador** en Node **24.15.0** y **22.23.4**, 105 escenarios distintos repetidos para compatibilidad, sin fallos ni omisiones. Sintaxis de **40 JS** y scripts inline de ambos paneles/login correcta en ambas versiones; `git diff --check` correcto. PostgreSQL **18** temporal local y Chromium **141**/Playwright **1.56.1**; servidor UTC, cuatro husos del proceso y navegadores Caracas/UTC/Tokio. Incluye HTML/JS, API, cookies/roles y SQL reales desde inscripción hasta pagos/listados/planilla. Cloudinary y la tasa externa se simulan únicamente en sus fronteras. No son pruebas autenticadas en producción ni una comprobación de los proveedores reales. CI remoto pendiente de registrar.

No se ejecutan migraciones, consultas privadas o escrituras sobre Supabase/Cloudinary de producción. El cambio del parser aplica a columnas de tipo **DATE**; si el esquema real usa TIMESTAMP para alguna de estas fechas, requiere diagnóstico aparte. No se cambia DATE[] ni el protocolo binario; no se encontró uso en las consultas actuales.

No se corrigen automáticamente fechas antiguas ni se borran duplicados: una futura auditoría autorizada deberá distinguir un error de presentación de una fecha realmente guardada de forma incorrecta. Las nuevas reglas de edad no desactivan ni impiden consultar/pagar por atletas históricos que no cumplan el nuevo intervalo.

Riesgos previos que permanecen: constraints reales/escritores externos sin auditar; bloqueo cooperativo; privacidad/validación de archivos, dependencias y consistencia Cloudinary/SQL. Los controles de importe existentes siguen vigentes; todavía no representan una tarifa institucional ni una deuda calculada.

## Aceptación manual tras una futura fusión/despliegue autorizado

- [ ] En ambos paneles, el calendario de nacimiento limita nuevas altas a 5–18; probar cumpleaños de cinco, día previo a cumplir cinco, dieciocho y diecinueve.
- [ ] Registrar un atleta de prueba; comparar nacimiento enviado, lista y planilla después de recargar. Debe conservar el día.
- [ ] Reintentar misma familia + nombre completo + nacimiento con otra cédula o heredada: conflicto, una sola ficha. Probar también Unicode equivalente y distinto reparto de los campos.
- [ ] Otro hijo con nombre diferente, otra familia con coincidencia o fecha distinta legítima: permitir sin cambiar el nacimiento.
- [ ] Efectivo y transferencia de prueba con fecha 02/11/2026: historial y directiva muestran 02/11/2026; comprobar aprobación/rechazo.
- [ ] Repetir en móvil; comprobar que corregir datos inválidos y cambiar propia/heredada continúa enviando.

Los problemas de PDF, entrada visual al panel, hora/validación de eventos y finanzas continúan pendientes de sus respectivos bloques.
