"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { buildGenerationPrompt } from "@/lib/build-generation-prompt";
import { Brand, BustItNowJob, ContentRequest, listBrands, listBustItNowJobs, listRequests, saveBustItNowJob, updateBustItNowJob, updateRequest } from "@/lib/data";

type TextBlock = {
  id: string;
  text: string;
  role: string;
  priority: string;
  instruction: string;
  locked: boolean;
};

const emptyJob: BustItNowJob = {
  clientId: "",
  clientName: "",
  source: "BUST It Now",
  title: "",
  format: "instagram-post",
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

const formats = [
  { id: "instagram-post", label: "Post Instagram 4:5" },
  { id: "instagram-story", label: "Story 9:16" },
  { id: "square-post", label: "Cuadrado 1:1" },
  { id: "reel-cover", label: "Portada de Reel" },
  { id: "ad-creative", label: "Creativo para pauta" },
];

const goals = [
  { id: "sell", label: "Vender" },
  { id: "inform", label: "Informar" },
  { id: "announce", label: "Anunciar" },
  { id: "position", label: "Posicionar marca" },
  { id: "interaction", label: "Generar interacción" },
  { id: "trust", label: "Dar confianza" },
];

const contentTypes = [
  { id: "promotion", label: "Promoción" },
  { id: "product", label: "Producto o servicio" },
  { id: "event", label: "Evento" },
  { id: "notice", label: "Aviso" },
  { id: "seasonal", label: "Fecha especial" },
  { id: "branding", label: "Contenido de marca" },
];

const emotions = ["Premium","Urgente","Elegante","Comercial","Tecnológico","Cercano","Apetitoso","Familiar","Sofisticado","Divertido"];
const visualElements = ["Producto","Persona","Ambiente","Local o espacio","Precio","Fecha","CTA","Fondo limpio","Textura o patrón de marca"];

function newTextBlock(): TextBlock {
  return {
    id: `tb-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    text: "",
    role: "headline",
    priority: "high",
    instruction: "",
    locked: true
  };
}

export default function BustItNowPage(){
  const [clients,setClients]=useState<Brand[]>([]);
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [jobs,setJobs]=useState<BustItNowJob[]>([]);
  const [tab,setTab]=useState<"inbox"|"jobs"|"new"|"studio"|"map">("inbox");
  const [clientFilter,setClientFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [form,setForm]=useState<BustItNowJob>(emptyJob);
  const [selectedJob,setSelectedJob]=useState<BustItNowJob|null>(null);

  const [goal,setGoal]=useState("sell");
  const [contentType,setContentType]=useState("promotion");
  const [mainMessage,setMainMessage]=useState("");
  const [textBlocks,setTextBlocks]=useState<TextBlock[]>([newTextBlock()]);
  const [selectedEmotions,setSelectedEmotions]=useState<string[]>([]);
  const [selectedVisualElements,setSelectedVisualElements]=useState<string[]>([]);
  const [specificInstructions,setSpecificInstructions]=useState("");
  const [model,setModel]=useState("gemini-3-pro-image");
  const [variantCount,setVariantCount]=useState(1);
  const [generatedPrompt,setGeneratedPrompt]=useState("");
  const [isGenerating,setIsGenerating]=useState(false);
  const [generatedImages,setGeneratedImages]=useState<string[]>([]);
  const [generationError,setGenerationError]=useState("");

  async function load(){
    const [c,r,j] = await Promise.all([listBrands(),listRequests(),listBustItNowJobs()]);
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
    await saveBustItNowJob({...form,source:"BUST It Now",status:"nuevo"});
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
      format:"instagram-post",
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
    if(item.id) await updateRequest(item.id,{generatorStatus:"convertido_job"});
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

  function openStudio(job:BustItNowJob){
    setSelectedJob(job);
    setMainMessage(job.prompt || job.title || "");
    setSpecificInstructions(job.notes || "");
    setTextBlocks([
      { ...newTextBlock(), text: job.copyOut || job.copyIn || job.title || "", role:"headline", priority:"high", locked:true }
    ]);
    setGeneratedImages([]);
    setGenerationError("");
    setGeneratedPrompt("");
    setTab("studio");
  }

  function toggle(value:string, current:string[], setter:(value:string[])=>void){
    setter(current.includes(value) ? current.filter(x=>x!==value) : [...current,value]);
  }

  function updateTextBlock(id:string, patch:Partial<TextBlock>){
    setTextBlocks(textBlocks.map(block=>block.id===id ? {...block,...patch} : block));
  }

  function removeTextBlock(id:string){
    setTextBlocks(textBlocks.filter(block=>block.id!==id));
  }

  function currentClient(){
    const id = selectedJob?.clientId || form.clientId;
    return clients.find(c=>c.id===id);
  }

  function buildPrompt(){
    const client = currentClient();
    const prompt = buildGenerationPrompt({
      clientName: selectedJob?.clientName || form.clientName || client?.name,
      clientIndustry: client?.industry,
      format: selectedJob?.format || form.format || "instagram-post",
      goal,
      contentType,
      mainMessage,
      textBlocks: textBlocks.filter(x=>x.text.trim()).map(block=>({
        ...block,
        roleLabel: block.role,
        priorityLabel: block.priority
      })),
      selectedEmotions,
      selectedVisualElements,
      specificInstructions,
      brandBrainSnapshot:{
        brandDescription: client?.brandNotes || client?.brandPersonality || "",
        tone: client?.tone || "",
        typography: client?.visualStyle || "",
        visualStyle: client?.visualStyle ? [client.visualStyle] : [],
        dos: client?.contentPillars ? [client.contentPillars] : [],
        donts: []
      }
    });
    setGeneratedPrompt(prompt);
    return prompt;
  }

  async function generateImage(){
    if(!selectedJob && !form.clientId)return alert("Selecciona o crea un trabajo primero.");
    const prompt = buildPrompt();
    setIsGenerating(true);
    setGenerationError("");
    setGeneratedImages([]);
    try{
      const response = await fetch("/api/generate-image",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          prompt,
          format:selectedJob?.format || form.format || "instagram-post",
          model,
          variantCount
        })
      });
      const payload = await response.json();
      if(!response.ok)throw new Error(payload.error || "No se pudo generar imagen.");
      setGeneratedImages(payload.imagesBase64 || []);
      if(selectedJob?.id){
        await updateBustItNowJob(selectedJob.id,{
          status:"generado",
          generatedPrompt:prompt,
          executedModel:payload.executedModel,
          generationMode:payload.generationMode
        });
        await load();
      }
    }catch(error){
      setGenerationError(error instanceof Error ? error.message : "Error al generar.");
    }finally{
      setIsGenerating(false);
    }
  }

  return <AppShell active="BUST It Now">
    <section className="hero">
      <div>
        <p className="eyebrow">Módulo integrado</p>
        <h1>BUST It Now</h1>
        <p>Generador real integrado dentro de BUST Content OS, usando clientes, tareas y Firestore compartido.</p>
      </div>
    </section>

    <section className="shared-db-banner">
      <strong>Una sola plataforma, una sola base de datos.</strong>
      <span>BUST It Now ahora vive dentro de BUST Content OS con la lógica real de prompt y generación de imagen.</span>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <span className="db-pill">clients</span>
        <span className="db-pill">contentRequests</span>
        <span className="db-pill">bustItNowJobs</span>
        <span className="db-pill">/api/generate-image</span>
      </div>
    </section>

    <div className="bitnow-tabs">
      <button className={tab==="inbox"?"active":""} onClick={()=>setTab("inbox")}>Bandeja desde Tareas</button>
      <button className={tab==="jobs"?"active":""} onClick={()=>setTab("jobs")}>Trabajos</button>
      <button className={tab==="new"?"active":""} onClick={()=>setTab("new")}>Nuevo trabajo</button>
      <button className={tab==="studio"?"active":""} onClick={()=>setTab("studio")}>Estudio generador</button>
      <button className={tab==="map"?"active":""} onClick={()=>setTab("map")}>Mapa</button>
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
      {[["Clientes",String(clients.length)],["Desde Tareas",String(sentFromContent.length)],["Jobs",String(jobs.length)],["Generados",String(jobs.filter(x=>x.status==="generado").length)]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    {tab==="inbox" && <section className="report-section">
      <h3>Bandeja desde Tareas</h3>
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
            <button className="btn" onClick={()=>openStudio(job)}>Abrir generador</button>
            <button className="btn blue" onClick={()=>updateJobStatus(job,"generado")}>Generado</button>
          </div>
        </div>
        <div className="detail-copy">
          <strong>Objetivo:</strong> {job.objective||"Sin objetivo"}{"\n"}
          <strong>Prompt:</strong> {job.prompt||"Sin prompt"}{"\n"}
          <strong>Copy In:</strong> {job.copyIn||"Sin copy in"}{"\n"}
          <strong>Copy Out:</strong> {job.copyOut||"Pendiente"}{"\n"}
          <strong>Modelo:</strong> {job.executedModel||"Pendiente"}
        </div>
      </div>)}
      {!filteredJobs.length && <p className="mini">No hay trabajos con estos filtros.</p>}
    </section>}

    {tab==="new" && <section className="bitnow-layout">
      <div className="report-section">
        <h3>Crear trabajo BUST It Now</h3>
        <div className="bitnow-form">
          <div className="field"><label>Cliente</label><select value={form.clientId} onChange={e=>setJobField("clientId",e.target.value)}><option value="">Selecciona cliente</option>{clients.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div className="field"><label>Título</label><input value={form.title} onChange={e=>setJobField("title",e.target.value)} placeholder="Ej. Post de promoción"/></div>
          <div className="field"><label>Formato</label><select value={form.format} onChange={e=>setJobField("format",e.target.value)}>{formats.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
          <div className="field"><label>Objetivo</label><input value={form.objective||""} onChange={e=>setJobField("objective",e.target.value)} placeholder="Awareness, venta, tráfico..."/></div>
          <div className="field"><label>Prompt / instrucción</label><textarea value={form.prompt} onChange={e=>setJobField("prompt",e.target.value)} placeholder="Describe qué debe generar BUST It Now."/></div>
          <div className="field"><label>Copy In</label><textarea value={form.copyIn||""} onChange={e=>setJobField("copyIn",e.target.value)}/></div>
          <button className="btn blue" onClick={createJob}>Crear trabajo</button>
        </div>
      </div>
      <aside className="bitnow-sidebar"><h3>Base compartida</h3><p className="mini">El trabajo queda conectado al cliente de Content OS y podrá abrirse en el estudio generador.</p></aside>
    </section>}

    {tab==="studio" && <section className="studio-grid">
      <div className="studio-panel">
        <h3>Estudio generador</h3>
        <p className="mini">{selectedJob ? `Trabajo: ${selectedJob.clientName} · ${selectedJob.title}` : "Abre un job desde Trabajos o configura manualmente."}</p>

        <div className="form-grid">
          <div className="field"><label>Formato</label><select value={selectedJob?.format || form.format || "instagram-post"} onChange={e=>setForm({...form,format:e.target.value})}>{formats.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
          <div className="field"><label>Objetivo</label><select value={goal} onChange={e=>setGoal(e.target.value)}>{goals.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
          <div className="field"><label>Tipo</label><select value={contentType} onChange={e=>setContentType(e.target.value)}>{contentTypes.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
          <div className="field"><label>Modelo</label><select value={model} onChange={e=>setModel(e.target.value)}><option value="gemini-3-pro-image">Gemini Pro Imagen</option><option value="gemini-3.1-flash-image">Gemini 3.1 Flash</option><option value="gemini-2.5-flash-image">Gemini 2.5 Flash</option></select></div>
          <div className="field"><label>Variantes</label><select value={variantCount} onChange={e=>setVariantCount(Number(e.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={4}>4</option></select></div>
        </div>

        <div className="field"><label>Mensaje principal</label><textarea value={mainMessage} onChange={e=>setMainMessage(e.target.value)} placeholder="Mensaje central de la pieza"/></div>

        <h4>Textos oficiales dentro de la imagen</h4>
        {textBlocks.map(block=><div className="textblock-row" key={block.id}>
          <textarea value={block.text} onChange={e=>updateTextBlock(block.id,{text:e.target.value})} placeholder="Texto exacto que debe aparecer"/>
          <div className="form-grid">
            <select value={block.role} onChange={e=>updateTextBlock(block.id,{role:e.target.value})}><option value="headline">Titular</option><option value="subheadline">Subtítulo</option><option value="claim">Claim</option><option value="price">Precio</option><option value="promotion">Promoción</option><option value="cta">CTA</option><option value="date">Fecha</option><option value="free">Libre</option></select>
            <select value={block.priority} onChange={e=>updateTextBlock(block.id,{priority:e.target.value})}><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select>
            <button className="btn red" onClick={()=>removeTextBlock(block.id)}>Eliminar</button>
          </div>
          <input value={block.instruction} onChange={e=>updateTextBlock(block.id,{instruction:e.target.value})} placeholder="Instrucción específica opcional"/>
        </div>)}
        <button className="btn" onClick={()=>setTextBlocks([...textBlocks,newTextBlock()])}>Agregar texto</button>

        <div className="field"><label>Emoción / tono visual</label><div className="client-system-pills">{emotions.map(x=><button type="button" className={selectedEmotions.includes(x)?"btn blue":"btn"} key={x} onClick={()=>toggle(x,selectedEmotions,setSelectedEmotions)}>{x}</button>)}</div></div>
        <div className="field"><label>Elementos visuales</label><div className="client-system-pills">{visualElements.map(x=><button type="button" className={selectedVisualElements.includes(x)?"btn blue":"btn"} key={x} onClick={()=>toggle(x,selectedVisualElements,setSelectedVisualElements)}>{x}</button>)}</div></div>
        <div className="field"><label>Instrucciones específicas</label><textarea value={specificInstructions} onChange={e=>setSpecificInstructions(e.target.value)}/></div>

        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button className="btn" onClick={buildPrompt}>Construir prompt</button>
          <button className="btn blue" onClick={generateImage} disabled={isGenerating}>{isGenerating ? "Generando..." : "Generar imagen"}</button>
        </div>

        {generationError && <div className="reason-box">{generationError}</div>}

        {generatedImages.length>0 && <div className="generated-grid">
          {generatedImages.map((img,index)=><div className="generated-image-card" key={index}>
            <img src={`data:image/png;base64,${img}`} alt={`Generada ${index+1}`}/>
            <a className="btn" download={`bust-it-now-${index+1}.png`} href={`data:image/png;base64,${img}`}>Descargar</a>
          </div>)}
        </div>}
      </div>

      <aside className="studio-panel">
        <h3>Prompt construido</h3>
        <p className="mini">Este prompt usa la lógica real de BUST It Now: textos oficiales, reglas de marca, jerarquía, formatos y seguridad visual.</p>
        <pre className="prompt-preview">{generatedPrompt || "Construye el prompt para verlo aquí."}</pre>
      </aside>
    </section>}

    {tab==="map" && <section className="report-section">
      <h3>Mapa de integración</h3>
      <div className="platform-map">
        <div className="platform-node"><strong>clients</strong><span>Alta única de cliente. La usan Content OS y BUST It Now.</span></div>
        <div className="platform-node"><strong>contentRequests</strong><span>Piezas, tareas, aprobaciones, copy out y calendario operativo.</span></div>
        <div className="platform-node"><strong>bustItNowJobs</strong><span>Trabajos propios del módulo BUST It Now, ligados a cliente y opcionalmente a una tarea.</span></div>
        <div className="platform-node"><strong>/api/generate-image</strong><span>Endpoint real de generación con Gemini.</span></div>
      </div>
    </section>}
  </AppShell>
}
