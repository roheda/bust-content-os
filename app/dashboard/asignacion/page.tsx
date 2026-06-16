"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Brand,
  ContentRequest,
  areas,
  getOperationalStatus,
  hasMaterial,
  listBrands,
  listRequests,
  priorities,
  updateRequest
} from "@/lib/data";

const team = ["Ana Diseño","Luis Diseño","Carlos Editor","Mariana Editora","Pedro Video","Mafer KAM","Rodrigo"];

export default function AssignmentPage(){
  const [items,setItems]=useState<ContentRequest[]>([]);
  const [brands,setBrands]=useState<Brand[]>([]);
  const [client,setClient]=useState("all");
  const [area,setArea]=useState("all");
  const [status,setStatus]=useState("all");
  const [selected,setSelected]=useState<string[]>([]);
  const [editing,setEditing]=useState<ContentRequest|null>(null);

  async function load(){setItems(await listRequests());setBrands(await listBrands())}
  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>items.filter(item=>{
    const op=getOperationalStatus(item);
    return (client==="all"||item.clientId===client) && (area==="all"||item.suggestedArea===area||item.assignedArea===area) && (status==="all"||op===status);
  }),[items,client,area,status]);

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
      assignedTo:item.assignedTo||team[0],
      priority:item.priority||"Media",
      dueDate:item.dueDate||item.batchDueDate||item.publishDate,
      status:"asignada"
    });
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
        <option value="lista_asignacion">Lista para asignación</option>
        <option value="pendiente_produccion">Pendiente producción</option>
        <option value="bloqueada">Bloqueada</option>
        <option value="asignada">Asignada</option>
      </select>
      <button className="btn" onClick={load}>Actualizar</button>
      {selected.length>0 && <a className="btn blue" href="/dashboard/producciones">Crear producción con seleccionadas →</a>}
    </div>

    <section className="grid two-col">
      <div className="card">
        <h3>Solicitudes para asignar</h3>
        <div className="table-wrap"><table className="table">
          <thead><tr><th></th><th>Solicitud</th><th>Límite lote</th><th>Estado</th><th>Área</th><th>Asignación</th><th></th></tr></thead>
          <tbody>{filtered.map(item=>{
            const op=getOperationalStatus(item);
            return <tr key={item.id}>
              <td><input type="checkbox" checked={selected.includes(item.id!)} onChange={()=>toggle(item.id!)}/></td>
              <td><strong>{item.clientName}</strong><br/><span>{item.contentType} · {item.objective}</span><br/><span className="mini">{item.creativeIdea}</span><br/><span className="mini">Publica: {item.publishDate||"Sin fecha"}</span></td>
              <td><strong>{item.batchDueDate||item.dueDate||"Sin fecha"}</strong><br/><span className="mini">Entrega operativa</span></td>
              <td><StatusPill status={op}/></td>
              <td>{item.suggestedArea}</td>
              <td>
                <select value={item.assignedArea||item.suggestedArea||"Diseño"} onChange={e=>item.id&&update(item.id,{assignedArea:e.target.value})}>{areas.map(x=><option key={x}>{x}</option>)}</select>
                <br/><br/>
                <select value={item.assignedTo||""} onChange={e=>item.id&&update(item.id,{assignedTo:e.target.value})}><option value="">Sin asignar</option>{team.map(x=><option key={x}>{x}</option>)}</select>
                <br/><br/>
                <select value={item.priority||"Media"} onChange={e=>item.id&&update(item.id,{priority:e.target.value})}>{priorities.map(x=><option key={x}>{x}</option>)}</select><br/><br/><input type="date" value={item.dueDate||item.batchDueDate||""} onChange={e=>item.id&&update(item.id,{dueDate:e.target.value})}/>
              </td>
              <td><button className="btn blue" onClick={()=>assign(item)}>Asignar</button><br/><br/><button className="btn" onClick={()=>setEditing(item)}>Detalle</button></td>
            </tr>
          })}</tbody>
        </table></div>
      </div>

      <aside className="card">
        <h3>{editing?"Detalle":"Reglas"}</h3>
        {editing ? <div>
          <p><strong>{editing.clientName}</strong></p>
          <p className="mini">{editing.creativeIdea}</p>
          <p><span className="pill">{editing.contentType}</span> <span className="pill blue">{editing.suggestedArea}</span></p>
          <p><strong>Fecha límite lote:</strong> {editing.batchDueDate||editing.dueDate||"Sin fecha"}</p><p><strong>Fecha publicación:</strong> {editing.publishDate||"Sin fecha"}</p><p><strong>Producción:</strong> {editing.requiresProduction?"Sí":"No"}</p>
          <p><strong>Material:</strong> {hasMaterial(editing)?"Disponible":"No disponible"}</p>
          <p><strong>Links material:</strong></p>
          <p className="mini">{editing.materialLinks||"Sin links"}</p>
          <button className="btn" onClick={()=>setEditing(null)}>Cerrar</button>
        </div> : <div className="draft-list">
          <div className="draft-item"><strong>No requiere producción</strong><span className="mini">Debe traer material/link desde el Creador. Si no, queda bloqueada.</span></div>
          <div className="draft-item"><strong>Requiere producción</strong><span className="mini">Se agrupa en Producciones y no se asigna a ejecución hasta tener material.</span></div>
          <div className="draft-item"><strong>Asignada</strong><span className="mini">Aparece en Calendario por persona, área y fecha.</span></div>
        </div>}
      </aside>
    </section>
  </AppShell>
}

function StatusPill({status}:{status:string}){
  if(status==="bloqueada")return <span className="pill red">Bloqueada</span>;
  if(status==="pendiente_produccion")return <span className="pill orange">Pendiente producción</span>;
  if(status==="lista_asignacion")return <span className="pill green">Lista</span>;
  if(status==="asignada")return <span className="pill blue">Asignada</span>;
  return <span className="pill">{status}</span>;
}
