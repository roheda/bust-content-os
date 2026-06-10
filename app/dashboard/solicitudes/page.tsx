"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Piece, listPieces } from "@/lib/data";

export default function RequestsPage(){
  const [items,setItems]=useState<Piece[]>([]);
  useEffect(()=>{listPieces().then(setItems)},[]);
  return <AppShell active="Solicitudes"><section className="hero"><div><p className="eyebrow">Solicitudes</p><h1>Solicitudes guardadas</h1><p>Estas piezas vienen desde Firestore en la colección contentRequests.</p></div></section><section className="card" style={{marginTop:24}}><table className="table"><thead><tr><th>Cliente</th><th>#</th><th>Tipo</th><th>Tema</th><th>Objetivo</th><th>Estado</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{x.brandName}</td><td>{x.number}/{x.total}</td><td>{x.format}</td><td>{x.topic}</td><td>{x.goal}</td><td><span className="badge">{x.state}</span></td></tr>)}</tbody></table></section></AppShell>
}
