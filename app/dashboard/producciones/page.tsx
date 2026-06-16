"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Brand, ContentRequest, Production, ReferenceFile, isImageFile, listBrands, listProductions, listRequests, saveProduction, updateProduction, updateRequest, uploadReferenceFiles } from "@/lib/data";

const empty: Production = {
  title: "",
  clientId: "",
  clientName: "",
  requestIds: [],
  objective: "",
  location: "",
  scheduledDate: "",
  startTime: "",
  endTime: "",
  producer: "",
  team: "",
  shotList: "",
  requirements: "",
  notes: "",
  materialLinks: "",
  materialLinksByRequest: {},
  materialFiles: [],
  status: "programada"
};

export default function ProductionsPage(){
  const [brands,setBrands]=useState<Brand[]>([]);
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [productions,setProductions]=useState<Production[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [form,setForm]=useState<Production>(empty);
  const [showModal,setShowModal]=useState(false);
  const [editing,setEditing]=useState<Production|null>(null);
  const [preview,setPreview]=useState<ReferenceFile|null>(null);
  const [brief,setBrief]=useState<Production|null>(null);
  const [uploading,setUploading]=useState(false);

  const [reqClientFilter,setReqClientFilter]=useState("all");
  const [reqAreaFilter,setReqAreaFilter]=useState("all");
  const [reqTypeFilter,setReqTypeFilter]=useState("all");
  const [reqStartDate,setReqStartDate]=useState("");
  const [reqEndDate,setReqEndDate]=useState("");
  const [reqSearch,setReqSearch]=useState("");

  const [prodClientFilter,setProdClientFilter]=useState("all");
  const [prodStatusFilter,setProdStatusFilter]=useState("all");
  const [prodProducerFilter,setProdProducerFilter]=useState("all");
  const [prodMaterialFilter,setProdMaterialFilter]=useState("all");
  const [prodStartDate,setProdStartDate]=useState("");
  const [prodEndDate,setProdEndDate]=useState("");
  const [prodSearch,setProdSearch]=useState("");

  async function load(){
    setBrands(await listBrands());
    setRequests(await listRequests());
    setProductions(await listProductions());
  }
  useEffect(()=>{load()},[]);

  function inDateRange(value:string|undefined, start:string, end:string){
    if(!value)return true;
    if(start && value < start)return false;
    if(end && value > end)return false;
    return true;
  }

  function includesText(value:string|undefined, search:string){
    if(!search.trim())return true;
    return (value||"").toLowerCase().includes(search.trim().toLowerCase());
  }

  const producerOptions = useMemo(()=>{
    const set = new Set(productions.map(x=>x.producer).filter(Boolean));
    return Array.from(set);
  },[productions]);

  const productionRequests = useMemo(()=>requests.filter(x=>{
    const text = `${x.clientName} ${x.contentType} ${x.objective} ${x.creativeIdea} ${x.productionNotes}`.toLowerCase();
    return x.requiresProduction &&
      !x.productionId &&
      (reqClientFilter==="all" || x.clientId===reqClientFilter) &&
      (reqAreaFilter==="all" || x.suggestedArea===reqAreaFilter || x.assignedArea===reqAreaFilter) &&
      (reqTypeFilter==="all" || x.contentType===reqTypeFilter) &&
      inDateRange(x.publishDate,reqStartDate,reqEndDate) &&
      (!reqSearch.trim() || text.includes(reqSearch.trim().toLowerCase()));
  }),[requests,reqClientFilter,reqAreaFilter,reqTypeFilter,reqStartDate,reqEndDate,reqSearch]);

  const filteredProductions = useMemo(()=>productions.filter(x=>{
    const text = `${x.title} ${x.clientName} ${x.location} ${x.producer} ${x.team} ${x.notes}`.toLowerCase();
    const hasGeneralMaterial = Boolean((x.materialLinks||"").trim()) || Boolean((x.materialFiles||[]).length);
    const hasAnyPostMaterial = Boolean(Object.values(x.materialLinksByRequest||{}).some(v=>String(v||"").trim()));
    const hasMaterial = hasGeneralMaterial || hasAnyPostMaterial;
    return (prodClientFilter==="all" || x.clientId===prodClientFilter) &&
      (prodStatusFilter==="all" || x.status===prodStatusFilter) &&
      (prodProducerFilter==="all" || x.producer===prodProducerFilter) &&
      (prodMaterialFilter==="all" || (prodMaterialFilter==="with" ? hasMaterial : !hasMaterial)) &&
      inDateRange(x.scheduledDate,prodStartDate,prodEndDate) &&
      (!prodSearch.trim() || text.includes(prodSearch.trim().toLowerCase()));
  }),[productions,prodClientFilter,prodStatusFilter,prodProducerFilter,prodMaterialFilter,prodStartDate,prodEndDate,prodSearch]);

  const selectedRequests = productionRequests.filter(x=>selected.includes(x.id!));

  function toggle(id:string){setSelected(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id])}

  function openModal(){
    if(!selected.length)return alert("Selecciona solicitudes para producción");
    const first = selectedRequests[0];
    setForm({...empty,clientId:first.clientId,clientName:first.clientName,title:`Producción ${first.clientName} · ${new Date().toLocaleDateString("es-MX")}`,requestIds:selected,objective:selectedRequests.map(x=>x.creativeIdea).join("\n")});
    setShowModal(true);
  }

  function set(k:keyof Production,v:any){setForm({...form,[k]:v})}

  async function submit(){
    if(!form.title||!form.scheduledDate)return alert("Agrega título y fecha");
    const ref = await saveProduction(form);
    await Promise.all(form.requestIds.map(id=>updateRequest(id,{productionId:ref.id,productionName:form.title,status:"produccion_programada"})));
    setSelected([]);
    setShowModal(false);
    setForm(empty);
    await load();
    alert("Producción creada");
  }

  function setEditingField(k:keyof Production,v:any){
    if(editing)setEditing({...editing,[k]:v});
  }

  function setPostMaterialLink(requestId:string, value:string){
    if(!editing)return;
    setEditing({
      ...editing,
      materialLinksByRequest:{
        ...(editing.materialLinksByRequest||{}),
        [requestId]: value
      }
    });
  }

  async function uploadProductionMaterial(files:FileList|null){
    if(!editing||!files)return;
    setUploading(true);
    try{
      const uploaded=await uploadReferenceFiles(files,"production-material");
      setEditing({...editing,materialFiles:[...(editing.materialFiles||[]),...uploaded]});
    }finally{
      setUploading(false);
    }
  }

  function removeProductionFile(index:number){
    if(!editing)return;
    setEditing({...editing,materialFiles:(editing.materialFiles||[]).filter((_,i)=>i!==index)});
  }

  async function saveProductionMaterial(markDelivered=false){
    if(!editing?.id)return;
    const nextStatus = markDelivered ? "material_entregado" : editing.status;
    await updateProduction(editing.id,{...editing,status:nextStatus});
    if(markDelivered){
      const missingLinks = (editing.requestIds||[]).filter(id => !((editing.materialLinksByRequest||{})[id] || editing.materialLinks || "").trim());
      if(missingLinks.length){
        alert("Falta link de material en una o más solicitudes. Agrega link por post o un link general de respaldo.");
        return;
      }

      await Promise.all((editing.requestIds||[]).map(id=>{
        const individualLink = (editing.materialLinksByRequest||{})[id] || "";
        const finalLink = individualLink.trim() || editing.materialLinks || "";
        return updateRequest(id,{
          materialAvailable:true,
          materialLinks:finalLink,
          materialFiles:[],
          status:"material_listo"
        });
      }));
    }
    setEditing(null);
    await load();
    alert(markDelivered?"Material entregado y solicitudes desbloqueadas":"Producción actualizada");
  }

  return <AppShell active="Producciones">
    <section className="hero"><div><p className="eyebrow">Producciones</p><h1>Producciones</h1><p>Selecciona solicitudes pendientes y crea una producción con esas fichas.</p></div><button className="btn" onClick={openModal}>Producción nueva</button></section>

    <section className="grid kpis">
      {[["Pendientes",String(productionRequests.length)],["Seleccionadas",String(selected.length)],["Producciones",String(filteredProductions.length)],["Programadas",String(filteredProductions.filter(x=>x.status==="programada").length)],["Material",String(filteredProductions.filter(x=>x.status==="material_entregado").length)],["Clientes",String(brands.length)]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <section className="filter-panel">
      <h3>Filtros de solicitudes pendientes de producción</h3>
      <div className="filter-grid">
        <div className="field"><label>Cliente</label><select value={reqClientFilter} onChange={e=>setReqClientFilter(e.target.value)}><option value="all">Todos</option>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div className="field"><label>Área</label><select value={reqAreaFilter} onChange={e=>setReqAreaFilter(e.target.value)}><option value="all">Todas</option><option>Diseño</option><option>Audiovisual</option><option>Copy</option><option>Mixto</option></select></div>
        <div className="field"><label>Tipo</label><select value={reqTypeFilter} onChange={e=>setReqTypeFilter(e.target.value)}><option value="all">Todos</option>{Array.from(new Set(requests.map(x=>x.contentType).filter(Boolean))).map(x=><option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>Desde publicación</label><input type="date" value={reqStartDate} onChange={e=>setReqStartDate(e.target.value)}/></div>
        <div className="field"><label>Hasta publicación</label><input type="date" value={reqEndDate} onChange={e=>setReqEndDate(e.target.value)}/></div>
        <div className="field" style={{gridColumn:"span 2"}}><label>Buscar</label><input value={reqSearch} onChange={e=>setReqSearch(e.target.value)} placeholder="Cliente, idea, objetivo, notas..."/></div>
        <div className="filter-actions">
          <button className="btn" onClick={()=>{setReqClientFilter("all");setReqAreaFilter("all");setReqTypeFilter("all");setReqStartDate("");setReqEndDate("");setReqSearch("");}}>Limpiar</button>
        </div>
      </div>
    </section>

    <section className="grid two-col">
      <div className="card">
        <h3>Solicitudes pendientes de producción</h3>
        <div className="table-wrap"><table className="table"><thead><tr><th></th><th>Solicitud</th><th>Notas producción</th><th>Fecha publicación</th></tr></thead><tbody>{productionRequests.map(x=><tr key={x.id}><td><input type="checkbox" checked={selected.includes(x.id!)} onChange={()=>toggle(x.id!)}/></td><td><strong>{x.clientName}</strong><br/>{x.contentType} · {x.objective}<br/><span className="mini">{x.creativeIdea}</span></td><td>{x.productionNotes||"Sin notas"}</td><td>{x.publishDate}</td></tr>)}</tbody></table></div>{!productionRequests.length && <p className="mini">No hay solicitudes pendientes con esos filtros.</p>}
      </div>
      <aside className="card">
        <h3>Seleccionadas</h3>
        {selectedRequests.map(x=><div className="draft-item" key={x.id}><strong>{x.contentType}</strong><span className="mini">{x.creativeIdea}</span></div>)}
        {!selectedRequests.length && <p className="mini">Selecciona solicitudes para crear una producción.</p>}
      </aside>
    </section>

    <section className="filter-panel">
      <h3>Filtros del calendario de producciones</h3>
      <div className="filter-grid">
        <div className="field"><label>Cliente</label><select value={prodClientFilter} onChange={e=>setProdClientFilter(e.target.value)}><option value="all">Todos</option>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div className="field"><label>Estado</label><select value={prodStatusFilter} onChange={e=>setProdStatusFilter(e.target.value)}><option value="all">Todos</option><option value="programada">Programada</option><option value="material_entregado">Material entregado</option><option value="cancelada">Cancelada</option></select></div>
        <div className="field"><label>Responsable</label><select value={prodProducerFilter} onChange={e=>setProdProducerFilter(e.target.value)}><option value="all">Todos</option>{producerOptions.map(x=><option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>Material</label><select value={prodMaterialFilter} onChange={e=>setProdMaterialFilter(e.target.value)}><option value="all">Todo</option><option value="with">Con material</option><option value="without">Sin material</option></select></div>
        <div className="field"><label>Desde producción</label><input type="date" value={prodStartDate} onChange={e=>setProdStartDate(e.target.value)}/></div>
        <div className="field"><label>Hasta producción</label><input type="date" value={prodEndDate} onChange={e=>setProdEndDate(e.target.value)}/></div>
        <div className="field" style={{gridColumn:"span 2"}}><label>Buscar</label><input value={prodSearch} onChange={e=>setProdSearch(e.target.value)} placeholder="Producción, cliente, locación, responsable..."/></div>
        <div className="filter-actions">
          <button className="btn" onClick={()=>{setProdClientFilter("all");setProdStatusFilter("all");setProdProducerFilter("all");setProdMaterialFilter("all");setProdStartDate("");setProdEndDate("");setProdSearch("");}}>Limpiar</button>
        </div>
      </div>
    </section>

    <section className="card" style={{marginTop:24}}>
      <h3>Calendario de producciones</h3>
      <table className="table"><thead><tr><th>Producción</th><th>Cliente</th><th>Fecha</th><th>Responsable</th><th>Material</th><th>Solicitudes</th><th>Estado</th><th>Brief</th></tr></thead><tbody>{filteredProductions.map(p=>{
        const hasMaterial = Boolean((p.materialLinks||"").trim()) || Boolean((p.materialFiles||[]).length) || Boolean(Object.values(p.materialLinksByRequest||{}).some(v=>String(v||"").trim()));
        return <tr key={p.id}><td><strong>{p.title}</strong><br/><span className="mini">{p.location||"Sin locación"}</span></td><td>{p.clientName}</td><td>{p.scheduledDate}</td><td>{p.producer||"Sin responsable"}</td><td>{hasMaterial?<span className="pill green">Con material</span>:<span className="pill orange">Sin material</span>}</td><td>{p.requestIds.length}</td><td>{p.status}</td><td><button className="btn" onClick={()=>setEditing(p)}>Completar links</button> <button className="btn" onClick={()=>setBrief(p)}>Exportar brief</button></td></tr>
      })}</tbody></table>
      {!filteredProductions.length && <p className="mini">No hay producciones con esos filtros.</p>}
    </section>

    {brief && <div className="modal-backdrop"><div className="modal-card" style={{width:"min(1200px,96vw)"}}>
      <div className="brief-actions">
        <button className="btn blue" onClick={()=>window.print()}>Imprimir / Guardar PDF tamaño hoja</button>
        <button className="btn red" onClick={()=>setBrief(null)}>Cerrar</button>
      </div>
      <ProductionBrief production={brief} requests={requests}/>
    </div></div>}

    {editing && <div className="modal-backdrop"><div className="modal-card">
      <h2>Completar material de producción</h2>
      <p className="mini">{editing.title} · {editing.clientName}</p>
      <div className="production-material-box">
        <div className="field">
          <label>Link general del material producido</label>
          <textarea value={editing.materialLinks||""} onChange={e=>setEditingField("materialLinks",e.target.value)} placeholder="Carpeta general de Drive, Dropbox, Frame, WeTransfer, etc."/>
          <div className="material-mode-note">Este link sirve como respaldo general. Lo ideal es llenar también el link específico de cada post.</div>
        </div>
      </div>

      <h3>Links por solicitud / post</h3>
      <div className="per-post-material-list">
        {(editing.requestIds||[]).map(id=>{
          const req=requests.find(x=>x.id===id);
          return <div className="per-post-material-card" key={id}>
            <strong>{req?.contentType||"Solicitud"} · {req?.objective||""}</strong>
            <span className="mini">{req?.creativeIdea||id}</span>
            <span className="mini">Publica: {req?.publishDate||"Sin fecha"}</span>
            <input value={(editing.materialLinksByRequest||{})[id]||""} onChange={e=>setPostMaterialLink(id,e.target.value)} placeholder="Link exacto del material para esta pieza"/>
          </div>
        })}
      </div>

      <div className="production-material-box">
        <div className="field">
          <label>Archivos generales opcionales</label>
          <input type="file" multiple onChange={e=>uploadProductionMaterial(e.target.files)}/>
          <span className="mini">{uploading?"Subiendo...":""}</span>
        </div>
        <FileList files={editing.materialFiles||[]} onPreview={setPreview} onRemove={removeProductionFile}/>
      </div>
      <div style={{display:"flex",gap:12,marginTop:16,flexWrap:"wrap"}}>
        <button className="btn" onClick={()=>saveProductionMaterial(false)}>Guardar material</button>
        <button className="btn blue" onClick={()=>saveProductionMaterial(true)}>Marcar material entregado</button>
        <button className="btn red" onClick={()=>setEditing(null)}>Cerrar</button>
      </div>
    </div></div>}

    {preview && <PreviewModal file={preview} onClose={()=>setPreview(null)}/>}

    {showModal && <div className="modal-backdrop"><div className="modal-card">
      <h2>Producción nueva</h2>
      <div className="form-grid">
        <div className="field full"><label>Título</label><input value={form.title} onChange={e=>set("title",e.target.value)}/></div>
        <div className="field"><label>Cliente</label><input value={form.clientName} disabled/></div>
        <div className="field"><label>Fecha producción</label><input type="date" value={form.scheduledDate} onChange={e=>set("scheduledDate",e.target.value)}/></div>
        <div className="field"><label>Hora inicio</label><input value={form.startTime} onChange={e=>set("startTime",e.target.value)}/></div>
        <div className="field"><label>Hora fin</label><input value={form.endTime} onChange={e=>set("endTime",e.target.value)}/></div>
        <div className="field full"><label>Locación</label><input value={form.location} onChange={e=>set("location",e.target.value)}/></div>
        <div className="field"><label>Responsable</label><input value={form.producer} onChange={e=>set("producer",e.target.value)}/></div>
        <div className="field"><label>Equipo</label><input value={form.team} onChange={e=>set("team",e.target.value)}/></div>
        <div className="field full"><label>Shotlist general</label><textarea value={form.shotList} onChange={e=>set("shotList",e.target.value)}/></div>
        <div className="field full"><label>Requerimientos</label><textarea value={form.requirements} onChange={e=>set("requirements",e.target.value)}/></div>
        <div className="field full"><label>Notas</label><textarea value={form.notes} onChange={e=>set("notes",e.target.value)}/></div>
      </div>
      <h3>Solicitudes incluidas</h3>
      {selectedRequests.map(x=><div className="draft-item" key={x.id}><strong>{x.contentType} · {x.objective}</strong><span className="mini">{x.creativeIdea}</span><span className="mini">{x.productionNotes}</span></div>)}
      <div style={{display:"flex",gap:12,marginTop:16}}><button className="btn blue" onClick={submit}>Crear producción</button><button className="btn red" onClick={()=>setShowModal(false)}>Cerrar</button></div>
    </div></div>}
  </AppShell>
}



function splitLinks(value:string){
  return (value||"")
    .split(/\s|,|\n/)
    .map(x=>x.trim())
    .filter(x=>x.startsWith("http://")||x.startsWith("https://"));
}

function ProductionBrief({production,requests}:{production:Production;requests:ContentRequest[]}){
  const included = (production.requestIds||[])
    .map(id=>requests.find(x=>x.id===id))
    .filter(Boolean) as ContentRequest[];

  const generalLinks = splitLinks(production.materialLinks||"");

  return <section className="production-brief">
    <div className="brief-cover">
      <p className="eyebrow">Brief visual de producción</p>
      <h1>{production.title}</h1>
      <p>{production.clientName}</p>
    </div>

    <div className="brief-meta-grid">
      <div className="brief-meta"><span>Fecha</span><strong>{production.scheduledDate||"Sin fecha"}</strong></div>
      <div className="brief-meta"><span>Horario</span><strong>{production.startTime||"--"} - {production.endTime||"--"}</strong></div>
      <div className="brief-meta"><span>Locación</span><strong>{production.location||"Sin locación"}</strong></div>
      <div className="brief-meta"><span>Responsable</span><strong>{production.producer||"Sin responsable"}</strong></div>
    </div>

    <div className="brief-columns">
      <div className="brief-box">
        <h4>Objetivo general</h4>
        {production.objective||"Sin objetivo general"}
      </div>
      <div className="brief-box">
        <h4>Equipo / Requerimientos</h4>
        <strong>Equipo:</strong> {production.team||"Sin equipo"}{"\n"}
        <strong>Requerimientos:</strong> {production.requirements||"Sin requerimientos"}
      </div>
    </div>

    <div className="brief-box">
      <h4>Shotlist general</h4>
      {production.shotList||"Sin shotlist general"}
    </div>

    <div className="brief-box">
      <h4>Notas generales</h4>
      {production.notes||"Sin notas"}
      {generalLinks.length>0 && <div style={{marginTop:10}}>
        <strong>Link general de material:</strong>
        {generalLinks.map((link,index)=><a className="brief-link" href={link} target="_blank" key={index}>{link}</a>)}
      </div>}
    </div>

    <div>
      <h2 style={{margin:"4px 0 14px"}}>Solicitudes / tomas por pieza</h2>
      <div style={{display:"grid",gap:16}}>
        {included.map((item,index)=>{
          const referenceLinks = splitLinks(item.referenceLinks);
          const materialLink = (production.materialLinksByRequest||{})[item.id||""] || item.materialLinks || production.materialLinks || "";
          const materialLinks = splitLinks(materialLink);
          const refs = item.referenceFiles || [];
          return <article className="brief-request-card" key={item.id||index}>
            <div className="brief-request-head">
              <div>
                <p className="eyebrow">Pieza {index+1}</p>
                <h3 className="brief-request-title">{item.contentType} · {item.objective}</h3>
                <p className="mini">Publica: {item.publishDate||"Sin fecha"} · Área: {item.suggestedArea||"Sin área"}</p>
              </div>
              <span className="pill">{item.status}</span>
            </div>

            <div className="brief-columns">
              <div className="brief-box">
                <h4>Idea creativa</h4>
                {item.creativeIdea||"Sin idea creativa"}
              </div>
              <div className="brief-box">
                <h4>Notas para producción</h4>
                {item.productionNotes||"Sin notas específicas"}
              </div>
            </div>

            <div className="brief-columns">
              <div className="brief-box">
                <h4>Copy In / Mensaje</h4>
                <strong>Copy:</strong> {item.copyIn||"Sin copy"}{"\n"}
                <strong>Mensaje:</strong> {item.keyMessage||"Sin mensaje"}{"\n"}
                <strong>CTA:</strong> {item.cta||"Sin CTA"}
              </div>
              <div className="brief-box">
                <h4>Checklist de producción</h4>
                <div className="brief-shotlist">
                  <div className="brief-check">Capturar toma principal de la idea</div>
                  <div className="brief-check">Capturar recurso vertical para redes</div>
                  <div className="brief-check">Capturar detalle / close-up</div>
                  <div className="brief-check">Capturar toma de contexto / ambiente</div>
                  <div className="brief-check">Validar referencia antes de cerrar pieza</div>
                </div>
              </div>
            </div>

            {(refs.length>0 || referenceLinks.length>0) && <div>
              <h4 style={{margin:"0 0 10px",textTransform:"uppercase",color:"var(--muted)",fontSize:12}}>Referencias visuales</h4>
              {refs.length>0 && <div className="brief-ref-grid">
                {refs.map((file,i)=><div className="brief-ref" key={i}>
                  {isImageFile(file)?<img src={file.url} alt="Referencia"/>:<span className="mini">Archivo de referencia</span>}
                </div>)}
              </div>}
              {referenceLinks.map((link,i)=><a className="brief-link" href={link} target="_blank" key={i}>{link}</a>)}
            </div>}

            {materialLinks.length>0 && <div>
              <h4 style={{margin:"0 0 10px",textTransform:"uppercase",color:"var(--muted)",fontSize:12}}>Material final / edición</h4>
              {materialLinks.map((link,i)=><a className="brief-link" href={link} target="_blank" key={i}>{link}</a>)}
            </div>}
          </article>
        })}
        {!included.length && <p className="mini">Esta producción no tiene solicitudes ligadas.</p>}
      </div>
    </div>
  </section>;
}


function FileList({files,onPreview,onRemove}:{files:ReferenceFile[];onPreview:(file:ReferenceFile)=>void;onRemove:(index:number)=>void;}){
  return <div className="ref-grid">
    {(files||[]).map((file,index)=><button type="button" className="ref-thumb" onClick={()=>onPreview(file)} key={index}>
      {isImageFile(file)?<img src={file.url} alt="Material"/>:<div className="ref-thumb-file">Archivo</div>}
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
