"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import FeedbackWidget from "./FeedbackWidget";
import PendingMentionsWidget from "./PendingMentionsWidget";
import { PlatformUser, canUser, findUserByAuth, listUsers, markUserLogin, platformModules } from "@/lib/data";

const items = platformModules.map((module) => [module.label, module.route, module.key] as const);
const authEnforced = process.env.NEXT_PUBLIC_AUTH_ENFORCED === "true";

export default function AppShell({
  children,
  active = "Dashboard"
}: {
  children: React.ReactNode;
  active?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeUser,setActiveUser]=useState<PlatformUser | null>(null);
  const [firebaseUser,setFirebaseUser]=useState<FirebaseUser | null>(null);
  const [users,setUsers]=useState<PlatformUser[]>([]);
  const [loading,setLoading]=useState(true);
  const [accessError,setAccessError]=useState("");

  useEffect(()=>{
    let mounted=true;
    async function loadDemoMode(){
      try{
        const rows = await listUsers();
        if(!mounted)return;
        setUsers(rows);
        const saved = typeof window !== "undefined" ? window.localStorage.getItem("bust-active-user-id") : "";
        const selected = rows.find(u=>u.id===saved) || rows.find(u=>u.isMaster || u.roleKey==="master") || rows[0] || null;
        setActiveUser(selected);
      }catch{
        setUsers([]);
      }finally{
        if(mounted) setLoading(false);
      }
    }

    if(!authEnforced) {
      loadDemoMode();
      const unsub = onAuthStateChanged(auth,(user)=>setFirebaseUser(user));
      return ()=>{mounted=false; unsub();};
    }

    const unsub = onAuthStateChanged(auth, async (user)=>{
      if(!mounted) return;
      setFirebaseUser(user);
      if(!user){
        setLoading(false);
        router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
        return;
      }
      try{
        const profile = await findUserByAuth(user.uid, user.email || "");
        if(!profile?.id || profile.status === "inactive"){
          setAccessError("Tu correo existe en Firebase Auth, pero no tiene un usuario activo en BUST Content OS.");
          setActiveUser(null);
          setUsers([]);
          setLoading(false);
          return;
        }
        window.localStorage.setItem("bust-active-user-id", profile.id);
        setActiveUser(profile);
        setUsers([profile]);
        await markUserLogin(profile.id).catch(()=>{});
      }catch(error:any){
        setAccessError(error?.message || "No se pudo cargar tu perfil de permisos.");
      }finally{
        if(mounted) setLoading(false);
      }
    });
    return ()=>{mounted=false; unsub();};
  },[pathname,router]);

  function chooseUser(id:string){
    const found = users.find(u=>u.id===id) || null;
    setActiveUser(found);
    if(typeof window !== "undefined") window.localStorage.setItem("bust-active-user-id", id);
  }

  async function logout(){
    await signOut(auth).catch(()=>{});
    if(typeof window !== "undefined") window.localStorage.removeItem("bust-active-user-id");
    router.push("/login");
  }

  const visibleItems = useMemo(()=>items.filter(([, , key])=>canUser(activeUser,key,"view")),[activeUser]);

  if(loading) {
    return <div className="shell-loading"><div className="card"><p className="eyebrow">BUST Content OS</p><h2>Cargando permisos...</h2></div></div>;
  }

  if(authEnforced && accessError) {
    return <div className="shell-loading"><div className="card access-blocked"><p className="eyebrow">Acceso restringido</p><h2>No tienes permisos activos</h2><p>{accessError}</p><button className="btn blue" onClick={logout}>Cerrar sesión</button></div></div>;
  }

  return <div className="shell">
    <aside className="sidebar">
      <div>
        <h1 className="logo">BUST<br/><span>Content OS</span></h1>
        <nav className="nav">
          {visibleItems.map(([label, href]) => <Link className={active === label ? "active" : ""} href={href} key={href}>{label}</Link>)}
        </nav>
      </div>
      <div className="userbox">
        <strong>{activeUser?.name || firebaseUser?.email || "BUST Content OS"}</strong><br/>
        <span>{activeUser?.roleLabel || "Sistema oficial"}</span>
        {!authEnforced && users.length>0 && <select className="sidebar-user-select" value={activeUser?.id||""} onChange={e=>chooseUser(e.target.value)}>
          {users.map(user=><option key={user.id || user.email} value={user.id}>{user.name} · {user.roleLabel || user.roleKey}</option>)}
        </select>}
        {(authEnforced || firebaseUser) && <button className="sidebar-logout" type="button" onClick={logout}>Cerrar sesión</button>}
        {authEnforced && <p className="mini" style={{marginTop:6}}>Sesión segura activa</p>}
        {canUser(activeUser,"usuarios","configure") && <Link className="mini" style={{display:"inline-block",marginTop:8}} href="/dashboard/usuarios">Configurar usuarios →</Link>}
      </div>
    </aside>
    <main className="main">{children}</main>
    <PendingMentionsWidget activeUser={activeUser}/>
    <FeedbackWidget/>
  </div>;
}
