# Regresión manual web — Jaguares

Guía vigente desde el 5 de noviembre de 2026. Las casillas son instrucciones; no significan que el caso ya fue ejecutado. Usar cuentas y datos de prueba, nunca documentos personales reales.

## Antes de probar

- Confirmar el SHA desplegado y que Vercel terminó correctamente.
- Hacer recarga completa y usar perfiles separados para directiva y representante.
- Registrar navegador, dispositivo, hora y paso exacto si aparece un fallo.
- Anonimizar capturas; no compartir contraseñas, cookies, tokens ni comprobantes.

## Recorrido esencial

- [ ] **Cuenta pendiente:** registrar representante; el acceso queda bloqueado hasta aprobación.
- [ ] **Aprobación:** aprobarlo desde directiva; puede iniciar sesión y completar su perfil.
- [ ] **Inscripción propia:** registrar atleta de 5 a 18 años con cédula válida; queda una sola ficha en espera.
- [ ] **Errores:** fechas fuera del rango, cédula/teléfono inválidos y campos obligatorios muestran un mensaje útil y no crean registros.
- [ ] **Cédula heredada:** registrar dos hijos; reciben identificadores distintos y mantienen el representante correcto.
- [ ] **Duplicado familiar:** repetir nombre completo normalizado y fecha de nacimiento dentro de la misma familia; se rechaza sin alterar fechas.
- [ ] **Coincidencia entre familias:** el mismo nombre y fecha en otra familia no se bloquea solo por coincidencia.
- [ ] **Alta por directiva:** probar representante existente y cuenta nueva; relaciones, estado e identidad quedan correctos.
- [ ] **Planilla/PDF:** abrir una ficha nueva y otra histórica; foto, textos, fechas y secciones aparecen completos, sin cortes.
- [ ] **Estados:** aprobar atleta y luego inactivarlo; aparece y desaparece de los flujos correspondientes.
- [ ] **Pago en efectivo:** atleta activo y representante aprobado pueden reportarlo; queda pendiente para directiva.
- [ ] **Transferencia:** exige comprobante; directiva puede visualizarlo y aprobar o rechazar el reporte.
- [ ] **Fecha del pago:** la fecha elegida coincide en ambos paneles y en el historial, sin restar un día.
- [ ] **Pago inválido:** atleta inactivo o representante no aprobado se rechaza desde el backend aunque la pestaña sea antigua.
- [ ] **Propiedad:** una familia no puede consultar ni editar atletas, pagos o documentos de otra mediante URL o API.
- [ ] **Evento válido:** crear desde hoy hasta el 31 de diciembre del año siguiente con hora de Venezuela; fecha y hora aparecen en directiva, representantes y calendario público.
- [ ] **Hora válida:** en directiva, el popover compacto muestra un selector de hora (5–11 a. m. o 12–10 p. m.), botones a. m./p. m. y 12 opciones rápidas de minutos (00 a 55, de cinco en cinco), sin resumen duplicado dentro. El valor legible aparece solo en el formulario (ej. «2:30 p. m.»); la API recibe `14:30`. Las 10 p. m. se confirman como `22:00` sin minutos posteriores. Verificar 05:00, 14:30 y 22:00.
- [ ] **Reloj responsive/accesible:** abrir en escritorio/móvil y comprobar que el menú permanece corto, junto al campo y dentro del viewport. Se cierra con Escape, clic fuera o X; volver a abrir restaura hora, período y minuto. Cambiar controles sin confirmar y cerrar no cambia el valor guardado; seleccionar minutos guarda y cierra. El select de hora y los botones permiten teclado/foco. El reset limpia la selección.
- [ ] **Limpieza visual del PR #23:** el formulario no muestra texto explicativo debajo de «Hora» y el popover solo muestra «Minutos», sin «de 5 en 5». La descripción del horario continúa accesible para lectores de pantalla. Los botones de minutos conservan una zona táctil cómoda en móvil. Bajo «Eventos del calendario» no aparece el párrafo permanente de estados, pero los filtros, badges y el aviso contextual al existir completados siguen presentes.
- [ ] **Hora inválida:** omitirla o enviar por API 02:00, 04:55, 14:02, 22:05, 23:00 o un valor distinto de `HH:mm`; el backend rechaza sin insertar.
- [ ] **Evento inválido:** fecha pasada o posterior al límite se rechaza en interfaz y backend.
- [ ] **Histórico:** los eventos antiguos conservan el día que ya mostraba el sistema, sin desplazarse al día anterior en Caracas, sin hora inventada ni reescritura.
- [ ] **Estado derivado:** un evento de hoy sigue programado y visible durante su día; al día civil siguiente aparece como «Completado» en el historial de directiva y desaparece de la web pública sin proceso programado.
- [ ] **Historial:** las pestañas Programados/Historial alternan correctamente; la directiva ve una sugerencia de revisión cuando existen completados.
- [ ] **Papelera:** el botón SVG solicita confirmación; cancelar no elimina. Confirmar elimina solo el evento elegido y lo retira del panel y la web, sin alterar otros registros.
- [ ] **Permisos:** representantes y staff no pueden invocar el borrado mediante API ni desde la interfaz; solo directiva/admin.
- [ ] **Diseño:** formulario con título/lugar y fecha/hora alineados en escritorio, apilado en móvil; ningún selector se desborda.
- [ ] **Calendario público concurrido:** se muestran tres tarjetas inicialmente y «Ver todos» amplía la lista; tocar un día filtra y «Ver mes completo» restaura el mes.

