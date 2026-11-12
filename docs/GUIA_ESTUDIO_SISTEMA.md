# Guía de estudio — Sistema de gestión Club Jaguares

**Objetivo:** explicar cómo está organizado Jaguares, qué resuelve cada módulo y cómo seguir una operación desde el navegador hasta PostgreSQL. Es una guía para estudiar el sistema, no una instrucción para ejecutar cambios en Production.

## 1. Visión general

Jaguares es una aplicación web de administración del club de voleibol. Tiene una página pública y dos paneles privados:

- **Directiva:** revisión de inscripciones, atletas, organización deportiva, pagos, eventos y administración.
- **Representante:** inscripción y consulta de sus atletas, documentos autorizados, reportes de pagos, historial y estado de cuenta.
- **Público:** información institucional y eventos sin acceso a datos privados.

En el repositorio se usa **Node.js/Express** en el servidor, HTML/CSS/JavaScript en el navegador, **PostgreSQL (Supabase)** para datos, **Cloudinary** para archivos privados y **Vercel** para despliegue. El servidor y el navegador comparten un dominio; las llamadas API comienzan por `/api/`.

```text
Navegador (página pública, paneles)
  └── /api/... (Express)
        ├── Middleware de sesión / rol
        ├── Routes -> Controllers
        ├── PostgreSQL / Supabase
        └── Cloudinary para documentos y comprobantes
```

## 2. Archivos para leer, en este orden

| Archivo o carpeta | Qué estudiar |
|---|---|
| [index.js](../index.js) | Arranque del servidor, montaje de rutas, seguridad del origen y manejo de errores |
| [config/db.js](../config/db.js) | Conexión a PostgreSQL y compatibilidad de consultas existentes |
| [middlewares/authMiddleware.js](../middlewares/authMiddleware.js) | Autenticación, comprobación de roles y respuestas 401/403 |
| [routes/](../routes) | Lista de endpoints y middlewares que protegen cada operación |
| [controllers/](../controllers) | Reglas de negocio, validaciones, operaciones SQL |
| [public/admin/panel-directiva.html](../public/admin/panel-directiva.html) | Navegación y módulos del panel Directiva |
| [public/admin/panel-representante.html](../public/admin/panel-representante.html) | Navegación y formularios del Representante |
| [public/admin/api-client.js](../public/admin/api-client.js) | Función `apiFetch`, sesión y llamadas del frontend |
| [migrations/](../migrations) | Cambios controlados de esquema; no se ejecutan por desplegar |
| [tests/](../tests) | Pruebas unitarias, integración PostgreSQL y navegador |

No es necesario leer todos los archivos de una vez: sigue un caso de uso y busca sus rutas, controlador y pruebas.

## 3. Sesión, permisos y seguridad

1. El usuario inicia sesión en `/api/auth`.
2. El navegador conserva la sesión mediante cookies, no por un ID de representante editable en la interfaz.
3. Los middlewares verifican el token, el rol y que la cuenta siga autorizada en PostgreSQL.
4. Los controladores vuelven a verificar la propiedad de los datos sensibles (por ejemplo, solo el representante dueño del atleta).
5. Sin sesión, una API privada responde **401**; sin permiso, **403**.

La pertenencia de un atleta se determina en la base de datos. No confundir ocultar un botón con **control de acceso real**: el backend debe validar siempre.

Los comprobantes, fotos y documentos nuevos se almacenan en Cloudinary como `authenticated`. Su acceso pasa por endpoints que comprueban permisos y emiten enlaces temporales. Los datos antiguos pueden tener tratamientos de compatibilidad; no retirar esa capa sin pruebas.

## 4. Funciones principales

### Registro y atletas
Un representante aprobado puede registrar atletas. La Directiva revisa/actualiza los estados conforme a los permisos del backend. El sistema valida datos personales, edad, cédula y campos de inscripción. La categoría por edad es una **orientación**, diferente de asignar al atleta formalmente a un equipo.

### Organización deportiva
Existen **temporadas, categorías y equipos**, asociados en ese orden. La asignación de un atleta a un equipo se guarda como un movimiento con fechas de inicio y cierre. La consulta de plantillas y la exportación PDF utilizan esos registros; no confundir asignación formal con categoría automática.

