"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Brand, Piece, emptyPiece, formats, goals, listBrands, listPieces, savePiece, savePieces } from "@/lib/data";

export default function PlannerPage(){
  const [brands,setBrands]=useState<Brand[]>([]);
  const [all,setAll]=useState<Piece[]>([]);
  const [brandId,setBrandId]=useState("");
  const [mode,setMode]=useState<"auto"|"manual">("auto");
  const [pieces,setPieces]=useState<Piece[]>([]);
const [manual,setManualState]=useState<Piece>(emptyPiece);
  const [prompt,setPrompt]=useState("Completa las piezas faltantes enfocadas en ventas, experiencia y contenido útil.");
  async function load(){const b=await listBrands();const p=await listPieces();setBrands(b);setAll(p);if(!brandId&&b[0]?.id)setBrandId(b[0].id)}
  useEffect(()=>{load()},[]);
  const brand=brands.find(x=>x.id===brandId)||brands[0];
  const existing=brand?.id?all.filter(x=>x.brandId===brand.id).length:0;
  const missing=Math.max((brand?.posts||0)-existing,0);
  const progress=brand?.posts?Math.round((existing/(brand.posts))*100):0;
function setManual(k:keyof Piece,v:any){setManualState({...manual,[k]:v})}
  function fillBrandData(p:Piece){return {...p,brandId:brand?.id||"",brandName:brand?.name||"",total:brand?.posts||1,number:existing+1}}
  function generate(){
    if(!brand?.id)return alert("Primero crea o selecciona un cliente");
    if(missing===0)return alert("Este cliente ya tiene completo su paquete");
    const ideas=["Brunch dominical","Producto estrella","Testimonial de cliente","Behind the scenes","Oferta de temporada","Tips útiles","Experiencia del lugar","Preguntas frecuentes"];
    const n=Math.min(missing,8);
    setPieces(Array.from({length:n}).map((_,i)=>({brandId:brand.id!,brandName:brand.name,number:existing+i+1,total:brand.posts,format:formats[i%3],topic:ideas[i%ideas.length],goal:goals[i%goals.length],production:i<brand.productions,date:String(15+i)+" jun",state:"draft",assignee:"",keyMessage:"Mensaje principal pendiente de ajustar",cta:"Enviar WhatsApp",notes:prompt,source:"auto"})));
  }
  async function saveAuto(){if(!pieces.length)return alert("Genera propuestas primero");await savePieces(pieces);setPieces([]);await load();alert("Solicitudes guardadas")}
  async function saveManual(){
    if(!brand?.id)return alert("Selecciona cliente");
    if(!manual.topic)return alert("Agrega tema");
    await savePiece(fillBrandData({...manual,source:"manual"}));
    setManualState(emptyPiece);await load();alert("Solicitud manual guardada");
  }
  return <AppShell active="Planeador IA"><div className="page-title"><p className="eyebrow">Planeador IA</p><h1>Planeación mensual</h1><p>Usa generación automática o crea una solicitud manual.</p></div><section className="grid kpis">{[["Cliente",brand?.name||"Sin cliente"],["Paquete",String(brand?.posts||0)+" posts"],["Guardadas",String(existing)],["Faltan",String(missing)],["Producciones",String(brand?.productions||0)],["Avance",progress+"%"]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}</section><div className="card" style={{marginBottom:24}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><strong>Avance del paquete</strong><strong>{progress}%</strong></div><div className="progress"><div style={{width:progress+"%"}} /></div></div><div className="tabs"><button className={mode==="auto"?"tab active":"tab"} onClick={()=>setMode("auto")}>Automático</button><button className={mode==="manual"?"tab active":"tab"} onClick={()=>setMode("manual")}>Manual</button></div><section className="grid two-col"><div className="card"><h3>{mode==="auto"?"Generar con IA demo":"Crear solicitud manual"}</h3><div className="field"><label>Cliente</label><select value={brandId} onChange={e=>setBrandId(e.target.value)}>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>{mode==="auto"?<><div className="field"><label>Instrucción</label><textarea className="prompt" value={prompt} onChange={e=>setPrompt(e.target.value)}/></div><div className="shortcuts"><span className="chip">Completar faltantes</span><span className="chip">Ventas</span><span className="chip">Sin relleno</span></div><div style={{display:"flex",gap:12,marginTop:18}}><button className="btn blue" onClick={generate}>Generar propuestas</button><button className="btn" onClick={saveAuto}>Guardar propuestas</button></div></>:<><div className="form-grid"><div className="field"><label>Tipo</label><select value={manual.format} onChange={e=>setManual("format",e.target.value)}>{formats.map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label>Objetivo</label><select value={manual.goal} onChange={e=>setManual("goal",e.target.value)}>{goals.map(x=><option key={x}>{x}</option>)}</select></div><div className="field full"><label>Tema</label><input value={manual.topic} onChange={e=>setManual("topic",e.target.value)} placeholder="Ej. Reel de producto estrella"/></div><div className="field"><label>Fecha</label><input value={manual.date} onChange={e=>setManual("date",e.target.value)} placeholder="20 jun"/></div><div className="field"><label>Responsable</label><input value={manual.assignee||""} onChange={e=>setManual("assignee",e.target.value)} /></div><div className="field full"><label>Mensaje clave</label><textarea value={manual.keyMessage||""} onChange={e=>setManual("keyMessage",e.target.value)} /></div><div className="field"><label>CTA</label><input value={manual.cta||""} onChange={e=>setManual("cta",e.target.value)} /></div><div className="field"><label>Producción</label><select value={manual.production?"si":"no"} onChange={e=>setManual("production",e.target.value==="si")}><option value="no">No</option><option value="si">Sí</option></select></div></div><button className="btn blue" onClick={saveManual}>Guardar solicitud manual</button></>}</div><aside className="card"><h3>Reglas</h3><p>✓ Manual es opcional<br/>✓ Auto calcula faltantes<br/>✓ Ambas guardan en Firestore<br/>✓ Todo queda editable en Solicitudes</p></aside></section><section className="card" style={{marginTop:24}}><h3>Propuestas generadas</h3><div className="table-wrap"><table className="table"><thead><tr><th>#</th><th>Tipo</th><th>Tema</th><th>Objetivo</th><th>Prod.</th><th>CTA</th></tr></thead><tbody>{pieces.map(x=><tr key={x.number}><td>{x.number}/{x.total}</td><td>{x.format}</td><td>{x.topic}</td><td>{x.goal}</td><td><span className={x.production?"badge orange":"badge green"}>{x.production?"Sí":"No"}</span></td><td>{x.cta}</td></tr>)}</tbody></table></div></section></AppShell>
}
