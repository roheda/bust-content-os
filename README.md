# BUST Content OS — Operational v2.8

## Corrección de estado después de producción

Antes, una solicitud con producción podía seguir apareciendo como `produccion_programada` en Asignación aunque ya tuviera material entregado.

Se corrigió la lógica:

- Si la solicitud tiene estado `material_listo`, ahora aparece como **Lista para asignar**.
- Si requiere producción pero ya tiene material, también aparece como **Lista para asignar**.
- Si sigue sin material, permanece como **Producción programada** o **Pendiente producción**.

## Flujo correcto

Producciones:
1. Completar links por post.
2. Marcar material entregado.
3. La solicitud queda en `material_listo`.

Asignación:
1. La solicitud aparece como **Lista para asignar**.
2. El jefe de área ya puede asignarla.