## Archivos y privacidad (PR #24)

- [ ] **Firma válida:** usar PNG, JPEG, WebP, PDF de cédula/partida y GIF para noticias, solo con muestras sintéticas; deben funcionar como antes.
- [ ] **Firma falsa:** renombrar un TXT/HTML a PNG/PDF y declarar un MIME permitido; la API responde HTTP 400 sin enviarlo a Cloudinary ni guardar registros.
- [ ] **Contradicción:** imagen con extensión/MIME de PDF, o viceversa, y archivos mayores a 5 MiB se rechazan.
- [ ] **Autorización futura:** solo representante propietario y personal autorizado del panel directiva ven los documentos; nunca otro representante.
- [ ] **Privacidad pendiente:** no asumir que URL de Cloudinary histórica es privada solo porque Express exija autenticación para devolverla. Habrá un PR adicional para acceso temporal y migración no destructiva.

## Acceso privado y Cloudinary (PR #25)

- [ ] **Propiedad y panel:** el representante puede usar el botón «Documentos» en «Mis atletas» para abrir foto, cédula o partida disponibles en un diálogo compacto, también en móvil. Al seguir la ruta `/api/atletas/:id/documentos/:tipo`, el propietario puede acceder, el ajeno recibe HTTP 403 y la sesión ausente HTTP 401.
- [ ] **Directiva:** roles `staff`, `directiva` y `admin` pueden consultar la documentación según la política aprobada, sin revelar URL originales en la planilla JSON.
- [ ] **Comprobante:** solo propietario o directiva autorizada obtiene enlace al comprobante; el historial y la auditoría no devuelven el URL original.
- [ ] **Nueva carga privada:** *únicamente tras confirmar configuración de Cloudinary*, activar `CLOUDINARY_AUTHENTICATED_UPLOADS=1` en entorno de prueba. Confirmar que archivos de atletas y comprobantes se guardan como `authenticated`, mientras las imágenes de noticias permanecen públicas.
- [ ] **Firma con caducidad:** en archivos nuevos, una URL sin firma no debe abrir y la firmada deja de servir tras vencer; una URL temporal compartida funciona durante su vigencia (limitación explícita).
- [ ] **PDF y planilla:** comprobar vista de cédula/partida PDF, foto, descarga e impresión/exportación de planilla en móvil y escritorio con archivos sintéticos.
- [ ] **Históricos:** los activos existentes de tipo `upload` siguen accesibles por URL antiguas si se conoce; inventariar y migrar después sin reescribir Supabase ni cambiar URLs sin autorización.
- [ ] **Rollback:** `CLOUDINARY_AUTHENTICATED_UPLOADS=0` solo controla las cargas futuras; no desprotege los recursos ya guardados como `authenticated`.

