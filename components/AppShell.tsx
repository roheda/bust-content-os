"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import FeedbackWidget from "./FeedbackWidget";
import PendingMentionsWidget from "./PendingMentionsWidget";
import { PlatformUser, canUser, findUserByAuth, listUsers, markUserLogin, platformModules } from "@/lib/data";

const moduleIcons: Record<string, string> = {
  dashboard: "⌘",
  clientes: "◎",
  creador: "+",
  asignacion: "↗",
  producciones: "◉",
  tareas: "✓",
  ia_operativa: "◌",
  generador: "✦",
  aprobaciones: "●",
  contenidos: "▣",
  reportes: "▤",
  configuracion: "⚙",
  usuarios: "☻"
};

const moduleGroups = [
  { label: "Operación", keys: ["dashboard", "clientes", "creador", "asignacion", "producciones", "tareas", "aprobaciones", "contenidos"] },
  { label: "IA", keys: ["ia_operativa", "generador"] },
  { label: "Administración", keys: ["reportes", "configuracion", "usuarios"] }
];

const items = platformModules.map((module) => [module.label, module.route, module.key, module.description] as const);
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
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);

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
        if(profile.mustChangePassword){
          setAccessError("Debes cambiar tu contraseña temporal antes de entrar al sistema. Cierra sesión y vuelve a iniciar para definir tu contraseña personal.");
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


  useEffect(()=>{
    if(typeof window === "undefined") return;
    const saved = window.localStorage.getItem("bust-sidebar-collapsed");
    setSidebarCollapsed(saved === "true");
  },[]);

  useEffect(()=>{
    if(typeof window !== "undefined") window.localStorage.setItem("bust-sidebar-collapsed", sidebarCollapsed ? "true" : "false");
  },[sidebarCollapsed]);

  useEffect(()=>{
    setMobileMenuOpen(false);
  },[pathname]);

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

  function toggleSidebar(){
    setSidebarCollapsed((current)=>!current);
  }

  const visibleItems = useMemo(()=>items.filter(([, , key])=>canUser(activeUser,key,"view")),[activeUser]);
  const groupedItems = useMemo(()=>moduleGroups.map(group=>({
    ...group,
    items: visibleItems.filter(([, , key])=>group.keys.includes(key))
  })).filter(group=>group.items.length>0),[visibleItems]);

  if(loading) {
    return <div className="shell-loading"><div className="card"><p className="eyebrow">BUST Content OS</p><h2>Cargando permisos...</h2><p className="mini">Preparando tu espacio operativo.</p></div></div>;
  }

  if(authEnforced && accessError) {
    return <div className="shell-loading"><div className="card access-blocked"><p className="eyebrow">Acceso restringido</p><h2>No tienes permisos activos</h2><p>{accessError}</p><button className="btn blue" onClick={logout}>Cerrar sesión</button></div></div>;
  }

  return <div className={`shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobileMenuOpen ? "mobile-menu-open" : ""}`}>
    <button className="mobile-sidebar-toggle" type="button" aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={mobileMenuOpen} onClick={()=>setMobileMenuOpen((current)=>!current)}>
      <span></span><span></span><span></span>
    </button>
    {mobileMenuOpen ? <button className="mobile-sidebar-scrim" type="button" aria-label="Cerrar menú" onClick={()=>setMobileMenuOpen(false)} /> : null}
    <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`} aria-label="Navegación principal">
      <div className="sidebar-main-scroll">
        <div className="sidebar-head-row">
        <Link href="/dashboard" className="brand-mark brand-mark-logo" aria-label="Ir al dashboard">
          <img className="brand-logo-img" src="/brand/bust-logo-dark.svg" alt="BUST" />
          <span className="brand-os-text">
            <span className="brand-os-title">Content OS</span>
            <span className="brand-os-caption">Sistema operativo creativo</span>
          </span>
        </Link>
        <button className="sidebar-collapse-btn" type="button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expandir menú" : "Ocultar menú"} title={sidebarCollapsed ? "Expandir menú" : "Ocultar menú"}>
          <span aria-hidden="true">{sidebarCollapsed ? "→" : "←"}</span>
        </button>
        </div>
        <nav className="nav" aria-label="Módulos">
          {groupedItems.map(group=><div className="nav-group" key={group.label}>
            <p className="nav-section-label">{group.label}</p>
            {group.items.map(([label, href, key, description]) => {
              const isActive = active === label || pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
              return <Link
                className={isActive ? "active" : ""}
                href={href}
                key={href}
                title={description}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">{moduleIcons[key] || "•"}</span>
                <span className="nav-label">{label}</span>
              </Link>;
            })}
          </div>)}
        </nav>
      </div>
      <div className="userbox">
        <div className="user-profile-row">
          <span className="user-avatar" aria-hidden="true">{(activeUser?.name || firebaseUser?.email || "B").slice(0,1).toUpperCase()}</span>
          <div>
            <strong>{activeUser?.name || firebaseUser?.email || "BUST Content OS"}</strong><br/>
            <span>{activeUser?.roleLabel || "Sistema oficial"}</span>
          </div>
        </div>
        {!authEnforced && users.length>0 && <select className="sidebar-user-select" value={activeUser?.id||""} onChange={e=>chooseUser(e.target.value)} aria-label="Cambiar usuario activo">
          {users.map(user=><option key={user.id || user.email} value={user.id}>{user.name} · {user.roleLabel || user.roleKey}</option>)}
        </select>}
        {(authEnforced || firebaseUser) && <button className="sidebar-logout" type="button" onClick={logout}>Cerrar sesión</button>}
        {authEnforced && <p className="mini session-note">Sesión segura activa</p>}
        {canUser(activeUser,"usuarios","configure") && <Link className="mini user-config-link" href="/dashboard/usuarios">Configurar usuarios →</Link>}
      </div>
    </aside>
    <main className="main">{children}</main>
    <PendingMentionsWidget activeUser={activeUser}/>
    <FeedbackWidget/>
  </div>;
}
