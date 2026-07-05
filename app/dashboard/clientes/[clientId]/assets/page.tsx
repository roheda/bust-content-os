"use client";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Brand, ClientAsset, deleteClientAsset, listBrands, listClientAssets, updateClientAsset, uploadClientAsset } from "@/lib/data";

type PendingAsset = {
  id: string;
  file: File;
  preview: string;
  name: string;
  type: string;
  category: string;
  tags: string;
  notes: string;
};

const assetTypes = [
  { id: "logo", label: "Logo" },
  { id: "reference", label: "Referencia visual" },
  { id: "product", label: "Producto / servicio" },
  { id: "element", label: "Elemento gráfico" },
  { id: "stock", label: "Stock aprobado" }
];

const categories = ["Principal", "Secundario", "Campaña", "Temporada", "Producto", "Ambiente", "Estilo", "Tipografía", "Color"];

function safePreview(file: File) {
  return file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
}
function splitTags(value: string) {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}
function isImage(asset: ClientAsset) {
  const path = `${asset.fileUrl} ${asset.storagePath || ""}`.toLowerCase();
  return (asset.mimeType || "").startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(path) || path.includes("firebasestorage.googleapis.com");
}

export default function ClientAssetsPage(){
  const { clientId } = useParams<{clientId:string}>();
  const [client,setClient] = useState<Brand|null>(null);
  const [assets,setAssets] = useState<ClientAsset[]>([]);
  const [pending,setPending] = useState<PendingAsset[]>([]);
  const [isUploading,setIsUploading] = useState(false);
  const [message,setMessage] = useState("");
  const [filter,setFilter] = useState("all");

  async function load(){
    const brands = await listBrands();
    setClient(brands.find((brand)=>brand.id===clientId) || null);
    setAssets(await listClientAssets(clientId));
  }

  useEffect(()=>{ load(); },[clientId]);
  useEffect(()=>()=>{ pending.forEach((item)=>{ if(item.preview) URL.revokeObjectURL(item.preview); }); },[pending]);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const next = files.map((file)=>({
      id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2,7)}`,
      file,
      preview: safePreview(file),
      name: file.name.replace(/\.[^/.]+$/,"").replace(/[-_]+/g," "),
      type: "reference",
      category: "",
      tags: "",
      notes: ""
    }));
    setPending((current)=>[...current,...next]);
    event.target.value = "";
  }

  function updatePending(id:string, patch:Partial<PendingAsset>){
    setPending((current)=>current.map((item)=>item.id===id ? {...item,...patch} : item));
  }

  function removePending(id:string){
    setPending((current)=>{
      const item = current.find((entry)=>entry.id===id);
      if(item?.preview) URL.revokeObjectURL(item.preview);
      return current.filter((entry)=>entry.id!==id);
    });
  }

  function applyTypeToAll(type:string){
    setPending((current)=>current.map((item)=>({...item,type})));
  }

  async function uploadAll(){
    if(!client)return alert("No encontramos el cliente.");
    if(!pending.length)return alert("Selecciona archivos para subir.");
    setIsUploading(true);
    setMessage("");
    try{
      for(const item of pending){
        await uploadClientAsset(clientId, client.name, item.file, {
          name: item.name.trim() || item.file.name,
          type: item.type,
          category: item.category,
          tags: splitTags(item.tags),
          notes: item.notes
        });
      }
      pending.forEach((item)=>{ if(item.preview) URL.revokeObjectURL(item.preview); });
      setPending([]);
      setMessage("Assets subidos correctamente.");
      await load();
    } finally {
      setIsUploading(false);
    }
  }

  async function toggleFeatured(asset: ClientAsset){
    if(!asset.id)return;
    await updateClientAsset(asset.id,{isFeatured:!asset.isFeatured});
    await load();
  }

  async function removeAsset(asset: ClientAsset){
    if(!asset.id)return;
    if(!confirm(`¿Eliminar "${asset.name}"?`))return;
    await deleteClientAsset(asset.id);
    await load();
  }

  const filteredAssets = useMemo(()=>assets.filter((asset)=>filter==="all" || asset.type===filter),[assets,filter]);
  const featuredCount = assets.filter((asset)=>asset.isFeatured).length;

  return <AppShell active="Clientes">
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="rounded-[2rem] bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-300/60 sm:p-8">
          <Link href={`/dashboard/clientes/${clientId}`} className="mb-5 inline-flex text-sm font-medium text-zinc-300 transition hover:text-white">← Volver al Brand Brain</Link>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-zinc-400">BUST IT NOW · ASSETS</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{client?.name || "Cliente"}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">Biblioteca real de assets por cliente. Sube varios archivos, define metadata individual y decide cuáles viajan por default al generador.</p>
        </header>

        <section className="grid gap-5 md:grid-cols-4">
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Assets</p><strong className="mt-2 block text-3xl">{assets.length}</strong></div>
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Destacados</p><strong className="mt-2 block text-3xl">{featuredCount}</strong></div>
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Pendientes</p><strong className="mt-2 block text-3xl">{pending.length}</strong></div>
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Logos</p><strong className="mt-2 block text-3xl">{assets.filter(a=>a.type==="logo").length}</strong></div>
        </section>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Carga múltiple</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Subir assets</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Selecciona varios archivos y edita metadata por cada asset antes de subirlos.</p>
            </div>
            <label className="inline-flex h-12 cursor-pointer items-center justify-center rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800">
              Seleccionar archivos
              <input type="file" multiple className="hidden" onChange={handleFiles}/>
            </label>
          </div>

          {pending.length>0 ? <div className="mt-6 space-y-5">
            <div className="flex flex-wrap gap-2">
              {assetTypes.map((type)=><button key={type.id} type="button" onClick={()=>applyTypeToAll(type.id)} className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-950">Aplicar {type.label} a todos</button>)}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pending.map((item)=>(
                <article key={item.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                  {item.preview ? <img src={item.preview} alt={item.name} className="h-40 w-full rounded-2xl object-cover"/> : <div className="flex h-40 items-center justify-center rounded-2xl bg-zinc-200 text-sm font-semibold text-zinc-600">Archivo</div>}
                  <div className="mt-4 space-y-3">
                    <input value={item.name} onChange={(e)=>updatePending(item.id,{name:e.target.value})} className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-950" placeholder="Nombre"/>
                    <div className="grid grid-cols-2 gap-3">
                      <select value={item.type} onChange={(e)=>updatePending(item.id,{type:e.target.value})} className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-950">{assetTypes.map((type)=><option key={type.id} value={type.id}>{type.label}</option>)}</select>
                      <input list="asset-categories" value={item.category} onChange={(e)=>updatePending(item.id,{category:e.target.value})} className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-950" placeholder="Categoría"/>
                    </div>
                    <input value={item.tags} onChange={(e)=>updatePending(item.id,{tags:e.target.value})} className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-950" placeholder="Tags separados por coma"/>
                    <textarea value={item.notes} onChange={(e)=>updatePending(item.id,{notes:e.target.value})} className="min-h-24 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-950" placeholder="Notas de uso para el generador"/>
                    <button type="button" onClick={()=>removePending(item.id)} className="w-full rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50">Quitar</button>
                  </div>
                </article>
              ))}
            </div>
            <button type="button" onClick={uploadAll} disabled={isUploading} className="h-12 rounded-2xl bg-zinc-950 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400">{isUploading ? "Subiendo assets..." : `Subir ${pending.length} asset(s)`}</button>
          </div> : <div className="mt-6 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-600">Todavía no hay archivos pendientes por subir.</div>}

          {message ? <div className="mt-5 rounded-3xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-medium text-green-800">{message}</div> : null}
        </section>

        <datalist id="asset-categories">{categories.map((category)=><option value={category} key={category}/>)}</datalist>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Biblioteca</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Assets guardados</h2></div>
            <select value={filter} onChange={(e)=>setFilter(e.target.value)} className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-950">
              <option value="all">Todos</option>
              {assetTypes.map((type)=><option key={type.id} value={type.id}>{type.label}</option>)}
            </select>
          </div>

          {filteredAssets.length===0 ? <div className="mt-5 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-600">No hay assets en esta vista.</div> : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {filteredAssets.map((asset)=>(
              <article key={asset.id} className={`rounded-3xl border p-4 transition ${asset.isFeatured ? "border-amber-300 bg-amber-50" : "border-zinc-200 bg-zinc-50"}`}>
                {isImage(asset) ? <img src={asset.fileUrl} alt={asset.name} className="h-40 w-full rounded-2xl object-cover"/> : <div className="flex h-40 items-center justify-center rounded-2xl bg-zinc-200 text-sm font-semibold text-zinc-600">Archivo</div>}
                <div className="mt-4">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-sm text-zinc-950">{asset.name}</strong>
                    {asset.isFeatured ? <span className="rounded-full bg-amber-200 px-2 py-1 text-[10px] font-bold uppercase text-amber-900">Destacado</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{asset.type} · {asset.category || "Sin categoría"}</p>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-600">{asset.notes || "Sin notas"}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{asset.tags?.map((tag)=><span key={tag} className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-zinc-600">{tag}</span>)}</div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={()=>toggleFeatured(asset)} className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100">{asset.isFeatured ? "Quitar" : "Destacar"}</button>
                    <button type="button" onClick={()=>removeAsset(asset)} className="rounded-2xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">Eliminar</button>
                  </div>
                </div>
              </article>
            ))}
          </div>}
        </section>
      </div>
    </main>
  </AppShell>;
}