## Normalización de subida privada y pruebas de integración (PR #35)

- [ ] PR #34 aprobado en Cloudinary real: foto PNG/PDF/comprobante authenticated con firma válida, sin firma/vencida bloqueadas y 3 archivos eliminados sin pendientes.
- [ ] PR #35: comprobar en CI que la URL canónica sale de public_id de CloudinaryStorage y MIME/extension; la URL nativa en otra carpeta no se guarda y la URL maliciosa se rechaza.
- [ ] No activar privadas en Production solo porque el CI pase: habilitar temporalmente en entorno Preview aislado con Supabase de prueba, y realizar registro/pago con cuentas, atletas y documentos sintéticos.
- [ ] Verificar en Preview que representante propio y directiva/staff pueden ver foto/PDF y comprobante, un representante ajeno no, y la planilla PDF se exporta. Confirmar que los registros nuevos guardan URL reconocida y que los históricos se mantienen accesibles.
- [ ] Con fallo, desactivar futuras cargas en el entorno de prueba, conservar evidencias anónimas y no convertir ni borrar activos históricos.
- [ ] Migrar solo después 34 referencias públicas con inventario deduplicado, respaldo y aprobación explícita.

## Contrato de URL canónica y entrega privada (PR #34)

- [ ] PR #33 fusionado: la prueba real detectó `CARPETA_URL_DIFERENTE` pero Cloudinary devolvió PNG, creó y eliminó el archivo sintético sin pendientes.
- [ ] Tras revisar PR #34, repetir una sola vez `node scripts/probar-cloudinary-privado.js --ejecutar`, con 3 recursos sintéticos y limpieza por public_id de la ejecución.
- [ ] Cada categoría debe demostrar metadata `authenticated`, URL canónica sin firma rechazada, firma temporal accesible y vencimiento rechazado. Compartir solo resumen anónimo.
- [ ] Si aparece `requiere_ajuste_de_url_web:true`, no activar `CLOUDINARY_AUTHENTICATED_UPLOADS=1` en Production aunque el preflight haya aprobado: preparar normalización al guardar URL y probar rutas web con recursos sintéticos en Preview.
- [ ] Confirmar `limpieza.pendientes=0` y no migrar los 34 enlaces públicos históricos sin plan reversible y autorización.

## Diagnóstico de URL de subida privada (PR #33)

- [ ] El preflight #32 real terminó con `URL_INCOMPATIBLE` tras subir y borrar 1 PNG sintético, sin pendientes, antes de comprobar firmas.
- [ ] Tras revisar y fusionar PR #33, repetir el preflight solo con archivos sintéticos y autorización. Compartir solo `detalle_url`, `formato_cloudinary`, etapa y limpieza; nunca URLs ni credenciales.
- [ ] Resolver el formato real de Cloudinary antes de modificar `analizarAssetGuardado` o activar privadas en Production.

## Comprobación sintética de entrega privada Cloudinary (PR #32)

- [ ] Comprobar que `node scripts/probar-cloudinary-privado.js` **no sube ni borra nada** y solo informa si existen las tres variables Cloudinary localmente.
- [ ] Configurar en `.env` local `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` del mismo entorno, sin compartir valores ni publicarlos. Para esta prueba no hace falta `DATABASE_URL`.
- [ ] Solo tras aprobar tres operaciones de prueba reales, ejecutar `node scripts/probar-cloudinary-privado.js --ejecutar`. Debe probar foto PNG, PDF y comprobante PNG **sintéticos** `authenticated`: metadata correcta, URL pública denegada, URL temporal firmada accesible y caducada denegada.
- [ ] Revisar que `limpieza.pendientes` sea `0` y la eliminación se limite a los recursos sintéticos de la ejecución. Si no, revisar solo `_pruebas_privacidad` y no borrar otros assets.
- [ ] No activar `CLOUDINARY_AUTHENTICATED_UPLOADS=1` en Production en este PR. Antes de hacerlo, probar inscripción sintética con foto/PDF y comprobante en Preview, permisos propietario/ajeno y exportación de planilla.
- [ ] El resultado del inventario local ya reportado fue 30 referencias públicas de atletas y 4 de comprobantes, 0 `authenticated`; son referencias, no assets únicos, y los huérfanos no se incluyen. Migración histórica separada con respaldo y aprobación.