### Pagos anteriores (flujo histórico)
El Representante registra un mes por **nombre**, importe, moneda, método y fecha; si corresponde adjunta comprobante. Directiva puede aprobar/rechazar y consultar el comprobante. El historial conserva los registros y estados. Importante: `mes_pagado = "Noviembre"` **no identifica el año, la deuda exacta ni el concepto**; tampoco dos reportes del mismo mes equivalen necesariamente a un cobro duplicado.

### Nuevo sistema de obligaciones (PR #50–53)
Los componentes son:

- `conceptos_cobro`: tarifa de referencia por concepto, como inscripción, mensualidad, torneo, arbitraje y sanción.
- `anclas_cobro_atleta`: fecha desde la que se empezará a cobrar y día nominal de vencimiento de cada atleta.
- `obligaciones_cobro`: deuda concreta asociada a atleta/concepto, período en caso de mensualidad, importe USD **congelado**, vencimiento y fecha límite.
- `pagos.id_obligacion`: vínculo opcional del pago a una obligación. Los pagos históricos tienen `NULL` y se conservan.

**PR #50:** creó las tablas/índices y preservó el historial. Su migración se aplicó manualmente en Supabase.

**PR #51:** agregó el motor de vencimientos y consulta con permisos. Solo Directiva/Admin pueden configurar anclas y crear una mensualidad por atleta/mes usando confirmación expresa. No hay generación automática de deuda.

**PR #52:** agregó la sección Directiva de conciliación: ver pagos históricos del atleta, revisar los registros y configurar el inicio de cobro. No convierte los pagos anteriores ni crea obligaciones por abrir la pantalla.

**PR #53 (fusionado):** agrega **Estado de cuenta** al Representante, de solo lectura, para consultar obligaciones propias y sus estados. Conserva separado el formulario antiguo de reportes hasta que exista un flujo vinculado fiable.

### Estados financieros y vencimientos
Para una mensualidad del período noviembre con ancla día 15:
- Vence el **15/11**.
- Tiene plazo hasta el **30/11**.
- Si no fue pagada ni reportada para revisión, desde el **01/12** puede figurar vencida.
- Un pago reportado y todavía no aprobado figura **en revisión**, no como pagado.

No hay sanciones automáticas por mora, no se desactivan cuentas por deuda y el pago tardío no cambia por sí mismo la fecha ancla. En febrero, los días ancla 29–31 se ajustan al último día del mes.

### Reporte vinculado (PR #54, en revisión)
El representante puede elegir una obligación concreta desde **Reportar pago**. El navegador muestra el precio USD y el servidor comprueba la propiedad y que no haya pago activo anterior. El reporte queda `pendiente`; Directiva revisa y decide si aprobar o rechazar. El rechazo no elimina el intento.

En efectivo USD el monto declarado debe ser exactamente el del cargo. En Bs y COP se registra el monto real y Directiva confirma manualmente la equivalencia antes de aprobar; **no se utiliza la tasa errónea de 36,50 del dashboard**. Falta definir e incorporar un registro verificable de fuente, fecha y tasa de conversión.

Los atletas sin cobros configurados siguen con el formulario histórico; cuando haya ancla u obligaciones, el servidor exige reporte vinculado. No confundir un reporte *en revisión* con un pago aprobado.

## 5. Por qué todavía no se deben conciliar pagos de forma automática

Los pagos antiguos no incluyen un identificador inequívoco `año/mes/concepto`. Algunos atletas tienen reportes del mismo mes con estados distintos. No podemos deducir que se pagó una mensualidad o inscripción específica usando solamente el nombre del mes, el importe o la fecha.

La Directiva debe confirmar el inicio por atleta **después de revisar el historial**. Ante incertidumbre, dejar el inicio sin configurar. El nuevo formulario del Representante no debe afirmar que una obligación está pagada hasta que exista un reporte **vinculado** y aprobado.

Las tarifas son nominales en USD; **no usar una tasa ficticia o un respaldo fijo de 36,50 Bs/USD para liquidar obligaciones**. La política de conversión, pagos parciales y tratamiento de moneda debe definirse antes de habilitar reportes guiados.

