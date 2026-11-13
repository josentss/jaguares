# Guía de uso y estudio — Club de Voleibol Jaguares

**Edición:** noviembre de 2026 · **Alcance:** página pública, Directiva, Representante, base de datos, pagos, archivos y mantenimiento.

Esta guía explica **qué hace cada sección, cómo usarla, dónde está implementada y qué precauciones tomar**. Está pensada para estudiar y presentar el proyecto sin llenar las pantallas de textos explicativos. Si una pantalla o regla cambia, confirmar siempre el código vigente y las pruebas. **No es una guía para manipular Production directamente.**

## 1. Qué es Jaguares

Es un sistema web de gestión de un club de voleibol. Reúne registro de personas y atletas, organización por temporadas y equipos, calendario, comprobantes y seguimiento de obligaciones económicas.

| Área | Acceso | Para qué sirve |
|---|---|---|
| Página pública | Visitantes | Información del club, categorías, noticias, calendario y contacto |
| Representante | Usuario aprobado | Sus atletas, documentos autorizados, estado de cuenta, reportes e historial |
| Directiva | Directiva y roles administrativos según permisos | Revisar usuarios/atletas, equipos, calendarios, pagos y cobros |

**Entradas web:** `/` (inicio público), `/galeria.html` (galería), `/admin/login.html` (acceso), `/admin/panel-representante.html`, `/admin/panel-directiva.html`. Los HTML privados requieren sesión y rol válido. Se navega entre secciones dentro de cada panel, sin cambiar de URL.

## 2. Recorrido del Representante

### Cuenta y atletas
1. Registrarse e iniciar sesión; el acceso del Representante depende de la aprobación administrativa.
2. En **Inicio** consultar las tarjetas de resumen y sus atletas.
3. En **Registrar atleta**, completar los datos y adjuntos solicitados; esperar la revisión correspondiente.
4. Los documentos de atleta se abren desde las opciones autorizadas. No se envían enlaces privados de Cloudinary por la página pública.
5. Consultar **Eventos**, **Mi perfil** y las notificaciones cuando corresponda.

### Estado de cuenta y pago
1. Entrar en **Estado de cuenta** y seleccionar un atleta. Se muestran cargos concretos: concepto, período, monto nominal USD, vencimiento, límite y estado.
2. Si la Directiva aún no configuró el inicio, el sistema informa que no hay obligaciones; **no crea una deuda al abrir la pantalla**.
3. En **Reportar pago**, elegir atleta, **tipo de cargo** y **período/cargo pendiente**. No se puede seleccionar cualquier mes ni editar el precio.
4. Elegir **Transferencia/Pago Móvil en Bs** o **Efectivo** (USD, Bs o COP), informar la fecha real, referencia y comprobante si es transferencia.
5. El sistema calcula el importe y comprueba la tasa para la fecha de la operación. Si no hay cotización aplicable, bloquea el envío y muestra un aviso. No inventar montos.
6. Enviar el reporte. Queda **pendiente de revisión**, no pagado. Consultar **Historial de pagos** y **Estado de cuenta** tras la decisión de Directiva.

**Importante:** un comprobante cargado no equivale a pago aprobado. Un reporte rechazado se conserva en el historial y puede volver a reportarse cuando el cargo esté disponible.

## 3. Recorrido de Directiva

### Administración y deporte
| Sección | Función operativa | Archivos del navegador |
|---|---|---|
| Inicio | Indicadores de atletas y pagos; equivalencias monetarias **estimadas** | `public/admin/panel-directiva.html` |
| Solicitudes | Aprobar/rechazar solicitudes de registro | `panel-directiva.html` |
| Registrar / Gestión de atletas | Inscripciones autorizadas, estados, búsqueda y documentos | `panel-directiva.html`, `categorias-formativas-ui.js` |
| Catálogos deportivos | Temporadas, categorías y equipos relacionados | `catalogos-deportivos.js` |
| Asignación de equipos | Movimientos históricos de entrada/cambio de equipo | `asignaciones-equipos.js` |
| Consulta de plantillas | Listado por categoría o equipo y exportación de planilla | `planilla-general.js` |
| Auditoría de pagos | Ver reportes, comprobantes, aprobar o rechazar | `panel-directiva.html`, `comprobantes-ui.js` |
| Inicio de cobros | Revisar históricos y activar cobros por atleta | `conciliacion-cobros.js` |
| Conceptos y cargos | Tarifas, nuevos tipos de cobro, asignaciones y tasas | `gestion-cobros.js` |
| Gestión web y eventos | Contenido público y calendario | `panel-directiva.html` |

