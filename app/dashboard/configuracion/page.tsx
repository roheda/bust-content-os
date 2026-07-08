"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useModulePermissions, permissionAlert } from "@/components/useModulePermissions";
import {
  Brand,
  ClientOperationalOverride,
  OperationalContentRule,
  TeamDailyCapacity,
  areas,
  contentTypes,
  defaultOperationalRules,
  deleteClientOperationalOverride,
  deleteOperationalContentRule,
  deleteTeamDailyCapacity,
  listClientOperationalOverrides,
  listOperationalContentRules,
  listTeamDailyCapacities,
  listUniqueBrands,
  saveClientOperationalOverride,
  saveOperationalContentRule,
  saveTeamDailyCapacity,
  updateClientOperationalOverride,
  updateOperationalContentRule,
  updateTeamDailyCapacity
} from "@/lib/data";

const emptyRule: OperationalContentRule = {
  contentType: "Reel",
  label: "",
  area: "Audiovisual",
  internalCost: 0,
  productionCost: 0,
  editingHours: 0,
  revisionCostMultiplier: 0.25,
  revisionHoursMultiplier: 0.25,
  deliveryDays: 3,
  bufferHours: 4,
  requiresProductionDefault: false,
  active: true,
  notes: ""
};

const emptyOverride: ClientOperationalOverride = {
  clientId: "",
  clientName: "",
  contentType: "Reel",
  internalCost: undefined,
  productionCost: undefined,
  editingHours: undefined,
  revisionCostMultiplier: undefined,
  revisionHoursMultiplier: undefined,
  deliveryDays: undefined,
  bufferHours: undefined,
  notes: "",
  active: true
};

const emptyCapacity: TeamDailyCapacity = {
  personName: "",
  area: "Diseño",
  dailyCapacityUnits: 5,
  active: true,
  notes: ""
};

