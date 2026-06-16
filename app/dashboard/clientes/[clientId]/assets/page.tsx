"use client";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Brand, ClientAsset, deleteClientAsset, listBrands, listClientAssets, updateClientAsset, uploadClientAsset } from "@/lib/data";

const assetTypes=[{id:"logo",label:"Logo"},{id:"reference",label:"Referencia"},{id:"product",label:"Producto"},{id:"element",label:"Elemento gráfico"},{id:"stock",label:"Stock aprobado"}];
function isImage(asset:ClientAsset){return (asset.mimeType||"").startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(asset.fileUrl||asset.storagePath||"")}
function splitTags(v:string){return v.split(",").map(x=>x.trim()).filter(Boolean)}

export default function ClientAssetsPage(){
  const {clientId}=useParams<{clientId:string}>();
  const [client,setClient]=useState<Brand|null>(null);
  const [assets,setAssets]=useState<ClientAsset[]>([]);
  const [files,setFiles]=useState<File[]>([]);
  const [type,setType]=useState("reference");
  const [category,setCategory]=useState("");
  const [tags,setTags]=useState("");
  const [notes,setNotes]=useState("");
  const [uploading,setUploading]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){setClient((await listBrands()).find(x=>x.id===clientId)||null);setAssets(await listClientAssets(clientId))}
  useEffect(()=>{load()},[clientId]);
  function onFiles(e:ChangeEvent<HTMLInputElement>){setFiles(Array.from(e.target.files||[]))}
  async function upload(){
    if(!client)return;
    if(!files.length)return alert("Selecciona archivos.");
    setUploading(true);
    for(const file of files){await uploadClientAsset(clientId,client.name,file,{name:file.name.replace(/\.[^/.]+$/,"").replace(/[-_]+/g," "),type,category,tags:splitTags(tags),notes});}
    setFiles([]);setMessage("Assets subidos correctamente.");setUploading(false);await load();
  }
  async function toggleFeatured(asset:ClientAsset){if(!asset.id)return;await updateClientAsset(asset.id,{isFeatured:!asset.isFeatured});await load()}
  async function remove(asset:ClientAsset){if(!asset.id)return;if(!confirm(`¿Eliminar "${asset.name}"?`))return;await deleteClientAsset(asset.id);await load()}
  const grouped=useMemo(()=>assetTypes.map(t=>({...t,items:assets.filter(a=>a.type===t.id)})),[assets]);

  return <AppShell active="Clientes">
    <section className="hero">
      <div><Link href={`/dashboard/clientes/${clientId}`} className="btn">← Volver a Brand Brain</Link><p className="eyebrow" style={{marginTop:12}}>Assets de marca</p><h1>{client?.name||"Cliente"}</h1><p>Logos, referencias, productos, elementos gráficos y stock aprobado que BUST It Now usa como contexto visual.</p></div>
      <div className="client-os-card"><span className="mini">Assets destacados</span><strong style={{fontSize:42}}>{assets.filter(x=>x.isFeatured).length}</strong></div>
    </section>
    <section className="asset-upload-zone">
      <h3>Subir assets</h3><input type="file" multiple onChange={onFiles}/>
      <div className="form-grid"><div className="field"><label>Tipo</label><select value={type} onChange={e=>setType(e.target.value)}>{assetTypes.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></div><div className="field"><label>Categoría</label><input value={category} onChange={e=>setCategory(e.target.value)}/></div><div className="field"><label>Tags</label><input value={tags} onChange={e=>setTags(e.target.value)}/></div></div>
      <div className="field"><label>Notas</label><textarea value={notes} onChange={e=>setNotes(e.target.value)}/></div>
      {files.length>0 && <p className="mini">{files.length} archivo(s) seleccionado(s)</p>}{message && <div className="feedback-item done"><p>{message}</p></div>}
      <button className="btn blue" onClick={upload} disabled={uploading}>{uploading?"Subiendo...":"Subir assets"}</button>
    </section>
    <section className="report-section"><h3>Biblioteca de assets</h3>
      {grouped.map(group=><div key={group.id} style={{marginBottom:20}}><h3>{group.label} · {group.items.length}</h3><div className="asset-grid">{group.items.map(asset=><div className={`asset-card ${asset.isFeatured?"featured":""}`} key={asset.id}>{isImage(asset)?<img src={asset.fileUrl} alt={asset.name}/>:<div className="file-box">Archivo</div>}<strong>{asset.name}</strong><p className="mini">{asset.category||"Sin categoría"}</p><p className="mini">{asset.notes||"Sin notas"}</p><div className="client-system-pills">{asset.tags?.map(tag=><span className="feedback-mini-pill" key={tag}>{tag}</span>)}</div><button className="btn" onClick={()=>toggleFeatured(asset)}>{asset.isFeatured?"Quitar destacado":"Marcar destacado"}</button><button className="btn red" onClick={()=>remove(asset)}>Eliminar</button></div>)}</div></div>)}
    </section>
  </AppShell>
}