### Activar un cobro por atleta
1. Abrir **Inicio de cobros** y seleccionar un atleta.
2. **Revisar todos los pagos anteriores** antes de establecer la primera fecha de cobro; los históricos pueden no tener año/concepto inequívocos.
3. Establecer inicio y día de referencia solo cuando el historial sea claro. El ancla no debe configurarse mediante ensayos al azar.
4. En **Conceptos y cargos**, confirmar los precios USD activos y **asignar** mensualidad, inscripción u otro cargo al atleta seleccionado.
5. Esa obligación aparece en Reportar pago y Estado de cuenta del Representante. Los cargos **no se generan automáticamente** por abrir el módulo.

### Mantener el catálogo
- Las tarifas nominales son de **USD 0,01 a 999,99**, hasta dos decimales; un cambio afecta cargos **futuros**, nunca modifica el importe congelado de obligaciones anteriores.
- El lápiz abre una sola fila editable; **Guardar**, **Cancelar** y **Retirar** aparecen solo al editar.
- Un concepto nuevo sin uso puede eliminarse. Si tiene obligaciones o es institucional, se **archiva** para preservar los registros.
- **Ver archivados (N)** aparece solo cuando existen conceptos archivados y permite reactivarlos.

### Tasas de cobro
- ExchangeRate-API proporciona la referencia elegida por el club para **bolívares por USD y EUR**, almacenada una vez por día cuando está disponible. La tasa EUR es informativa: **no se habilitan pagos en euros**.
- La cifra del dashboard es una *referencia de mercado* para estimar totales, no sustituye la tasa histórica de cada pago.
- Para un reporte en **Bs**, el backend utiliza primero una tasa del club publicada **para la fecha exacta** del pago. Si no hay, puede utilizar la referencia ExchangeRate-API correspondiente a ese día (consulta actual o registro histórico del mismo día); al **reportar** guarda la tasa usada junto al pago.
- Para **COP**, aplica la última tasa manual vigente desde su fecha hasta que Directiva registre otra. No reutilizar automáticamente una tasa Bs de ayer para hoy.
- La Directiva puede **fijar una tasa** antes del reporte o registrar COP/Bs manualmente. Las tasas ya usadas quedan asociadas al reporte; no modificarlas retroactivamente.
- La relación es `Bs = USD × (Bs por USD)`; para estimar USD desde Bs, `USD = Bs ÷ (Bs por USD)`. La tasa se elige según la **fecha de pago**, no el mes de la mensualidad.

### Revisar un pago
1. Abrir **Auditoría de pagos** y ver el reporte `pendiente`.
2. Revisar atleta, cargo, importe, método, fecha y comprobante. En pagos Bs/COP comprobar la equivalencia y la tasa asociada.
3. Aprobar o rechazar usando las acciones autorizadas. No marcar como pagado un reporte solo porque subió un comprobante.
4. Comprobar el estado en **Historial** y **Estado de cuenta** del Representante. Un pago vinculado aprobado deja el cargo `pagada`.

## 4. Estados de obligaciones

| Estado | Significado |
|---|---|
| Pendiente / En plazo | Cargo emitido todavía dentro de su período de pago |
| Morosa / Vencida | Pasó la fecha límite y no hay aprobación o reporte activo |
| En revisión | Existe un reporte pendiente de decisión |
| Pagada | Hay un reporte vinculado aprobado |

El período de una mensualidad es **año y mes**, no solo el nombre «Noviembre». El motor distingue vencimiento y plazo de gracia (hasta el final del mes para mensualidades). **No** aplica sanciones automáticas, genera intereses ni suspende atletas por mora.

