"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Brand, ContentRequest, Production, listBrands, listProductions, listRequests, organizationTeam } from "@/lib/data";

type ClientLearning = {
  clientName: string;
  total: number;
  finished: number;
  rejected: number;
  avgDays: number | null;
  topTypes: string[];
  insights: string[];
};

type ResponsibleSuggestion = {
  request: ContentRequest;
  person: string;
  reason: string;
  currentLoad: number;
};

const activeTaskStates = ["asignada", "en_revision", "rebotada", "pendiente_aprobacion", "pendiente_aprobacion_kam"];
const finishedStates = ["finalizada", "aprobada_pendiente_copyout"];

export default function OperationalAIPage(){
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [productions,setProductions]=useState<Production[]>([]);
  const [brands,setBrands]=useState<Brand[]>([]);
  const [loading,setLoading]=useState(true);
  const [clientFilter,setClientFilter]=useState("Todos");
  const [areaFilter,setAreaFilter]=useState("Todas");

  async function load(){
    setLoading(true);
    const [reqs, prods, cls] = await Promise.all([listRequests(), listProductions(), listBrands().catch(()=>[])]);
    setRequests(reqs);
    setProductions(prods);
    setBrands(cls);
    setLoading(false);
  }

  useEffect(()=>{load()},[]);

  const filteredRequests = useMemo(()=>requests.filter(item=>
    (clientFilter === "Todos" || item.clientName === clientFilter) &&
    (areaFilter === "Todas" || item.assignedArea === areaFilter || item.suggestedArea === areaFilter)
  ),[requests,clientFilter,areaFilter]);

  const activeTasks = useMemo(()=>filteredRequests.filter(item=>activeTaskStates.includes(item.status || "")),[filteredRequests]);
  const risks = useMemo(()=>activeTasks.filter(item=>isRisk(item)).sort((a,b)=>riskScore(b)-riskScore(a)).slice(0,10),[activeTasks]);
  const rejections = useMemo(()=>filteredRequests.filter(item=>item.status === "rebotada" || item.rejectionNote || item.approvalRejectionReason),[filteredRequests]);
  const learning = useMemo(()=>buildClientLearnings(filteredRequests),[filteredRequests]);
  const suggestions = useMemo(()=>suggestResponsibles(filteredRequests).slice(0,8),[filteredRequests]);
  const dailyPlan = useMemo(()=>buildDailyPlan(activeTasks),[activeTasks]);
  const briefScores = useMemo(()=>filteredRequests.filter(item=>["lista_asignacion","pendiente_produccion","bloqueada"].includes(item.status || "")).map(item=>({item, score:briefScore(item), missing:briefMissing(item)})).sort((a,b)=>a.score-b.score).slice(0,8),[filteredRequests]);
  const rejectionReasons = useMemo(()=>classifyRejections(rejections),[rejections]);
  const smartSummary = useMemo(()=>buildSmartSummary(filteredRequests, productions),[filteredRequests, productions]);

  const clients = useMemo(()=>Array.from(new Set(requests.map(item=>item.clientName).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"es")),[requests]);

  return <AppShell active="IA Operativa">
    <section className="hero">
      <div>
        <p className="eyebrow">Inteligencia operativa</p>
        <h1>IA Operativa</h1>
        <p>Aprende de finalizadas, rebotes, tiempos, cargas y brief para sugerir mejores decisiones conforme el sistema se usa.</p>
      </div>
      <button className="btn" onClick={load}>{loading ? "Actualizando..." : "Actualizar"}</button>
    </section>

    <div className="toolbar">
      <select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}>
        <option>Todos</option>
        {clients.map(client=><option key={client}>{client}</option>)}
      </select>
      <select value={areaFilter} onChange={e=>setAreaFilter(e.target.value)}>
        <option>Todas</option>
        <option>Diseño</option>
        <option>Audiovisual</option>
      </select>
      <span className="mini">Base de aprendizaje: {filteredRequests.length} solicitudes · {brands.length} clientes configurados.</span>
    </div>

    <section className="grid kpis">
      <div className="kpi"><span>Tareas activas</span><strong>{activeTasks.length}</strong><small>{risks.length} con riesgo</small></div>
      <div className="kpi"><span>Rebotes detectados</span><strong>{rejections.length}</strong><small>La IA clasifica motivos</small></div>
      <div className="kpi"><span>Briefs débiles</span><strong>{briefScores.filter(x=>x.score<75).length}</strong><small>Menos de 75/100</small></div>
      <div className="kpi"><span>Clientes con aprendizaje</span><strong>{learning.length}</strong><small>Basado en historial real</small></div>
    </section>

    <section className="card ai-insight-card">
      <p className="eyebrow">Resumen inteligente</p>
      <h3>Qué está pasando en la operación</h3>
      <div className="ai-summary-grid">
        {smartSummary.map((line,index)=><div className="ai-summary-item" key={index}><span>{index+1}</span><p>{line}</p></div>)}
      </div>
    </section>

    <section className="grid two-col">
      <div className="card">
        <div className="section-heading-inline"><div><p className="eyebrow">Diseño / Audiovisual</p><h3>Plan de trabajo IA</h3></div><span className="badge">Prioridad sugerida</span></div>
        <p className="mini">Guía diaria para reducir ansiedad, evitar vencimientos y agrupar piezas parecidas.</p>
        <div className="ai-plan-list">
          {dailyPlan.map((row,index)=><div className="ai-plan-row" key={row.item.id || index}>
            <span className="efficiency-rank">{index+1}</span>
            <div>
              <strong>{row.item.clientName} · {row.item.contentType}</strong>
              <p>{row.reason}</p>
              <small>{row.item.assignedTo || "Sin asignar"} · {row.item.assignedArea || row.item.suggestedArea || "Sin área"} · Vence {getTaskDate(row.item) || "sin fecha"}</small>
            </div>
          </div>)}
          {!dailyPlan.length && <p className="mini">Sin tareas activas por priorizar.</p>}
        </div>
      </div>

      <div className="card">
        <div className="section-heading-inline"><div><p className="eyebrow">Asignación</p><h3>Responsable sugerido</h3></div><span className="badge">Carga balanceada</span></div>
        <p className="mini">Sugerencias para piezas listas por asignar, usando área, carga actual y riesgo.</p>
        <div className="suggestion-list">
          {suggestions.map((row)=><div className="suggestion-card" key={row.request.id}>
            <strong>{row.request.clientName} · {row.request.contentType}</strong>
            <p>{row.person}</p>
            <small>{row.reason} · Carga actual: {row.currentLoad}</small>
          </div>)}
          {!suggestions.length && <p className="mini">No hay piezas listas que requieran sugerencia.</p>}
        </div>
      </div>
    </section>

    <section className="grid two-col">
      <div className="card">
        <div className="section-heading-inline"><div><p className="eyebrow">Creador de solicitudes</p><h3>Brief Score</h3></div><span className="badge">Prevención</span></div>
        <p className="mini">Detecta solicitudes incompletas antes de que lleguen a Diseño o Audiovisual.</p>
        <div className="brief-score-list">
          {briefScores.map(({item,score,missing})=><div className="brief-score-row" key={item.id}>
            <div><strong>{item.clientName} · {item.contentType}</strong><small>{item.batchName || "Sin lote"}</small></div>
            <span className={score>=80?"pill green":score>=60?"pill yellow":"pill red"}>{score}/100</span>
            <p>{missing.length ? `Falta: ${missing.join(", ")}` : "Brief suficientemente completo."}</p>
          </div>)}
          {!briefScores.length && <p className="mini">No hay solicitudes previas a asignación con estos filtros.</p>}
        </div>
      </div>

      <div className="card">
        <div className="section-heading-inline"><div><p className="eyebrow">Calidad</p><h3>Motivos de rebote</h3></div><span className="badge">Aprendizaje</span></div>
        <p className="mini">La IA clasifica rebotes para encontrar causas repetidas y corregir proceso.</p>
        <div className="rejection-grid">
          {rejectionReasons.map(item=><div className="rejection-chip" key={item.reason}><strong>{item.count}</strong><span>{item.reason}</span></div>)}
          {!rejectionReasons.length && <p className="mini">Sin rebotes registrados en el filtro actual.</p>}
        </div>
      </div>
    </section>

    <section className="card">
      <div className="section-heading-inline"><div><p className="eyebrow">Brand Brain vivo</p><h3>Aprendizajes por cliente</h3></div><span className="badge">Se perfecciona con uso</span></div>
      <div className="learning-grid">
        {learning.map(item=><div className="learning-card" key={item.clientName}>
          <strong>{item.clientName}</strong>
          <span className="mini">{item.total} solicitudes · {item.finished} finalizadas · {item.rejected} rebotes</span>
          <ul>{item.insights.map((insight,index)=><li key={index}>{insight}</li>)}</ul>
        </div>)}
        {!learning.length && <p className="mini">Aún no hay suficiente historial para aprender de clientes.</p>}
      </div>
    </section>

    <section className="card">
      <div className="section-heading-inline"><div><p className="eyebrow">Riesgos</p><h3>Alertas preventivas</h3></div><span className="badge">Antes de que truene</span></div>
      <div className="table-wrap">
        <table className="table"><thead><tr><th>Tarea</th><th>Responsable</th><th>Fecha</th><th>Riesgo</th></tr></thead><tbody>
          {risks.map(item=><tr key={item.id}><td><strong>{item.clientName}</strong><br/><span className="mini text-clamp-1">{item.contentType} · {item.objective}</span></td><td>{item.assignedTo || "Sin asignar"}</td><td>{getTaskDate(item) || "Sin fecha"}</td><td>{riskReason(item)}</td></tr>)}
        </tbody></table>
      </div>
      {!risks.length && <p className="mini">No hay riesgos relevantes con estos filtros.</p>}
    </section>
  </AppShell>;
}

