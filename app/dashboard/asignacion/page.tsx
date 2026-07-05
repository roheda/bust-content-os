"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Brand,
  ContentRequest,
  ReferenceFile,
  OperationalContentRule,
  ClientOperationalOverride,
  TeamDailyCapacity,
  PlatformUser,
  areas,
  getOperationalStatus,
  hasMaterial,
  canAssignRequest,
  isImageFile, isVideoFile,
  listUniqueBrands,
  listRequests,
  listUsers,
  listOperationalContentRules,
  listClientOperationalOverrides,
  listTeamDailyCapacities,
  getCapacityTone,
  getOperationalPlan,
  planWorkDateForAssignment,
  organizationTeam,
  priorities,
  updateRequest,
  deleteRequest
} from "@/lib/data";

const assignableProductionAreas = ["Diseño", "Audiovisual"];
const assignableRoleKeys = ["diseno", "diseno_lead", "audiovisual"];
const organizationAreaByName = new Map(
  organizationTeam.map(user=>[normalizePersonKey(user.name), normalizeAssignableArea(user.area)])
);

function normalizeAssignableArea(value = ""){
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if(normalized.includes("diseno") || normalized.includes("diseño")) return "Diseño";
  if(normalized.includes("audiovisual") || normalized.includes("video") || normalized.includes("foto")) return "Audiovisual";
  return "";
}

