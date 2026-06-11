# BUST Content OS — Operational v2

## Cambios principales

- Planeador IA ahora es **Creador de Solicitudes**
- Solicitudes ahora es **Asignación**
- Nueva lógica de bloqueo:
  - Si NO requiere producción, debe traer material disponible + link o archivo.
  - Si requiere producción, puede avanzar como pendiente de producción.
- Asignación permite:
  - asignar área
  - asignar responsable
  - prioridad
  - impedir asignar si falta material o producción
- Producciones permite:
  - seleccionar solicitudes que requieren producción
  - crear producción desde modal
  - ligar solicitudes a producción
  - calendario básico de producciones
- Calendario permite:
  - vista calendario
  - vista lista
  - vista por persona
  - vista producciones

## Firebase

Requiere Firestore y Storage activos.
Para demo, reglas abiertas temporalmente.
