# v67 · Scroll en menú lateral

Se ajustó `AppShell` para que la navegación del sidebar tenga un contenedor interno con scroll.

## Problema
En pantallas con altura limitada, las opciones inferiores desde “Administración” podían quedar fuera de vista y el sidebar no permitía hacer scroll.

## Cambio
- Se agregó `sidebar-main-scroll` alrededor del bloque de marca + navegación.
- El sidebar conserva el perfil/sesión abajo.
- La navegación ahora puede desplazarse verticalmente sin romper el layout.
- Funciona también en menú móvil.
