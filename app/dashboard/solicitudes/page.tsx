"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Brand, ContentRequest, TaskComment, listRequests, listUniqueBrands, updateRequest } from "@/lib/data";

function copyStatusLabel(value?: string) {
  if (value === "listo_para_revision") return "Listo para revisión";
  if (value === "aprobado") return "Aprobado";
  if (value === "en_proceso") return "En proceso";
  return "Pendiente";
}

function isPendingCopy(item: ContentRequest) {
  const status = item.copyStatus || ((item.copyIn || "").trim() ? "en_proceso" : "pendiente");
  return ["pendiente", "en_proceso"].includes(status) || item.status === "pendiente_copy";
}

function textList(value?: string[]) {
  return Array.isArray(value) && value.length ? value.join(", ") : "Pendiente";
}

export default function ContentPage(){
  const [items,setItems]=useState<ContentRequest[]>([]);
  const [brands,setBrands]=useState<Brand[]>([]);
  const [clientFilter,setClientFilter]=useState("all");
  const [batchFilter,setBatchFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("pending");
  const [search,setSearch]=useState("");
  const [copyDrafts,setCopyDrafts]=useState<Record<string,string>>({});
  const [generating,setGenerating]=useState<string>("");

  async function load(){
    const [requests, loadedBrands] = await Promise.all([listRequests(), listUniqueBrands()]);
    setItems(requests.filter(x=>x.status!=="eliminada"));
    setBrands(loadedBrands);
  }

  useEffect(()=>{load()},[]);

  const clients = useMemo(()=>{
    const map = new Map<string,string>();
    items.forEach(x=>map.set(x.clientId||"sin-cliente",x.clientName||"Sin cliente"));
    return Array.from(map.entries()).map(([id,name])=>({id,name}));
  },[items]);

  const batches = useMemo(()=>{
    const map = new Map<string,string>();
    items
      .filter(x=>clientFilter==="all" || x.clientId===clientFilter)
      .forEach(x=>map.set(x.batchId||"sin-lote",x.batchName||"Sin lote"));
    return Array.from(map.entries()).map(([id,name])=>({id,name}));
  },[items,clientFilter]);

  const filtered = useMemo(()=>items.filter(item=>{
    const searchable = `${item.clientName} ${item.batchName} ${item.contentType} ${item.objective} ${item.topic} ${item.creativeIdea} ${item.copyIn}`.toLowerCase();
    const copyStatus = item.copyStatus || ((item.copyIn || "").trim() ? "en_proceso" : "pendiente");
    return (clientFilter==="all" || item.clientId===clientFilter) &&
      (batchFilter==="all" || (item.batchId||"sin-lote")===batchFilter) &&
      (statusFilter==="all" || (statusFilter==="pending" ? isPendingCopy(item) : copyStatus===statusFilter)) &&
      (!search.trim() || searchable.includes(search.trim().toLowerCase()));
  }),[items,clientFilter,batchFilter,statusFilter,search]);

  function getBrand(item:ContentRequest){
    return brands.find(x=>x.id===item.clientId || x.name===item.clientName);
  }

  function approvedCopiesFor(item:ContentRequest){
    return items
      .filter(x=>x.clientId===item.clientId && x.status==="finalizada" && (x.copyOut || x.copyIn))
      .slice(0,10)
      .map(x=>x.copyOut || x.copyIn || "")
      .filter(Boolean);
  }

  async function saveProgress(item:ContentRequest, value:string){
    if(!item.id)return;
    const log:TaskComment = {id:`${Date.now()}`,author:"Sistema",target:"Copy",body:"Avance de copy guardado.",mentions:[],createdAt:new Date().toISOString()};
    await updateRequest(item.id,{copyIn:value,copyStatus:value.trim()?"en_proceso":"pendiente",status:"pendiente_copy",comments:[...(item.comments||[]),log]});
    await load();
  }

  async function markReady(item:ContentRequest){
    if(!item.id)return;
    const value = (copyDrafts[item.id] ?? item.copyIn ?? "").trim();
    if(!value)return alert("Antes de marcar como listo, el copy debe tener contenido.");
    const nextStatus = item.requiresProduction ? "pendiente_produccion" : "lista_asignacion";
    const log:TaskComment = {id:`${Date.now()}`,author:"Sistema",target:"Copy",body:"Copy marcado como listo para revisión / siguiente etapa.",mentions:[],createdAt:new Date().toISOString()};
    await updateRequest(item.id,{copyIn:value,copyStatus:"listo_para_revision",status:nextStatus,comments:[...(item.comments||[]),log]});
    await load();
  }

  async function generateCopy(item:ContentRequest){
    if(!item.id)return;
    setGenerating(item.id);
    try{
      const brand = getBrand(item);
      const response = await fetch("/api/generate-copy",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({item,client:brand,approvedCopies:approvedCopiesFor(item)})
      });
      const payload = await response.json();
      const copy = String(payload.copy || "").trim();
      if(!copy)return alert("No se pudo generar copy.");
      setCopyDrafts({...copyDrafts,[item.id]:copy});
      const log:TaskComment = {id:`${Date.now()}`,author:"Sistema",target:"IA Copy",body:`Copy generado con IA${payload.mode ? ` (${payload.mode})` : ""}.`,mentions:[],createdAt:new Date().toISOString()};
      await updateRequest(item.id,{copyIn:copy,copyStatus:"en_proceso",status:"pendiente_copy",comments:[...(item.comments||[]),log]});
      await load();
    }finally{
      setGenerating("");
    }
  }

  return <AppShell active="Contenidos">
    <section className="hero">
      <div>
        <p className="eyebrow">Content</p>
        <h1>Contenidos</h1>
        <p>Trabaja copys sin que desaparezcan al escribir. La cola depende del estado real del copy, no solo de si el campo tiene texto.</p>
      </div>
      <div className="pill">{filtered.length} visibles</div>
    </section>

    <section className="grid kpis">
      {[["Pendientes copy",String(items.filter(isPendingCopy).length)],["En proceso",String(items.filter(x=>x.copyStatus==="en_proceso").length)],["Listos",String(items.filter(x=>x.copyStatus==="listo_para_revision").length)],["Aprobados",String(items.filter(x=>x.copyStatus==="aprobado").length)],["Clientes",String(clients.length)],["Total",String(items.length)]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <div className="toolbar">
      <select value={clientFilter} onChange={e=>{setClientFilter(e.target.value);setBatchFilter("all");}}><option value="all">Todos los clientes</option>{clients.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select value={batchFilter} onChange={e=>setBatchFilter(e.target.value)}><option value="all">Todos los lotes</option>{batches.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
        <option value="pending">Pendientes de copy</option>
        <option value="pendiente">Solo pendientes</option>
        <option value="en_proceso">En proceso</option>
        <option value="listo_para_revision">Listos para revisión</option>
        <option value="aprobado">Aprobados</option>
        <option value="all">Todos</option>
      </select>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar contenido, lote, idea..."/>
      <button className="btn" onClick={load}>Actualizar</button>
    </div>

    <section className="content-workbench">
      {filtered.map(item=>{
        const brand = getBrand(item);
        const rules = brand?.copyRules;
        const draft = copyDrafts[item.id||""] ?? item.copyIn ?? "";
        return <article className="content-card" key={item.id}>
          <div className="content-card-head">
            <div>
              <h3>{item.clientName} · {item.contentType}</h3>
              <p className="mini">{item.batchName||"Sin lote"} · Publica: {item.publishDate||"Sin fecha"} · {item.objective}</p>
            </div>
            <span className="pill orange">{copyStatusLabel(item.copyStatus)}</span>
          </div>

          <div className="content-grid">
            <div>
              <div className="detail-section">
                <h4>Información del contenido</h4>
                <div className="detail-copy"><strong>Idea:</strong> {item.creativeIdea||"Pendiente"}{"\n"}<strong>Mensaje:</strong> {item.keyMessage||"Pendiente"}{"\n"}<strong>CTA:</strong> {item.cta||"Pendiente"}</div>
              </div>
              <div className="detail-section">
                <h4>Reglas de copy del cliente</h4>
                <div className="detail-copy"><strong>Tono:</strong> {rules?.tone || brand?.tone || "Pendiente"}{"\n"}<strong>CTAs:</strong> {textList(rules?.preferredCtas)}{"\n"}<strong>Palabras prohibidas:</strong> {textList(rules?.forbiddenWords)}{"\n"}<strong>Hashtags:</strong> {textList(rules?.baseHashtags)}{"\n"}<strong>Indicaciones:</strong> {rules?.specialInstructions || "Pendiente"}</div>
              </div>
            </div>

            <div>
              <div className="field">
                <label>Copy de trabajo</label>
                <textarea value={draft} onChange={e=>setCopyDrafts({...copyDrafts,[item.id||""]:e.target.value})} placeholder="Escribe, pega o genera el copy aquí."/>
              </div>
              <div className="content-actions">
                <button className="btn" onClick={()=>saveProgress(item,draft)}>Guardar avance</button>
                <button className="btn blue" onClick={()=>generateCopy(item)} disabled={generating===item.id}>{generating===item.id?"Generando...":"Generar copy con IA"}</button>
                <button className="btn dark" onClick={()=>markReady(item)}>Marcar copy como listo</button>
              </div>
              <p className="mini" style={{marginTop:10}}>Puedes generar copy aunque el campo esté vacío. La IA toma brief, idea, reglas del cliente y copys aprobados anteriores.</p>
            </div>
          </div>
        </article>
      })}
      {!filtered.length && <div className="card"><p>No hay contenidos con estos filtros.</p></div>}
    </section>
  </AppShell>;
}