## Diagnóstico seguro de inventario local (PR #31)

- [ ] Ejecutar `node scripts/auditar-cloudinary.js --diagnostico` desde la raíz del proyecto: muestra solo variables presentes/ausentes y modalidad de conexión; no intenta abrir una conexión.
- [ ] Si es `directa_ipv6_habitual` y el equipo no tiene IPv6 funcional, consultar Supabase → Connect → **Session pooler** (5432) para el `.env` local únicamente. No copiar credenciales a chats, issues o capturas.
- [ ] Ejecutar `node scripts/auditar-cloudinary.js`. En fallo compartir únicamente `etapa` y `categoria`; sin volcado de log, URL o `.env`. En éxito compartir solo el objeto `colecciones`.
- [ ] En tests usar PostgreSQL simulado/local, verificar `BEGIN READ ONLY`, consultas SELECT, ROLLBACK y cierre de conexión tras error. No ejecutar contra producción automáticamente ni migrar archivos históricos.

## Inventario Cloudinary y rutas de documentos (PR #26)

- [ ] **Origen permitido:** desde la ficha de un atleta propio y la planilla directiva, un JPG/PNG/PDF histórico con URL de la cuenta y carpeta de Jaguares sigue abriéndose.
- [ ] **Destino incorrecto:** una URL de otro dominio, nube, carpeta o formato no permite redirigir fuera de Cloudinary; la API informa documento no disponible, sin exponer enlaces.
- [ ] **Metadatos históricos:** verificar en Media Library que ejemplos de ambas carpetas sean Públicos; no asumir que el recurso completo fue inventariado solo con dos muestras.
- [ ] **Inventario anónimo:** después de PR #27, ejecutar `node scripts/auditar-cloudinary.js` en la carpeta del proyecto y con `.env` local autorizado, comprobar que carga `DATABASE_URL` y `CLOUDINARY_CLOUD_NAME`, y confirmar salida con solo conteos por categoría. No compartir el `.env`, URL ni datos personales; no se realizan actualizaciones SQL.
- [ ] **Antes de activar authenticated:** comprobar entrega firmada/no firmada de foto, comprobante y PDF sintéticos en Preview. El checkbox de entrega PDF/ZIP habilitado no prueba por sí solo que ya funcione el flujo completo con `authenticated`.
- [ ] **Históricos:** no modificar activos reales ni ejecutar `rename`, reemplazos SQL o invalidación de CDN sin revisión del inventario y autorización explícita.

## Planilla PDF y comprobantes en representante (PR #28)

- [ ] **PDF real:** en Preview, abrir una planilla sintética con foto, descargar PDF y comprobar texto, foto y firmas. Repetir en móvil y contrastar «Imprimir».
- [ ] **CORS:** si la foto no puede incluirse en PDF, mostrar marcador y aviso; no aceptar silenciosamente un PDF incompleto.
- [ ] **Error de exportación:** después de un fallo simulado de html2pdf, se puede cerrar y volver a usar la planilla, sin overlays persistentes. Revisar consola del navegador sin compartir datos privados.
- [ ] **Historial representante:** «Ver» abre comprobante propio; pagos sin comprobante muestran guion. Directiva mantiene su acción «Ver».
- [ ] **Seguridad:** `/api/pagos/captura/:id_pago?abrir=1` exige sesión y propietario o staff/directiva/admin; representante ajeno recibe HTTP 403.

## Acciones de pago y visor unificado (PR #29)

