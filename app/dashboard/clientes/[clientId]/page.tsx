"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Brand, ClientBillingConfig, ClientBuyerPersona, getClientBillingConfig, updateBrand, listBrands } from "@/lib/data";

function joinItems(items?:string[]){return Array.isArray(items)?items.join(", "):""}
function splitComma(value:string){return value.split(",").map(x=>x.trim()).filter(Boolean)}
function splitLines(value:string){return value.split("\n").map(x=>x.trim()).filter(Boolean)}
function personaId(index:number){return `persona-${index+1}`}

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

const emptyPersona = (index:number): ClientBuyerPersona => ({id: personaId(index), name:"", description:"", pains:"", desires:"", contentAngles:""});

export default function ClientBrandBrainPage(){
  const {clientId} = useParams<{clientId:string}>();
  const [client,setClient]=useState<Brand|null>(null);
  const [form,setForm]=useState({
    name:"",industry:"",website:"",instagram:"",brandDescription:"",tone:"",colors:"",typography:"",visualStyle:"",dos:"",donts:"",recommendedModels:"",
    brandPersonality:"",contentPillars:"",valueProposition:"",contentAngles:"",customerPainPoints:"",
    marketScope:"",marketRegion:"",primaryCity:"",serviceArea:"",offerSummary:"",localAudienceContext:"",analysisNotes:""
  });
  const [buyerPersonas,setBuyerPersonas]=useState<ClientBuyerPersona[]>([emptyPersona(0),emptyPersona(1),emptyPersona(2)]);
  const [billingForm,setBillingForm]=useState(defaultBillingForm);
  const [saving,setSaving]=useState(false);
  const [savingBilling,setSavingBilling]=useState(false);
  const [analyzing,setAnalyzing]=useState(false);
  const [success,setSuccess]=useState("");
  const [deleteConfirmation,setDeleteConfirmation]=useState("");

  async function load(){
    const row = (await listBrands()).find(x=>x.id===clientId);
    if(!row)return;
    setClient(row);
    const brain = row.brandBrain || {};
    const billing = getClientBillingConfig(row);
    setForm({
      name:row.name||"", industry:row.industry||"", website:row.website||"", instagram:row.instagram||"",
      brandDescription:brain.brandDescription||row.brandNotes||"", tone:brain.tone||row.tone||"", colors:joinItems(brain.colors), typography:brain.typography||"",
      visualStyle:joinItems(brain.visualStyle)||row.visualStyle||"", dos:Array.isArray(brain.dos)?brain.dos.join("\n"):"",
      donts:Array.isArray(brain.donts)?brain.donts.join("\n"):"", recommendedModels:joinItems(brain.recommendedModels),
      brandPersonality:row.brandPersonality||"", contentPillars:row.contentPillars||"", valueProposition:row.valueProposition||"",
      contentAngles:joinItems(row.contentAngles), customerPainPoints:joinItems(row.customerPainPoints),
      marketScope:row.marketScope||"", marketRegion:row.marketRegion||"", primaryCity:row.primaryCity||"",
      serviceArea:row.serviceArea||row.location||"", offerSummary:row.offerSummary||"", localAudienceContext:row.localAudienceContext||"",
      analysisNotes:row.analysisNotes||""
    });
    const personas = (row.buyerPersonas || []).map((p,index)=>({...p,id:p.id || personaId(index)}));
    setBuyerPersonas(personas.length ? personas : [emptyPersona(0),emptyPersona(1),emptyPersona(2)]);
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
  function updatePersona(index:number,key:keyof ClientBuyerPersona,value:string){
    const next=[...buyerPersonas];
    next[index]={...next[index],id:next[index].id || personaId(index),[key]:value};
    setBuyerPersonas(next);
  }
  function addPersona(){setBuyerPersonas([...buyerPersonas,emptyPersona(buyerPersonas.length)])}
  function removePersona(index:number){setBuyerPersonas(buyerPersonas.filter((_,i)=>i!==index))}

  function normalizedPersonas(){
    return buyerPersonas
      .map((p,index)=>({id:p.id || personaId(index), name:String(p.name||"").trim(), description:String(p.description||"").trim(), pains:String(p.pains||"").trim(), desires:String(p.desires||"").trim(), contentAngles:String(p.contentAngles||"").trim()}))
      .filter(p=>p.name || p.description);
  }

  async function save(){
    setSaving(true);
    await updateBrand(clientId,{
      name:form.name.trim(), industry:form.industry.trim(), website:form.website.trim(), instagram:form.instagram.trim(), tone:form.tone.trim(), brandNotes:form.brandDescription.trim(),
      brandPersonality:form.brandPersonality.trim(), visualStyle:form.visualStyle.trim(), contentPillars:form.contentPillars.trim(),
      valueProposition:form.valueProposition.trim(), contentAngles:splitComma(form.contentAngles), customerPainPoints:splitComma(form.customerPainPoints), buyerPersonas:normalizedPersonas(),
      marketScope:form.marketScope.trim(), marketRegion:form.marketRegion.trim(), primaryCity:form.primaryCity.trim(),
      serviceArea:form.serviceArea.trim(), location:form.serviceArea.trim(), offerSummary:form.offerSummary.trim(),
      localAudienceContext:form.localAudienceContext.trim(), analysisNotes:form.analysisNotes.trim(),
      brandBrain:{brandDescription:form.brandDescription.trim(), tone:form.tone.trim(), colors:splitComma(form.colors), typography:form.typography.trim(), visualStyle:splitComma(form.visualStyle), dos:splitLines(form.dos), donts:splitLines(form.donts), recommendedModels:splitComma(form.recommendedModels)}
    });
    setSuccess("Brand Brain, sitio web y buyer personas guardados correctamente.");
    setSaving(false);
    await load();
  }

  async function analyzeWebsite(){
    if(!form.website.trim() && !form.instagram.trim())return alert("Agrega el sitio web o Instagram del cliente.");
    setAnalyzing(true);
    try{
      const response = await fetch("/api/analyze-client-website",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({website:form.website, instagram:form.instagram, currentClient:{...client,...form,buyerPersonas}})
      });
      const payload = await response.json();
      if(!response.ok)throw new Error(payload?.error || "No se pudo analizar el sitio web.");
      const ctx = payload.context || {};
      setForm(current=>({
        ...current,
        name:ctx.name || current.name,
        industry:ctx.industry || current.industry,
        website:ctx.website || current.website,
        instagram:ctx.instagram || current.instagram,
        brandDescription:ctx.brandDescription || current.brandDescription,
        tone:ctx.tone || current.tone,
        brandPersonality:ctx.brandPersonality || current.brandPersonality,
        visualStyle:Array.isArray(ctx.visualStyle) ? ctx.visualStyle.join(", ") : (ctx.visualStyle || current.visualStyle),
        colors:Array.isArray(ctx.colors) ? ctx.colors.join(", ") : (ctx.colors || current.colors),
        typography:ctx.typography || current.typography,
        dos:Array.isArray(ctx.dos) ? ctx.dos.join("\n") : current.dos,
        donts:Array.isArray(ctx.donts) ? ctx.donts.join("\n") : current.donts,
        marketScope:ctx.marketScope || current.marketScope,
        marketRegion:ctx.marketRegion || current.marketRegion,
        primaryCity:ctx.primaryCity || current.primaryCity,
        serviceArea:ctx.serviceArea || current.serviceArea,
        offerSummary:ctx.offerSummary || current.offerSummary,
        valueProposition:ctx.valueProposition || current.valueProposition,
        localAudienceContext:ctx.localAudienceContext || current.localAudienceContext,
        contentPillars:ctx.contentPillars || current.contentPillars,
        customerPainPoints:Array.isArray(ctx.customerPainPoints) ? ctx.customerPainPoints.join(", ") : current.customerPainPoints,
        contentAngles:Array.isArray(ctx.contentAngles) ? ctx.contentAngles.join(", ") : current.contentAngles,
        analysisNotes:ctx.analysisNotes || current.analysisNotes
      }));
      if(Array.isArray(ctx.buyerPersonas) && ctx.buyerPersonas.length){
        setBuyerPersonas(ctx.buyerPersonas.map((p:any,index:number)=>({id:p.id || personaId(index), name:p.name||"", description:p.description||"", pains:p.pains||"", desires:p.desires||"", contentAngles:p.contentAngles||""})));
      }
      setSuccess("IA analizó el sitio y propuso contexto. Revisa y guarda para aplicarlo.");
    }catch(error){
      alert(error instanceof Error ? error.message : "No se pudo analizar el sitio.");
    }finally{
      setAnalyzing(false);
    }
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

  const completeness = useMemo(()=>{
    const baseValues = Object.values(form).filter(x=>String(x||"").trim()).length;
    const personaScore = normalizedPersonas().length * 2;
    return Math.min(100, Math.round(((baseValues + personaScore)/(Object.values(form).length + 8))*100));
  },[form,buyerPersonas]);
  const billingSummary = useMemo(()=>{
    const included = num(billingForm.includedFinalizedContents) + num(billingForm.includedProductions) + num(billingForm.includedAiGenerations);
    return {included,retainer:num(billingForm.monthlyRetainer),onDemand:billingForm.onDemandEnabled};
  },[billingForm]);
  if(!client)return <AppShell active="Clientes"><section className="card"><p>Cargando Brand Brain...</p></section></AppShell>;

  return <AppShell active="Clientes">
    <section className="hero">
      <div><Link href="/dashboard/clientes" className="btn">← Volver a clientes</Link><p className="eyebrow" style={{marginTop:12}}>Cliente / Configuración</p><h1>{client.name}</h1><p>{client.industry || "Sin categoría definida"}. Esta memoria alimenta solicitudes, IA, BUST It Now, reportes y facturación.</p></div>
      <div className="client-os-card"><span className="mini">Completitud inicial</span><strong style={{fontSize:42}}>{completeness}%</strong><Link href={`/dashboard/clientes/${clientId}/assets`} className="btn blue">Abrir Assets</Link></div>
    </section>
    {success && <section className="feedback-item done"><p>{success}</p></section>}

    <section className="brandbrain-layout">
      <div className="brandbrain-card">
        <h2>Brand Brain y contexto IA</h2>
        <div className="brandbrain-form">
          <div className="client-profile-grid"><div className="field"><label>Nombre</label><input value={form.name} onChange={e=>set("name",e.target.value)}/></div><div className="field"><label>Giro</label><input value={form.industry} onChange={e=>set("industry",e.target.value)}/></div></div>
          <div className="client-profile-grid"><div className="field"><label>Sitio web</label><input value={form.website} onChange={e=>set("website",e.target.value)} placeholder="https://cliente.com"/></div><div className="field"><label>Instagram</label><input value={form.instagram} onChange={e=>set("instagram",e.target.value)} placeholder="@cliente"/></div></div>
          <div className="brief-box">
            <h4>Autollenado con IA desde sitio web</h4>
            <p className="mini">Lee el sitio, identifica oferta, región, tono, pilares, ángulos y buyer personas. Revisa el resultado antes de guardar.</p>
            <button type="button" className="btn dark" onClick={analyzeWebsite} disabled={analyzing}>{analyzing?"Analizando fuente...":"Analizar web/Instagram con IA"}</button>
          </div>
          <div className="field"><label>Descripción de marca</label><textarea value={form.brandDescription} onChange={e=>set("brandDescription",e.target.value)}/></div>
          <div className="client-profile-grid"><div className="field"><label>Tono</label><input value={form.tone} onChange={e=>set("tone",e.target.value)}/></div><div className="field"><label>Personalidad de marca</label><input value={form.brandPersonality} onChange={e=>set("brandPersonality",e.target.value)}/></div></div>
          <div className="field"><label>Propuesta de valor</label><textarea value={form.valueProposition} onChange={e=>set("valueProposition",e.target.value)} placeholder="Qué hace diferente al cliente y por qué la audiencia debería elegirlo."/></div>
          <div className="field"><label>Pilares de contenido</label><input value={form.contentPillars} onChange={e=>set("contentPillars",e.target.value)} placeholder="Educativo, producto, confianza, estilo de vida, comunidad"/></div>
          <div className="field"><label>Ángulos de contenido recomendados</label><textarea value={form.contentAngles} onChange={e=>set("contentAngles",e.target.value)} placeholder="Separados por coma"/></div>
          <div className="field"><label>Dolores del cliente final</label><textarea value={form.customerPainPoints} onChange={e=>set("customerPainPoints",e.target.value)} placeholder="Separados por coma"/></div>

          <div className="brief-box">
            <h4>Contexto de mercado para IA</h4>
            <p className="mini">Esto ayuda a que el botón de IA adapte ideas al alcance real del cliente: local, regional, nacional o ciudad específica.</p>
            <div className="client-profile-grid">
              <div className="field"><label>Alcance del cliente</label><select value={form.marketScope} onChange={e=>set("marketScope",e.target.value)}><option value="">Seleccionar</option><option>Local</option><option>Regional</option><option>Nacional</option><option>Internacional</option></select></div>
              <div className="field"><label>Región</label><input value={form.marketRegion} onChange={e=>set("marketRegion",e.target.value)} placeholder="Ej. Sureste de México"/></div>
            </div>
            <div className="client-profile-grid">
              <div className="field"><label>Ciudad base</label><input value={form.primaryCity} onChange={e=>set("primaryCity",e.target.value)} placeholder="Ej. Mérida, Yucatán"/></div>
              <div className="field"><label>Zona de servicio/venta</label><input value={form.serviceArea} onChange={e=>set("serviceArea",e.target.value)} placeholder="Ej. Mérida norte, Riviera Maya, Cancún"/></div>
            </div>
            <div className="field"><label>Qué ofrece / diferenciador comercial</label><textarea value={form.offerSummary} onChange={e=>set("offerSummary",e.target.value)} placeholder="Ej. Casas premium listas para entrega, recorridos, inversión inmobiliaria..."/></div>
            <div className="field"><label>Contexto de audiencia local</label><textarea value={form.localAudienceContext} onChange={e=>set("localAudienceContext",e.target.value)} placeholder="Ej. Familias jóvenes de Mérida norte, compradores de vivienda premium..."/></div>
          </div>

          <div className="client-profile-grid"><div className="field"><label>Colores</label><input value={form.colors} onChange={e=>set("colors",e.target.value)} placeholder="#003B71, #E31E24"/></div><div className="field"><label>Tipografía</label><input value={form.typography} onChange={e=>set("typography",e.target.value)}/></div></div>
          <div className="field"><label>Estilo visual</label><input value={form.visualStyle} onChange={e=>set("visualStyle",e.target.value)}/></div>
          <div className="field"><label>DO</label><textarea value={form.dos} onChange={e=>set("dos",e.target.value)} /></div>
          <div className="field"><label>DON'T</label><textarea value={form.donts} onChange={e=>set("donts",e.target.value)} /></div>
          <div className="field"><label>Modelos recomendados</label><input value={form.recommendedModels} onChange={e=>set("recommendedModels",e.target.value)}/></div>
          <div className="field"><label>Notas del análisis IA</label><textarea value={form.analysisNotes} onChange={e=>set("analysisNotes",e.target.value)} /></div>
          <button className="btn blue" onClick={save} disabled={saving}>{saving?"Guardando...":"Guardar Brand Brain"}</button>
        </div>
      </div>

      <aside className="brandbrain-card">
        <h2>Buyer personas</h2>
        <p className="mini">Estos perfiles aparecerán en cada solicitud. El creador puede elegir uno o dejar “Sin enfoque particular”.</p>
        <div className="persona-editor-list">
          {buyerPersonas.map((persona,index)=><div className="persona-editor-card" key={persona.id || index}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><strong>Buyer persona {index+1}</strong><button type="button" className="btn red small" onClick={()=>removePersona(index)}>Quitar</button></div>
            <div className="field"><label>Nombre</label><input value={persona.name || ""} onChange={e=>updatePersona(index,"name",e.target.value)} placeholder="Ej. Familia que busca casa lista"/></div>
            <div className="field"><label>Descripción</label><textarea value={persona.description || ""} onChange={e=>updatePersona(index,"description",e.target.value)} /></div>
            <div className="field"><label>Dolores</label><textarea value={persona.pains || ""} onChange={e=>updatePersona(index,"pains",e.target.value)} /></div>
            <div className="field"><label>Deseos</label><textarea value={persona.desires || ""} onChange={e=>updatePersona(index,"desires",e.target.value)} /></div>
            <div className="field"><label>Ángulos de contenido</label><textarea value={persona.contentAngles || ""} onChange={e=>updatePersona(index,"contentAngles",e.target.value)} /></div>
          </div>)}
        </div>
        <button type="button" className="btn" onClick={addPersona}>Agregar buyer persona</button>

        <h2 style={{marginTop:24}}>Resumen para generación</h2>
        <div className="detail-copy"><strong>Marca:</strong> {form.name}{"\n"}<strong>Giro:</strong> {form.industry}{"\n"}<strong>Sitio:</strong> {form.website||"Pendiente"}{"\n"}<strong>Tono:</strong> {form.tone||"Pendiente"}{"\n"}<strong>Alcance:</strong> {form.marketScope||"Pendiente"}{"\n"}<strong>Región:</strong> {form.marketRegion||"Pendiente"}{"\n"}<strong>Ciudad:</strong> {form.primaryCity||"Pendiente"}{"\n"}<strong>Oferta:</strong> {form.offerSummary||"Pendiente"}{"\n"}<strong>Buyer personas:</strong> {normalizedPersonas().map(p=>p.name).join(", ") || "Pendiente"}</div>
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
          <div className="client-profile-grid"><MoneyInput label="Iguala / fee mensual" value={billingForm.monthlyRetainer} onChange={v=>setBilling("monthlyRetainer",v)}/><NumberInput label="Contenidos finalizados incluidos" value={billingForm.includedFinalizedContents} onChange={v=>setBilling("includedFinalizedContents",v)}/></div>
          <div className="client-profile-grid"><NumberInput label="Producciones incluidas" value={billingForm.includedProductions} onChange={v=>setBilling("includedProductions",v)}/><MoneyInput label="Bolsa de producción incluida" value={billingForm.includedProductionBudget} onChange={v=>setBilling("includedProductionBudget",v)}/></div>
          <div className="client-profile-grid"><NumberInput label="Generaciones IA incluidas en BUST It Now" value={billingForm.includedAiGenerations} onChange={v=>setBilling("includedAiGenerations",v)}/><label className="check-row" style={{alignSelf:"end",marginBottom:6}}><input type="checkbox" checked={billingForm.onDemandEnabled} onChange={e=>setBilling("onDemandEnabled",e.target.checked)}/> Permitir cobro bajo demanda</label></div>
          <div className="client-profile-grid"><MoneyInput label="Extra por contenido finalizado" value={billingForm.extraContentRate} onChange={v=>setBilling("extraContentRate",v)}/><MoneyInput label="Extra por producción" value={billingForm.extraProductionRate} onChange={v=>setBilling("extraProductionRate",v)}/></div>
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
        <div className="brief-box" style={{marginTop:16}}><h4>Balance mensual</h4><p>Reportes tomará contenidos con estado <strong>finalizada</strong>, producciones del mes y generaciones creadas en BUST It Now.</p><p>Si el consumo supera lo incluido y el cobro bajo demanda está activo, se calcula el excedente estimado para facturación.</p></div>
      </aside>
    </section>
  </AppShell>
}

function NumberInput({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){return <div className="field"><label>{label}</label><input type="number" min="0" value={value} onChange={e=>onChange(e.target.value)}/></div>;}
function MoneyInput({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){return <div className="field"><label>{label}</label><input type="number" min="0" value={value} onChange={e=>onChange(e.target.value)} placeholder="0"/></div>;}
function num(value:any){const n = Number(value || 0);return Number.isFinite(n) ? n : 0;}
function money(value:number){return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number(value||0));}
