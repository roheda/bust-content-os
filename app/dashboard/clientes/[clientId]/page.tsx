"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Brand, updateBrand, listBrands } from "@/lib/data";

function joinItems(items?:string[]){return Array.isArray(items)?items.join(", "):""}
function splitComma(value:string){return value.split(",").map(x=>x.trim()).filter(Boolean)}
function splitLines(value:string){return value.split("\n").map(x=>x.trim()).filter(Boolean)}

export default function ClientBrandBrainPage(){
  const {clientId} = useParams<{clientId:string}>();
  const [client,setClient]=useState<Brand|null>(null);
  const [form,setForm]=useState({name:"",industry:"",brandDescription:"",tone:"",colors:"",typography:"",visualStyle:"",dos:"",donts:"",recommendedModels:""});
  const [saving,setSaving]=useState(false);
  const [success,setSuccess]=useState("");
  const [deleteConfirmation,setDeleteConfirmation]=useState("");

  async function load(){
    const row = (await listBrands()).find(x=>x.id===clientId);
    if(!row)return;
    setClient(row);
    const brain = row.brandBrain || {};
    setForm({
      name:row.name||"", industry:row.industry||"",
      brandDescription:brain.brandDescription||row.brandNotes||"",
      tone:brain.tone||row.tone||"", colors:joinItems(brain.colors), typography:brain.typography||"",
      visualStyle:joinItems(brain.visualStyle), dos:Array.isArray(brain.dos)?brain.dos.join("\n"):"",
      donts:Array.isArray(brain.donts)?brain.donts.join("\n"):"", recommendedModels:joinItems(brain.recommendedModels)
    });
  }
  useEffect(()=>{load()},[clientId]);
  function set(k:keyof typeof form,v:string){setForm({...form,[k]:v})}

  async function save(){
    setSaving(true);
    await updateBrand(clientId,{
      name:form.name.trim(), industry:form.industry.trim(), tone:form.tone.trim(), brandNotes:form.brandDescription.trim(),
      brandBrain:{brandDescription:form.brandDescription.trim(), tone:form.tone.trim(), colors:splitComma(form.colors), typography:form.typography.trim(), visualStyle:splitComma(form.visualStyle), dos:splitLines(form.dos), donts:splitLines(form.donts), recommendedModels:splitComma(form.recommendedModels)}
    });
    setSuccess("Brand Brain guardado correctamente.");
    setSaving(false);
    await load();
  }

  async function archive(){
    if(!client)return;
    if(deleteConfirmation.trim()!==client.name.trim())return alert(`Para eliminar escribe exactamente: ${client.name}`);
    await updateBrand(clientId,{status:"deleted"});
    window.location.href="/dashboard/clientes";
  }

  const completeness = useMemo(()=>Math.round((Object.values(form).filter(x=>x.trim()).length/Object.values(form).length)*100),[form]);
  if(!client)return <AppShell active="Clientes"><section className="card"><p>Cargando Brand Brain...</p></section></AppShell>;

  return <AppShell active="Clientes">
    <section className="hero">
      <div><Link href="/dashboard/clientes" className="btn">← Volver a clientes</Link><p className="eyebrow" style={{marginTop:12}}>Brand Brain</p><h1>{client.name}</h1><p>{client.industry || "Sin categoría definida"}. Esta memoria visual alimenta BUST It Now.</p></div>
      <div className="client-os-card"><span className="mini">Completitud inicial</span><strong style={{fontSize:42}}>{completeness}%</strong><Link href={`/dashboard/clientes/${clientId}/assets`} className="btn blue">Abrir Assets</Link></div>
    </section>
    {success && <section className="feedback-item done"><p>{success}</p></section>}
    <section className="brandbrain-layout">
      <div className="brandbrain-card">
        <h2>Cómo debe verse y sentirse la marca</h2>
        <div className="brandbrain-form">
          <div className="client-profile-grid"><div className="field"><label>Nombre</label><input value={form.name} onChange={e=>set("name",e.target.value)}/></div><div className="field"><label>Giro</label><input value={form.industry} onChange={e=>set("industry",e.target.value)}/></div></div>
          <div className="field"><label>Descripción de marca</label><textarea value={form.brandDescription} onChange={e=>set("brandDescription",e.target.value)}/></div>
          <div className="client-profile-grid"><div className="field"><label>Tono</label><input value={form.tone} onChange={e=>set("tone",e.target.value)}/></div><div className="field"><label>Tipografía</label><input value={form.typography} onChange={e=>set("typography",e.target.value)}/></div></div>
          <div className="field"><label>Colores</label><input value={form.colors} onChange={e=>set("colors",e.target.value)} placeholder="#003B71, #E31E24"/></div>
          <div className="field"><label>Estilo visual</label><input value={form.visualStyle} onChange={e=>set("visualStyle",e.target.value)}/></div>
          <div className="field"><label>DO</label><textarea value={form.dos} onChange={e=>set("dos",e.target.value)} /></div>
          <div className="field"><label>DON'T</label><textarea value={form.donts} onChange={e=>set("donts",e.target.value)} /></div>
          <div className="field"><label>Modelos recomendados</label><input value={form.recommendedModels} onChange={e=>set("recommendedModels",e.target.value)}/></div>
          <button className="btn blue" onClick={save} disabled={saving}>{saving?"Guardando...":"Guardar Brand Brain"}</button>
        </div>
      </div>
      <aside className="brandbrain-card">
        <h2>Resumen para generación</h2>
        <div className="detail-copy"><strong>Marca:</strong> {form.name}{"\n"}<strong>Giro:</strong> {form.industry}{"\n"}<strong>Tono:</strong> {form.tone||"Pendiente"}{"\n"}<strong>Colores:</strong> {form.colors||"Pendiente"}{"\n"}<strong>Tipografía:</strong> {form.typography||"Pendiente"}{"\n"}<strong>Estilo:</strong> {form.visualStyle||"Pendiente"}</div>
        <div className="soft-delete-note">Para eliminar escribe exactamente su nombre. Se marca como deleted para conservar trazabilidad.</div>
        <input value={deleteConfirmation} onChange={e=>setDeleteConfirmation(e.target.value)} placeholder={client.name}/>
        <button className="btn red" onClick={archive}>Eliminar cliente</button>
      </aside>
    </section>
  </AppShell>
}