- [ ] **Iconos:** en directiva, «Acciones» contiene los SVG de comprobante, aprobar, rechazar y papelera según estado. Los iconos tienen nombre accesible, tooltip y foco visible. La papelera de eventos usa el SVG compartido.
- [ ] **Estados:** pago pendiente muestra aprobar/rechazar; aprobado muestra rechazar y comprobante si existe; rechazado muestra aprobar/papelera y comprobante si existe. Staff no ve papelera.
- [ ] **Eliminación:** confirmar borrado de pago *sintético* rechazado lo retira de ambas tablas; cancelar no lo altera. El backend responde HTTP 409 para pendiente/aprobado, 403 para representante/staff, 401 sin sesión y 404 al repetir.
- [ ] **Visor:** representante y directiva abren comprobantes en el mismo diálogo, con Escape, botón Cerrar, imagen responsive y enlace secundario para abrir el original. Ante archivo no disponible, mostrar error sin impedir cerrar.
- [ ] **Sin archivo:** pago en efectivo sin comprobante muestra guion en Acciones; no hay botón ni URL de Cloudinary en HTML.
- [ ] **PDF móvil:** abrir el mismo PDF en móvil y PC y comprobar borde derecho y columnas. El zoom distinto del visor no demuestra contenido recortado.
- [ ] **Retención:** borrar registro rechazado no borra archivo Cloudinary. Evaluar retención/auditoría financiera antes de cualquier borrado real; limpieza documental separada.

## Restricción de orígenes API (PR #30)

- [ ] **Producción/Preview:** abrir Jaguares en su propio dominio, iniciar sesión, registrar datos de prueba permitidos, consultar documentos y reportar un pago de prueba; las solicitudes JSON/multipart del mismo sitio no reciben 403 por Origin.
- [ ] **Despliegue Vercel:** confirmar que el proyecto permite el mismo host HTTPS en Preview y Production aunque su dominio cambie. Un sitio ajeno en `vercel.app` no adquiere permisos por el sufijo.
- [ ] **Origen ajeno:** un POST/PUT/DELETE a `/api/` con `Origin: https://sitio-ajeno.example` recibe 403, incluso si no hubo preflight. Un OPTIONS externo no recibe `Access-Control-Allow-Origin`.
- [ ] **Lecturas:** un GET de API público sigue respondiendo desde el navegador legítimo; desde un navegador externo sin origen autorizado no se le permite leer respuesta CORS.
- [ ] **Integraciones:** si hay frontend autorizado alojado en dominio *distinto*, comprobar que está enumerado de forma exacta en `CORS_ORIGIN`; no usar comodines.
- [ ] **Regresión:** comprobar cookie y cierre de sesión, carga de los paneles y calendario. No migrar recursos Cloudinary ni modificar base de datos para esta prueba.

## Sesión

- [ ] Entrar y recargar: vuelve al panel sin tarjeta blanca de verificación.
- [ ] Abrir dos pestañas: ambas funcionan; cerrar una no cierra la otra.
- [ ] Cerrar sesión expresamente: las pestañas del mismo perfil vuelven al login.
- [ ] Dejar 14 minutos sin interacción: aparece el aviso; «Continuar sesión» conserva datos y acceso.
- [ ] Repetir sin continuar: al llegar a 15 minutos el servidor exige iniciar sesión.
- [ ] Navegador normal e incógnito mantienen sesiones independientes; no se usa la IP como identidad.
- [ ] Pegar una URL protegida sin sesión no expone el panel antes de redirigir.

Detalles del contrato: [SESIONES_Y_ACCESO.md](SESIONES_Y_ACCESO.md).

## Móvil

- [ ] Repetir registro, errores, pago, calendario y sesión en un ancho móvil.
- [ ] Menú, teclado, calendarios, modales y botones no se superponen ni requieren desplazamiento horizontal.
- [ ] El aviso de inactividad no tapa controles imprescindibles y permite continuar.
- [ ] El PDF se genera completo; su visor puede variar según el dispositivo.

## Criterio ante fallos

Detener el recorrido afectado y conservar solo evidencia anonimizada. Indicar resultado esperado, observado, pasos, rol, navegador y hora. No intentar corregir datos de producción manualmente ni repetir envíos dudosos.