## 5. Arquitectura: cómo se conectan las capas

```text
Navegador (HTML + CSS + JS)
  -> apiFetch('/api/...') + cookie de sesión
  -> index.js (Express, seguridad de origen, middleware)
  -> routes/ (prefijos, sesión y roles)
  -> controllers/ (permisos, reglas, respuestas)
  -> utils/ (cobros, tasas, validadores, archivos privados)
  -> config/db.js -> PostgreSQL / Supabase
  -> Cloudinary (foto, documento y comprobante privados)
```

- `index.js`: montaje de rutas, ficheros estáticos, cabeceras de privacidad y errores.
- `config/db.js`: pool PostgreSQL de capacidad limitada; consulta parametrizada y compatibilidad heredada.
- `middlewares/authMiddleware.js`, `panelMiddleware.js`, `uploadMiddleware.js`: sesión/roles, protección de paneles y archivos.
- `public/admin/api-client.js`: `apiFetch`, actividad e invalidación de sesión.
- `public/admin/estado-cuenta.js` y `pagos-guiados.js`: consultas y presentación sin permitir alterar precios.
- `controllers/cobrosController.js`: anclas, mensualidades y estado de obligaciones.
- `controllers/catalogoCobrosController.js`: conceptos, cargos manuales y tasas de Directiva.
- `utils/referenciasCambio.js` y `utils/cotizadorObligaciones.js`: caché ExchangeRate-API, cálculo y congelación de tasas.
- `controllers/pagosVinculadosController.js` y `pagosVinculadosRevisionController.js`: reporte transaccional y revisión.
- `controllers/atletaController.js`, `planillaGeneralController.js`, `cmsController.js`: atletas, exportación y contenidos.

## 6. Mapa de rutas para estudiar (ejemplos)

| Método y ruta | Uso |
|---|---|
| `POST /api/auth/login`, `GET /api/auth/me` | Sesión y validación de identidad |
| `GET /api/atletas/representante/:id` | Listar atletas propios, según permisos |
| `POST /api/atletas/registrar-atleta` | Registrar atleta desde Representante |
| `GET /api/atletas/:id/documentos/:tipo` | Abrir foto/documentación autorizada |
| `GET /api/pagos/obligaciones/:id_atleta` | Estado de cuenta y cargos emitidos |
| `GET /api/pagos/cotizacion/:id_obligacion` | Monto fijo y tasa para moneda/fecha |
| `POST /api/pagos/reportar` | Reportar pago y comprobante |
| `GET /api/pagos/historial/:id_rep` | Historial accesible por rol/propiedad |
| `GET /api/pagos/captura/:id_pago` | Comprobante privado autorizado |
| `GET /api/directiva/cobros/conciliacion/atletas` | Atletas para inicio de cobro |
| `POST /api/directiva/cobros/anclas/:id_atleta` | Registrar inicio después de revisar |
| `POST /api/directiva/cobros/mensualidades` | Emitir mensualidad concreta |
| `GET /api/directiva/cobros/catalogo` | Catálogo de conceptos |
| `PATCH /api/directiva/cobros/catalogo/:codigo` | Cambiar tarifa / reactivar |
| `DELETE /api/directiva/cobros/catalogo/:codigo` | Retirar/archivar de forma segura |
| `POST /api/directiva/cobros/cargos` | Asignar cargo específico |
| `GET /api/directiva/cobros/tasas/referencias` | Consultar referencias de cambio |
| `POST /api/directiva/cobros/tasas/publicar-referencia` | Fijar referencia con confirmación |
| `PUT /api/directiva/pago/vinculado/estado` | Revisar reporte vinculado |
| `GET /api/directiva/deportes/catalogo` | Catálogos deportivos |
| `GET /api/directiva/deportes/asignaciones` | Movimientos de equipos |
| `GET /api/directiva/atletas/planilla-general` | Planilla general |
| `GET /api/cms/public/eventos` | Calendario público |
| `GET /api/cms/public/noticias` | Noticias públicas |

