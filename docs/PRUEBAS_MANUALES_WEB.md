# Pruebas manuales web — Jaguares tras PR #9

Fecha de actualización: 2026-11-03. Versión objetivo: `main` remoto `52cd290b03f3ac34df280d6d8f97b2c2d687249d`.
Esta es una guía para ejecutar; sus casillas no significan que las pruebas autenticadas se hayan realizado.

**Actualización tras PR #9:** PR #9 está fusionado en `52cd290`, CI 105/105 y Vercel Production completado. El propietario confirma manualmente el bloque de fechas e identidades. El nuevo bloque de PDF/impresión está en una rama separada y todavía no está desplegado; sus comprobaciones automáticas están en `tests/planilla-pdf.test.js`.

**Resultados recibidos del propietario:** inscripciones, fechas/identidades del PR #9 y recorridos habituales satisfactorios. Los problemas restantes —PDF, entrada visual y eventos— se corrigen en bloques separados. La mensualidad fija, conversión de moneda y vista de deuda quedan guardadas para una fase financiera posterior, sin aplicar ahora.

## Recorrido corto después de la corrección

Abrir la web con recarga completa (Ctrl+F5). Usar representante y directiva en perfiles de navegador separados, y recursos de pruebas para las operaciones que crean o modifican datos. Marcar cada casilla solo después de comprobar su resultado.

- [ ] **1. Inscribir con cédula propia:** registrar desde representante → aparece una sola vez, en espera y sigue allí tras recargar.
- [ ] **2. Mostrar y corregir errores:** escribir cédula/teléfono inválidos y dirección `2356` → mensaje visible; corregir → permite guardar.
- [ ] **3. Cambiar a heredada:** después de datos inválidos, elegir heredar cédula/teléfono → permite registrar, sin quedar bloqueado.
- [ ] **4. Registrar otro hijo:** repetir con otro nombre después del primer éxito → guarda otro atleta y su identificación heredada es distinta.
- [ ] **5. Evitar duplicados:** reenviar el mismo atleta → conflicto, sin otra ficha.
- [ ] **6. Directiva, ambas opciones:** probar cédula propia y heredada con representante existente → atleta activo, asociado a la familia correcta.
- [ ] **7. Representante nuevo:** crear cuenta y atleta desde directiva → ambos existen relacionados y esa cuenta puede entrar.
- [ ] **8. Cuenta pendiente y perfil:** registro público → login bloqueado hasta aprobación; aprobar, entrar, completar perfil → permite inscribir un atleta en espera.
- [ ] **9. Datos y documentos:** abrir planilla, archivos y PDF → corresponden al atleta y conservan fechas/textos enviados.
- [ ] **10. Activar y pagar:** aprobar atleta en espera → aparece en selector de pago; efectivo y transferencia con comprobante → pagos pendientes en historial.
- [ ] **11. Validar y cambiar método:** monto cero/negativo o captura ausente → rechazo claro; corregir o cambiar de método → permite enviar sin errores ocultos.
- [ ] **12. Auditar pago:** aprobar/rechazar desde directiva → el representante ve el mismo estado y la notificación correspondiente.
- [ ] **13. Inactivar con pestaña antigua:** dejar abierto el pago, inactivar atleta y enviar desde la vista antigua → rechazo, sin pago nuevo.
- [ ] **14. Perfil y permisos:** guardar/recargar perfil; otra familia no puede consultar sus fichas/pagos/documentos por API. Usar solo IDs de prueba conocidos.
- [ ] **15. Calendario y sesión:** crear/cancelar evento de prueba → consulta pública se actualiza; cerrar sesión → los paneles exigen volver a entrar.
- [ ] **16. Móvil:** repetir especialmente 1–3, 6 y 10; menú, teclado, botones y mensajes deben ser utilizables.

