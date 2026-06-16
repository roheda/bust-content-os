"use client";

import { useEffect, useMemo, useState } from "react";
import { FeedbackItem, listFeedback, saveFeedback, updateFeedback } from "@/lib/data";

const emptyFeedback: FeedbackItem = {
  title: "",
  description: "",
  type: "Mejora",
  priority: "Media",
  status: "pendiente",
  author: "",
  module: "General"
};

export default function FeedbackWidget(){
  const [open,setOpen]=useState(false);
  const [items,setItems]=useState<FeedbackItem[]>([]);
  const [form,setForm]=useState<FeedbackItem>(emptyFeedback);
  const [filter,setFilter]=useState<"pendientes"|"realizadas"|"todas">("pendientes");
  const [saving,setSaving]=useState(false);

  async function load(){
    try{
      setItems(await listFeedback());
    }catch(error){
      console.error(error);
    }
  }

  useEffect(()=>{
    if(open)load();
  },[open]);

  const filtered = useMemo(()=>{
    return items.filter(item=>{
      if(filter==="todas")return true;
      if(filter==="realizadas")return item.status==="realizada";
      return item.status!=="realizada";
    });
  },[items,filter]);

  function setField(k:keyof FeedbackItem,v:string){
    setForm({...form,[k]:v});
  }

  async function submit(){
    if(!form.title.trim())return alert("Escribe un título para el feedback.");
    if(!form.description.trim())return alert("Describe la mejora o problema.");
    setSaving(true);
    try{
      await saveFeedback({
        ...form,
        status:"pendiente",
        author:form.author || "Usuario sistema"
      });
      setForm(emptyFeedback);
      await load();
      alert("Feedback agregado");
    }finally{
      setSaving(false);
    }
  }

  async function markDone(item: FeedbackItem){
    if(!item.id)return;
    await updateFeedback(item.id,{status:"realizada"});
    await load();
  }

  async function reopen(item: FeedbackItem){
    if(!item.id)return;
    await updateFeedback(item.id,{status:"pendiente"});
    await load();
  }

  return <>
    <button className="feedback-fab" onClick={()=>setOpen(!open)}>
      Feedback / Mejoras
    </button>

    {open && <aside className="feedback-panel">
      <div className="feedback-panel-head">
        <div>
          <p className="eyebrow">Sistema</p>
          <h3>Feedback y mejoras</h3>
          <p className="mini">Registra ideas, bugs y mejoras para evolucionar BUST Content OS.</p>
        </div>
        <button className="feedback-close" onClick={()=>setOpen(false)}>✕</button>
      </div>

      <div className="feedback-form">
        <input value={form.title} onChange={e=>setField("title",e.target.value)} placeholder="Título de la mejora"/>
        <textarea value={form.description} onChange={e=>setField("description",e.target.value)} placeholder="Describe qué debería mejorar, qué falla o qué idea tienes."/>
        <div className="form-grid">
          <div className="field">
            <label>Tipo</label>
            <select value={form.type} onChange={e=>setField("type",e.target.value)}>
              <option>Mejora</option>
              <option>Bug</option>
              <option>Idea</option>
              <option>Urgente</option>
              <option>UX/UI</option>
              <option>Proceso</option>
            </select>
          </div>
          <div className="field">
            <label>Prioridad</label>
            <select value={form.priority} onChange={e=>setField("priority",e.target.value)}>
              <option>Baja</option>
              <option>Media</option>
              <option>Alta</option>
              <option>Urgente</option>
            </select>
          </div>
          <div className="field">
            <label>Módulo</label>
            <select value={form.module} onChange={e=>setField("module",e.target.value)}>
              <option>General</option>
              <option>Creador de Solicitudes</option>
              <option>Asignación</option>
              <option>Producciones</option>
              <option>Tareas</option>
              <option>Aprobaciones</option>
              <option>Reportes</option>
              <option>Clientes</option>
            </select>
          </div>
          <div className="field">
            <label>Autor</label>
            <input value={form.author} onChange={e=>setField("author",e.target.value)} placeholder="Tu nombre"/>
          </div>
        </div>
        <button className="btn blue" onClick={submit} disabled={saving}>{saving?"Guardando...":"Agregar feedback"}</button>
      </div>

      <div className="feedback-tabs">
        <button className={filter==="pendientes"?"active":""} onClick={()=>setFilter("pendientes")}>Pendientes</button>
        <button className={filter==="realizadas"?"active":""} onClick={()=>setFilter("realizadas")}>Realizadas</button>
        <button className={filter==="todas"?"active":""} onClick={()=>setFilter("todas")}>Todas</button>
        <button onClick={load}>Actualizar</button>
      </div>

      <div>
        {filtered.map(item=><div className={`feedback-item ${item.status==="realizada" ? "done" : ""}`} key={item.id}>
          <div>
            <h4>{item.title}</h4>
            <p>{item.description}</p>
          </div>
          <div className="feedback-meta">
            <span className={`feedback-mini-pill ${item.status==="realizada" ? "done" : ""}`}>{item.status==="realizada" ? "Mejora realizada" : "Pendiente"}</span>
            <span className="feedback-mini-pill">{item.type}</span>
            <span className="feedback-mini-pill">{item.priority}</span>
            <span className="feedback-mini-pill">{item.module}</span>
            <span className="feedback-mini-pill">{item.author || "Usuario"}</span>
          </div>
          <div className="feedback-actions">
            {item.status==="realizada" ? <button onClick={()=>reopen(item)}>Regresar a pendiente</button> : <button className="done" onClick={()=>markDone(item)}>Marcar mejora realizada</button>}
          </div>
        </div>)}

        {!filtered.length && <p className="mini">No hay feedback en esta vista.</p>}
      </div>
    </aside>}
  </>;
}
