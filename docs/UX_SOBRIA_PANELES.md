# UX sobria de Jaguares — catálogos, atletas y navegación

## Objetivo del PR

Aplicar el feedback visual del propietario tras validar el PR #41 y los mockups
de referencia. Mantener un **panel deportivo serio**, sin banners, degradados
promocionales, iconos decorativos en cada encabezado ni un diseño infantil.
Preservar la paleta consolidada: fondo neutro, sidebar oscuro y acentos naranjas
del club mediante las variables CSS existentes (principalmente `--naranja`).

## Cambios concretos

- **Organización Deportiva:** mismas tres tarjetas y funciones de alta/edición
  pero con los botones «Agregar» a una línea común en escritorio, pese al selector
  extra de Categorías/Equipos. En móvil, recuperar tamaños naturales para evitar
  espacios en blanco.
- **Gestión de Atletas:** reutilizar los iconos SVG de
  `public/admin/iconos-acciones.js` y las clases `pago-icono`
  utilizadas en la auditoría de pagos. Planilla = icono documento;
  Aprobar = icono aprobar; Inactivar = icono rechazar; WhatsApp mantiene
  el icono de marca ya empleado. Botones con `title` y `aria-label`.
  Cada acción conserva la lógica anterior de disponibilidad por estado;
  no se introduce un botón ficticio «Editar» ni nuevas autorizaciones.
- **Alta de atletas (ambos roles):** primera fila Nombres, Apellidos, Cédula;
  segunda fila Fecha de nacimiento, Dirección, Teléfono; observaciones médicas
  completas y documentos en un bloque de tres entradas. La categoría por edad
  permanece bajo la fecha y muestra solo edad para el caso normal. Avisos
  de U-15 masculina, 16–18 sin categoría y fechas inválidas permanecen completos.
  Responsive: 3 columnas escritorio, 2 intermedio, 1 móvil. El formulario de
  representante nuevo de directiva conserva sus campos y su funcionalidad.
- **Navegación de representante:** Inicio directo con icono de casa;
  grupos «Atletas y pagos» (Registrar atleta, Reportar pago, Mi historial)
  e «Información» (Eventos, Mi perfil); Cerrar sesión directo.
  La directiva conserva «Club y atletas» y «Administración»; Inicio cambia
  del icono de gráficos al de casa. No se hace navegable el logo para evitar
  dos enlaces redundantes a Inicio. Uso de `aria-expanded`, teclado y cierre
  de sidebar al seleccionar una sección en móvil.
- Se actualizan exclusivamente pruebas que hacen clic físicamente en elementos
  antes visibles y ahora protegidos por un submenú.

## Reglas de seguridad y límites

Sin cambios SQL, registros, variables Vercel, endpoints, comprobantes,
permisos, Cloudinary, validaciones de formulario o archivos de atletas.
No reemplazar formularios `multipart` por nuevas interfaces. No modificar
las reglas de categoría/fecha ni el motor de planilla individual.
Se conserva pendiente la **planilla general por categoría** documentada
en `docs/UX_OPERATIVA_Y_PLANILLA_GENERAL.md`: es un PR independiente.

## Aceptación manual en Preview — breve

1. Directiva: Organización Deportiva en escritorio (los tres Agregar alineados)
   y móvil (tarjetas apiladas, sin vacíos artificiales). Edición y cancelar
   deben continuar igual.
2. Directiva: Gestión de Atletas conserva filtros y cuenta de resultados.
   Planilla/WhatsApp/Aprobar/Inactivar se ven como botones compactos con
   iconos consistentes; en activo no se ofrece Aprobar, en inactivo no
   se ofrece Inactivar. Una prueba de Planilla es suficiente; no hace
   falta cambiar estados de atletas reales.
3. Directiva y representante: revisar seis campos en dos filas de tres
   en escritorio; indicador de categoría bajo fecha; en móvil campos
   uno debajo del otro y archivos siempre accesibles.
4. Representante: probar grupos del sidebar en escritorio y móvil,
   abrir Historial, Eventos y Perfil; comprobar que el onboarding de
   perfil incompleto sigue bloqueando las acciones indicadas.
5. Regresión mínima: comprobante, planilla individual y acceso a pagos.

No crear atletas ni pagos nuevos, no ejecutar SQL y no tocar Production
para comprobar este PR. No fusionar hasta CI completo y prueba en Preview.