Si falla un paso, registrar su número, panel/dispositivo, resultado observado y hora; compartir capturas anonimizadas, sin contraseñas, cookies o documentos personales. Los casos ampliados que siguen quedan como referencia.

## Evidencia verificada

- [PR #8](https://github.com/josentss/jaguares/pull/8) fusionado en `d6d8c38`; el árbol de archivos coincide con el commit probado `512eccb`.
- [CI del PR #8](https://github.com/josentss/jaguares/actions/runs/41548450422): satisfactorio, 64 pruebas backend y 25 de navegador, Node 22.23.4 y PostgreSQL 16 temporal.
- [Despliegue del PR #8](https://vercel.com/josents-projects/jaguares/BLobrZ5NXcHMVrRTJsoJPi5k1ejM): registro GitHub `7506497104`, SHA `d6d8c38`, entorno Production y estado completado. Siete archivos públicos (ambos paneles, login y cuatro recursos CSS/JS) devolvieron 200 y coincidieron con el PR. No se enviaron formularios autenticados a producción.

### Evidencia anterior, registrada tras PR #7

Estos resultados corresponden a la revisión anterior; las comprobaciones actuales del PR #8 son las indicadas arriba.

- [PR #7](https://github.com/josentss/jaguares/pull/7) fusionado; incluye `31e71ac`. Main local/remoto coinciden y el árbol de archivos de la fusión es idéntico al de ese commit.
- [CI del PR #7](https://github.com/josentss/jaguares/actions/runs/41540524642): logs y pasos revisados. Node 22.23.4, PostgreSQL 16 temporal; 64/64 backend y 10/10 Playwright, sin fallos ni omisiones. Sintaxis e instalación de dependencias satisfactorias; las alertas de dependencias siguen pendientes.
- [Despliegue Vercel](https://vercel.com/josents-projects/jaguares/9Mjkuedn449MHrPjCPdFadEWirpX): el registro de despliegue GitHub `7505441054` corresponde al SHA de main, entorno **Production**, estado **success / Deployment has completed**.
- [Web pública configurada](https://jaguares-eta.vercel.app): GET de portada, login, validador JS, logo, eventos y noticias devuelve 200 y contenido del tipo esperado. Sin cookie, `/api/auth/me`, `/api/usuarios/perfil/1` y `/api/directiva/representantes` devuelven 401 JSON.
- Comprobación anónima con Playwright en la web real, escritorio 1440×900 y móvil 390×844: calendario siguiente/anterior, menú móvil, alternar login/registro y redirección de ambos paneles sin sesión satisfactorios; cero errores JavaScript y cero respuestas 5xx durante esas interacciones. Se bloquearon solicitudes distintas de GET/HEAD y no se guardaron capturas.
- La URL individual `https://jaguares-u0fnafqlv-josents-projects.vercel.app` exige autenticación Vercel. Se utilizó la URL pública para las comprobaciones anónimas, sin intentar eludir esa protección.
- No se inició sesión en cuentas del club ni se enviaron formularios, archivos o escrituras a producción. El resultado del despliegue y las lecturas anónimas no acreditan los flujos autenticados ni el esquema completo de Supabase.

## Preparación

Las operaciones que crean cuentas, atletas, pagos, eventos o notificaciones, o cambian estados/perfiles, se ejecutan en una instancia de pruebas con BD y Cloudinary de pruebas. Una Preview solo sirve para esto si sus variables apuntan a esos recursos. En producción se pueden repetir las consultas sobre registros existentes con permiso del propietario; no generar datos administrativos ficticios para completar esta lista.

Preparar en ese entorno:

- Una cuenta directiva o admin y dos representantes aprobados **Alfa** y **Beta**. Usar perfiles de navegador independientes para que no compartan cookie/localStorage.
- Una cuenta de representante pendiente y otra para rechazar, sin usar cuentas de personas reales.
- Atletas de Alfa en estados activo, inactivo y espera; un atleta de Beta; dos hermanos de prueba con nombres diferentes y sin cédula propia.
- Una imagen JPG/PNG/WebP y un PDF creados para la prueba, con texto «DOCUMENTO DE PRUEBA», sin imágenes ni documentación de menores. Para comparar hermanos, usar archivos visualmente diferentes.
- Registrar fecha, URL/entorno, dispositivo y alias de cuenta; usar alias al comunicar resultados. No compartir cookies, contraseñas, tokens ni capturas con datos personales.

Ejemplos de textos sintéticos: `José Luis`, `Muñoz`, `Calle de pruebas 12`, `alfa@example.org`. Utilizar identificaciones y teléfonos ficticios reservados en el entorno de pruebas. Las fechas fronterizas se calculan respecto al día del ensayo en America/Caracas.

## 1. Sitio público y navegación — solo lectura

- [ ] **WEB-01. Portada:** abrir la URL pública. Deben cargar logo, imágenes, textos y acceso al sistema; no quedar una pantalla en blanco.
- [ ] **WEB-02. Móvil:** abrir/cerrar menú, visitar enlaces internos y girar el teléfono. Los controles deben seguir accesibles y no tapar el formulario.
- [ ] **WEB-03. Categorías informativas:** abrir las tarjetas/modales y cerrarlos. Deben mostrar información legible. Esto no prueba asignación deportiva automática ni reglas de temporada.
- [ ] **WEB-04. Calendario público:** avanzar/retroceder mes, seleccionar un día y comprobar la lista/ausencia de eventos sin errores. Comparar día y mes con la información esperada.
- [ ] **WEB-05. Contacto:** revisar enlaces sociales/mapa y el enlace de WhatsApp sin enviar mensajes. La existencia de enlaces no implica automatización de comunicaciones.
- [ ] **WEB-06. Acceso:** abrir login, alternar Iniciar Sesión/Registrarse y volver al inicio; no perder navegación ni mostrar errores de JavaScript.

## 2. Cuentas, aprobación y sesión — entorno de pruebas

- [ ] **CTA-01. Registro válido:** crear una cuenta con nombres acentuados, correo nuevo y clave de 8–128 caracteres. Debe quedar pendiente y aparecer en Solicitudes de directiva.
- [ ] **CTA-02. Campos inválidos:** probar nombre con cifras, correo inválido y clave de siete caracteres. Debe impedir el registro con error comprensible, sin crear una cuenta.
- [ ] **CTA-03. Correo repetido:** registrar de nuevo el mismo correo, también con mayúsculas/espacios alrededor. Debe rechazarse; no debe aparecer una segunda cuenta.
- [ ] **CTA-04. Cuenta pendiente:** intentar iniciar sesión antes de aprobar. Debe informar que está pendiente y no permitir consultar datos protegidos.
- [ ] **CTA-05. Aprobar:** directiva aprueba la cuenta pendiente; refrescar y entrar como representante. Debe permitir acceso y desaparecer la solicitud pendiente.
- [ ] **CTA-06. Rechazar:** rechazar la otra cuenta pendiente e intentar entrar. Debe denegar acceso con mensaje de rechazo. No se usa este flujo para revocar una cuenta ya aprobada.
- [ ] **CTA-07. Clave incorrecta:** probar una contraseña incorrecta. Debe mostrar error y permitir corregir/reintentar, sin dejar el botón bloqueado.
- [ ] **CTA-08. Sesión:** entrar, recargar el panel y abrir otra pestaña del mismo perfil. Debe conservar acceso; cerrar sesión y comprobar que una nueva consulta protegida exige autenticación.
- [ ] **CTA-09. Panel administrativo:** como Alfa, abrir la URL de panel-directiva. Debe denegar acceso/redirigir y no mostrar registros administrativos.

## 3. Perfil y datos históricos — entorno de pruebas

- [ ] **PER-01. Perfil incompleto:** entrar con una cuenta nueva sin cédula/teléfono. Debe solicitar completarlos y bloquear las acciones de inscripción/pago de la interfaz hasta completar el perfil.
- [ ] **PER-02. Guardado válido:** completar nombres, apellidos, cédula V-/E- con 7–9 dígitos y teléfono completo; guardar y recargar. Debe conservar datos y habilitar las acciones correspondientes.
- [ ] **PER-03. Datos inválidos:** probar cédula de seis dígitos, teléfono con letras y nombres con cifras. Debe rechazar, sin sustituir los datos previos.
- [ ] **PER-04. Cédula ajena:** intentar poner en Alfa la cédula del usuario Beta. Debe mostrar conflicto y conservar ambos perfiles.
- [ ] **PER-05. Clave opcional:** guardar perfil sin nueva contraseña. La clave anterior debe continuar funcionando. Después, cambiarla en una cuenta de prueba: el nuevo login debe aceptar la nueva y rechazar la anterior.
- [ ] **PER-06. Identidades heredadas históricas:** registrar primero un hijo sin cédula propia y luego cambiar la cédula del representante de prueba a otra libre. El hijo anterior debe conservar su identificación; una alta nueva debe usar la base vigente.
- [ ] **PER-07. Perfil antiguo:** si existe una fixture de cédula corta/teléfono incompleto, consultar sin modificar. Si falla el guardado por validaciones recientes, registrar el caso para revisión; no asumir migración automática ni borrar historia.

## 4. Inscripción de atletas por representante — entorno de pruebas

- [ ] **ATL-01. Alta propia:** Alfa registra un atleta válido con cédula propia libre. Debe aparecer una sola vez, asociado a Alfa y en espera, visible también para directiva.
- [ ] **ATL-02. Nombres:** aceptar tildes/ñ/nombres compuestos; impedir cifras o etiquetas HTML. El rechazo no debe crear una ficha parcial.
- [ ] **ATL-03. Cédula:** aceptar V-/E- y 7–9 dígitos; rechazar formato incompleto. Repetir la cédula de un atleta existente debe producir conflicto, incluso desde otra familia de prueba.
- [ ] **ATL-04. Edad:** con PR #9, probar cuatro y diecinueve años: rechazo; cinco y dieciocho: permitidos. Comparar `min/max` con el cumpleaños actual en Caracas, sin años fijos. Fechas futuras/imposibles: rechazo. La regla 5–18 no asigna categoría competitiva.
- [ ] **ATL-05. Dirección:** `2356` debe rechazarse. `Calle de pruebas 12` debe aceptarse y conservarse.
- [ ] **ATL-06. Observación médica:** vacío y texto sintético `Diabetes tipo 1` o `Vitamina B12` deben admitirse; solo cifras o etiquetas deben rechazarse. Abrir después la planilla y comprobar que el texto aceptado no cambió.
- [ ] **ATL-07. Teléfono:** alternar teléfono propio/del representante. El número resultante debe corresponder a la selección, sin letras ni cifras incompletas.
- [ ] **ATL-08. Repetición:** con PR #9, registrar de nuevo el mismo nombre completo y nacimiento con el mismo representante. Debe rechazarse sin otra ficha, con otra cédula propia o heredada; probar también Unicode equivalente o repartir el nombre completo entre ambos campos. Otra familia puede tener una coincidencia legítima.
- [ ] **ATL-09. Hermanos:** registrar dos hijos diferentes sin cédula propia. Deben quedar vinculados al mismo representante con identificadores heredados distintos y sin sobrescribir documentos.
- [ ] **ATL-10. Recarga:** cerrar/reabrir sesión y consultar la lista. Los registros, propietario y estados deben persistir.

## 5. Alta desde directiva y gestión deportiva — entorno de pruebas

- [ ] **DIR-01. Representante existente:** buscar/seleccionar a Alfa en Registrar Atleta y crear otro atleta válido. Debe vincularlo a Alfa y dejarlo activo.
- [ ] **DIR-02. Representante nuevo:** crear representante y atleta en la misma operación. Deben existir ambos relacionados; representante aprobado y atleta activo. Las credenciales mostradas deben permitir login de esa cuenta de prueba.
- [ ] **DIR-03. Conflicto del atleta:** usar un representante nuevo de prueba y una cédula propia de atleta ya registrada. Debe fallar sin dejar creado el nuevo representante. Confirmar su ausencia en el selector actualizado; guardar su correo de prueba para un reintento válido posterior.
- [ ] **DIR-04. Duplicados de representante:** repetir correo o cédula de representante con otro atleta. Debe rechazar y no crear cuentas/atletas adicionales.
- [ ] **DIR-05. Estados:** aprobar un atleta en espera, cambiar otro a inactivo y volver a activar uno de prueba con representante aprobado. Refrescar ambos paneles y comprobar el estado resultante.
- [ ] **DIR-06. Estado repetido:** desde dos sesiones administrativas de prueba, actuar sobre una fila desactualizada que ya tiene el estado solicitado. El segundo intento debe informar conflicto, sin anunciar otro cambio ni duplicar su notificación.
- [ ] **DIR-07. Búsqueda/filtros/métricas:** buscar por los términos admitidos en cada tabla, filtrar estados y comparar cifras del inicio con la lista completa actualizada. No sumar monedas distintas como si fueran una sola.
- [ ] **DIR-08. Tasa mostrada:** comprobar etiqueta, fecha y origen de la tasa. La implementación usa una API externa y un valor de respaldo; la etiqueta «BCV Oficial» no certifica por sí sola que la tasa sea oficial o vigente. Registrar cualquier incongruencia, sin usar la prueba para cambiar tarifas.

## 6. Documentos, planilla y PDF — entorno de pruebas

- [ ] **DOC-01. Archivos permitidos:** adjuntar foto JPG/PNG/WebP y documentos imagen/PDF sintéticos. Deben subirse y quedar asociados al atleta correcto.
- [ ] **DOC-02. Aislamiento entre hermanos:** abrir cada planilla en directiva y sus archivos diferenciados. No deben intercambiarse foto, cédula ni partida.
- [ ] **DOC-03. Tamaño:** intentar adjuntar un archivo de más de 5 MB. Debe mostrar un error claro y no crear la inscripción solicitada. La limpieza del archivo remoto huérfano sigue pendiente de garantía.
- [ ] **DOC-04. Planilla:** comparar representante, fecha de nacimiento, teléfonos, dirección y observaciones con lo enviado; prestar atención a fechas desplazadas un día.
- [ ] **DOC-05. Impresión/PDF:** usar Imprimir y Descargar PDF en directiva. Revisar legibilidad, cortes, acentos y correspondencia con la ficha. El PDF depende también de la carga del generador externo.
- [ ] **DOC-06. WhatsApp de la ficha:** con teléfono sintético/controlado, comprobar que el enlace prepara el número y borrador correctos, sin enviar el mensaje. No hay envío automático ni campañas implementadas.
- [ ] **DOC-07. PDF multipágina:** revisar exportación e impresión en escritorio y móvil; las columnas no deben recortarse, el último dato debe aparecer y no debe quedar una página final vacía. Esta revisión corresponde al PR nuevo y sigue pendiente del despliegue autorizado.

Subir un archivo aceptado no demuestra validación real de su contenido ni privacidad de su enlace externo. Esas dos garantías siguen pendientes P0; no marcar esta sección como una auditoría completa de almacenamiento.

## 7. Pagos e historial — entorno de pruebas

- [ ] **PAG-01. Selector:** Alfa solo debe poder seleccionar sus atletas activos. Con únicamente atletas inactivos/en espera, el envío debe quedar deshabilitado o rechazado.
- [ ] **PAG-02. Efectivo:** reportar un importe positivo con hasta dos decimales y moneda permitida (Bs, USD o COP). Debe crear un pago pendiente asociado al atleta correcto.
- [ ] **PAG-03. Transferencia:** completar datos en Bs y adjuntar comprobante sintético. Debe quedar pendiente y el comprobante debe corresponder a ese pago.
- [ ] **PAG-04. Falta de captura:** intentar transferencia sin archivo. Debe rechazar y mantener habilitada la corrección del formulario.
- [ ] **PAG-05. Monto inválido:** probar cero, negativo y más de dos decimales. Debe impedir el envío; no alterar un pago previo.
- [ ] **PAG-06. Historial:** refrescar y volver a entrar. Comprobar mes, fecha sin desplazamientos, método, importe, moneda, atleta y estado.
- [ ] **PAG-07. Auditoría:** directiva aprueba un pago y rechaza otro de prueba. Representante debe ver el mismo estado tras refrescar; el comprobante debe seguir accesible al personal autorizado.
- [ ] **PAG-08. Cambio repetido:** repetir el mismo estado desde una vista administrativa desactualizada. Debe informar que ya tiene ese estado, sin una nueva notificación de cambio.
- [ ] **PAG-09. Formulario desactualizado:** Alfa deja abierto el formulario de un atleta activo; directiva lo cambia a inactivo y espera confirmación. Alfa intenta pagar desde la pestaña antigua. Debe rechazarse y no aparecer otro pago.

Actualmente los importes se reportan por formulario. No esperar cálculo de tarifa fija, deuda automática ni bloqueo de dos pagos por el mismo mes: las reglas y el modelo de cargos siguen pendientes.

## 8. Permisos entre familias — cuentas de prueba, consultas GET

Usar exclusivamente IDs conocidos de Alfa/Beta y sus registros sintéticos. Sustituir los marcadores de las rutas por esos IDs y abrirlas en el navegador donde está conectado Alfa. No enumerar IDs de personas reales.

- [ ] **SEG-01. Perfil:** `/api/usuarios/perfil/ID_BETA` debe devolver 403, sin datos del perfil. Con el ID propio debe devolver 200 y nunca `password_hash`.
- [ ] **SEG-02. Lista:** `/api/atletas/representante/ID_BETA` debe devolver 403.
- [ ] **SEG-03. Planilla:** `/api/atletas/ID_ATLETA_BETA` debe devolver 403, sin documentación ni datos médicos.
- [ ] **SEG-04. Historial:** `/api/pagos/historial/ID_BETA` debe devolver 403.
- [ ] **SEG-05. Comprobante:** `/api/pagos/captura/ID_PAGO_BETA`, de un pago con captura de prueba, debe devolver 403. No prueba la privacidad de una URL Cloudinary ya conocida por otra vía.
- [ ] **SEG-06. Notificaciones:** `/api/notificaciones/ID_BETA` debe devolver 403.
- [ ] **SEG-07. IDs inválidos:** con una sesión administrativa, sustituir un ID por `abc` en esas consultas. Debe devolver 400, sin 500 ni detalles de PostgreSQL. Sin sesión prevalece 401.
- [ ] **SEG-08. Salida de sesión:** después de salir, consultar `/api/auth/me` y un perfil conocido. Deben devolver 401; abrir cualquiera de los paneles debe redirigir al login.

## 9. Notificaciones — entorno de pruebas

- [ ] **NOT-01. Destinatario:** aprobar atleta o cambiar pago de Alfa. La notificación debe llegar a Alfa, con atleta/mes/estado correctos, y no a Beta.
- [ ] **NOT-02. Persistencia del mensaje:** recargar y abrir la campana. El mensaje debe continuar disponible; un cambio repetido no debe generar otro igual por esa misma operación.
- [ ] **NOT-03. Vaciar:** borrar solo las notificaciones sintéticas de la cuenta de prueba, recargar y comprobar que ya no aparecen. No debe borrar las de otra cuenta.

La creación de notificaciones es de mejor esfuerzo y puede fallar después de una operación principal válida. No hay garantía transaccional de notificación ni persistencia general de lectura entre dispositivos.

## 10. Calendario de directiva y adaptación móvil — entorno de pruebas

- [ ] **CAL-01. Evento:** crear un evento futuro ficticio con título/lugar. Debe aparecer como Próximo en Gestión Web y en el calendario público del mismo entorno, tras recargar.
- [ ] **CAL-02. Validación:** omitir título/lugar o elegir una fecha pasada. Debe rechazar sin crear evento. Comparar fechas con zona venezolana; anotar discrepancias.
- [ ] **CAL-03. Estados:** con directiva/admin, completar o cancelar un evento sintético. Debe conservarse en administración con su estado y desaparecer de la consulta pública; Reactivar lo devuelve a Próximo.
- [ ] **CAL-04. Roles:** staff puede crear/consultar eventos; modificar estados está permitido a directiva/admin. La interfaz puede mostrar controles que el servidor deniega a staff; registrar esa discrepancia si ocurre.
- [ ] **MOV-01. Representante:** repetir alta, perfil, selector de pago e historial en móvil. Teclado/scroll/botones/toasts deben permitir completar y corregir formularios.
- [ ] **MOV-02. Directiva:** revisar Solicitudes, Registrar Atleta, filtros, planilla, documentos y comprobantes en móvil; cerrar modales y volver al menú.

El panel actual expone gestión de eventos. Hay endpoints de noticias en el backend, pero no un editor de noticias visible en este panel: no buscar un formulario que no está implementado. Las categorías públicas son informativas; temporadas, traspasos, plantillas por categoría, lesiones/sanciones y automatizaciones de WhatsApp siguen pendientes.

## 11. Pruebas técnicas que no se acreditan con clics normales

CI ya cubrió transacciones fallidas, rollback del alta compuesta, bloqueo ocupado/503, altas y perfiles simultáneos, estados/roles concurrentes y entradas JSON manipuladas. No interrumpir Supabase ni cambiar roles/cuentas de producción para reproducirlas.

- [ ] **TEC-01. Repetición concurrente opcional en pruebas:** completar el mismo atleta sin cédula propia en dos pestañas de Alfa y enviarlo casi a la vez. Debe quedar una sola fila; un conflicto del segundo envío es correcto. Dos pestañas no garantizan solapamiento SQL exacto.
- [ ] **TEC-02. Hermanos concurrentes opcional en pruebas:** enviar dos hijos distintos casi a la vez. Ambos deben quedar con identificadores diferentes y documentos propios.
- [ ] **TEC-03. JSON inválido, con herramientas del navegador en pruebas:** arrays en `fecha_nac`, `telefono: 0`, indicadores desconocidos y dos campos médicos contradictorios deben devolver 400 sin alta. Estos tipos no se generan con los controles normales del formulario.

No existe actualmente un control del panel para revocar el rol/estado de un representante aprobado. La revocación de sesiones por esa causa y la activación contra un representante no aprobado requieren fixtures técnicas preparadas; no inventar ese botón ni modificar producción para esta lista.

## Registro de resultados

Para cada caso, anotar **Aprobado / Falló / No probado**, entorno y dispositivo. Si falla: ID del caso, pasos, resultado esperado, resultado observado, hora de Venezuela y código HTTP si está disponible. Compartir solo alias y capturas anonimizadas; no adjuntar contraseñas, cookies, documentos ni salud real.

Orden recomendado: WEB/lecturas → CTA → PER → ATL/DIR → DOC → PAG → SEG → NOT/CAL → móvil → técnicas opcionales. Una funcionalidad se marca probada manualmente solo después de ejecutar sus casos y registrar el resultado.
