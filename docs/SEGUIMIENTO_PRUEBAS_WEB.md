# Seguimiento de las pruebas del propietario — fechas, planillas y próximos bloques

Fecha: 2026-11-04. Base remota verificada: `main` `39960c1` (PR #11 fusionado), árbol `c01b337f`; Vercel Production completado (deployment `7555067963`). El propietario confirma fechas/identidades y, después del PR #10, generación correcta de las planillas que fallaban y de una nueva. Bloque de sesiones del [PR #11](https://github.com/josentss/jaguares/pull/11) desplegado; comprobaciones autenticadas del propietario pendientes.

## Resultados comunicados por el propietario

Inscripciones funcionales en ambos paneles, cédulas propias/heredadas y avisos de validación; hermanos heredan correctamente la cédula actual del representante. También funcionan aprobación de cuentas/atletas, exclusión de inactivos, reportes efectivo/transferencia, comprobantes, aprobación/rechazo de pagos, sesiones y comportamiento móvil. El intento de pago desde una pestaña antigua tras inactivar al atleta recibe el conflicto esperado. En el uso habitual, cada representante ve su información.

Esto es confirmación manual del propietario, no una auditoría completa de seguridad, del esquema productivo ni de todos los escenarios. No se copian nombres, correos, cédulas, teléfonos, archivos personales o capturas del reporte a este documento.

## Diagnóstico priorizado y secuencia de bloques

| Prioridad / bloque | Hallazgo | Estado y causa | Tratamiento |
| --- | --- | --- | --- |
| 1 — completado (PR #9) | Nacimientos y pagos se muestran un día antes | **Reproducido.** `pg` convierte DATE a `Date`; el JSON y `new Date(...).toLocaleDateString` dependen de los husos de servidor/navegador. No hay código que reste un día para resolver duplicados. | DATE como texto civil en el pool; formato civil sin desplazamiento. Los instantes conservan su significado. |
| 1 — completado (PR #9) | Alta de menores de cinco años | **Confirmado.** Regla anterior de PR #4 permitía 0–18 años. El propietario precisa mínimo cinco, máximo dieciocho. | Nuevas inscripciones: 5–18 años cumplidos hoy en Caracas. Misma regla en API y ambos formularios. No asignar categorías ni fijar años absolutos. |
| 1 — completado (PR #9) | Atletas visualmente iguales dentro de una familia | La repetición exacta ya devolvía 409. **Reproducidos otros dos escapes:** Unicode equivalente y reparto del mismo nombre completo entre nombres/apellidos. La captura por sí sola no prueba que se enviara exactamente la misma fecha. | Comparar nombre completo NFC, espacios y mayúsculas normalizados, misma fecha y representante, dentro del bloqueo/transacción existente. |
| 2 — completado (PR #10) | PDF incompleto/recortado | Captura dependiente del diseño del panel/modal y paginación inestable. Durante las pruebas de la corrección, fijar el viewport a `794px` también recortaba horizontalmente en escritorio. El iframe de impresión original usaba ancho cero y activaba la vista móvil. | Documento A4 estable, recursos con fallback y paginación; impresión con iframe de 794px. CI final satisfactorio en [run 41582920053](https://github.com/josentss/jaguares/actions/runs/41582920053); propietario confirma generación correcta tras desplegar. |
| 3 — desplegado; prueba manual pendiente | Entrada y cierre de sesión en ambos paneles | **Reproducido antes de corregir:** contenido visible antes de `/api/auth/me`; con logout 503 redirigía al login y conservaba cookie sintética. Ambos paneles, escritorio/móvil; no se demostró fuga de datos. | PR #11 fusionado y desplegado; CI aprobado y navegación anónima comprobada. Pendiente la comprobación autenticada del propietario. |
| 4 | Eventos: límites y hora | **Confirmados:** fecha sin `min` y hora ausente. El backend compara una medianoche UTC con el instante actual; rechaza hoy y normaliza fechas imposibles. | Validación civil estricta en Caracas y límites nativos. Después, hora con contrato y migración aditiva revisados; no inventar hora para eventos históricos. |
| 5 — requiere política oficial | Deudas y mensualidad fija | El propietario solicita para una fase posterior: importe mensual fijo, conversión automática a la moneda elegida y mostrar solo lo que el representante debe. **No implementarlo ahora.** | Acordar tarifa, vigencia, fuente/tasa y momento de conversión, períodos y excepciones antes de modelar cargos/deudas; conservar historial. |

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

Verificación local final: **74/74 backend y 31/31 navegador** en Node **24.15.0** y **22.23.4**, 105 escenarios distintos repetidos para compatibilidad, sin fallos ni omisiones. Sintaxis de **40 JS** y scripts inline de ambos paneles/login correcta en ambas versiones; `git diff --check` correcto. PostgreSQL **18** temporal local y Chromium **141**/Playwright **1.56.1**; servidor UTC, cuatro husos del proceso y navegadores Caracas/UTC/Tokio. Incluye HTML/JS, API, cookies/roles y SQL reales desde inscripción hasta pagos/listados/planilla. Cloudinary y la tasa externa se simulan únicamente en sus fronteras. No son pruebas autenticadas en producción ni una comprobación de los proveedores reales. PostgreSQL temporal detenido.

[CI remoto 41563276506](https://github.com/josentss/jaguares/actions/runs/41563276506), sobre `5772beb`: satisfactorio, logs revisados. Node **22.23.4**, PostgreSQL **16** temporal; sintaxis/instalación correctas, **74 backend + 31 navegador**, sin fallos ni omisiones.

No se ejecutan migraciones, consultas privadas o escrituras sobre Supabase/Cloudinary de producción. El cambio del parser aplica a columnas de tipo **DATE**; si el esquema real usa TIMESTAMP para alguna de estas fechas, requiere diagnóstico aparte. No se cambia DATE[] ni el protocolo binario; no se encontró uso en las consultas actuales.

No se corrigen automáticamente fechas antiguas ni se borran duplicados: una futura auditoría autorizada deberá distinguir un error de presentación de una fecha realmente guardada de forma incorrecta. Las nuevas reglas de edad no desactivan ni impiden consultar/pagar por atletas históricos que no cumplan el nuevo intervalo.

Riesgos previos que permanecen: constraints reales/escritores externos sin auditar; bloqueo cooperativo; privacidad/validación de archivos, dependencias y consistencia Cloudinary/SQL. Los controles de importe existentes siguen vigentes; todavía no representan una tarifa institucional ni una deuda calculada.

## Matriz de aceptación manual de fechas — PR #9 ya desplegado

- [ ] En ambos paneles, el calendario de nacimiento limita nuevas altas a 5–18; probar cumpleaños de cinco, día previo a cumplir cinco, dieciocho y diecinueve.
- [ ] Registrar un atleta de prueba; comparar nacimiento enviado, lista y planilla después de recargar. Debe conservar el día.
- [ ] Reintentar misma familia + nombre completo + nacimiento con otra cédula o heredada: conflicto, una sola ficha. Probar también Unicode equivalente y distinto reparto de los campos.
- [ ] Otro hijo con nombre diferente, otra familia con coincidencia o fecha distinta legítima: permitir sin cambiar el nacimiento.
- [ ] Efectivo y transferencia de prueba con fecha 02/11/2026: historial y directiva muestran 02/11/2026; comprobar aprobación/rechazo.
- [ ] Repetir en móvil; comprobar que corregir datos inválidos y cambiar propia/heredada continúa enviando.

El PDF y la impresión están incorporados en `main` mediante PR #10; CI y despliegue confirmados, generación validada manualmente por el propietario. Sesiones está en una rama de revisión; hora/validación de eventos y finanzas siguen pendientes.

## Estado del bloque y entrega — 2026-11-03

- PR #9 está fusionado en `main` (`52cd290`); el registro de Vercel indica Production satisfactorio y el propietario confirma manualmente el resultado. No se ejecutaron formularios autenticados contra producción.
- PR #10 está fusionado en `3ff6923`, Production `7511100715` completado y [CI final 41582920053](https://github.com/josentss/jaguares/actions/runs/41582920053) satisfactorio. El propietario confirma generación correcta de las planillas antes defectuosas y una nueva.
- El PDF usa ancho A4 independiente del móvil, espera recursos, reemplaza imágenes fallidas, evita partir filas y recorta la banda blanca sobrante. La impresión dejó de usar iframe de ancho cero y el disparador es idempotente. La referencia anterior al viewport fijo de 794px corresponde a una prueba intermedia de la corrección, no a una opción explícita del código previo al PR.
- Verificación: 22/22 pruebas navegador en Node 24.15.0 y 22.23.4 (incluye PDF real multipágina parseado/renderizado por PDF.js y la impresión A4); 36/36 backend sin PostgreSQL en ambas versiones; sintaxis de 41 JavaScript y el script inline del panel en ambas versiones.
- **Limitación local comprobada:** PostgreSQL 18 temporal no pudo iniciar porque el entorno negó enlazar `127.0.0.1` (`Permission denied`). No se ejecutaron localmente `pagos-pg`, `integridad-pg` ni `flujos-web-pg`; esas pruebas terminaron satisfactoriamente en el CI con PostgreSQL 16 ([run 41582615224](https://github.com/josentss/jaguares/actions/runs/41582615224)). No se accedió ni escribió en Supabase de producción.
- La fase financiera sigue pendiente: monto fijo, conversión de moneda seleccionada y deuda individual son únicamente una solicitud futura, no reglas aprobadas.

### Matriz de aceptación manual del PDF — PR #10 ya desplegado

- [ ] Abrir la misma ficha en directiva en escritorio y móvil; Descargar PDF debe mantener nombre, nacimiento, contacto, dirección, observaciones y datos del representante completos, con columnas legibles y sin recortes.
- [ ] Probar una ficha con fotografía disponible y otra sin foto o con recurso fallido: la ficha debe descargarse y conservar un espacio de foto legible.
- [ ] Revisar que fichas de varias páginas continúen hasta el último dato y que no aparezca una página vacía al final.
- [ ] Imprimir desde escritorio y móvil; la impresión debe conservar la distribución de dos columnas y el contenido completo.
- [ ] Si un navegador no permite generar el PDF, repetir una vez después de recarga completa y registrar dispositivo, acción y mensaje sin compartir datos personales.

La confirmación del propietario cubre la generación de las fichas indicadas; las casillas detalladas no se marcan automáticamente como realizadas.

## Revisión posterior al PR #10 — siguiente bloque propuesto

Reproducción local con Playwright/Chromium, HTML real de `main`, APIs y cookie sintéticas, cuatro combinaciones (directiva/representante × escritorio/móvil):

1. Retener `/api/auth/me`: `.main-content` permanece visible antes de autorizar. Resolver con 401: redirige al login.
2. Autorizar una cuenta sintética y responder 503 al POST de logout: redirige al login igualmente y conserva la cookie HttpOnly sintética. El controlador de logout elimina la cookie en una respuesta exitosa; el cliente ignora la respuesta fallida.

No se usaron JWT ni usuarios reales, ni se arrancó la aplicación con conexiones productivas. Esta reproducción no comprueba autorización backend ni explotación contra producción. La restauración desde caché del navegador y las pestañas concurrentes siguen pendientes.

## Bloque de sesiones — desplegado, prueba autenticada pendiente

**Retorno del propietario (2026-11-04):** entrada y permisos observados correctos; recargar conserva la sesión. La observación de dos ventanas abiertas ocurrió sin pulsar «Cerrar sesión», por lo que no demuestra un fallo del cierre. La propuesta posterior de una sola ventana fue descartada por el propietario antes de implementarse. La decisión vigente permite varias pestañas, ventanas y navegadores, con cierre por 15 minutos de inactividad y aviso previo.

**Aviso blanco reproducido:** en Chromium local y ambos paneles el contenedor de sesión mide 852 px en escritorio y 796 px en móvil por el estiramiento del contenedor flex; una corrección experimental aplicada solo al navegador lo reduce a unos 76 px. El HTML se entrega estático antes de comprobar sesión; las API ya autorizan en servidor. Se propone validar el HTML antes de servirlo y evitar el aviso visible en la entrada normal. Sin cambios funcionales ni escrituras productivas en esta revisión. La prueba local existente de cierre entre pestañas pasó (1/1, API sintética); no sustituye el test manual del propietario.

- Los paneles se mantienen ocultos hasta comprobar sesión y rol. Si falla la verificación o su recurso JavaScript, se ofrece reintentar; el ocultamiento inicial funciona aun si falla la hoja de estilos o JavaScript está desactivado.
- Al recuperar una pestaña o restaurarla desde caché se ocultan los datos mientras se revalida la sesión; un 401 protegido o el cierre en otra pestaña conduce al login. Al cerrar sesión se verifica la respuesta, se evita enviar dos solicitudes y se mantiene el panel si no pudo confirmarse el cierre.
- Express responde `Cache-Control: no-store` para los HTML de panel y las API. El login y los formularios de perfil/pago dejan de depender de guardar el usuario en `localStorage`; el servidor conserva la validación y los permisos.
- **Evidencia local:** 41/41 pruebas backend sin PostgreSQL y 49/49 de navegador en Node 22.23.4 y 24.15.0, incluidas 27 de sesiones; una prueba adicional de recuperación tras error de revalidación se ejecutó por separado en cada versión. Sintaxis de 43 JS y scripts inline en ambas versiones.
- **CI:** la [primera ejecución](https://github.com/josentss/jaguares/actions/runs/41594079402) aprobó backend y falló una prueba móvil por consultar el menú antes de terminar la validación de sesión. Se corrigió la espera y se añadieron casos de navegación y revalidación lenta. El [CI final](https://github.com/josentss/jaguares/actions/runs/41873432620) aprobó 79/79 backend y 63/63 navegador con Node 22 y PostgreSQL 16, sin omisiones.
- **Producción:** el registro Vercel confirmó el despliegue de `39960c1`; portada, paneles y cliente API respondieron 200 y `/api/auth/me` respondió 401 sin sesión. Se verificó `no-store` en ambos paneles y esa respuesta API; cinco recursos coincidieron con Git. Chromium anónimo comprobó ambos paneles en escritorio/móvil: contenido oculto durante una verificación demorada y redirección al login. No se probaron cuentas ni formularios autenticados en producción.
- **Limitaciones:** PostgreSQL 18 temporal no pudo iniciar por permiso denegado al enlazar loopback, incluso con la ejecución autorizada fuera del sandbox. Las suites PostgreSQL y flujos completos se ejecutan en CI. La restauración desde caché se ejercitó mediante eventos simulados y una navegación atrás real en Chromium; las políticas de caché varían entre navegadores.
- Cerrar sesión elimina la cookie en este navegador, pero no revoca un JWT ya copiado que siga vigente. La señal inmediata entre pestañas depende de `localStorage`; el backend y la revalidación siguen protegiendo las solicitudes. No se alteró Supabase de producción ni se aplicaron migraciones.

**Seguimiento local de la rama `fix/acceso-servidor-inactividad`:** autorización del HTML antes de `express.static`, credencial de actividad de 15 minutos y aviso previo. Resultado final: 55/55 backend sin PostgreSQL y 59/59 navegador en Node 22.23.4 y 24.15.0; 46 JS con sintaxis correcta. PostgreSQL y el flujo real de dos navegadores quedan para el CI con PostgreSQL 16 antes de fusionar.

Después de revisar este bloque: fechas civiles de eventos y hora en otro bloque con migración aditiva. La validación real/privacidad de archivos y dependencias siguen como auditoría prioritaria. Finanzas permanece aplazada.
