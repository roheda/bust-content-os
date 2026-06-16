# BUST Content OS — Operational v2.3

## Asignación

- Se puede asignar desde la ventana de detalle.
- Se elimina la edición de fecha límite desde la tabla de asignación.
- La fecha límite del lote permanece definida desde Creador de Solicitudes.

## Producciones

Nuevo flujo después de crear producción:

1. Crear producción con solicitudes incluidas.
2. Entrar a “Completar material”.
3. Agregar links o archivos del material producido.
4. Guardar material o marcar “Material entregado”.
5. Al marcar material entregado:
   - las solicitudes incluidas reciben el material,
   - quedan en `material_listo`,
   - ya se pueden asignar en Asignación.

## Lógica

La producción no termina al calendarizarse. Termina cuando el material queda cargado y entregado.
