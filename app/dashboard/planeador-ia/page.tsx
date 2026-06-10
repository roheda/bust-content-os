"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Brand,
  ContentRequest,
  ReferenceFile,
  contentTypes,
  emptyRequest,
  getRequestDate,
  listBrands,
  listRequests,
  objectives,
  saveRequestBatch,
  uploadReferenceFiles
} from "@/lib/data";

const DRAFT_KEY = "bust-content-os-planner-draft-v1";

type SavedDraft = {
  clientId: string;
  batchName: string;
  proposals: ContentRequest[];
};

export default function PlannerPage(){
  const [brands,setBrands]=useState<Brand[]>([]);
  const [all,setAll]=useState<ContentRequest[]>([]);
  const [clientId,setClientId]=useState("");
  const [batchName,setBatchName]=useState("");
  const [count,setCount]=useState(5);
  const [startDate,setStartDate]=useState("");
  const [interval,setInterval]=useState(2);
  const [types,setTypes]=useState("Reel,Carrusel,Post");
  const [goals,setGoals]=useState("Ventas,Awareness,Confianza");
  const [themes,setThemes]=useState("Experiencia,Producto estrella,Testimonios");
  const [must,setMust]=useState("CTA claro, no contenido de relleno");
  const [proposals,setProposals]=useState<ContentRequest[]>([]);
  const [manual,setManualState]=useState<ContentRequest>(emptyRequest);
  const [uploading,setUploading]=useState(false);
  const [hydrated,setHydrated]=useState(false);
  const [preview,setPreview]=useState<ReferenceFile|null>(null);

  async function load(){
    const b=await listBrands();
    const r=await listRequests();
    setBrands(b);
    setAll(r);
    if(!clientId&&b[0]?.id)setClientId(b[0].id);
  }

  useEffect(()=>{load()},[]);

  useEffect(()=>{
    try{
      const raw=localStorage.getItem(DRAFT_KEY);
      if(raw){
        const saved = JSON.parse(raw) as SavedDraft;
        setClientId(saved.clientId || "");
        setBatchName(saved.batchName || "");
        setProposals(saved.proposals || []);
      }
    }catch(e){}
    setHydrated(true);
  },[]);

  useEffect(()=>{
    if(!hydrated)return;
    const payload: SavedDraft = { clientId, batchName, proposals };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  },[hydrated,clientId,batchName,proposals]);

  const client=brands.find(x=>x.id===clientId)||brands[0];
  const existing=client?.id?all.filter(x=>x.clientId===client.id).length:0;
  const missing=Math.max((client?.posts||0)-existing,0);

  const calendarItems = useMemo(() => {
    const saved = client?.id ? all.filter(x => x.clientId === client.id) : all;
    return [...saved, ...proposals, manual].filter(x => getRequestDate(x));
  }, [all, proposals, manual, client?.id]);

  function split(v:string){return v.split(",").map(x=>x.trim()).filter(Boolean)}
  function addDays(dateStr:string, days:number){const d=new Date(dateStr+"T00:00:00");d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
  function setManual(k:keyof ContentRequest,v:any){setManualState({...manual,[k]:v})}

  function makeBaseRequest(partial: Partial<ContentRequest>, source: string): ContentRequest {
    return {
      ...emptyRequest,
      ...partial,
      clientId: client?.id || "",
      clientName: client?.name || "",
      total: client?.posts || 1,
      number: proposals.length + existing + 1,
      status: "draft",
      source
    };
  }

  function ensureBatchName(){
    if(!client)return;
    if(!batchName)setBatchName(`${client.name} · Lote ${new Date().toLocaleDateString("es-MX")}`);
  }

  function generate(){
    if(!client?.id)return alert("Selecciona cliente");
    ensureBatchName();
    const n=Math.max(1,count);
    const t=split(types), g=split(goals), th=split(themes);
    const generated = Array.from({length:n}).map((_,i)=>makeBaseRequest({
      number: proposals.length + existing + i + 1,
      contentType:t[i%t.length]||"Post",
      objective:g[i%g.length]||"Ventas",
      topic:th[i%th.length]||"Tema",
      creativeIdea:`Idea creativa para ${th[i%th.length]||"tema"} con enfoque en ${g[i%g.length]||"objetivo"}.`,
      referenceLinks:"",
      referenceFiles:[],
      copyIn:"Copy inicial pendiente de ajustar.",
      keyMessage:must,
      cta:"Enviar WhatsApp / Solicitar información",
      publishDate:startDate?addDays(startDate,i*interval):""
    }, "auto"));
    setProposals([...proposals, ...generated]);
  }

  function addManualToDraft(){
    if(!client?.id)return alert("Selecciona cliente");
    if(!manual.creativeIdea)return alert("Agrega idea creativa");
    ensureBatchName();
    setProposals([...proposals, makeBaseRequest({...manual, referenceFiles: manual.referenceFiles || []}, "manual")]);
    setManualState(emptyRequest);
  }

  function editProposal(i:number,k:keyof ContentRequest,v:any){
    const next=[...proposals];
    next[i]={...next[i],[k]:v};
    setProposals(next);
  }

  function duplicateProposal(i:number){
    const x = proposals[i];
    setProposals([...proposals, {...x, id: undefined, number: proposals.length + existing + 1, source: "manual"}]);
  }

  function removeProposal(i:number){
    if(!confirm("¿Quitar esta propuesta del borrador?"))return;
    setProposals(proposals.filter((_,idx)=>idx!==i));
  }

  async function uploadProposal(i:number,files:FileList|null){
    if(!files)return;
    setUploading(true);
    try{
      const uploaded=await uploadReferenceFiles(files,"content-request-references");
      const next=[...proposals];
      next[i].referenceFiles=[...(next[i].referenceFiles||[]),...uploaded];
      setProposals(next);
    }finally{
      setUploading(false);
    }
  }

  async function uploadManual(files:FileList|null){
    if(!files)return;
    setUploading(true);
    try{
      const uploaded=await uploadReferenceFiles(files,"content-request-references");
      setManualState({...manual,referenceFiles:[...(manual.referenceFiles||[]),...uploaded]});
    }finally{
      setUploading(false);
    }
  }

  function validateBatch(){
    if(!proposals.length){alert("No hay propuestas en borrador.");return false}
    const incomplete = proposals.find(x => !x.clientName || !x.contentType || !x.objective || !x.creativeIdea || !x.copyIn);
    if(incomplete){alert("Hay propuestas incompletas. Revisa cliente, tipo, objetivo, idea creativa y Copy In.");return false}
    return true;
  }

  async function saveBatch(){
    if(!client?.id)return alert("Selecciona cliente");
    if(!validateBatch())return;
    const name = batchName || `${client.name} · Lote ${new Date().toLocaleDateString("es-MX")}`;
    await saveRequestBatch({
      name,
      clientId: client.id,
      clientName: client.name,
      totalRequests: proposals.length,
      status: "enviado_a_solicitudes"
    }, proposals.map((x,i)=>({...x, number:i+1, total:proposals.length, batchName:name})));
    setProposals([]);
    setBatchName("");
    localStorage.removeItem(DRAFT_KEY);
    await load();
    alert("Lote enviado a Solicitudes");
  }

  function clearDraft(){
    if(!confirm("¿Borrar todo el borrador del lote?"))return;
    setProposals([]);
    setBatchName("");
    localStorage.removeItem(DRAFT_KEY);
  }

  return <AppShell active="Planeador IA">
    <div className="page-title">
      <p className="eyebrow">Planeador IA</p>
      <h1>Crear lote de solicitudes</h1>
      <p>Automático y manual alimentan el mismo borrador. El borrador se conserva aunque cambies de módulo.</p>
    </div>

    <section className="grid kpis">
      {[["Cliente",client?.name||"Sin cliente"],["Solicitudes en borrador",String(proposals.length)],["Creadas",String(existing)],["Faltan",String(missing)],["Uploads",uploading?"Subiendo":"Listo"],["Guardado","Local"]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <div className="batch-bar">
      <div className="field" style={{margin:0,flex:1}}>
        <label>Nombre del lote</label>
        <input value={batchName} onChange={e=>setBatchName(e.target.value)} placeholder="Ej. Cliente X · Semana 2 julio" />
      </div>
      <button className="btn blue" onClick={saveBatch}>Guardar lote completo</button>
      <button className="btn red" onClick={clearDraft}>Borrar borrador</button>
    </div>

    <section className="grid two-col">
      <div className="card">
        <h3>Agregar al borrador</h3>
        <div className="field"><label>Cliente</label><select value={clientId} onChange={e=>setClientId(e.target.value)}>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>

        <div className="tabs"><span className="tab active">IA automática</span></div>
        <div className="form-grid">
          <div className="field"><label>Cuántas propuestas</label><input type="number" value={count} onChange={e=>setCount(Number(e.target.value))}/></div>
          <div className="field"><label>Primera fecha de publicación</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></div>
          <div className="field"><label>Cada cuántos días</label><input type="number" value={interval} onChange={e=>setInterval(Number(e.target.value))}/></div>
          <div className="field"><label>Tipos</label><input value={types} onChange={e=>setTypes(e.target.value)}/></div>
          <div className="field"><label>Objetivos</label><input value={goals} onChange={e=>setGoals(e.target.value)}/></div>
          <div className="field"><label>Temas</label><input value={themes} onChange={e=>setThemes(e.target.value)}/></div>
          <div className="field full"><label>Factores obligatorios</label><textarea value={must} onChange={e=>setMust(e.target.value)} /></div>
        </div>
        <button className="btn blue" onClick={generate}>Agregar propuestas IA al borrador</button>

        <div className="tabs" style={{marginTop:28}}><span className="tab active">Manual</span></div>
        <RequestForm req={manual} onChange={setManual} onUpload={uploadManual} onPreview={setPreview}/>
        <button className="btn blue" onClick={addManualToDraft}>Agregar solicitud manual al borrador</button>
      </div>

      <aside className="card">
        <h3>Calendario de publicaciones</h3>
        <CalendarPanel items={calendarItems}/>
      </aside>
    </section>

    <section className="card" style={{marginTop:24}}>
      <h3>Borrador del lote</h3>
      <p className="mini">Nada de esto aparece en Solicitudes hasta dar clic en “Guardar lote completo”. Puedes mezclar propuestas IA y solicitudes manuales.</p>
      {!proposals.length ? <div className="empty-draft">Aún no hay solicitudes en el borrador.</div> :
      <div className="table-wrap"><table className="table"><thead><tr><th>Ficha</th><th>Fecha</th><th>Referencias</th><th>Copy In</th><th>Archivos</th><th></th></tr></thead><tbody>{proposals.map((x,i)=><tr key={i}><td><div className="field"><label>Tipo</label><input value={x.contentType} onChange={e=>editProposal(i,"contentType",e.target.value)}/></div><div className="field"><label>Objetivo</label><input value={x.objective} onChange={e=>editProposal(i,"objective",e.target.value)}/></div><div className="field"><label>Idea creativa</label><textarea value={x.creativeIdea} onChange={e=>editProposal(i,"creativeIdea",e.target.value)}/></div></td><td><input type="date" value={x.publishDate} onChange={e=>editProposal(i,"publishDate",e.target.value)}/></td><td><textarea value={x.referenceLinks} onChange={e=>editProposal(i,"referenceLinks",e.target.value)}/></td><td><textarea value={x.copyIn} onChange={e=>editProposal(i,"copyIn",e.target.value)}/></td><td><input type="file" multiple onChange={e=>uploadProposal(i,e.target.files)}/><FileList files={x.referenceFiles} onPreview={setPreview}/></td><td><button className="btn" onClick={()=>duplicateProposal(i)}>Duplicar</button><br/><br/><button className="btn red" onClick={()=>removeProposal(i)}>Quitar</button></td></tr>)}</tbody></table></div>}
    </section>

    {preview && <PreviewModal file={preview} onClose={()=>setPreview(null)}/>}
  </AppShell>
}

function RequestForm({req,onChange,onUpload,onPreview}:{req:ContentRequest;onChange:(k:keyof ContentRequest,v:any)=>void;onUpload:(files:FileList|null)=>void;onPreview:(f:ReferenceFile)=>void}){
  return <div className="form-grid"><div className="field"><label>Tipo</label><select value={req.contentType} onChange={e=>onChange("contentType",e.target.value)}>{contentTypes.map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label>Objetivo</label><select value={req.objective} onChange={e=>onChange("objective",e.target.value)}>{objectives.map(x=><option key={x}>{x}</option>)}</select></div><div className="field full"><label>Idea creativa</label><textarea value={req.creativeIdea} onChange={e=>onChange("creativeIdea",e.target.value)} /></div><div className="field full"><label>Links de referencia</label><textarea value={req.referenceLinks} onChange={e=>onChange("referenceLinks",e.target.value)} /></div><div className="field full"><label>Subir imágenes / archivos</label><input type="file" multiple onChange={e=>onUpload(e.target.files)} /><FileList files={req.referenceFiles} onPreview={onPreview}/></div><div className="field full"><label>Copy In</label><textarea value={req.copyIn} onChange={e=>onChange("copyIn",e.target.value)} /></div><div className="field"><label>Fecha de publicación</label><input type="date" value={req.publishDate} onChange={e=>onChange("publishDate",e.target.value)} /></div><div className="field"><label>CTA</label><input value={req.cta||""} onChange={e=>onChange("cta",e.target.value)} /></div></div>
}

function FileList({files,onPreview}:{files:ReferenceFile[];onPreview:(f:ReferenceFile)=>void}){
  return <div><div className="file-list">{(files||[]).map((f,i)=><a className="file-link" href={f.url} target="_blank" key={i}>{f.name}</a>)}</div><div className="image-grid">{(files||[]).filter(f=>f.type?.startsWith("image/")).map((f,i)=><button type="button" className="image-thumb" onClick={()=>onPreview(f)} key={i}><img src={f.url} alt={f.name}/></button>)}</div></div>
}

function PreviewModal({file,onClose}:{file:ReferenceFile;onClose:()=>void}){
  return <div className="preview-modal" onClick={onClose}><div className="preview-box" onClick={e=>e.stopPropagation()}><div className="preview-actions"><strong>{file.name}</strong><div style={{display:"flex",gap:8}}><a className="btn" href={file.url} target="_blank">Abrir</a><button className="btn red" onClick={onClose}>Cerrar</button></div></div>{file.type?.startsWith("image/")?<img src={file.url} alt={file.name}/>:<p>Este archivo no es imagen. Usa “Abrir” para verlo.</p>}</div></div>
}

function CalendarPanel({items}:{items:ContentRequest[]}){
  const groups:Record<string,string[]>={};
  for(const item of items){const raw=getRequestDate(item);if(!raw)continue;const d=new Date(raw+"T00:00:00");if(Number.isNaN(d.getTime()))continue;const key=d.toLocaleDateString("es-MX",{month:"long",year:"numeric"});const day=String(d.getDate());groups[key]=groups[key]||[];groups[key].push(day)}
  const entries=Object.entries(groups);
  if(!entries.length)return <p className="mini">Aún no hay fechas seleccionadas.</p>;
  return <div className="calendar-panel">{entries.map(([month,days])=><div className="month-card" key={month}><div className="month-title">{month}</div><div className="days">{Array.from(new Set(days)).sort((a,b)=>Number(a)-Number(b)).map(day=><span className="day-dot" key={day}>{day}</span>)}</div></div>)}</div>
}
