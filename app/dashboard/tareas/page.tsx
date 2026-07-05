"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { ContentRequest, Production, ReferenceFile, TaskComment, isImageFile, listProductions, listRequests, updateRequest } from "@/lib/data";

const people = ["Todos","Ana Diseño","Luis Diseño","Carlos Editor","Mariana Editora","Pedro Video","Mafer KAM","Rodrigo"];
const areas = ["Todas","Diseño","Audiovisual","Copy","Mixto"];
const commentTargets = ["Content","Key Account","Diseño","Audiovisual","Cliente","Interno"];
const workStatuses = [
  ["asignada","Asignada"],
  ["en_revision","En revisión"],
  ["rebotada","Rebotada"],
  ["pendiente_aprobacion","En aprobación"]
];

export default function TasksPage(){
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [productions,setProductions]=useState<Production[]>([]);
  const [view,setView]=useState<"calendario"|"lista"|"persona">("calendario");
  const [calendarMode,setCalendarMode]=useState<"semana"|"mes">("semana");
  const [cursor,setCursor]=useState(new Date());
  const [person,setPerson]=useState("Todos");
  const [area,setArea]=useState("Todas");
  const [statusFilter,setStatusFilter]=useState("all");
  const [workflowFilter,setWorkflowFilter]=useState("active");
  const [overdueFilter,setOverdueFilter]=useState("all");
  const [selected,setSelected]=useState<ContentRequest|null>(null);
  const [comment,setComment]=useState("");
  const [commentTarget,setCommentTarget]=useState("Content");
  const [finalLink,setFinalLink]=useState("");
  const [preview,setPreview]=useState<ReferenceFile|null>(null);
  const [contextPost,setContextPost]=useState<ContentRequest|null>(null);

  async function load(){
    setRequests(await listRequests());
    setProductions(await listProductions());
  }

  useEffect(()=>{load()},[]);

  const filtered = useMemo(()=>requests.filter(x=>{
    const taskStates = ["asignada","en_revision","rebotada","pendiente_aprobacion","finalizada"].includes(x.status || "") && x.status !== "eliminada";
    const overdue = isOverdue(x);
    const workflowOk =
      workflowFilter==="all" ? true :
      workflowFilter==="active" ? ["asignada","en_revision"].includes(x.status||"") :
      workflowFilter==="approval" ? x.status==="pendiente_aprobacion" :
      workflowFilter==="rejected" ? x.status==="rebotada" :
      workflowFilter==="finished" ? x.status==="finalizada" :
      true;

    return taskStates &&
      workflowOk &&
      (person==="Todos"||x.assignedTo===person) &&
      (area==="Todas"||x.assignedArea===area||x.suggestedArea===area) &&
      (statusFilter==="all"||x.status===statusFilter) &&
      (overdueFilter==="all" || (overdueFilter==="overdue" ? overdue : !overdue));
  }),[requests,person,area,statusFilter,workflowFilter,overdueFilter]);

  const weekDays = useMemo(()=>getWeekDays(cursor),[cursor]);
  const monthDays = useMemo(()=>getMonthDays(cursor),[cursor]);

  const tasksByDate = useMemo(()=>{
    const map:Record<string,ContentRequest[]> = {};
    for(const item of filtered){
      const date = getTaskDate(item);
      if(!date)continue;
      map[date] = map[date] || [];
      map[date].push(item);
    }
    Object.values(map).forEach(list=>list.sort((a,b)=>(a.clientName||"").localeCompare(b.clientName||"")));
    return map;
  },[filtered]);

  const mentionsFeed = useMemo(()=>{
    return requests.flatMap(req=>(req.comments||[]).map(c=>({request:req,comment:c})))
      .filter(row=>row.comment.mentions.length || row.comment.target !== "Interno")
      .sort((a,b)=>b.comment.createdAt.localeCompare(a.comment.createdAt));
  },[requests]);

  const overdueCount = filtered.filter(isOverdue).length;

  function openTask(task:ContentRequest){
    setSelected(task);
    setFinalLink(task.finalPostLink || "");
  }

  function move(delta:number){
    const next = new Date(cursor);
    if(calendarMode==="semana")next.setDate(next.getDate()+delta*7);
    else next.setMonth(next.getMonth()+delta);
    setCursor(next);
  }

  async function setStatus(status:string){
    if(!selected?.id)return;
    const label = statusLabel(status);
    const nextLog:TaskComment = {
      id: `${Date.now()}`,
      author: "Sistema",
      target: "Interno",
      body: `Cambio de estado: ${label}`,
      mentions: [],
      createdAt: new Date().toISOString()
    };
    const comments = [...(selected.comments||[]), nextLog];
    await updateRequest(selected.id,{status,comments});
    const updated = {...selected,status,comments};
    setSelected(updated);
    await load();
  }

  function extractMentions(value:string){
    const matches = value.match(/@[\wÁÉÍÓÚáéíóúÑñ.-]+/g) || [];
    return Array.from(new Set(matches));
  }

  async function addComment(){
    if(!selected?.id)return;
    if(!comment.trim())return alert("Escribe un comentario.");
    const nextComment:TaskComment = {
      id: `${Date.now()}`,
      author: "Usuario",
      target: commentTarget,
      body: comment.trim(),
      mentions: extractMentions(comment),
      createdAt: new Date().toISOString()
    };
    const comments = [...(selected.comments||[]), nextComment];
    await updateRequest(selected.id,{comments});
    setSelected({...selected,comments});
    setComment("");
    await load();
  }

  async function sendToApproval(){
    if(!selected?.id)return;
    if(!finalLink.trim())return alert("Para mandar a aprobación debes pegar el link final de Drive.");
    const comments = [...(selected.comments||[])];
    comments.push({
      id:`${Date.now()}`,
      author:"Sistema",
      target:"Aprobaciones",
      body:`Enviado a aprobación. Link final: ${finalLink.trim()}`,
      mentions:[],
      createdAt:new Date().toISOString()
    });
    await updateRequest(selected.id,{
      finalPostLink: finalLink.trim(),
      status:"pendiente_aprobacion",
      approvalStatus:"pendiente",
      comments
    });
    setSelected({...selected,finalPostLink:finalLink.trim(),status:"pendiente_aprobacion",approvalStatus:"pendiente",comments});
    await load();
    alert("Tarea enviada a aprobación");
  }

  async function sendToGenerator(){
    if(!selected?.id)return;
    const comments = [...(selected.comments||[])];
    comments.push({
      id:`${Date.now()}`,
      author:"Sistema",
      target:"BUST It Now",
      body:"Enviado a BUST It Now.",
      mentions:[],
      createdAt:new Date().toISOString()
    });
    await updateRequest(selected.id,{
      generatorStatus:"enviado",
      generatorSentAt:new Date().toISOString(),
      comments
    });
    setSelected({...selected,generatorStatus:"enviado",generatorSentAt:new Date().toISOString(),comments});
    await load();
    alert("Tarea enviada a BUST It Now");
  }

  const batchContext = selected?.batchId ? requests.filter(x=>x.batchId===selected.batchId).sort((a,b)=>(a.number||0)-(b.number||0)) : [];
  const selectedTimeline = selected ? buildTaskTimeline(selected) : [];

  return <AppShell active="Tareas">
    <section className="hero">
      <div>
        <p className="eyebrow">Equipo</p>
        <h1>Tareas</h1>
        <p>Trabajo diario del equipo: calendario, lista, vista por persona, comentarios, vencimientos y envío a aprobación.</p>
      </div>
    </section>

    <div className="view-switch">
      <button className={view==="calendario"?"active":""} onClick={()=>setView("calendario")}>Calendario</button>
      <button className={view==="lista"?"active":""} onClick={()=>setView("lista")}>Lista de tareas</button>
      <button className={view==="persona"?"active":""} onClick={()=>setView("persona")}>Por persona</button>
    </div>

    <div className="calendar-controls">
      {view==="calendario" && <>
        <button className={calendarMode==="semana"?"active":""} onClick={()=>setCalendarMode("semana")}>Semana</button>
        <button className={calendarMode==="mes"?"active":""} onClick={()=>setCalendarMode("mes")}>Mes</button>
        <button onClick={()=>move(-1)}>← Anterior</button>
        <button onClick={()=>setCursor(new Date())}>Hoy</button>
        <button onClick={()=>move(1)}>Siguiente →</button>
      </>}
      <select value={person} onChange={e=>setPerson(e.target.value)}>{people.map(x=><option key={x}>{x}</option>)}</select>
      <select value={area} onChange={e=>setArea(e.target.value)}>{areas.map(x=><option key={x}>{x}</option>)}</select>
      <select value={workflowFilter} onChange={e=>setWorkflowFilter(e.target.value)}>
        <option value="active">Activas</option>
        <option value="approval">En aprobación</option>
        <option value="rejected">Rebotadas</option>
        <option value="finished">Finalizadas</option>
        <option value="all">Todas</option>
      </select>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
        <option value="all">Todos los estados</option>
        {workStatuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        <option value="finalizada">Finalizada</option>
      </select>
      <select value={overdueFilter} onChange={e=>setOverdueFilter(e.target.value)}>
        <option value="all">Vencidas y vigentes</option>
        <option value="overdue">Solo vencidas</option>
        <option value="current">Solo vigentes</option>
      </select>
    </div>

    <section className="grid kpis">
      {[["Tareas",String(filtered.length)],["Vencidas",String(overdueCount)],["Finalizadas",String(requests.filter(x=>x.status==="finalizada").length)],["Dudas",String(mentionsFeed.length)],["Persona",person],["Área",area]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <section className="calendar-workspace">
      <div>
        {view==="calendario" && (calendarMode==="semana"
          ? <WeekView days={weekDays} tasksByDate={tasksByDate} onOpen={openTask}/>
          : <MonthView days={monthDays} cursor={cursor} tasksByDate={tasksByDate} onOpen={openTask}/>)}

        {view==="lista" && <ListView tasks={filtered} onOpen={openTask}/>}
        {view==="persona" && <PersonView tasks={filtered} onOpen={openTask}/>}
      </div>

      <aside className="chat-panel">
        <h3>Panel de dudas / menciones</h3>
        <p className="mini">Comentarios con @menciones o dirigidos a Content / Key Account / áreas.</p>
        {!mentionsFeed.length && <p className="mini">Aún no hay dudas activas.</p>}
        {mentionsFeed.slice(0,30).map(({request,comment})=><button className="chat-item" key={`${request.id}-${comment.id}`} onClick={()=>openTask(request)}>
          <strong>{request.clientName} · {request.contentType}</strong>
          <span className="mini">Para: {comment.target} · {new Date(comment.createdAt).toLocaleString("es-MX")}</span>
          <p>{comment.body}</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{comment.mentions.map(m=><span className="mention" key={m}>{m}</span>)}</div>
        </button>)}
      </aside>
    </section>

    {selected && <div className="modal-backdrop">
      <div className="modal-card" style={{width:"min(1120px,96vw)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}>
          <div>
            <p className="eyebrow">Tarea asignada</p>
            <h2 style={{margin:"0 0 4px"}}>{selected.clientName} · {selected.contentType}</h2>
            <p className="mini">Fecha operativa: {getTaskDate(selected)||"Sin fecha"} · Publica: {selected.publishDate||"Sin fecha"} · Lote: {selected.batchName||"Sin lote"}</p>
          </div>
          <button className="btn red" onClick={()=>setSelected(null)}>Cerrar</button>
        </div>

        <div className="task-modal-grid">
          <div>
            <div className="detail-section">
              <h4>Herramientas</h4>
              <button className="btn" onClick={sendToGenerator}>Enviar a BUST It Now</button>
              {selected.generatorStatus==="enviado" && <span className="generator-badge">Enviado a BUST It Now</span>}
            </div>

            <div className="detail-section">
              <h4>Estado de trabajo</h4>
              {selected.status==="finalizada" ? <div className="pill green">Finalizada / cerrada</div> : <div className="status-buttons">
                {workStatuses.map(([value,label])=><button key={value} className={selected.status===value?"active":""} onClick={()=>setStatus(value)}>{label}</button>)}
              </div>}
            </div>

            {selected.status!=="finalizada" ? <div className="finalize-box">
              <h4>Link de entrega</h4>
              <p className="mini">Pega el link final del post en Drive, Canva o carpeta de entrega. Este campo queda más visible para evitar errores.</p>
              <input className="final-link-input" value={finalLink} onChange={e=>setFinalLink(e.target.value)} placeholder="Pega aquí el link de Drive, Canva, archivo o carpeta"/>
              {finalLink.trim() && <a className="link-card" href={finalLink.trim()} target="_blank" style={{marginTop:10}}><span>{finalLink.trim()}</span><small>Abrir →</small></a>}
              <button className="btn blue" style={{marginTop:10}} onClick={sendToApproval}>Enviar a aprobación</button>
            </div> : <div className="finalize-box">
              <h4>Tarea cerrada</h4>
              <p className="mini">Esta tarea ya fue aprobada y finalizada. Se conserva como historial.</p>
              {selected.finalPostLink && <a className="link-card" href={selected.finalPostLink} target="_blank"><span>{selected.finalPostLink}</span><small>Abrir →</small></a>}
            </div>}

            <div className="detail-section">
              <h4>Idea creativa</h4>
              <div className="detail-copy">{selected.creativeIdea||"Sin idea"}</div>
            </div>

            <div className="detail-section">
              <h4>Copy In / Mensaje</h4>
              <div className="detail-copy">
                <strong>Copy:</strong> {selected.copyIn||"Sin copy"}{"\n"}
                <strong>Mensaje:</strong> {selected.keyMessage||"Sin mensaje"}{"\n"}
                <strong>CTA:</strong> {selected.cta||"Sin CTA"}{"\n"}
                <strong>Link final:</strong> {selected.finalPostLink||"Pendiente"}{"\n"}<strong>Copy Out:</strong> {selected.copyOut||"Pendiente"}
              </div>
            </div>

            <div className="detail-section">
              <h4>Contexto del lote completo</h4>
              <div className="lote-context">
                {batchContext.map(item=><button type="button" className="lote-item clickable" key={item.id} onClick={()=>setContextPost(item)}>
                  <strong>{item.number}. {item.contentType} · {item.objective}</strong>
                  <p className="mini">Publica: {item.publishDate||"Sin fecha"} · Responsable: {item.assignedTo||"Sin asignar"} · Estado: {statusLabel(item.status||"")}</p>
                  <p className="mini">{item.creativeIdea}</p>
                </button>)}
                {!batchContext.length && <p className="mini">Esta tarea no tiene lote relacionado.</p>}
              </div>
            </div>

            <div className="detail-section">
              <h4>Material / referencias</h4>
              <FilePreviewGrid files={[...(selected.referenceFiles||[]),...(selected.materialFiles||[])]} onPreview={setPreview}/>
              <LinkList value={`${selected.referenceLinks||""}\n${selected.materialLinks||""}`}/>
            </div>
          </div>

          <aside>
            <div className="detail-section">
              <h4>Comentarios y dudas</h4>
              <div className="field">
                <label>Dirigir a</label>
                <select value={commentTarget} onChange={e=>setCommentTarget(e.target.value)}>{commentTargets.map(x=><option key={x}>{x}</option>)}</select>
              </div>
              <div className="field">
                <label>Comentario</label>
                <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Escribe una duda. Usa @content, @kam, @mafer, @editor, etc."/>
              </div>
              <button className="btn blue" onClick={addComment}>Agregar comentario</button>

              <div style={{marginTop:14}}>
                <h4>Log completo de la tarea</h4>
                {selectedTimeline.map(entry=><div className="comment-box" key={entry.id}>
                  <strong>{entry.author} → {entry.target}</strong>
                  <span className="mini">{entry.createdAt ? new Date(entry.createdAt).toLocaleString("es-MX") : "Sin fecha exacta"}</span>
                  <p>{entry.body}</p>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{entry.mentions.map(m=><span className="mention" key={m}>{m}</span>)}</div>
                </div>)}
                {!selectedTimeline.length && <p className="mini">Sin movimientos todavía.</p>}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>}

    {contextPost && <div className="modal-backdrop">
      <div className="modal-card" style={{width:"min(880px,96vw)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}>
          <div>
            <p className="eyebrow">Post del lote / solo lectura</p>
            <h2 style={{margin:"0 0 4px"}}>{contextPost.clientName} · {contextPost.contentType}</h2>
            <p className="mini">Responsable: {contextPost.assignedTo||"Sin asignar"} · Publica: {contextPost.publishDate||"Sin fecha"} · Estado: {statusLabel(contextPost.status||"")}</p>
          </div>
          <button className="btn red" onClick={()=>setContextPost(null)}>Cerrar</button>
        </div>

        <div className="readonly-note">
          Vista de contexto. Cuando creemos usuarios y permisos, si esta pieza está asignada a otra persona solo podrá visualizarse.
        </div>

        <div className="detail-section">
          <h4>Idea creativa</h4>
          <div className="detail-copy">{contextPost.creativeIdea||"Sin idea"}</div>
        </div>
        <div className="detail-section">
          <h4>Copy / Mensaje / CTA</h4>
          <div className="detail-copy">
            <strong>Copy:</strong> {contextPost.copyIn||"Sin copy"}{"\n"}
            <strong>Mensaje:</strong> {contextPost.keyMessage||"Sin mensaje"}{"\n"}
            <strong>CTA:</strong> {contextPost.cta||"Sin CTA"}{"\n"}
            <strong>Link final:</strong> {contextPost.finalPostLink||"Pendiente"}{"\n"}<strong>Copy Out:</strong> {contextPost.copyOut||"Pendiente"}
          </div>
        </div>
        <div className="detail-section">
          <h4>Material / referencias</h4>
          <FilePreviewGrid files={[...(contextPost.referenceFiles||[]),...(contextPost.materialFiles||[])]} onPreview={setPreview}/>
          <LinkList value={`${contextPost.referenceLinks||""}\n${contextPost.materialLinks||""}\n${contextPost.finalPostLink||""}`}/>
        </div>
      </div>
    </div>}

    {preview && <PreviewModal file={preview} onClose={()=>setPreview(null)}/>}
  </AppShell>
}


function normalizeCreatedAt(value:unknown){
  if(!value)return "";
  if(typeof value === "string")return value;
  if(value && typeof value === "object" && "toDate" in value){
    try{return ((value as {toDate:()=>Date}).toDate()).toISOString();}catch{return "";}
  }
  return "";
}

function buildTaskTimeline(item:ContentRequest){
  const base:TaskComment[] = [];
  const createdAt = normalizeCreatedAt((item as any).createdAt);
  base.push({
    id:"system-created",
    author:"Sistema",
    target:"Origen",
    body:`Solicitud creada para ${item.clientName || "Sin cliente"}. Lote: ${item.batchName || "Sin lote"}. Tipo: ${item.contentType || "Sin tipo"}. Publicación: ${item.publishDate || "Sin fecha"}.`,
    mentions:[],
    createdAt:createdAt || item.publishDate || item.batchDueDate || new Date().toISOString()
  });
  if(item.batchDueDate || item.dueDate){
    base.push({
      id:"system-due-date",
      author:"Sistema",
      target:"Planeación",
      body:`Fecha límite operativa definida: ${item.dueDate || item.batchDueDate}.`,
      mentions:[],
      createdAt:createdAt || new Date().toISOString()
    });
  }
  if(item.assignedTo || item.assignedArea){
    base.push({
      id:"system-assignment-current",
      author:"Sistema",
      target:"Asignación",
      body:`Asignación actual: ${item.assignedTo || "Sin responsable"} · Área: ${item.assignedArea || item.suggestedArea || "Sin área"} · Prioridad: ${item.priority || "Media"}.`,
      mentions:[],
      createdAt:createdAt || new Date().toISOString()
    });
  }
  if(item.finalPostLink){
    base.push({
      id:"system-final-link",
      author:"Sistema",
      target:"Entrega",
      body:`Link de entrega registrado: ${item.finalPostLink}.`,
      mentions:[],
      createdAt:createdAt || new Date().toISOString()
    });
  }

  return [...base, ...(item.comments||[])]
    .filter(entry=>entry.body)
    .sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
}

function statusLabel(status:string){
  const labels:Record<string,string> = {
    asignada: "Asignada",
    en_revision: "En revisión",
    rebotada: "Rebotada",
    pendiente_aprobacion: "En aprobación",
    aprobada: "Aprobada",
    finalizada: "Finalizada"
  };
  return labels[status] || status;
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

function key(date:Date){
  return date.toISOString().slice(0,10);
}

function getWeekDays(date:Date){
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate()+diff);
  return Array.from({length:7}).map((_,i)=>{
    const x = new Date(d);
    x.setDate(d.getDate()+i);
    return x;
  });
}

function getMonthDays(date:Date){
  const first = new Date(date.getFullYear(),date.getMonth(),1);
  const startDay = first.getDay();
  const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
  const start = new Date(first);
  start.setDate(first.getDate()+mondayOffset);
  return Array.from({length:42}).map((_,i)=>{
    const x = new Date(start);
    x.setDate(start.getDate()+i);
    return x;
  });
}

function WeekView({days,tasksByDate,onOpen}:{days:Date[];tasksByDate:Record<string,ContentRequest[]>;onOpen:(item:ContentRequest)=>void}){
  return <div className="week-calendar">
    {days.map(day=><DayBox key={key(day)} date={day} tasks={tasksByDate[key(day)]||[]} onOpen={onOpen} variant="week"/>)}
  </div>;
}

function MonthView({days,cursor,tasksByDate,onOpen}:{days:Date[];cursor:Date;tasksByDate:Record<string,ContentRequest[]>;onOpen:(item:ContentRequest)=>void}){
  return <div className="month-calendar">
    {days.map(day=><DayBox key={key(day)} date={day} tasks={tasksByDate[key(day)]||[]} onOpen={onOpen} muted={day.getMonth()!==cursor.getMonth()} variant="month"/>)}
  </div>;
}

function DayBox({date,tasks,onOpen,muted=false,variant}:{date:Date;tasks:ContentRequest[];onOpen:(item:ContentRequest)=>void;muted?:boolean;variant:"week"|"month"}){
  const label = date.toLocaleDateString("es-MX",{weekday:"short"});
  return <div className={variant==="week"?"week-day":"month-day"} style={{opacity:muted?.55:1}}>
    <div className="day-title"><strong>{label} {date.getDate()}</strong><span>{tasks.length}</span></div>
    {tasks.map(task=><TaskChip task={task} onOpen={onOpen} key={task.id}/>)}
  </div>;
}

function TaskChip({task,onOpen}:{task:ContentRequest;onOpen:(item:ContentRequest)=>void}){
  const overdue = isOverdue(task);
  const done = ["pendiente_aprobacion","aprobada","finalizada"].includes(task.status||"");
  return <button className={`task-chip ${overdue?"overdue":""} ${done?"done":""}`} onClick={()=>onOpen(task)}>
    <strong>{task.clientName}</strong>
    <span>{task.contentType} · {task.assignedTo||"Sin asignar"}</span>
    <span className="mini-status">{overdue ? "VENCIDA" : statusLabel(task.status||"")}</span>
  </button>;
}

function ListView({tasks,onOpen}:{tasks:ContentRequest[];onOpen:(item:ContentRequest)=>void}){
  if(!tasks.length)return <div className="card"><p>No hay tareas con estos filtros.</p></div>;
  return <div>{tasks.sort((a,b)=>getTaskDate(a).localeCompare(getTaskDate(b))).map(task=><button className={`list-task-card ${isOverdue(task)?"task-chip overdue":""}`} key={task.id} onClick={()=>onOpen(task)}>
    <strong>{task.clientName} · {task.contentType}</strong>
    <span className="mini">Fecha operativa: {getTaskDate(task)||"Sin fecha"} · Responsable: {task.assignedTo||"Sin asignar"} · Estado: {isOverdue(task) ? "VENCIDA" : statusLabel(task.status||"")}</span>
    <span className="mini">{task.creativeIdea}</span>
  </button>)}</div>;
}

function PersonView({tasks,onOpen}:{tasks:ContentRequest[];onOpen:(item:ContentRequest)=>void}){
  const grouped:Record<string,ContentRequest[]> = {};
  tasks.forEach(t=>{const key=t.assignedTo||"Sin asignar";grouped[key]=grouped[key]||[];grouped[key].push(t)});
  return <div className="person-task-grid">
    {Object.entries(grouped).map(([person,items])=><div className="person-column" key={person}>
      <h3>{person}</h3>
      {items.map(task=><TaskChip task={task} onOpen={onOpen} key={task.id}/>)}
    </div>)}
  </div>;
}

function splitLinks(value:string){
  return (value||"").split(/\s|,|\n/).map(x=>x.trim()).filter(x=>x.startsWith("http://")||x.startsWith("https://"));
}

function LinkList({value}:{value:string}){
  const links = splitLinks(value);
  if(!links.length)return <p className="mini">Sin links.</p>;
  return <div className="link-list">{links.map((link,index)=><a className="link-card" href={link} target="_blank" key={index}><span>{link}</span><small>Abrir →</small></a>)}</div>;
}

function FilePreviewGrid({files,onPreview}:{files:ReferenceFile[];onPreview:(file:ReferenceFile)=>void}){
  if(!files?.length)return <p className="mini">Sin archivos.</p>;
  return <div className="preview-grid">
    {files.map((file,index)=><button type="button" className="preview-thumb" key={index} onClick={()=>onPreview(file)}>
      {isImageFile(file)?<img src={file.url} alt="Referencia"/>:<span>Archivo</span>}
    </button>)}
  </div>;
}

function PreviewModal({file,onClose}:{file:ReferenceFile;onClose:()=>void}){
  return <div className="preview-modal" onClick={onClose}>
    <div className="preview-box" onClick={e=>e.stopPropagation()}>
      <div className="preview-actions">
        <strong>{file.name}</strong>
        <button className="btn red" onClick={onClose}>Cerrar</button>
      </div>
      {isImageFile(file)?<img src={file.url} alt={file.name}/>:<p>Archivo no previsualizable.</p>}
    </div>
  </div>;
}
