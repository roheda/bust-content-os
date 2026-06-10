"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Brand, listBrands, saveBrand } from "@/lib/data";

export default function ClientsPage(){
  const [items,setItems]=useState<Brand[]>([]);
  const [name,setName]=useState("");
  const [industry,setIndustry]=useState("");
  const [tone,setTone]=useState("");
  const [audience,setAudience]=useState("");
  const [posts,setPosts]=useState(15);
  const [reels,setReels]=useState(4);
  const [productions,setProductions]=useState(1);
  async function load(){setItems(await listBrands())}
  useEffect(()=>{load()},[]);
  async function submit(){
    await saveBrand({name,industry,tone,audience,platforms:["Instagram","Facebook","TikTok"],posts,reels,productions});
    setName("");setIndustry("");setTone("");setAudience("");await load();
  }
  return <AppShell active="Clientes"><div className="page-title"><p className="eyebrow">Clientes</p><h1>Alta de cliente</h1><p>Guarda clientes y su paquete mensual en Firestore.</p></div><section className="grid two-col" style={{marginTop:24}}><div className="card"><h3>Nuevo cliente</h3><div className="field"><label>Nombre</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Restaurante X"/></div><div className="field"><label>Industria</label><input value={industry} onChange={e=>setIndustry(e.target.value)} placeholder="Restaurante"/></div><div className="field"><label>Tono</label><input value={tone} onChange={e=>setTone(e.target.value)} placeholder="Casual, cercano, premium"/></div><div className="field"><label>Audiencia</label><input value={audience} onChange={e=>setAudience(e.target.value)} placeholder="Parejas, familias, grupos"/></div><div className="grid" style={{gridTemplateColumns:"repeat(3,1fr)"}}><div className="field"><label>Posts</label><input type="number" value={posts} onChange={e=>setPosts(Number(e.target.value))}/></div><div className="field"><label>Reels</label><input type="number" value={reels} onChange={e=>setReels(Number(e.target.value))}/></div><div className="field"><label>Producciones</label><input type="number" value={productions} onChange={e=>setProductions(Number(e.target.value))}/></div></div><button className="btn blue" onClick={submit}>Guardar cliente</button></div><div className="card"><h3>Clientes guardados</h3><table className="table"><tbody>{items.map(x=><tr key={x.id}><td><strong>{x.name}</strong><br/><span style={{color:"#667085"}}>{x.industry}</span></td><td>{x.posts} posts</td><td>{x.productions} prod.</td></tr>)}</tbody></table></div></section></AppShell>
}
