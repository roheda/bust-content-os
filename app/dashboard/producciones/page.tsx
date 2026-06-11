"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Brand, ContentRequest, Production, listBrands, listProductions, listRequests, saveProduction, updateRequest } from "@/lib/data";

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
  status: "programada"
};

export default function ProductionsPage(){
  const [brands,setBrands]=useState<Brand[]>([]);
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [productions,setProductions]=useState<Production[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [form,setForm]=useState<Production>(empty);
  const [showModal,setShowModal]=useState(false);

  async function load(){
    setBrands(await listBrands());
    setRequests(await listRequests());
    setProductions(await listProductions());
  }
  useEffect(()=>{load()},[]);

  const productionRequests = useMemo(()=>requests.filter(x=>x.requiresProduction && !x.productionId),[requests]);
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

  return <AppShell active="Producciones">
    <section className="hero"><div><p className="eyebrow">Producciones</p><h1>Producciones</h1><p>Selecciona solicitudes pendientes y crea una producción con esas fichas.</p></div><button className="btn" onClick={openModal}>Producción nueva</button></section>

    <section className="grid kpis">
      {[["Pendientes",String(productionRequests.length)],["Seleccionadas",String(selected.length)],["Producciones",String(productions.length)],["Programadas",String(productions.filter(x=>x.status==="programada").length)],["Material",String(productions.filter(x=>x.status==="material_entregado").length)],["Clientes",String(brands.length)]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <section className="grid two-col">
      <div className="card">
        <h3>Solicitudes pendientes de producción</h3>
        <div className="table-wrap"><table className="table"><thead><tr><th></th><th>Solicitud</th><th>Notas producción</th><th>Fecha publicación</th></tr></thead><tbody>{productionRequests.map(x=><tr key={x.id}><td><input type="checkbox" checked={selected.includes(x.id!)} onChange={()=>toggle(x.id!)}/></td><td><strong>{x.clientName}</strong><br/>{x.contentType} · {x.objective}<br/><span className="mini">{x.creativeIdea}</span></td><td>{x.productionNotes||"Sin notas"}</td><td>{x.publishDate}</td></tr>)}</tbody></table></div>
      </div>
      <aside className="card">
        <h3>Seleccionadas</h3>
        {selectedRequests.map(x=><div className="draft-item" key={x.id}><strong>{x.contentType}</strong><span className="mini">{x.creativeIdea}</span></div>)}
        {!selectedRequests.length && <p className="mini">Selecciona solicitudes para crear una producción.</p>}
      </aside>
    </section>

    <section className="card" style={{marginTop:24}}>
      <h3>Calendario de producciones</h3>
      <table className="table"><thead><tr><th>Producción</th><th>Cliente</th><th>Fecha</th><th>Solicitudes</th><th>Estado</th><th>Brief</th></tr></thead><tbody>{productions.map(p=><tr key={p.id}><td><strong>{p.title}</strong></td><td>{p.clientName}</td><td>{p.scheduledDate}</td><td>{p.requestIds.length}</td><td>{p.status}</td><td><button className="btn" onClick={()=>window.print()}>Exportar / imprimir</button></td></tr>)}</tbody></table>
    </section>

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
