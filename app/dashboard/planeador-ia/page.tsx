"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Brand,
  ContentRequest,
  PlannerDraft,
  ReferenceFile,
  contentTypes,
  emptyRequest,
  getRequestDate,
  isImageFile,
  listBrands,
  listPlannerDrafts,
  listRequests,
  objectives,
  savePlannerDraft,
  saveRequestBatch,
  updatePlannerDraft,
  uploadReferenceFiles
} from "@/lib/data";

export default function PlannerPage(){
  const [brands,setBrands]=useState<Brand[]>([]);
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [drafts,setDrafts]=useState<PlannerDraft[]>([]);
  const [currentDraftId,setCurrentDraftId]=useState("");
  const [draftName,setDraftName]=useState("");
  const [clientId,setClientId]=useState("");
  const [items,setItems]=useState<ContentRequest[]>([]);
  const [manual,setManual]=useState<ContentRequest>(emptyRequest);
  const [preview,setPreview]=useState<ReferenceFile|null>(null);
  const [busy,setBusy]=useState(false);

  const [aiCount,setAiCount]=useState(5);
  const [startDate,setStartDate]=useState("");
  const [interval,setInterval]=useState(2);
  const [types,setTypes]=useState("Reel,Carrusel,Post");
  const [goals,setGoals]=useState("Ventas,Awareness,Confianza");
  const [themes,setThemes]=useState("Experiencia,Producto estrella,Testimonios");
  const [must,setMust]=useState("CTA claro, alineado al tono de marca y sin contenido de relleno.");

  async function load(){
    const [loadedBrands, loadedRequests, loadedDrafts] = await Promise.all([
      listBrands(),
      listRequests(),
      listPlannerDrafts()
    ]);

    setBrands(loadedBrands);
    setRequests(loadedRequests);
    setDrafts(loadedDrafts);

    if(!clientId && loadedBrands[0]?.id){
      setClientId(loadedBrands[0].id);
    }
  }

  useEffect(()=>{load()},[]);

  const client = brands.find(x=>x.id===clientId) || brands[0];
  const existing = client?.id ? requests.filter(x=>x.clientId===client.id).length : 0;
  const calendarItems = useMemo(()=>{
    const saved = client?.id ? requests.filter(x=>x.clientId===client.id) : requests;
    return [...saved, ...items].filter(x=>getRequestDate(x));
  },[client?.id, requests, items]);

  function split(v:string){
    return v.split(",").map(x=>x.trim()).filter(Boolean);
  }

  function addDays(date:string, days:number){
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate()+days);
    return d.toISOString().slice(0,10);
  }

  function hydrateClientData(req: ContentRequest, source:string){
    return {
      ...req,
      clientId: client?.id || "",
      clientName: client?.name || "",
      total: items.length + 1,
      number: items.length + 1,
      status: "draft",
      source
    };
  }

  function setManualField(k:keyof ContentRequest, v:any){
    setManual({...manual,[k]:v});
  }

  async function createDraft(){
    if(!client?.id)return alert("Primero selecciona un cliente");
    const name = draftName || `${client.name} · Lote ${new Date().toLocaleDateString("es-MX")}`;
    setBusy(true);
    try{
      const ref = await savePlannerDraft({
        name,
        clientId: client.id,
        clientName: client.name,
        status: "draft",
        items
      });
      setCurrentDraftId(ref.id);
      setDraftName(name);
      await load();
      alert("Borrador creado en Firestore");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(){
    if(!client?.id)return alert("Selecciona cliente");
    if(!draftName)return alert("Agrega nombre del lote");
    setBusy(true);
    try{
      if(currentDraftId){
        await updatePlannerDraft(currentDraftId, {
          name: draftName,
          clientId: client.id,
          clientName: client.name,
          status: "draft",
          items
        });
      } else {
        const ref = await savePlannerDraft({
          name: draftName,
          clientId: client.id,
          clientName: client.name,
          status: "draft",
          items
        });
        setCurrentDraftId(ref.id);
      }
      await load();
      alert("Borrador guardado");
    } finally {
      setBusy(false);
    }
  }

  function openDraft(draft: PlannerDraft){
    setCurrentDraftId(draft.id||"");
    setDraftName(draft.name);
    setClientId(draft.clientId);
    setItems(draft.items||[]);
  }

  function newDraft(){
    setCurrentDraftId("");
    setDraftName("");
    setItems([]);
    setManual(emptyRequest);
  }

  function generateAI(){
    if(!client?.id)return alert("Selecciona cliente");
    if(!draftName)setDraftName(`${client.name} · Lote ${new Date().toLocaleDateString("es-MX")}`);

    const typeList = split(types);
    const goalList = split(goals);
    const themeList = split(themes);

    const generated = Array.from({length: Math.max(1, aiCount)}).map((_,i)=>{
      const contentType = typeList[i % typeList.length] || "Post";
      const objective = goalList[i % goalList.length] || "Ventas";
      const topic = themeList[i % themeList.length] || "Tema";
      const publishDate = startDate ? addDays(startDate, i * interval) : "";

      return hydrateClientData({
        ...emptyRequest,
        contentType,
        objective,
        topic,
        creativeIdea: `Idea creativa para ${topic} con enfoque en ${objective}.`,
        keyMessage: must,
        copyIn: "Copy inicial pendiente de ajustar.",
        cta: "Enviar WhatsApp / Solicitar información",
        publishDate
      }, "auto");
    });

    setItems([...items, ...generated]);
  }

  function addManual(){
    if(!client?.id)return alert("Selecciona cliente");
    if(!manual.creativeIdea)return alert("Agrega idea creativa");
    if(!draftName)setDraftName(`${client.name} · Lote ${new Date().toLocaleDateString("es-MX")}`);
    setItems([...items, hydrateClientData(manual, "manual")]);
    setManual(emptyRequest);
  }

  function updateItem(index:number, k:keyof ContentRequest, v:any){
    const next = [...items];
    next[index] = {...next[index], [k]: v};
    setItems(next);
  }

  function removeItem(index:number){
    if(!confirm("¿Quitar esta solicitud del borrador?"))return;
    setItems(items.filter((_,i)=>i!==index));
  }

  function duplicateItem(index:number){
    const item = items[index];
    setItems([...items, {...item, id: undefined, source:"manual"}]);
  }

  async function uploadToManual(files:FileList|null){
    if(!files)return;
    setBusy(true);
    try{
      const uploaded = await uploadReferenceFiles(files);
      setManual({...manual,referenceFiles:[...(manual.referenceFiles||[]),...uploaded]});
    } finally {
      setBusy(false);
    }
  }

  async function uploadToItem(index:number, files:FileList|null){
    if(!files)return;
    setBusy(true);
    try{
      const uploaded = await uploadReferenceFiles(files);
      const next = [...items];
      next[index] = {...next[index], referenceFiles:[...(next[index].referenceFiles||[]),...uploaded]};
      setItems(next);
    } finally {
      setBusy(false);
    }
  }

  function validateBatch(){
    if(!items.length){alert("No hay solicitudes en el borrador");return false}
    const incomplete = items.find(x=>!x.clientName||!x.contentType||!x.objective||!x.creativeIdea||!x.copyIn);
    if(incomplete){alert("Hay solicitudes incompletas. Revisa cliente, tipo, objetivo, idea creativa y Copy In.");return false}
    return true;
  }

  async function publishBatch(){
    if(!client?.id)return alert("Selecciona cliente");
    if(!draftName)return alert("Agrega nombre del lote");
    if(!validateBatch())return;

    setBusy(true);
    try{
      await saveRequestBatch({
        name: draftName,
        clientId: client.id,
        clientName: client.name,
        totalRequests: items.length,
        status: "published_to_requests"
      }, items.map((x,i)=>({...x,number:i+1,total:items.length})));

      if(currentDraftId){
        await updatePlannerDraft(currentDraftId,{status:"published_to_requests",items});
      }

      setItems([]);
      setCurrentDraftId("");
      setDraftName("");
      await load();
      alert("Lote enviado a Solicitudes");
    } finally {
      setBusy(false);
    }
  }

  return <AppShell active="Planeador IA">
    <div className="page-title">
      <p className="eyebrow">Planeador IA</p>
      <h1>Planeador formal en Firestore</h1>
      <p>Los borradores se guardan en Firebase y después se publican como lote completo a Solicitudes.</p>
    </div>

    <section className="grid kpis">
      {[
        ["Cliente",client?.name||"Sin cliente"],
        ["En borrador",String(items.length)],
        ["Solicitudes existentes",String(existing)],
        ["Borradores guardados",String(drafts.length)],
        ["Estado",busy?"Guardando":"Listo"],
        ["Fuente","Firestore"]
      ].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <div className="batch-bar">
      <div className="field" style={{margin:0,flex:1}}>
        <label>Nombre del lote</label>
        <input value={draftName} onChange={e=>setDraftName(e.target.value)} placeholder="Ej. Restaurante X · Semana 2 julio"/>
      </div>
      <button className="btn" onClick={createDraft}>Crear borrador</button>
      <button className="btn blue" onClick={saveDraft}>Guardar borrador</button>
      <button className="btn dark" onClick={publishBatch}>Enviar a Solicitudes</button>
      <button className="btn red" onClick={newDraft}>Nuevo</button>
    </div>

    <section className="grid two-col">
      <div className="grid">
        <div className="card">
          <h3>Agregar solicitudes al lote</h3>
          <div className="field">
            <label>Cliente</label>
            <select value={clientId} onChange={e=>setClientId(e.target.value)}>
              {brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>

          <h3>IA automática</h3>
          <div className="form-grid">
            <div className="field"><label>Cuántas propuestas</label><input type="number" value={aiCount} onChange={e=>setAiCount(Number(e.target.value))}/></div>
            <div className="field"><label>Primera fecha</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></div>
            <div className="field"><label>Cada cuántos días</label><input type="number" value={interval} onChange={e=>setInterval(Number(e.target.value))}/></div>
            <div className="field"><label>Tipos</label><input value={types} onChange={e=>setTypes(e.target.value)}/></div>
            <div className="field"><label>Objetivos</label><input value={goals} onChange={e=>setGoals(e.target.value)}/></div>
            <div className="field"><label>Temas</label><input value={themes} onChange={e=>setThemes(e.target.value)}/></div>
            <div className="field full"><label>Factores obligatorios</label><textarea value={must} onChange={e=>setMust(e.target.value)}/></div>
          </div>
          <button className="btn blue" onClick={generateAI}>Agregar propuestas IA</button>

          <h3 style={{marginTop:28}}>Manual</h3>
          <RequestForm request={manual} onChange={setManualField} onUpload={uploadToManual} onPreview={setPreview}/>
          <button className="btn blue" onClick={addManual}>Agregar manual al borrador</button>
        </div>

        <div className="card">
          <h3>Borrador actual</h3>
          {!items.length ? <div className="empty">Todavía no hay solicitudes en este borrador.</div> :
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Ficha</th><th>Fecha</th><th>Referencias</th><th>Copy In</th><th>Archivos</th><th></th></tr></thead>
              <tbody>{items.map((item,index)=><tr key={index}>
                <td>
                  <div className="field"><label>Tipo</label><select value={item.contentType} onChange={e=>updateItem(index,"contentType",e.target.value)}>{contentTypes.map(x=><option key={x}>{x}</option>)}</select></div>
                  <div className="field"><label>Objetivo</label><select value={item.objective} onChange={e=>updateItem(index,"objective",e.target.value)}>{objectives.map(x=><option key={x}>{x}</option>)}</select></div>
                  <div className="field"><label>Idea creativa</label><textarea value={item.creativeIdea} onChange={e=>updateItem(index,"creativeIdea",e.target.value)}/></div>
                </td>
                <td><input type="date" value={item.publishDate} onChange={e=>updateItem(index,"publishDate",e.target.value)}/></td>
                <td><textarea value={item.referenceLinks} onChange={e=>updateItem(index,"referenceLinks",e.target.value)}/></td>
                <td><textarea value={item.copyIn} onChange={e=>updateItem(index,"copyIn",e.target.value)}/></td>
                <td>
                  <input type="file" multiple onChange={e=>uploadToItem(index,e.target.files)}/>
                  <FileList files={item.referenceFiles} onPreview={setPreview}/>
                </td>
                <td>
                  <button className="btn" onClick={()=>duplicateItem(index)}>Duplicar</button><br/><br/>
                  <button className="btn red" onClick={()=>removeItem(index)}>Quitar</button>
                </td>
              </tr>)}</tbody>
            </table>
          </div>}
        </div>
      </div>

      <aside className="grid">
        <div className="card">
          <h3>Borradores guardados</h3>
          <div className="draft-list">
            {drafts.map(draft=><div className="draft-item" key={draft.id}>
              <strong>{draft.name}</strong>
              <span className="mini">{draft.clientName} · {draft.items?.length||0} solicitudes · {draft.status}</span>
              <button className="btn" onClick={()=>openDraft(draft)}>Abrir</button>
            </div>)}
            {!drafts.length && <p className="mini">Aún no hay borradores guardados.</p>}
          </div>
        </div>

        <div className="card">
          <h3>Calendario</h3>
          <CalendarPanel items={calendarItems}/>
        </div>
      </aside>
    </section>

    {preview && <PreviewModal file={preview} onClose={()=>setPreview(null)}/>}
  </AppShell>;
}

function RequestForm({
  request,
  onChange,
  onUpload,
  onPreview
}:{
  request:ContentRequest;
  onChange:(k:keyof ContentRequest,v:any)=>void;
  onUpload:(files:FileList|null)=>void;
  onPreview:(file:ReferenceFile)=>void;
}){
  return <div className="form-grid">
    <div className="field"><label>Tipo</label><select value={request.contentType} onChange={e=>onChange("contentType",e.target.value)}>{contentTypes.map(x=><option key={x}>{x}</option>)}</select></div>
    <div className="field"><label>Objetivo</label><select value={request.objective} onChange={e=>onChange("objective",e.target.value)}>{objectives.map(x=><option key={x}>{x}</option>)}</select></div>
    <div className="field full"><label>Idea creativa</label><textarea value={request.creativeIdea} onChange={e=>onChange("creativeIdea",e.target.value)}/></div>
    <div className="field full"><label>Links de referencia</label><textarea value={request.referenceLinks} onChange={e=>onChange("referenceLinks",e.target.value)}/></div>
    <div className="field full"><label>Archivos de referencia</label><input type="file" multiple onChange={e=>onUpload(e.target.files)}/><FileList files={request.referenceFiles} onPreview={onPreview}/></div>
    <div className="field full"><label>Copy In</label><textarea value={request.copyIn} onChange={e=>onChange("copyIn",e.target.value)}/></div>
    <div className="field"><label>Fecha publicación</label><input type="date" value={request.publishDate} onChange={e=>onChange("publishDate",e.target.value)}/></div>
    <div className="field"><label>CTA</label><input value={request.cta} onChange={e=>onChange("cta",e.target.value)}/></div>
  </div>;
}

function FileList({files,onPreview}:{files:ReferenceFile[];onPreview:(file:ReferenceFile)=>void}){
  return <div>
    <div className="image-grid">
      {(files||[]).map((file,index)=>isImageFile(file)?
        <button type="button" className="image-thumb" onClick={()=>onPreview(file)} key={index}>
          <img src={file.url} alt={file.name}/>
        </button>
        :
        <div className="image-thumb" key={index}><span>{file.name}</span></div>
      )}
    </div>
    <div className="file-list">
      {(files||[]).map((file,index)=><div className="file-card" key={index}>
        <div className="file-card-name">{file.name}</div>
        <div className="file-card-actions">
          <button type="button" className="btn" onClick={()=>onPreview(file)}>Ver preview</button>
          <a className="btn" href={file.url} target="_blank">Abrir archivo</a>
        </div>
      </div>)}
    </div>
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
  if(!entries.length)return <p className="mini">Aún no hay fechas seleccionadas.</p>;

  return <div className="calendar-panel">
    {entries.map(([month,days])=><div className="month-card" key={month}>
      <div className="month-title">{month}</div>
      <div className="days">{Array.from(new Set(days)).sort((a,b)=>Number(a)-Number(b)).map(day=><span className="day-dot" key={day}>{day}</span>)}</div>
    </div>)}
  </div>;
}
