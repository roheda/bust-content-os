"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Brand, deleteBrand, listBrands, saveBrand, updateBrand } from "@/lib/data";

const empty: Brand = {
  name: "",
  industry: "",
  tone: "",
  audience: "",
  platforms: ["Instagram", "Facebook", "TikTok"],
  posts: 15,
  reels: 4,
  productions: 1,
  month: "2026-06",
  brandNotes: "",
  status: "activo",
  accountOwner: "",
  contactName: "",
  contactRole: "",
  contactEmail: "",
  contactPhone: "",
  website: "",
  instagram: "",
  location: "",
  packageName: "Content",
  services: ["Content OS", "BUST It Now"],
  brandPersonality: "",
  visualStyle: "",
  contentPillars: "",
  sharedSystems: ["BUST Content OS", "BUST It Now"],
  bustItNowStatus: "activo"
};

const serviceOptions = ["Content OS", "BUST It Now", "Social Media", "Ads", "Producción", "Diseño", "Copy", "CRM"];

export default function ClientsPage(){
  const [items,setItems]=useState<Brand[]>([]);
  const [form,setForm]=useState<Brand>(empty);
  const [editing,setEditing]=useState("");
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");

  async function load(){setItems(await listBrands())}
  useEffect(()=>{load()},[]);

  function set(k:keyof Brand,v:any){setForm({...form,[k]:v})}

  function toggleService(service:string){
    const current = form.services || [];
    set("services", current.includes(service) ? current.filter(x=>x!==service) : [...current,service]);
  }

  async function submit(){
    if(!form.name)return alert("Agrega nombre");
    const payload = {
      ...form,
      sharedSystems: ["BUST Content OS", "BUST It Now"],
      bustItNowStatus: form.bustItNowStatus || "activo"
    };
    if(editing){await updateBrand(editing,payload)} else {await saveBrand(payload)}
    setForm(empty);
    setEditing("");
    await load();
  }

  function edit(x:Brand){
    setForm({
      ...empty,
      ...x,
      sharedSystems: x.sharedSystems || ["BUST Content OS", "BUST It Now"],
      services: x.services || ["Content OS", "BUST It Now"]
    });
    setEditing(x.id||"");
  }

  async function remove(id?:string){
    if(id&&confirm("¿Eliminar cliente? Esto solo debe usarse si fue dado de alta por error.")){
      await deleteBrand(id);
      await load();
    }
  }

  const filtered = useMemo(()=>items.filter(x=>{
    const text = `${x.name} ${x.industry} ${x.tone} ${x.accountOwner} ${x.contactName} ${x.packageName}`.toLowerCase();
    return (!search.trim() || text.includes(search.trim().toLowerCase())) &&
      (statusFilter==="all" || (x.status||"activo")===statusFilter);
  }),[items,search,statusFilter]);

  const totals = {
    clients: items.length,
    active: items.filter(x=>(x.status||"activo")==="activo").length,
    bustItNow: items.filter(x=>(x.services||[]).includes("BUST It Now") || (x.sharedSystems||[]).includes("BUST It Now")).length
  };

  return <AppShell active="Clientes">
    <section className="hero">
      <div>
        <p className="eyebrow">Base oficial</p>
        <h1>Clientes</h1>
        <p>Alta única de cliente para BUST Content OS y el módulo BUST It Now.</p>
      </div>
      <div className="client-system-pills">
        <span className="system-pill">BUST Content OS</span>
        <span className="system-pill">BUST It Now</span>
        <span className="system-pill">Cliente único</span>
      </div>
    </section>

    <section className="shared-client-banner">
      <strong>Clientes es la base compartida oficial.</strong>
      <span>El cliente se crea una sola vez. BUST Content OS usa sus datos para operación, tareas y reportes; BUST It Now los usa como contexto para generación.</span>
    </section>

    <section className="grid kpis" style={{marginTop:18}}>
      <div className="kpi"><span>Clientes</span><strong>{totals.clients}</strong></div>
      <div className="kpi"><span>Activos</span><strong>{totals.active}</strong></div>
      <div className="kpi"><span>Con BUST It Now</span><strong>{totals.bustItNow}</strong></div>
      <div className="kpi"><span>Sistema oficial</span><strong>Content OS</strong></div>
    </section>

    <section className="client-os-hero" style={{marginTop:18}}>
      <div className="client-os-card">
        <h3>{editing?"Editar cliente":"Nuevo cliente"}</h3>

        <div className="client-profile-grid">
          <div className="field"><label>Nombre comercial</label><input value={form.name} onChange={e=>set("name",e.target.value)} /></div>
          <div className="field"><label>Estatus</label><select value={form.status||"activo"} onChange={e=>set("status",e.target.value)}><option value="activo">Activo</option><option value="pausado">Pausado</option><option value="prospecto">Prospecto</option><option value="inactivo">Inactivo</option></select></div>
          <div className="field"><label>Industria</label><input value={form.industry} onChange={e=>set("industry",e.target.value)} /></div>
          <div className="field"><label>Ubicación</label><input value={form.location||""} onChange={e=>set("location",e.target.value)} /></div>
          <div className="field"><label>Responsable / KAM</label><input value={form.accountOwner||""} onChange={e=>set("accountOwner",e.target.value)} /></div>
          <div className="field"><label>Paquete</label><input value={form.packageName||""} onChange={e=>set("packageName",e.target.value)} /></div>
        </div>

        <div className="client-profile-grid">
          <div className="field"><label>Contacto</label><input value={form.contactName||""} onChange={e=>set("contactName",e.target.value)} /></div>
          <div className="field"><label>Puesto</label><input value={form.contactRole||""} onChange={e=>set("contactRole",e.target.value)} /></div>
          <div className="field"><label>Email</label><input value={form.contactEmail||""} onChange={e=>set("contactEmail",e.target.value)} /></div>
          <div className="field"><label>Teléfono</label><input value={form.contactPhone||""} onChange={e=>set("contactPhone",e.target.value)} /></div>
          <div className="field"><label>Sitio web</label><input value={form.website||""} onChange={e=>set("website",e.target.value)} /></div>
          <div className="field"><label>Instagram</label><input value={form.instagram||""} onChange={e=>set("instagram",e.target.value)} /></div>
        </div>

        <div className="form-grid">
          <div className="field"><label>Mes operativo</label><input value={form.month||""} onChange={e=>set("month",e.target.value)} /></div>
          <div className="field"><label>Posts</label><input type="number" value={form.posts} onChange={e=>set("posts",Number(e.target.value))} /></div>
          <div className="field"><label>Reels</label><input type="number" value={form.reels} onChange={e=>set("reels",Number(e.target.value))} /></div>
          <div className="field"><label>Producciones</label><input type="number" value={form.productions} onChange={e=>set("productions",Number(e.target.value))} /></div>
        </div>

        <div className="field">
          <label>Servicios / módulos activos</label>
          <div className="client-system-pills">
            {serviceOptions.map(service=><button type="button" className={(form.services||[]).includes(service)?"btn blue":"btn"} key={service} onClick={()=>toggleService(service)}>{service}</button>)}
          </div>
        </div>

        <div className="client-profile-grid">
          <div className="field"><label>Tono</label><input value={form.tone} onChange={e=>set("tone",e.target.value)} /></div>
          <div className="field"><label>Audiencia</label><input value={form.audience} onChange={e=>set("audience",e.target.value)} /></div>
        </div>

        <div className="field"><label>Personalidad de marca</label><textarea value={form.brandPersonality||""} onChange={e=>set("brandPersonality",e.target.value)} /></div>
        <div className="field"><label>Estilo visual</label><textarea value={form.visualStyle||""} onChange={e=>set("visualStyle",e.target.value)} /></div>
        <div className="field"><label>Pilares de contenido</label><textarea value={form.contentPillars||""} onChange={e=>set("contentPillars",e.target.value)} /></div>
        <div className="field"><label>Brand Brain / notas estratégicas</label><textarea value={form.brandNotes||""} onChange={e=>set("brandNotes",e.target.value)} /></div>

        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          <button className="btn blue" onClick={submit}>{editing?"Guardar cambios":"Crear cliente compartido"}</button>
          {editing&&<button className="btn" onClick={()=>{setEditing("");setForm(empty)}}>Cancelar</button>}
        </div>
      </div>

      <div className="client-os-card">
        <h3>Vista rápida de base compartida</h3>
        <p className="mini">Estos datos serán el punto de conexión entre operación, generación, tareas y reportes.</p>
        <div className="client-metrics">
          <div className="client-metric"><strong>{form.posts}</strong><span>Posts</span></div>
          <div className="client-metric"><strong>{form.reels}</strong><span>Reels</span></div>
          <div className="client-metric"><strong>{form.productions}</strong><span>Producciones</span></div>
        </div>
        <div className="detail-copy">
          <strong>Cliente:</strong> {form.name||"Sin nombre"}{"\n"}
          <strong>Industria:</strong> {form.industry||"Sin industria"}{"\n"}
          <strong>KAM:</strong> {form.accountOwner||"Sin responsable"}{"\n"}
          <strong>Servicios:</strong> {(form.services||[]).join(", ")||"Sin servicios"}{"\n"}
          <strong>Brand Brain:</strong> {form.brandNotes||"Pendiente"}
        </div>
      </div>
    </section>

    <section className="card" style={{marginTop:18}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}>
        <h3>Clientes guardados</h3>
        <div className="report-filters" style={{margin:0}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente..."/>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="activo">Activos</option>
            <option value="pausado">Pausados</option>
            <option value="prospecto">Prospectos</option>
            <option value="inactivo">Inactivos</option>
          </select>
        </div>
      </div>

      <div className="client-card-grid">
        {filtered.map(x=><div className="client-profile-card" key={x.id}>
          <div>
            <h3>{x.name}</h3>
            <p>{x.industry} · {x.location||"Sin ubicación"}</p>
          </div>
          <div className="client-system-pills">
            <span className="system-pill">{x.status||"activo"}</span>
            {(x.sharedSystems||["BUST Content OS","BUST It Now"]).map(system=><span className="system-pill" key={system}>{system}</span>)}
          </div>
          <div className="client-metrics">
            <div className="client-metric"><strong>{x.posts}</strong><span>Posts</span></div>
            <div className="client-metric"><strong>{x.reels}</strong><span>Reels</span></div>
            <div className="client-metric"><strong>{x.productions}</strong><span>Prod.</span></div>
          </div>
          <p><strong>KAM:</strong> {x.accountOwner||"Sin responsable"}</p>
          <p><strong>Contacto:</strong> {x.contactName||"Sin contacto"} · {x.contactPhone||"Sin teléfono"}</p>
          <p><strong>Servicios:</strong> {(x.services||[]).join(", ")||"Sin servicios"}</p>
          <div className="client-actions">
            <button className="btn" onClick={()=>edit(x)}>Editar</button>
            <button className="btn red" onClick={()=>remove(x.id)}>Eliminar</button>
          </div>
        </div>)}
      </div>

      {!filtered.length && <p className="mini">No hay clientes con estos filtros.</p>}
    </section>
  </AppShell>;
}
