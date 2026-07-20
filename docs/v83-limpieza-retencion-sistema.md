# v8.3 — Limpieza y retención del sistema

## Objetivo
Mantener limpio BUST Content OS sin perder historial por error.

## Cambios principales

### Creador de Solicitudes
- `Lotes realizados para reusar` ahora muestra por default solo los últimos lotes configurados.
- Default: 5 lotes recientes.
- Botón `Ver historial completo` para consultar lotes anteriores.
- Los lotes eliminados/ocultos ya no aparecen por default.
- Si un lote ya no tiene solicitudes activas, se oculta de reuso cuando la limpieza está configurada para ocultar eliminados.
- Se agregó botón `Eliminar de reuso` para ocultar un lote específico de la lista de reutilización sin borrar sus solicitudes operativas.

### Configuración
- Nueva sección: `Limpieza y retención`.
- Configurable:
  - últimos lotes para reusar;
  - días de retención de eliminados;
  - ocultar eliminados por default;
  - preparación para borrado automático por retención.
- Botón manual `Borrar eliminados antiguos` para eliminar definitivamente solicitudes y lotes ya marcados como eliminados que superen la retención.

### Eliminadas
- La papelera ahora permite:
  - ver recientes o todas;
  - restaurar solicitudes eliminadas;
  - borrar definitivamente una solicitud específica;
  - borrar definitivamente solicitudes eliminadas que superen la retención.

### Firebase
- Se agrega colección `systemSettings/cleanupRetention` para guardar las reglas de limpieza.
- Se actualizan reglas Firestore para que usuarios activos puedan leer configuración y solo Configuración/Master pueda modificarla.

## Default recomendado
- Mostrar últimos lotes realizados: 5.
- Retención eliminados: 60 días.
- Ocultar eliminados por default: sí.
