"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Brand, BustItNowJob, ContentRequest, listBrands, listBustItNowJobs, listRequests, saveBustItNowJob, updateBustItNowJob, updateRequest } from "@/lib/data";

const emptyJob: BustItNowJob = {
  clientId: "",
  clientName: "",
  source: "BUST It Now",
  title: "",
  format: "Post",
  objective: "",
  prompt: "",
  copyIn: "",
  copyOut: "",
  referenceLinks: "",
  finalLink: "",
  status: "nuevo",
  assignedTo: "",
  notes: ""
};

export default function BustItNowPage(){
  const [clients,setClients]=useState<Brand[]>([]);
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [jobs,setJobs]=useState<BustItNowJob[]>([]);
  const [tab,setTab]=useState<"inbox"|"jobs"|"new"|"map">("inbox");
  const [clientFilter,setClientFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [form,setForm]=useState<BustItNowJob>(emptyJob);

  async function load(){
    const [c,r,j] = await Promise.all([
      listBrands(),
      listRequests(),
      listBustItNowJobs()
    ]);
    setClients(c);
    setRequests(r.filter(x=>x.status!=="eliminada"));
    setJobs(j);
  }

  useEffect(()=>{load()},[]);

  const sentFromContent = useMemo(()=>requests.filter(item=>{
    const text = `${item.clientName} ${item.batchName} ${item.contentType} ${item.objective} ${item.creativeIdea} ${item.copyIn} ${item.copyOut}`.toLowerCase();
    return Boolean(item.generatorStatus) &&
      (clientFilter==="all" || item.clientId===clientFilter) &&
      (statusFilter==="all" || item.generatorStatus===statusFilter) &&
      (!search.trim() || text.includes(search.trim().toLowerCase()));
  }),[requests,clientFilter,statusFilter,search]);

  const filteredJobs = useMemo(()=>jobs.filter(job=>{
    const text = `${job.clientName} ${job.title} ${job.format} ${job.objective} ${job.prompt} ${job.copyIn} ${job.copyOut}`.toLowerCase();
    return (clientFilter==="all" || job.clientId===clientFilter) &&
      (statusFilter==="all" || job.status===statusFilter) &&
      (!search.trim() || text.includes(search.trim().toLowerCase()));
  }),[jobs,clientFilter,statusFilter,search]);

  function setJobField(k:keyof BustItNowJob,v:string){
    const next = {...form,[k]:v};
    if(k==="clientId"){
      const client = clients.find(c=>c.id===v);
      next.clientName = client?.name || "";
    }
    setForm(next);
  }

  async function createJob(){
    if(!form.clientId)return alert("Selecciona cliente.");
    if(!form.title.trim())return alert("Agrega título del trabajo.");
    if(!form.prompt.trim())return alert("Agrega prompt o instrucción.");
    await saveBustItNowJob({
      ...form,
      source:"BUST It Now",
      status:"nuevo"
    });
    setForm(emptyJob);
    await load();
    setTab("jobs");
    alert("Trabajo creado dentro de la misma plataforma");
  }

  async function createJobFromRequest(item:ContentRequest){
    await saveBustItNowJob({
      clientId:item.clientId,
      clientName:item.clientName,
      contentRequestId:item.id,
      batchId:item.batchId,
      batchName:item.batchName,
      source:"Content OS",
      title:`${item.contentType} · ${item.objective}`,
      format:item.contentType,
      objective:item.objective,
      prompt:item.creativeIdea || item.keyMessage || "",
      copyIn:item.copyIn,
      copyOut:item.copyOut,
      referenceLinks:`${item.referenceLinks||""}\n${item.materialLinks||""}`,
      finalLink:item.finalPostLink,
      status:"nuevo",
      assignedTo:item.assignedTo,
      notes:"Creado desde tarea enviada por Content OS"
    });
    if(item.id){
      await updateRequest(item.id,{generatorStatus:"convertido_job"});
    }
    await load();
    setTab("jobs");
    alert("Trabajo creado en BUST It Now usando la misma base de datos");
  }

  async function updateRequestGeneratorStatus(item:ContentRequest,status:string){
    if(!item.id)return;
    const comments = [...(item.comments||[])];
    comments.push({
      id:`${Date.now()}`,
      author:"Sistema",
      target:"BUST It Now",
      body:`BUST It Now actualizado: ${status}.`,
      mentions:[],
      createdAt:new Date().toISOString()
    });
    await updateRequest(item.id,{generatorStatus:status,comments});
    await load();
  }

  async function updateJobStatus(job:BustItNowJob,status:string){
    if(!job.id)return;
    await updateBustItNowJob(job.id,{status});
    await load();
  }

  return <AppShell active="BUST It Now">
    <section className="hero">
      <div>
        <p className="eyebrow">Módulo integrado</p>
        <h1>BUST It Now</h1>
        <p>No es un sistema separado: vive dentro de BUST Content OS y usa los mismos clientes, tareas y base de datos.</p>
      </div>
    </section>

    <section className="shared-db-banner">
      <strong>Una sola plataforma, una sola base de datos.</strong>
      <span>BUST Content OS es el sistema oficial. BUST It Now es un módulo interno conectado a las mismas colecciones de Firestore.</span>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <span className="db-pill">clients</span>
        <span className="db-pill">contentRequests</span>
        <span className="db-pill">bustItNowJobs</span>
        <span className="db-pill">systemFeedback</span>
      </div>
    </section>

    <div className="bitnow-tabs">
      <button className={tab==="inbox"?"active":""} onClick={()=>setTab("inbox")}>Bandeja desde Tareas</button>
      <button className={tab==="jobs"?"active":""} onClick={()=>setTab("jobs")}>Trabajos BUST It Now</button>
      <button className={tab==="new"?"active":""} onClick={()=>setTab("new")}>Nuevo trabajo</button>
      <button className={tab==="map"?"active":""} onClick={()=>setTab("map")}>Mapa de integración</button>
    </div>

    <div className="report-filters">
      <select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}>
        <option value="all">Todos los clientes</option>
        {clients.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
        <option value="all">Todos los estados</option>
        <option value="enviado">Enviado</option>
        <option value="nuevo">Nuevo</option>
        <option value="en_proceso">En proceso</option>
        <option value="generado">Generado</option>
        <option value="convertido_job">Convertido a job</option>
      </select>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..."/>
      <button className="btn" onClick={load}>Actualizar</button>
    </div>

    <section className="grid kpis">
      {[["Clientes compartidos",String(clients.length)],["Desde Tareas",String(sentFromContent.length)],["Jobs internos",String(jobs.length)],["Generados",String(jobs.filter(x=>x.status==="generado").length)]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    {tab==="inbox" && <section className="report-section">
      <h3>Bandeja desde Tareas</h3>
      <p className="mini">Posts enviados desde Tareas para usar en BUST It Now. Se pueden convertir a trabajo interno sin duplicar cliente ni base de datos.</p>
      {sentFromContent.map(item=><div className={`bitnow-card ${item.generatorStatus==="enviado"?"sent":""}`} key={item.id}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}>
          <div>
            <strong>{item.clientName} · {item.contentType}</strong>
            <p className="mini">Lote: {item.batchName||"Sin lote"} · Responsable: {item.assignedTo||"Sin asignar"} · Publica: {item.publishDate||"Sin fecha"}</p>
            <span className="generator-badge">{item.generatorStatus}</span>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button className="btn" onClick={()=>updateRequestGeneratorStatus(item,"en_proceso")}>En proceso</button>
            <button className="btn blue" onClick={()=>createJobFromRequest(item)}>Convertir a job</button>
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
      {!sentFromContent.length && <p className="mini">No hay piezas enviadas desde Tareas con estos filtros.</p>}
    </section>}

    {tab==="jobs" && <section className="report-section">
      <h3>Trabajos BUST It Now</h3>
      {filteredJobs.map(job=><div className={`bitnow-card ${job.status==="generado"?"generated":""}`} key={job.id}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}>
          <div>
            <strong>{job.clientName} · {job.title}</strong>
            <p className="mini">Fuente: {job.source} · Formato: {job.format} · Lote: {job.batchName||"Sin lote"}</p>
            <span className="generator-badge">{job.status}</span>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button className="btn" onClick={()=>updateJobStatus(job,"en_proceso")}>En proceso</button>
            <button className="btn blue" onClick={()=>updateJobStatus(job,"generado")}>Generado</button>
          </div>
        </div>
        <div className="detail-copy">
          <strong>Objetivo:</strong> {job.objective||"Sin objetivo"}{"\n"}
          <strong>Prompt:</strong> {job.prompt||"Sin prompt"}{"\n"}
          <strong>Copy In:</strong> {job.copyIn||"Sin copy in"}{"\n"}
          <strong>Copy Out:</strong> {job.copyOut||"Pendiente"}{"\n"}
          <strong>Referencias:</strong> {job.referenceLinks||"Sin referencias"}{"\n"}
          <strong>Link final:</strong> {job.finalLink||"Pendiente"}
        </div>
      </div>)}
      {!filteredJobs.length && <p className="mini">No hay trabajos con estos filtros.</p>}
    </section>}

    {tab==="new" && <section className="bitnow-layout">
      <div className="report-section">
        <h3>Crear trabajo dentro de BUST It Now</h3>
        <p className="mini">Usa la misma base de clientes de BUST Content OS. No hay alta separada.</p>
        <div className="bitnow-form">
          <div className="field"><label>Cliente</label><select value={form.clientId} onChange={e=>setJobField("clientId",e.target.value)}><option value="">Selecciona cliente</option>{clients.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div className="field"><label>Título</label><input value={form.title} onChange={e=>setJobField("title",e.target.value)} placeholder="Ej. Post de promoción"/></div>
          <div className="field"><label>Formato</label><select value={form.format} onChange={e=>setJobField("format",e.target.value)}><option>Post</option><option>Reel</option><option>Historia</option><option>Carrusel</option><option>Anuncio</option><option>Otro</option></select></div>
          <div className="field"><label>Objetivo</label><input value={form.objective||""} onChange={e=>setJobField("objective",e.target.value)} placeholder="Awareness, venta, tráfico..."/></div>
          <div className="field"><label>Prompt / instrucción</label><textarea value={form.prompt} onChange={e=>setJobField("prompt",e.target.value)} placeholder="Describe qué debe generar BUST It Now."/></div>
          <div className="field"><label>Copy In</label><textarea value={form.copyIn||""} onChange={e=>setJobField("copyIn",e.target.value)}/></div>
          <div className="field"><label>Referencias / links</label><textarea value={form.referenceLinks||""} onChange={e=>setJobField("referenceLinks",e.target.value)}/></div>
          <button className="btn blue" onClick={createJob}>Crear trabajo</button>
        </div>
      </div>

      <aside className="bitnow-sidebar">
        <h3>Contexto compartido</h3>
        <p className="mini">El trabajo queda conectado al cliente seleccionado y vive en la colección bustItNowJobs.</p>
        <div className="detail-copy">
          <strong>Cliente:</strong> {form.clientName||"Pendiente"}{"\n"}
          <strong>Formato:</strong> {form.format}{"\n"}
          <strong>Fuente:</strong> BUST It Now{"\n"}
          <strong>Base:</strong> Firestore compartido
        </div>
      </aside>
    </section>}

    {tab==="map" && <section className="report-section">
      <h3>Mapa de integración</h3>
      <div className="platform-map">
        <div className="platform-node"><strong>clients</strong><span>Alta única de cliente. La usan Content OS y BUST It Now.</span></div>
        <div className="platform-node"><strong>contentRequests</strong><span>Piezas, tareas, aprobaciones, copy out y calendario operativo.</span></div>
        <div className="platform-node"><strong>bustItNowJobs</strong><span>Trabajos propios del módulo BUST It Now, ligados a cliente y opcionalmente a una tarea.</span></div>
        <div className="platform-node"><strong>systemFeedback</strong><span>Mejoras internas para evolucionar todo el sistema.</span></div>
      </div>
    </section>}
  </AppShell>
}
