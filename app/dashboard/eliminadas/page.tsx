"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { ContentRequest, listRequests } from "@/lib/data";
export default function DeletedPage(){
  const [items,setItems]=useState<ContentRequest[]>([]);
  async function load(){setItems((await listRequests()).filter(x=>x.status==="eliminada"))}
  useEffect(()=>{load()},[]);
  return <AppShell active="Reportes">
    <section className="hero"><div><p className="eyebrow">Rastreabilidad</p><h1>Solicitudes eliminadas</h1><p>Archivo de solicitudes marcadas como eliminadas. No se borran físicamente para conservar historial.</p></div></section>
    <section className="report-section"><h3>Eliminadas</h3><table className="table"><thead><tr><th>Cliente</th><th>Lote</th><th>Tipo</th><th>Motivo</th><th>Fecha eliminación</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.clientName}</td><td>{item.batchName||"Sin lote"}</td><td>{item.contentType}</td><td>{item.deletedReason||"Sin motivo"}</td><td>{item.deletedAt||"Sin fecha"}</td></tr>)}</tbody></table>{!items.length && <p className="mini">No hay solicitudes eliminadas.</p>}</section>
  </AppShell>
}
