"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Brand,
  ContentRequest,
  ReferenceFile,
  TaskComment,
  areas,
  getOperationalStatus,
  hasMaterial,
  isImageFile,
  listUniqueBrands,
  listRequests,
  priorities,
  updateRequest,
  deleteRequest
} from "@/lib/data";

const team = ["Ana Diseño","Luis Diseño","Carlos Editor","Mariana Editora","Pedro Video","Mafer KAM","Rodrigo"];

export default function AssignmentPage(){
  const [items,setItems]=useState<ContentRequest[]>([]);
  const [brands,setBrands]=useState<Brand[]>([]);
  const [client,setClient]=useState("all");
  const [area,setArea]=useState("all");
  const [status,setStatus]=useState("all");
  const [batchFilter,setBatchFilter]=useState("all");
  const [selected,setSelected]=useState<string[]>([]);
  const [editing,setEditing]=useState<ContentRequest|null>(null);
  const [preview,setPreview]=useState<ReferenceFile|null>(null);
  const [detailDraft,setDetailDraft]=useState<Partial<ContentRequest>>({});
  const [rejectModal,setRejectModal]=useState(false);
  const [rejectNote,setRejectNote]=useState("");
  const [deleteModal,setDeleteModal]=useState(false);
  const [deleteConfirm,setDeleteConfirm]=useState("");

  async function load(){setItems(await listRequests());setBrands(await listUniqueBrands())}
  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>items.filter(item=>{
    const op=getOperationalStatus(item);
    return (client==="all"||item.clientId===client) && (area==="all"||item.suggestedArea===area||item.assignedArea===area) && (status==="all"||op===status) && (batchFilter==="all" || (item.batchId||"sin-lote")===batchFilter);
  }),[items,client,area,status,batchFilter]);

  const batchOptions = useMemo(()=>{
    const map = new Map<string,string>();
    items
      .filter(item=>client==="all" || item.clientId===client)
      .forEach(item=>map.set(item.batchId||"sin-lote", item.batchName||"Sin lote"));
    return Array.from(map.entries()).map(([id,name])=>({id,name}));
  },[items,client]);

  function toggle(id:string){setSelected(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id])}

  function buildChangeLog(item:ContentRequest, data:Partial<ContentRequest>){
    const changes:string[] = [];
    if(data.assignedArea !== undefined && data.assignedArea !== (item.assignedArea || "")) changes.push(`Área: ${item.assignedArea || item.suggestedArea || "Sin área"} → ${data.assignedArea || "Sin área"}`);
    if(data.assignedTo !== undefined && data.assignedTo !== (item.assignedTo || "")) changes.push(`Responsable: ${item.assignedTo || "Sin asignar"} → ${data.assignedTo || "Sin asignar"}`);
    if(data.priority !== undefined && data.priority !== (item.priority || "Media")) changes.push(`Prioridad: ${item.priority || "Media"} → ${data.priority || "Media"}`);
    if(data.status !== undefined && data.status !== item.status) changes.push(`Estado: ${item.status || "Sin estado"} → ${data.status}`);
    if(data.internalNotes !== undefined && data.internalNotes !== (item.internalNotes || "")) changes.push("Notas internas actualizadas");
    if(data.dueDate !== undefined && data.dueDate !== (item.dueDate || "")) changes.push(`Fecha límite: ${item.dueDate || item.batchDueDate || "Sin fecha"} → ${data.dueDate || "Sin fecha"}`);
    if(!changes.length)return null;
    return {
      id:`${Date.now()}`,
      author:"Sistema",
      target:"Asignación",
      body:`Movimiento de asignación. ${changes.join(". ")}.`,
      mentions:[],
      createdAt:new Date().toISOString()
    } as TaskComment;
  }

  async function update(id:string,data:Partial<ContentRequest>){
    const current = items.find(x=>x.id===id);
    const log = current ? buildChangeLog(current,data) : null;
    await updateRequest(id, log ? {...data, comments:[...(current?.comments||[]), log]} : data);
    await load();
  }

  async function assign(item:ContentRequest){
    if(!item.id)return;
    if(item.status === "pendiente_copy" || item.copyStatus === "pendiente" || item.copyStatus === "en_proceso"){
      alert("Esta solicitud sigue pendiente de copy. Márcala como lista desde Contenidos antes de asignarla.");
      return;
    }
    if(item.requiresProduction && !item.productionId){
      alert("Esta solicitud requiere producción. No puede asignarse hasta estar ligada a una producción y tener material entregado.");
      return;
    }
    if(!item.requiresProduction && !hasMaterial(item)){
      alert("Esta solicitud no requiere producción, pero no tiene material. Debe corregirse desde el Creador de Solicitudes.");
      return;
    }
    await update(item.id,{
      assignedArea:item.assignedArea||item.suggestedArea,
      assignedTo:item.assignedTo||team[0],
      priority:item.priority||"Media",
      dueDate:item.dueDate||item.batchDueDate||item.publishDate,
      status:"asignada"
    });
  }

  async function assignFromDetail(item:ContentRequest){
    if(!item.id)return;
    if(item.status === "pendiente_copy" || item.copyStatus === "pendiente" || item.copyStatus === "en_proceso"){
      alert("Esta solicitud sigue pendiente de copy. Márcala como lista desde Contenidos antes de asignarla.");
      return;
    }
    if(item.requiresProduction && !item.productionId){
      alert("Esta solicitud requiere producción. Primero completa material desde Producciones.");
      return;
    }
    if(!item.requiresProduction && !hasMaterial(item)){
      alert("Esta solicitud no tiene material. Debe corregirse desde el Creador de Solicitudes.");
      return;
    }
    const data = {
      assignedArea:detailDraft.assignedArea || item.suggestedArea,
      assignedTo:detailDraft.assignedTo || "",
      priority:detailDraft.priority || "Media",
      internalNotes:detailDraft.internalNotes || "",
      dueDate:item.dueDate||item.batchDueDate||item.publishDate,
      status:"asignada"
    };
    const log = buildChangeLog(item,data);
    await updateRequest(item.id, log ? {...data, comments:[...(item.comments||[]), log]} : data);
    setEditing(null);
    setDetailDraft({});
    await load();
    alert("Solicitud asignada");
  }

  async function rejectRequests(ids:string[], note:string){
    if(!ids.length)return alert("Selecciona al menos una solicitud.");
    if(!note.trim())return alert("Escribe una nota para rebotar la solicitud.");
    await Promise.all(ids.map(id=>{
      const current = items.find(x=>x.id===id);
      const log:TaskComment = {id:`${Date.now()}-${id}`,author:"Sistema",target:"Asignación",body:`Solicitud rebotada desde Asignación. Motivo: ${note.trim()}`,mentions:[],createdAt:new Date().toISOString()};
      return updateRequest(id,{
        status:"rebotada",
        rejectionNote:note.trim(),
        assignedTo:"",
        assignedArea:"",
        internalNotes: note.trim(),
        comments:[...(current?.comments||[]), log]
      });
    }));
    setSelected([]);
    setRejectNote("");
    setRejectModal(false);
    setEditing(null);
    await load();
    alert("Solicitud(es) rebotadas");
  }

  async function deleteSelectedRequests(){
    if(!selected.length)return alert("Selecciona al menos una solicitud.");
    if(deleteConfirm !== "ELIMINAR")return alert("Debes escribir ELIMINAR para confirmar.");
    await Promise.all(selected.map(id=>deleteRequest(id)));
    setSelected([]);
    setDeleteConfirm("");
    setDeleteModal(false);
    await load();
    alert("Solicitud(es) eliminadas");
  }

  async function rejectFromDetail(item:ContentRequest, note:string){
    if(!item.id)return;
    await rejectRequests([item.id], note);
  }

  return <AppShell active="Asignación">
    <section className="hero">
      <div><p className="eyebrow">Operación</p><h1>Asignación</h1><p>Los jefes de área asignan solicitudes listas. Las piezas sin material quedan bloqueadas desde origen.</p></div>
    </section>

    <section className="grid kpis">
      {[["Total",String(items.length)],["Filtradas",String(filtered.length)],["Seleccionadas",String(selected.length)],["Pend. producción",String(items.filter(x=>getOperationalStatus(x)==="pendiente_produccion").length)],["Bloqueadas",String(items.filter(x=>getOperationalStatus(x)==="bloqueada").length)],["Asignadas",String(items.filter(x=>x.status==="asignada").length)]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <div className="toolbar">
      <select value={client} onChange={e=>{setClient(e.target.value);setBatchFilter("all");}}><option value="all">Todos los clientes</option>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select value={area} onChange={e=>setArea(e.target.value)}><option value="all">Todas las áreas</option>{areas.map(x=><option key={x}>{x}</option>)}</select>
      <select value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="all">Todos los estados</option>
        <option value="lista_asignacion">Lista para asignación / Material listo</option>
        <option value="pendiente_copy">Pendiente copy</option>
        <option value="pendiente_produccion">Pendiente producción</option>
        <option value="bloqueada">Bloqueada</option>
        <option value="rebotada">Rebotada</option>
        <option value="asignada">Asignada</option>
      </select>
      <select value={batchFilter} onChange={e=>setBatchFilter(e.target.value)}>
        <option value="all">Todos los lotes</option>
        {batchOptions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <button className="btn" onClick={load}>Actualizar</button>
      {selected.length>0 && <a className="btn blue" href="/dashboard/producciones">Crear producción con seleccionadas →</a>}
    </div>

    {selected.length>0 && <div className="bulk-actions">
      <span className="pill">{selected.length} seleccionada(s)</span>
      <button className="btn" onClick={()=>setRejectModal(true)}>Rebotar seleccionadas</button>
      <button className="btn red" onClick={()=>setDeleteModal(true)}>Eliminar seleccionadas</button>
    </div>}

    <section className="grid two-col">
      <div className="card">
        <h3>Solicitudes para asignar</h3>
        <div className="table-wrap"><table className="table assignment-table">
          <thead><tr><th></th><th>Solicitud</th><th>Lote</th><th>Estado</th><th>Asignación</th><th></th></tr></thead>
          <tbody>{filtered.map(item=>{
            const op=getOperationalStatus(item);
            return <tr key={item.id}>
              <td><input type="checkbox" checked={selected.includes(item.id!)} onChange={()=>toggle(item.id!)}/></td>
              <td><strong>{item.clientName}</strong><br/><span>{item.contentType} · {item.objective}</span><br/><span className="mini">{item.creativeIdea}</span><br/><span className="mini">Publica: {item.publishDate||"Sin fecha"}</span>{item.rejectionNote && <div className="reject-note">Rebotada: {item.rejectionNote}</div>}</td>
              <td><strong>{item.batchName||"Sin lote"}</strong><br/><span className="mini">Límite: {item.batchDueDate||item.dueDate||"Sin fecha"}</span></td>
              <td><StatusPill status={op}/><br/><span className="mini">Área: {item.suggestedArea}</span></td>
              <td>
                <select value={item.assignedArea||item.suggestedArea||"Diseño"} onChange={e=>item.id&&update(item.id,{assignedArea:e.target.value})}>{areas.map(x=><option key={x}>{x}</option>)}</select>
                <br/><br/>
                <select value={item.assignedTo||""} onChange={e=>item.id&&update(item.id,{assignedTo:e.target.value})}><option value="">Sin asignar</option>{team.map(x=><option key={x}>{x}</option>)}</select>
                <br/><br/>
                <select value={item.priority||"Media"} onChange={e=>item.id&&update(item.id,{priority:e.target.value})}>{priorities.map(x=><option key={x}>{x}</option>)}</select>
              </td>
              <td><button className="btn blue" onClick={()=>assign(item)}>Asignar</button><br/><br/><button className="btn" onClick={()=>{setEditing(item);setDetailDraft({assignedArea:item.assignedArea||item.suggestedArea,assignedTo:item.assignedTo||"",priority:item.priority||"Media",internalNotes:item.internalNotes||""})}}>Detalle</button></td>
            </tr>
          })}</tbody>
        </table></div>
      </div>

      <aside className="card">
        <h3>{editing?"Detalle":"Reglas"}</h3>
        {editing ? <RequestDetail item={editing} draft={detailDraft} setDraft={setDetailDraft} onAssign={assignFromDetail} onReject={rejectFromDetail} onClose={()=>setEditing(null)} onPreview={setPreview}/> : <div className="draft-list">
          <div className="draft-item"><strong>No requiere producción</strong><span className="mini">Debe traer material/link desde el Creador. Si no, queda bloqueada.</span></div>
          <div className="draft-item"><strong>Requiere producción</strong><span className="mini">Se agrupa en Producciones y no se asigna a ejecución hasta tener material.</span></div>
          <div className="draft-item"><strong>Asignada</strong><span className="mini">Aparece en Calendario por persona, área y fecha.</span></div>
        </div>}
      </aside>
    </section>
    {rejectModal && <div className="modal-backdrop"><div className="modal-card">
      <h2>Rebotar solicitudes</h2>
      <p className="mini">Escribe la razón para que Content pueda corregirlas.</p>
      <div className="field"><label>Nota de rechazo</label><textarea value={rejectNote} onChange={e=>setRejectNote(e.target.value)} placeholder="Ej. Falta material correcto / brief incompleto / no aplica al objetivo."/></div>
      <div style={{display:"flex",gap:12}}>
        <button className="btn blue" onClick={()=>rejectRequests(selected,rejectNote)}>Rebotar</button>
        <button className="btn red" onClick={()=>setRejectModal(false)}>Cancelar</button>
      </div>
    </div></div>}

    {deleteModal && <div className="modal-backdrop"><div className="modal-card">
      <h2>Eliminar solicitudes</h2>
      <p>Esta acción eliminará {selected.length} solicitud(es). Para confirmar escribe <strong>ELIMINAR</strong>.</p>
      <div className="field"><label>Confirmación</label><input value={deleteConfirm} onChange={e=>setDeleteConfirm(e.target.value)} placeholder="ELIMINAR"/></div>
      <div style={{display:"flex",gap:12}}>
        <button className="btn red" onClick={deleteSelectedRequests}>Eliminar definitivamente</button>
        <button className="btn" onClick={()=>setDeleteModal(false)}>Cancelar</button>
      </div>
    </div></div>}

    {preview && <PreviewModal file={preview} onClose={()=>setPreview(null)}/>}
  </AppShell>
}


function splitLinks(value:string){
  return (value||"")
    .split(/\s|,|\n/)
    .map(x=>x.trim())
    .filter(x=>x.startsWith("http://")||x.startsWith("https://"));
}

function RequestDetail({
  item,
  draft,
  setDraft,
  onAssign,
  onReject,
  onClose,
  onPreview
}:{
  item:ContentRequest;
  draft:Partial<ContentRequest>;
  setDraft:(data:Partial<ContentRequest>)=>void;
  onAssign:(item:ContentRequest)=>void;
  onReject:(item:ContentRequest,note:string)=>void;
  onClose:()=>void;
  onPreview:(file:ReferenceFile)=>void;
}){
  const referenceLinks = splitLinks(item.referenceLinks);
  const materialLinks = splitLinks(item.materialLinks);
  const [localRejectNote,setLocalRejectNote]=useState("");
  const op = getOperationalStatus(item);

  return <div className="assignment-detail-scroll">
    <div className="detail-hero">
      <div>
        <p className="eyebrow">Ficha de solicitud</p>
        <h2 className="detail-title">{item.clientName}</h2>
        <p className="mini">{item.batchName || "Sin lote"}</p>
      </div>

      <div className="detail-meta">
        <StatusPill status={op}/>
        <span className="pill">{item.contentType}</span>
        <span className="pill blue">{item.suggestedArea || item.assignedArea || "Sin área"}</span>
        <span className={item.requiresProduction ? "pill orange" : "pill green"}>
          {item.requiresProduction ? "Requiere producción" : "No requiere producción"}
        </span>
        <span className={hasMaterial(item) ? "pill green" : "pill red"}>
          {hasMaterial(item) ? "Material disponible" : "Sin material"}
        </span>
      </div>

      {item.rejectionNote && <div className="reject-note">Rebotada: {item.rejectionNote}</div>}
      <div className="form-grid">
        <div className="field">
          <label>Fecha límite lote</label>
          <input value={item.batchDueDate || item.dueDate || "Sin fecha"} disabled/>
        </div>
        <div className="field">
          <label>Fecha publicación</label>
          <input value={item.publishDate || "Sin fecha"} disabled/>
        </div>
        <div className="field">
          <label>Responsable</label>
          <input value={item.assignedTo || "Sin asignar"} disabled/>
        </div>
        <div className="field">
          <label>Prioridad</label>
          <input value={item.priority || "Media"} disabled/>
        </div>
      </div>
    </div>

    <div className="detail-section">
      <h4>Idea creativa</h4>
      <div className="detail-copy">{item.creativeIdea || "Sin idea creativa"}</div>
    </div>

    <div className="detail-section">
      <h4>Copy In</h4>
      <div className="detail-copy">{item.copyIn || "Sin Copy In"}</div>
    </div>

    <div className="detail-section">
      <h4>Mensaje clave / CTA</h4>
      <div className="detail-copy">
        <strong>Mensaje:</strong> {item.keyMessage || "Sin mensaje"}{"\n"}
        <strong>CTA:</strong> {item.cta || "Sin CTA"}
      </div>
    </div>

    <div className="detail-section">
      <h4>Inspiración / referencias visuales</h4>
      <FilePreviewGrid files={item.referenceFiles || []} onPreview={onPreview}/>
      <LinkList links={referenceLinks}/>
      {!referenceLinks.length && !(item.referenceFiles||[]).length && <p className="mini">Sin referencias.</p>}
    </div>

    <div className="detail-section">
      <h4>Material disponible</h4>
      <FilePreviewGrid files={item.materialFiles || []} onPreview={onPreview}/>
      <LinkList links={materialLinks}/>
      {!materialLinks.length && !(item.materialFiles||[]).length && <p className="mini">Sin material disponible.</p>}
    </div>

    {item.requiresProduction && <div className="detail-section">
      <h4>Notas para producción</h4>
      <div className="detail-copy">{item.productionNotes || "Sin notas de producción"}</div>
    </div>}

    {item.internalNotes && <div className="detail-section">
      <h4>Notas internas</h4>
      <div className="detail-copy">{item.internalNotes}</div>
    </div>}

    <div className="assignment-actions">
      <h4>Asignar desde detalle</h4>
      {item.rejectionNote && <div className="reject-note">Rebotada: {item.rejectionNote}</div>}
      <div className="form-grid">
        <div className="field">
          <label>Área</label>
          <select value={draft.assignedArea||item.assignedArea||item.suggestedArea||"Diseño"} onChange={e=>setDraft({...draft,assignedArea:e.target.value})}>
            {areas.map(x=><option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Responsable</label>
          <select value={draft.assignedTo||item.assignedTo||""} onChange={e=>setDraft({...draft,assignedTo:e.target.value})}>
            <option value="">Sin asignar</option>
            {team.map(x=><option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Prioridad</label>
          <select value={draft.priority||item.priority||"Media"} onChange={e=>setDraft({...draft,priority:e.target.value})}>
            {priorities.map(x=><option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="field full">
          <label>Notas internas</label>
          <textarea value={draft.internalNotes||item.internalNotes||""} onChange={e=>setDraft({...draft,internalNotes:e.target.value})}/>
        </div>
      </div>
      <div style={{display:"flex",gap:12,marginTop:12}}>
        <button className="btn blue" onClick={()=>onAssign(item)}>Asignar solicitud</button>
        <button className="btn" onClick={onClose}>Cerrar detalle</button>
      </div>

      <div className="danger-zone">
        <h4>Rebotar solicitud</h4>
        <p className="mini">Regrésala a Content con una nota clara para corrección.</p>
        <textarea value={localRejectNote} onChange={e=>setLocalRejectNote(e.target.value)} placeholder="Motivo del rebote"/>
        <button className="btn red" style={{marginTop:10}} onClick={()=>onReject(item,localRejectNote)}>Rebotar solicitud</button>
      </div>
    </div>
  </div>;
}

function FilePreviewGrid({files,onPreview}:{files:ReferenceFile[];onPreview:(file:ReferenceFile)=>void}){
  if(!files?.length)return null;
  return <div className="preview-grid">
    {files.map((file,index)=>
      <button type="button" className="preview-thumb" key={index} onClick={()=>onPreview(file)}>
        {isImageFile(file)
          ? <img src={file.url} alt="Referencia"/>
          : <span>Archivo</span>
        }
      </button>
    )}
  </div>;
}

function LinkList({links}:{links:string[]}){
  if(!links.length)return null;
  return <div className="link-list" style={{marginTop:10}}>
    {links.map((link,index)=>
      <a className="link-card" href={link} target="_blank" key={index}>
        <span>{link}</span>
        <small>Abrir →</small>
      </a>
    )}
  </div>;
}

function PreviewModal({file,onClose}:{file:ReferenceFile;onClose:()=>void}){
  return <div className="preview-modal" onClick={onClose}>
    <div className="preview-box" onClick={e=>e.stopPropagation()}>
      <div className="preview-actions">
        <strong>{file.name}</strong>
        <button className="btn red" onClick={onClose}>Cerrar</button>
      </div>
      {isImageFile(file)
        ? <img src={file.url} alt={file.name}/>
        : <p>Archivo no previsualizable. Ábrelo desde su link original.</p>
      }
    </div>
  </div>;
}


function StatusPill({status}:{status:string}){
  if(status==="bloqueada")return <span className="pill red">Bloqueada</span>;
  if(status==="pendiente_produccion")return <span className="pill orange">Pendiente producción</span>;
  if(status==="pendiente_copy")return <span className="pill orange">Pendiente copy</span>;
  if(status==="lista_asignacion")return <span className="pill green">Lista para asignar</span>;
  if(status==="asignada")return <span className="pill blue">Asignada</span>;
  if(status==="rebotada")return <span className="pill red">Rebotada</span>;
  return <span className="pill">{status}</span>;
}
