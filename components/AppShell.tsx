"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FeedbackWidget from "./FeedbackWidget";
import { PlatformUser, canUser, listUsers, platformModules } from "@/lib/data";

const items = platformModules.map((module) => [module.label, module.route, module.key] as const);

export default function AppShell({
  children,
  active = "Dashboard"
}: {
  children: React.ReactNode;
  active?: string;
}) {
  const [activeUser,setActiveUser]=useState<PlatformUser | null>(null);
  const [users,setUsers]=useState<PlatformUser[]>([]);

  useEffect(()=>{
    let mounted=true;
    async function load(){
      try{
        const rows = await listUsers();
        if(!mounted)return;
        setUsers(rows);
        const saved = typeof window !== "undefined" ? window.localStorage.getItem("bust-active-user-id") : "";
        const selected = rows.find(u=>u.id===saved) || rows.find(u=>u.isMaster || u.roleKey==="master") || rows[0] || null;
        setActiveUser(selected);
      }catch{
        setUsers([]);
      }
    }
    load();
    return ()=>{mounted=false};
  },[]);

  function chooseUser(id:string){
    const found = users.find(u=>u.id===id) || null;
    setActiveUser(found);
    if(typeof window !== "undefined") window.localStorage.setItem("bust-active-user-id", id);
  }

  const visibleItems = useMemo(()=>items.filter(([, , key])=>canUser(activeUser,key,"view")),[activeUser]);

  return <div className="shell">
    <aside className="sidebar">
      <div>
        <h1 className="logo">BUST<br/><span>Content OS</span></h1>
        <nav className="nav">
          {visibleItems.map(([label, href]) => <Link className={active === label ? "active" : ""} href={href} key={href}>{label}</Link>)}
        </nav>
      </div>
      <div className="userbox">
        <strong>{activeUser?.name || "BUST Content OS"}</strong><br/>
        <span>{activeUser?.roleLabel || "Sistema oficial"}</span>
        {users.length>0 && <select className="sidebar-user-select" value={activeUser?.id||""} onChange={e=>chooseUser(e.target.value)}>
          {users.map(user=><option key={user.id || user.email} value={user.id}>{user.name} · {user.roleLabel || user.roleKey}</option>)}
        </select>}
        <Link className="mini" style={{display:"inline-block",marginTop:8}} href="/dashboard/usuarios">Configurar usuarios →</Link>
      </div>
    </aside>
    <main className="main">{children}</main>
    <FeedbackWidget/>
  </div>;
}
