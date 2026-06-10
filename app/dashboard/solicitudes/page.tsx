"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Brand,
  ContentRequest,
  ReferenceFile,
  contentTypes,
  deleteRequest,
  getRequestDate,
  isImageFile,
  listBrands,
  listRequests,
  objectives,
  requestStates,
  updateRequest,
  uploadReferenceFiles
} from "@/lib/data";

export default function RequestsPage(){
  const [items,setItems]=useState<ContentRequest[]>([]);
  const [brands,setBrands]=useState<Brand[]>([]);
  const [client,setClient]=useState("all");
  const [status,setStatus]=useState("all");
  const [editing,setEditing]=useState<ContentRequest|null>(null);
  const [uploading,setUploading]=useState(false);
  const [preview,setPreview]=useState<ReferenceFile|null>(null);

  async function load(){
    setItems(await listRequests());
    setBrands(await listBrands());
  }

  useEffect(()=>{load()},[]);

  const filtered = useMemo(()=>items.filter(item=>
    (client==="all"||item.clientId===client) &&
    (status==="all"||item.status===status)
  ),[items,client,status]);

  function set(k:keyof ContentRequest,v:any){
    if(editing)setEditing({...editing,[k]:v});
  }

  async function upload(files:FileList|null){
    if(!editing||!files)return;
    setUploading(true);
    try{
      const uploaded = await uploadReferenceFiles(files);
      setEditing({...editing,referenceFiles:[...(editing.referenceFiles||[]),...uploaded]});
    } finally {
      setUploading(false);
    }
  }

  function removeEditingFile(index:number){
    if(!editing)return;
    setEditing({
      ...editing,
      referenceFiles: (editing.referenceFiles||[]).filter((_,i)=>i!==index)
    });
  }

  async function saveEdit(){
    if(!editing?.id)return;
    await updateRequest(editing.id,editing);
    setEditing(null);
    await load();
    alert("Solicitud actualizada");
  }

  async function remove(id?:string){
    if(id&&confirm("¿Eliminar solicitud?")){
      await deleteRequest(id);
      await load();
      if(editing?.id===id)setEditing(null);
    }
  }

  return <AppShell active="Solicitudes">
    <section className="hero">
      <div>
        <p className="eyebrow">Solicitudes</p>
        <h1>Solicitudes publicadas</h1>
        <p>Estas piezas vienen de lotes aprobados desde el Planeador IA.</p>
      </div>
    </section>

    <section className="grid kpis">
      {[
        ["Total",String(items.length)],
        ["Filtradas",String(filtered.length)],
        ["Clientes",String(brands.length)],
        ["Draft",String(items.filter(x=>x.status==="draft").length)],
        ["Archivos",String(items.reduce((a,x)=>a+(x.referenceFiles?.length||0),0))],
        ["Vista","Firestore"]
      ].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <div className="toolbar">
      <select value={client} onChange={e=>setClient(e.target.value)}>
        <option value="all">Todos los clientes</option>
        {brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <select value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="all">Todos los estados</option>
        {requestStates.map(x=><option key={x}>{x}</option>)}
      </select>
      <button className="btn" onClick={load}>Actualizar</button>
    </div>

    <section className="grid two-col">
      <div className="card">
        <h3>Solicitudes</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Cliente</th><th>Lote</th><th>Fecha</th><th>Tipo</th><th>Objetivo</th><th>Idea</th><th>Refs</th><th></th></tr></thead>
            <tbody>{filtered.map(item=><tr key={item.id}>
              <td><strong>{item.clientName}</strong></td>
              <td><span className="mini">{item.batchName||"Individual"}</span></td>
              <td>{getRequestDate(item)||"Sin fecha"}</td>
              <td>{item.contentType}</td>
              <td>{item.objective}</td>
              <td><strong>{item.creativeIdea}</strong><br/><span className="mini">{item.copyIn}</span></td>
              <td>{item.referenceFiles?.length||0} archivos</td>
              <td><button className="btn" onClick={()=>setEditing(item)}>Editar</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>

      <aside className="card">
        <h3>{editing?"Editar solicitud":"Calendario"}</h3>
        {editing ? <div>
          <div className="form-grid">
            <div className="field"><label>Cliente</label><input value={editing.clientName} disabled /></div>
            <div className="field"><label>Fecha publicación</label><input type="date" value={editing.publishDate} onChange={e=>set("publishDate",e.target.value)} /></div>
            <div className="field"><label>Tipo</label><select value={editing.contentType} onChange={e=>set("contentType",e.target.value)}>{contentTypes.map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="field"><label>Objetivo</label><select value={editing.objective} onChange={e=>set("objective",e.target.value)}>{objectives.map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="field"><label>Estado</label><select value={editing.status} onChange={e=>set("status",e.target.value)}>{requestStates.map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="field full"><label>Idea creativa</label><textarea value={editing.creativeIdea} onChange={e=>set("creativeIdea",e.target.value)} /></div>
            <div className="field full"><label>Links referencia</label><textarea value={editing.referenceLinks} onChange={e=>set("referenceLinks",e.target.value)} /></div>
            <div className="field full"><label>Archivos</label><input type="file" multiple onChange={e=>upload(e.target.files)} /><span className="mini">{uploading?"Subiendo...":""}</span><FileList files={editing.referenceFiles||[]} onPreview={setPreview} onRemove={removeEditingFile}/></div>
            <div className="field full"><label>Copy In</label><textarea value={editing.copyIn} onChange={e=>set("copyIn",e.target.value)} /></div>
            <div className="field full"><label>Mensaje clave</label><textarea value={editing.keyMessage} onChange={e=>set("keyMessage",e.target.value)} /></div>
            <div className="field"><label>CTA</label><input value={editing.cta} onChange={e=>set("cta",e.target.value)} /></div>
          </div>
          <div style={{display:"flex",gap:12,marginTop:12}}>
            <button className="btn blue" onClick={saveEdit}>Guardar cambios</button>
            <button className="btn" onClick={()=>setEditing(null)}>Cerrar</button>
            <button className="btn red" onClick={()=>remove(editing.id)}>Eliminar</button>
          </div>
        </div> : <CalendarPanel items={filtered}/>}
      </aside>
    </section>

    {preview && <PreviewModal file={preview} onClose={()=>setPreview(null)}/>}
  </AppShell>;
}

function FileList({
  files,
  onPreview,
  onRemove
}:{
  files:ReferenceFile[];
  onPreview:(file:ReferenceFile)=>void;
  onRemove:(index:number)=>void;
}){
  return <div className="ref-grid">
    {(files||[]).map((file,index)=>
      <button type="button" className="ref-thumb" onClick={()=>onPreview(file)} key={index}>
        {isImageFile(file)
          ? <img src={file.url} alt="Referencia"/>
          : <div className="ref-thumb-file">Archivo</div>
        }
        <span
          className="ref-delete"
          onClick={(event)=>{event.stopPropagation();onRemove(index);}}
        >
          Eliminar
        </span>
      </button>
    )}
  </div>;
}

function PreviewModal({file,onClose}:{file:ReferenceFile;onClose:()=>void}){
  const image = isImageFile(file);
  return <div className="preview-modal" onClick={onClose}>
    <div className="preview-box" onClick={e=>e.stopPropagation()}>
      <div className="preview-actions">
        <strong>{file.name}</strong>
        <div style={{display:"flex",gap:8}}>
          <a className="btn" href={file.url} target="_blank">Abrir</a>
          <button className="btn red" onClick={onClose}>Cerrar</button>
        </div>
      </div>
      {image ? <img src={file.url} alt={file.name}/> : <p>Este archivo no es imagen o el navegador no puede previsualizarlo. Usa “Abrir” para verlo.</p>}
    </div>
  </div>;
}

function CalendarPanel({items}:{items:ContentRequest[]}){
  const groups:Record<string,string[]> = {};
  for(const item of items){
    const raw = getRequestDate(item);
    if(!raw)continue;
    const date = new Date(raw+"T00:00:00");
    if(Number.isNaN(date.getTime()))continue;
    const month = date.toLocaleDateString("es-MX",{month:"long",year:"numeric"});
    const day = String(date.getDate());
    groups[month] = groups[month] || [];
    groups[month].push(day);
  }
  const entries = Object.entries(groups);
  if(!entries.length)return <p className="mini">No hay publicaciones con fecha en este filtro.</p>;
  return <div className="calendar-panel">{entries.map(([month,days])=><div className="month-card" key={month}><div className="month-title">{month}</div><div className="days">{Array.from(new Set(days)).sort((a,b)=>Number(a)-Number(b)).map(day=><span className="day-dot" key={day}>{day}</span>)}</div></div>)}</div>;
}
