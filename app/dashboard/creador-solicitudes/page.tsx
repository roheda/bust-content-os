"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Brand,
  ContentRequest,
  PlannerDraft,
  ReferenceFile,
  areas,
  contentTypes,
  emptyRequest,
  getRequestDate,
  hasMaterial,
  isImageFile,
  listBrands,
  listPlannerDrafts,
  listRequests,
  objectives,
  savePlannerDraft,
  saveRequestBatch,
  updatePlannerDraft,
  uploadReferenceFiles,
  validateCreatorItem
} from "@/lib/data";

export default function CreatorPage(){
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
    if(!clientId && loadedBrands[0]?.id)setClientId(loadedBrands[0].id);
  }

  useEffect(()=>{load()},[]);

  const client = brands.find(x=>x.id===clientId) || brands[0];
  const existing = client?.id ? requests.filter(x=>x.clientId===client.id).length : 0;
  const calendarItems = useMemo(()=>{
    const saved = client?.id ? requests.filter(x=>x.clientId===client.id) : requests;
    return [...saved, ...items].filter(x=>getRequestDate(x));
  },[client?.id, requests, items]);

  function split(v:string){return v.split(",").map(x=>x.trim()).filter(Boolean)}
  function addDays(date:string, days:number){
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate()+days);
    return d.toISOString().slice(0,10);
  }

  function hydrate(req: ContentRequest, source:string): ContentRequest{
    return {
      ...req,
      clientId: client?.id || "",
      clientName: client?.name || "",
      total: items.length + 1,
      number: items.length + 1,
      status: req.requiresProduction ? "pendiente_produccion" : "lista_asignacion",
      source
    };
  }

  function setManualField(k:keyof ContentRequest, v:any){setManual({...manual,[k]:v})}

  async function saveDraft(){
    if(!client?.id)return alert("Selecciona cliente");
    const name = draftName || `${client.name} · Lote ${new Date().toLocaleDateString("es-MX")}`;
    setBusy(true);
    try{
      if(currentDraftId){
        await updatePlannerDraft(currentDraftId,{name,clientId:client.id,clientName:client.name,status:"draft",items});
      }else{
        const ref = await savePlannerDraft({name,clientId:client.id,clientName:client.name,status:"draft",items});
        setCurrentDraftId(ref.id);
      }
      setDraftName(name);
      await load();
      alert("Borrador guardado");
    }finally{setBusy(false)}
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
    const typeList=split(types), goalList=split(goals), themeList=split(themes);

    const generated = Array.from({length:Math.max(1,aiCount)}).map((_,i)=>{
      const contentType=typeList[i%typeList.length]||"Post";
      const objective=goalList[i%goalList.length]||"Ventas";
      const topic=themeList[i%themeList.length]||"Tema";
      const suggestedArea = ["Reel","TikTok","Foto"].includes(contentType) ? "Audiovisual" : "Diseño";

      return hydrate({
        ...emptyRequest,
        contentType,
        objective,
        topic,
        suggestedArea,
        creativeIdea:`Idea creativa para ${topic} con enfoque en ${objective}.`,
        keyMessage:must,
        copyIn:"Copy inicial pendiente de ajustar.",
        cta:"Enviar WhatsApp / Solicitar información",
        publishDate:startDate?addDays(startDate,i*interval):""
      },"auto");
    });

    setItems([...items,...generated]);
  }

  function addManual(){
    if(!client?.id)return alert("Selecciona cliente");
    if(!manual.creativeIdea)return alert("Agrega idea creativa");
    if(!draftName)setDraftName(`${client.name} · Lote ${new Date().toLocaleDateString("es-MX")}`);
    setItems([...items,hydrate(manual,"manual")]);
    setManual(emptyRequest);
  }

  function updateItem(index:number,k:keyof ContentRequest,v:any){
    const next=[...items];
    next[index]={...next[index],[k]:v};
    if(k==="requiresProduction"){
      next[index].status = v ? "pendiente_produccion" : "lista_asignacion";
    }
    setItems(next);
  }

  function removeItem(index:number){
    if(!confirm("¿Quitar solicitud del borrador?"))return;
    setItems(items.filter((_,i)=>i!==index));
  }

  function duplicateItem(index:number){
    setItems([...items,{...items[index],id:undefined,source:"manual"}]);
  }

  async function uploadToManual(kind:"reference"|"material",files:FileList|null){
    if(!files)return;
    setBusy(true);
    try{
      const uploaded=await uploadReferenceFiles(files,kind==="material"?"content-material":"content-request-references");
      if(kind==="reference")setManual({...manual,referenceFiles:[...(manual.referenceFiles||[]),...uploaded]});
      else setManual({...manual,materialFiles:[...(manual.materialFiles||[]),...uploaded],materialAvailable:true});
    }finally{setBusy(false)}
  }

  async function uploadToItem(index:number,kind:"reference"|"material",files:FileList|null){
    if(!files)return;
    setBusy(true);
    try{
      const uploaded=await uploadReferenceFiles(files,kind==="material"?"content-material":"content-request-references");
      const next=[...items];
      if(kind==="reference")next[index]={...next[index],referenceFiles:[...(next[index].referenceFiles||[]),...uploaded]};
      else next[index]={...next[index],materialFiles:[...(next[index].materialFiles||[]),...uploaded],materialAvailable:true};
      setItems(next);
    }finally{setBusy(false)}
  }

  function removeFileFromItem(index:number,kind:"reference"|"material",fileIndex:number){
    const next=[...items];
    if(kind==="reference")next[index]={...next[index],referenceFiles:(next[index].referenceFiles||[]).filter((_,i)=>i!==fileIndex)};
    else next[index]={...next[index],materialFiles:(next[index].materialFiles||[]).filter((_,i)=>i!==fileIndex)};
    setItems(next);
  }

  function validateBatch(){
    if(!items.length){alert("No hay solicitudes en el lote");return false}
    const errors = items.map((item,index)=>({index,error:validateCreatorItem(item)})).filter(x=>x.error);
    if(errors.length){
      alert(`No se puede enviar. Solicitud ${errors[0].index+1}: ${errors[0].error}`);
      return false;
    }
    return true;
  }

  async function publishBatch(){
    if(!client?.id)return alert("Selecciona cliente");
    const name = draftName || `${client.name} · Lote ${new Date().toLocaleDateString("es-MX")}`;
    if(!validateBatch())return;
    setBusy(true);
    try{
      await saveRequestBatch({name,clientId:client.id,clientName:client.name,totalRequests:items.length,status:"sent_to_assignment"},items.map((x,i)=>({...x,number:i+1,total:items.length})));
      if(currentDraftId)await updatePlannerDraft(currentDraftId,{status:"sent_to_assignment",items});
      setItems([]);
      setCurrentDraftId("");
      setDraftName("");
      await load();
      alert("Lote aprobado y enviado a Asignación");
    }finally{setBusy(false)}
  }

  return <AppShell active="Creador de Solicitudes">
    <div className="page-title">
      <p className="eyebrow">Content</p>
      <h1>Creador de Solicitudes</h1>
      <p>Content crea solicitudes completas. Si no requiere producción, el material es obligatorio antes de enviar a Asignación.</p>
    </div>

    <section className="grid kpis">
      {[["Cliente",client?.name||"Sin cliente"],["En lote",String(items.length)],["Solicitudes existentes",String(existing)],["Borradores",String(drafts.length)],["Estado",busy?"Guardando":"Listo"],["Destino","Asignación"]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <div className="batch-bar">
      <div className="field" style={{margin:0,flex:1}}>
        <label>Nombre del lote</label>
        <input value={draftName} onChange={e=>setDraftName(e.target.value)} placeholder="Ej. Cliente · Semana 2 julio"/>
      </div>
      <button className="btn blue" onClick={saveDraft}>Guardar borrador</button>
      <button className="btn dark" onClick={publishBatch}>Aprobar lote y enviar a Asignación</button>
      <button className="btn red" onClick={newDraft}>Nuevo</button>
    </div>

    <section className="grid two-col">
      <div className="grid">
        <div className="card">
          <h3>Agregar solicitudes</h3>
          <div className="field"><label>Cliente</label><select value={clientId} onChange={e=>setClientId(e.target.value)}>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>

          <h3>IA automática</h3>
          <div className="form-grid">
            <div className="field"><label>Cuántas</label><input type="number" value={aiCount} onChange={e=>setAiCount(Number(e.target.value))}/></div>
            <div className="field"><label>Primera fecha</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></div>
            <div className="field"><label>Cada cuántos días</label><input type="number" value={interval} onChange={e=>setInterval(Number(e.target.value))}/></div>
            <div className="field"><label>Tipos</label><input value={types} onChange={e=>setTypes(e.target.value)}/></div>
            <div className="field"><label>Objetivos</label><input value={goals} onChange={e=>setGoals(e.target.value)}/></div>
            <div className="field"><label>Temas</label><input value={themes} onChange={e=>setThemes(e.target.value)}/></div>
            <div className="field full"><label>Factores obligatorios</label><textarea value={must} onChange={e=>setMust(e.target.value)}/></div>
          </div>
          <button className="btn blue" onClick={generateAI}>Agregar propuestas IA</button>

          <h3 style={{marginTop:28}}>Manual</h3>
          <RequestForm request={manual} onChange={setManualField} onUpload={uploadToManual} onPreview={setPreview} onRemove={(kind,index)=> {
            if(kind==="reference")setManual({...manual,referenceFiles:manual.referenceFiles.filter((_,i)=>i!==index)});
            else setManual({...manual,materialFiles:manual.materialFiles.filter((_,i)=>i!==index)});
          }}/>
          <button className="btn blue" onClick={addManual}>Agregar manual al lote</button>
        </div>

        <div className="card">
          <h3>Lote actual</h3>
          {!items.length ? <div className="empty">Todavía no hay solicitudes.</div> :
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Solicitud</th><th>Producción / Material</th><th>Referencias</th><th>Acciones</th></tr></thead>
              <tbody>{items.map((item,index)=>{
                const error = validateCreatorItem(item);
                return <tr key={index}>
                  <td>
                    <div className="field"><label>Tipo</label><select value={item.contentType} onChange={e=>updateItem(index,"contentType",e.target.value)}>{contentTypes.map(x=><option key={x}>{x}</option>)}</select></div>
                    <div className="field"><label>Objetivo</label><select value={item.objective} onChange={e=>updateItem(index,"objective",e.target.value)}>{objectives.map(x=><option key={x}>{x}</option>)}</select></div>
                    <div className="field"><label>Área sugerida</label><select value={item.suggestedArea} onChange={e=>updateItem(index,"suggestedArea",e.target.value)}>{areas.map(x=><option key={x}>{x}</option>)}</select></div>
                    <div className="field"><label>Fecha publicación</label><input type="date" value={item.publishDate} onChange={e=>updateItem(index,"publishDate",e.target.value)}/></div>
                    <div className="field"><label>Idea creativa</label><textarea value={item.creativeIdea} onChange={e=>updateItem(index,"creativeIdea",e.target.value)}/></div>
                    <div className="field"><label>Copy In</label><textarea value={item.copyIn} onChange={e=>updateItem(index,"copyIn",e.target.value)}/></div>
                    {error?<span className="pill red">{error}</span>:<span className="pill green">Lista para enviar</span>}
                  </td>
                  <td>
                    <label className="check-row"><input type="checkbox" checked={item.requiresProduction} onChange={e=>updateItem(index,"requiresProduction",e.target.checked)}/> Requiere producción</label>
                    {!item.requiresProduction && <label className="check-row"><input type="checkbox" checked={item.materialAvailable} onChange={e=>updateItem(index,"materialAvailable",e.target.checked)}/> Material disponible</label>}
                    <div className="field"><label>Links de material</label><textarea value={item.materialLinks} onChange={e=>updateItem(index,"materialLinks",e.target.value)} placeholder="Drive, Dropbox, Frame, etc."/></div>
                    <div className="field"><label>Archivos de material</label><input type="file" multiple onChange={e=>uploadToItem(index,"material",e.target.files)}/><FileList files={item.materialFiles||[]} onPreview={setPreview} onRemove={(i)=>removeFileFromItem(index,"material",i)}/></div>
                    {item.requiresProduction && <div className="field"><label>Notas para producción</label><textarea value={item.productionNotes} onChange={e=>updateItem(index,"productionNotes",e.target.value)} placeholder="Tomas necesarias, estilo, locación, etc."/></div>}
                  </td>
                  <td>
                    <div className="field"><label>Links inspiración</label><textarea value={item.referenceLinks} onChange={e=>updateItem(index,"referenceLinks",e.target.value)}/></div>
                    <input type="file" multiple onChange={e=>uploadToItem(index,"reference",e.target.files)}/>
                    <FileList files={item.referenceFiles||[]} onPreview={setPreview} onRemove={(i)=>removeFileFromItem(index,"reference",i)}/>
                  </td>
                  <td>
                    <button className="btn" onClick={()=>duplicateItem(index)}>Duplicar</button><br/><br/>
                    <button className="btn red" onClick={()=>removeItem(index)}>Quitar</button>
                  </td>
                </tr>
              })}</tbody>
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
            {!drafts.length && <p className="mini">Aún no hay borradores.</p>}
          </div>
        </div>
        <div className="card">
          <h3>Calendario del lote</h3>
          <CalendarPanel items={calendarItems}/>
        </div>
      </aside>
    </section>

    {preview && <PreviewModal file={preview} onClose={()=>setPreview(null)}/>}
  </AppShell>
}

function RequestForm({request,onChange,onUpload,onPreview,onRemove}:{request:ContentRequest;onChange:(k:keyof ContentRequest,v:any)=>void;onUpload:(kind:"reference"|"material",files:FileList|null)=>void;onPreview:(file:ReferenceFile)=>void;onRemove:(kind:"reference"|"material",index:number)=>void;}){
  return <div className="form-grid">
    <div className="field"><label>Tipo</label><select value={request.contentType} onChange={e=>onChange("contentType",e.target.value)}>{contentTypes.map(x=><option key={x}>{x}</option>)}</select></div>
    <div className="field"><label>Objetivo</label><select value={request.objective} onChange={e=>onChange("objective",e.target.value)}>{objectives.map(x=><option key={x}>{x}</option>)}</select></div>
    <div className="field"><label>Área sugerida</label><select value={request.suggestedArea} onChange={e=>onChange("suggestedArea",e.target.value)}>{areas.map(x=><option key={x}>{x}</option>)}</select></div>
    <div className="field"><label>Fecha publicación</label><input type="date" value={request.publishDate} onChange={e=>onChange("publishDate",e.target.value)}/></div>
    <div className="field full"><label>Idea creativa</label><textarea value={request.creativeIdea} onChange={e=>onChange("creativeIdea",e.target.value)}/></div>
    <div className="field full"><label>Copy In</label><textarea value={request.copyIn} onChange={e=>onChange("copyIn",e.target.value)}/></div>
    <div className="field full"><label>Inspiración / referencias</label><textarea value={request.referenceLinks} onChange={e=>onChange("referenceLinks",e.target.value)}/><input type="file" multiple onChange={e=>onUpload("reference",e.target.files)}/><FileList files={request.referenceFiles||[]} onPreview={onPreview} onRemove={(i)=>onRemove("reference",i)}/></div>
    <div className="field full">
      <label>Producción / Material</label>
      <label className="check-row"><input type="checkbox" checked={request.requiresProduction} onChange={e=>onChange("requiresProduction",e.target.checked)}/> Requiere producción</label>
      {!request.requiresProduction && <label className="check-row"><input type="checkbox" checked={request.materialAvailable} onChange={e=>onChange("materialAvailable",e.target.checked)}/> Material disponible</label>}
      <textarea value={request.materialLinks} onChange={e=>onChange("materialLinks",e.target.value)} placeholder="Links de material si ya existe"/>
      <input type="file" multiple onChange={e=>onUpload("material",e.target.files)}/>
      <FileList files={request.materialFiles||[]} onPreview={onPreview} onRemove={(i)=>onRemove("material",i)}/>
    </div>
  </div>
}

function FileList({files,onPreview,onRemove}:{files:ReferenceFile[];onPreview:(file:ReferenceFile)=>void;onRemove:(index:number)=>void;}){
  return <div className="ref-grid">
    {(files||[]).map((file,index)=><button type="button" className="ref-thumb" onClick={()=>onPreview(file)} key={index}>
      {isImageFile(file)?<img src={file.url} alt="Referencia"/>:<div className="ref-thumb-file">Archivo</div>}
      <span className="ref-delete" onClick={(event)=>{event.stopPropagation();onRemove(index);}}>Eliminar</span>
    </button>)}
  </div>
}

function PreviewModal({file,onClose}:{file:ReferenceFile;onClose:()=>void}){
  return <div className="preview-modal" onClick={onClose}>
    <div className="preview-box" onClick={e=>e.stopPropagation()}>
      <div className="preview-actions"><strong>{file.name}</strong><button className="btn red" onClick={onClose}>Cerrar</button></div>
      {isImageFile(file)?<img src={file.url} alt={file.name}/>:<p>Archivo no previsualizable.</p>}
    </div>
  </div>
}

function CalendarPanel({items}:{items:ContentRequest[]}){
  const groups:Record<string,string[]>={};
  for(const item of items){
    const raw=getRequestDate(item);
    if(!raw)continue;
    const d=new Date(raw+"T00:00:00");
    if(Number.isNaN(d.getTime()))continue;
    const key=d.toLocaleDateString("es-MX",{month:"long",year:"numeric"});
    groups[key]=groups[key]||[];
    groups[key].push(String(d.getDate()));
  }
  const entries=Object.entries(groups);
  if(!entries.length)return <p className="mini">Sin fechas.</p>;
  return <div className="calendar-panel">{entries.map(([month,days])=><div className="month-card" key={month}><div className="month-title">{month}</div><div className="days">{Array.from(new Set(days)).sort((a,b)=>Number(a)-Number(b)).map(day=><span className="day-dot" key={day}>{day}</span>)}</div></div>)}</div>
}
