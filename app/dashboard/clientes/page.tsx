"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Brand, deleteBrand, listBrands, saveBrand, updateBrand } from "@/lib/data";

const empty: Brand = {
  name: "",
  industry: "",
  tone: "",
  audience: "",
  platforms: ["Instagram", "Facebook", "TikTok"],
  posts: 15,
  reels: 4,
  productions: 1,
  month: "2026-06",
  brandNotes: ""
};

export default function ClientsPage(){
  const [items,setItems]=useState<Brand[]>([]);
  const [form,setForm]=useState<Brand>(empty);
  const [editing,setEditing]=useState("");

  async function load(){setItems(await listBrands())}
  useEffect(()=>{load()},[]);

  function set(k:keyof Brand,v:any){setForm({...form,[k]:v})}

  async function submit(){
    if(!form.name)return alert("Agrega nombre");
    if(editing){await updateBrand(editing,form)} else {await saveBrand(form)}
    setForm(empty);
    setEditing("");
    await load();
  }

  function edit(x:Brand){setForm(x);setEditing(x.id||"")}

  async function remove(id?:string){
    if(id&&confirm("¿Eliminar cliente?")){
      await deleteBrand(id);
      await load();
    }
  }

  return <AppShell active="Clientes">
    <div className="page-title">
      <p className="eyebrow">Clientes</p>
      <h1>Clientes y base de marca</h1>
      <p>Base inicial para el futuro Brand Brain.</p>
    </div>

    <section className="grid two-col" style={{marginTop:24}}>
      <div className="card">
        <h3>{editing?"Editar cliente":"Nuevo cliente"}</h3>
        <div className="field"><label>Nombre</label><input value={form.name} onChange={e=>set("name",e.target.value)} /></div>
        <div className="field"><label>Industria</label><input value={form.industry} onChange={e=>set("industry",e.target.value)} /></div>
        <div className="field"><label>Tono</label><input value={form.tone} onChange={e=>set("tone",e.target.value)} /></div>
        <div className="field"><label>Audiencia</label><input value={form.audience} onChange={e=>set("audience",e.target.value)} /></div>
        <div className="field"><label>Brand Brain inicial</label><textarea value={form.brandNotes||""} onChange={e=>set("brandNotes",e.target.value)} /></div>
        <div className="form-grid">
          <div className="field"><label>Mes</label><input value={form.month||""} onChange={e=>set("month",e.target.value)} /></div>
          <div className="field"><label>Posts</label><input type="number" value={form.posts} onChange={e=>set("posts",Number(e.target.value))} /></div>
          <div className="field"><label>Reels</label><input type="number" value={form.reels} onChange={e=>set("reels",Number(e.target.value))} /></div>
          <div className="field"><label>Producciones</label><input type="number" value={form.productions} onChange={e=>set("productions",Number(e.target.value))} /></div>
        </div>
        <div style={{display:"flex",gap:12}}>
          <button className="btn blue" onClick={submit}>{editing?"Guardar cambios":"Crear cliente"}</button>
          {editing&&<button className="btn" onClick={()=>{setEditing("");setForm(empty)}}>Cancelar</button>}
        </div>
      </div>

      <div className="card">
        <h3>Clientes guardados</h3>
        <table className="table">
          <thead><tr><th>Cliente</th><th>Paquete</th><th></th></tr></thead>
          <tbody>{items.map(x=><tr key={x.id}>
            <td><strong>{x.name}</strong><br/><span className="mini">{x.industry} · {x.tone}</span></td>
            <td>{x.posts} posts · {x.reels} reels</td>
            <td><button className="btn" onClick={()=>edit(x)}>Editar</button> <button className="btn red" onClick={()=>remove(x.id)}>Eliminar</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </AppShell>;
}