function normalizePersonKey(value = ""){
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toDisplayName(value = ""){
  const lowerWords = new Set(["de", "del", "la", "las", "los", "y"]);
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word,index)=> lowerWords.has(word) && index > 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getAssignableUserArea(user: PlatformUser){
  const nameKey = normalizePersonKey(user.name);
  const organizationArea = organizationAreaByName.get(nameKey);
  if(organizationArea) return organizationArea;

  const searchable = [user.department, user.jobTitle, user.roleLabel, user.roleKey]
    .filter(Boolean)
    .join(" ");
  const areaFromText = normalizeAssignableArea(searchable);
  if(areaFromText) return areaFromText;

  const roleKey = (user.roleKey || "").toLowerCase();
  if(assignableRoleKeys.includes(roleKey)){
    if(roleKey.includes("diseno")) return "Diseño";
    if(roleKey.includes("audiovisual")) return "Audiovisual";
  }
  return "";
}

function isAssignableTeamUser(user: PlatformUser){
  return Boolean(getAssignableUserArea(user));
}

function uniqueDisplayNames(names: string[]){
  const seen = new Set<string>();
  return names
    .map(toDisplayName)
    .filter(Boolean)
    .filter(name=>{
      const key = normalizePersonKey(name);
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"}));
}

const assignmentStatusOptions = [
  { value: "all", label: "Todos los estados" },
  { value: "lista_asignacion", label: "Lista para asignación / Material listo" },
  { value: "pendiente_produccion", label: "Pendiente producción" },
  { value: "produccion_programada", label: "Producción programada" },
  { value: "material_listo", label: "Material listo" },
  { value: "bloqueada", label: "Bloqueada" },
  { value: "asignada", label: "Asignada" },
  { value: "en_ejecucion", label: "En ejecución" },
  { value: "en_revision", label: "En revisión" },
  { value: "pendiente_aprobacion", label: "Aprobación Content" },
  { value: "pendiente_aprobacion_kam", label: "Aprobación KAM" },
  { value: "aprobada_pendiente_copyout", label: "En Contenidos" },
  { value: "rebotada", label: "Rebotada" },
  { value: "lista_programar", label: "Lista para programar" },
  { value: "programada", label: "Programada" },
  { value: "publicada", label: "Publicada" },
  { value: "finalizada", label: "Finalizada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "eliminada", label: "Eliminada" }
];

function statusMatchesFilter(item: ContentRequest, selectedStatus: string) {
  if (selectedStatus === "all") return true;
  const operationalStatus = getOperationalStatus(item);
  return operationalStatus === selectedStatus || item.status === selectedStatus;
}

export default function AssignmentPage(){
  const [items,setItems]=useState<ContentRequest[]>([]);
  const [brands,setBrands]=useState<Brand[]>([]);
  const [users,setUsers]=useState<PlatformUser[]>([]);
  const [costRules,setCostRules]=useState<OperationalContentRule[]>([]);
  const [clientOverrides,setClientOverrides]=useState<ClientOperationalOverride[]>([]);
  const [teamCapacities,setTeamCapacities]=useState<TeamDailyCapacity[]>([]);
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
  const [bulkAssignee,setBulkAssignee]=useState("");
  const [sort,setSort]=useState<{key:string;direction:"asc"|"desc"}>({key:"batch",direction:"asc"});

  async function load(){
    const [loadedItems, loadedBrands, loadedUsers, loadedRules, loadedOverrides, loadedCapacities] = await Promise.all([
      listRequests(),
      listUniqueBrands(),
      listUsers(),
      listOperationalContentRules(),
      listClientOperationalOverrides(),
      listTeamDailyCapacities()
    ]);
    setItems(loadedItems);
    setBrands(loadedBrands);
    setUsers(loadedUsers.filter(user=>user.status!=="inactive"));
    setCostRules(loadedRules);
    setClientOverrides(loadedOverrides);
    setTeamCapacities(loadedCapacities);
  }
  useEffect(()=>{load()},[]);

  const teamOptionsByArea = useMemo(()=>{
    const grouped: Record<string,string[]> = { "Diseño": [], "Audiovisual": [] };

    users
      .filter(user=>user.status!=="inactive")
      .forEach(user=>{
        const userArea = getAssignableUserArea(user);
        if(userArea && grouped[userArea]) grouped[userArea].push(user.name);
      });

    organizationTeam
      .filter(user=>assignableProductionAreas.includes(normalizeAssignableArea(user.area)))
      .forEach(user=>{
        const userArea = normalizeAssignableArea(user.area);
        if(userArea && grouped[userArea]) grouped[userArea].push(user.name);
      });

    return {
      "Diseño": uniqueDisplayNames(grouped["Diseño"]),
      "Audiovisual": uniqueDisplayNames(grouped["Audiovisual"])
    };
  },[users]);

  const teamOptions = useMemo(()=>uniqueDisplayNames([
    ...teamOptionsByArea["Diseño"],
    ...teamOptionsByArea["Audiovisual"]
  ]),[teamOptionsByArea]);

  function getAreaForItem(item: Partial<ContentRequest>){
    return normalizeAssignableArea(item.assignedArea || item.suggestedArea || "") || "Diseño";
  }

  function getTeamOptionsForArea(areaValue = ""){
    const normalizedArea = normalizeAssignableArea(areaValue) || "Diseño";
    return teamOptionsByArea[normalizedArea] || [];
  }

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

  const batchOptions = useMemo(()=>{
    const map = new Map<string,string>();
    items
      .filter(item=>client==="all" || item.clientId===client)
      .forEach(item=>map.set(item.batchId||"sin-lote", item.batchName||"Sin lote"));
    return Array.from(map.entries()).map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,"es"));
  },[items,client]);

  const filtered=useMemo(()=>items.filter(item=>{
    const op=getOperationalStatus(item);
    return (client==="all"||item.clientId===client) &&
      (batchFilter==="all" || (item.batchId||"sin-lote")===batchFilter) &&
      (area==="all"||item.suggestedArea===area||item.assignedArea===area) && statusMatchesFilter(item,status);
  }).sort((a,b)=>String(sortValue(a,sort.key)).localeCompare(String(sortValue(b,sort.key)),"es",{numeric:true})*(sort.direction==="asc"?1:-1)),[items,client,batchFilter,area,status,sort]);

  const assignableFiltered = useMemo(()=>filtered.filter(canAssignRequest),[filtered]);
  const selectedItems = useMemo(()=>items.filter(item=>selected.includes(item.id||"")),[items,selected]);
  const selectedAssignableCount = selectedItems.filter(canAssignRequest).length;
  const selectedBlockedCount = selectedItems.length - selectedAssignableCount;
  const selectedAssignableAreas = useMemo(()=>Array.from(new Set(selectedItems.filter(canAssignRequest).map(getAreaForItem))),[selectedItems]);
  const bulkArea = selectedAssignableAreas.length === 1 ? selectedAssignableAreas[0] : "";
  const bulkTeamOptions = bulkArea ? getTeamOptionsForArea(bulkArea) : [];

  function toggle(id:string){setSelected(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id])}

  async function update(id:string,data:Partial<ContentRequest>){
    await updateRequest(id,data);
    await load();
  }

  function buildAssignmentPayload(item:ContentRequest, assignee:string, areaValue:string){
    const plan = getOperationalPlan({...item,assignedTo:assignee,assignedArea:areaValue},costRules,clientOverrides);
    const schedule = planWorkDateForAssignment(item,items,teamCapacities,costRules,clientOverrides,assignee,areaValue);
    const capacityTone = getCapacityTone(schedule.projectedLoad, schedule.capacity);
    return {
      assignedArea: areaValue,
      assignedTo: assignee,
      priority: item.priority || "Media",
      clientDueDate: plan.clientDueDate,
      internalDueDate: plan.internalDueDate,
      productionDueDate: item.requiresProduction ? plan.productionDueDate : "",
      dueDate: plan.internalDueDate || item.dueDate || item.batchDueDate || item.publishDate,
      plannedWorkDate: schedule.plannedWorkDate,
      operationalCost: plan.totalCost,
      operationalHours: plan.editingHours,
      operationalWeight: 1,
      operationalRisk: schedule.overflow || capacityTone.tone === "red" ? "red" : capacityTone.tone === "orange" ? "orange" : capacityTone.tone === "yellow" ? "yellow" : "green",
      carriedOver: false,
      carriedOverDays: 0,
      status: "asignada"
    } as Partial<ContentRequest>;
  }

  async function assign(item:ContentRequest){
    if(!item.id)return;
    if(!canAssignRequest(item)){
      alert(getAssignBlockReason(item));
      return;
    }
    const targetArea = item.assignedArea||item.suggestedArea||"Diseño";
    const assignee = getTeamOptionsForArea(targetArea).includes(item.assignedTo||"") ? item.assignedTo || "" : getTeamOptionsForArea(targetArea)[0]||"";
    await update(item.id,buildAssignmentPayload(item,assignee,targetArea));
  }

  async function assignFromDetail(item:ContentRequest){
    if(!item.id)return;
    if(!canAssignRequest(item)){
      alert(getAssignBlockReason(item));
      return;
    }
    const targetArea = detailDraft.assignedArea || item.assignedArea || item.suggestedArea || "Diseño";
    const validAssignees = getTeamOptionsForArea(targetArea);
    const assignee = validAssignees.includes(detailDraft.assignedTo || "") ? detailDraft.assignedTo || "" : "";
    await updateRequest(item.id,{
      ...buildAssignmentPayload(item,assignee,targetArea),
      priority: detailDraft.priority || "Media",
      internalNotes:detailDraft.internalNotes || ""
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
    const assignable = selectedItems.filter(canAssignRequest);
    const blocked = selectedItems.filter(item=>!canAssignRequest(item));
    const areasInSelection = Array.from(new Set(assignable.map(getAreaForItem)));
    if(areasInSelection.length > 1){
      alert("Selecciona solicitudes de una sola área para asignarlas en bloque. Diseño y Audiovisual tienen responsables distintos.");
      return;
    }
    const validBulkAssignees = getTeamOptionsForArea(areasInSelection[0] || "");
    if(!validBulkAssignees.includes(bulkAssignee)){
      alert(`La persona seleccionada no pertenece al área ${areasInSelection[0] || "correspondiente"}.`);
      return;
    }
    if(!assignable.length){
      alert("Ninguna de las solicitudes seleccionadas está lista para asignarse. Las piezas que requieren producción deben tener material listo antes de pasar a diseño/audiovisual.");
      return;
    }
    await Promise.all(assignable.map(item=>updateRequest(item.id!,buildAssignmentPayload(item,bulkAssignee,item.assignedArea||item.suggestedArea||areasInSelection[0]||"Diseño"))));
    setSelected(blocked.map(item=>item.id!).filter(Boolean));
    setBulkAssignee("");
    await load();
    alert(`${assignable.length} solicitud(es) asignadas. ${blocked.length ? `${blocked.length} quedaron pendientes porque falta producción/material.` : "Todas quedaron asignadas."}`);
  }

  async function rejectRequests(ids:string[], note:string){
    if(!ids.length)return alert("Selecciona al menos una solicitud.");
    if(!note.trim())return alert("Escribe una nota para rebotar la solicitud.");
    await Promise.all(ids.map(id=>{
      const current = items.find(item=>item.id===id);
      const comments = [...(current?.comments||[]), {
        id:`${Date.now()}-${id}`,
        author:"Sistema",
        target:"Content",
        body:`Solicitud rebotada desde Asignación. Motivo: ${note.trim()}`,
        mentions:["@content"],
        status:"open" as const,
        createdAt:new Date().toISOString()
      }];
      return updateRequest(id,{
        status:"rebotada",
        rejectionNote:note.trim(),
        rejectedAt:new Date().toISOString(),
        assignedTo:"",
        assignedArea:"",
        internalNotes: note.trim(),
        comments
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
      {[["Total",String(items.length)],["Filtradas",String(filtered.length)],["Seleccionadas",String(selected.length)],["Listas",String(items.filter(canAssignRequest).length)],["Pend. producción",String(items.filter(x=>getOperationalStatus(x)==="pendiente_produccion").length)],["Bloqueadas",String(items.filter(x=>getOperationalStatus(x)==="bloqueada").length)],["Asignadas",String(items.filter(x=>x.status==="asignada").length)]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <div className="toolbar">
      <select value={client} onChange={e=>{setClient(e.target.value);setBatchFilter("all");}}><option value="all">Todos los clientes</option>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select value={batchFilter} onChange={e=>setBatchFilter(e.target.value)}><option value="all">Todos los lotes</option>{batchOptions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select value={area} onChange={e=>setArea(e.target.value)}><option value="all">Todas las áreas</option>{areas.map(x=><option key={x}>{x}</option>)}</select>
      <select value={status} onChange={e=>setStatus(e.target.value)}>
        {assignmentStatusOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <button className="btn" onClick={load}>Actualizar</button>
    </div>

    {selected.length>0 && <div className="bulk-actions">
      <span className="pill">{selected.length} seleccionada(s)</span>{selectedBlockedCount>0 && <span className="pill amber">{selectedBlockedCount} no asignable(s)</span>}{selectedAssignableCount>0 && <span className="pill green">{selectedAssignableCount} lista(s)</span>}
      <select className="assignment-person-select assignment-bulk-select" value={bulkAssignee} onChange={e=>setBulkAssignee(e.target.value)} disabled={!bulkArea} title={bulkArea ? `Solo aparecen personas de ${bulkArea}` : "Selecciona solicitudes de una sola área"}><option value="">{bulkArea ? `Asignar seleccionadas a ${bulkArea}...` : "Selecciona una sola área"}</option>{bulkTeamOptions.map(name=><option key={name}>{name}</option>)}</select>
      <button className="btn blue" onClick={assignSelected} disabled={!bulkArea}>Asignar seleccionadas</button>
      <button className="btn" onClick={()=>setRejectModal(true)}>Rebotar seleccionadas</button>
      <button className="btn red" onClick={()=>setDeleteModal(true)}>Eliminar seleccionadas</button>
    </div>}

    <section className="grid two-col">
      <div className="card">
        <h3>Solicitudes para asignar</h3>
        <div className="table-wrap assignment-table-wrap"><table className="table assignment-table">
          <thead><tr><th><input type="checkbox" title="Seleccionar solo solicitudes listas para asignar" checked={assignableFiltered.length>0 && assignableFiltered.every(item=>selected.includes(item.id!))} onChange={e=>setSelected(e.target.checked?assignableFiltered.map(item=>item.id!).filter(Boolean):[])}/></th><th><SortButton label="Lote" active={sort.key==="batch"} direction={sort.direction} onClick={()=>toggleSort("batch")}/></th><th><SortButton label="Solicitud" active={sort.key==="request"} direction={sort.direction} onClick={()=>toggleSort("request")}/></th><th><SortButton label="Fecha interna" active={sort.key==="dueDate"} direction={sort.direction} onClick={()=>toggleSort("dueDate")}/></th><th><SortButton label="Estado" active={sort.key==="status"} direction={sort.direction} onClick={()=>toggleSort("status")}/></th><th><SortButton label="Área" active={sort.key==="area"} direction={sort.direction} onClick={()=>toggleSort("area")}/></th><th><SortButton label="Asignación" active={sort.key==="assignedTo"} direction={sort.direction} onClick={()=>toggleSort("assignedTo")}/></th><th></th></tr></thead>
          <tbody>{filtered.map(item=>{
            const op=getOperationalStatus(item);
            const assignable = canAssignRequest(item);
            const rowArea = getAreaForItem(item);
            const rowTeamOptions = getTeamOptionsForArea(rowArea);
            return <tr key={item.id} className={!assignable ? "row-muted" : ""}>
              <td><input type="checkbox" checked={selected.includes(item.id!)} disabled={!assignable} title={assignable ? "Lista para asignar" : getAssignBlockReason(item)} onChange={()=>toggle(item.id!)}/></td>
              <td><strong>{item.batchName||"Sin lote"}</strong><br/><span className="mini">#{item.number||"--"} de {item.total||"--"}</span></td>
              <td><strong>{item.clientName}</strong><br/><span>{item.contentType} · {item.objective}</span><br/><span className="mini text-clamp-2">{item.creativeIdea}</span><br/><span className="mini">Publica: {item.publishDate||"Sin fecha"}</span>{item.rejectionNote && <div className="reject-note text-clamp-2">Rebotada: {item.rejectionNote}</div>}</td>
              <td><strong>{item.internalDueDate||item.dueDate||item.batchDueDate||"Sin fecha"}</strong><br/><span className="mini">Interna · Final: {item.publishDate||item.clientDueDate||"Sin fecha"}</span>{item.productionDueDate && <><br/><span className="mini">Máx. producción: {item.productionDueDate}</span></>}</td>
              <td><StatusPill status={op}/>{!assignable && <p className="mini warn-text">{getAssignBlockReason(item)}</p>}</td>
              <td>{item.suggestedArea}</td>
              <td>
                <select className="assignment-area-select" value={item.assignedArea||item.suggestedArea||"Diseño"} onChange={e=>item.id&&update(item.id,{assignedArea:e.target.value,assignedTo:""})}>{assignableProductionAreas.map(x=><option key={x}>{x}</option>)}</select>
                <br/><br/>
                <select className="assignment-person-select" value={rowTeamOptions.includes(item.assignedTo||"") ? item.assignedTo||"" : ""} onChange={e=>item.id&&update(item.id,{assignedTo:e.target.value})} title={`Solo aparecen personas de ${rowArea}`}><option value="">Sin asignar</option>{rowTeamOptions.map(x=><option key={x}>{x}</option>)}</select>
                <br/><br/>
                <select className="assignment-priority-select" value={item.priority||"Media"} onChange={e=>item.id&&update(item.id,{priority:e.target.value})}>{priorities.map(x=><option key={x}>{x}</option>)}</select>
              </td>
              <td><button className="btn blue" disabled={!assignable} title={assignable ? "Asignar" : getAssignBlockReason(item)} onClick={()=>assign(item)}>Asignar</button><br/><br/><button className="btn" onClick={()=>{setEditing(item);setDetailDraft({assignedArea:item.assignedArea||item.suggestedArea,assignedTo:item.assignedTo||"",priority:item.priority||"Media",internalNotes:item.internalNotes||""})}}>Detalle</button></td>
            </tr>
          })}</tbody>
        </table></div>
      </div>

      <aside className="card">
        <h3>{editing?"Detalle":"Reglas"}</h3>
        {editing ? <RequestDetail item={editing} draft={detailDraft} setDraft={setDetailDraft} getTeamOptionsForArea={getTeamOptionsForArea} onAssign={assignFromDetail} onReject={rejectFromDetail} onClose={()=>setEditing(null)} onPreview={setPreview}/> : <div className="draft-list">
          <div className="draft-item"><strong>No requiere producción</strong><span className="mini">Debe traer material/link desde el Creador. Si no, queda bloqueada.</span></div>
          <div className="draft-item"><strong>Requiere producción</strong><span className="mini">Se agrupa en Producciones y no se asigna a ejecución hasta tener material.</span></div>
          <div className="draft-item"><strong>Asignada</strong><span className="mini">Aparece en Calendario por persona, área y fecha.</span></div>
        </div>}
      </aside>
    </section>
    {rejectModal && <div className="modal-backdrop"><div className="modal-card">
      <h2>Devolver solicitudes a Content</h2>
      <p className="mini">Usa esto cuando la solicitud ya avanzó a asignación pero necesita corrección. Si fue un borrador mal creado, elimínalo desde Creador de Solicitudes.</p>
      <div className="field"><label>Nota de rechazo</label><textarea value={rejectNote} onChange={e=>setRejectNote(e.target.value)} placeholder="Ej. Falta material correcto / brief incompleto / no aplica al objetivo."/></div>
      <div style={{display:"flex",gap:12}}>
        <button className="btn blue" onClick={()=>rejectRequests(selected,rejectNote)}>Devolver a Content</button>
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
  getTeamOptionsForArea,
  onAssign,
  onReject,
  onClose,
  onPreview
}:{
  item:ContentRequest;
  draft:Partial<ContentRequest>;
  setDraft:(data:Partial<ContentRequest>)=>void;
  getTeamOptionsForArea:(areaValue?:string)=>string[];
  onAssign:(item:ContentRequest)=>void;
  onReject:(item:ContentRequest,note:string)=>void;
  onClose:()=>void;
  onPreview:(file:ReferenceFile)=>void;
}){
  const referenceLinks = splitLinks(item.referenceLinks);
  const materialLinks = splitLinks(item.materialLinks);
  const [localRejectNote,setLocalRejectNote]=useState("");
  const op = getOperationalStatus(item);
  const detailArea = draft.assignedArea || item.assignedArea || item.suggestedArea || "Diseño";
  const detailTeamOptions = getTeamOptionsForArea(detailArea);
  const validDetailAssignee = detailTeamOptions.includes((draft.assignedTo || item.assignedTo || ""));

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
          <label>Fecha interna</label>
          <input value={item.internalDueDate || item.dueDate || item.batchDueDate || "Sin fecha"} disabled/>
        </div>
        <div className="field">
          <label>Fecha publicación</label>
          <input value={item.publishDate || item.clientDueDate || "Sin fecha"} disabled/>
        </div>
        <div className="field">
          <label>Día programado sugerido</label>
          <input value={item.plannedWorkDate || "Se calcula al asignar"} disabled/>
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
          <select className="assignment-area-select" value={detailArea} onChange={e=>setDraft({...draft,assignedArea:e.target.value,assignedTo:""})}>
            {assignableProductionAreas.map(x=><option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Responsable</label>
          <select className="assignment-person-select" value={validDetailAssignee ? draft.assignedTo||item.assignedTo||"" : ""} onChange={e=>setDraft({...draft,assignedTo:e.target.value})}>
            <option value="">Sin asignar</option>
            {detailTeamOptions.map(x=><option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Prioridad</label>
          <select className="assignment-priority-select" value={draft.priority||item.priority||"Media"} onChange={e=>setDraft({...draft,priority:e.target.value})}>
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
        <h4>Devolver a Content</h4>
        <p className="mini">Úsalo cuando el brief ya llegó a asignación pero necesita corrección. En creación, lo correcto es editar o eliminar el borrador.</p>
        <textarea value={localRejectNote} onChange={e=>setLocalRejectNote(e.target.value)} placeholder="Motivo del rebote"/>
        <button className="btn red" style={{marginTop:10}} onClick={()=>onReject(item,localRejectNote)}>Devolver solicitud</button>
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
          : isVideoFile(file) ? <video src={file.url} muted playsInline preload="metadata"/> : <span>Archivo</span>
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
        : isVideoFile(file) ? <video src={file.url} controls playsInline/> : <p>Archivo no previsualizable. Ábrelo desde su link original.</p>
      }
    </div>
  </div>;
}



function getAssignBlockReason(item:ContentRequest){
  if(item.requiresProduction){
    return "Pendiente de producción: falta marcar material listo o entregar archivos/links.";
  }
  return "Bloqueada: falta material base para trabajar.";
}

function StatusPill({status}:{status:string}){
  const option = assignmentStatusOptions.find(item=>item.value===status);
  if(status==="eliminada")return <span className="pill red">Eliminada</span>;
  if(status==="bloqueada")return <span className="pill red">Bloqueada</span>;
  if(status==="pendiente_produccion" || status==="produccion_programada")return <span className="pill orange">{option?.label || status}</span>;
  if(status==="lista_asignacion" || status==="material_listo")return <span className="pill green">{option?.label || "Lista para asignar"}</span>;
  if(status==="asignada" || status==="en_ejecucion" || status==="en_revision")return <span className="pill blue">{option?.label || status}</span>;
  if(status==="rebotada" || status==="cancelada")return <span className="pill red">{option?.label || status}</span>;
  if(status==="finalizada" || status==="publicada")return <span className="pill green">{option?.label || status}</span>;
  return <span className="pill">{option?.label || status}</span>;
}