function getTaskDate(item:ContentRequest){
  return item.dueDate || item.batchDueDate || item.publishDate || "";
}

function isOverdue(item:ContentRequest){
  const date = getTaskDate(item);
  if(!date) return false;
  const today = new Date().toISOString().slice(0,10);
  return date < today && !["finalizada","aprobada_pendiente_copyout"].includes(item.status || "");
}

function daysUntil(date:string){
  if(!date) return 999;
  const today = new Date();
  const due = new Date(`${date}T12:00:00`);
  return Math.ceil((due.getTime()-today.getTime())/86400000);
}

function riskScore(item:ContentRequest){
  let score = 0;
  if(isOverdue(item)) score += 100;
  if(item.status === "rebotada") score += 60;
  if((item.priority || "") === "Urgente") score += 45;
  if(!item.assignedTo) score += 35;
  const days = daysUntil(getTaskDate(item));
  if(days <= 1) score += 35;
  else if(days <= 3) score += 18;
  if(item.status === "en_revision" && !item.finalPostLink) score += 25;
  return score;
}

function isRisk(item:ContentRequest){
  return riskScore(item) >= 35;
}

function riskReason(item:ContentRequest){
  if(isOverdue(item)) return "Vencida: requiere acción inmediata.";
  if(item.status === "rebotada") return "Rebotada: puede bloquear aprobación.";
  if(!item.assignedTo) return "Sin responsable asignado.";
  if(item.status === "en_revision" && !item.finalPostLink) return "En revisión sin link final.";
  if(daysUntil(getTaskDate(item)) <= 1) return "Entrega próxima.";
  return "Carga o fecha sensible.";
}

