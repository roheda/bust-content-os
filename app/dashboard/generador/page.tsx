"use client";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { buildGenerationPrompt } from "@/lib/build-generation-prompt";
import { Brand, ClientAsset, ContentRequest, GenerationRequest, listUniqueBrands, listClientAssets, listGenerationRequests, listRequests, saveGenerationRequest, updateGenerationRequest } from "@/lib/data";

type TextBlock = { id:string; text:string; role:string; priority:string; instruction:string; locked:boolean };
type RequestAttachment = { file: File; preview: string; name: string; role: string; notes: string };

const formats = [
  { id:"instagram-post", label:"Post Instagram 4:5" },
  { id:"instagram-story", label:"Story 9:16" },
  { id:"square-post", label:"Cuadrado 1:1" },
  { id:"reel-cover", label:"Portada de Reel" },
  { id:"ad-creative", label:"Creativo para pauta" }
];
const goals = [
  { id:"sell", label:"Vender" },
  { id:"inform", label:"Informar" },
  { id:"announce", label:"Anunciar" },
  { id:"position", label:"Posicionar marca" },
  { id:"interaction", label:"Generar interacción" },
  { id:"trust", label:"Dar confianza" }
];
const contentTypes = [
  { id:"promotion", label:"Promoción" },
  { id:"product", label:"Producto o servicio" },
  { id:"event", label:"Evento" },
  { id:"notice", label:"Aviso" },
  { id:"seasonal", label:"Fecha especial" },
  { id:"branding", label:"Contenido de marca" }
];
const roles = [
  { id:"headline", label:"Titular protagonista" },
  { id:"subheadline", label:"Frase secundaria" },
  { id:"claim", label:"Claim / frase de campaña" },
  { id:"badge", label:"Sello / badge" },
  { id:"bullet", label:"Bullet" },
  { id:"price", label:"Precio" },
  { id:"promotion", label:"Promoción" },
  { id:"cta", label:"CTA" },
  { id:"date", label:"Fecha" },
  { id:"location", label:"Ubicación" },
  { id:"disclaimer", label:"Disclaimer" },
  { id:"free", label:"Texto libre" }
];
const priorities = [{id:"high",label:"Alta"},{id:"medium",label:"Media"},{id:"low",label:"Baja"}];
const emotions = ["Premium","Urgente","Elegante","Comercial","Tecnológico","Cercano","Apetitoso","Familiar","Sofisticado","Divertido"];
const visualElements = ["Producto","Persona","Ambiente","Local o espacio","Precio","Fecha","CTA","Fondo limpio","Textura o patrón de marca"];
const supportedModels = [
  { id:"draft-mini-low", label:"Borrador económico · GPT Image Mini" },
  { id:"nano-banana", label:"Calidad para redes · Nano Banana" },
  { id:"gpt-image", label:"GPT Image estándar" },
  { id:"gemini-3-pro-image", label:"Gemini Pro Imagen" },
  { id:"gemini-3.1-flash-image", label:"Gemini 3.1 Flash" },
  { id:"gemini-2.5-flash-image", label:"Gemini 2.5 Flash" }
];
const attachmentRoles = [
  { id:"producto-principal", label:"Producto principal" },
  { id:"platillo-principal", label:"Platillo principal" },
  { id:"referencia-visual", label:"Referencia visual" },
  { id:"fondo-ambiente", label:"Fondo / ambiente" },
  { id:"promocion", label:"Promoción" }
];
const logoPositions = [
  { id:"top-left", label:"Arriba izquierda" },
  { id:"top-right", label:"Arriba derecha" },
  { id:"bottom-left", label:"Abajo izquierda" },
  { id:"bottom-right", label:"Abajo derecha" },
  { id:"bottom-center", label:"Centro inferior" }
];
const logoSizes = [{id:"small",label:"Chico"},{id:"medium",label:"Mediano"},{id:"large",label:"Grande"}];

