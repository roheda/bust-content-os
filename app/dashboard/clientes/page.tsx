"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Brand, listUniqueBrands, saveBrand, updateBrand } from "@/lib/data";

function splitComma(value:string){return value.split(",").map(x=>x.trim()).filter(Boolean)}
function cleanUndefined<T extends Record<string, any>>(value:T):T{
  const out:any = {};
  Object.entries(value).forEach(([key,row])=>{
    if(row === undefined) return;
    if(row && typeof row === "object" && !Array.isArray(row)) out[key] = cleanUndefined(row as any);
    else out[key] = row;
  });
  return out;
}
function makeBrandUpdateFromAnalysis(context:any){
  return cleanUndefined({
    name: context.name || undefined,
    industry: context.industry || undefined,
    website: context.website || undefined,
    tone: context.tone || undefined,
    brandNotes: context.brandDescription || undefined,
    brandPersonality: context.brandPersonality || undefined,
    visualStyle: Array.isArray(context.visualStyle) ? context.visualStyle.join(", ") : context.visualStyle || undefined,
    contentPillars: context.contentPillars || undefined,
    marketScope: context.marketScope || undefined,
    marketRegion: context.marketRegion || undefined,
    primaryCity: context.primaryCity || undefined,
    serviceArea: context.serviceArea || undefined,
    location: context.serviceArea || context.primaryCity || undefined,
    offerSummary: context.offerSummary || undefined,
    localAudienceContext: context.localAudienceContext || undefined,
    buyerPersonas: context.buyerPersonas || [],
    valueProposition: context.valueProposition || undefined,
    contentAngles: context.contentAngles || [],
    customerPainPoints: context.customerPainPoints || [],
    recommendedPlatforms: context.recommendedPlatforms || [],
    analysisNotes: context.analysisNotes || undefined,
    websiteAnalysisAt: new Date().toISOString(),
    websiteAnalysisSource: context.pagesRead?.join("\n") || context.website || "",
    brandBrain:{
      brandDescription: context.brandDescription || "",
      tone: context.tone || "",
      colors: Array.isArray(context.colors) ? context.colors : splitComma(String(context.colors || "")),
      typography: context.typography || "",
      visualStyle: Array.isArray(context.visualStyle) ? context.visualStyle : splitComma(String(context.visualStyle || "")),
      dos: context.dos || [],
      donts: context.donts || [],
      recommendedModels: []
    }
  } as Partial<Brand>);
}

