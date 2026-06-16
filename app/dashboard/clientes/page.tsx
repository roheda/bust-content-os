"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Brand, listBrands, saveBrand } from "@/lib/data";

export default function ClientsPage(){
  const [clients,setClients]=useState<Brand[]>([]);
  const [name,setName]=useState("");
  const [industry,setIndustry]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    setLoading(true);
    const rows = await listBrands();
    setClients(rows.filter(c=>(c.status||"active")!=="deleted").sort((a,b)=>a.name.localeCompare(b.name,"es")));
    setLoading(false);
  }
  useEffect(()=>{load()},[]);

  async function createClient(){
    if(!name.trim())return alert("Escribe el nombre del cliente.");
    setSaving(true);
    await saveBrand({
      name:name.trim(),
      industry:industry.trim(),
      status:"active",
      tone:"",
      audience:"",
      platforms:["Instagram","Facebook","TikTok"],
      posts:15,
      reels:4,
      productions:1,
      month:new Date().toISOString().slice(0,7),
      brandNotes:"",
      brandBrain:{brandDescription:"",tone:"",colors:[],typography:"",visualStyle:[],dos:[],donts:[],recommendedModels:[]},
      services:["Content OS","BUST It Now"],
      sharedSystems:["BUST Content OS","BUST It Now"]
    });
    setName(""); setIndustry("");
    setMessage("Cliente creado. Ya puedes configurar su Brand Brain y Assets.");
    setSaving(false);
    await load();
  }

  const countLabel = useMemo(()=>clients.length===1?"1 cliente activo":`${clients.length} clientes activos`,[clients.length]);

  return <AppShell active="Clientes">
    <section className="hero">
      <div><p className="eyebrow">Clientes / Brand Brain</p><h1>Clientes</h1><p>Crea cada marca una sola vez. Su Brand Brain y Assets alimentan BUST It Now y toda la operación de Content OS.</p></div>
      <div className="pill">{countLabel}</div>
    </section>

    <section className="grid two-col">
      <article className="card">
        <p className="eyebrow">Nuevo cliente</p><h2>Alta de marca</h2>
        <div className="field"><label>Nombre del cliente</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Acerofertas"/></div>
        <div className="field"><label>Giro o categoría</label><input value={industry} onChange={e=>setIndustry(e.target.value)} placeholder="Ej. Acero, restaurante, inmobiliaria"/></div>
        {message && <div className="feedback-item done"><p>{message}</p></div>}
        <button className="btn blue" onClick={createClient} disabled={saving}>{saving?"Creando...":"Crear cliente"}</button>
      </article>

      <article className="card">
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
          <div><p className="eyebrow">Marcas almacenadas</p><h2>Configura su Brand Brain</h2></div>
          <button className="btn" onClick={load}>Actualizar</button>
        </div>
        {loading ? <p className="mini">Cargando clientes...</p> : clients.length===0 ? <p className="mini">Todavía no hay clientes activos.</p> : <div className="grid">
          {clients.map(client=><Link key={client.id} href={`/dashboard/clientes/${client.id}`} className="list-task-card">
            <strong>{client.name}</strong><span className="mini">{client.industry || "Sin categoría definida"}</span><span className="system-pill">Abrir Brand Brain →</span>
          </Link>)}
        </div>}
      </article>
    </section>
  </AppShell>
}
