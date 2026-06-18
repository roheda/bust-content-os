"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  Brand,
  PermissionAction,
  PermissionMatrix,
  PlatformUser,
  canUser,
  emptyPlatformUser,
  getRoleTemplatePermissions,
  listUniqueBrands,
  listUsers,
  permissionActions,
  platformModules,
  roleTemplates,
  saveUser,
  updateUser,
  deleteUser
} from "@/lib/data";

function money(n:number){return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number(n||0));}

export default function UsuariosPage(){
  const [users,setUsers]=useState<PlatformUser[]>([]);
  const [clients,setClients]=useState<Brand[]>([]);
  const [form,setForm]=useState<PlatformUser>(emptyPlatformUser);
  const [editingId,setEditingId]=useState("");
  const [filter,setFilter]=useState("all");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  async function load(){
    const [loadedUsers,loadedClients] = await Promise.all([listUsers(),listUniqueBrands()]);
    setUsers(loadedUsers.sort((a,b)=>(a.name||"").localeCompare(b.name||"","es")));
    setClients(loadedClients.filter(c=>(c.status||"active")!=="deleted").sort((a,b)=>a.name.localeCompare(b.name,"es")));
  }

  useEffect(()=>{load()},[]);

  const activeUsers = users.filter(u=>u.status!=="inactive").length;
  const masterUsers = users.filter(u=>u.isMaster || u.roleKey==="master").length;
  const visibleUsers = useMemo(()=>users.filter(u=>filter==="all" || u.roleKey===filter || (filter==="active" && u.status!=="inactive") || (filter==="inactive" && u.status==="inactive")),[users,filter]);

  function setField<K extends keyof PlatformUser>(key:K,value:PlatformUser[K]){
    setForm(prev=>({...prev,[key]:value}));
  }

  function applyRole(roleKey:string){
    const role = roleTemplates.find(r=>r.key===roleKey) || roleTemplates[0];
    const isMaster = roleKey === "master";
    setForm(prev=>({
      ...prev,
      roleKey,
      roleLabel: role.label,
      isMaster,
      scope: isMaster ? "all_clients" : prev.scope,
      clientIds: isMaster ? [] : prev.clientIds,
      permissions: getRoleTemplatePermissions(roleKey),
      canBypassClientLimits: isMaster || prev.canBypassClientLimits,
      canManageBilling: isMaster || roleKey === "admin" || roleKey === "direccion" || prev.canManageBilling
    }));
  }

  function togglePermission(moduleKey:string,action:PermissionAction){
    setForm(prev=>{
      const permissions: PermissionMatrix = {...(prev.permissions || {})};
      const current = {...(permissions[moduleKey] || {})};
      current[action] = !current[action];
      permissions[moduleKey] = current;
      return {...prev,permissions,isMaster:false,roleKey:prev.roleKey==="master"?"admin":prev.roleKey};
    });
  }

  function toggleClient(clientId:string){
    setForm(prev=>{
      const exists = prev.clientIds.includes(clientId);
      return {...prev,clientIds: exists ? prev.clientIds.filter(id=>id!==clientId) : [...prev.clientIds,clientId]};
    });
  }

  function editUser(user:PlatformUser){
    setEditingId(user.id || "");
    setForm({
      ...emptyPlatformUser,
      ...user,
      clientIds: user.clientIds || [],
      permissions: user.permissions || getRoleTemplatePermissions(user.roleKey || "kam")
    });
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function resetForm(){
    setEditingId("");
    setForm(emptyPlatformUser);
    setMessage("");
  }

  async function createMaster(){
    const already = users.some(u=>u.isMaster || u.roleKey==="master");
    if(already && !confirm("Ya existe un usuario master. ¿Crear otro de todos modos?")) return;
    setForm({
      ...emptyPlatformUser,
      name:"Rodrigo Herrera",
      email:"rodrigo@bustcontentos.local",
      roleKey:"master",
      roleLabel:"Master",
      status:"active",
      isMaster:true,
      department:"Dirección",
      jobTitle:"Master Admin",
      scope:"all_clients",
      clientIds:[],
      permissions:getRoleTemplatePermissions("master"),
      canBypassClientLimits:true,
      canManageBilling:true,
      notes:"Usuario master inicial. Cambiar correo por el real cuando se conecte Firebase Auth."
    });
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function save(){
    if(!form.name.trim()) return alert("Escribe el nombre del usuario.");
    if(!form.email.trim()) return alert("Escribe el correo del usuario.");
    setBusy(true);
    try{
      const role = roleTemplates.find(r=>r.key===form.roleKey);
      const payload:PlatformUser = {
        ...form,
        name:form.name.trim(),
        email:form.email.trim().toLowerCase(),
        roleLabel: role?.label || form.roleLabel || form.roleKey,
        status: form.status || "active",
        scope: form.isMaster ? "all_clients" : form.scope,
        clientIds: form.isMaster || form.scope === "all_clients" ? [] : form.clientIds,
        permissions: form.isMaster ? getRoleTemplatePermissions("master") : form.permissions,
        canBypassClientLimits: Boolean(form.isMaster || form.canBypassClientLimits),
        canManageBilling: Boolean(form.isMaster || form.canManageBilling)
      };
      if(editingId) await updateUser(editingId,payload);
      else await saveUser(payload);
      setMessage(editingId ? "Usuario actualizado." : "Usuario creado.");
      resetForm();
      await load();
    }finally{setBusy(false)}
  }

  async function remove(user:PlatformUser){
    if(!user.id) return;
    if(user.isMaster || user.roleKey==="master") return alert("No se elimina un usuario master desde esta pantalla. Primero quítale el rol master o desactívalo.");
    if(!confirm(`¿Eliminar usuario ${user.name}?`)) return;
    await deleteUser(user.id);
    await load();
  }

  return <AppShell active="Usuarios">
    <section className="hero">
      <div>
        <p className="eyebrow">Administración</p>
        <h1>Usuarios y permisos</h1>
        <p>Crea un usuario master y configura accesos por módulo, acción y cliente. Esto prepara la plataforma para trabajar por roles sin que todos vean todo.</p>
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button className="btn" onClick={load}>Actualizar</button>
        <button className="btn blue" onClick={createMaster}>Crear master</button>
      </div>
    </section>

    <section className="grid kpis">
      <Metric label="Usuarios" value={users.length}/>
      <Metric label="Activos" value={activeUsers}/>
      <Metric label="Master" value={masterUsers}/>
      <Metric label="Clientes" value={clients.length}/>
      <Metric label="Módulos" value={platformModules.length}/>
      <Metric label="Estado" value={busy?"Guardando":"Listo"}/>
    </section>

    <section className="grid two-col user-admin-grid">
      <article className="card">
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
          <div>
            <p className="eyebrow">{editingId?"Editar usuario":"Nuevo usuario"}</p>
            <h2>{editingId?form.name:"Alta de usuario"}</h2>
          </div>
          {message && <span className="pill green">{message}</span>}
        </div>

        <div className="form-grid" style={{marginTop:14}}>
          <div className="field"><label>Nombre</label><input value={form.name} onChange={e=>setField("name",e.target.value)} placeholder="Ej. Mafer Gutiérrez"/></div>
          <div className="field"><label>Correo</label><input value={form.email} onChange={e=>setField("email",e.target.value)} placeholder="correo@empresa.com"/></div>
          <div className="field"><label>Rol base</label><select value={form.roleKey} onChange={e=>applyRole(e.target.value)}>{roleTemplates.map(role=><option key={role.key} value={role.key}>{role.label}</option>)}</select></div>
          <div className="field"><label>Estatus</label><select value={form.status} onChange={e=>setField("status",e.target.value as PlatformUser["status"])}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></div>
          <div className="field"><label>Departamento</label><input value={form.department||""} onChange={e=>setField("department",e.target.value)} placeholder="Operación, Diseño, Dirección..."/></div>
          <div className="field"><label>Puesto</label><input value={form.jobTitle||""} onChange={e=>setField("jobTitle",e.target.value)} placeholder="KAM, Diseñador, Estratega..."/></div>
          <div className="field"><label>Teléfono</label><input value={form.phone||""} onChange={e=>setField("phone",e.target.value)} placeholder="Opcional"/></div>
          <div className="field"><label>Alcance clientes</label><select value={form.scope} onChange={e=>setField("scope",e.target.value as PlatformUser["scope"])} disabled={form.isMaster}><option value="all_clients">Todos los clientes</option><option value="assigned_clients">Solo clientes asignados</option></select></div>
          <label className="check-row"><input type="checkbox" checked={Boolean(form.isMaster)} onChange={e=>setForm(prev=>({...prev,isMaster:e.target.checked,roleKey:e.target.checked?"master":"admin",roleLabel:e.target.checked?"Master":"Administrador",scope:e.target.checked?"all_clients":prev.scope,permissions:e.target.checked?getRoleTemplatePermissions("master"):getRoleTemplatePermissions("admin")}))}/> Usuario master</label>
          <label className="check-row"><input type="checkbox" checked={Boolean(form.canBypassClientLimits)} onChange={e=>setField("canBypassClientLimits",e.target.checked)}/> Puede saltar límites de IA/cliente</label>
          <label className="check-row"><input type="checkbox" checked={Boolean(form.canManageBilling)} onChange={e=>setField("canManageBilling",e.target.checked)}/> Puede ver facturación y costos</label>
          <div className="field full"><label>Notas internas</label><textarea value={form.notes||""} onChange={e=>setField("notes",e.target.value)} placeholder="Restricciones, horario, permisos especiales..."/></div>
        </div>

        {form.scope === "assigned_clients" && !form.isMaster && <div className="detail-section">
          <h4>Clientes asignados</h4>
          <div className="client-chip-grid">
            {clients.map(client=><button type="button" key={client.id} className={`chip-btn ${form.clientIds.includes(client.id||"")?"selected":""}`} onClick={()=>toggleClient(client.id||"")}>{client.name}</button>)}
          </div>
        </div>}

        <div className="detail-section">
          <h4>Permisos por módulo</h4>
          <div className="permission-table-wrap">
            <table className="table permission-table">
              <thead><tr><th>Módulo</th>{permissionActions.map(action=><th key={action.key}>{action.label}</th>)}</tr></thead>
              <tbody>{platformModules.map(module=><tr key={module.key}>
                <td><strong>{module.label}</strong><br/><span className="mini">{module.description}</span></td>
                {permissionActions.map(action=><td key={action.key}>
                  <button type="button" className={`perm-toggle ${canUser(form,module.key,action.key)?"on":""}`} onClick={()=>togglePermission(module.key,action.key)} title={action.description}>{canUser(form,module.key,action.key)?"Sí":"No"}</button>
                </td>)}
              </tr>)}</tbody>
            </table>
          </div>
        </div>

        <div className="config-actions">
          <button className="btn blue" onClick={save} disabled={busy}>{busy?"Guardando...":editingId?"Guardar cambios":"Crear usuario"}</button>
          <button className="btn" onClick={resetForm}>Limpiar</button>
        </div>
      </article>

      <aside className="grid">
        <div className="card">
          <h3>Usuarios registrados</h3>
          <div className="field"><label>Filtrar</label><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option>{roleTemplates.map(role=><option key={role.key} value={role.key}>{role.label}</option>)}</select></div>
          <div className="draft-list">
            {visibleUsers.length===0 ? <p className="mini">Todavía no hay usuarios. Crea primero el master.</p> : visibleUsers.map(user=><div className="draft-item" key={user.id || user.email}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
                <div><strong>{user.name}</strong><br/><span className="mini">{user.email}</span></div>
                <span className={`pill ${user.status==="inactive"?"red":user.isMaster?"blue":"green"}`}>{user.status==="inactive"?"Inactivo":user.isMaster?"Master":"Activo"}</span>
              </div>
              <div className="mini">{user.roleLabel || user.roleKey} · {user.scope==="all_clients"?"Todos los clientes":`${user.clientIds?.length||0} clientes asignados`}</div>
              <div className="mini">Módulos visibles: {platformModules.filter(m=>canUser(user,m.key,"view")).length} · Genera IA: {platformModules.filter(m=>canUser(user,m.key,"generate")).length ? "Sí" : "No"}</div>
              <div className="config-actions">
                <button className="btn" onClick={()=>editUser(user)}>Editar</button>
                <button className="btn red" onClick={()=>remove(user)}>Eliminar</button>
              </div>
            </div>)}
          </div>
        </div>

        <div className="card">
          <h3>Cómo usarlo</h3>
          <ul className="config-list">
            <li><strong>Master:</strong> ve y configura todo.</li>
            <li><strong>Admin/Dirección:</strong> puede operar y revisar reportes.</li>
            <li><strong>KAM:</strong> solo debe ver clientes asignados.</li>
            <li><strong>Cliente:</strong> ideal para solo aprobar piezas.</li>
          </ul>
          <p className="mini" style={{marginTop:12}}>La seguridad fuerte se completa conectando estos usuarios con Firebase Auth y reglas de Firestore. Esta versión deja lista la configuración funcional dentro de la plataforma.</p>
        </div>
      </aside>
    </section>
  </AppShell>;
}

function Metric({label,value}:{label:string;value:any}){
  return <div className="kpi"><span>{label}</span><strong>{value}</strong></div>;
}
