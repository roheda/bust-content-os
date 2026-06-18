"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PlatformUser, listUsers } from "@/lib/data";

export default function LoginPage(){
  const [users,setUsers]=useState<PlatformUser[]>([]);
  const [selected,setSelected]=useState("");

  useEffect(()=>{
    async function load(){
      try{
        const rows = await listUsers();
        setUsers(rows.filter(u=>u.status!=="inactive"));
        const master = rows.find(u=>u.isMaster || u.roleKey==="master") || rows[0];
        setSelected(master?.id || "");
      }catch{setUsers([])}
    }
    load();
  },[]);

  function enter(){
    if(selected && typeof window !== "undefined") window.localStorage.setItem("bust-active-user-id", selected);
  }

  return <main className="login">
    <section className="login-card">
      <div className="login-brand">
        <p className="eyebrow">BUST Content OS</p>
        <h1 style={{fontSize:44,margin:0}}>Operación de contenido.</h1>
        <p style={{color:"#cbd5e1",lineHeight:1.7}}>Creador de solicitudes, asignación, producciones, usuarios y permisos por rol.</p>
      </div>
      <div className="login-form">
        <p className="eyebrow">Acceso interno</p>
        <h2 style={{fontSize:32,marginTop:0}}>Entrar al sistema</h2>
        <p style={{color:"#667085",lineHeight:1.6}}>Selecciona el usuario operativo. La conexión segura con contraseña queda lista para integrarse con Firebase Auth.</p>
        {users.length>0 && <div className="field"><label>Usuario</label><select value={selected} onChange={e=>setSelected(e.target.value)}>{users.map(user=><option key={user.id || user.email} value={user.id}>{user.name} · {user.roleLabel || user.roleKey}</option>)}</select></div>}
        <Link className="btn blue" href="/dashboard" onClick={enter}>Entrar al dashboard →</Link>
        {users.length===0 && <p className="mini" style={{marginTop:14}}>Aún no hay usuarios guardados. Entra y crea el usuario master desde Usuarios.</p>}
      </div>
    </section>
  </main>;
}
