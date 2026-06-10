"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Brand, ContentRequest, Production, listBrands, listProductions, listRequests, saveProduction } from "@/lib/data";

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
  shotList: "",
  requirements: "",
  notes: "",
  status: "por_programar"
};

export default function ProductionsPage(){
  const [brands,setBrands]=useState<Brand[]>([]);
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [items,setItems]=useState<Production[]>([]);
  const [form,setForm]=useState<Production>(empty);

  async function load(){
    setBrands(await listBrands());
    setRequests(await listRequests());
    setItems(await listProductions());
  }

  useEffect(()=>{load()},[]);

  const filteredRequests = useMemo(()=>requests.filter(x=>!form.clientId || x.clientId===form.clientId),[requests,form.clientId]);

  function set(k:keyof Production,v:any){
    const next = {...form,[k]:v};
    if(k==="clientId"){
      const client = brands.find(x=>x.id===v);
      next.clientName = client?.name || "";
      next.requestIds = [];
    }
    setForm(next);
  }

  function toggle(id:string){
    const ids = form.requestIds.includes(id) ? form.requestIds.filter(x=>x!==id) : [...form.requestIds,id];
    set("requestIds",ids);
  }

  async function submit(){
    if(!form.title)return alert("Agrega título");
    await saveProduction(form);
    setForm(empty);
    await load();
    alert("Producción creada");
  }

  return <AppShell active="Producciones">
    <section className="hero"><div><p className="eyebrow">Producciones</p><h1>Producciones</h1><p>Agrupa solicitudes en un plan de producción.</p></div></section>
    <section className="grid two-col" style={{marginTop:24}}>
      <div className="card">
        <h3>Nueva producción</h3>
        <div className="form-grid">
          <div className="field full"><label>Título</label><input value={form.title} onChange={e=>set("title",e.target.value)}/></div>
          <div className="field"><label>Cliente</label><select value={form.clientId} onChange={e=>set("clientId",e.target.value)}><option value="">Selecciona</option>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div className="field"><label>Fecha</label><input type="date" value={form.scheduledDate} onChange={e=>set("scheduledDate",e.target.value)}/></div>
          <div className="field full"><label>Objetivo</label><textarea value={form.objective} onChange={e=>set("objective",e.target.value)}/></div>
          <div className="field full"><label>Shot list</label><textarea value={form.shotList} onChange={e=>set("shotList",e.target.value)}/></div>
        </div>
        <button className="btn blue" onClick={submit}>Crear producción</button>
      </div>
      <aside className="card">
        <h3>Solicitudes disponibles</h3>
        {filteredRequests.map(x=><label className="draft-item" key={x.id}><input type="checkbox" checked={form.requestIds.includes(x.id!)} onChange={()=>toggle(x.id!)}/><strong>{x.contentType}</strong><span className="mini">{x.creativeIdea}</span></label>)}
      </aside>
    </section>
    <section className="card" style={{marginTop:24}}>
      <h3>Producciones creadas</h3>
      <table className="table"><tbody>{items.map(x=><tr key={x.id}><td><strong>{x.title}</strong></td><td>{x.clientName}</td><td>{x.requestIds.length} solicitudes</td><td>{x.scheduledDate}</td></tr>)}</tbody></table>
    </section>
  </AppShell>;
}
