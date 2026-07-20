"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useModulePermissions, permissionAlert } from "@/components/useModulePermissions";
import {
  CleanupRetentionSettings,
  ContentRequest,
  defaultCleanupRetentionSettings,
  getCleanupRetentionSettings,
  listRequests,
  permanentlyDeleteRequest,
  purgeDeletedRequestsOlderThan,
  updateRequest
} from "@/lib/data";

export default function DeletedPage(){
  const [items,setItems]=useState<ContentRequest[]>([]);
  const [settings,setSettings]=useState<CleanupRetentionSettings>(defaultCleanupRetentionSettings);
  const [showAll,setShowAll]=useState(false);
  const [busy,setBusy]=useState(false);
  const permissions = useModulePermissions("reportes");
  const canDelete = permissions.canDelete || permissions.canConfigure || permissions.canEdit;

  async function load(){
    const [loadedRequests,loadedSettings] = await Promise.all([listRequests(),getCleanupRetentionSettings()]);
    setItems(loadedRequests.filter(x=>x.status==="eliminada"));
    setSettings(loadedSettings);
  }
  useEffect(()=>{load()},[]);

  const recentItems = useMemo(()=>{
    if(showAll)return items;
    return items.slice(0, 50);
  },[items,showAll]);

  async function restoreItem(item:ContentRequest){
    if(!canDelete)return permissionAlert("restaurar solicitudes eliminadas");
    if(!item.id)return;
    const ok = confirm(`¿Restaurar "${item.topic}"? Volverá a Asignación como pendiente.`);
    if(!ok)return;
    await updateRequest(item.id,{status:item.requiresProduction?"pendiente_produccion":"lista_asignacion",deletedAt:"",deletedReason:""});
    await load();
  }

  async function hardDeleteItem(item:ContentRequest){
    if(!canDelete)return permissionAlert("borrar definitivamente solicitudes eliminadas");
    if(!item.id)return;
    const ok = confirm(`¿Borrar definitivamente "${item.topic}"? Esta acción no se puede deshacer.`);
    if(!ok)return;
    await permanentlyDeleteRequest(item.id);
    await load();
  }

  async function purgeOld(){
    if(!canDelete)return permissionAlert("borrar definitivamente solicitudes antiguas");
    const days = Math.max(1,Number(settings.deletedRetentionDays||60));
    const ok = confirm(`Se borrarán definitivamente solicitudes eliminadas con más de ${days} días. ¿Continuar?`);
    if(!ok)return;
    setBusy(true);
    try{
      const count = await purgeDeletedRequestsOlderThan(days);
      alert(`Limpieza terminada. Solicitudes borradas definitivamente: ${count}.`);
      await load();
    }finally{setBusy(false)}
  }

  return <AppShell active="Eliminadas">
    <section className="hero">
      <div>
        <p className="eyebrow">Rastreabilidad</p>
        <h1>Solicitudes eliminadas</h1>
        <p>Papelera operativa. Las solicitudes eliminadas se ocultan del flujo normal y pueden borrarse definitivamente después de la retención configurada.</p>
      </div>
      <div className="config-actions">
        <button className="btn" onClick={()=>setShowAll(v=>!v)}>{showAll?"Mostrar recientes":"Ver todas"}</button>
        <button className="btn red" onClick={purgeOld} disabled={busy || !canDelete}>{busy?"Limpiando...":`Borrar +${settings.deletedRetentionDays||60} días`}</button>
      </div>
    </section>
    <section className="report-section">
      <h3>Eliminadas</h3>
      <p className="mini">Retención configurada: {settings.deletedRetentionDays||60} días. Mostrando {recentItems.length} de {items.length} eliminadas.</p>
      <table className="table">
        <thead><tr><th>Cliente</th><th>Lote</th><th>Tipo</th><th>Motivo</th><th>Fecha eliminación</th><th>Acciones</th></tr></thead>
        <tbody>{recentItems.map(item=><tr key={item.id}>
          <td>{item.clientName}</td>
          <td>{item.batchName||"Sin lote"}</td>
          <td>{item.contentType}</td>
          <td>{item.deletedReason||"Sin motivo"}</td>
          <td>{formatDeletedAt(item.deletedAt)}</td>
          <td><button className="btn" onClick={()=>restoreItem(item)} disabled={!canDelete}>Restaurar</button><button className="btn red" onClick={()=>hardDeleteItem(item)} disabled={!canDelete}>Borrar definitivo</button></td>
        </tr>)}</tbody>
      </table>
      {!items.length && <p className="mini">No hay solicitudes eliminadas.</p>}
    </section>
  </AppShell>
}

function formatDeletedAt(value?:string){
  if(!value)return "Sin fecha";
  const date = new Date(value);
  if(Number.isNaN(date.getTime()))return value;
  return date.toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"});
}
