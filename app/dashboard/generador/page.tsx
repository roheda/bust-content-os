"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { ContentRequest, listRequests, updateRequest } from "@/lib/data";

export default function GeneratorPage(){
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [clientFilter,setClientFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("enviado");
  const [search,setSearch]=useState("");

  async function load(){
    setRequests((await listRequests()).filter(x=>x.status!=="eliminada"));
  }

  useEffect(()=>{load()},[]);

  const clients = useMemo(()=>{
    const map = new Map<string,string>();
    requests.forEach(x=>map.set(x.clientId||"sin-cliente",x.clientName||"Sin cliente"));
    return Array.from(map.entries()).map(([id,name])=>({id,name}));
  },[requests]);

  const generatorItems = useMemo(()=>requests.filter(item=>{
    const text = `${item.clientName} ${item.batchName} ${item.contentType} ${item.objective} ${item.creativeIdea} ${item.copyIn} ${item.copyOut}`.toLowerCase();
    const genStatus = item.generatorStatus || "";
    return Boolean(genStatus) &&
      (clientFilter==="all" || item.clientId===clientFilter) &&
      (statusFilter==="all" || genStatus===statusFilter) &&
      (!search.trim() || text.includes(search.trim().toLowerCase()));
  }),[requests,clientFilter,statusFilter,search]);

  async function updateGeneratorStatus(item:ContentRequest,status:string){
    if(!item.id)return;
    const comments = [...(item.comments||[])];
    comments.push({
      id:`${Date.now()}`,
      author:"Sistema",
      target:"Generador",
      body:`Generador actualizado: ${status}.`,
      mentions:[],
      createdAt:new Date().toISOString()
    });
    await updateRequest(item.id,{generatorStatus:status,comments});
    await load();
  }

  return <AppShell active="Generador">
    <section className="hero">
      <div>
        <p className="eyebrow">Herramienta integrada</p>
        <h1>Generador BUST It Now</h1>
        <p>Centro de piezas enviadas desde Tareas para que los editores tengan contexto y puedan trabajar con el generador.</p>
      </div>
    </section>

    <section className="shared-client-note">
      Clientes usa la misma base de alta para BUST Content OS y BUST It Now. Más adelante podremos decidir qué campos ve cada sistema, pero el cliente será compartido.
    </section>

    <div className="report-filters">
      <select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}>
        <option value="all">Todos los clientes</option>
        {clients.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
        <option value="enviado">Enviadas al generador</option>
        <option value="en_proceso">En proceso</option>
        <option value="generado">Generado</option>
        <option value="all">Todas</option>
      </select>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar pieza..."/>
      <button className="btn" onClick={load}>Actualizar</button>
    </div>

    <section className="grid kpis">
      {[["Enviadas",String(requests.filter(x=>x.generatorStatus==="enviado").length)],["En proceso",String(requests.filter(x=>x.generatorStatus==="en_proceso").length)],["Generadas",String(requests.filter(x=>x.generatorStatus==="generado").length)],["Filtradas",String(generatorItems.length)]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <section className="report-section">
      <h3>Piezas en generador</h3>
      {generatorItems.map(item=><div className={`generator-card ${item.generatorStatus==="enviado"?"sent":""}`} key={item.id}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}>
          <div>
            <strong>{item.clientName} · {item.contentType}</strong>
            <p className="mini">Lote: {item.batchName||"Sin lote"} · Responsable: {item.assignedTo||"Sin asignar"} · Publica: {item.publishDate||"Sin fecha"}</p>
            <span className="generator-badge">{item.generatorStatus}</span>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button className="btn" onClick={()=>updateGeneratorStatus(item,"en_proceso")}>En proceso</button>
            <button className="btn blue" onClick={()=>updateGeneratorStatus(item,"generado")}>Generado</button>
          </div>
        </div>

        <div className="detail-copy">
          <strong>Idea:</strong> {item.creativeIdea||"Sin idea"}{"\n"}
          <strong>Copy In:</strong> {item.copyIn||"Sin copy in"}{"\n"}
          <strong>Copy Out:</strong> {item.copyOut||"Pendiente"}{"\n"}
          <strong>CTA:</strong> {item.cta||"Sin CTA"}{"\n"}
          <strong>Link final:</strong> {item.finalPostLink||"Pendiente"}
        </div>
      </div>)}

      {!generatorItems.length && <p className="mini">No hay piezas enviadas al generador con estos filtros.</p>}
    </section>
  </AppShell>
}
