"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Brand, Piece, listBrands, savePieces } from "@/lib/data";

export default function PlannerPage(){
  const [brands,setBrands]=useState<Brand[]>([]);
  const [brandId,setBrandId]=useState("");
  const [pieces,setPieces]=useState<Piece[]>([]);
  useEffect(()=>{listBrands().then(setBrands)},[]);
  const brand=brands.find(x=>x.id===brandId)||brands[0];
  function generate(){
    if(!brand?.id)return;
    const total=brand.posts||15;
    const base=[
      ["Reel","Brunch dominical","Reservas",true,"15 jun"],
      ["Carrusel","5 razones para visitarnos","Confianza",false,"16 jun"],
      ["Post","Promo entre semana","Ventas",false,"17 jun"],
      ["Reel","Behind the scenes cocina","Awareness",true,"18 jun"],
      ["Post","Producto estrella","Ventas",false,"19 jun"]
    ];
    setPieces(base.map((x,i)=>({brandId:brand.id!,brandName:brand.name,number:i+1,total,format:String(x[0]),topic:String(x[1]),goal:String(x[2]),production:Boolean(x[3]),date:String(x[4]),state:"draft"})));
  }
  async function save(){await savePieces(pieces); alert("Solicitudes guardadas en Firestore");}
  return <AppShell active="Planeador IA"><div className="page-title"><p className="eyebrow">Planeador IA</p><h1>Nueva planeación de contenido</h1><p>Genera solicitudes y guárdalas como documentos reales.</p></div><section className="grid kpis">{[["Cliente",brand?.name||"Sin cliente"],["Paquete",String(brand?.posts||0)+" posts"],["Reels",String(brand?.reels||0)],["Producciones",String(brand?.productions||0)],["Creadas",String(pieces.length)],["Mes","Junio 2026"]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}</section><section className="grid two-col"><div className="card"><h3>Generar solicitudes</h3><div className="field"><label>Cliente</label><select value={brand?.id||""} onChange={e=>setBrandId(e.target.value)}>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div><textarea className="prompt" defaultValue="Completa las piezas restantes enfocadas en reservas, experiencia y ventas."/><div className="shortcuts"><span className="chip">Completar mes</span><span className="chip">Ventas</span><span className="chip">Reels con producción</span></div><div style={{display:"flex",gap:12,marginTop:18}}><button className="btn blue" onClick={generate}>Generar propuestas</button><button className="btn" onClick={save}>Guardar solicitudes</button></div></div><aside className="card"><h3>Firestore</h3><p>Al guardar, se crea la colección contentRequests automáticamente.</p><br/><span className="badge green">Funcional</span></aside></section><section className="card" style={{marginTop:24}}><h3>Propuestas</h3><table className="table"><thead><tr><th>#</th><th>Tipo</th><th>Tema</th><th>Objetivo</th><th>Prod.</th><th>Fecha</th></tr></thead><tbody>{pieces.map(x=><tr key={x.number}><td>{x.number}</td><td>{x.format}</td><td>{x.topic}</td><td>{x.goal}</td><td><span className={x.production?"badge orange":"badge green"}>{x.production?"Sí":"No"}</span></td><td>{x.date}</td></tr>)}</tbody></table></section></AppShell>
}