## 6. Seguir una petición paso a paso

Ejemplo de **consulta de obligaciones del atleta 31**, solo cuando pertenece al representante autenticado:

1. Vista del Representante: [estado-cuenta.js](../public/admin/estado-cuenta.js).
2. Petición `GET /api/pagos/obligaciones/31`.
3. Ruta en [routes/pagosRoutes.js](../routes/pagosRoutes.js).
4. Sesión verificada y autorización por propiedad en [controllers/cobrosController.js](../controllers/cobrosController.js).
5. Consulta a `anclas_cobro_atleta`, `obligaciones_cobro` y estados de pagos vinculados.
6. La pantalla muestra las obligaciones recibidas. **No escribe datos.**

Para estudiar la conciliación de Directiva, seguir `public/admin/conciliacion-cobros.js` -> `routes/directivaRoutes.js` -> `controllers/cobrosConciliacionController.js`.

## 7. Pruebas y despliegue seguro

El repositorio usa GitHub Actions con Node y PostgreSQL temporal; algunas pruebas usan Playwright en escritorio y móvil. La configuración está en [.github/workflows/verificacion.yml](../.github/workflows/verificacion.yml).

Flujo de desarrollo recomendado:
1. Crear una rama a partir del `main` vigente.
2. Limitar el PR a un módulo o cambio coherente.
3. Agregar o actualizar pruebas.
4. Esperar CI y revisar Preview; una vista Preview **puede compartir Supabase Production**.
5. No ejecutar operaciones de escritura de prueba sobre la base compartida sin acuerdo explícito.
6. Tras autorización, fusionar el PR y comprobar despliegue y regresiones.
7. Las migraciones PostgreSQL deben aplicarse **manualmente tras respaldo y preflight**, nunca asumir que Vercel las aplica.

Si algo falla: identificar URL y método, código HTTP, rol autenticado, logs del servidor, consulta SQL correspondiente y prueba que cubre el caso. No publicar tokens, cadenas de conexión, claves ni documentos personales en issues o capturas.

## 8. Catálogo editable, asignación y tasa por fecha (PR #55, en revisión)

Al registrar un concepto, la Directiva establece nombre y precio nominal USD. «Inscripción» y «Mensualidad» están reservados; los conceptos adicionales se clasifican como **cargos manuales**. La Directiva puede desactivarlos o ajustar su precio, pero los cargos emitidos ya conservan su importe.

La Directiva selecciona un atleta con inicio configurado y emite un cargo (manual, inscripción única o mensualidad). Solo después aparece en el Representante como **tipo de pago → cargo concreto**. Los meses que no han sido asignados no aparecen. Tampoco aparece el formulario antiguo de doce meses para atletas sin configurar.

El servidor calcula el importe USD de la obligación. Para bolívares o pesos exige tasa por USD registrada por Directiva para esa **fecha civil** (America/Caracas), con fuente y registro inmutable. La tasa no se deduce del dashboard ni se inventa. La cotización del navegador es informativa: el servidor recalcula todo al recibir el pago y rechaza importes manipulados.

Antes del merge hay que aplicar manualmente la migración de catálogo y tasas en Supabase; el CI se ejecuta sobre un PostgreSQL temporal. Nunca probar emisiones o registros de tasa en Preview cuando comparte la base de Production.

## 9. Próximas decisiones funcionales

La pantalla de Estado de cuenta **no es aún un formulario de pago vinculado**. Para completar el ciclo obligación -> reporte -> revisión -> pago, falta:
- Conciliar de forma explícita los históricos y resolver inscripciones ya pagadas.
- Definir moneda y fuente de tasa verificable; política de importes parciales.
- Enviar reportes vinculados a `id_obligacion`, impedir reportes simultáneos y permitir reenviar tras rechazo sin perder trazabilidad.
- Mostrar el saldo de forma correcta, sin confundir «en revisión» con «pagado».
- Conservar la protección Cloudinary y las revisiones de Directiva existentes.

**Regla para estudiar:** el código actual es la fuente de verdad. Esta guía explica los flujos; ante discrepancias, buscar el endpoint, su controlador y sus pruebas antes de afirmar que una función ya está operativa.
