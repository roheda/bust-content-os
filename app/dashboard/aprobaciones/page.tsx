"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { ContentRequest, TaskComment, listRequests, updateRequest } from "@/lib/data";

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

  const [finalClientFilter,setFinalClientFilter]=useState("all");
  const [finalBatchFilter,setFinalBatchFilter]=useState("all");
  const [finalSort,setFinalSort]=useState<"asc"|"desc">("asc");
  const [finalSelected,setFinalSelected]=useState<string[]>([]);

  async function load(){setRequests((await listRequests()).filter(x=>x.status!=="eliminada"))}
  useEffect(()=>{load()},[]);

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

  const approvedForCopyOut = useMemo(()=>requests.filter(x=>x.status==="aprobada_pendiente_copyout" || (x.approvalStatus==="aprobada" && x.status!=="finalizada")), [requests]);
  const rejected = useMemo(()=>requests.filter(x=>x.approvalStatus==="rechazada"),[requests]);

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
    const av = a.publishDate || "";
    const bv = b.publishDate || "";
    return finalSort==="asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  }),[requests,finalClientFilter,finalBatchFilter,finalSort]);

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
      target:"Interno",
      body:`Rebotado por ${reason}.${noteText}`,
      mentions:[],
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

  async function improveCopyOut(item:ContentRequest){
    if(!item.id)return;
    const currentCopy = (copyOutDrafts[item.id] ?? item.copyOut ?? item.copyIn ?? item.creativeIdea ?? "").trim();
    if(!currentCopy)return alert("Escribe una base de copy o revisa que la solicitud tenga idea creativa.");
    setImprovingCopyId(item.id);
    try{
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
      setCopyOutDrafts(prev=>({...prev,[item.id||""]:payload.improvedCopyOut||currentCopy}));
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
    await updateRequest(item.id,{
      copyOut,
      status:"finalizada",
      approvalStatus:"aprobada",
      comments
    });
    setCopyOutDrafts({...copyOutDrafts,[item.id]:""});
    await load();
    alert("Copy Out guardado y tarea finalizada");
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
              {item.finalPostLink && <a className="link-card" href={item.finalPostLink} target="_blank"><span>{item.finalPostLink}</span><small>Abrir →</small></a>}
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
      {selected.finalPostLink ? <a className="link-card" href={selected.finalPostLink} target="_blank"><span>{selected.finalPostLink}</span><small>Abrir →</small></a> : <p className="mini">Sin link final.</p>}

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
        <button className="btn red" onClick={()=>reject(selected)}>No aprobar / rebotar</button>
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
      <p className="mini">Una vez aprobada la pieza, captura el copy final que se usará para publicación. Puedes mejorarlo con IA usando el contexto de la solicitud y los copys finalizados del cliente. Al guardar Copy Out, también se conserva como base de aprendizaje para futuras mejoras.</p>

      {groupedCopyOut.map(group=><div className="finalized-group" key={`${group.clientName}-${group.batchName}`}>
        <div className="finalized-group-title">
          <div>
            <h3>{group.clientName}</h3>
            <p className="mini">{group.batchName} · {group.items.length} aprobada(s)</p>
          </div>
        </div>
        {group.items.map(item=><div className="copyout-card" key={item.id}>
          <strong>{item.contentType} · {item.objective}</strong>
          <p className="mini">Responsable: {item.assignedTo||"Sin responsable"} · Publica: {item.publishDate||"Sin fecha"}</p>
          <p className="mini">{item.creativeIdea}</p>
          {item.finalPostLink && <a className="link-card" href={item.finalPostLink} target="_blank"><span>{item.finalPostLink}</span><small>Abrir →</small></a>}
          <div className="field">
            <label>Copy Out final</label>
            <textarea value={copyOutDrafts[item.id||""] ?? item.copyOut ?? ""} onChange={e=>setCopyOutDrafts({...copyOutDrafts,[item.id||""]:e.target.value})} placeholder="Escribe el copy final que se publicará."/>
          </div>
          <div className="copyout-ai-panel">
            <div>
              <strong>Mejora IA de Copy Out</strong>
              <p className="mini">Usa la idea, objetivo, plataforma, buyer persona y {approvedCopyExamples(item).length} copy(s) finalizados del cliente como base de aprendizaje.</p>
            </div>
            <button className="btn" type="button" onClick={()=>improveCopyOut(item)} disabled={improvingCopyId===item.id}>
              <span className="ai-inside-badge" aria-hidden="true"><span className="spark-main">✦</span><span className="spark-mini">✦</span><span>AI</span></span>
              {improvingCopyId===item.id ? "Mejorando..." : "Mejorar copy con AI"}
            </button>
          </div>
          <button className="btn blue" onClick={()=>saveCopyOut(item)}>Guardar Copy Out y finalizar</button>
        </div>)}
      </div>)}

      {!approvedForCopyOut.length && <p className="mini">No hay piezas aprobadas pendientes de Copy Out.</p>}
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
        <select value={finalSort} onChange={e=>setFinalSort(e.target.value as "asc"|"desc")}>
          <option value="asc">Publicación ascendente</option>
          <option value="desc">Publicación descendente</option>
        </select>
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
          <span></span><span>Tarea</span><span>Responsable</span><span>Publicación</span><span>Link final</span><span>Estado</span>
        </div>
        {group.items.map(item=><div className="finalized-row" key={item.id}>
          <input type="checkbox" checked={finalSelected.includes(item.id||"")} onChange={()=>toggleFinalized(item.id||"")}/>
          <div><strong>{item.contentType} · {item.objective}</strong><br/><span className="mini">{item.copyOut || item.creativeIdea}</span></div>
          <span>{item.assignedTo||"Sin responsable"}</span>
          <span>{item.publishDate||"Sin fecha"}</span>
          <span>{item.finalPostLink ? <a href={item.finalPostLink} target="_blank">Abrir link</a> : "Sin link"}</span>
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

function groupByClientBatch(items:ContentRequest[]){
  const groups:Record<string,{clientName:string;batchName:string;items:ContentRequest[]}> = {};
  items.forEach(item=>{
    const key = `${item.clientName||"Sin cliente"}__${item.batchName||"Sin lote"}`;
    groups[key] = groups[key] || {clientName:item.clientName||"Sin cliente",batchName:item.batchName||"Sin lote",items:[]};
    groups[key].items.push(item);
  });
  return Object.values(groups);
}
