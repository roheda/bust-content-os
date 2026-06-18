"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Brand,
  ContentRequest,
  ReferenceFile,
  PlatformUser,
  areas,
  getOperationalStatus,
  hasMaterial,
  isImageFile,
  listUniqueBrands,
  listRequests,
  listUsers,
  organizationTeam,
  priorities,
  updateRequest,
  deleteRequest
} from "@/lib/data";

const fallbackTeam = organizationTeam.map(user=>user.name);

export default function AssignmentPage(){
  const [items,setItems]=useState<ContentRequest[]>([]);
  const [brands,setBrands]=useState<Brand[]>([]);
  const [users,setUsers]=useState<PlatformUser[]>([]);
  const [client,setClient]=useState("all");
  const [area,setArea]=useState("all");
  const [status,setStatus]=useState("all");
  const [selected,setSelected]=useState<string[]>([]);
  const [editing,setEditing]=useState<ContentRequest|null>(null);
  const [preview,setPreview]=useState<ReferenceFile|null>(null);
  const [detailDraft,setDetailDraft]=useState<Partial<ContentRequest>>({});
  const [rejectModal,setRejectModal]=useState(false);
  const [rejectNote,setRejectNote]=useState("");
  const [deleteModal,setDeleteModal]=useState(false);
  const [deleteConfirm,setDeleteConfirm]=useState("");
  const [bulkAssignee,setBulkAssignee]=useState("");
  const [sort,setSort]=useState<{key:string;direction:"asc"|"desc"}>({key:"batch",direction:"asc"});

  async function load(){
    const [loadedItems, loadedBrands, loadedUsers] = await Promise.all([listRequests(), listUniqueBrands(), listUsers()]);
    setItems(loadedItems);
    setBrands(loadedBrands);
    setUsers(loadedUsers.filter(user=>user.status!=="inactive"));
  }
  useEffect(()=>{load()},[]);

  const teamOptions = useMemo(()=>Array.from(new Set([...users.map(user=>user.name).filter(Boolean),...fallbackTeam])),[users]);

  function sortValue(item:ContentRequest,key:string){
    if(key==="batch")return item.batchName || item.batchDueDate || "";
    if(key==="client")return item.clientName || "";
    if(key==="request")return `${item.contentType} ${item.objective} ${item.creativeIdea}`;
    if(key==="dueDate")return item.batchDueDate || item.dueDate || item.publishDate || "";
    if(key==="status")return getOperationalStatus(item);
    if(key==="area")return item.suggestedArea || item.assignedArea || "";
    if(key==="assignedTo")return item.assignedTo || "";
    return "";
  }

  function toggleSort(key:string){setSort(prev=>prev.key===key?{key,direction:prev.direction==="asc"?"desc":"asc"}:{key,direction:"asc"});}

  const filtered=useMemo(()=>items.filter(item=>{
    const op=getOperationalStatus(item);
    return (client==="all"||item.clientId===client) && (area==="all"||item.suggestedArea===area||item.assignedArea===area) && (status==="all"||op===status);
  }).sort((a,b)=>String(sortValue(a,sort.key)).localeCompare(String(sortValue(b,sort.key)),"es",{numeric:true})*(sort.direction==="asc"?1:-1)),[items,client,area,status,sort]);

  function toggle(id:string){setSelected(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id])}

  async function update(id:string,data:Partial<ContentRequest>){
    await updateRequest(id,data);
    await load();
  }

  async function assign(item:ContentRequest){
    if(!item.id)return;
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
      assignedTo:item.assignedTo||teamOptions[0]||"",
      priority:item.priority||"Media",
      dueDate:item.dueDate||item.batchDueDate||item.publishDate,
      status:"asignada"
    });
  }

  async function assignFromDetail(item:ContentRequest){
    if(!item.id)return;
    if(item.requiresProduction && !item.productionId){
      alert("Esta solicitud requiere producción. Primero completa material desde Producciones.");
      return;
    }
    if(!item.requiresProduction && !hasMaterial(item)){
      alert("Esta solicitud no tiene material. Debe corregirse desde el Creador de Solicitudes.");
      return;
    }
    await updateRequest(item.id,{
      assignedArea:detailDraft.assignedArea || item.suggestedArea,
      assignedTo:detailDraft.assignedTo || "",
      priority:detailDraft.priority || "Media",
      internalNotes:detailDraft.internalNotes || "",
      dueDate:item.dueDate||item.batchDueDate||item.publishDate,
      status:"asignada"
    });
    setEditing(null);
    setDetailDraft({});
    await load();
    alert("Solicitud asignada");
  }

  async function assignSelected(){
    if(!selected.length)return alert("Selecciona al menos una solicitud.");
    if(!bulkAssignee)return alert("Selecciona una persona para asignar.");
    const selectedItems = items.filter(item=>selected.includes(item.id||""));
    const blocked = selectedItems.filter(item=>(item.requiresProduction && !item.productionId) || (!item.requiresProduction && !hasMaterial(item)));
    if(blocked.length)return alert(`${blocked.length} solicitud(es) no están listas para asignar por falta de producción o material.`);
    await Promise.all(selectedItems.map(item=>updateRequest(item.id!,{
      assignedArea:item.assignedArea||item.suggestedArea,
      assignedTo:bulkAssignee,
      priority:item.priority||"Media",
      dueDate:item.dueDate||item.batchDueDate||item.publishDate,
      status:"asignada"
    })));
    setSelected([]);
    setBulkAssignee("");
    await load();
    alert("Solicitudes asignadas");
  }

  async function rejectRequests(ids:string[], note:string){
    if(!ids.length)return alert("Selecciona al menos una solicitud.");
    if(!note.trim())return alert("Escribe una nota para rebotar la solicitud.");
    await Promise.all(ids.map(id=>updateRequest(id,{
      status:"rebotada",
      rejectionNote:note.trim(),
      assignedTo:"",
      assignedArea:"",
      internalNotes: note.trim()
    })));
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
      <select value={client} onChange={e=>setClient(e.target.value)}><option value="all">Todos los clientes</option>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select value={area} onChange={e=>setArea(e.target.value)}><option value="all">Todas las áreas</option>{areas.map(x=><option key={x}>{x}</option>)}</select>
      <select value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="all">Todos los estados</option>
        <option value="lista_asignacion">Lista para asignación / Material listo</option>
        <option value="pendiente_produccion">Pendiente producción</option>
        <option value="bloqueada">Bloqueada</option>
        <option value="rebotada">Rebotada</option>
        <option value="asignada">Asignada</option>
      </select>
      <button className="btn" onClick={load}>Actualizar</button>
    </div>

    {selected.length>0 && <div className="bulk-actions">
      <span className="pill">{selected.length} seleccionada(s)</span>
      <select value={bulkAssignee} onChange={e=>setBulkAssignee(e.target.value)}><option value="">Asignar seleccionadas a...</option>{teamOptions.map(name=><option key={name}>{name}</option>)}</select>
      <button className="btn blue" onClick={assignSelected}>Asignar seleccionadas</button>
      <button className="btn" onClick={()=>setRejectModal(true)}>Rebotar seleccionadas</button>
      <button className="btn red" onClick={()=>setDeleteModal(true)}>Eliminar seleccionadas</button>
    </div>}

    <section className="grid two-col">
      <div className="card">
        <h3>Solicitudes para asignar</h3>
        <div className="table-wrap"><table className="table">
          <thead><tr><th><input type="checkbox" checked={filtered.length>0 && filtered.every(item=>selected.includes(item.id!))} onChange={e=>setSelected(e.target.checked?filtered.map(item=>item.id!).filter(Boolean):[])}/></th><th><SortButton label="Lote" active={sort.key==="batch"} direction={sort.direction} onClick={()=>toggleSort("batch")}/></th><th><SortButton label="Solicitud" active={sort.key==="request"} direction={sort.direction} onClick={()=>toggleSort("request")}/></th><th><SortButton label="Límite lote" active={sort.key==="dueDate"} direction={sort.direction} onClick={()=>toggleSort("dueDate")}/></th><th><SortButton label="Estado" active={sort.key==="status"} direction={sort.direction} onClick={()=>toggleSort("status")}/></th><th><SortButton label="Área" active={sort.key==="area"} direction={sort.direction} onClick={()=>toggleSort("area")}/></th><th><SortButton label="Asignación" active={sort.key==="assignedTo"} direction={sort.direction} onClick={()=>toggleSort("assignedTo")}/></th><th></th></tr></thead>
          <tbody>{filtered.map(item=>{
            const op=getOperationalStatus(item);
            return <tr key={item.id}>
              <td><input type="checkbox" checked={selected.includes(item.id!)} onChange={()=>toggle(item.id!)}/></td>
              <td><strong>{item.batchName||"Sin lote"}</strong><br/><span className="mini">#{item.number||"--"} de {item.total||"--"}</span></td>
              <td><strong>{item.clientName}</strong><br/><span>{item.contentType} · {item.objective}</span><br/><span className="mini">{item.creativeIdea}</span><br/><span className="mini">Publica: {item.publishDate||"Sin fecha"}</span>{item.rejectionNote && <div className="reject-note">Rebotada: {item.rejectionNote}</div>}</td>
              <td><strong>{item.batchDueDate||item.dueDate||"Sin fecha"}</strong><br/><span className="mini">Entrega operativa</span></td>
              <td><StatusPill status={op}/></td>
              <td>{item.suggestedArea}</td>
              <td>
                <select value={item.assignedArea||item.suggestedArea||"Diseño"} onChange={e=>item.id&&update(item.id,{assignedArea:e.target.value})}>{areas.map(x=><option key={x}>{x}</option>)}</select>
                <br/><br/>
                <select value={item.assignedTo||""} onChange={e=>item.id&&update(item.id,{assignedTo:e.target.value})}><option value="">Sin asignar</option>{teamOptions.map(x=><option key={x}>{x}</option>)}</select>
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
        {editing ? <RequestDetail item={editing} draft={detailDraft} setDraft={setDetailDraft} teamOptions={teamOptions} onAssign={assignFromDetail} onReject={rejectFromDetail} onClose={()=>setEditing(null)} onPreview={setPreview}/> : <div className="draft-list">
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


function SortButton({label,active,direction,onClick}:{label:string;active:boolean;direction:"asc"|"desc";onClick:()=>void}){
  return <button type="button" className={active?"sort-button active":"sort-button"} onClick={onClick}>{label} {active ? (direction==="asc"?"↑":"↓") : "↕"}</button>;
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
  teamOptions,
  onAssign,
  onReject,
  onClose,
  onPreview
}:{
  item:ContentRequest;
  draft:Partial<ContentRequest>;
  setDraft:(data:Partial<ContentRequest>)=>void;
  teamOptions:string[];
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
            {teamOptions.map(x=><option key={x}>{x}</option>)}
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
  if(status==="lista_asignacion")return <span className="pill green">Lista para asignar</span>;
  if(status==="asignada")return <span className="pill blue">Asignada</span>;
  if(status==="rebotada")return <span className="pill red">Rebotada</span>;
  return <span className="pill">{status}</span>;
}
