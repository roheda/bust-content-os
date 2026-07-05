"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  ClientOperationalOverride,
  ContentRequest,
  OperationalContentRule,
  PlatformUser,
  Production,
  ReferenceFile,
  TaskComment,
  TeamDailyCapacity,
  businessDaysBetween,
  getCapacityForPerson,
  getCapacityTone,
  getEffectiveWorkDate,
  getOperationalPlan,
  isImageFile,
  isVideoFile,
  listClientOperationalOverrides,
  listOperationalContentRules,
  listProductions,
  listRequests,
  listTeamDailyCapacities,
  listUsers,
  organizationTeam,
  todayDateKey,
  updateRequest
} from "@/lib/data";

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
  const [costRules,setCostRules]=useState<OperationalContentRule[]>([]);
  const [clientOverrides,setClientOverrides]=useState<ClientOperationalOverride[]>([]);
  const [teamCapacities,setTeamCapacities]=useState<TeamDailyCapacity[]>([]);
  const [carryOverCount,setCarryOverCount]=useState(0);
  const [view,setView]=useState<"hoy"|"calendario"|"lista"|"persona">("hoy");
  const [calendarMode,setCalendarMode]=useState<"semana"|"mes">("semana");
  const [cursor,setCursor]=useState(new Date());
  const [person,setPerson]=useState("Todos");
  const [area,setArea]=useState("Todas");
  const [statusFilter,setStatusFilter]=useState("all");
  const [workflowFilter,setWorkflowFilter]=useState("pending");
  const [overdueFilter,setOverdueFilter]=useState("all");
  const [selected,setSelected]=useState<ContentRequest|null>(null);
  const [comment,setComment]=useState("");
  const [mentionSearch,setMentionSearch]=useState("");
  const [commentTarget,setCommentTarget]=useState("Interno");
  const [finalLink,setFinalLink]=useState("");
  const [preview,setPreview]=useState<ReferenceFile|null>(null);
  const [contextPost,setContextPost]=useState<ContentRequest|null>(null);

  async function load(){
    const [loadedRequests, loadedProductions, loadedUsers, loadedRules, loadedOverrides, loadedCapacities] = await Promise.all([
      listRequests(),
      listProductions(),
      listUsers().catch(()=>[]),
      listOperationalContentRules(),
      listClientOperationalOverrides(),
      listTeamDailyCapacities()
    ]);
    setCostRules(loadedRules);
    setClientOverrides(loadedOverrides);
    setTeamCapacities(loadedCapacities);
    const normalized = await autoCarryOverTasks(loadedRequests, loadedRules, loadedOverrides);
    setCarryOverCount(normalized.carried);
    setRequests(normalized.items);
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
    const taskStates = ["asignada","en_revision","rebotada","pendiente_aprobacion","pendiente_aprobacion_kam","aprobada_pendiente_copyout","finalizada"].includes(x.status || "") && x.status !== "eliminada";
    const overdue = isOverdue(x);
    const workflowOk =
      workflowFilter==="all" ? true :
      workflowFilter==="pending" ? ["asignada","en_revision","rebotada","pendiente_aprobacion","pendiente_aprobacion_kam","aprobada_pendiente_copyout"].includes(x.status||"") :
      workflowFilter==="active" ? ["asignada","en_revision"].includes(x.status||"") :
      workflowFilter==="approval" ? ["pendiente_aprobacion","pendiente_aprobacion_kam"].includes(x.status||"") :
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

  const todayKeyValue = todayDateKey();
  const todayTasks = filtered.filter(task=>getTaskDate(task) === todayKeyValue);
  const finishedCount = filtered.filter(task=>task.status === "finalizada").length;

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
  const selectedTimeline = selected ? buildTaskTimeline(selected, batchContext) : [];

  return <AppShell active="Tareas">
    <section className="hero tasks-hero">
      <div>
        <p className="eyebrow">Equipo</p>
        <h1>Tareas</h1>
        <p>Trabajo diario del equipo: calendario, lista, vista por persona, comentarios, vencimientos y envío a aprobación.</p>
      </div>
    </section>

    <div className="tasks-toolbar" aria-label="Controles compactos de tareas">
      <div className="view-switch task-view-switch">
        <button className={view==="hoy"?"active":""} onClick={()=>setView("hoy")}>Hoy</button>
        <button className={view==="calendario"?"active":""} onClick={()=>setView("calendario")}>Calendario</button>
        <button className={view==="lista"?"active":""} onClick={()=>setView("lista")}>Lista</button>
        <button className={view==="persona"?"active":""} onClick={()=>setView("persona")}>Por persona</button>
      </div>

      <div className="calendar-controls task-calendar-controls">
      {view==="calendario" && <>
        <span className="calendar-current-label">{formatCalendarLabel(cursor, calendarMode)}</span>
        <button className={calendarMode==="semana"?"active":""} onClick={()=>setCalendarMode("semana")}>Semana</button>
        <button className={calendarMode==="mes"?"active":""} onClick={()=>setCalendarMode("mes")}>Mes</button>
        <button onClick={()=>move(-1)}>← Anterior</button>
        <button onClick={()=>setCursor(new Date())}>Hoy</button>
        <button onClick={()=>move(1)}>Siguiente →</button>
        <span className="mini workdays-note">Solo días hábiles</span>
      </>}
      <select value={person} onChange={e=>setPerson(e.target.value)}>{people.map(x=><option key={x}>{x}</option>)}</select>
      <select value={area} onChange={e=>setArea(e.target.value)}>{areas.map(x=><option key={x}>{x}</option>)}</select>
      <select value={workflowFilter} onChange={e=>setWorkflowFilter(e.target.value)}>
        <option value="pending">Pendientes</option>
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
    </div>

    <section className="grid kpis tasks-kpis">
      {[["Hoy",String(todayTasks.length)],["Pendientes",String(filtered.filter(x=>!["finalizada","pendiente_aprobacion","pendiente_aprobacion_kam","aprobada_pendiente_copyout"].includes(x.status||"")).length)],["Vencidas",String(overdueCount)],["Arrastradas",String(carryOverCount || filtered.filter(x=>isCarriedTask(x)).length)],["Finalizadas",String(finishedCount)],["Filtro",person==="Todos"?area:person]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>


    <section className="calendar-workspace no-doubts-panel">
      <div>
        {view==="hoy" && <TodayView tasks={filtered} onOpen={openTask}/>}

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
            <p className="mini">Trabajar: {getTaskDate(selected)||"Sin fecha"} · Límite interno: {selected.internalDueDate||selected.dueDate||"Sin fecha"} · Publica: {selected.publishDate||selected.clientDueDate||"Sin fecha"} · Lote: {selected.batchName||"Sin lote"}</p>
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
              <input className="drive-link-input" value={finalLink} onChange={e=>setFinalLink(e.target.value)} placeholder="Pega aquí el link de Drive, Canva, archivo o carpeta"/>
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
            <div className="detail-section task-log-section">
              <h4>Log de tarea</h4>
              <p className="mini">Historia completa: creación, lote, asignación, cambios y avances.</p>
              <div className="task-log-list">
                {selectedTimeline.map((event,index)=><div className="task-log-item" key={`${event.date}-${index}`}>
                  <strong>{event.title}</strong>
                  <span className="mini">{event.date ? new Date(event.date).toLocaleString("es-MX") : "Sin fecha"}</span>
                  <p>{event.body}</p>
                </div>)}
              </div>
            </div>

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


type TaskTimelineEvent = { title:string; body:string; date:string };

function buildTaskTimeline(item:ContentRequest, batchContext:ContentRequest[] = []): TaskTimelineEvent[]{
  const nowish = item.rejectedAt || item.generatorSentAt || (item as any).updatedAt || (item as any).createdAt || item.publishDate || "";
  const events:TaskTimelineEvent[] = [];
  events.push({
    title:"Solicitud creada",
    date:String((item as any).createdAt?.toDate?.()?.toISOString?.() || item.publishDate || nowish || new Date().toISOString()),
    body:`Cliente: ${item.clientName || "Sin cliente"}. Lote: ${item.batchName || "Sin lote"}. Tipo: ${item.contentType || "Sin tipo"}. Publicación: ${item.publishDate || "Sin fecha"}.`
  });
  if(item.batchName || item.batchId){
    events.push({title:"Lote relacionado",date:String(item.batchDueDate || item.publishDate || nowish || ""),body:`${item.batchName || "Sin lote"}. Solicitudes del lote: ${batchContext.length || item.total || 1}. Fecha límite: ${item.batchDueDate || "Sin fecha"}.`});
  }
  if(item.assignedTo || item.assignedArea){
    events.push({title:"Asignación actual",date:String(item.plannedWorkDate || item.internalDueDate || item.dueDate || nowish || ""),body:`Asignado a: ${item.assignedTo || "Sin responsable"}. Área: ${item.assignedArea || item.suggestedArea || "Sin área"}. Prioridad: ${item.priority || "Media"}.`});
  }
  if(item.finalPostLink){
    events.push({title:"Link de entrega",date:String((item as any).updatedAt || nowish || ""),body:item.finalPostLink});
  }
  if(item.generatorSentAt){
    events.push({title:"Envío a BUST It Now",date:item.generatorSentAt,body:item.generatorNotes || "La tarea fue enviada al generador."});
  }
  if(item.rejectionNote){
    events.push({title:"Rechazo / rebote",date:item.rejectedAt || nowish || "",body:item.rejectionNote});
  }
  (item.comments || []).forEach(comment=>{
    events.push({title:`${comment.author} → ${comment.target}`,date:comment.createdAt,body:comment.body});
  });
  return events
    .filter(event=>event.title || event.body)
    .sort((a,b)=>String(b.date || "").localeCompare(String(a.date || "")));
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


async function autoCarryOverTasks(items:ContentRequest[], rules:OperationalContentRule[], overrides:ClientOperationalOverride[]){
  const today = todayDateKey();
  const closeds = ["pendiente_aprobacion","pendiente_aprobacion_kam","aprobada_pendiente_copyout","aprobada","finalizada","programada","publicada","cancelada","eliminada"];
  const stale = items.filter(item=>item.id && item.plannedWorkDate && item.plannedWorkDate < today && !closeds.includes(item.status||""));
  if(!stale.length) return {items, carried:0};
  await Promise.all(stale.map(item=>{
    const original = item.carriedOverFromDate || item.plannedWorkDate || today;
    const days = Math.max(1, Math.abs(businessDaysBetween(original,today)));
    const plan = getOperationalPlan(item,rules,overrides);
    return updateRequest(item.id!,{
      plannedWorkDate: today,
      carriedOver: true,
      carriedOverFromDate: original,
      carriedOverDays: days,
      operationalWeight: 1,
      operationalRisk: "orange"
    });
  }));
  const updated = items.map(item=> stale.some(staleItem=>staleItem.id===item.id)
    ? {...item,plannedWorkDate:today,carriedOver:true,carriedOverFromDate:item.carriedOverFromDate||item.plannedWorkDate,carriedOverDays:Math.max(1,Math.abs(businessDaysBetween(item.carriedOverFromDate||item.plannedWorkDate||today,today))),operationalRisk:"orange" as const}
    : item);
  return {items:updated, carried:stale.length};
}

function isClosedTask(item:ContentRequest){
  return ["pendiente_aprobacion","pendiente_aprobacion_kam","aprobada_pendiente_copyout","aprobada","finalizada","programada","publicada","cancelada","eliminada"].includes(item.status||"");
}

function isCarriedTask(item:ContentRequest){
  return Boolean(item.carriedOver || (item.plannedWorkDate && item.plannedWorkDate < todayDateKey() && !isClosedTask(item)));
}

function buildCapacitySummary(tasks:ContentRequest[], capacities:TeamDailyCapacity[], rules:OperationalContentRule[], overrides:ClientOperationalOverride[]){
  const active = tasks.filter(task=>!isClosedTask(task));
  const grouped:Record<string,{person:string;date:string;load:number;capacity:number;carried:number;tasks:ContentRequest[]}> = {};
  active.forEach(task=>{
    const person = task.assignedTo || "Sin asignar";
    const area = task.assignedArea || task.suggestedArea || "";
    const date = getTaskDate(task) || todayDateKey();
    const key = `${person}__${date}`;
    const plan = getOperationalPlan(task,rules,overrides);
    grouped[key] = grouped[key] || {person,date,load:0,capacity:getCapacityForPerson(person,area,capacities),carried:0,tasks:[]};
    grouped[key].load += 1;
    grouped[key].carried += isCarriedTask(task) ? 1 : 0;
    grouped[key].tasks.push(task);
  });
  const rows = Object.values(grouped).map(row=>({ ...row, tone:getCapacityTone(row.load,row.capacity) }))
    .sort((a,b)=>a.date.localeCompare(b.date) || b.tone.ratio - a.tone.ratio || a.person.localeCompare(b.person,"es"))
    .slice(0,18);
  return {rows, overloadedCount:rows.filter(row=>row.tone.tone==="orange" || row.tone.tone==="red").length};
}

function CapacityLoadPanel({rows}:{rows:ReturnType<typeof buildCapacitySummary>["rows"]}){
  return <section className="card capacity-load-panel">
    <div className="capacity-panel-head"><div><p className="eyebrow">Capacidad diaria</p><h3>Semáforo de cuellos de botella</h3></div><span className="mini">Lo no cerrado se arrastra al día siguiente y consume capacidad.</span></div>
    {!rows.length ? <p className="mini">No hay tareas activas para calcular carga.</p> : <div className="capacity-load-grid">
      {rows.map(row=><div className={`capacity-load-card ${row.tone.tone}`} key={`${row.person}-${row.date}`}>
        <div><strong>{row.person}</strong><span>{row.date}</span></div>
        <b>{row.load.toFixed(1)} / {row.capacity}</b>
        <small>{row.tone.label} · {Math.round(row.tone.ratio*100)}% {row.carried ? `· ${row.carried} arrastrada(s)` : ""}</small>
      </div>)}
    </div>}
  </section>;
}

function statusLabel(status:string){
  const labels:Record<string,string> = {
    asignada: "Asignada",
    en_revision: "En revisión",
    rebotada: "Rebotada",
    pendiente_aprobacion: "Aprobación Content",
    pendiente_aprobacion_kam: "Aprobación KAM",
    aprobada_pendiente_copyout: "En Contenidos",
    aprobada: "Aprobada",
    finalizada: "Finalizada"
  };
  return labels[status] || status;
}

function getTaskDate(item:ContentRequest){
  return getEffectiveWorkDate(item);
}

function isOverdue(item:ContentRequest){
  const date = item.internalDueDate || item.dueDate || item.batchDueDate || item.publishDate || "";
  if(!date)return false;
  const today = todayDateKey();
  return date < today && !["pendiente_aprobacion","pendiente_aprobacion_kam","aprobada_pendiente_copyout","aprobada","finalizada"].includes(item.status||"");
}

function key(date:Date){
  return date.toISOString().slice(0,10);
}

function getWeekDays(date:Date){
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate()+diff);
  return Array.from({length:5}).map((_,i)=>{
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
  }).filter(day=>day.getDay() !== 0 && day.getDay() !== 6);
}


function formatCalendarLabel(date: Date, mode: "semana" | "mes") {
  const formatter = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });
  if (mode === "mes") return formatter.format(date).replace(/^./, (c) => c.toUpperCase());
  const days = getWeekDays(date);
  const start = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(days[0]);
  const end = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(days[days.length-1]);
  return `Semana ${start} – ${end}`;
}

function TodayView({tasks,onOpen}:{tasks:ContentRequest[];onOpen:(item:ContentRequest)=>void}){
  const today = todayDateKey();
  const active = tasks.filter(task=>!isClosedTask(task));
  const carried = active.filter(task=>isCarriedTask(task) || isOverdue(task)).sort(sortDailyTasks);
  const todayList = active.filter(task=>getTaskDate(task) === today && !carried.some(item=>item.id===task.id)).sort(sortDailyTasks);
  const nextList = active.filter(task=>getTaskDate(task) > today).sort(sortDailyTasks).slice(0,10);
  return <div className="daily-workspace">
    <section className="daily-focus-card today-main-card">
      <div className="daily-card-head"><div><p className="eyebrow">Trabajo diario</p><h3>Para trabajar hoy</h3></div><span className="pill green">{todayList.length} tarea(s)</span></div>
      {todayList.map(task=><DailyTaskCard key={task.id} task={task} onOpen={onOpen}/>) }
      {!todayList.length && <p className="mini">No hay tareas programadas para hoy con estos filtros.</p>}
    </section>
    <section className="daily-focus-card urgent-card">
      <div className="daily-card-head"><div><p className="eyebrow">Prioridad</p><h3>Arrastradas o vencidas</h3></div><span className={carried.length ? "pill orange" : "pill green"}>{carried.length}</span></div>
      {carried.map(task=><DailyTaskCard key={task.id} task={task} onOpen={onOpen} compact/>) }
      {!carried.length && <p className="mini">Sin arrastres ni vencidas. Buen ritmo.</p>}
    </section>
    <section className="daily-focus-card next-card">
      <div className="daily-card-head"><div><p className="eyebrow">Próximo</p><h3>Siguientes tareas</h3></div><span className="pill">{nextList.length}</span></div>
      {nextList.map(task=><DailyTaskCard key={task.id} task={task} onOpen={onOpen} compact/>) }
      {!nextList.length && <p className="mini">No hay próximas tareas con estos filtros.</p>}
    </section>
  </div>;
}

function DailyTaskCard({task,onOpen,compact=false}:{task:ContentRequest;onOpen:(item:ContentRequest)=>void;compact?:boolean}){
  const carried = isCarriedTask(task);
  const overdue = isOverdue(task);
  return <button className={`daily-task-card ${compact ? "compact" : ""} ${carried ? "carried" : ""} ${overdue ? "overdue" : ""}`} onClick={()=>onOpen(task)}>
    <div>
      <strong>{task.clientName} · {task.contentType}</strong>
      <span>{task.assignedTo || "Sin responsable"} · {task.assignedArea || task.suggestedArea || "Sin área"}</span>
    </div>
    <div className="daily-task-dates">
      <b>{carried ? "Arrastrada" : overdue ? "Vencida" : "Trabajar"}</b>
      <span>{getTaskDate(task)||"Sin fecha"}</span>
    </div>
    {!compact && <p>{task.creativeIdea || task.topic || "Sin detalle creativo"}</p>}
  </button>;
}

function sortDailyTasks(a:ContentRequest,b:ContentRequest){
  const carriedScore = Number(isCarriedTask(b) || isOverdue(b)) - Number(isCarriedTask(a) || isOverdue(a));
  if(carriedScore) return carriedScore;
  const dateCompare = (getTaskDate(a)||"").localeCompare(getTaskDate(b)||"");
  if(dateCompare) return dateCompare;
  return (a.clientName||"").localeCompare(b.clientName||"","es");
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
  return <div className={variant==="week"?"week-day":"month-day"} style={{opacity:muted ? .55 : 1}}>
    <div className="day-title"><strong>{label} {date.getDate()}</strong><span>{tasks.length}</span></div>
    {tasks.map(task=><TaskChip task={task} onOpen={onOpen} key={task.id}/>)}
  </div>;
}

function TaskChip({task,onOpen}:{task:ContentRequest;onOpen:(item:ContentRequest)=>void}){
  const overdue = isOverdue(task);
  const done = ["pendiente_aprobacion","aprobada","finalizada"].includes(task.status||"");
  const carried = isCarriedTask(task);
  return <button className={`task-chip ${overdue?"overdue":""} ${done?"done":""} ${carried?"carried":""}`} onClick={()=>onOpen(task)}>
    <strong>{task.clientName}</strong>
    <span>{task.contentType} · {task.assignedTo||"Sin asignar"}</span>
    <span className="mini-status">{carried ? `ARRASTRADA ${task.carriedOverDays||1}d` : overdue ? "VENCIDA" : statusLabel(task.status||"")}</span>
  </button>;
}

function ListView({tasks,onOpen}:{tasks:ContentRequest[];onOpen:(item:ContentRequest)=>void}){
  if(!tasks.length)return <div className="card"><p>No hay tareas con estos filtros.</p></div>;
  return <div>{tasks.sort((a,b)=>getTaskDate(a).localeCompare(getTaskDate(b))).map(task=><button className={`list-task-card ${isOverdue(task)?"task-chip overdue":""}`} key={task.id} onClick={()=>onOpen(task)}>
    <strong>{task.clientName} · {task.contentType}</strong>
    <span className="mini">Trabajar: {getTaskDate(task)||"Sin fecha"} · Interna: {task.internalDueDate||task.dueDate||"Sin fecha"} · Responsable: {task.assignedTo||"Sin asignar"} · Estado: {isOverdue(task) ? "VENCIDA" : statusLabel(task.status||"")}</span>
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

function EfficiencyView({tasks,onOpen}:{tasks:ContentRequest[];onOpen:(item:ContentRequest)=>void}){
  const actionable = tasks.filter(task=>!["finalizada","pendiente_aprobacion","pendiente_aprobacion_kam","aprobada_pendiente_copyout"].includes(task.status||""));
  const ranked = actionable.map(task=>({task,score:efficiencyScore(task),reason:efficiencyReason(task)})).sort((a,b)=>b.score-a.score || getTaskDate(a.task).localeCompare(getTaskDate(b.task))).slice(0,12);
  const groupedByType = actionable.reduce((acc:Record<string,ContentRequest[]>,task)=>{
    const key = `${task.assignedArea || task.suggestedArea || "Sin área"} · ${task.contentType || "Sin tipo"}`;
    acc[key]=acc[key]||[];
    acc[key].push(task);
    return acc;
  },{});
  const risks = actionable.filter(task=>isOverdue(task) || (task.priority||"")==="Urgente" || !task.finalPostLink && task.status==="en_revision").slice(0,6);
  return <div className="efficiency-panel">
    <div className="efficiency-hero card">
      <p className="eyebrow">Asistente operativo</p>
      <h3>Orden sugerido de trabajo</h3>
      <p className="mini">Esta vista ayuda a Diseño y Audiovisual a decidir qué trabajar primero según vencimiento, prioridad, estado y bloqueos. Es una guía para mejorar foco, no reemplaza criterio del líder.</p>
    </div>
    <div className="grid two-col">
      <section className="card">
        <h3>Haz primero</h3>
        {ranked.map(({task,reason},index)=><button className="efficiency-task" type="button" key={task.id} onClick={()=>onOpen(task)}>
          <span className="efficiency-rank">{index+1}</span>
          <div><strong>{task.clientName} · {task.contentType}</strong><p>{reason}</p><span className="mini text-clamp-1">{task.creativeIdea || task.copyIn || "Sin detalle"}</span></div>
        </button>)}
        {!ranked.length && <p className="mini">No hay tareas activas por priorizar.</p>}
      </section>
      <section className="card">
        <h3>Bloques de trabajo sugeridos</h3>
        {Object.entries(groupedByType).slice(0,8).map(([key,items])=><div className="efficiency-block" key={key}>
          <strong>{key}</strong>
          <span>{items.length} pieza(s). Conviene trabajarlas juntas para reducir cambios de contexto.</span>
        </div>)}
        {!Object.keys(groupedByType).length && <p className="mini">Sin bloques sugeridos.</p>}
      </section>
    </div>
    <section className="card">
      <h3>Riesgos a revisar</h3>
      <div className="table-wrap"><table className="table"><thead><tr><th>Tarea</th><th>Responsable</th><th>Fecha operativa</th><th>Riesgo</th></tr></thead><tbody>
        {risks.map(task=><tr key={task.id}><td><strong>{task.clientName}</strong><br/><span className="mini text-clamp-1">{task.contentType} · {task.objective}</span></td><td>{task.assignedTo||"Sin asignar"}</td><td>{getTaskDate(task)||"Sin fecha"}</td><td>{efficiencyReason(task)}</td></tr>)}
      </tbody></table></div>
      {!risks.length && <p className="mini">No hay riesgos fuertes con los filtros actuales.</p>}
    </section>
  </div>;
}

function efficiencyScore(task:ContentRequest){
  let score = 0;
  if(isOverdue(task)) score += 100;
  if((task.priority||"") === "Urgente") score += 60;
  if((task.priority||"") === "Alta") score += 35;
  if(task.status === "rebotada") score += 45;
  if(task.status === "en_revision") score += 25;
  const date = getTaskDate(task);
  if(date){
    const today = new Date();
    const due = new Date(`${date}T12:00:00`);
    const days = Math.ceil((due.getTime()-today.getTime())/86400000);
    if(days <= 0) score += 40;
    else if(days <= 1) score += 30;
    else if(days <= 3) score += 18;
    else if(days <= 5) score += 8;
  }else score += 10;
  return score;
}

function efficiencyReason(task:ContentRequest){
  if(isOverdue(task)) return "Vencida: atender o justificar hoy.";
  if(task.status === "rebotada") return "Rebotada: corregir antes de tomar nuevas piezas.";
  if((task.priority||"") === "Urgente") return "Urgente: priorizar en el primer bloque del día.";
  if(task.status === "en_revision" && !task.finalPostLink) return "En revisión sin link final: cerrar entregable.";
  const date = getTaskDate(task);
  if(date){
    const today = new Date();
    const due = new Date(`${date}T12:00:00`);
    const days = Math.ceil((due.getTime()-today.getTime())/86400000);
    if(days <= 1) return "Entrega próxima: conviene cerrar hoy.";
    if(days <= 3) return "Entrega cercana: avanzar antes de que se vuelva urgente.";
  }
  return "Buen candidato para agrupar por cliente/tipo.";
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