function buildDailyPlan(tasks:ContentRequest[]){
  return tasks
    .filter(item=>!["finalizada","aprobada_pendiente_copyout"].includes(item.status || ""))
    .map(item=>({item, score:riskScore(item), reason:dailyReason(item)}))
    .sort((a,b)=>b.score-a.score || getTaskDate(a.item).localeCompare(getTaskDate(b.item)))
    .slice(0,10);
}

function dailyReason(item:ContentRequest){
  if(isOverdue(item)) return "Empieza aquí: ya está vencida y puede afectar aprobación/publicación.";
  if(item.status === "rebotada") return "Corrige primero: las piezas rebotadas deben cerrarse antes de tomar nuevas.";
  if(!item.assignedTo) return "Necesita dueño: asignar antes de que se pierda visibilidad.";
  if(daysUntil(getTaskDate(item)) <= 1) return "Entrega próxima: conviene cerrarla en el primer bloque del día.";
  return "Buen candidato para trabajar por bloque con piezas del mismo tipo o cliente.";
}

function briefScore(item:ContentRequest){
  const checks = [
    item.clientName,
    item.contentType,
    item.objective,
    item.suggestedArea,
    item.publishDate,
    item.creativeIdea && item.creativeIdea.length > 40,
    item.copyIn || item.keyMessage,
    item.platforms?.length,
    item.visualFormat || item.feedPlacement,
    item.requiresProduction ? item.productionNotes : (item.materialAvailable || item.materialLinks)
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function briefMissing(item:ContentRequest){
  const missing:string[] = [];
  if(!item.contentType) missing.push("tipo");
  if(!item.objective) missing.push("objetivo");
  if(!item.suggestedArea) missing.push("área");
  if(!item.publishDate) missing.push("fecha");
  if(!item.creativeIdea || item.creativeIdea.length < 40) missing.push("idea creativa clara");
  if(!item.copyIn && !item.keyMessage) missing.push("copy/mensaje");
  if(!item.platforms?.length) missing.push("plataformas");
  if(item.requiresProduction && !item.productionNotes) missing.push("notas de producción");
  if(!item.requiresProduction && !item.materialAvailable && !item.materialLinks) missing.push("material o link");
  return missing;
}

function classifyRejections(items:ContentRequest[]){
  const labels:Record<string,number> = {};
  items.forEach(item=>{
    const text = `${item.rejectionNote || ""} ${item.approvalRejectionReason || ""} ${item.approvalNotes || ""}`.toLowerCase();
    const reason = text.includes("material") ? "Falta de material" :
      text.includes("formato") || text.includes("medida") ? "Formato incorrecto" :
      text.includes("brief") || text.includes("idea") ? "No cumple brief" :
      text.includes("marca") || text.includes("cliente") ? "Fuera de marca" :
      text.includes("copy") || text.includes("texto") ? "Copy débil o incorrecto" :
      text.includes("cta") ? "Falta CTA" :
      text.includes("link") ? "Link incorrecto" : "Motivo operativo";
    labels[reason] = (labels[reason] || 0) + 1;
  });
  return Object.entries(labels).map(([reason,count])=>({reason,count})).sort((a,b)=>b.count-a.count);
}

function buildClientLearnings(requests:ContentRequest[]):ClientLearning[]{
  const grouped = requests.reduce((acc:Record<string,ContentRequest[]>,item)=>{
    const key = item.clientName || "Sin cliente";
    acc[key]=acc[key]||[];
    acc[key].push(item);
    return acc;
  },{});
  return Object.entries(grouped).map(([clientName,items])=>{
    const finished = items.filter(item=>item.status === "finalizada");
    const rejected = items.filter(item=>item.status === "rebotada" || item.rejectionNote || item.approvalRejectionReason);
    const typeCounts = items.reduce((acc:Record<string,number>,item)=>{acc[item.contentType || "Sin tipo"]=(acc[item.contentType || "Sin tipo"]||0)+1;return acc;},{});
    const topTypes = Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([type])=>type);
    const insights:string[] = [];
    if(topTypes.length) insights.push(`Formatos más usados: ${topTypes.join(", ")}.`);
    if(finished.length) insights.push(`La IA tomará ${finished.length} pieza(s) finalizada(s) como referencia de tono y salida.`);
    if(rejected.length) insights.push(`Hay ${rejected.length} rebote(s); revisar causas antes de crear nuevos lotes.`);
    if(items.some(item=>item.copyOut)) insights.push("Ya existe copy final para aprender estilo de publicación.");
    if(items.some(item=>item.buyerPersonaName && item.buyerPersonaName !== "Sin enfoque particular")) insights.push("Cuenta con enfoque de buyer persona en algunas piezas.");
    return {clientName,total:items.length,finished:finished.length,rejected:rejected.length,avgDays:null,topTypes,insights:insights.slice(0,4)};
  }).filter(item=>item.total>=1).sort((a,b)=>b.finished-a.finished || b.total-a.total).slice(0,12);
}

function suggestResponsibles(requests:ContentRequest[]):ResponsibleSuggestion[]{
  const activeLoads = requests.filter(item=>activeTaskStates.includes(item.status || "")).reduce((acc:Record<string,number>,item)=>{
    if(item.assignedTo) acc[item.assignedTo]=(acc[item.assignedTo]||0)+1;
    return acc;
  },{});
  const candidatesByArea = {
    "Diseño": organizationTeam.filter(member=>member.area === "Diseño").map(member=>member.name),
    "Audiovisual": organizationTeam.filter(member=>member.area === "Audiovisual").map(member=>member.name)
  } as Record<string,string[]>;
  return requests.filter(item=>["lista_asignacion","material_listo"].includes(item.status || "") && !item.assignedTo).map(request=>{
    const area = request.assignedArea || request.suggestedArea || "Diseño";
    const pool = candidatesByArea[area] || candidatesByArea["Diseño"];
    const person = pool.slice().sort((a,b)=>(activeLoads[a]||0)-(activeLoads[b]||0))[0] || "Sin candidato";
    return {request, person, currentLoad: activeLoads[person] || 0, reason:`Menor carga disponible en ${area}.`};
  });
}

function buildSmartSummary(requests:ContentRequest[], productions:Production[]){
  const active = requests.filter(item=>activeTaskStates.includes(item.status || ""));
  const overdue = active.filter(isOverdue).length;
  const unassigned = requests.filter(item=>["lista_asignacion","material_listo"].includes(item.status || "") && !item.assignedTo).length;
  const rejected = requests.filter(item=>item.status === "rebotada").length;
  const materialOverdue = productions.filter(prod=>prod.materialDueDate && prod.materialDueDate < new Date().toISOString().slice(0,10) && prod.status !== "material_entregado").length;
  const lines = [
    overdue ? `${overdue} tarea(s) están vencidas; conviene revisarlas antes de asignar trabajo nuevo.` : "No hay vencimientos críticos en las tareas filtradas.",
    unassigned ? `${unassigned} pieza(s) listas siguen sin responsable; son candidatas para asignación inteligente.` : "Las piezas listas tienen dueño o no hay pendientes de asignación.",
    rejected ? `${rejected} pieza(s) están rebotadas; la IA recomienda resolverlas antes de avanzar nuevas piezas del mismo cliente.` : "No hay rebotes activos en el filtro actual.",
    materialOverdue ? `${materialOverdue} producción(es) tienen material vencido; pueden bloquear asignación.` : "No hay vencimientos de material fuertes en producciones.",
    "Cada finalizada, rebote y copy guardado alimenta el aprendizaje operativo para próximos lotes."
  ];
  return lines;
}