function emptyBlock():TextBlock { return { id:`text-block-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, text:"", role:"headline", priority:"high", instruction:"", locked:true }; }
function isImage(asset:ClientAsset){ const p = `${asset.fileUrl} ${asset.storagePath||""}`.toLowerCase(); return (asset.mimeType||"").startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(p) || p.includes("firebasestorage.googleapis.com"); }
function isLogo(asset:ClientAsset){ const v = `${asset.type} ${asset.category} ${(asset.tags||[]).join(" ")}`.toLowerCase(); return isImage(asset) && (v.includes("logo") || v.includes("logotipo")); }
function formatStatus(status:string){ return status==="completed"?"Generado":status==="generating"?"Generando":status==="error"?"Error":status==="saving_assets"?"Guardando":"Brief listo"; }

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
  const [selectedModel,setSelectedModel]=useState("draft-mini-low");
  const [variantCount,setVariantCount]=useState(1);
  const [attachment,setAttachment]=useState<RequestAttachment|null>(null);
  const [logoOverlayEnabled,setLogoOverlayEnabled]=useState(false);
  const [selectedLogoAssetId,setSelectedLogoAssetId]=useState("");
  const [logoPosition,setLogoPosition]=useState("bottom-right");
  const [logoSize,setLogoSize]=useState("medium");
  const [prompt,setPrompt]=useState("");
  const [generatedImages,setGeneratedImages]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [clientFilter,setClientFilter]=useState("all");

  async function load(){
    const [c,r,h]=await Promise.all([listUniqueBrands(),listRequests(),listGenerationRequests()]);
    setClients(c.filter(x=>(x.status||"active")!=="deleted").sort((a,b)=>a.name.localeCompare(b.name,"es")));
    setRequests(r.filter(x=>x.status!=="eliminada"));
    setHistory(h);
  }
  useEffect(()=>{load()},[]);
  useEffect(()=>{ if(clientId){ listClientAssets(clientId).then((rows)=>{ const sorted=[...rows].sort((a,b)=>Number(b.isFeatured)-Number(a.isFeatured)); setAssets(sorted); setSelectedAssetIds(sorted.filter(a=>a.isFeatured && !isLogo(a)).map(a=>a.id||"")); const firstLogo=sorted.find(isLogo); if(firstLogo)setSelectedLogoAssetId(firstLogo.id||""); }); } else { setAssets([]); setSelectedAssetIds([]); } },[clientId]);

  const client=clients.find(c=>c.id===clientId);
  const selectedAssets=assets.filter(a=>selectedAssetIds.includes(a.id||""));
  const logoAssets=assets.filter(isLogo);
  const sentTasks=useMemo(()=>requests.filter(x=>Boolean(x.generatorStatus)&&(clientFilter==="all"||x.clientId===clientFilter)),[requests,clientFilter]);
  const filteredHistory=useMemo(()=>history.filter(x=>clientFilter==="all"||x.clientId===clientFilter),[history,clientFilter]);

  function toggle(value:string, arr:string[], set:(v:string[])=>void){ set(arr.includes(value)?arr.filter(x=>x!==value):[...arr,value]); }
  function updateBlock(id:string, patch:Partial<TextBlock>){ setTextBlocks(blocks=>blocks.map(block=>block.id===id?{...block,...patch}:block)); }
  function cleanBlocks(){ return textBlocks.filter(block=>block.text.trim()).map(block=>({...block,text:block.text.trim(),instruction:block.instruction.trim()})); }

  function loadTask(task:ContentRequest){
    setClientId(task.clientId);
    setMainMessage(task.creativeIdea || task.keyMessage || task.topic || "");
    setTextBlocks([{...emptyBlock(),text:task.copyOut || task.copyIn || task.keyMessage || "",role:"headline",priority:"high"}]);
    setSpecificInstructions(`Viene de Content OS. Cliente: ${task.clientName}. Lote: ${task.batchName||"Sin lote"}. CTA: ${task.cta||""}`);
    setTab("brief");
  }

  function handleAttachment(event:ChangeEvent<HTMLInputElement>){
    const file = event.target.files?.[0] || null;
    if(!file){ setAttachment(null); return; }
    if(!file.type.startsWith("image/")){ setError("La referencia puntual debe ser una imagen PNG, JPG o WEBP."); return; }
    setAttachment({file,preview:URL.createObjectURL(file),name:file.name,role:"producto-principal",notes:""});
  }

  function buildPrompt(){
    const logoAsset=assets.find(a=>a.id===selectedLogoAssetId);
    const built = buildGenerationPrompt({
      clientName:client?.name,
      clientIndustry:client?.industry,
      format, goal, contentType, mainMessage,
      textBlocks:cleanBlocks(),
      selectedEmotions,
      selectedVisualElements,
      specificInstructions,
      brandBrainSnapshot:client?.brandBrain || {brandDescription:client?.brandNotes,tone:client?.tone,visualStyle:client?.visualStyle?[client.visualStyle]:[],dos:client?.contentPillars?[client.contentPillars]:[]},
      selectedAssetsSnapshot:selectedAssets,
      requestAttachments: attachment ? [{name:attachment.name,role:attachment.role,notes:attachment.notes,fileUrl:attachment.preview,mimeType:attachment.file.type}] : [],
      logoOverlay: logoOverlayEnabled ? {enabled:true,assetId:selectedLogoAssetId,assetName:logoAsset?.name,fileUrl:logoAsset?.fileUrl,position:logoPosition,size:logoSize} : {enabled:false}
    });
    setPrompt(built);
    return built;
  }

  async function saveBriefOnly(status="brief_ready"){
    if(!client)return alert("Selecciona un cliente.");
    if(!mainMessage.trim())return alert("Escribe el mensaje principal.");
    if(cleanBlocks().length===0)return alert("Agrega al menos un bloque de texto.");
    const built=buildPrompt();
    const ref:any = await saveGenerationRequest({
      clientId:client.id!,clientName:client.name,clientIndustry:client.industry,
      mainMessage:mainMessage.trim(),format,goal,contentType,
      selectedEmotions,selectedVisualElements,specificInstructions:specificInstructions.trim(),
      textBlocks:cleanBlocks(),selectedAssetIds,selectedAssetsSnapshot:selectedAssets,
      brandBrainSnapshot:client.brandBrain,logoOverlay:{enabled:logoOverlayEnabled,assetId:selectedLogoAssetId,position:logoPosition,size:logoSize},
      generatedPrompt:built,executedModel:selectedModel,status
    });
    setSuccess("Brief guardado en historial.");
    await load();
    return ref?.id || "";
  }

  async function generate(){
    setError("");setSuccess("");setGeneratedImages([]);
    if(!client)return alert("Selecciona un cliente.");
    setLoading(true);
    let requestId="";
    try{
      requestId = await saveBriefOnly("generating") || "";
      const built = prompt || buildPrompt();
      const response = await fetch("/api/generate-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:built,format,model:selectedModel,variantCount,referenceImages:selectedAssets.map(a=>({url:a.fileUrl,name:a.name}))})});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"No se pudo generar imagen.");
      setGeneratedImages(payload.imagesBase64||[]);
      if(requestId)await updateGenerationRequest(requestId,{status:"completed",executedModel:payload.executedModel,generationMode:payload.generationMode});
      setSuccess("Imagen generada correctamente.");
      await load();
    }catch(e){
      setError(e instanceof Error ? e.message : "Error al generar.");
      if(requestId)await updateGenerationRequest(requestId,{status:"error"});
    }finally{setLoading(false);}
  }

  return <AppShell active="BUST It Now">
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="rounded-[2rem] bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-300/60 sm:p-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-zinc-400">BUST IT NOW</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Generador de piezas</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">Mismo flujo real: Brand Brain, bloques del cliente, assets destacados, referencia puntual, logo overlay, historial y generación.</p>
        </header>

        <nav className="flex flex-wrap gap-2">
          {[["brief","Generador / Brief"],["tareas","Solicitudes desde Tareas"],["historial","Historial"],["mapa","Integración"]].map(([id,label])=><button key={id} type="button" onClick={()=>setTab(id as any)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab===id?"bg-zinc-950 text-white":"border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950"}`}>{label}</button>)}
        </nav>

        {tab==="brief" ? <>
          <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Historial</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Briefs recientes</h2></div>
              <button type="button" onClick={load} className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50">Actualizar historial</button>
            </div>
            {history.length===0 ? <div className="mt-5 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-600">Todavía no hay briefs guardados.</div> : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {history.slice(-8).reverse().map((request)=><button key={request.id} type="button" onClick={()=>{setClientId(request.clientId);setMainMessage(request.mainMessage);setFormat(request.format);setGoal(request.goal);setContentType(request.contentType);setTextBlocks((request.textBlocks as any)||[emptyBlock()]);setSelectedEmotions(request.selectedEmotions||[]);setSelectedVisualElements(request.selectedVisualElements||[]);setSpecificInstructions(request.specificInstructions||"");setPrompt(request.generatedPrompt||"");}} className="group rounded-3xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white hover:shadow-lg hover:shadow-zinc-200/60">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-zinc-950">{request.clientName}</p><p className="mt-1 line-clamp-3 text-xs leading-5 text-zinc-600">{request.mainMessage}</p></div><span className="rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">{formatStatus(request.status)}</span></div>
                <p className="mt-4 text-xs font-medium text-zinc-500">{request.format || "Formato"} · {request.contentType || "Contenido"}</p>
              </button>)}
            </div>}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6 rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
              <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">1. Selecciona la marca</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Contexto automático del cliente</h2></div>
              <select value={clientId} onChange={(e)=>setClientId(e.target.value)} className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-base outline-none transition focus:border-zinc-950 focus:bg-white"><option value="">Selecciona un cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
              {client ? <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Cliente</p><p className="mt-2 text-lg font-semibold text-zinc-950">{client.name}</p><p className="mt-1 text-sm text-zinc-600">{client.industry||"Sin categoría"}</p></div> : null}

              <div className="border-t border-zinc-200 pt-6"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">2. Define la pieza</p><div className="mt-5 grid gap-5 md:grid-cols-3">
                <FieldSelect label="Formato" value={format} onChange={setFormat} options={formats}/>
                <FieldSelect label="Objetivo" value={goal} onChange={setGoal} options={goals}/>
                <FieldSelect label="Tipo de contenido" value={contentType} onChange={setContentType} options={contentTypes}/>
                <FieldSelect label="Modelo" value={selectedModel} onChange={setSelectedModel} options={supportedModels}/>
                <FieldSelect label="Variantes" value={String(variantCount)} onChange={(v)=>setVariantCount(Number(v))} options={[{id:"1",label:"1 variante"},{id:"2",label:"2 variantes"},{id:"4",label:"4 variantes"}]}/>
              </div></div>

              <div className="space-y-2"><label className="text-sm font-medium text-zinc-800">Mensaje principal</label><textarea value={mainMessage} onChange={(e)=>setMainMessage(e.target.value)} className="min-h-28 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-950 focus:bg-white"/></div>

              <div className="border-t border-zinc-200 pt-6">
                <div className="flex justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">3. Textos oficiales</p><h3 className="mt-2 text-xl font-semibold">Bloques de texto</h3></div><button type="button" onClick={()=>setTextBlocks([...textBlocks,emptyBlock()])} className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold transition hover:bg-zinc-50">Agregar bloque</button></div>
                <div className="mt-5 space-y-4">
                  {textBlocks.map((block)=><div key={block.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4"><textarea value={block.text} onChange={(e)=>updateBlock(block.id,{text:e.target.value})} className="min-h-20 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-950" placeholder="Texto exacto que debe aparecer"/>
                    <div className="mt-3 grid gap-3 md:grid-cols-3"><FieldSelect label="Rol visual" value={block.role} onChange={(v)=>updateBlock(block.id,{role:v})} options={roles}/><FieldSelect label="Prioridad" value={block.priority} onChange={(v)=>updateBlock(block.id,{priority:v})} options={priorities}/><button type="button" onClick={()=>setTextBlocks(textBlocks.length>1?textBlocks.filter(x=>x.id!==block.id):[emptyBlock()])} className="mt-6 h-11 rounded-2xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50">Eliminar</button></div>
                    <input value={block.instruction} onChange={(e)=>updateBlock(block.id,{instruction:e.target.value})} className="mt-3 h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-950" placeholder="Instrucción específica para este texto"/>
                  </div>)}
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-6"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">4. Dirección visual</p>
                <ChipGroup values={emotions} selected={selectedEmotions} onToggle={(v)=>toggle(v,selectedEmotions,setSelectedEmotions)} />
                <ChipGroup values={visualElements} selected={selectedVisualElements} onToggle={(v)=>toggle(v,selectedVisualElements,setSelectedVisualElements)} />
                <textarea value={specificInstructions} onChange={(e)=>setSpecificInstructions(e.target.value)} className="mt-5 min-h-24 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-950 focus:bg-white" placeholder="Instrucciones específicas"/>
              </div>

              <div className="border-t border-zinc-200 pt-6"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">5. Referencia puntual</p>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAttachment} className="mt-4 block w-full text-sm"/>
                {attachment ? <div className="mt-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-4"><img src={attachment.preview} alt={attachment.name} className="h-44 w-full rounded-2xl object-cover"/><div className="mt-3 grid gap-3 md:grid-cols-2"><input value={attachment.name} onChange={(e)=>setAttachment({...attachment,name:e.target.value})} className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"/><FieldSelect label="Rol" value={attachment.role} onChange={(v)=>setAttachment({...attachment,role:v})} options={attachmentRoles}/></div><textarea value={attachment.notes} onChange={(e)=>setAttachment({...attachment,notes:e.target.value})} className="mt-3 min-h-20 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm" placeholder="Notas de uso"/></div> : null}
              </div>
            </div>

            <aside className="space-y-6">
              <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Brand Brain</p><div className="mt-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-5 text-sm leading-6 text-zinc-700"><strong>{client?.name || "Selecciona cliente"}</strong><br/>Tono: {client?.brandBrain?.tone || client?.tone || "Pendiente"}<br/>Colores: {(client?.brandBrain?.colors||[]).join(", ") || "Pendiente"}<br/>Tipografía: {client?.brandBrain?.typography || "Pendiente"}<br/>Assets: {assets.length}</div></section>

              <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Assets seleccionados</p>
                {assets.length===0 ? <p className="mt-4 text-sm text-zinc-500">Selecciona cliente para ver assets.</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{assets.map(asset=><button type="button" key={asset.id} onClick={()=>toggle(asset.id||"",selectedAssetIds,setSelectedAssetIds)} className={`rounded-3xl border p-3 text-left transition ${selectedAssetIds.includes(asset.id||"")?"border-zinc-950 bg-zinc-950 text-white":"border-zinc-200 bg-zinc-50 hover:border-zinc-400"}`}>{isImage(asset)?<img src={asset.fileUrl} alt={asset.name} className="mb-3 h-28 w-full rounded-2xl object-cover"/>:null}<strong className="text-xs">{asset.name}</strong><p className="mt-1 text-[11px] opacity-70">{asset.type} · {asset.isFeatured?"Destacado":"Normal"}</p></button>)}</div>}
                <div className="mt-6 border-t border-zinc-200 pt-5"><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={logoOverlayEnabled} onChange={(e)=>setLogoOverlayEnabled(e.target.checked)}/> Logo overlay fijo</label>{logoOverlayEnabled?<div className="mt-4 grid gap-3"><FieldSelect label="Logo" value={selectedLogoAssetId} onChange={setSelectedLogoAssetId} options={logoAssets.map(a=>({id:a.id||"",label:a.name}))}/><FieldSelect label="Posición" value={logoPosition} onChange={setLogoPosition} options={logoPositions}/><FieldSelect label="Tamaño" value={logoSize} onChange={setLogoSize} options={logoSizes}/></div>:null}</div>
              </section>

              <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Acciones</p>
                <div className="mt-5 grid gap-3"><button type="button" onClick={buildPrompt} className="h-12 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-50">Construir prompt</button><button type="button" onClick={()=>saveBriefOnly()} className="h-12 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-50">Guardar brief</button><button type="button" onClick={generate} disabled={loading} className="h-12 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-400">{loading?"Generando...":"Generar imagen"}</button></div>
                {error?<div className="mt-5 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">{error}</div>:null}{success?<div className="mt-5 rounded-3xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-medium text-green-700">{success}</div>:null}
              </section>
            </aside>
          </section>

          {prompt?<section className="rounded-[2rem] border border-zinc-200 bg-zinc-950 p-6 text-white shadow-sm sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Prompt construido</p><pre className="mt-5 max-h-[460px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-zinc-200">{prompt}</pre></section>:null}
          {generatedImages.length>0?<section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-semibold tracking-tight">Imágenes generadas</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{generatedImages.map((img,i)=><article key={i} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4"><img src={`data:image/png;base64,${img}`} alt={`Generada ${i+1}`} className="w-full rounded-2xl"/><a download={`bust-it-now-${i+1}.png`} href={`data:image/png;base64,${img}`} className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white">Descargar</a></article>)}</div></section>:null}
        </> : null}

        {tab==="tareas"?<section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-semibold tracking-tight">Solicitudes enviadas desde Tareas</h2><select value={clientFilter} onChange={(e)=>setClientFilter(e.target.value)} className="mt-5 h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"><option value="all">Todos los clientes</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="mt-5 grid gap-4 md:grid-cols-2">{sentTasks.map(task=><article key={task.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5"><strong>{task.clientName} · {task.contentType}</strong><p className="mt-2 text-sm text-zinc-600">Lote: {task.batchName||"Sin lote"} · Estado: {task.generatorStatus}</p><p className="mt-3 text-sm leading-6 text-zinc-700">{task.creativeIdea}</p><button type="button" onClick={()=>loadTask(task)} className="mt-4 rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">Abrir en generador</button></article>)}</div>{!sentTasks.length?<p className="mt-5 text-sm text-zinc-500">No hay solicitudes enviadas desde Tareas.</p>:null}</section>:null}

        {tab==="historial"?<section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-semibold tracking-tight">Historial</h2><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredHistory.map(item=><article key={item.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5"><span className="rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">{formatStatus(item.status)}</span><strong className="mt-4 block">{item.clientName}</strong><p className="mt-2 text-sm text-zinc-600">{item.mainMessage}</p><button type="button" onClick={()=>{setClientId(item.clientId);setMainMessage(item.mainMessage);setFormat(item.format);setGoal(item.goal);setContentType(item.contentType);setTextBlocks((item.textBlocks as any)||[emptyBlock()]);setSelectedEmotions(item.selectedEmotions||[]);setSelectedVisualElements(item.selectedVisualElements||[]);setSpecificInstructions(item.specificInstructions||"");setPrompt(item.generatedPrompt||"");setTab("brief");}} className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold">Reusar / editar</button></article>)}</div></section>:null}

        {tab==="mapa"?<section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-semibold tracking-tight">Integración real</h2><div className="mt-5 grid gap-4 md:grid-cols-4"><Info title="clients.brandBrain" text="Memoria de marca real."/><Info title="clientAssets" text="Assets con metadata múltiple."/><Info title="generationRequests" text="Briefs, historial y prompts."/><Info title="contentRequests" text="Solicitudes desde Tareas."/></div></section>:null}
      </div>
    </main>
  </AppShell>;
}

function FieldSelect({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:{id:string;label:string}[]}){
  return <div className="space-y-2"><label className="text-sm font-medium text-zinc-800">{label}</label><select value={value} onChange={(e)=>onChange(e.target.value)} className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none transition focus:border-zinc-950 focus:bg-white">{options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
}
function ChipGroup({values,selected,onToggle}:{values:string[];selected:string[];onToggle:(v:string)=>void}){
  return <div className="mt-4 flex flex-wrap gap-2">{values.map(value=><button type="button" key={value} onClick={()=>onToggle(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${selected.includes(value)?"bg-zinc-950 text-white":"border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950"}`}>{value}</button>)}</div>
}
function Info({title,text}:{title:string;text:string}){ return <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5"><strong>{title}</strong><p className="mt-2 text-sm text-zinc-600">{text}</p></div>; }
