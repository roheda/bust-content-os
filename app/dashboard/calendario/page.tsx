"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { ContentRequest, Production, ReferenceFile, TaskComment, isImageFile, listProductions, listRequests, updateRequest } from "@/lib/data";

const people = ["Todos","Ana Diseño","Luis Diseño","Carlos Editor","Mariana Editora","Pedro Video","Mafer KAM","Rodrigo"];
const areas = ["Todas","Diseño","Audiovisual","Copy","Mixto"];
const commentTargets = ["Content","Key Account","Diseño","Audiovisual","Cliente","Interno"];
const statuses = [
  ["asignada","Asignada"],
  ["en_ejecucion","En proceso"],
  ["en_revision","En revisión"],
  ["finalizada","Finalizada"],
  ["programada","Programada"],
  ["publicada","Publicada"]
];

export default function CalendarPage(){
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [productions,setProductions]=useState<Production[]>([]);
  const [mode,setMode]=useState<"semana"|"mes">("semana");
  const [cursor,setCursor]=useState(new Date());
  const [person,setPerson]=useState("Todos");
  const [area,setArea]=useState("Todas");
  const [selected,setSelected]=useState<ContentRequest|null>(null);
  const [comment,setComment]=useState("");
  const [commentTarget,setCommentTarget]=useState("Content");
  const [preview,setPreview]=useState<ReferenceFile|null>(null);

  async function load(){
    setRequests(await listRequests());
    setProductions(await listProductions());
  }

  useEffect(()=>{load()},[]);

  const filtered = useMemo(()=>requests.filter(x=>
    (person==="Todos"||x.assignedTo===person) &&
    (area==="Todas"||x.assignedArea===area||x.suggestedArea===area)
  ),[requests,person,area]);

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

  function move(delta:number){
    const next = new Date(cursor);
    if(mode==="semana")next.setDate(next.getDate()+delta*7);
    else next.setMonth(next.getMonth()+delta);
    setCursor(next);
  }

  function today(){
    setCursor(new Date());
  }

  async function setStatus(status:string){
    if(!selected?.id)return;
    await updateRequest(selected.id,{status});
    const updated = {...selected,status};
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

  return <AppShell active="Calendario">
    <section className="hero">
      <div>
        <p className="eyebrow">Equipo</p>
        <h1>Calendario</h1>
        <p>Panel semanal/mensual para trabajar tareas asignadas, resolver dudas y cerrar piezas.</p>
      </div>
    </section>

    <div className="calendar-controls">
      <button className={mode==="semana"?"active":""} onClick={()=>setMode("semana")}>Semana</button>
      <button className={mode==="mes"?"active":""} onClick={()=>setMode("mes")}>Mes</button>
      <button onClick={()=>move(-1)}>← Anterior</button>
      <button onClick={today}>Hoy</button>
      <button onClick={()=>move(1)}>Siguiente →</button>
      <select value={person} onChange={e=>setPerson(e.target.value)}>{people.map(x=><option key={x}>{x}</option>)}</select>
      <select value={area} onChange={e=>setArea(e.target.value)}>{areas.map(x=><option key={x}>{x}</option>)}</select>
    </div>

    <section className="grid kpis">
      {[["Tareas filtradas",String(filtered.length)],["Semana",formatRange(weekDays[0],weekDays[6])],["Producciones",String(productions.length)],["Dudas",String(mentionsFeed.length)],["Persona",person],["Área",area]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <section className="calendar-workspace">
      <div>
        {mode==="semana" ? <WeekView days={weekDays} tasksByDate={tasksByDate} onOpen={setSelected}/> : <MonthView days={monthDays} cursor={cursor} tasksByDate={tasksByDate} onOpen={setSelected}/>}
      </div>

      <aside className="chat-panel">
        <h3>Panel de dudas / menciones</h3>
        <p className="mini">Comentarios con @menciones o dirigidos a Content / Key Account.</p>
        {!mentionsFeed.length && <p className="mini">Aún no hay dudas activas.</p>}
        {mentionsFeed.slice(0,30).map(({request,comment})=><button className="chat-item" key={`${request.id}-${comment.id}`} onClick={()=>setSelected(request)}>
          <strong>{request.clientName} · {request.contentType}</strong>
          <span className="mini">Para: {comment.target} · {new Date(comment.createdAt).toLocaleString("es-MX")}</span>
          <p>{comment.body}</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{comment.mentions.map(m=><span className="mention" key={m}>{m}</span>)}</div>
        </button>)}
      </aside>
    </section>

    {selected && <div className="modal-backdrop">
      <div className="modal-card" style={{width:"min(1050px,96vw)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}>
          <div>
            <p className="eyebrow">Tarea asignada</p>
            <h2 style={{margin:"0 0 4px"}}>{selected.clientName} · {selected.contentType}</h2>
            <p className="mini">Fecha operativa: {getTaskDate(selected)||"Sin fecha"} · Publica: {selected.publishDate||"Sin fecha"}</p>
          </div>
          <button className="btn red" onClick={()=>setSelected(null)}>Cerrar</button>
        </div>

        <div className="task-modal-grid">
          <div>
            <div className="detail-section">
              <h4>Estado de trabajo</h4>
              <div className="status-buttons">
                {statuses.map(([value,label])=><button key={value} className={selected.status===value?"active":""} onClick={()=>setStatus(value)}>{label}</button>)}
              </div>
            </div>

            <div className="detail-section">
              <h4>Idea creativa</h4>
              <div className="detail-copy">{selected.creativeIdea||"Sin idea"}</div>
            </div>

            <div className="detail-section">
              <h4>Copy In / Mensaje</h4>
              <div className="detail-copy">
                <strong>Copy:</strong> {selected.copyIn||"Sin copy"}{"\n"}
                <strong>Mensaje:</strong> {selected.keyMessage||"Sin mensaje"}{"\n"}
                <strong>CTA:</strong> {selected.cta||"Sin CTA"}
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
                {((selected.comments||[]).slice().reverse()).map(c=><div className="comment-box" key={c.id}>
                  <strong>{c.author} → {c.target}</strong>
                  <span className="mini">{new Date(c.createdAt).toLocaleString("es-MX")}</span>
                  <p>{c.body}</p>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{c.mentions.map(m=><span className="mention" key={m}>{m}</span>)}</div>
                </div>)}
                {!(selected.comments||[]).length && <p className="mini">Sin comentarios todavía.</p>}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>}

    {preview && <PreviewModal file={preview} onClose={()=>setPreview(null)}/>}
  </AppShell>
}

function getTaskDate(item:ContentRequest){
  return item.dueDate || item.batchDueDate || item.publishDate || "";
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

function formatRange(a:Date,b:Date){
  return `${a.toLocaleDateString("es-MX",{day:"numeric",month:"short"})} - ${b.toLocaleDateString("es-MX",{day:"numeric",month:"short"})}`;
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
    {tasks.map(task=><button className="task-chip" key={task.id} onClick={()=>onOpen(task)}>
      <strong>{task.clientName}</strong>
      <span>{task.contentType} · {task.assignedTo||"Sin asignar"}</span>
      <span className="mini-status">{task.status}</span>
    </button>)}
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
