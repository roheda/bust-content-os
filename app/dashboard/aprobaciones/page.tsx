"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { ContentRequest, TaskComment, deleteStorageFiles, listRequests, subscribeRequests, updateRequest } from "@/lib/data";

const reasons = [
  "Errores ortográficos",
  "Copy no alineado",
  "Diseño no alineado a marca",
  "Formato incorrecto",
  "Material incorrecto",
  "Falta información",
  "No cumple objetivo",
  "Baja calidad visual",
  "Otro"
];

export default function ApprovalsPage(){
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [selected,setSelected]=useState<ContentRequest|null>(null);
  const [reason,setReason]=useState(reasons[0]);
  const [notes,setNotes]=useState("");

  const [pendingClientFilter,setPendingClientFilter]=useState("all");
  const [pendingBatchFilter,setPendingBatchFilter]=useState("all");
  const [pendingSearch,setPendingSearch]=useState("");

  const [copyOutDrafts,setCopyOutDrafts]=useState<Record<string,string>>({});
  const [improvingCopyId,setImprovingCopyId]=useState<string|null>(null);
  const [bulkImprovingCopyOut,setBulkImprovingCopyOut]=useState(false);

  const [copyClientFilter,setCopyClientFilter]=useState("all");
  const [copyBatchFilter,setCopyBatchFilter]=useState("all");
  const [copySearch,setCopySearch]=useState("");
  const [copySortKey,setCopySortKey]=useState<"task"|"type"|"platforms"|"copyOut"|"publishDate"|"link"|"status">("publishDate");
  const [copySortDirection,setCopySortDirection]=useState<"asc"|"desc">("asc");
  const [copySelected,setCopySelected]=useState<string[]>([]);

  const [finalClientFilter,setFinalClientFilter]=useState("all");
  const [finalBatchFilter,setFinalBatchFilter]=useState("all");
  const [finalSortKey,setFinalSortKey]=useState<"task"|"type"|"platforms"|"copyOut"|"publishDate"|"link"|"status">("publishDate");
  const [finalSortDirection,setFinalSortDirection]=useState<"asc"|"desc">("asc");
  const [finalSelected,setFinalSelected]=useState<string[]>([]);

  async function load(){setRequests((await listRequests()).filter(x=>x.status!=="eliminada"))}
  useEffect(()=>{
    const unsubscribe = subscribeRequests((items)=>setRequests(items.filter(x=>x.status!=="eliminada")),()=>load());
    return ()=>unsubscribe();
  },[]);

  const clients = useMemo(()=>{
    const map = new Map<string,string>();
    requests.forEach(x=>map.set(x.clientId||"sin-cliente",x.clientName||"Sin cliente"));
    return Array.from(map.entries()).map(([id,name])=>({id,name}));
  },[requests]);

  const pendingBatches = useMemo(()=>{
    const map = new Map<string,string>();
    requests
      .filter(x=>x.status==="pendiente_aprobacion" || x.approvalStatus==="pendiente")
      .filter(x=>pendingClientFilter==="all" || x.clientId===pendingClientFilter)
      .forEach(x=>map.set(x.batchId||"sin-lote",x.batchName||"Sin lote"));
    return Array.from(map.entries()).map(([id,name])=>({id,name}));
  },[requests,pendingClientFilter]);

  const pending = useMemo(()=>requests.filter(x=>{
    const text = `${x.clientName} ${x.batchName} ${x.contentType} ${x.objective} ${x.creativeIdea} ${x.assignedTo}`.toLowerCase();
    return (x.status==="pendiente_aprobacion" || x.approvalStatus==="pendiente") &&
      (pendingClientFilter==="all" || x.clientId===pendingClientFilter) &&
      (pendingBatchFilter==="all" || (x.batchId||"sin-lote")===pendingBatchFilter) &&
      (!pendingSearch.trim() || text.includes(pendingSearch.trim().toLowerCase()));
  }),[requests,pendingClientFilter,pendingBatchFilter,pendingSearch]);

  const approvedForCopyOut = useMemo(()=>requests.filter(x=>{
    if(!(x.status==="aprobada_pendiente_copyout" || (x.approvalStatus==="aprobada" && x.status!=="finalizada")))return false;
    const text = `${x.clientName} ${x.batchName} ${finalTaskTitle(x)} ${finalTypeLabel(x)} ${finalPlatformsLabel(x)} ${x.copyOut||""} ${x.copyIn||""}`.toLowerCase();
    return (copyClientFilter==="all" || x.clientId===copyClientFilter) &&
      (copyBatchFilter==="all" || (x.batchId||"sin-lote")===copyBatchFilter) &&
      (!copySearch.trim() || text.includes(copySearch.trim().toLowerCase()));
  }).sort((a,b)=>{
    const av = copySortValue(a);
    const bv = copySortValue(b);
    const result = av.localeCompare(bv, "es", { numeric:true, sensitivity:"base" });
    return copySortDirection==="asc" ? result : -result;
  }), [requests,copyClientFilter,copyBatchFilter,copySearch,copySortKey,copySortDirection]);
  const rejected = useMemo(()=>requests.filter(x=>x.approvalStatus==="rechazada"),[requests]);

  function finalTaskTitle(item:ContentRequest){
    return item.topic || item.creativeIdea || `${item.contentType || "Pieza"} · ${item.objective || "Objetivo"}`;
  }

  function finalTypeLabel(item:ContentRequest){
    return [item.contentType, item.objective].filter(Boolean).join(" · ") || "Sin tipo";
  }

  function finalPlatformsLabel(item:ContentRequest){
    return item.platforms?.length ? item.platforms.join(", ") : (item.visualFormat || item.feedPlacement || "Sin plataformas");
  }

  function copySortValue(item:ContentRequest){
    const values = {
      task: finalTaskTitle(item),
      type: finalTypeLabel(item),
      platforms: finalPlatformsLabel(item),
      copyOut: copyOutDrafts[item.id||""] ?? item.copyOut ?? "",
      publishDate: item.publishDate || "",
      link: item.finalPostLink || "",
      status: item.status || ""
    };
    return String(values[copySortKey] || "").toLowerCase();
  }

  function toggleCopySort(key: typeof copySortKey){
    if(copySortKey===key){
      setCopySortDirection(copySortDirection==="asc"?"desc":"asc");
      return;
    }
    setCopySortKey(key);
    setCopySortDirection("asc");
  }

  function copySortLabel(key: typeof copySortKey){
    return copySortKey===key ? (copySortDirection==="asc"?" ↑":" ↓") : "";
  }

  function finalSortValue(item:ContentRequest){
    const values = {
      task: finalTaskTitle(item),
      type: finalTypeLabel(item),
      platforms: finalPlatformsLabel(item),
      copyOut: item.copyOut || "",
      publishDate: item.publishDate || "",
      link: item.finalPostLink || "",
      status: item.status || ""
    };
    return String(values[finalSortKey] || "").toLowerCase();
  }

  function toggleFinalSort(key: typeof finalSortKey){
    if(finalSortKey===key){
      setFinalSortDirection(finalSortDirection==="asc"?"desc":"asc");
      return;
    }
    setFinalSortKey(key);
    setFinalSortDirection("asc");
  }

  function sortLabel(key: typeof finalSortKey){
    return finalSortKey===key ? (finalSortDirection==="asc"?" ↑":" ↓") : "";
  }

  function approvedCopyExamples(item:ContentRequest){
    return requests
      .filter(x=>x.status==="finalizada" && x.clientId===item.clientId && x.copyOut?.trim() && x.id!==item.id)
      .sort((a,b)=>(b.publishDate||"").localeCompare(a.publishDate||""))
      .slice(0,12)
      .map(x=>({
        copyOut:x.copyOut||"",
        contentType:x.contentType||"",
        objective:x.objective||"",
        publishDate:x.publishDate||""
      }));
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

  const finalized = useMemo(()=>requests.filter(x=>{
    return x.status==="finalizada" &&
      (finalClientFilter==="all" || x.clientId===finalClientFilter) &&
      (finalBatchFilter==="all" || (x.batchId||"sin-lote")===finalBatchFilter);
  }).sort((a,b)=>{
    const av = finalSortValue(a);
    const bv = finalSortValue(b);
    const result = av.localeCompare(bv, "es", { numeric:true, sensitivity:"base" });
    return finalSortDirection==="asc" ? result : -result;
  }),[requests,finalClientFilter,finalBatchFilter,finalSortKey,finalSortDirection]);

  const clientsWithCopyOut = useMemo(()=>{
    const map = new Map<string,string>();
    requests
      .filter(x=>x.status==="aprobada_pendiente_copyout" || (x.approvalStatus==="aprobada" && x.status!=="finalizada"))
      .forEach(x=>map.set(x.clientId||"sin-cliente",x.clientName||"Sin cliente"));
    return Array.from(map.entries()).map(([id,name])=>({id,name}));
  },[requests]);

  const batchesWithCopyOut = useMemo(()=>{
    const map = new Map<string,string>();
    requests
      .filter(x=>(x.status==="aprobada_pendiente_copyout" || (x.approvalStatus==="aprobada" && x.status!=="finalizada")) && (copyClientFilter==="all" || x.clientId===copyClientFilter))
      .forEach(x=>map.set(x.batchId||"sin-lote",x.batchName||"Sin lote"));
    return Array.from(map.entries()).map(([id,name])=>({id,name}));
  },[requests,copyClientFilter]);

  const clientsWithFinalized = useMemo(()=>{
    const map = new Map<string,string>();
    requests.filter(x=>x.status==="finalizada").forEach(x=>map.set(x.clientId||"sin-cliente",x.clientName||"Sin cliente"));
    return Array.from(map.entries()).map(([id,name])=>({id,name}));
  },[requests]);

  const batchesWithFinalized = useMemo(()=>{
    const map = new Map<string,string>();
    requests
      .filter(x=>x.status==="finalizada" && (finalClientFilter==="all" || x.clientId===finalClientFilter))
      .forEach(x=>map.set(x.batchId||"sin-lote",x.batchName||"Sin lote"));
    return Array.from(map.entries()).map(([id,name])=>({id,name}));
  },[requests,finalClientFilter]);

  const groupedPending = useMemo(()=>groupByClientBatch(pending),[pending]);
  const groupedCopyOut = useMemo(()=>groupByClientBatch(approvedForCopyOut),[approvedForCopyOut]);
  const groupedFinalized = useMemo(()=>groupByClientBatch(finalized),[finalized]);

  async function approve(item:ContentRequest){
    if(!item.id)return;
    const log:TaskComment = {
      id:`${Date.now()}`,
      author:"Sistema",
      target:"Interno",
      body:"Aprobado. Pasa a captura de Copy Out.",
      mentions:[],
      createdAt:new Date().toISOString()
    };
    const comments = [...(item.comments||[]), log];
    await updateRequest(item.id,{
      status:"aprobada_pendiente_copyout",
      approvalStatus:"aprobada",
      approvalRejectionReason:"",
      approvalNotes:"",
      comments
    });
    await load();
    setSelected(null);
    alert("Tarea aprobada. Pendiente Copy Out.");
  }

  async function reject(item:ContentRequest){
    if(!item.id)return;
    if(!reason)return alert("Selecciona motivo.");
    const noteText = notes.trim() ? ` Nota: ${notes.trim()}` : "";
    const log:TaskComment = {
      id:`${Date.now()}`,
      author:"Sistema",
      target:"Content",
      body:`Pieza no aprobada / rebotada por ${reason}.${noteText}`,
      mentions:["@content"],
      status:"open",
      createdAt:new Date().toISOString()
    };
    const comments = [...(item.comments||[]), log];
    await updateRequest(item.id,{
      status:"rebotada",
      approvalStatus:"rechazada",
      approvalRejectionReason:reason,
      approvalNotes:notes,
      comments
    });
    await load();
    setSelected(null);
    setNotes("");
    alert("Tarea rechazada y rebotada");
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
    if(!response.ok)throw new Error(payload.error||"No se pudo mejorar el Copy Out.");
    return payload.improvedCopyOut||currentCopy;
  }

  async function improveCopyOut(item:ContentRequest){
    if(!item.id)return;
    setImprovingCopyId(item.id);
    try{
      const improvedCopyOut = await requestImprovedCopyOut(item);
      setCopyOutDrafts(prev=>({...prev,[item.id||""]:improvedCopyOut}));
    }catch(error){
      alert(error instanceof Error ? error.message : "No se pudo mejorar el Copy Out.");
    }finally{
      setImprovingCopyId(null);
    }
  }

  async function saveCopyOut(item:ContentRequest){
    if(!item.id)return;
    const copyOut = (copyOutDrafts[item.id] ?? item.copyOut ?? "").trim();
    if(!copyOut)return alert("Escribe el Copy Out final.");
    const log:TaskComment = {
      id:`${Date.now()}`,
      author:"Sistema",
      target:"Interno",
      body:"Copy Out capturado, guardado como referencia aprobada y tarea finalizada.",
      mentions:[],
      createdAt:new Date().toISOString()
    };
    const comments = [...(item.comments||[]), log];
    const temporaryReferenceFiles = (item.referenceFiles || []).filter((file) => file.temporary || file.storagePath);
    await deleteStorageFiles(temporaryReferenceFiles);
    await updateRequest(item.id,{
      copyOut,
      status:"finalizada",
      approvalStatus:"aprobada",
      referenceFiles:(item.referenceFiles || []).filter((file) => !temporaryReferenceFiles.includes(file)),
      comments
    });
    setCopyOutDrafts({...copyOutDrafts,[item.id]:""});
    await load();
    alert("Copy Out guardado y tarea finalizada");
  }

  function toggleCopySelected(id:string){
    setCopySelected(copySelected.includes(id) ? copySelected.filter(x=>x!==id) : [...copySelected,id]);
  }

  function toggleCopyGroup(items:ContentRequest[]){
    const ids = items.map(x=>x.id!).filter(Boolean);
    const allSelected = ids.every(id=>copySelected.includes(id));
    setCopySelected(allSelected ? copySelected.filter(id=>!ids.includes(id)) : Array.from(new Set([...copySelected,...ids])));
  }

  function toggleAllCopyFiltered(){
    const ids = approvedForCopyOut.map(x=>x.id!).filter(Boolean);
    const allSelected = ids.length>0 && ids.every(id=>copySelected.includes(id));
    setCopySelected(allSelected ? copySelected.filter(id=>!ids.includes(id)) : Array.from(new Set([...copySelected,...ids])));
  }

  async function improveSelectedCopyOut(){
    const rows = approvedForCopyOut.filter(x=>copySelected.includes(x.id||""));
    if(!rows.length)return alert("Selecciona al menos una pieza para generar Copy Out con IA.");
    setBulkImprovingCopyOut(true);
    try{
      const updates:Record<string,string> = {};
      for(const item of rows){
        if(!item.id)continue;
        const improved = await requestImprovedCopyOut(item);
        updates[item.id]=improved;
      }
      setCopyOutDrafts(prev=>({...prev,...updates}));
      alert(`Copy Out generado para ${Object.keys(updates).length} pieza(s). Revisa antes de guardar y finalizar.`);
    }catch(error){
      alert(error instanceof Error ? error.message : "No se pudo generar Copy Out con IA.");
    }finally{
      setBulkImprovingCopyOut(false);
    }
  }

  function toggleFinalized(id:string){
    setFinalSelected(finalSelected.includes(id) ? finalSelected.filter(x=>x!==id) : [...finalSelected,id]);
  }

  function toggleGroup(items:ContentRequest[]){
    const ids = items.map(x=>x.id!).filter(Boolean);
    const allSelected = ids.every(id=>finalSelected.includes(id));
    setFinalSelected(allSelected ? finalSelected.filter(id=>!ids.includes(id)) : Array.from(new Set([...finalSelected,...ids])));
  }

  function exportFinalized(){
    const rows = (finalSelected.length ? finalized.filter(x=>finalSelected.includes(x.id||"")) : finalized);
    if(!rows.length)return alert("No hay tareas para exportar.");
    const headers = ["Cliente","Lote","Tipo","Objetivo","Responsable","Fecha publicación","Link final","Copy Out","Estado","Idea creativa"];
    const csvRows = [headers, ...rows.map(x=>[
      x.clientName||"",
      x.batchName||"Sin lote",
      x.contentType||"",
      x.objective||"",
      x.assignedTo||"",
      x.publishDate||"",
      x.finalPostLink||"",
      x.copyOut||"",
      x.status||"",
      (x.creativeIdea||"").replace(/\n/g," ")
    ])];
    const csv = csvRows.map(row=>row.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tareas-finalizadas-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return <AppShell active="Aprobaciones">
    <section className="hero">
      <div>
        <p className="eyebrow">Control de calidad</p>
        <h1>Aprobaciones</h1>
        <p>Revisa piezas, aprueba, captura Copy Out final y conserva historial listo para publicación.</p>
      </div>
    </section>

    <section className="grid kpis">
      {[["Por aprobar",String(pending.length)],["Aprobadas sin Copy Out",String(approvedForCopyOut.length)],["Finalizadas",String(finalized.length)],["Rebotadas",String(rejected.length)],["Total",String(requests.length)],["Aprobadas",String(requests.filter(x=>x.approvalStatus==="aprobada").length)]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <section className="card">
      <h3>Por aprobar</h3>
      <div className="approval-filter-bar">
        <select value={pendingClientFilter} onChange={e=>{setPendingClientFilter(e.target.value);setPendingBatchFilter("all");}}>
          <option value="all">Todos los clientes</option>
          {clients.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <select value={pendingBatchFilter} onChange={e=>setPendingBatchFilter(e.target.value)}>
          <option value="all">Todos los lotes</option>
          {pendingBatches.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <input value={pendingSearch} onChange={e=>setPendingSearch(e.target.value)} placeholder="Buscar por cliente, lote, tarea..."/>
        <button className="btn" onClick={()=>{setPendingClientFilter("all");setPendingBatchFilter("all");setPendingSearch("");}}>Limpiar</button>
      </div>

      {groupedPending.map(group=><div className="finalized-group" key={`${group.clientName}-${group.batchName}`}>
        <div className="finalized-group-title">
          <div>
            <h3>{group.clientName}</h3>
            <p className="mini">{group.batchName} · {group.items.length} pendiente(s)</p>
          </div>
        </div>
        {group.items.map(item=><div className="approval-card" key={item.id}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12}}>
            <div>
              <strong>{item.contentType} · {item.objective}</strong>
              <p className="mini">Responsable: {item.assignedTo||"Sin responsable"} · Publica: {item.publishDate||"Sin fecha"}</p>
              <p className="mini">{item.creativeIdea}</p>
              {item.finalPostLink && <a className="link-card" href={normalizeExternalUrl(item.finalPostLink)} target="_blank"><span>{item.finalPostLink}</span><small>Abrir →</small></a>}
            </div>
            <button className="btn" onClick={()=>{setSelected(item);setReason(reasons[0]);setNotes("")}}>Revisar</button>
          </div>
        </div>)}
      </div>)}
      {!pending.length && <p className="mini">No hay tareas pendientes con esos filtros.</p>}
    </section>

    {selected && <section className="card" style={{marginTop:20}}>
      <h3>Revisión seleccionada</h3>
      <p><strong>{selected.clientName} · {selected.contentType}</strong></p>
      <p className="mini">{selected.creativeIdea}</p>
      <p><strong>Link final:</strong></p>
      {selected.finalPostLink ? <a className="link-card" href={normalizeExternalUrl(selected.finalPostLink)} target="_blank"><span>{selected.finalPostLink}</span><small>Abrir →</small></a> : <p className="mini">Sin link final.</p>}

      <div className="field">
        <label>Motivo de no aprobación</label>
        <select value={reason} onChange={e=>setReason(e.target.value)}>{reasons.map(x=><option key={x}>{x}</option>)}</select>
      </div>
      <div className="field">
        <label>Notas</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Explica qué debe corregirse."/>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button className="btn blue" onClick={()=>approve(selected)}>Aprobar / pasar a Copy Out</button>
        <button className="btn red" onClick={()=>reject(selected)}>No aprobar / devolver</button>
        <button className="btn" onClick={()=>setSelected(null)}>Cerrar</button>
      </div>

      <div className="detail-section">
        <h4>Log de movimientos</h4>
        {((selected.comments||[]).slice().reverse()).map(c=><div className="comment-box" key={c.id}>
          <strong>{c.author} → {c.target}</strong>
          <span className="mini">{new Date(c.createdAt).toLocaleString("es-MX")}</span>
          <p>{c.body}</p>
        </div>)}
        {!(selected.comments||[]).length && <p className="mini">Sin movimientos todavía.</p>}
      </div>
    </section>}

    <section className="card" style={{marginTop:20}}>
      <h3>Aprobadas para Copy Out</h3>
      <p className="mini">Captura el Copy Out final. Puedes seleccionar varias piezas y generar propuesta con IA usando el contexto de cada post.</p>

      <div className="finalized-toolbar copyout-toolbar">
        <select value={copyClientFilter} onChange={e=>{setCopyClientFilter(e.target.value);setCopyBatchFilter("all");setCopySelected([]);}}>
          <option value="all">Todos los clientes</option>
          {clientsWithCopyOut.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <select value={copyBatchFilter} onChange={e=>{setCopyBatchFilter(e.target.value);setCopySelected([]);}}>
          <option value="all">Todos los lotes</option>
          {batchesWithCopyOut.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <input value={copySearch} onChange={e=>setCopySearch(e.target.value)} placeholder="Buscar por tarea, cliente, copy..."/>
        <button className="btn" onClick={()=>{setCopyClientFilter("all");setCopyBatchFilter("all");setCopySearch("");setCopySelected([]);}}>Limpiar</button>
        <button className="btn" onClick={toggleAllCopyFiltered}>{copySelected.length ? "Limpiar selección" : "Seleccionar filtradas"}</button>
        {copySelected.length>0 && <button className="btn blue" onClick={improveSelectedCopyOut} disabled={bulkImprovingCopyOut}>{bulkImprovingCopyOut ? "Generando..." : `Generar con IA (${copySelected.length})`}</button>}
        <span className="pill">{copySelected.length} seleccionada(s)</span>
      </div>

      {groupedCopyOut.map(group=><div className="finalized-group copyout-group" key={`${group.clientName}-${group.batchName}`}>
        <div className="finalized-group-title">
          <div>
            <h3>{group.clientName}</h3>
            <p className="mini">{group.batchName} · {group.items.length} aprobada(s)</p>
          </div>
          <button className="btn" onClick={()=>toggleCopyGroup(group.items)}>Seleccionar grupo</button>
        </div>
        <div className="copyout-row header">
          <span></span>
          <button type="button" onClick={()=>toggleCopySort("task")}>Tarea{copySortLabel("task")}</button>
          <button type="button" onClick={()=>toggleCopySort("type")}>Tipo de publicación{copySortLabel("type")}</button>
          <button type="button" onClick={()=>toggleCopySort("platforms")}>Plataformas{copySortLabel("platforms")}</button>
          <button type="button" onClick={()=>toggleCopySort("copyOut")}>Copy Out{copySortLabel("copyOut")}</button>
          <button type="button" onClick={()=>toggleCopySort("publishDate")}>Fecha{copySortLabel("publishDate")}</button>
          <button type="button" onClick={()=>toggleCopySort("link")}>Link{copySortLabel("link")}</button>
          <span>Acciones</span>
        </div>
        {group.items.map(item=><div className="copyout-row" key={item.id}>
          <input type="checkbox" checked={copySelected.includes(item.id||"")} onChange={()=>toggleCopySelected(item.id||"")}/>
          <div><strong>{finalTaskTitle(item)}</strong><p className="mini">IA usa {approvedCopyExamples(item).length} copy(s) previos</p></div>
          <span>{finalTypeLabel(item)}</span>
          <span>{finalPlatformsLabel(item)}</span>
          <div className="copyout-cell">
            <textarea rows={2} maxLength={600} value={copyOutDrafts[item.id||""] ?? item.copyOut ?? ""} onChange={e=>setCopyOutDrafts({...copyOutDrafts,[item.id||""]:e.target.value})} placeholder="Copy Out final · máx. 600 caracteres"/>
            <button className="btn ai-only-button" type="button" aria-label="Mejorar copy con AI" title="Mejorar copy con AI" onClick={()=>improveCopyOut(item)} disabled={improvingCopyId===item.id || bulkImprovingCopyOut}>
              <span className="ai-inside-badge" aria-hidden="true"><span className="spark-main">✦</span><span className="spark-mini">✦</span><span>AI</span></span>
            </button>
          </div>
          <span>{item.publishDate||"Sin fecha"}</span>
          <span>{item.finalPostLink ? <a href={normalizeExternalUrl(item.finalPostLink)} target="_blank">Abrir link</a> : <span className="pill amber">Sin link</span>}</span>
          <button className="btn blue" onClick={()=>saveCopyOut(item)}>Guardar</button>
        </div>)}
      </div>)}

      {!approvedForCopyOut.length && <p className="mini">No hay piezas aprobadas pendientes de Copy Out con esos filtros.</p>}
    </section>

    {requests.filter(x=>x.status==="finalizada").length>0 && <section className="card" style={{marginTop:20}}>
      <h3>Historial de finalizadas</h3>

      <div className="finalized-toolbar">
        <select value={finalClientFilter} onChange={e=>{setFinalClientFilter(e.target.value);setFinalBatchFilter("all");}}>
          <option value="all">Todos los clientes</option>
          {clientsWithFinalized.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <select value={finalBatchFilter} onChange={e=>setFinalBatchFilter(e.target.value)}>
          <option value="all">Todos los lotes</option>
          {batchesWithFinalized.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <span className="pill">Orden: {finalSortKey} {finalSortDirection==="asc"?"↑":"↓"}</span>
        <button className="btn" onClick={()=>setFinalSelected(finalized.map(x=>x.id!).filter(Boolean))}>Seleccionar todo filtrado</button>
        <button className="btn" onClick={()=>setFinalSelected([])}>Limpiar selección</button>
        <button className="btn blue" onClick={exportFinalized}>Exportar Excel/CSV</button>
        <span className="pill">{finalSelected.length} seleccionada(s)</span>
      </div>

      {groupedFinalized.map(group=><div className="finalized-group" key={`${group.clientName}-${group.batchName}`}>
        <div className="finalized-group-title">
          <div>
            <h3>{group.clientName}</h3>
            <p className="mini">{group.batchName} · {group.items.length} finalizada(s)</p>
          </div>
          <button className="btn" onClick={()=>toggleGroup(group.items)}>Seleccionar grupo</button>
        </div>
        <div className="finalized-row header">
          <span></span>
          <button type="button" onClick={()=>toggleFinalSort("task")}>Tarea{sortLabel("task")}</button>
          <button type="button" onClick={()=>toggleFinalSort("type")}>Tipo de publicación{sortLabel("type")}</button>
          <button type="button" onClick={()=>toggleFinalSort("platforms")}>Plataformas{sortLabel("platforms")}</button>
          <button type="button" onClick={()=>toggleFinalSort("copyOut")}>Copy Out{sortLabel("copyOut")}</button>
          <button type="button" onClick={()=>toggleFinalSort("publishDate")}>Fecha de publicación{sortLabel("publishDate")}</button>
          <button type="button" onClick={()=>toggleFinalSort("link")}>Abrir link{sortLabel("link")}</button>
          <button type="button" onClick={()=>toggleFinalSort("status")}>Estado{sortLabel("status")}</button>
        </div>
        {group.items.map(item=><div className="finalized-row" key={item.id}>
          <input type="checkbox" checked={finalSelected.includes(item.id||"")} onChange={()=>toggleFinalized(item.id||"")}/>
          <div><strong>{finalTaskTitle(item)}</strong></div>
          <span>{finalTypeLabel(item)}</span>
          <span>{finalPlatformsLabel(item)}</span>
          <span className="final-copyout">{item.copyOut || "Sin Copy Out"}</span>
          <span>{item.publishDate||"Sin fecha"}</span>
          <span>{item.finalPostLink ? <a href={normalizeExternalUrl(item.finalPostLink)} target="_blank">Abrir link</a> : "Sin link"}</span>
          <span><span className="pill green">{item.status}</span></span>
        </div>)}
      </div>)}

      {!finalized.length && <p className="mini">No hay finalizadas con estos filtros.</p>}
    </section>}

    {rejected.length>0 && <section className="card" style={{marginTop:20}}>
      <h3>Últimas no aprobadas</h3>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Tarea</th><th>Motivo</th><th>Notas</th><th>Estado</th></tr></thead>
        <tbody>{rejected.slice(0,20).map(item=><tr key={item.id}>
          <td><strong>{item.clientName} · {item.contentType}</strong></td>
          <td><span className="pill red">{item.approvalRejectionReason}</span></td>
          <td>{item.approvalNotes}</td>
          <td>{item.status}</td>
        </tr>)}</tbody>
      </table></div>
    </section>}
  </AppShell>
}

function normalizeExternalUrl(value?:string){
  const url=(value||"").trim();
  if(!url)return "#";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function groupByClientBatch(items:ContentRequest[]){
  const groups:Record<string,{clientName:string;batchName:string;items:ContentRequest[]}> = {};
  items.forEach(item=>{
    const key = `${item.clientName||"Sin cliente"}__${item.batchName||"Sin lote"}`;
    groups[key] = groups[key] || {clientName:item.clientName||"Sin cliente",batchName:item.batchName||"Sin lote",items:[]};
    groups[key].items.push(item);
  });
  return Object.values(groups);
}
