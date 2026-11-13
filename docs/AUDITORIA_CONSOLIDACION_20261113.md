# Auditoría de consolidación y próximos límites

**Fecha:** 13/11/2026 · **Alcance:** PR de consolidación sobre PR #59, sin migraciones y sin modificar Supabase Production.

## Cambios verificables de este PR

| Área | Hallazgo | Acción |
|---|---|---|
| Estado de cuenta | Una nota afirmaba que los reportes no se vinculaban, contradiciendo los pagos vigentes | Eliminar nota, elemento DOM y regla CSS asociada; actualizar Playwright |
| Directiva | El resumen sugería que la tasa actual era la misma que se usa para todos los cobros | Precisar que equivalencias del dashboard son estimadas |
| Representante | El texto decía que todas las transferencias exigían tasa fijada manualmente | Indicar que el importe se calcula según la fecha del pago |
| Gestión de cobros | Tamaños de iconos y ancho de acciones redefinidos varias veces | Unificar reglas y hacer acciones táctiles de 44px en móvil |
| Tablas | Scroll horizontal funcional, difícil de recorrer con teclado | Etiquetas de región, foco visible y desplazamiento controlado |
| Tasas (servidor) | Un POST con transacción tomaba otra conexión del pool para buscar el tipo de cambio | Reutilizar el cliente transaccional, probar tres consultas concurrentes sin agotar el pool |
| Documentación | Guía técnica mezclaba estado actual con funciones ya completadas y fases antiguas | Guía de uso/estudio actualizada por módulos, roles, rutas y ejercicios |

**No se modifican:** fórmulas de conversión, tasas guardadas, estados de pagos, fechas de cobro, permisos, archivos authenticated, migraciones, esquema SQL ni respuestas de API.

## Qué no debe borrarse solo porque parezca residual

- El código de rutas y reportes **históricos**: mantiene acceso a pagos previos que carecen de `id_obligacion`.
- La entrega de documentos **históricos** y sus comprobantes: depende de compatibilidad Cloudinary y permisos; exige pruebas explícitas.
- Los estilos aparentemente repetidos entre paneles y página pública pueden tener precedencia y selectores específicos. Una limpieza global sin captura comparativa puede romper móvil.
- `public/admin/admin-script.js` da soporte a Login/Registro; no considerarlo muerto aunque no se incluya en los paneles.
- Directorios versionados `logs/` y `private_uploads/`: **requieren auditoría de datos y origen de los ficheros antes de proponer eliminación**. Podrían contener activos de prueba o datos privados. No copiar su contenido a issues, no borrarlos automáticamente.
- `docs/CONTEXTO_MAESTRO_CODEX.md` conserva anotaciones históricas que no representan el estado actual. Se añadió al inicio una sección vigente; revisar una futura separación a archivo histórico si se acuerda.

## Rendimiento: medidas que aún requieren medición

Los HTML de los paneles incorporan JavaScript en línea y varias hojas de estilo. Esto no prueba por sí solo código muerto. Su modularización o carga diferida sería un PR **independiente**, con resultados comparables de Lighthouse/Performance y pruebas de navegación.

Mediciones recomendadas, antes y después, sobre el mismo dispositivo/conexión:
- tiempo hasta primera interacción de Directiva y Representante;
- tamaño transferido inicial y solicitudes repetidas;
- apertura de Gestión de atletas, Inicio de cobros y Reportar pago;
- fluidez del scroll horizontal y uso táctil a 390px/768px;
- tasa ExchangeRate-API: una consulta diaria compartida, sin llamadas redundantes;
- descarga de PDF y comprobantes privados en móvil.

**No declarar una mejora porcentual de rendimiento sin esas mediciones.**

## Funciones de finanzas fuera del alcance

Conciliación bancaria, anulaciones/ajustes de saldos, parciales y programación de mensualidades con reglas de vencimiento son posibles fases futuras. Requieren modelo de datos, autorización y pruebas en BD aislada, no una «limpieza» automática.

## Lista de regresión de lectura segura

1. Inicio de ambos roles, navegación de teclado y móvil.
2. Lista de atletas, registro, categorías, equipos y planilla PDF.
3. Conceptos/tarifas, filtro de archivados y tasas; sin enviar cambios.
4. Estado de cuenta: `pendiente`, `en revisión`, `pagada`; comprobar que ya no hay aviso obsoleto.
5. Representante: importe en Bs/COP/USD y fechas sin enviar pagos en Preview.
6. Auditoría de pagos: visualizar comprobantes con acceso propio/ajeno; evitar modificar estados en base compartida.
7. Eventos y página pública.
8. CI verde para backend PostgreSQL y Playwright escritorio/móvil, más despliegue Preview exitoso.

Para aprender a usar el sistema, seguir [Guía de uso y estudio](GUIA_ESTUDIO_SISTEMA.md). Para las reglas financieras detalladas, [Cobros y mensualidades](COBROS_Y_MENSUALIDADES.md).
