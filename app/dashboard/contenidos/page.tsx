"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import TextTooltip from "@/components/TextTooltip";
import { ContentRequest, TaskComment, deleteStorageFiles, listRequests, subscribeRequests, updateRequest } from "@/lib/data";

type SortKey = "client"|"task"|"type"|"platforms"|"copyOut"|"publishDate"|"link"|"status";

export default function ContenidosPage(){
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [copyOutDrafts,setCopyOutDrafts]=useState<Record<string,string>>({});
  const [improvingCopyId,setImprovingCopyId]=useState<string|null>(null);
  const [bulkImproving,setBulkImproving]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);
  const [copiedId,setCopiedId]=useState<string|null>(null);

  const [clientFilter,setClientFilter]=useState("all");
  const [batchFilter,setBatchFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("pending");
  const [search,setSearch]=useState("");
  const [sortKey,setSortKey]=useState<SortKey>("publishDate");
  const [sortDirection,setSortDirection]=useState<"asc"|"desc">("asc");

  async function load(){setRequests((await listRequests()).filter(x=>x.status!=="eliminada"));}
  useEffect(()=>{
    const unsubscribe = subscribeRequests((items)=>setRequests(items.filter(x=>x.status!=="eliminada")),()=>load());
    return ()=>unsubscribe();
  },[]);

  function taskTitle(item:ContentRequest){
    return item.topic || item.creativeIdea || `${item.contentType || "Pieza"} · ${item.objective || "Objetivo"}`;
  }
  function typeLabel(item:ContentRequest){
    return [item.contentType,item.objective].filter(Boolean).join(" · ") || "Sin tipo";
  }
  function platformsLabel(item:ContentRequest){
    return item.platforms?.length ? item.platforms.join(", ") : (item.visualFormat || item.feedPlacement || "Sin plataformas");
  }
  function normalizedStatus(item:ContentRequest){
    if(item.status==="finalizada")return "finalizada";
    const copy = (copyOutDrafts[item.id||""] ?? item.copyOut ?? "").trim();
    return copy ? "copy_listo" : "pendiente_copy";
  }
  function statusLabel(value:string){
    return value==="finalizada" ? "Finalizada" : value==="copy_listo" ? "Copy listo" : "Pendiente de copy";
  }
  function buyerPersonaContext(item:ContentRequest){
    const persona = item.buyerPersonaSnapshot;
    if(!persona)return "";
    return [
      persona.name ? `Nombre: ${persona.name}` : "",
      persona.description ? `Descripción: ${persona.description}` : "",
      persona.pains ? `Dolores: ${persona.pains}` : "",
      persona.desires ? `Deseos: ${persona.desires}` : "",
      persona.contentAngles ? `Ángulos de contenido: ${persona.contentAngles}` : ""
    ].filter(Boolean).join(" | ");
  }
  function approvedCopyExamples(item:ContentRequest){
    return requests
      .filter(x=>x.status==="finalizada" && x.clientId===item.clientId && x.copyOut?.trim() && x.id!==item.id)
      .sort((a,b)=>(b.publishDate||"").localeCompare(a.publishDate||""))
      .slice(0,12)
      .map(x=>({copyOut:x.copyOut||"",contentType:x.contentType||"",objective:x.objective||"",publishDate:x.publishDate||""}));
  }
  function normalizeExternalUrl(value?:string){
    const url=(value||"").trim();
    if(!url)return "#";
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  const readyForContent = useMemo(()=>requests.filter(x=>{
    if(x.status==="finalizada")return false;
    return x.status==="aprobada_pendiente_copyout" || x.status==="aprobada_pendiente_contenidos" || (x.approvalStatus==="aprobada" && x.status!=="finalizada");
  }),[requests]);

  const clientOptions = useMemo(()=>{
    const map = new Map<string,string>();
    [...readyForContent,...requests.filter(x=>x.status==="finalizada")].forEach(x=>map.set(x.clientId||"sin-cliente",x.clientName||"Sin cliente"));
    return Array.from(map.entries()).map(([id,name])=>({id,name}));
  },[readyForContent,requests]);

  const batchOptions = useMemo(()=>{
    const map = new Map<string,string>();
    [...readyForContent,...requests.filter(x=>x.status==="finalizada")]
      .filter(x=>clientFilter==="all" || x.clientId===clientFilter)
      .forEach(x=>map.set(x.batchId||"sin-lote",x.batchName||"Sin lote"));
    return Array.from(map.entries()).map(([id,name])=>({id,name}));
  },[readyForContent,requests,clientFilter]);

  function sortValue(item:ContentRequest){
    const values = {
      client:item.clientName||"",
      task:taskTitle(item),
      type:typeLabel(item),
      platforms:platformsLabel(item),
      copyOut:copyOutDrafts[item.id||""] ?? item.copyOut ?? "",
      publishDate:item.publishDate||"",
      link:item.finalPostLink||"",
      status:statusLabel(normalizedStatus(item))
    } as Record<SortKey,string>;
    return String(values[sortKey]||"").toLowerCase();
  }
  function toggleSort(key:SortKey){
    if(sortKey===key){setSortDirection(sortDirection==="asc"?"desc":"asc");return;}
    setSortKey(key);setSortDirection("asc");
  }
  function sortLabel(key:SortKey){return sortKey===key ? (sortDirection==="asc"?" ↑":" ↓") : "";}

  const visibleItems = useMemo(()=>readyForContent.filter(x=>{
    const status = normalizedStatus(x);
    const haystack = `${x.clientName} ${x.batchName} ${taskTitle(x)} ${typeLabel(x)} ${platformsLabel(x)} ${x.copyOut||""} ${x.copyIn||""} ${x.finalPostLink||""}`.toLowerCase();
    return (clientFilter==="all" || x.clientId===clientFilter) &&
      (batchFilter==="all" || (x.batchId||"sin-lote")===batchFilter) &&
      (statusFilter==="all" || statusFilter===status || (statusFilter==="pending" && status==="pendiente_copy")) &&
      (!search.trim() || haystack.includes(search.trim().toLowerCase()));
  }).sort((a,b)=>{
    const result = sortValue(a).localeCompare(sortValue(b),"es",{numeric:true,sensitivity:"base"});
    return sortDirection==="asc" ? result : -result;
  }),[readyForContent,clientFilter,batchFilter,statusFilter,search,sortKey,sortDirection,copyOutDrafts]);

  const finalized = useMemo(()=>requests.filter(x=>{
    const haystack = `${x.clientName} ${x.batchName} ${taskTitle(x)} ${typeLabel(x)} ${platformsLabel(x)} ${x.copyOut||""} ${x.finalPostLink||""}`.toLowerCase();
    return x.status==="finalizada" &&
      (clientFilter==="all" || x.clientId===clientFilter) &&
      (batchFilter==="all" || (x.batchId||"sin-lote")===batchFilter) &&
      (statusFilter==="all" || statusFilter==="finalizada") &&
      (!search.trim() || haystack.includes(search.trim().toLowerCase()));
  }).sort((a,b)=>{
    const result = sortValue(a).localeCompare(sortValue(b),"es",{numeric:true,sensitivity:"base"});
    return sortDirection==="asc" ? result : -result;
  }),[requests,clientFilter,batchFilter,statusFilter,search,sortKey,sortDirection]);

  const tableItems = statusFilter==="finalizada" ? finalized : statusFilter==="all" ? [...visibleItems,...finalized] : visibleItems;

  function toggleSelected(id:string){setSelected(selected.includes(id) ? selected.filter(x=>x!==id) : [...selected,id]);}
  function toggleAllVisible(){
    const ids=tableItems.map(x=>x.id!).filter(Boolean);
    const all=ids.length>0 && ids.every(id=>selected.includes(id));
    setSelected(all ? selected.filter(id=>!ids.includes(id)) : Array.from(new Set([...selected,...ids])));
  }

  async function requestImprovedCopyOut(item:ContentRequest){
    const currentCopy = (copyOutDrafts[item.id||""] ?? item.copyOut ?? item.copyIn ?? item.creativeIdea ?? "").trim();
    if(!currentCopy)throw new Error("Escribe una base de copy o revisa que la solicitud tenga idea creativa.");
    const response = await fetch("/api/improve-copy-out",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        copyDraft:currentCopy,
        clientName:item.clientName,
        contentType:item.contentType,
        objective:item.objective,
        platforms:item.platforms||[],
        visualFormat:item.visualFormat||"",
        feedPlacement:item.feedPlacement||"",
        creativeIdea:item.creativeIdea||"",
        copyIn:item.copyIn||"",
        keyMessage:item.keyMessage||"",
        cta:item.cta||"",
        buyerPersonaName:item.buyerPersonaName||"Sin enfoque particular",
        buyerPersonaContext:buyerPersonaContext(item),
        successfulCopies:approvedCopyExamples(item)
      })
    });
    const payload = await response.json();
    if(!response.ok)throw new Error(payload.error||"No se pudo mejorar el copy final.");
    return payload.improvedCopyOut||currentCopy;
  }
  async function improveOne(item:ContentRequest){
    if(!item.id)return;
    setImprovingCopyId(item.id);
    try{
      const improved=await requestImprovedCopyOut(item);
      setCopyOutDrafts(prev=>({...prev,[item.id||""]:improved}));
    }catch(error){alert(error instanceof Error ? error.message : "No se pudo generar copy con IA.");}
    finally{setImprovingCopyId(null);}
  }
  async function improveSelected(){
    const rows=visibleItems.filter(x=>selected.includes(x.id||""));
    if(!rows.length)return alert("Selecciona al menos una pieza pendiente para generar copy con IA.");
    setBulkImproving(true);
    try{
      const updates:Record<string,string>={};
      for(const item of rows){if(item.id)updates[item.id]=await requestImprovedCopyOut(item);}
      setCopyOutDrafts(prev=>({...prev,...updates}));
      alert(`Copy generado para ${Object.keys(updates).length} pieza(s). Revisa antes de finalizar.`);
    }catch(error){alert(error instanceof Error ? error.message : "No se pudo generar copy con IA.");}
    finally{setBulkImproving(false);}
  }

  async function saveCopy(item:ContentRequest, finish=false){
    if(!item.id)return;
    const copyOut=(copyOutDrafts[item.id] ?? item.copyOut ?? "").trim();
    if(!copyOut)return alert("Escribe el copy final.");
    const comments=[...(item.comments||[])];
    if(finish){
      comments.push({id:`${Date.now()}`,author:"Sistema",target:"Interno",body:"Copy final guardado y contenido finalizado.",mentions:[],createdAt:new Date().toISOString()});
      const temporaryReferenceFiles=(item.referenceFiles||[]).filter((file)=>file.temporary||file.storagePath);
      await deleteStorageFiles(temporaryReferenceFiles);
      await updateRequest(item.id,{copyOut,status:"finalizada",approvalStatus:"aprobada",referenceFiles:(item.referenceFiles||[]).filter((file)=>!temporaryReferenceFiles.includes(file)),comments});
    }else{
      await updateRequest(item.id,{copyOut});
    }
    setCopyOutDrafts(prev=>({...prev,[item.id||""]:copyOut}));
  }

  async function finishOne(item:ContentRequest){await saveCopy(item,true);await load();}
  async function finishSelected(){
    const rows=visibleItems.filter(x=>selected.includes(x.id||""));
    if(!rows.length)return alert("Selecciona piezas pendientes para finalizar.");
    for(const item of rows){await saveCopy(item,true);}
    setSelected([]);await load();alert(`Finalizadas ${rows.length} pieza(s).`);
  }

  async function copyCopyOut(item:ContentRequest){
    const value=(copyOutDrafts[item.id||""] ?? item.copyOut ?? "").trim();
    if(!value)return alert("Esta pieza no tiene copy para copiar.");
    try{await navigator.clipboard.writeText(value);}catch{
      const textarea=document.createElement("textarea");textarea.value=value;textarea.style.position="fixed";textarea.style.left="-9999px";document.body.appendChild(textarea);textarea.focus();textarea.select();document.execCommand("copy");document.body.removeChild(textarea);
    }
    setCopiedId(item.id||null);window.setTimeout(()=>setCopiedId(current=>current===item.id?null:current),1200);
  }

  function exportRows(rows:ContentRequest[], filename:string){
    if(!rows.length)return alert("No hay contenidos para exportar.");
    const headers=["Cliente","Lote","Fecha de publicación","Tipo","Plataformas","Tarea","Copy final","Link final","Estado","Responsable"];
    const csvRows=[headers,...rows.map(x=>[
      x.clientName||"",x.batchName||"Sin lote",x.publishDate||"",x.contentType||"",platformsLabel(x),taskTitle(x),copyOutDrafts[x.id||""] ?? x.copyOut ?? "",x.finalPostLink||"",statusLabel(normalizedStatus(x)),x.assignedTo||""
    ])];
    const csv=csvRows.map(row=>row.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
  }

  const selectedRows = tableItems.filter(x=>selected.includes(x.id||""));

  return <AppShell active="Contenidos">
    <section className="hero">
      <div>
        <p className="eyebrow">Salida y publicación</p>
        <h1>Contenidos</h1>
        <p>Copy final, links, exportación y cierre de piezas ya aprobadas por Content y KAM.</p>
      </div>
    </section>

    <section className="grid kpis">
      {[["Pendientes de copy",String(visibleItems.filter(x=>normalizedStatus(x)==="pendiente_copy").length)],["Copy listo",String(visibleItems.filter(x=>normalizedStatus(x)==="copy_listo").length)],["Finalizadas",String(finalized.length)],["Seleccionadas",String(selected.length)]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <section className="card">
      <div className="finalized-group-title">
        <div><h3>Contenido listo para salida</h3><p className="mini">Filtra, genera copy con IA, copia textos y exporta para subir a plataformas.</p></div>
      </div>
      <div className="finalized-toolbar copyout-toolbar">
        <select value={clientFilter} onChange={e=>{setClientFilter(e.target.value);setBatchFilter("all");setSelected([]);}}>
          <option value="all">Todos los clientes</option>
          {clientOptions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <select value={batchFilter} onChange={e=>{setBatchFilter(e.target.value);setSelected([]);}}>
          <option value="all">Todos los lotes</option>
          {batchOptions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setSelected([]);}}>
          <option value="pending">Pendientes de copy</option>
          <option value="copy_listo">Copy listo</option>
          <option value="finalizada">Finalizadas</option>
          <option value="all">Todas</option>
        </select>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por tarea, copy, link..." />
        <button className="btn" onClick={()=>{setClientFilter("all");setBatchFilter("all");setStatusFilter("pending");setSearch("");setSelected([]);}}>Limpiar</button>
        <button className="btn" onClick={toggleAllVisible}>{selected.length ? "Limpiar selección" : "Seleccionar visibles"}</button>
        {selected.length>0 && <button className="btn blue" onClick={improveSelected} disabled={bulkImproving}>{bulkImproving?"Generando...":`Generar con IA (${selected.length})`}</button>}
        {selected.length>0 && <button className="btn" onClick={finishSelected}>Finalizar seleccionadas</button>}
        <button className="btn blue" onClick={()=>exportRows(selectedRows.length?selectedRows:tableItems,`contenidos-${new Date().toISOString().slice(0,10)}.csv`)}>Exportar Excel/CSV</button>
      </div>

      <div className="copyout-row header contenidos-header">
        <span></span>
        <button type="button" onClick={()=>toggleSort("client")}>Cliente{sortLabel("client")}</button>
        <button type="button" onClick={()=>toggleSort("task")}>Tarea{sortLabel("task")}</button>
        <button type="button" onClick={()=>toggleSort("type")}>Tipo{sortLabel("type")}</button>
        <button type="button" onClick={()=>toggleSort("platforms")}>Plataformas{sortLabel("platforms")}</button>
        <button type="button" onClick={()=>toggleSort("copyOut")}>Copy final{sortLabel("copyOut")}</button>
        <button type="button" onClick={()=>toggleSort("publishDate")}>Fecha{sortLabel("publishDate")}</button>
        <button type="button" onClick={()=>toggleSort("link")}>Link{sortLabel("link")}</button>
        <button type="button" onClick={()=>toggleSort("status")}>Estado{sortLabel("status")}</button>
        <span>Acciones</span>
      </div>

      {tableItems.map(item=><div className="copyout-row contenidos-row" key={item.id}>
        <input type="checkbox" checked={selected.includes(item.id||"")} onChange={()=>toggleSelected(item.id||"")} />
        <span className="list-truncate-cell">{item.clientName || "Sin cliente"}<br/><small>{item.batchName || "Sin lote"}</small></span>
        <div className="list-truncate-cell"><strong>{taskTitle(item)}</strong></div>
        <span className="list-truncate-cell">{typeLabel(item)}</span>
        <span className="list-truncate-cell">{platformsLabel(item)}</span>
        <TextTooltip as="div" className="copyout-cell" text={copyOutDrafts[item.id||""] ?? item.copyOut ?? "Sin copy final"}>
          <textarea rows={2} value={copyOutDrafts[item.id||""] ?? item.copyOut ?? ""} onChange={e=>setCopyOutDrafts({...copyOutDrafts,[item.id||""]:e.target.value})} placeholder="Copy final" disabled={item.status==="finalizada"}/>
          {item.status!=="finalizada" && <button className="btn ai-only-button" type="button" aria-label="Generar con AI" title="Generar con AI" onClick={()=>improveOne(item)} disabled={improvingCopyId===item.id || bulkImproving}>
            <span className="ai-inside-badge" aria-hidden="true"><span className="spark-main">✦</span><span className="spark-mini">✦</span><span>AI</span></span>
          </button>}
        </TextTooltip>
        <span className="list-truncate-cell">{item.publishDate||"Sin fecha"}</span>
        <span className="list-truncate-cell">{item.finalPostLink ? <a href={normalizeExternalUrl(item.finalPostLink)} target="_blank">Abrir link</a> : <span className="pill amber">Sin link</span>}</span>
        <span><span className={normalizedStatus(item)==="finalizada"?"pill green":"pill"}>{statusLabel(normalizedStatus(item))}</span></span>
        <span className="content-actions-cell">
          <button className="copy-icon-button" type="button" aria-label="Copiar copy" title="Copiar copy" onClick={()=>copyCopyOut(item)}><span aria-hidden="true">{copiedId===item.id?"✓":"⧉"}</span></button>
          {item.status!=="finalizada" && <button className="btn" onClick={()=>saveCopy(item,false)}>Guardar</button>}
          {item.status!=="finalizada" && <button className="btn blue" onClick={()=>finishOne(item)}>Finalizar</button>}
        </span>
      </div>)}
      {!tableItems.length && <p className="mini">No hay contenidos con esos filtros.</p>}
    </section>
  </AppShell>;
}