**Regla:** la navegación del panel es por `data-target` e IDs de secciones. Las rutas HTTP están en `routes/`; comprobar permisos exactos allí y en los controladores antes de hacer peticiones. Una respuesta `401` significa sin sesión; `403`, sin autorización.

## 7. Datos importantes en Supabase

- `usuarios`, `atletas`: cuentas y deportistas.
- `temporadas`, `categorias`, `equipos` y asignaciones: estructura deportiva.
- `conceptos_cobro`: precios base; `anclas_cobro_atleta`: inicio; `obligaciones_cobro`: deuda **congelada**.
- `pagos`: intentos de pago y estados. `pagos.id_obligacion` vincula reportes nuevos; históricos pueden tener `NULL`.
- `tasas_cobro`: referencia aplicada y registrada; `referencias_cambio_diarias`: caché de consulta del proveedor, **no equivale a un pago**.
- `eventos`, `notificaciones` y demás tablas de contenido.

Nunca unir históricos a obligaciones por su nombre de mes sin una conciliación explícita. No borrar manualmente pagos, comprobantes, tasas o conceptos con relaciones vigentes.

## 8. Privacidad, mantenimiento y despliegue

- Fotos, documentos y comprobantes nuevos usan **Cloudinary authenticated**, con validación de propiedad y enlaces firmados temporales. Los ficheros históricos pueden tener compatibilidad antigua; revisar antes de migrarlos.
- **Preview puede compartir la misma Supabase y Cloudinary que Production.** Navegar o consultar sí; crear, aprobar, borrar o reportar pagos en Preview puede afectar datos reales.
- Trabajar en rama, abrir PR, esperar CI, revisar Preview, fusionar **solo después de autorización**, verificar SHA/despliegue y hacer pruebas de lectura.
- Cualquier migración SQL requiere respaldo recuperable, preflight y ejecución **manual**; Vercel no actualiza tablas por fusionar un PR.
- En GitHub Actions ver `.github/workflows/verificacion.yml` para pruebas backend con PostgreSQL temporal, sintaxis Node y Playwright escritorio/móvil.
- No subir API keys, cookies, documentos de menores, capturas bancarias ni datos sensibles a Git, capturas de CI o ejemplos de documentación.

## 9. Capturas y enseñanza visual

Esta guía enlaza **rutas y secciones reales**, sin capturas autenticadas de usuarios. Si se desea una edición visual, hacer las capturas **en un entorno de pruebas con datos ficticios**, ocultando nombre, cédula, correo, referencias bancarias, documentos y URLs firmadas.

Capturas recomendadas: (1) Inicio Directiva; (2) Gestión de atletas; (3) Catálogos y equipos; (4) Conciliación e inicio de cobros; (5) Conceptos y tasas; (6) Reportar pago; (7) Estado de cuenta; (8) Auditoría y decisión; (9) Vista móvil de ambos paneles. Guardarlas solo después de revisarlas y, si van al repo, en una carpeta de documentación separada.

## 10. Ejercicios para estudiar el código

1. **Atleta:** localizar el formulario de Registro -> ruta de `atletaRoutes.js` -> controlador -> tablas -> prueba PostgreSQL correspondiente.
2. **Mensualidad:** localizar `gestion-cobros.js` -> `directivaRoutes.js` -> `cobrosController.js` -> `obligaciones_cobro`.
3. **Reporte Bs:** `pagos-guiados.js` -> `pagosRoutes.js` -> `cotizadorObligaciones.js` -> `pagosVinculadosController.js` -> `pagos` / `tasas_cobro`.
4. **Aprobación:** tabla de auditoría -> `pagosVinculadosRevisionController.js` -> estado de cuenta y notificación.
5. **Seguridad:** simular 401 sin sesión y 403 con un representante ajeno, siempre sobre datos sintéticos.

**Límites actuales:** la conciliación histórica es manual; no hay automatización general de mensualidades para todos los atletas ni conciliación bancaria automática, pagos parciales o contabilidad de tres estados. Una mejora futura debe tener reglas acordadas antes de cambiar la base.
