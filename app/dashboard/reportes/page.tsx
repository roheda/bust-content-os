"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Brand,
  ClientOperationalOverride,
  ContentRequest,
  OperationalContentRule,
  Production,
  estimateRequestCost,
  listClientOperationalOverrides,
  listOperationalContentRules,
  listUniqueBrands,
  listProductions,
  listRequests
} from "@/lib/data";

type PersonMetric = {
  name: string;
  assigned: number;
  overdue: number;
  finished: number;
  inApproval: number;
  rejected: number;
  avgDaysToApproval: number;
};

export default function ReportsPage(){
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [brands,setBrands]=useState<Brand[]>([]);
  const [productions,setProductions]=useState<Production[]>([]);
  const [costRules,setCostRules]=useState<OperationalContentRule[]>([]);
  const [clientOverrides,setClientOverrides]=useState<ClientOperationalOverride[]>([]);
  const [clientFilter,setClientFilter]=useState("all");
  const [areaFilter,setAreaFilter]=useState("all");
  const [personFilter,setPersonFilter]=useState("all");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");

  async function load(){
    const [reqs,cls,prods,rules,overrides] = await Promise.all([
      listRequests(),
      listUniqueBrands(),
      listProductions(),
      listOperationalContentRules(),
      listClientOperationalOverrides()
    ]);
    setRequests(reqs);
    setBrands(cls);
    setProductions(prods);
    setCostRules(rules);
    setClientOverrides(overrides);
  }

  useEffect(()=>{load()},[]);

  const people = useMemo(()=>{
    const set = new Set<string>();
    requests.forEach(x=>{if(x.assignedTo)set.add(x.assignedTo)});
    productions.forEach(x=>{if(x.producer)set.add(x.producer)});
    return Array.from(set).sort();
  },[requests,productions]);

  const filtered = useMemo(()=>requests.filter(x=>{
    const date = x.dueDate || x.batchDueDate || x.publishDate || "";
    return (clientFilter==="all" || x.clientId===clientFilter) &&
      (areaFilter==="all" || x.assignedArea===areaFilter || x.suggestedArea===areaFilter) &&
      (personFilter==="all" || x.assignedTo===personFilter) &&
      (!from || !date || date>=from) &&
      (!to || !date || date<=to);
  }),[requests,clientFilter,areaFilter,personFilter,from,to]);

  const filteredProductions = useMemo(()=>productions.filter(x=>{
    return (clientFilter==="all" || x.clientId===clientFilter) &&
      (personFilter==="all" || x.producer===personFilter) &&
      (!from || !x.scheduledDate || x.scheduledDate>=from) &&
      (!to || !x.scheduledDate || x.scheduledDate<=to);
  }),[productions,clientFilter,personFilter,from,to]);

  const totals = useMemo(()=>calculateTotals(filtered, filteredProductions),[filtered,filteredProductions]);
  const financials = useMemo(()=>calculateFinancials(filtered, costRules, clientOverrides),[filtered,costRules,clientOverrides]);
  const byPerson = useMemo(()=>calculatePeople(filtered),[filtered]);
  const byClient = useMemo(()=>countBy(filtered,x=>x.clientName||"Sin cliente"),[filtered]);
  const byClientCost = useMemo(()=>costBy(filtered, costRules, clientOverrides, x=>x.clientName||"Sin cliente"),[filtered,costRules,clientOverrides]);
  const byContentCost = useMemo(()=>costBy(filtered, costRules, clientOverrides, x=>x.contentType||"Sin tipo"),[filtered,costRules,clientOverrides]);
  const byArea = useMemo(()=>countBy(filtered,x=>x.assignedArea||x.suggestedArea||"Sin área"),[filtered]);
  const byStatus = useMemo(()=>countBy(filtered,x=>statusLabel(x.status||"sin_estado")),[filtered]);
  const rejectionReasons = useMemo(()=>countBy(filtered.filter(x=>x.approvalStatus==="rechazada"),x=>x.approvalRejectionReason||"Sin motivo"),[filtered]);
  const overdueTasks = useMemo(()=>filtered.filter(isOverdue).sort((a,b)=>getTaskDate(a).localeCompare(getTaskDate(b))).slice(0,25),[filtered]);
  const bottlenecks = useMemo(()=>buildBottlenecks(filtered),[filtered]);
  const health = useMemo(()=>operationHealth(totals),[totals]);

  function clearFilters(){
    setClientFilter("all");
    setAreaFilter("all");
    setPersonFilter("all");
    setFrom("");
    setTo("");
  }

  function exportReport(){
    const headers = ["Cliente","Lote","Tipo","Área","Responsable","Estado","Fecha operativa","Fecha publicación","Vencida","Costo interno","Costo producción","Costo total","Horas edición","Días mínimos","Approval","Motivo rechazo","Link final","Copy Out"];
    const rows = filtered.map(x=>{
      const cost = estimateRequestCost(x,costRules,clientOverrides);
      return [
        x.clientName||"",
        x.batchName||"",
        x.contentType||"",
        x.assignedArea||x.suggestedArea||"",
        x.assignedTo||"",
        statusLabel(x.status||""),
        getTaskDate(x),
        x.publishDate||"",
        isOverdue(x) ? "Sí" : "No",
        cost.internalCost,
        cost.productionCost,
        cost.totalCost,
        cost.editingHours,
        cost.deliveryDays,
        x.approvalStatus||"",
        x.approvalRejectionReason||"",
        x.finalPostLink||"",
        x.copyOut||""
      ];
    });
    const csv = [headers,...rows].map(row=>row.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url;
    a.download=`reporte-direccion-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return <AppShell active="Reportes">
    <section className="hero">
      <div>
        <p className="eyebrow">Dirección</p>
        <h1>Reportes</h1>
        <p>Radar operativo para entender carga, velocidad, cuellos de botella, calidad, cumplimiento y rendimiento del equipo.</p>
      </div>
      <button className="btn blue" onClick={exportReport}>Exportar reporte CSV</button>
    </section>

    <div className="report-filters">
      <select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}>
        <option value="all">Todos los clientes</option>
        {brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <select value={areaFilter} onChange={e=>setAreaFilter(e.target.value)}>
        <option value="all">Todas las áreas</option>
        <option>Diseño</option>
        <option>Audiovisual</option>
        <option>Copy</option>
        <option>Mixto</option>
      </select>
      <select value={personFilter} onChange={e=>setPersonFilter(e.target.value)}>
        <option value="all">Todas las personas</option>
        {people.map(x=><option key={x}>{x}</option>)}
      </select>
      <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
      <input type="date" value={to} onChange={e=>setTo(e.target.value)}/>
      <button className="btn" onClick={clearFilters}>Limpiar</button>
      <button className="btn" onClick={load}>Actualizar</button>
    </div>

    <section className="metric-grid">
      <Metric title="Salud operación" value={`${health.score}%`} helper={health.label} tone={health.tone}/>
      <Metric title="Tareas filtradas" value={totals.total} helper="Todas las piezas dentro del filtro"/>
      <Metric title="Vencidas" value={totals.overdue} helper={`${totals.overdueRate}% de tareas vencidas`} tone={totals.overdueRate>20?"bad":totals.overdueRate>8?"mid":"good"}/>
      <Metric title="Finalizadas" value={totals.finished} helper={`${totals.finishedRate}% de avance final`} tone={totals.finishedRate>70?"good":totals.finishedRate>35?"mid":"bad"}/>
      <Metric title="En aprobación" value={totals.inApproval} helper="Esperando revisión final"/>
      <Metric title="Rebotadas" value={totals.rejected} helper={`${totals.rejectionRate}% de rechazo`} tone={totals.rejectionRate>20?"bad":totals.rejectionRate>8?"mid":"good"}/>
      <Metric title="Sin asignar" value={totals.unassigned} helper="Riesgo de quedarse sin dueño" tone={totals.unassigned>0?"mid":"good"}/>
      <Metric title="Producciones" value={filteredProductions.length} helper={`${totals.productionsWithoutMaterial} sin material`} tone={totals.productionsWithoutMaterial>0?"mid":"good"}/>
      <Metric title="Costo interno" value={money(financials.totalCost)} helper={`${money(financials.avgCost)} promedio por pieza`} tone={financials.totalCost>0?"mid":undefined}/>
      <Metric title="Costo producción" value={money(financials.productionCost)} helper="Solo piezas que requieren producción"/>
      <Metric title="Horas edición" value={`${financials.editingHours} h`} helper={`${financials.riskCount} piezas con tiempo justo`} tone={financials.riskCount>0?"mid":"good"}/>
      <Metric title="Días prom. entrega" value={`${financials.avgDeliveryDays}`} helper="Según configuración operativa"/>
    </section>

    <section className="report-section">
      <h3>Embudo operativo</h3>
      <div className="funnel">
        <FunnelStep label="Solicitudes" value={totals.total}/>
        <FunnelStep label="Asignadas" value={totals.assigned}/>
        <FunnelStep label="En revisión" value={totals.inReview}/>
        <FunnelStep label="En aprobación" value={totals.inApproval}/>
        <FunnelStep label="Copy Out" value={totals.copyOutPending}/>
        <FunnelStep label="Finalizadas" value={totals.finished}/>
      </div>
    </section>

    <section className="grid two-col">
      <div className="report-section">
        <h3>Carga por cliente</h3>
        <BarList data={byClient}/>
      </div>
      <div className="report-section">
        <h3>Carga por área</h3>
        <BarList data={byArea}/>
      </div>
    </section>

    <section className="grid two-col">
      <div className="report-section">
        <h3>Costeo por cliente</h3>
        <MoneyBarList data={byClientCost} empty="Sin costos configurados"/>
      </div>
      <div className="report-section">
        <h3>Costeo por tipo de contenido</h3>
        <MoneyBarList data={byContentCost} empty="Sin costos configurados"/>
      </div>
    </section>

    <section className="grid two-col">
      <div className="report-section">
        <h3>Estado de tareas</h3>
        <BarList data={byStatus}/>
      </div>
      <div className="report-section">
        <h3>Motivos de no aprobación</h3>
        <BarList data={rejectionReasons} empty="Sin rechazos en el filtro"/>
      </div>
    </section>

    <section className="report-section">
      <h3>Rendimiento por persona</h3>
      <div className="people-grid">
        {byPerson.map(person=><div className="person-card" key={person.name}>
          <h4>{person.name}</h4>
          <div className="person-stats">
            <SmallStat label="Asignadas" value={person.assigned}/>
            <SmallStat label="Vencidas" value={person.overdue}/>
            <SmallStat label="Finalizadas" value={person.finished}/>
            <SmallStat label="Aprobación" value={person.inApproval}/>
            <SmallStat label="Rebotadas" value={person.rejected}/>
            <SmallStat label="Días prom." value={person.avgDaysToApproval || "-"}/>
          </div>
        </div>)}
        {!byPerson.length && <p className="mini">No hay personas con tareas en el filtro.</p>}
      </div>
    </section>

    <section className="grid two-col">
      <div className="report-section">
        <h3>Cuellos de botella</h3>
        <table className="risk-table">
          <thead><tr><th>Bloqueo</th><th>Cantidad</th><th>Riesgo</th></tr></thead>
          <tbody>{bottlenecks.map(row=><tr key={row.label}>
            <td>{row.label}</td>
            <td>{row.count}</td>
            <td><span className={`health-badge ${row.count>5?"health-bad":row.count>0?"health-mid":"health-good"}`}>{row.count>5?"Alto":row.count>0?"Medio":"Ok"}</span></td>
          </tr>)}</tbody>
        </table>
      </div>

      <div className="report-section">
        <h3>Tareas vencidas críticas</h3>
        <table className="risk-table">
          <thead><tr><th>Tarea</th><th>Responsable</th><th>Fecha</th><th>Estado</th></tr></thead>
          <tbody>{overdueTasks.map(item=><tr key={item.id}>
            <td><strong>{item.clientName}</strong><br/><span className="mini">{item.contentType} · {item.creativeIdea}</span></td>
            <td>{item.assignedTo||"Sin asignar"}</td>
            <td>{getTaskDate(item)||"Sin fecha"}</td>
            <td><span className="pill red">{statusLabel(item.status||"")}</span></td>
          </tr>)}</tbody>
        </table>
        {!overdueTasks.length && <p className="mini">Sin tareas vencidas en el filtro.</p>}
      </div>
    </section>

    <section className="report-section">
      <h3>Lectura directiva rápida</h3>
      <div className="grid two-col">
        <Insight title="Dónde poner atención" items={[
          totals.overdue>0 ? `${totals.overdue} tareas vencidas requieren seguimiento.` : "No hay tareas vencidas relevantes.",
          totals.unassigned>0 ? `${totals.unassigned} tareas están sin responsable.` : "La carga tiene responsable asignado.",
          totals.productionsWithoutMaterial>0 ? `${totals.productionsWithoutMaterial} producciones siguen sin material entregado.` : "Producciones sin bloqueo de material.",
          financials.riskCount>0 ? `${financials.riskCount} piezas tienen fecha de publicación demasiado cercana para su tiempo configurado.` : "Las fechas cumplen los tiempos mínimos configurados."
        ]}/>
        <Insight title="Calidad y aprobación" items={[
          totals.rejected>0 ? `${totals.rejected} piezas han sido rebotadas.` : "Sin piezas rebotadas en el filtro.",
          totals.copyOutPending>0 ? `${totals.copyOutPending} piezas aprobadas siguen pendientes de Copy Out.` : "Sin cuello de botella en Copy Out.",
          `${totals.finished} piezas están finalizadas y listas como historial.`,
          `Costo interno estimado del filtro: ${money(financials.totalCost)}.`
        ]}/>
      </div>
    </section>
  </AppShell>
}

function getTaskDate(item:ContentRequest){
  return item.dueDate || item.batchDueDate || item.publishDate || "";
}

function isOverdue(item:ContentRequest){
  const date = getTaskDate(item);
  if(!date)return false;
  const today = new Date().toISOString().slice(0,10);
  return date < today && !["pendiente_aprobacion","aprobada","finalizada"].includes(item.status||"");
}

function statusLabel(status:string){
  const labels:Record<string,string> = {
    asignada:"Asignada",
    en_revision:"En revisión",
    rebotada:"Rebotada",
    pendiente_aprobacion:"En aprobación",
    aprobada_pendiente_copyout:"Aprobada sin Copy Out",
    finalizada:"Finalizada",
    material_listo:"Material listo",
    lista_asignacion:"Lista asignación",
    pendiente_produccion:"Pendiente producción",
    produccion_programada:"Producción programada",
    bloqueada:"Bloqueada"
  };
  return labels[status] || status || "Sin estado";
}

function calculateTotals(items:ContentRequest[], productions:Production[]){
  const total = items.length;
  const overdue = items.filter(isOverdue).length;
  const finished = items.filter(x=>x.status==="finalizada").length;
  const assigned = items.filter(x=>x.status==="asignada").length;
  const inReview = items.filter(x=>x.status==="en_revision" || x.status==="rebotada").length;
  const inApproval = items.filter(x=>x.status==="pendiente_aprobacion").length;
  const rejected = items.filter(x=>x.approvalStatus==="rechazada" || x.status==="rebotada").length;
  const copyOutPending = items.filter(x=>x.status==="aprobada_pendiente_copyout").length;
  const unassigned = items.filter(x=>!x.assignedTo && ["lista_asignacion","material_listo","asignada"].includes(x.status||"")).length;
  const productionsWithoutMaterial = productions.filter(p=>{
    const hasGeneral = Boolean((p.materialLinks||"").trim()) || Boolean((p.materialFiles||[]).length);
    const hasPerPost = Boolean(Object.values(p.materialLinksByRequest||{}).some(v=>String(v||"").trim()));
    return !hasGeneral && !hasPerPost;
  }).length;

  return {
    total,
    overdue,
    overdueRate: pct(overdue,total),
    finished,
    finishedRate: pct(finished,total),
    assigned,
    inReview,
    inApproval,
    rejected,
    rejectionRate: pct(rejected,total),
    copyOutPending,
    unassigned,
    productionsWithoutMaterial
  };
}

function calculatePeople(items:ContentRequest[]):PersonMetric[]{
  const grouped:Record<string,ContentRequest[]> = {};
  items.forEach(item=>{
    const key = item.assignedTo || "Sin asignar";
    grouped[key] = grouped[key] || [];
    grouped[key].push(item);
  });

  return Object.entries(grouped).map(([name,list])=>{
    const approvalDurations = list
      .filter(x=>x.status==="finalizada" && x.comments?.length)
      .map(x=>estimateDaysToApproval(x))
      .filter(x=>x>=0);

    return {
      name,
      assigned: list.length,
      overdue: list.filter(isOverdue).length,
      finished: list.filter(x=>x.status==="finalizada").length,
      inApproval: list.filter(x=>x.status==="pendiente_aprobacion").length,
      rejected: list.filter(x=>x.status==="rebotada" || x.approvalStatus==="rechazada").length,
      avgDaysToApproval: approvalDurations.length ? Math.round(approvalDurations.reduce((a,b)=>a+b,0)/approvalDurations.length) : 0
    };
  }).sort((a,b)=>b.assigned-a.assigned);
}

function estimateDaysToApproval(item:ContentRequest){
  const sent = item.comments?.find(x=>x.body.includes("Enviado a aprobación"));
  const done = item.comments?.find(x=>x.body.includes("Tarea finalizada") || x.body.includes("Copy Out capturado"));
  if(!sent || !done)return -1;
  const a = new Date(sent.createdAt).getTime();
  const b = new Date(done.createdAt).getTime();
  if(!a || !b)return -1;
  return Math.max(0, Math.round((b-a)/(1000*60*60*24)));
}

function countBy(items:ContentRequest[], fn:(item:ContentRequest)=>string){
  const map:Record<string,number> = {};
  items.forEach(item=>{
    const key = fn(item) || "Sin dato";
    map[key] = (map[key]||0)+1;
  });
  return Object.entries(map).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value).slice(0,12);
}

function buildBottlenecks(items:ContentRequest[]){
  return [
    {label:"Tareas vencidas",count:items.filter(isOverdue).length},
    {label:"Pendientes de aprobación",count:items.filter(x=>x.status==="pendiente_aprobacion").length},
    {label:"Aprobadas sin Copy Out",count:items.filter(x=>x.status==="aprobada_pendiente_copyout").length},
    {label:"Rebotadas",count:items.filter(x=>x.status==="rebotada" || x.approvalStatus==="rechazada").length},
    {label:"Sin responsable",count:items.filter(x=>!x.assignedTo).length},
    {label:"Sin link final",count:items.filter(x=>["pendiente_aprobacion","aprobada_pendiente_copyout","finalizada"].includes(x.status||"") && !x.finalPostLink).length}
  ];
}

function operationHealth(totals:ReturnType<typeof calculateTotals>){
  let score = 100;
  score -= Math.min(30, totals.overdueRate);
  score -= Math.min(25, totals.rejectionRate);
  score -= Math.min(15, totals.unassigned * 3);
  score -= Math.min(15, totals.copyOutPending * 2);
  score -= Math.min(15, totals.productionsWithoutMaterial * 2);
  score = Math.max(0, Math.round(score));

  if(score>=80)return {score,label:"Operación saludable",tone:"good" as const};
  if(score>=60)return {score,label:"Atención media",tone:"mid" as const};
  return {score,label:"Riesgo operativo",tone:"bad" as const};
}

function pct(value:number,total:number){
  return total ? Math.round((value/total)*100) : 0;
}

function Metric({title,value,helper,tone}:{title:string;value:string|number;helper:string;tone?:"good"|"mid"|"bad"}){
  const cls = tone==="good" ? "health-good" : tone==="mid" ? "health-mid" : tone==="bad" ? "health-bad" : "";
  return <div className="metric-card">
    <span>{title}</span>
    <strong>{value}</strong>
    <small className={cls ? `health-badge ${cls}` : ""}>{helper}</small>
  </div>;
}

function FunnelStep({label,value}:{label:string;value:number}){
  return <div className="funnel-step"><strong>{value}</strong><span>{label}</span></div>;
}

function BarList({data,empty="Sin datos"}:{data:{label:string;value:number}[];empty?:string}){
  const max = Math.max(...data.map(x=>x.value),1);
  if(!data.length)return <p className="mini">{empty}</p>;
  return <div className="bar-list">
    {data.map(row=><div className="bar-row" key={row.label}>
      <div className="bar-label">{row.label}</div>
      <div className="bar-track"><div className="bar-fill" style={{width:`${Math.max(5,(row.value/max)*100)}%`}}/></div>
      <div className="bar-value">{row.value}</div>
    </div>)}
  </div>;
}

function SmallStat({label,value}:{label:string;value:number|string}){
  return <div className="person-stat"><strong>{value}</strong><span>{label}</span></div>;
}

function Insight({title,items}:{title:string;items:string[]}){
  return <div className="brief-box">
    <h4>{title}</h4>
    {items.map((item,index)=><p key={index} style={{margin:"8px 0"}}>• {item}</p>)}
  </div>;
}

function calculateFinancials(items:ContentRequest[], rules:OperationalContentRule[], overrides:ClientOperationalOverride[]){
  const costs = items.map(item=>({item,...estimateRequestCost(item,rules,overrides)}));
  const totalCost = costs.reduce((sum,row)=>sum+row.totalCost,0);
  const productionCost = costs.reduce((sum,row)=>sum+row.productionCost,0);
  const editingHours = costs.reduce((sum,row)=>sum+row.editingHours,0);
  const avgCost = items.length ? Math.round(totalCost/items.length) : 0;
  const avgDeliveryDays = items.length ? Math.round(costs.reduce((sum,row)=>sum+row.deliveryDays,0)/items.length) : 0;
  const today = new Date(new Date().toISOString().slice(0,10)+"T00:00:00").getTime();
  const riskCount = costs.filter(row=>{
    if(!row.item.publishDate)return false;
    const publish = new Date(row.item.publishDate+"T00:00:00").getTime();
    if(!publish)return false;
    const diff = Math.ceil((publish-today)/(1000*60*60*24));
    return diff < row.deliveryDays;
  }).length;
  return {totalCost,productionCost,editingHours,avgCost,avgDeliveryDays,riskCount};
}

function costBy(items:ContentRequest[], rules:OperationalContentRule[], overrides:ClientOperationalOverride[], fn:(item:ContentRequest)=>string){
  const map:Record<string,number> = {};
  items.forEach(item=>{
    const key = fn(item) || "Sin dato";
    map[key] = (map[key]||0) + estimateRequestCost(item,rules,overrides).totalCost;
  });
  return Object.entries(map).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value).slice(0,12);
}

function MoneyBarList({data,empty="Sin datos"}:{data:{label:string;value:number}[];empty?:string}){
  const max = Math.max(...data.map(x=>x.value),1);
  if(!data.length)return <p className="mini">{empty}</p>;
  return <div className="bar-list">
    {data.map(row=><div className="bar-row" key={row.label}>
      <div className="bar-label">{row.label}</div>
      <div className="bar-track"><div className="bar-fill" style={{width:`${Math.max(5,(row.value/max)*100)}%`}}/></div>
      <div className="bar-value">{money(row.value)}</div>
    </div>)}
  </div>;
}

function money(value:number){
  return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number(value||0));
}
