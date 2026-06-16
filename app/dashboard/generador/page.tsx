"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { buildGenerationPrompt } from "@/lib/build-generation-prompt";
import { Brand, ClientAsset, ContentRequest, GenerationRequest, listBrands, listClientAssets, listGenerationRequests, listRequests, saveGenerationRequest, updateGenerationRequest } from "@/lib/data";

type TextBlock={id:string;text:string;role:string;priority:string;instruction:string;locked:boolean};
const formats=[["instagram-post","Post Instagram 4:5"],["instagram-story","Story 9:16"],["square-post","Cuadrado 1:1"],["reel-cover","Portada de Reel"],["ad-creative","Creativo para pauta"]];
const roles=[["headline","Titular"],["subheadline","Subtítulo"],["claim","Claim"],["price","Precio"],["promotion","Promoción"],["cta","CTA"],["date","Fecha"],["free","Libre"]];
const priorities=[["high","Alta"],["medium","Media"],["low","Baja"]];
const emotions=["Premium","Urgente","Elegante","Comercial","Tecnológico","Cercano","Apetitoso","Familiar","Sofisticado","Divertido"];
const visualElements=["Producto","Persona","Ambiente","Local o espacio","Precio","Fecha","CTA","Fondo limpio","Textura o patrón de marca"];
function emptyBlock():TextBlock{return{id:`tb-${Date.now()}-${Math.random().toString(36).slice(2)}`,text:"",role:"headline",priority:"high",instruction:"",locked:true}}
function isImg(a:ClientAsset){return (a.mimeType||"").startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(a.fileUrl||"")}

