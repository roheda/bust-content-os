"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Brand, ContentRequest, ReferenceFile, contentTypes, emptyRequest, getRequestDate, listBrands, listRequests, objectives, saveRequest, saveRequests, uploadReferenceFiles } from "@/lib/data";

export default function PlannerPage(){
  const [brands,setBrands]=useState<Brand[]>([]);
  const [all,setAll]=useState<ContentRequest[]>([]);
  const [clientId,setClientId]=useState("");
  const [mode,setMode]=useState<"auto"|"manual">("auto");
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

  async function load(){const b=await listBrands();const r=await listRequests();setBrands(b);setAll(r);if(!clientId&&b[0]?.id)setClientId(b[0].id)}
  useEffect(()=>{load()},[]);

  const client=brands.find(x=>x.id===clientId)||brands[0];
  const existing=client?.id?all.filter(x=>x.clientId===client.id).length:0;
  const missing=Math.max((client?.posts||0)-existing,0);

  const calendarItems = useMemo(() => {
    const saved = client?.id ? all.filter(x => x.clientId === client.id) : all;
    return [...saved, ...proposals, manual].filter(x => getRequestDate(x));
  }, [all, proposals, manual, client?.id]);

  function split(v:string){return v.split(",").map(x=>x.trim()).filter(Boolean)}
  function setManual(k:keyof ContentRequest,v:any){setManualState({...manual,[k]:v})}
  function withClient(r:ContentRequest){return {...r,clientId:client?.id||"",clientName:client?.name||"",total:client?.posts||1,number:existing+1}}
  function addDays(dateStr:string, days:number){const d=new Date(dateStr+"T00:00:00");d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}

  function generate(){
    if(!client?.id)return alert("Selecciona cliente");
    const n=Math.max(1,count);
    const t=split(types), g=split(goals), th=split(themes);
    setProposals(Array.from({length:n}).map((_,i)=>({
      clientId:client.id!,
      clientName:client.name,
      number:existing+i+1,
      total:client.posts,
      contentType:t[i%t.length]||"Post",
      objective:g[i%g.length]||"Ventas",
      topic:th[i%th.length]||"Tema",
      creativeIdea:`Idea creativa para ${th[i%th.length]||"tema"} con enfoque en ${g[i%g.length]||"objetivo"}.`,
      referenceLinks:"",
      referenceFiles:[],
      copyIn:"Copy inicial pendiente de ajustar.",
      keyMessage:must,
      cta:"Enviar WhatsApp / Solicitar información",
      publishDate:startDate?addDays(startDate,i*interval):"",
      status:"draft",
      source:"auto"
    })));
  }

  function editProposal(i:number,k:keyof ContentRequest,v:any){const next=[...proposals];next[i]={...next[i],[k]:v};setProposals(next)}
  async function uploadProposal(i:number,files:FileList|null){if(!files)return;setUploading(true);const uploaded=await uploadReferenceFiles(files,"content-request-references");const next=[...proposals];next[i].referenceFiles=[...(next[i].referenceFiles||[]),...uploaded];setProposals(next);setUploading(false)}
  async function uploadManual(files:FileList|null){if(!files)return;setUploading(true);const uploaded=await uploadReferenceFiles(files,"content-request-references");setManualState({...manual,referenceFiles:[...(manual.referenceFiles||[]),...uploaded]});setUploading(false)}
  async function saveAuto(){if(!proposals.length)return alert("Genera propuestas primero");await saveRequests(proposals);setProposals([]);await load();alert("Propuestas guardadas")}
  async function saveManual(){if(!client?.id)return alert("Selecciona cliente");if(!manual.creativeIdea)return alert("Agrega idea creativa");await saveRequest(withClient({...manual,source:"manual"}));setManualState(emptyRequest);await load();alert("Solicitud manual guardada")}

  return <AppShell active="Planeador IA"><div className="page-title"><p className="eyebrow">Planeador IA</p><h1>Crear solicitudes de contenido</h1><p>La fecha funciona como fecha de publicación. El calendario lateral marca los meses y días ocupados.</p></div><section className="grid kpis">{[["Cliente",client?.name||"Sin cliente"],["Paquete",String(client?.posts||0)+" posts"],["Creadas",String(existing)],["Faltan",String(missing)],["Modo",mode],["Uploads",uploading?"Subiendo":"Listo"]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}</section><div className="tabs"><button className={mode==="auto"?"tab active":"tab"} onClick={()=>setMode("auto")}>Automático</button><button className={mode==="manual"?"tab active":"tab"} onClick={()=>setMode("manual")}>Manual</button></div><section className="grid two-col"><div className="card"><h3>{mode==="auto"?"Generador controlado":"Solicitud manual"}</h3><div className="field"><label>Cliente</label><select value={clientId} onChange={e=>setClientId(e.target.value)}>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>{mode==="auto"?<><div className="form-grid"><div className="field"><label>Cuántas propuestas</label><input type="number" value={count} onChange={e=>setCount(Number(e.target.value))}/></div><div className="field"><label>Primera fecha de publicación</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></div><div className="field"><label>Cada cuántos días</label><input type="number" value={interval} onChange={e=>setInterval(Number(e.target.value))}/></div><div className="field"><label>Tipos</label><input value={types} onChange={e=>setTypes(e.target.value)}/></div><div className="field"><label>Objetivos</label><input value={goals} onChange={e=>setGoals(e.target.value)}/></div><div className="field"><label>Temas</label><input value={themes} onChange={e=>setThemes(e.target.value)}/></div><div className="field full"><label>Factores obligatorios</label><textarea value={must} onChange={e=>setMust(e.target.value)} /></div></div><button className="btn blue" onClick={generate}>Generar propuestas</button> <button className="btn" onClick={saveAuto}>Guardar propuestas</button></>:<><RequestForm req={manual} onChange={setManual} onUpload={uploadManual}/><button className="btn blue" onClick={saveManual}>Guardar solicitud manual</button></>}</div><aside className="card"><h3>Calendario de publicaciones</h3><CalendarPanel items={calendarItems}/></aside></section><section className="card" style={{marginTop:24}}><h3>Propuestas para revisar y editar</h3><div className="table-wrap"><table className="table"><thead><tr><th>Ficha</th><th>Fecha</th><th>Referencias</th><th>Copy In</th><th>Archivos</th></tr></thead><tbody>{proposals.map((x,i)=><tr key={i}><td><div className="field"><label>Tipo</label><input value={x.contentType} onChange={e=>editProposal(i,"contentType",e.target.value)}/></div><div className="field"><label>Objetivo</label><input value={x.objective} onChange={e=>editProposal(i,"objective",e.target.value)}/></div><div className="field"><label>Idea creativa</label><textarea value={x.creativeIdea} onChange={e=>editProposal(i,"creativeIdea",e.target.value)}/></div></td><td><input type="date" value={x.publishDate} onChange={e=>editProposal(i,"publishDate",e.target.value)}/></td><td><textarea value={x.referenceLinks} onChange={e=>editProposal(i,"referenceLinks",e.target.value)}/></td><td><textarea value={x.copyIn} onChange={e=>editProposal(i,"copyIn",e.target.value)}/></td><td><input type="file" multiple onChange={e=>uploadProposal(i,e.target.files)}/><FileList files={x.referenceFiles}/></td></tr>)}</tbody></table></div></section></AppShell>
}

function RequestForm({req,onChange,onUpload}:{req:ContentRequest;onChange:(k:keyof ContentRequest,v:any)=>void;onUpload:(files:FileList|null)=>void}){return <div className="form-grid"><div className="field"><label>Tipo</label><select value={req.contentType} onChange={e=>onChange("contentType",e.target.value)}>{contentTypes.map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label>Objetivo</label><select value={req.objective} onChange={e=>onChange("objective",e.target.value)}>{objectives.map(x=><option key={x}>{x}</option>)}</select></div><div className="field full"><label>Idea creativa</label><textarea value={req.creativeIdea} onChange={e=>onChange("creativeIdea",e.target.value)} /></div><div className="field full"><label>Links de referencia</label><textarea value={req.referenceLinks} onChange={e=>onChange("referenceLinks",e.target.value)} /></div><div className="field full"><label>Subir imágenes / archivos</label><input type="file" multiple onChange={e=>onUpload(e.target.files)} /><FileList files={req.referenceFiles}/></div><div className="field full"><label>Copy In</label><textarea value={req.copyIn} onChange={e=>onChange("copyIn",e.target.value)} /></div><div className="field"><label>Fecha de publicación</label><input type="date" value={req.publishDate} onChange={e=>onChange("publishDate",e.target.value)} /></div><div className="field"><label>CTA</label><input value={req.cta||""} onChange={e=>onChange("cta",e.target.value)} /></div></div>}

function FileList({files}:{files:ReferenceFile[]}){return <div><div className="file-list">{(files||[]).map((f,i)=><a className="file-link" href={f.url} target="_blank" key={i}>{f.name}</a>)}</div><div className="image-grid">{(files||[]).filter(f=>f.type?.startsWith("image/")).map((f,i)=><a className="image-thumb" href={f.url} target="_blank" key={i}><img src={f.url} alt={f.name}/></a>)}</div></div>}

function CalendarPanel({items}:{items:ContentRequest[]}){const groups:Record<string,string[]>={};for(const item of items){const raw=getRequestDate(item);if(!raw)continue;const d=new Date(raw+"T00:00:00");if(Number.isNaN(d.getTime()))continue;const key=d.toLocaleDateString("es-MX",{month:"long",year:"numeric"});const day=String(d.getDate());groups[key]=groups[key]||[];groups[key].push(day)}const entries=Object.entries(groups);if(!entries.length)return <p className="mini">Aún no hay fechas seleccionadas.</p>;return <div className="calendar-panel">{entries.map(([month,days])=><div className="month-card" key={month}><div className="month-title">{month}</div><div className="days">{Array.from(new Set(days)).sort((a,b)=>Number(a)-Number(b)).map(day=><span className="day-dot" key={day}>{day}</span>)}</div></div>)}</div>}
