"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useModulePermissions, permissionAlert } from "@/components/useModulePermissions";
import {
  CleanupRetentionSettings,
  ContentRequest,
  Production,
  defaultCleanupRetentionSettings,
  getCleanupRetentionSettings,
  listProductions,
  listRequests,
  permanentlyDeleteProduction,
  permanentlyDeleteRequest,
  purgeDeletedProductionsOlderThan,
  purgeDeletedRequestsOlderThan,
  updateProduction,
  updateRequest
} from "@/lib/data";

export default function DeletedPage(){
  const [items,setItems]=useState<ContentRequest[]>([]);
  const [productions,setProductions]=useState<Production[]>([]);
  const [settings,setSettings]=useState<CleanupRetentionSettings>(defaultCleanupRetentionSettings);
  const [showAll,setShowAll]=useState(false);
  const [busy,setBusy]=useState(false);
  const permissions = useModulePermissions("reportes");
  const canDelete = permissions.canDelete || permissions.canConfigure || permissions.canEdit;

  async function load(){
    const [loadedRequests,loadedProductions,loadedSettings] = await Promise.all([listRequests(),listProductions(),getCleanupRetentionSettings()]);
    setItems(loadedRequests.filter(x=>x.status==="eliminada"));
    setProductions(loadedProductions.filter(x=>x.status==="eliminada"));
    setSettings(loadedSettings);
  }
  useEffect(()=>{load()},[]);

  const recentItems = useMemo(()=>showAll?items:items.slice(0,50),[items,showAll]);
  const recentProductions = useMemo(()=>showAll?productions:productions.slice(0,50),[productions,showAll]);

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

  async function restoreProduction(item:Production){
    if(!canDelete)return permissionAlert("restaurar producciones eliminadas");
    if(!item.id)return;
    const ok = confirm(`¿Restaurar la producción "${item.title}"? Volverá al calendario de producciones.`);
    if(!ok)return;
    await updateProduction(item.id,{status:"programada",deletedAt:"",deletedReason:""});
    await load();
  }

  async function hardDeleteProduction(item:Production){
    if(!canDelete)return permissionAlert("borrar definitivamente producciones eliminadas");
    if(!item.id)return;
    const ok = confirm(`¿Borrar definitivamente la producción "${item.title}"? Esta acción no se puede deshacer.`);
    if(!ok)return;
    await permanentlyDeleteProduction(item.id);
    await load();
  }

  async function purgeOld(){
    if(!canDelete)return permissionAlert("borrar definitivamente eliminadas antiguas");
    const days = Math.max(1,Number(settings.deletedRetentionDays||60));
    const ok = confirm(`Se borrarán definitivamente solicitudes y producciones eliminadas con más de ${days} días. ¿Continuar?`);
    if(!ok)return;
    setBusy(true);
    try{
      const [requestCount,productionCount] = await Promise.all([
        purgeDeletedRequestsOlderThan(days),
        purgeDeletedProductionsOlderThan(days)
      ]);
      alert(`Limpieza terminada. Solicitudes borradas definitivamente: ${requestCount}. Producciones borradas definitivamente: ${productionCount}.`);
      await load();
    }finally{setBusy(false)}
  }

  return <AppShell active="Eliminadas">
    <section className="hero">
      <div>
        <p className="eyebrow">Rastreabilidad</p>
        <h1>Eliminadas</h1>
        <p>Papelera operativa. Las solicitudes y producciones eliminadas se ocultan del flujo normal y pueden borrarse definitivamente después de la retención configurada.</p>
      </div>
      <div className="config-actions">
        <button className="btn" onClick={()=>setShowAll(v=>!v)}>{showAll?"Mostrar recientes":"Ver todas"}</button>
        <button className="btn red" onClick={purgeOld} disabled={busy || !canDelete}>{busy?"Limpiando...":`Borrar +${settings.deletedRetentionDays||60} días`}</button>
      </div>
    </section>

    <section className="report-section">
      <h3>Solicitudes eliminadas</h3>
      <p className="mini">Retención configurada: {settings.deletedRetentionDays||60} días. Mostrando {recentItems.length} de {items.length} solicitudes eliminadas.</p>
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

    <section className="report-section">
      <h3>Producciones eliminadas</h3>
      <p className="mini">Mostrando {recentProductions.length} de {productions.length} producciones eliminadas.</p>
      <table className="table">
        <thead><tr><th>Producción</th><th>Cliente</th><th>Fecha producción</th><th>Motivo</th><th>Fecha eliminación</th><th>Acciones</th></tr></thead>
        <tbody>{recentProductions.map(item=><tr key={item.id}>
          <td><strong>{item.title}</strong></td>
          <td>{item.clientName}</td>
          <td>{item.scheduledDate||"Sin fecha"}</td>
          <td>{item.deletedReason||"Sin motivo"}</td>
          <td>{formatDeletedAt(item.deletedAt)}</td>
          <td><button className="btn" onClick={()=>restoreProduction(item)} disabled={!canDelete}>Restaurar</button><button className="btn red" onClick={()=>hardDeleteProduction(item)} disabled={!canDelete}>Borrar definitivo</button></td>
        </tr>)}</tbody>
      </table>
      {!productions.length && <p className="mini">No hay producciones eliminadas.</p>}
    </section>
  </AppShell>
}

function formatDeletedAt(value?:string){
  if(!value)return "Sin fecha";
  const date = new Date(value);
  if(Number.isNaN(date.getTime()))return value;
  return date.toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"});
}