export default function BustItNowPage(){
  const [tab,setTab]=useState<"brief"|"tareas"|"historial"|"mapa">("brief");
  const [clients,setClients]=useState<Brand[]>([]);
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [history,setHistory]=useState<GenerationRequest[]>([]);
  const [assets,setAssets]=useState<ClientAsset[]>([]);
  const [clientId,setClientId]=useState("");
  const [format,setFormat]=useState("instagram-post");
  const [goal,setGoal]=useState("sell");
  const [contentType,setContentType]=useState("promotion");
  const [mainMessage,setMainMessage]=useState("");
  const [textBlocks,setTextBlocks]=useState<TextBlock[]>([emptyBlock()]);
  const [selectedEmotions,setSelectedEmotions]=useState<string[]>([]);
  const [selectedVisualElements,setSelectedVisualElements]=useState<string[]>([]);
  const [specificInstructions,setSpecificInstructions]=useState("");
  const [selectedAssetIds,setSelectedAssetIds]=useState<string[]>([]);
  const [logoOverlay,setLogoOverlay]=useState(false);
  const [model,setModel]=useState("gemini-3-pro-image");
  const [variantCount,setVariantCount]=useState(1);
  const [prompt,setPrompt]=useState("");
  const [generatedImages,setGeneratedImages]=useState<string[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [clientFilter,setClientFilter]=useState("all");

  async function load(){const[c,r,h]=await Promise.all([listBrands(),listRequests(),listGenerationRequests()]);setClients(c.filter(x=>(x.status||"active")!=="deleted"));setRequests(r.filter(x=>x.status!=="eliminada"));setHistory(h)}
  useEffect(()=>{load()},[]);
  useEffect(()=>{if(clientId)listClientAssets(clientId).then(setAssets);else setAssets([])},[clientId]);
  const client=clients.find(x=>x.id===clientId);
  const selectedAssets=assets.filter(x=>selectedAssetIds.includes(x.id||""));
  const sentTasks=useMemo(()=>requests.filter(x=>Boolean(x.generatorStatus)&&(clientFilter==="all"||x.clientId===clientFilter)),[requests,clientFilter]);
  const filteredHistory=useMemo(()=>history.filter(x=>clientFilter==="all"||x.clientId===clientFilter),[history,clientFilter]);

  function toggle(v:string,arr:string[],set:(x:string[])=>void){set(arr.includes(v)?arr.filter(x=>x!==v):[...arr,v])}
  function updateBlock(id:string,patch:Partial<TextBlock>){setTextBlocks(textBlocks.map(x=>x.id===id?{...x,...patch}:x))}
  function loadTask(task:ContentRequest){setClientId(task.clientId);setMainMessage(task.creativeIdea||task.keyMessage||task.topic||"");setTextBlocks([{...emptyBlock(),text:task.copyOut||task.copyIn||task.keyMessage||"",role:"headline",priority:"high"}]);setSpecificInstructions(`Viene de Content OS. Cliente: ${task.clientName}. Lote: ${task.batchName||"Sin lote"}. CTA: ${task.cta||""}`);setTab("brief")}

  function buildPrompt(){
    const built=buildGenerationPrompt({clientName:client?.name,clientIndustry:client?.industry,format,goal,contentType,mainMessage,textBlocks:textBlocks.filter(x=>x.text.trim()),selectedEmotions,selectedVisualElements,specificInstructions,brandBrainSnapshot:client?.brandBrain||{brandDescription:client?.brandNotes,tone:client?.tone,visualStyle:client?.visualStyle?[client.visualStyle]:[],dos:client?.contentPillars?[client.contentPillars]:[]},selectedAssetsSnapshot:selectedAssets,logoOverlay:{enabled:logoOverlay,position:"bottom-right",size:"medium"}});
    setPrompt(built);return built;
  }

  async function generate(){
    if(!client)return alert("Selecciona cliente.");
    const built=buildPrompt();setError("");setLoading(true);setGeneratedImages([]);
    let reqId="";
    try{
      const ref:any=await saveGenerationRequest({clientId:client.id!,clientName:client.name,clientIndustry:client.industry,mainMessage,format,goal,contentType,selectedEmotions,selectedVisualElements,specificInstructions,textBlocks:textBlocks.filter(x=>x.text.trim()),selectedAssetIds,selectedAssetsSnapshot:selectedAssets,brandBrainSnapshot:client.brandBrain,logoOverlay:{enabled:logoOverlay,position:"bottom-right",size:"medium"},generatedPrompt:built,executedModel:model,status:"generating"});
      reqId=ref.id;
      const res=await fetch("/api/generate-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:built,format,model,variantCount,referenceImages:selectedAssets.map(x=>({url:x.fileUrl,name:x.name}))})});
      const payload=await res.json(); if(!res.ok)throw new Error(payload.error||"No se pudo generar.");
      setGeneratedImages(payload.imagesBase64||[]); if(reqId)await updateGenerationRequest(reqId,{status:"completed",executedModel:payload.executedModel,generationMode:payload.generationMode}); await load();
    }catch(e){setError(e instanceof Error?e.message:"Error al generar."); if(reqId)await updateGenerationRequest(reqId,{status:"error"})}finally{setLoading(false)}
  }

  return <AppShell active="BUST It Now">
    <section className="hero"><div><p className="eyebrow">BUST It Now real</p><h1>BUST It Now</h1><p>Brand Brain + Assets + Brief + Generación + Historial, dentro de BUST Content OS.</p></div></section>
    <div className="bitnow-exact-tabs"><button className={tab==="brief"?"active":""} onClick={()=>setTab("brief")}>Generador / Brief</button><button className={tab==="tareas"?"active":""} onClick={()=>setTab("tareas")}>Solicitudes desde Tareas</button><button className={tab==="historial"?"active":""} onClick={()=>setTab("historial")}>Historial</button><button className={tab==="mapa"?"active":""} onClick={()=>setTab("mapa")}>Integración</button></div>

    {tab==="brief"&&<section className="studio-grid"><div className="studio-panel">
      <h3>Brief de generación</h3>
      <div className="form-grid"><div className="field"><label>Cliente</label><select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Selecciona cliente</option>{clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></div><div className="field"><label>Formato</label><select value={format} onChange={e=>setFormat(e.target.value)}>{formats.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div><div className="field"><label>Objetivo</label><select value={goal} onChange={e=>setGoal(e.target.value)}><option value="sell">Vender</option><option value="inform">Informar</option><option value="announce">Anunciar</option><option value="position">Posicionar</option><option value="trust">Confianza</option></select></div><div className="field"><label>Tipo</label><select value={contentType} onChange={e=>setContentType(e.target.value)}><option value="promotion">Promoción</option><option value="product">Producto</option><option value="event">Evento</option><option value="notice">Aviso</option><option value="branding">Marca</option></select></div><div className="field"><label>Modelo</label><select value={model} onChange={e=>setModel(e.target.value)}><option value="gemini-3-pro-image">Gemini Pro Imagen</option><option value="gemini-3.1-flash-image">Gemini 3.1 Flash</option><option value="gemini-2.5-flash-image">Gemini 2.5 Flash</option></select></div><div className="field"><label>Variantes</label><select value={variantCount} onChange={e=>setVariantCount(Number(e.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={4}>4</option></select></div></div>
      <div className="field"><label>Mensaje principal</label><textarea value={mainMessage} onChange={e=>setMainMessage(e.target.value)}/></div>
      <h4>Textos oficiales</h4>{textBlocks.map(block=><div className="textblock-row" key={block.id}><textarea value={block.text} onChange={e=>updateBlock(block.id,{text:e.target.value})}/><div className="form-grid"><select value={block.role} onChange={e=>updateBlock(block.id,{role:e.target.value})}>{roles.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><select value={block.priority} onChange={e=>updateBlock(block.id,{priority:e.target.value})}>{priorities.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><button className="btn red" onClick={()=>setTextBlocks(textBlocks.filter(x=>x.id!==block.id))}>Eliminar</button></div><input value={block.instruction} onChange={e=>updateBlock(block.id,{instruction:e.target.value})} placeholder="Instrucción específica"/></div>)}<button className="btn" onClick={()=>setTextBlocks([...textBlocks,{...emptyBlock()}])}>Agregar texto</button>
      <div className="field"><label>Emociones</label><div className="client-system-pills">{emotions.map(x=><button type="button" className={selectedEmotions.includes(x)?"btn blue":"btn"} key={x} onClick={()=>toggle(x,selectedEmotions,setSelectedEmotions)}>{x}</button>)}</div></div>
      <div className="field"><label>Elementos visuales</label><div className="client-system-pills">{visualElements.map(x=><button type="button" className={selectedVisualElements.includes(x)?"btn blue":"btn"} key={x} onClick={()=>toggle(x,selectedVisualElements,setSelectedVisualElements)}>{x}</button>)}</div></div>
      <div className="field"><label>Instrucciones específicas</label><textarea value={specificInstructions} onChange={e=>setSpecificInstructions(e.target.value)}/></div>
      <h4>Assets del cliente</h4>{!clientId?<p className="mini">Selecciona cliente para ver assets.</p>:<div className="asset-grid">{assets.map(asset=><button className={`asset-select-card ${selectedAssetIds.includes(asset.id||"")?"selected":""}`} key={asset.id} onClick={()=>toggle(asset.id||"",selectedAssetIds,setSelectedAssetIds)}>{isImg(asset)?<img src={asset.fileUrl} alt={asset.name}/>:<div className="file-box">Asset</div>}<strong>{asset.name}</strong><span className="mini">{asset.type} · {asset.isFeatured?"Destacado":"Normal"}</span></button>)}</div>}
      <div className="field"><label>Logo overlay</label><button className={logoOverlay?"btn blue":"btn"} onClick={()=>setLogoOverlay(!logoOverlay)}>{logoOverlay?"Activo":"Inactivo"}</button></div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="btn" onClick={buildPrompt}>Construir prompt</button><button className="btn blue" onClick={generate} disabled={loading}>{loading?"Generando...":"Generar imagen"}</button></div>
      {error&&<div className="reason-box">{error}</div>}{generatedImages.length>0&&<div className="generated-grid">{generatedImages.map((img,i)=><div className="generated-image-card" key={i}><img src={`data:image/png;base64,${img}`} alt={`Generada ${i+1}`}/><a className="btn" download={`bust-it-now-${i+1}.png`} href={`data:image/png;base64,${img}`}>Descargar</a></div>)}</div>}
      </div><aside className="studio-panel"><h3>Brand Brain leído</h3><div className="detail-copy"><strong>Cliente:</strong> {client?.name||"Pendiente"}{"\n"}<strong>Giro:</strong> {client?.industry||"Pendiente"}{"\n"}<strong>Tono:</strong> {client?.brandBrain?.tone||client?.tone||"Pendiente"}{"\n"}<strong>Colores:</strong> {(client?.brandBrain?.colors||[]).join(", ")||"Pendiente"}{"\n"}<strong>Tipografía:</strong> {client?.brandBrain?.typography||"Pendiente"}{"\n"}<strong>Assets:</strong> {assets.length}</div><h3>Prompt construido</h3><pre className="prompt-preview">{prompt||"Construye el prompt para verlo aquí."}</pre></aside></section>}

    {tab==="tareas"&&<section className="report-section"><h3>Solicitudes enviadas desde Tareas</h3><select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}><option value="all">Todos los clientes</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{sentTasks.map(task=><div className="bitnow-card" key={task.id}><strong>{task.clientName} · {task.contentType}</strong><p className="mini">Lote: {task.batchName||"Sin lote"} · Estado: {task.generatorStatus}</p><div className="detail-copy">{task.creativeIdea}</div><button className="btn blue" onClick={()=>loadTask(task)}>Abrir en generador</button></div>)}{!sentTasks.length&&<p className="mini">No hay solicitudes enviadas desde Tareas.</p>}</section>}
    {tab==="historial"&&<section className="report-section"><h3>Historial de briefs y generaciones</h3><select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}><option value="all">Todos los clientes</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="history-grid">{filteredHistory.map(item=><div className="history-card" key={item.id}><span className="generator-badge">{item.status}</span><strong>{item.clientName}</strong><p>{item.mainMessage}</p><p className="mini">{item.format} · {item.contentType} · {item.executedModel||"Sin modelo"}</p><button className="btn" onClick={()=>{setClientId(item.clientId);setMainMessage(item.mainMessage);setFormat(item.format);setGoal(item.goal);setContentType(item.contentType);setTextBlocks((item.textBlocks as any)||[emptyBlock()]);setSelectedEmotions(item.selectedEmotions||[]);setSelectedVisualElements(item.selectedVisualElements||[]);setSpecificInstructions(item.specificInstructions||"");setPrompt(item.generatedPrompt||"");setTab("brief")}}>Reusar / editar</button></div>)}</div>{!filteredHistory.length&&<p className="mini">No hay briefs en historial.</p>}</section>}
    {tab==="mapa"&&<section className="report-section"><h3>Mapa real de integración BUST It Now</h3><div className="platform-map"><div className="platform-node"><strong>clients.brandBrain</strong><span>Memoria estratégica de marca.</span></div><div className="platform-node"><strong>clientAssets</strong><span>Logos, referencias, productos y stock aprobado.</span></div><div className="platform-node"><strong>generationRequests</strong><span>Briefs, prompt, assets usados y estado.</span></div><div className="platform-node"><strong>contentRequests</strong><span>Solicitudes enviadas desde Tareas para afinar en el generador.</span></div></div></section>}
  </AppShell>
}
