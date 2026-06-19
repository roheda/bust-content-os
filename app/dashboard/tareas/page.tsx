"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { ContentRequest, PlatformUser, Production, ReferenceFile, TaskComment, isImageFile, isVideoFile, listProductions, listRequests, listUsers, organizationTeam, updateRequest } from "@/lib/data";

const people = ["Todos", ...organizationTeam.map((member)=>member.name)];
const areas = ["Todas","Diseño","Audiovisual"];
const commentTargets = ["Content","Key Account","Diseño","Audiovisual","Cliente","Interno"];
const workStatuses = [
  ["asignada","Asignada"],
  ["en_revision","En revisión"],
  ["rebotada","Rebotada"]
];

export default function TasksPage(){
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [productions,setProductions]=useState<Production[]>([]);
  const [users,setUsers]=useState<PlatformUser[]>([]);
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
  const [mentionSearch,setMentionSearch]=useState("");
  const [commentTarget,setCommentTarget]=useState("Interno");
  const [finalLink,setFinalLink]=useState("");
  const [preview,setPreview]=useState<ReferenceFile|null>(null);
  const [contextPost,setContextPost]=useState<ContentRequest|null>(null);

  async function load(){
    const [loadedRequests, loadedProductions, loadedUsers] = await Promise.all([listRequests(), listProductions(), listUsers().catch(()=>[])]);
    setRequests(loadedRequests);
    setProductions(loadedProductions);
    setUsers(loadedUsers);
  }

  useEffect(()=>{load()},[]);

  useEffect(()=>{
    if(typeof window === "undefined" || !requests.length) return;
    const taskId = new URLSearchParams(window.location.search).get("task");
    if(!taskId || selected?.id === taskId) return;
    openTaskById(taskId);
  },[requests, selected?.id]);

  useEffect(()=>{
    if(typeof window === "undefined") return;
    const handler = (event: Event) => {
      const taskId = (event as CustomEvent<string>).detail;
      if(taskId) openTaskById(taskId);
    };
    window.addEventListener("bust-open-task", handler as EventListener);
    return () => window.removeEventListener("bust-open-task", handler as EventListener);
  },[requests]);

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
      .filter(row=>!(row.comment.resolvedAt || row.comment.status==="resolved"))
      .filter(row=>row.comment.mentions.length || (row.comment.target !== "Interno" && row.comment.author !== "Sistema"))
      .sort((a,b)=>b.comment.createdAt.localeCompare(a.comment.createdAt));
  },[requests]);

  const mentionOptions = useMemo(()=>{
    const fromUsers = users.map((user)=>({name:user.name, role:user.roleLabel || user.roleKey || user.department || "Usuario", token: makeMentionToken(user.name || user.email)}));
    const fromOrg = organizationTeam.map((member)=>({name:member.name, role:`${member.area} · ${member.role}`, token: makeMentionToken(member.name)}));
    const areas = ["Content","Key Account","Diseño","Audiovisual","Cliente","Interno"].map((name)=>({name, role:"Área", token: makeMentionToken(name)}));
    const merged = [...fromUsers,...fromOrg,...areas].filter(item=>item.name && item.token);
    return Array.from(new Map(merged.map((item)=>[item.token,item])).values()).sort((a,b)=>a.name.localeCompare(b.name,"es"));
  },[users]);

  const filteredMentionOptions = useMemo(()=>{
    if(!mentionSearch) return [];
    const needle = normalizeForMention(mentionSearch);
    return mentionOptions.filter(option => normalizeForMention(option.name).includes(needle) || normalizeForMention(option.token).includes(needle) || normalizeForMention(option.role).includes(needle)).slice(0,8);
  },[mentionSearch, mentionOptions]);

  const overdueCount = filtered.filter(isOverdue).length;

  async function openTask(task:ContentRequest){
    const shouldStart = task.status === "asignada";
    const updatedTask = shouldStart ? {...task,status:"en_revision"} : task;
    setSelected(updatedTask);
    setFinalLink(task.finalPostLink || "");
    if(shouldStart && task.id){
      const nextLog:TaskComment = {
        id:`${Date.now()}`,
        author:"Sistema",
        target:"Interno",
        body:"Tarea abierta por el responsable. Estado actualizado a En revisión.",
        mentions:[],
        createdAt:new Date().toISOString()
      };
      const comments = [...(task.comments||[]), nextLog];
      await updateRequest(task.id,{status:"en_revision",comments});
      setSelected({...updatedTask,comments});
      await load();
    }
  }

  function openTaskById(taskId:string){
    const found = requests.find((item)=>item.id === taskId);
    if(found) openTask(found);
  }

  function closeTask(){
    setSelected(null);
    setContextPost(null);
    setPreview(null);
    if(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("task")){
      window.history.replaceState(null,"","/dashboard/tareas");
    }
  }

  function move(delta:number){
    const next = new Date(cursor);
    if(calendarMode==="semana")next.setDate(next.getDate()+delta*7);
    else next.setMonth(next.getMonth()+delta);
    setCursor(next);
  }

  async function setStatus(status:string){
    if(!selected?.id)return;
    if(status === "pendiente_aprobacion")return alert("Para enviar a aprobación usa el botón Enviar a aprobación y pega el link final.");
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
    const matches = value.match(/@[\wÁÉÍÓÚáéíóúÑñ._-]+/g) || [];
    return Array.from(new Set(matches.map((item)=>item.trim())));
  }

  function handleCommentChange(value:string){
    setComment(value);
    const match = value.match(/(^|\s)@([\wÁÉÍÓÚáéíóúÑñ._-]*)$/);
    setMentionSearch(match ? match[2] : "");
  }

  function insertMention(token:string){
    setComment((current)=>{
      const next = current.replace(/(^|\s)@[\wÁÉÍÓÚáéíóúÑñ._-]*$/, (match, prefix)=>`${prefix}@${token} `);
      return next === current ? `${current} @${token} ` : next;
    });
    setMentionSearch("");
  }

  function handleMentionKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>){
    if((event.key === "Enter" || event.key === "Tab") && mentionSearch && filteredMentionOptions.length === 1){
      event.preventDefault();
      insertMention(filteredMentionOptions[0].token);
    }
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
      status: "open",
      createdAt: new Date().toISOString()
    };
    const comments = [...(selected.comments||[]), nextComment];
    await updateRequest(selected.id,{comments});
    setSelected({...selected,comments});
    setComment("");
    setMentionSearch("");
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
      {[["Tareas",String(filtered.length)],["Vencidas",String(overdueCount)],["Finalizadas",String(requests.filter(x=>x.status==="finalizada").length)],["Persona",person],["Área",area]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <section className="calendar-workspace no-doubts-panel">
      <div>
        {view==="calendario" && (calendarMode==="semana"
          ? <WeekView days={weekDays} tasksByDate={tasksByDate} onOpen={openTask}/>
          : <MonthView days={monthDays} cursor={cursor} tasksByDate={tasksByDate} onOpen={openTask}/>)}

        {view==="lista" && <ListView tasks={filtered} onOpen={openTask}/>}
        {view==="persona" && <PersonView tasks={filtered} onOpen={openTask}/>}
      </div>

    </section>

    {selected && <div className="modal-backdrop">
      <div className="modal-card" style={{width:"min(1120px,96vw)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}>
          <div>
            <p className="eyebrow">Tarea asignada</p>
            <h2 style={{margin:"0 0 4px"}}>{selected.clientName} · {selected.contentType}</h2>
            <p className="mini">Fecha operativa: {getTaskDate(selected)||"Sin fecha"} · Publica: {selected.publishDate||"Sin fecha"} · Lote: {selected.batchName||"Sin lote"}</p>
          </div>
          <button className="btn red" onClick={closeTask}>Cerrar</button>
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
              <h4>Mandar a aprobación</h4>
              <p className="mini">Para mandar a aprobación debes pegar el link final del post en Drive.</p>
              <input value={finalLink} onChange={e=>setFinalLink(e.target.value)} placeholder="Link final de Drive"/>
              <button className="btn blue" style={{marginTop:10}} onClick={sendToApproval}>Enviar a aprobación</button>
            </div> : <div className="finalize-box">
              <h4>Tarea cerrada</h4>
              <p className="mini">Esta tarea ya fue aprobada y finalizada. Se conserva como historial.</p>
              {selected.finalPostLink && <a className="link-card" href={normalizeExternalUrl(selected.finalPostLink)} target="_blank"><span>{selected.finalPostLink}</span><small>Abrir →</small></a>}
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
              <h4>Comentarios y @menciones</h4>
              <div className="field">
                <label>Comentario</label>
                <div className="mention-input-wrap">
                  <textarea value={comment} onChange={e=>handleCommentChange(e.target.value)} onKeyDown={handleMentionKeyDown} placeholder="Escribe un comentario. Usa @ para mencionar a una persona o área; Enter completa la única coincidencia."/>
                  {!!filteredMentionOptions.length && <div className="mention-suggestions">
                    {filteredMentionOptions.map(option=><button type="button" key={option.token} onClick={()=>insertMention(option.token)}>
                      <strong>@{option.token}</strong>
                      <span>{option.name} · {option.role}</span>
                    </button>)}
                  </div>}
                </div>
              </div>
              <button className="btn blue" onClick={addComment}>Agregar comentario</button>

              <div style={{marginTop:14}}>
                {((selected.comments||[]).slice().reverse()).map(c=><div className={`comment-box ${c.resolvedAt || c.status==="resolved" ? "resolved" : ""}`} key={c.id}>
                  <strong>{c.author} → {c.target}</strong>
                  <span className="mini">{new Date(c.createdAt).toLocaleString("es-MX")}</span>
                  <p>{c.body}</p>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{c.mentions.map(m=><span className="mention" key={m}>{m}</span>)}</div>
                  {(c.resolvedAt || c.status==="resolved") && <span className="resolved-badge">Resuelto{c.resolvedBy ? ` por ${c.resolvedBy}` : ""}</span>}
                </div>)}
                {!(selected.comments||[]).length && <p className="mini">Sin comentarios todavía.</p>}
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


function normalizeForMention(value:string){
  return (value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]+/g, "");
}

function makeMentionToken(value:string){
  return normalizeForMention(value).slice(0,40);
}

function normalizeExternalUrl(value?:string){
  const url=(value||"").trim();
  if(!url)return "#";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
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
      {isImageFile(file)?<img src={file.url} alt="Referencia"/>:isVideoFile(file)?<video src={file.url} muted playsInline preload="metadata"/>:<span>Archivo</span>}
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
      {isImageFile(file)?<img src={file.url} alt={file.name}/>:isVideoFile(file)?<video src={file.url} controls playsInline/>:<p>Archivo no previsualizable.</p>}
    </div>
  </div>;
}
