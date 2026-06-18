"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Brand, ClientBillingConfig, getClientBillingConfig, updateBrand, listBrands } from "@/lib/data";

function joinItems(items?:string[]){return Array.isArray(items)?items.join(", "):""}
function splitComma(value:string){return value.split(",").map(x=>x.trim()).filter(Boolean)}
function splitLines(value:string){return value.split("\n").map(x=>x.trim()).filter(Boolean)}

const defaultBillingForm = {
  monthlyRetainer: "0",
  includedFinalizedContents: "0",
  includedProductions: "0",
  includedProductionBudget: "0",
  includedAiGenerations: "0",
  onDemandEnabled: true,
  extraContentRate: "0",
  extraProductionRate: "0",
  extraAiGenerationRate: "0",
  billingNotes: ""
};

export default function ClientBrandBrainPage(){
  const {clientId} = useParams<{clientId:string}>();
  const [client,setClient]=useState<Brand|null>(null);
  const [form,setForm]=useState({name:"",industry:"",brandDescription:"",tone:"",colors:"",typography:"",visualStyle:"",dos:"",donts:"",recommendedModels:"",marketScope:"",marketRegion:"",primaryCity:"",serviceArea:"",offerSummary:"",localAudienceContext:""});
  const [billingForm,setBillingForm]=useState(defaultBillingForm);
  const [saving,setSaving]=useState(false);
  const [savingBilling,setSavingBilling]=useState(false);
  const [success,setSuccess]=useState("");
  const [deleteConfirmation,setDeleteConfirmation]=useState("");

  async function load(){
    const row = (await listBrands()).find(x=>x.id===clientId);
    if(!row)return;
    setClient(row);
    const brain = row.brandBrain || {};
    const billing = getClientBillingConfig(row);
    setForm({
      name:row.name||"", industry:row.industry||"",
      brandDescription:brain.brandDescription||row.brandNotes||"",
      tone:brain.tone||row.tone||"", colors:joinItems(brain.colors), typography:brain.typography||"",
      visualStyle:joinItems(brain.visualStyle), dos:Array.isArray(brain.dos)?brain.dos.join("\n"):"",
      donts:Array.isArray(brain.donts)?brain.donts.join("\n"):"", recommendedModels:joinItems(brain.recommendedModels),
      marketScope:row.marketScope||"", marketRegion:row.marketRegion||"", primaryCity:row.primaryCity||"",
      serviceArea:row.serviceArea||row.location||"", offerSummary:row.offerSummary||"", localAudienceContext:row.localAudienceContext||""
    });
    setBillingForm({
      monthlyRetainer:String(billing.monthlyRetainer || 0),
      includedFinalizedContents:String(billing.includedFinalizedContents || 0),
      includedProductions:String(billing.includedProductions || 0),
      includedProductionBudget:String(billing.includedProductionBudget || 0),
      includedAiGenerations:String(billing.includedAiGenerations || 0),
      onDemandEnabled:billing.onDemandEnabled !== false,
      extraContentRate:String(billing.extraContentRate || 0),
      extraProductionRate:String(billing.extraProductionRate || 0),
      extraAiGenerationRate:String(billing.extraAiGenerationRate || 0),
      billingNotes:billing.billingNotes || ""
    });
  }
  useEffect(()=>{load()},[clientId]);
  function set(k:keyof typeof form,v:string){setForm({...form,[k]:v})}
  function setBilling(k:keyof typeof billingForm,v:any){setBillingForm({...billingForm,[k]:v})}

  async function save(){
    setSaving(true);
    await updateBrand(clientId,{
      name:form.name.trim(), industry:form.industry.trim(), tone:form.tone.trim(), brandNotes:form.brandDescription.trim(),
      marketScope:form.marketScope.trim(), marketRegion:form.marketRegion.trim(), primaryCity:form.primaryCity.trim(),
      serviceArea:form.serviceArea.trim(), location:form.serviceArea.trim(), offerSummary:form.offerSummary.trim(),
      localAudienceContext:form.localAudienceContext.trim(),
      brandBrain:{brandDescription:form.brandDescription.trim(), tone:form.tone.trim(), colors:splitComma(form.colors), typography:form.typography.trim(), visualStyle:splitComma(form.visualStyle), dos:splitLines(form.dos), donts:splitLines(form.donts), recommendedModels:splitComma(form.recommendedModels)}
    });
    setSuccess("Brand Brain guardado correctamente.");
    setSaving(false);
    await load();
  }

  async function saveBilling(){
    setSavingBilling(true);
    const billingConfig: ClientBillingConfig = {
      monthlyRetainer:num(billingForm.monthlyRetainer),
      includedFinalizedContents:num(billingForm.includedFinalizedContents),
      includedProductions:num(billingForm.includedProductions),
      includedProductionBudget:num(billingForm.includedProductionBudget),
      includedAiGenerations:num(billingForm.includedAiGenerations),
      onDemandEnabled:billingForm.onDemandEnabled,
      extraContentRate:num(billingForm.extraContentRate),
      extraProductionRate:num(billingForm.extraProductionRate),
      extraAiGenerationRate:num(billingForm.extraAiGenerationRate),
      billingNotes:billingForm.billingNotes.trim()
    };
    await updateBrand(clientId,{billingConfig});
    setSuccess("Configuración comercial y de consumo guardada.");
    setSavingBilling(false);
    await load();
  }

  async function archive(){
    if(!client)return;
    if(deleteConfirmation.trim()!==client.name.trim())return alert(`Para eliminar escribe exactamente: ${client.name}`);
    await updateBrand(clientId,{status:"deleted"});
    window.location.href="/dashboard/clientes";
  }

  const completeness = useMemo(()=>Math.round((Object.values(form).filter(x=>x.trim()).length/Object.values(form).length)*100),[form]);
  const billingSummary = useMemo(()=>{
    const included = num(billingForm.includedFinalizedContents) + num(billingForm.includedProductions) + num(billingForm.includedAiGenerations);
    return {included,retainer:num(billingForm.monthlyRetainer),onDemand:billingForm.onDemandEnabled};
  },[billingForm]);
  if(!client)return <AppShell active="Clientes"><section className="card"><p>Cargando Brand Brain...</p></section></AppShell>;

  return <AppShell active="Clientes">
    <section className="hero">
      <div><Link href="/dashboard/clientes" className="btn">← Volver a clientes</Link><p className="eyebrow" style={{marginTop:12}}>Cliente / Configuración</p><h1>{client.name}</h1><p>{client.industry || "Sin categoría definida"}. Esta memoria visual alimenta BUST It Now y su configuración comercial alimenta reportes y facturación.</p></div>
      <div className="client-os-card"><span className="mini">Completitud inicial</span><strong style={{fontSize:42}}>{completeness}%</strong><Link href={`/dashboard/clientes/${clientId}/assets`} className="btn blue">Abrir Assets</Link></div>
    </section>
    {success && <section className="feedback-item done"><p>{success}</p></section>}

    <section className="brandbrain-layout">
      <div className="brandbrain-card">
        <h2>Cómo debe verse y sentirse la marca</h2>
        <div className="brandbrain-form">
          <div className="client-profile-grid"><div className="field"><label>Nombre</label><input value={form.name} onChange={e=>set("name",e.target.value)}/></div><div className="field"><label>Giro</label><input value={form.industry} onChange={e=>set("industry",e.target.value)}/></div></div>
          <div className="field"><label>Descripción de marca</label><textarea value={form.brandDescription} onChange={e=>set("brandDescription",e.target.value)}/></div>
          <div className="brief-box">
            <h4>Contexto de mercado para IA</h4>
            <p className="mini">Esto ayuda a que el botón de IA adapte las ideas al alcance real del cliente: local, regional, nacional o ciudad específica.</p>
            <div className="client-profile-grid">
              <div className="field"><label>Alcance del cliente</label><select value={form.marketScope} onChange={e=>set("marketScope",e.target.value)}><option value="">Seleccionar</option><option>Local</option><option>Regional</option><option>Nacional</option><option>Internacional</option></select></div>
              <div className="field"><label>Región</label><input value={form.marketRegion} onChange={e=>set("marketRegion",e.target.value)} placeholder="Ej. Sureste de México"/></div>
            </div>
            <div className="client-profile-grid">
              <div className="field"><label>Ciudad base</label><input value={form.primaryCity} onChange={e=>set("primaryCity",e.target.value)} placeholder="Ej. Mérida, Yucatán"/></div>
              <div className="field"><label>Zona de servicio/venta</label><input value={form.serviceArea} onChange={e=>set("serviceArea",e.target.value)} placeholder="Ej. Mérida norte, Riviera Maya, Cancún"/></div>
            </div>
            <div className="field"><label>Qué ofrece / diferenciador comercial</label><textarea value={form.offerSummary} onChange={e=>set("offerSummary",e.target.value)} placeholder="Ej. Casas premium listas para entrega, recorridos, inversión inmobiliaria, cocinas europeas, experiencias turísticas..."/></div>
            <div className="field"><label>Contexto de audiencia local</label><textarea value={form.localAudienceContext} onChange={e=>set("localAudienceContext",e.target.value)} placeholder="Ej. Familias jóvenes de Mérida norte, compradores de vivienda premium, turistas que visitan Valladolid..."/></div>
          </div>
          <div className="client-profile-grid"><div className="field"><label>Tono</label><input value={form.tone} onChange={e=>set("tone",e.target.value)}/></div><div className="field"><label>Tipografía</label><input value={form.typography} onChange={e=>set("typography",e.target.value)}/></div></div>
          <div className="field"><label>Colores</label><input value={form.colors} onChange={e=>set("colors",e.target.value)} placeholder="#003B71, #E31E24"/></div>
          <div className="field"><label>Estilo visual</label><input value={form.visualStyle} onChange={e=>set("visualStyle",e.target.value)}/></div>
          <div className="field"><label>DO</label><textarea value={form.dos} onChange={e=>set("dos",e.target.value)} /></div>
          <div className="field"><label>DON'T</label><textarea value={form.donts} onChange={e=>set("donts",e.target.value)} /></div>
          <div className="field"><label>Modelos recomendados</label><input value={form.recommendedModels} onChange={e=>set("recommendedModels",e.target.value)}/></div>
          <button className="btn blue" onClick={save} disabled={saving}>{saving?"Guardando...":"Guardar Brand Brain"}</button>
        </div>
      </div>

      <aside className="brandbrain-card">
        <h2>Resumen para generación</h2>
        <div className="detail-copy"><strong>Marca:</strong> {form.name}{"\n"}<strong>Giro:</strong> {form.industry}{"\n"}<strong>Tono:</strong> {form.tone||"Pendiente"}{"\n"}<strong>Colores:</strong> {form.colors||"Pendiente"}{"\n"}<strong>Tipografía:</strong> {form.typography||"Pendiente"}{"\n"}<strong>Estilo:</strong> {form.visualStyle||"Pendiente"}{"\n"}<strong>Alcance:</strong> {form.marketScope||"Pendiente"}{"\n"}<strong>Región:</strong> {form.marketRegion||"Pendiente"}{"\n"}<strong>Ciudad:</strong> {form.primaryCity||"Pendiente"}{"\n"}<strong>Oferta:</strong> {form.offerSummary||"Pendiente"}</div>
        <div className="soft-delete-note">Para eliminar escribe exactamente su nombre. Se marca como deleted para conservar trazabilidad.</div>
        <input value={deleteConfirmation} onChange={e=>setDeleteConfirmation(e.target.value)} placeholder={client.name}/>
        <button className="btn red" onClick={archive}>Eliminar cliente</button>
      </aside>
    </section>

    <section className="grid two-col" style={{marginTop:24}}>
      <article className="brandbrain-card">
        <p className="eyebrow">Configuración comercial</p>
        <h2>Paquete, incluidos y cobro bajo demanda</h2>
        <p className="mini">Define lo contratado por mes para que Reportes pueda comparar lo incluido contra lo consumido y sacar balance para facturación.</p>
        <div className="brandbrain-form" style={{marginTop:16}}>
          <div className="client-profile-grid">
            <MoneyInput label="Iguala / fee mensual" value={billingForm.monthlyRetainer} onChange={v=>setBilling("monthlyRetainer",v)}/>
            <NumberInput label="Contenidos finalizados incluidos" value={billingForm.includedFinalizedContents} onChange={v=>setBilling("includedFinalizedContents",v)}/>
          </div>
          <div className="client-profile-grid">
            <NumberInput label="Producciones incluidas" value={billingForm.includedProductions} onChange={v=>setBilling("includedProductions",v)}/>
            <MoneyInput label="Bolsa de producción incluida" value={billingForm.includedProductionBudget} onChange={v=>setBilling("includedProductionBudget",v)}/>
          </div>
          <div className="client-profile-grid">
            <NumberInput label="Generaciones IA incluidas en BUST It Now" value={billingForm.includedAiGenerations} onChange={v=>setBilling("includedAiGenerations",v)}/>
            <label className="check-row" style={{alignSelf:"end",marginBottom:6}}><input type="checkbox" checked={billingForm.onDemandEnabled} onChange={e=>setBilling("onDemandEnabled",e.target.checked)}/> Permitir cobro bajo demanda</label>
          </div>
          <div className="client-profile-grid">
            <MoneyInput label="Extra por contenido finalizado" value={billingForm.extraContentRate} onChange={v=>setBilling("extraContentRate",v)}/>
            <MoneyInput label="Extra por producción" value={billingForm.extraProductionRate} onChange={v=>setBilling("extraProductionRate",v)}/>
          </div>
          <MoneyInput label="Extra por generación IA" value={billingForm.extraAiGenerationRate} onChange={v=>setBilling("extraAiGenerationRate",v)}/>
          <div className="field"><label>Notas de facturación</label><textarea value={billingForm.billingNotes} onChange={e=>setBilling("billingNotes",e.target.value)} placeholder="Ej. Incluye 20 contenidos finalizados, 1 producción y 100 generaciones de IA. Excedentes se cobran bajo demanda."/></div>
          <button className="btn blue" onClick={saveBilling} disabled={savingBilling}>{savingBilling?"Guardando...":"Guardar configuración comercial"}</button>
        </div>
      </article>

      <aside className="brandbrain-card">
        <h2>Cómo se usará en reportes</h2>
        <div className="grid kpis" style={{gridTemplateColumns:"1fr 1fr",marginTop:16}}>
          <div className="kpi"><span>Fee mensual</span><strong>{money(billingSummary.retainer)}</strong></div>
          <div className="kpi"><span>Incluidos totales</span><strong>{billingSummary.included}</strong></div>
          <div className="kpi"><span>Contenido incluido</span><strong>{billingForm.includedFinalizedContents}</strong></div>
          <div className="kpi"><span>IA incluida</span><strong>{billingForm.includedAiGenerations}</strong></div>
        </div>
        <div className="brief-box" style={{marginTop:16}}>
          <h4>Balance mensual</h4>
          <p>Reportes tomará contenidos con estado <strong>finalizada</strong>, producciones del mes y generaciones creadas en BUST It Now.</p>
          <p>Si el consumo supera lo incluido y el cobro bajo demanda está activo, se calcula el excedente estimado para facturación.</p>
        </div>
      </aside>
    </section>
  </AppShell>
}

function NumberInput({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){
  return <div className="field"><label>{label}</label><input type="number" min="0" value={value} onChange={e=>onChange(e.target.value)}/></div>;
}

function MoneyInput({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){
  return <div className="field"><label>{label}</label><input type="number" min="0" value={value} onChange={e=>onChange(e.target.value)} placeholder="0"/></div>;
}

function num(value:any){
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value:number){
  return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number(value||0));
}