export default function ClientsPage(){
  const [clients,setClients]=useState<Brand[]>([]);
  const [name,setName]=useState("");
  const [industry,setIndustry]=useState("");
  const [website,setWebsite]=useState("");
  const [instagram,setInstagram]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [analyzing,setAnalyzing]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    setLoading(true);
    const rows = await listUniqueBrands();
    setClients(rows.filter(c=>(c.status||"active")!=="deleted").sort((a,b)=>a.name.localeCompare(b.name,"es")));
    setLoading(false);
  }
  useEffect(()=>{load()},[]);

  async function analyzeWebsite(currentClient: Partial<Brand>) {
    const response = await fetch("/api/analyze-client-website",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({website: currentClient.website, instagram: (currentClient as any).instagram, currentClient})
    });
    const payload = await response.json();
    if(!response.ok) throw new Error(payload?.error || "No se pudo analizar el sitio web.");
    return payload.context;
  }

  async function createClient(runAnalysis=false){
    if(!name.trim())return alert("Escribe el nombre del cliente.");
    if(runAnalysis && !website.trim() && !instagram.trim())return alert("Agrega sitio web o Instagram para analizarlo con IA.");
    setSaving(true);
    setAnalyzing(runAnalysis);
    try{
      const baseBrand: Brand = {
        name:name.trim(),
        industry:industry.trim(),
        website:website.trim(),
        instagram:instagram.trim(),
        status:"active",
        tone:"",
        audience:"",
        platforms:["Instagram","Facebook","TikTok"],
        posts:15,
        reels:4,
        productions:1,
        month:new Date().toISOString().slice(0,7),
        brandNotes:"",
        brandBrain:{brandDescription:"",tone:"",colors:[],typography:"",visualStyle:[],dos:[],donts:[],recommendedModels:[]},
        billingConfig:{monthlyRetainer:0,includedFinalizedContents:0,includedProductions:0,includedProductionBudget:0,includedAiGenerations:0,onDemandEnabled:true,extraContentRate:0,extraProductionRate:0,extraAiGenerationRate:0,billingNotes:""},
        services:["Content OS","BUST It Now"],
        sharedSystems:["BUST Content OS","BUST It Now"],
        buyerPersonas:[]
      };
      const ref = await saveBrand(baseBrand);
      if(runAnalysis){
        const context = await analyzeWebsite(baseBrand);
        await updateBrand(ref.id, makeBrandUpdateFromAnalysis({...context, name: context.name || baseBrand.name}));
        setMessage("Cliente creado y Brand Brain generado con IA desde su fuente digital. Revisa y ajusta antes de operar.");
      }else{
        setMessage("Cliente creado. Ya puedes configurar su Brand Brain, sitio web, buyer personas y assets.");
      }
      setName(""); setIndustry(""); setWebsite(""); setInstagram("");
      await load();
    }catch(error){
      alert(error instanceof Error ? error.message : "No se pudo crear el cliente.");
    }finally{
      setSaving(false);
      setAnalyzing(false);
    }
  }

  const countLabel = useMemo(()=>clients.length===1?"1 cliente activo":`${clients.length} clientes activos`,[clients.length]);

  return <AppShell active="Clientes">
    <section className="hero">
      <div><p className="eyebrow">Clientes / Brand Brain</p><h1>Clientes</h1><p>Crea cada marca una sola vez. Su sitio web, buyer personas, Brand Brain y Assets alimentan BUST It Now y toda la operación de Content OS.</p></div>
      <div className="pill">{countLabel}</div>
    </section>

    <section className="grid two-col">
      <article className="card">
        <p className="eyebrow">Nuevo cliente</p><h2>Alta de marca</h2>
        <div className="field"><label>Nombre del cliente</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Acerofertas"/></div>
        <div className="field"><label>Giro o categoría</label><input value={industry} onChange={e=>setIndustry(e.target.value)} placeholder="Ej. Acero, restaurante, inmobiliaria"/></div>
        <div className="field"><label>Sitio web</label><input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://cliente.com"/></div>
        <div className="field"><label>Instagram</label><input value={instagram} onChange={e=>setInstagram(e.target.value)} placeholder="@cliente o https://instagram.com/cliente"/></div>
        <div className="brief-box">
          <h4>Alta inteligente</h4>
          <p className="mini">Si agregas sitio web o Instagram, la IA puede llenar descripción, tono, oferta, contexto regional, pilares, ángulos y 3–4 buyer personas iniciales.</p>
        </div>
        {message && <div className="feedback-item done"><p>{message}</p></div>}
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button className="btn blue" onClick={()=>createClient(false)} disabled={saving}>{saving&&!analyzing?"Creando...":"Crear cliente"}</button>
          <button className="btn dark" onClick={()=>createClient(true)} disabled={saving}>{analyzing?"Analizando sitio...":"Crear y analizar con IA"}</button>
        </div>
      </article>

      <article className="card">
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
          <div><p className="eyebrow">Marcas almacenadas</p><h2>Configura su Brand Brain</h2></div>
          <button className="btn" onClick={load}>Actualizar</button>
        </div>
        {loading ? <p className="mini">Cargando clientes...</p> : clients.length===0 ? <p className="mini">Todavía no hay clientes activos.</p> : <div className="grid">
          {clients.map(client=><Link key={client.id} href={`/dashboard/clientes/${client.id}`} className="list-task-card">
            <strong>{client.name}</strong>
            <span className="mini">{client.industry || "Sin categoría definida"}{client.primaryCity ? ` · ${client.primaryCity}` : ""}</span>
            <span className="mini">{client.buyerPersonas?.length ? `${client.buyerPersonas.length} buyer persona` : "Sin buyer persona"}</span>
            <span className="system-pill">Abrir Brand Brain →</span>
          </Link>)}
        </div>}
      </article>
    </section>
  </AppShell>
}
