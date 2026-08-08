// Fuente compartida del color/etiqueta por estado de ContentRequest.
// Extraído de Asignación (donde vivía duplicado) para que otros módulos
// puedan reusar el mismo mapeo en vez de definir el suyo propio.
//
// Nota: esta lista no coincide 1:1 con `requestStates` de lib/data.ts
// (a esta lista le faltaba "pendiente_copy"; a requestStates le falta
// "pendiente_aprobacion"). Se conserva tal cual para no cambiar
// comportamiento visual existente sin una decisión de producto explícita.
export const requestStatusOptions = [
  { value: "lista_asignacion", label: "Pendiente de asignación / Material listo" },
  { value: "pendiente_produccion", label: "Pendiente producción" },
  { value: "produccion_programada", label: "Producción programada" },
  { value: "material_listo", label: "Material listo" },
  { value: "bloqueada", label: "Bloqueada" },
  { value: "asignada", label: "Asignada" },
  { value: "en_ejecucion", label: "En ejecución" },
  { value: "en_revision", label: "En revisión" },
  { value: "pendiente_aprobacion", label: "Aprobación Content" },
  { value: "pendiente_aprobacion_kam", label: "Aprobación KAM" },
  { value: "aprobada_pendiente_copyout", label: "En Contenidos" },
  { value: "rebotada", label: "Rebotada" },
  { value: "lista_programar", label: "Lista para programar" },
  { value: "programada", label: "Programada" },
  { value: "publicada", label: "Publicada" },
  { value: "finalizada", label: "Finalizada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "eliminada", label: "Eliminada" },
];

export const requestStatusColor: Record<string, string> = {
  lista_asignacion: "teal",
  pendiente_produccion: "orange",
  produccion_programada: "purple",
  material_listo: "green",
  bloqueada: "red",
  asignada: "blue",
  en_ejecucion: "cyan",
  en_revision: "amber",
  pendiente_aprobacion: "violet",
  pendiente_aprobacion_kam: "pink",
  aprobada_pendiente_copyout: "lime",
  rebotada: "red",
  lista_programar: "sky",
  programada: "slate",
  publicada: "emerald",
  finalizada: "green",
  cancelada: "red",
  eliminada: "gray",
};

export function getRequestStatusLabel(status: string) {
  return requestStatusOptions.find((item) => item.value === status)?.label || status;
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${requestStatusColor[status] || "gray"}`}>{getRequestStatusLabel(status)}</span>;
}
