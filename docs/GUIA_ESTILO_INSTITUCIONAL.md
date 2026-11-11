# Jaguares — patrón visual institucional

## Criterio aprobado

El propietario validó la dirección visual sobria después del PR #41: un sistema
administrativo de club deportivo, no una landing ni un folleto. Usar el token
de marca **`#FF4500`** ya definido en `public/style.css`, tipografía Poppins,
superficies blancas, límites discretos, espaciado consistente y pocos iconos.
**No introducir** hero, banner, degradados decorativos, iconos por cada etiqueta
ni componentes sin una función verificable.

## Alcance de este PR

- Organización Deportiva: botones «Agregar» alineados verticalmente dentro de
  tarjetas de altura consistente, manteniendo sus formularios, listados, edición
  y cancelar. En móvil los módulos se apilan.
- Gestión de Atletas: reemplazar botones de texto por acciones compactas
  reutilizando `window.JaguaresIconos` de
  `public/admin/iconos-acciones.js`, ya empleado en pagos.
  Cada icono tiene `aria-label`, `title` y conserva el permiso/estado
  previo. WhatsApp sigue siendo enlace externo; no se añade una acción nueva
  de edición de atleta ni se permite cambiar datos con un icono ficticio.
- Formularios (directiva y representante): primera fila
  **nombres / apellidos / cédula**, segunda
  **fecha de nacimiento / dirección / teléfono**.
  El indicador de categoría sigue debajo de fecha; alergias/condiciones
  médicas permanece a todo el ancho; los tres adjuntos comparten fila.
  Solo se cambia la presentación, no los controles, validaciones, archivos
  ni los datos del POST.
- Barra lateral de **ambos roles** con entradas accesibles y grupos
  desplegables. Directiva mantiene Club y atletas / Administración;
  representantes usan Club y atletas / Mis pagos y perfil directo.
  «Inicio» usa icono de casa en ambos roles; el logotipo solo identifica
  marca, evitando accesos redundantes.
- El naranja principal del sistema se alinea con el homepage; los estados
  aprobado/inactivo/rechazado conservan colores semánticos discretos.

## No incluido

No se tocan endpoints, JWT, Supabase, Cloudinary, lógica deportiva,
reportes PDF ni permisos. No existe nueva migración SQL.
No añadir botones sin acción.

## Ensayo mínimo en Preview

1. Confirmar rama y deploy Preview correcto; no hacen falta variables nuevas.
2. Directiva: Organización Deportiva → tres botones Agregar en la misma línea,
   catálogos y edición funcionales. Verificar versión móvil apilada sin desborde.
3. Gestión de Atletas: iconos compactos permiten abrir planilla, WhatsApp,
   aprobar un atleta en espera e inactivar uno activo **solo con datos
   sintéticos autorizados**; no ejecutar acciones de estado sobre atletas
   reales para la prueba. Los botones disponibles dependen del estado.
4. Registro: comprobar fechas, categoría, dirección, teléfono y adjuntos en
   ambos roles. En teléfono una columna; escritorio tres. Sin necesidad
   de enviar nueva inscripción.
5. Representante: abrir/cerrar grupos, navegar a registro, pagos, historial,
   eventos y perfil. Directiva: mismo chequeo breve de sus grupos.
6. Regresión breve: un pago, un documento privado y la planilla individual.

## Siguiente funcionalidad

La planilla general PDF por categoría, con la selección aplicada en
Gestión de Atletas. Sigue especificada en
`docs/UX_OPERATIVA_Y_PLANILLA_GENERAL.md`: requiere resolver
alcance de estados y búsqueda antes de implementarla.
