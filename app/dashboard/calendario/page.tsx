"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { ContentRequest, Production, listProductions, listRequests } from "@/lib/data";

const people = ["Todos","Ana Diseño","Luis Diseño","Carlos Editor","Mariana Editora","Pedro Video","Mafer KAM","Rodrigo"];
const areas = ["Todas","Diseño","Audiovisual","Copy","Mixto"];

export default function CalendarPage(){
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [productions,setProductions]=useState<Production[]>([]);
  const [view,setView]=useState<"calendario"|"lista"|"persona"|"producciones">("calendario");
  const [person,setPerson]=useState("Todos");
  const [area,setArea]=useState("Todas");

  async function load(){setRequests(await listRequests());setProductions(await listProductions())}
  useEffect(()=>{load()},[]);

  const filtered = useMemo(()=>requests.filter(x=>
    (person==="Todos"||x.assignedTo===person) &&
    (area==="Todas"||x.assignedArea===area||x.suggestedArea===area)
  ),[requests,person,area]);

  const events = [
    ...filtered.map(x=>({date:x.dueDate||x.batchDueDate||x.publishDate,title:`${x.clientName} · ${x.contentType}`,type:"Entrega operativa",person:x.assignedTo||"Sin asignar",area:x.assignedArea||x.suggestedArea,status:x.status,publishDate:x.publishDate})),
    ...productions.map(x=>({date:x.scheduledDate,title:x.title,type:"Producción",person:x.producer||"Sin responsable",area:"Producción",status:x.status}))
  ].filter(x=>x.date);

  return <AppShell active="Calendario">
    <section className="hero"><div><p className="eyebrow">Equipo</p><h1>Calendario</h1><p>Vista operativa de tareas, publicaciones y producciones por persona, área y fecha.</p></div></section>

    <div className="view-tabs">
      {["calendario","lista","persona","producciones"].map(v=><button key={v} className={view===v?"active":""} onClick={()=>setView(v as any)}>{v}</button>)}
    </div>

    <div className="toolbar">
      <select value={person} onChange={e=>setPerson(e.target.value)}>{people.map(x=><option key={x}>{x}</option>)}</select>
      <select value={area} onChange={e=>setArea(e.target.value)}>{areas.map(x=><option key={x}>{x}</option>)}</select>
      <button className="btn" onClick={load}>Actualizar</button>
    </div>

    <section className="grid kpis">
      {[["Eventos",String(events.length)],["Tareas",String(filtered.length)],["Producciones",String(productions.length)],["Sin asignar",String(requests.filter(x=>!x.assignedTo).length)],["Persona",person],["Área",area]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    {view==="calendario" && <CalendarBoard events={events}/>}
    {view==="lista" && <ListView events={events}/>}
    {view==="persona" && <PersonView requests={filtered}/>}
    {view==="producciones" && <ProductionsView productions={productions}/>}
  </AppShell>
}

function CalendarBoard({events}:{events:any[]}){
  const grouped:Record<string,any[]>={};
  events.forEach(e=>{grouped[e.date]=grouped[e.date]||[];grouped[e.date].push(e)});
  const days=Object.keys(grouped).sort().slice(0,28);
  if(!days.length)return <div className="card"><p>No hay eventos con fecha.</p></div>;
  return <section className="calendar-board">{days.map(day=><div className="calendar-day" key={day}><strong>{day}</strong>{grouped[day].map((e,i)=><div className="calendar-event" key={i}>{e.type}: {e.title}<br/><span>{e.person}</span></div>)}</div>)}</section>
}

function ListView({events}:{events:any[]}){
  return <section className="card"><h3>Lista</h3><table className="table"><thead><tr><th>Fecha operativa</th><th>Tipo</th><th>Título</th><th>Publicación</th><th>Responsable</th><th>Estado</th></tr></thead><tbody>{events.sort((a,b)=>a.date.localeCompare(b.date)).map((e,i)=><tr key={i}><td>{e.date}</td><td>{e.type}</td><td>{e.title}</td><td>{e.publishDate||"-"}</td><td>{e.person}</td><td>{e.status}</td></tr>)}</tbody></table></section>
}

function PersonView({requests}:{requests:ContentRequest[]}){
  const grouped:Record<string,ContentRequest[]>={};
  requests.forEach(r=>{const key=r.assignedTo||"Sin asignar";grouped[key]=grouped[key]||[];grouped[key].push(r)});
  return <section className="status-grid">{Object.entries(grouped).map(([person,items])=><div className="status-card" key={person}><div className="status-head"><strong>{person}</strong><span className="pill">{items.length}</span></div>{items.map(x=><div className="draft-item" key={x.id}><strong>{x.clientName} · {x.contentType}</strong><span className="mini">{x.creativeIdea}</span><span className="mini">Límite: {x.dueDate||x.batchDueDate||"Sin fecha"} · Publica: {x.publishDate||"Sin fecha"}</span></div>)}</div>)}</section>
}

function ProductionsView({productions}:{productions:Production[]}){
  return <section className="card"><h3>Producciones</h3><table className="table"><thead><tr><th>Fecha</th><th>Producción</th><th>Cliente</th><th>Responsable</th><th>Estado</th></tr></thead><tbody>{productions.map(p=><tr key={p.id}><td>{p.scheduledDate}</td><td>{p.title}</td><td>{p.clientName}</td><td>{p.producer}</td><td>{p.status}</td></tr>)}</tbody></table></section>
}
