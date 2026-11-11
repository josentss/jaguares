# Asignación manual de atletas a equipos

## Reglas aprobadas el 11 de noviembre de 2026

- Un atleta puede tener **un equipo activo por temporada**. Puede figurar en
  temporadas diferentes sin que una sustituya a la otra.
- Solo un atleta con estado `activo` puede recibir o cambiar asignación.
  La inactivación posterior no borra ni cierra automáticamente su historial;
  la plantilla muestra su estado para que directiva lo revise.
- Solo `directiva` y `admin` pueden consultar, asignar y cambiar. `staff` puede
  seguir editando catálogos, pero no asignar atletas.
- La categoría calculada por edad es una ayuda visual. No bloquea ni asigna
  automáticamente un equipo; U-15 mantiene su aviso de validación.
- Cambiar de equipo dentro de una temporada cierra el registro anterior y
  crea otro. El historial conserva ambos con fecha y hora; la interfaz presenta
  la fecha civil de Caracas. No hay borrado de asignaciones.

## Migración manual

Archivo: `migrations/2026-11-11_asignaciones_equipos.sql`. Crea una tabla nueva
con FK restrictivas, autor de asignación/cierre y un índice único parcial para
impedir dos equipos activos en la misma temporada. No modifica tablas previas
ni se ejecuta automáticamente desde Node o Vercel.

**No ejecutar en Production sin respaldo recuperable y autorización expresa.**
Si Preview comparte la misma Supabase, ejecutar allí también modificaría el
esquema de Production. Antes de aplicar, confirmar el destino, respaldar,
revisar el esquema efectivo y ejecutar solo el archivo completo. La migración
es repetible respecto al mismo diseño, no reconcilia esquemas divergentes.
No contiene `DROP`, `DELETE` ni `TRUNCATE`.

Comprobación de solo lectura después de aplicar:

```sql
SELECT to_regclass('public.asignaciones_equipos') IS NOT NULL AS asignaciones;
```

Sin migración, el nuevo panel muestra un error claro y los catálogos existentes
continúan disponibles.

## API y UX

- `GET /api/directiva/deportes/asignaciones`: atletas con nombre, nacimiento y
  estado, más asignaciones vigentes e históricas. No devuelve contacto,
  documentos, datos médicos ni pagos.
- `POST /api/directiva/deportes/asignaciones` con `{id_atleta,id_equipo}`:
  vuelve a validar rol, estado, equipo y temporada en una transacción. Bloquea
  la fila del atleta para serializar cambios y conserva la asignación anterior.
- Organización Deportiva incorpora temporada, atleta y equipo; muestra la
  plantilla vigente de la temporada y el historial del atleta seleccionado.
  Los atletas inactivos pueden consultarse, pero el botón se deshabilita.

## Ensayo breve en Preview

Usar únicamente atletas y equipos sintéticos en una base aislada. Seleccionar
una temporada, asignar un atleta activo al Equipo A, cambiarlo al Equipo B y
recargar. Debe aparecer solo B como vigente y A en el historial. Comprobar
otra temporada, un atleta inactivo, staff (sin formulario), representante (403)
y móvil. Si Preview comparte Production, no crear asignaciones de prueba allí
sin autorización separada.

## Evidencia y límites

Pruebas automatizadas con PostgreSQL temporal: migración repetible, 401/403,
validaciones, cambios, historial, segunda temporada y concurrencia. Chromium:
asignación/cambio, aviso por edad, inactivo, staff y móvil. Estas pruebas no
equivalen a aplicar la migración ni a probar datos reales en Preview o Production.