export default function ConfiguracionPage(){
  const [rules,setRules]=useState<OperationalContentRule[]>([]);
  const [overrides,setOverrides]=useState<ClientOperationalOverride[]>([]);
  const [brands,setBrands]=useState<Brand[]>([]);
  const [capacities,setCapacities]=useState<TeamDailyCapacity[]>([]);
  const [ruleForm,setRuleForm]=useState<OperationalContentRule>(emptyRule);
  const [overrideForm,setOverrideForm]=useState<ClientOperationalOverride>(emptyOverride);
  const [editingRuleId,setEditingRuleId]=useState("");
  const [editingOverrideId,setEditingOverrideId]=useState("");
  const [capacityForm,setCapacityForm]=useState<TeamDailyCapacity>(emptyCapacity);
  const [editingCapacityId,setEditingCapacityId]=useState("");
  const [clientFilter,setClientFilter]=useState("all");
  const [busy,setBusy]=useState(false);
  const permissions = useModulePermissions("configuracion");
  const canConfigure = permissions.canConfigure;

  async function load(){
    const [loadedRules,loadedOverrides,loadedBrands,loadedCapacities] = await Promise.all([
      listOperationalContentRules(),
      listClientOperationalOverrides(),
      listUniqueBrands(),
      listTeamDailyCapacities()
    ]);
    setRules(loadedRules);
    setOverrides(loadedOverrides);
    setBrands(loadedBrands);
    setCapacities(loadedCapacities);
    if(!overrideForm.clientId && loadedBrands[0]?.id){
      setOverrideForm({...overrideForm,clientId:loadedBrands[0].id,clientName:loadedBrands[0].name});
    }
  }

  useEffect(()=>{load()},[]);

  const visibleOverrides = useMemo(()=>overrides.filter(item=>clientFilter==="all" || item.clientId===clientFilter),[overrides,clientFilter]);
  const totalBaseCost = useMemo(()=>rules.reduce((sum,rule)=>sum + Number(rule.internalCost||0) + Number(rule.productionCost||0),0),[rules]);
  const avgDelivery = useMemo(()=>rules.length ? Math.round(rules.reduce((sum,rule)=>sum+Number(rule.deliveryDays||0),0)/rules.length) : 0,[rules]);

  function setRule(k:keyof OperationalContentRule, v:any){setRuleForm({...ruleForm,[k]:v});}
  function setOverride(k:keyof ClientOperationalOverride, v:any){setOverrideForm({...overrideForm,[k]:v});}
  function setCapacity(k:keyof TeamDailyCapacity, v:any){setCapacityForm({...capacityForm,[k]:v});}

  function startRuleEdit(rule:OperationalContentRule){
    setEditingRuleId(rule.id||"");
    setRuleForm({...rule});
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function startOverrideEdit(item:ClientOperationalOverride){
    setEditingOverrideId(item.id||"");
    setOverrideForm({...item});
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function saveRule(){
    if(!canConfigure)return permissionAlert("guardar reglas operativas");
    if(!ruleForm.contentType)return alert("Selecciona tipo de contenido");
    setBusy(true);
    try{
      const payload = {
        ...ruleForm,
        label: ruleForm.label || ruleForm.contentType,
        internalCost: Number(ruleForm.internalCost||0),
        productionCost: Number(ruleForm.productionCost||0),
        editingHours: Number(ruleForm.editingHours||0),
        revisionCostMultiplier: Number(ruleForm.revisionCostMultiplier ?? 0.25),
        revisionHoursMultiplier: Number(ruleForm.revisionHoursMultiplier ?? 0.25),
        deliveryDays: Number(ruleForm.deliveryDays||0),
        bufferHours: Number(ruleForm.bufferHours||0),
        active: ruleForm.active !== false
      };
      if(editingRuleId) await updateOperationalContentRule(editingRuleId,payload);
      else await saveOperationalContentRule(payload);
      setEditingRuleId("");
      setRuleForm(emptyRule);
      await load();
    }finally{setBusy(false)}
  }

  async function saveOverride(){
    if(!canConfigure)return permissionAlert("guardar ajustes por cliente");
    const selected = brands.find(x=>x.id===overrideForm.clientId);
    if(!selected?.id)return alert("Selecciona cliente");
    setBusy(true);
    try{
      const payload:ClientOperationalOverride = {
        ...overrideForm,
        clientId:selected.id,
        clientName:selected.name,
        internalCost: toOptionalNumber(overrideForm.internalCost),
        productionCost: toOptionalNumber(overrideForm.productionCost),
        editingHours: toOptionalNumber(overrideForm.editingHours),
        revisionCostMultiplier: toOptionalRatio(overrideForm.revisionCostMultiplier),
        revisionHoursMultiplier: toOptionalRatio(overrideForm.revisionHoursMultiplier),
        deliveryDays: toOptionalNumber(overrideForm.deliveryDays),
        bufferHours: toOptionalNumber(overrideForm.bufferHours),
        active: overrideForm.active !== false
      };
      if(editingOverrideId) await updateClientOperationalOverride(editingOverrideId,payload);
      else await saveClientOperationalOverride(payload);
      setEditingOverrideId("");
      setOverrideForm({...emptyOverride,clientId:selected.id,clientName:selected.name});
      await load();
    }finally{setBusy(false)}
  }

  async function removeRule(rule:OperationalContentRule){
    if(!canConfigure)return permissionAlert("eliminar reglas operativas");
    if(!rule.id)return alert("Esta regla base viene por default. Si quieres cambiarla, edítala y guarda una versión personalizada.");
    if(!confirm("¿Eliminar regla operativa?"))return;
    await deleteOperationalContentRule(rule.id);
    await load();
  }

  async function removeOverride(item:ClientOperationalOverride){
    if(!canConfigure)return permissionAlert("eliminar ajustes por cliente");
    if(!item.id)return;
    if(!confirm("¿Eliminar ajuste por cliente?"))return;
    await deleteClientOperationalOverride(item.id);
    await load();
  }

  function resetDefaults(){
    setEditingRuleId("");
    setRuleForm(emptyRule);
  }

  function resetOverride(){
    const selected = brands.find(x=>x.id===overrideForm.clientId) || brands[0];
    setEditingOverrideId("");
    setOverrideForm({...emptyOverride,clientId:selected?.id||"",clientName:selected?.name||""});
  }

  function seedDefaults(){
    setRules(defaultOperationalRules);
    alert("Las reglas default ya están cargadas en pantalla. Para guardarlas en Firebase, edita una regla y presiona guardar.");
  }

  function startCapacityEdit(item:TeamDailyCapacity){
    setEditingCapacityId(item.id||"");
    setCapacityForm({...item});
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function saveCapacity(){
    if(!canConfigure)return permissionAlert("guardar capacidad del equipo");
    if(!capacityForm.personName.trim())return alert("Escribe el nombre de la persona.");
    setBusy(true);
    try{
      const payload = {
        ...capacityForm,
        personName: capacityForm.personName.trim(),
        dailyCapacityUnits: Number(capacityForm.dailyCapacityUnits || 5),
        active: capacityForm.active !== false
      };
      if(editingCapacityId) await updateTeamDailyCapacity(editingCapacityId,payload);
      else await saveTeamDailyCapacity(payload);
      setEditingCapacityId("");
      setCapacityForm(emptyCapacity);
      await load();
    }finally{setBusy(false)}
  }

  async function removeCapacity(item:TeamDailyCapacity){
    if(!canConfigure)return permissionAlert("eliminar capacidad del equipo");
    if(!item.id)return alert("Esta capacidad viene por default. Edítala y guarda una versión personalizada para reemplazarla.");
    if(!confirm("¿Eliminar capacidad personalizada?"))return;
    await deleteTeamDailyCapacity(item.id);
    await load();
  }

  function resetCapacity(){
    setEditingCapacityId("");
    setCapacityForm(emptyCapacity);
  }

  return <AppShell active="Configuración">
    <section className="hero">
      <div>
        <p className="eyebrow">Sistema</p>
        <h1>Configuración operativa</h1>
        <p>Define costos internos, tiempos estándar y ajustes por cliente para que reportes y solicitudes trabajen con tiempos reales.</p>
      </div>
      <button className="btn blue" onClick={load}>Actualizar</button>
    </section>

    <section className="grid kpis">
      <Metric label="Reglas activas" value={rules.filter(x=>x.active!==false).length}/>
      <Metric label="Costo base acumulado" value={money(totalBaseCost)}/>
      <Metric label="Promedio entrega" value={`${avgDelivery} días`}/>
      <Metric label="Ajustes por cliente" value={overrides.length}/>
      <Metric label="Capacidades" value={capacities.length}/>
      <Metric label="Clientes" value={brands.length}/>
      <Metric label="Estado" value={busy?"Guardando":"Listo"}/>
    </section>

    <section className="grid two-col">
      <div className="grid">
        <div className="card">
          <h3>{editingRuleId?"Editar regla base":"Nueva regla base"}</h3>
          <p className="mini">Se usa cuando el cliente no tiene una configuración especial. Ejemplo: Reel $1,500; Producción $4,000.</p>
          <div className="form-grid" style={{marginTop:14}}>
            <div className="field"><label>Tipo de contenido</label><select value={ruleForm.contentType} onChange={e=>setRule("contentType",e.target.value)}>{[...new Set([...contentTypes,"Producción"])].map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="field"><label>Nombre visible</label><input value={ruleForm.label} onChange={e=>setRule("label",e.target.value)} placeholder="Ej. Post Reel"/></div>
            <div className="field"><label>Área responsable</label><select value={ruleForm.area} onChange={e=>setRule("area",e.target.value)}>{areas.map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="field"><label>Costo interno por pieza</label><input type="number" value={ruleForm.internalCost} onChange={e=>setRule("internalCost",Number(e.target.value))}/></div>
            <div className="field"><label>Costo producción</label><input type="number" value={ruleForm.productionCost} onChange={e=>setRule("productionCost",Number(e.target.value))}/></div>
            <div className="field"><label>Horas edición</label><input type="number" value={ruleForm.editingHours} onChange={e=>setRule("editingHours",Number(e.target.value))}/></div>
            <div className="field"><label>Costo rebote (% pieza)</label><input type="number" min="0" step="5" value={Math.round(Number(ruleForm.revisionCostMultiplier ?? 0.25)*100)} onChange={e=>setRule("revisionCostMultiplier",Number(e.target.value)/100)}/></div>
            <div className="field"><label>Tiempo rebote (% edición)</label><input type="number" min="0" step="5" value={Math.round(Number(ruleForm.revisionHoursMultiplier ?? 0.25)*100)} onChange={e=>setRule("revisionHoursMultiplier",Number(e.target.value)/100)}/></div>
            <div className="field"><label>Días mínimos entrega</label><input type="number" value={ruleForm.deliveryDays} onChange={e=>setRule("deliveryDays",Number(e.target.value))}/></div>
            <div className="field"><label>Buffer horas</label><input type="number" value={ruleForm.bufferHours} onChange={e=>setRule("bufferHours",Number(e.target.value))}/></div>
            <label className="check-row"><input type="checkbox" checked={ruleForm.requiresProductionDefault} onChange={e=>setRule("requiresProductionDefault",e.target.checked)}/> Requiere producción por default</label>
            <label className="check-row"><input type="checkbox" checked={ruleForm.active!==false} onChange={e=>setRule("active",e.target.checked)}/> Activa</label>
            <div className="field full"><label>Notas</label><textarea value={ruleForm.notes||""} onChange={e=>setRule("notes",e.target.value)} placeholder="Qué incluye, restricciones, criterios de entrega..."/></div>
          </div>
          <div className="config-actions">
            <button className="btn blue" onClick={saveRule} disabled={!canConfigure}>{editingRuleId?"Guardar cambios":"Guardar regla"}</button>
            <button className="btn" onClick={resetDefaults} disabled={!canConfigure}>Limpiar</button>
            <button className="btn" onClick={seedDefaults} disabled={!canConfigure}>Ver defaults</button>
          </div>
        </div>

        <div className="card">
          <h3>Reglas base por contenido</h3>
          <div className="table-wrap">
            <table className="table config-table">
              <thead><tr><th>Contenido</th><th>Área</th><th>Costo</th><th>Producción</th><th>Tiempo</th><th>Rebote</th><th>Acciones</th></tr></thead>
              <tbody>{rules.map(rule=><tr key={`${rule.id||"default"}-${rule.contentType}`}>
                <td><strong>{rule.label||rule.contentType}</strong><br/><span className="mini">{rule.contentType} · {rule.active===false?"Inactiva":"Activa"}</span></td>
                <td>{rule.area}</td>
                <td>{money(rule.internalCost)}</td>
                <td>{money(rule.productionCost)}</td>
                <td>{rule.deliveryDays} días · {rule.editingHours} h edición</td>
                <td>{percent(rule.revisionCostMultiplier ?? 0.25)} costo · {percent(rule.revisionHoursMultiplier ?? 0.25)} tiempo</td>
                <td><button className="btn" onClick={()=>startRuleEdit(rule)} disabled={!canConfigure}>Editar</button><button className="btn red" onClick={()=>removeRule(rule)} disabled={!canConfigure}>Eliminar</button></td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>

      <aside className="grid">
        <div className="card">
          <h3>Ajuste especial por cliente</h3>
          <p className="mini">Úsalo cuando un cliente cuesta distinto al estándar. Deja campos vacíos para heredar la regla base.</p>
          <div className="field" style={{marginTop:14}}><label>Cliente</label><select value={overrideForm.clientId} onChange={e=>{
            const brand = brands.find(x=>x.id===e.target.value);
            setOverrideForm({...overrideForm,clientId:brand?.id||"",clientName:brand?.name||""});
          }}>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div className="field"><label>Tipo de contenido</label><select value={overrideForm.contentType} onChange={e=>setOverride("contentType",e.target.value)}>{[...new Set([...contentTypes,"Producción"])].map(x=><option key={x}>{x}</option>)}</select></div>
          <div className="form-grid">
            <OptionalNumber label="Costo pieza" value={overrideForm.internalCost} onChange={v=>setOverride("internalCost",v)}/>
            <OptionalNumber label="Costo producción" value={overrideForm.productionCost} onChange={v=>setOverride("productionCost",v)}/>
            <OptionalNumber label="Horas edición" value={overrideForm.editingHours} onChange={v=>setOverride("editingHours",v)}/>
            <OptionalPercent label="Costo rebote %" value={overrideForm.revisionCostMultiplier} onChange={v=>setOverride("revisionCostMultiplier",v)}/>
            <OptionalPercent label="Tiempo rebote %" value={overrideForm.revisionHoursMultiplier} onChange={v=>setOverride("revisionHoursMultiplier",v)}/>
            <OptionalNumber label="Días entrega" value={overrideForm.deliveryDays} onChange={v=>setOverride("deliveryDays",v)}/>
            <OptionalNumber label="Buffer horas" value={overrideForm.bufferHours} onChange={v=>setOverride("bufferHours",v)}/>
            <label className="check-row"><input type="checkbox" checked={overrideForm.active!==false} onChange={e=>setOverride("active",e.target.checked)}/> Activo</label>
            <div className="field full"><label>Notas</label><textarea value={overrideForm.notes||""} onChange={e=>setOverride("notes",e.target.value)}/></div>
          </div>
          <div className="config-actions">
            <button className="btn blue" onClick={saveOverride} disabled={!canConfigure}>{editingOverrideId?"Guardar ajuste":"Guardar ajuste"}</button>
            <button className="btn" onClick={resetOverride} disabled={!canConfigure}>Limpiar</button>
          </div>
        </div>

        <div className="card">
          <h3>Ajustes guardados</h3>
          <div className="field"><label>Filtrar cliente</label><select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}><option value="all">Todos</option>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div className="draft-list">
            {visibleOverrides.map(item=><div className="draft-item" key={item.id}>
              <strong>{item.clientName} · {item.contentType}</strong>
              <span className="mini">Costo: {item.internalCost==null?"Base":money(item.internalCost)} · Producción: {item.productionCost==null?"Base":money(item.productionCost)} · Tiempo: {item.deliveryDays==null?"Base":`${item.deliveryDays} días`} · Rebote: {item.revisionCostMultiplier==null?"Base":percent(item.revisionCostMultiplier)}</span>
              <div className="config-actions"><button className="btn" onClick={()=>startOverrideEdit(item)} disabled={!canConfigure}>Editar</button><button className="btn red" onClick={()=>removeOverride(item)} disabled={!canConfigure}>Eliminar</button></div>
            </div>)}
            {!visibleOverrides.length && <p className="mini">Sin ajustes para este filtro.</p>}
          </div>
        </div>

        <div className="card">
          <h3>{editingCapacityId?"Editar capacidad diaria":"Capacidad diaria por persona"}</h3>
          <p className="mini">Define cuántas piezas puede cerrar cada persona por día. Las horas por tipo de contenido siguen midiendo esfuerzo; la capacidad diaria se mide por piezas.</p>
          <div className="form-grid" style={{marginTop:14}}>
            <div className="field full"><label>Persona</label><input value={capacityForm.personName} onChange={e=>setCapacity("personName",e.target.value)} placeholder="Nombre del diseñador/editor"/></div>
            <div className="field"><label>Área</label><select value={capacityForm.area} onChange={e=>setCapacity("area",e.target.value)}>{areas.map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="field"><label>Piezas máximas por día</label><input type="number" value={capacityForm.dailyCapacityUnits} onChange={e=>setCapacity("dailyCapacityUnits",Number(e.target.value))}/></div>
            <label className="check-row"><input type="checkbox" checked={capacityForm.active!==false} onChange={e=>setCapacity("active",e.target.checked)}/> Activa</label>
            <div className="field full"><label>Notas</label><textarea value={capacityForm.notes||""} onChange={e=>setCapacity("notes",e.target.value)} placeholder="Ej. edita reels complejos / apoyo a diseño..."/></div>
          </div>
          <div className="config-actions">
            <button className="btn blue" onClick={saveCapacity} disabled={!canConfigure}>{editingCapacityId?"Guardar cambios":"Guardar capacidad"}</button>
            <button className="btn" onClick={resetCapacity} disabled={!canConfigure}>Limpiar</button>
          </div>
          <div className="draft-list" style={{marginTop:14}}>
            {capacities.map(item=><div className="draft-item" key={`${item.id||"default"}-${item.personName}`}>
              <strong>{item.personName}</strong>
              <span className="mini">{item.area} · {item.dailyCapacityUnits} piezas/día · {item.active===false?"Inactiva":"Activa"}</span>
              <div className="config-actions"><button className="btn" onClick={()=>startCapacityEdit(item)} disabled={!canConfigure}>Editar</button><button className="btn red" onClick={()=>removeCapacity(item)} disabled={!canConfigure}>Eliminar</button></div>
            </div>)}
          </div>
        </div>

        <div className="card">
          <h3>Configuraciones recomendadas</h3>
          <ul className="config-list">
            <li>La capacidad diaria se mide por piezas. Las horas configuradas por tipo de contenido explican el esfuerzo estimado de cada pieza.</li>
            <li>La fecha al cliente no es la fecha de tarea; Tareas usa fecha programada e interna.</li>
            <li>Si una tarea no se cierra, se arrastra al siguiente día y consume una pieza de capacidad del siguiente día.</li>
            <li>Los semáforos aparecen cuando una persona supera su capacidad diaria.</li>
            <li>Cada rebote incrementa costo y tiempo según el porcentaje configurado por tipo de contenido o cliente.</li>
          </ul>
        </div>
      </aside>
    </section>
  </AppShell>;
}

function OptionalNumber({label,value,onChange}:{label:string;value?:number;onChange:(value:number|undefined)=>void}){
  return <div className="field"><label>{label}</label><input type="number" value={value ?? ""} onChange={e=>onChange(e.target.value === "" ? undefined : Number(e.target.value))} placeholder="Base"/></div>;
}

function OptionalPercent({label,value,onChange}:{label:string;value?:number;onChange:(value:number|undefined)=>void}){
  return <div className="field"><label>{label}</label><input type="number" min="0" step="5" value={value == null ? "" : Math.round(Number(value)*100)} onChange={e=>onChange(e.target.value === "" ? undefined : Number(e.target.value)/100)} placeholder="Base"/></div>;
}

function Metric({label,value}:{label:string;value:string|number}){
  return <div className="kpi"><span>{label}</span><strong>{value}</strong></div>;
}

function money(value?:number){
  return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number(value||0));
}

function percent(value?:number){
  return `${Math.round(Number(value ?? 0)*100)}%`;
}

function toOptionalRatio(value:any){
  if(value === "" || value === undefined || value === null)return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function toOptionalNumber(value:any){
  if(value === "" || value === undefined || value === null)return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}
