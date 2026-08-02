"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import FeedbackWidget from "./FeedbackWidget";
import PendingMentionsWidget from "./PendingMentionsWidget";
import OperationalCollaborationTools from "./OperationalCollaborationTools";
import { PlatformUser, canUser, findUserByAuth, listUsers, markUserLogin, moduleKeyForPath, platformModules } from "@/lib/data";

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
const authEnforced = process.env.NEXT_PUBLIC_AUTH_ENFORCED !== "false";
const demoLoginAllowed = !authEnforced && process.env.NODE_ENV !== "production";

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
  const [pendingModalDismiss,setPendingModalDismiss]=useState<HTMLButtonElement | null>(null);

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

    if(demoLoginAllowed) {
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

  useEffect(()=>{
    if(typeof window === "undefined" || loading) return;

    const targets = [
      { selector: ".pending-fab", storageKey: "bust-pending-fab-position" },
      { selector: ".feedback-fab", storageKey: "bust-feedback-fab-position" },
    ];
    const cleanups: Array<()=>void> = [];

    targets.forEach(({selector,storageKey})=>{
      const button=document.querySelector<HTMLElement>(selector);
      if(!button) return;

      button.style.touchAction="none";
      button.style.cursor="grab";
      button.style.userSelect="none";
      button.title="Arrastra para mover";

      function clamp(left:number,top:number){
        if(!button) return {left,top};
        const rect=button.getBoundingClientRect();
        return {
          left:Math.min(Math.max(8,left),Math.max(8,window.innerWidth-rect.width-8)),
          top:Math.min(Math.max(8,top),Math.max(8,window.innerHeight-rect.height-8)),
        };
      }

      function place(left:number,top:number){
        if(!button) return {left,top};
        const next=clamp(left,top);
        button.style.left=`${next.left}px`;
        button.style.top=`${next.top}px`;
        button.style.right="auto";
        button.style.bottom="auto";
        return next;
      }

      try{
        const saved=JSON.parse(window.localStorage.getItem(storageKey) || "null");
        if(saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)){
          place(saved.left,saved.top);
        }
      }catch{}

      let pointerId:number|null=null;
      let startX=0;
      let startY=0;
      let startLeft=0;
      let startTop=0;
      let dragged=false;
      let suppressClick=false;

      function onPointerDown(event:PointerEvent){
        if(!button || event.button!==0) return;
        const rect=button.getBoundingClientRect();
        pointerId=event.pointerId;
        startX=event.clientX;
        startY=event.clientY;
        startLeft=rect.left;
        startTop=rect.top;
        dragged=false;
        button.style.cursor="grabbing";
        try{button.setPointerCapture(event.pointerId);}catch{}
      }

      function onPointerMove(event:PointerEvent){
        if(!button || pointerId!==event.pointerId) return;
        const dx=event.clientX-startX;
        const dy=event.clientY-startY;
        if(!dragged && Math.hypot(dx,dy)<5) return;
        dragged=true;
        event.preventDefault();
        place(startLeft+dx,startTop+dy);
      }

      function finishPointer(event:PointerEvent){
        if(!button || pointerId!==event.pointerId) return;
        try{button.releasePointerCapture(event.pointerId);}catch{}
        pointerId=null;
        button.style.cursor="grab";
        if(!dragged) return;
        const rect=button.getBoundingClientRect();
        const next=place(rect.left,rect.top);
        try{window.localStorage.setItem(storageKey,JSON.stringify(next));}catch{}
        suppressClick=true;
        window.setTimeout(()=>{suppressClick=false;},0);
      }

      function onClick(event:MouseEvent){
        if(!suppressClick) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }

      function onResize(){
        if(!button) return;
        const rect=button.getBoundingClientRect();
        const next=place(rect.left,rect.top);
        try{window.localStorage.setItem(storageKey,JSON.stringify(next));}catch{}
      }

      button.addEventListener("pointerdown",onPointerDown);
      button.addEventListener("pointermove",onPointerMove);
      button.addEventListener("pointerup",finishPointer);
      button.addEventListener("pointercancel",finishPointer);
      button.addEventListener("click",onClick,true);
      window.addEventListener("resize",onResize);

      cleanups.push(()=>{
        button.removeEventListener("pointerdown",onPointerDown);
        button.removeEventListener("pointermove",onPointerMove);
        button.removeEventListener("pointerup",finishPointer);
        button.removeEventListener("pointercancel",finishPointer);
        button.removeEventListener("click",onClick,true);
        window.removeEventListener("resize",onResize);
      });
    });

    return ()=>cleanups.forEach((cleanup)=>cleanup());
  },[loading]);

  useEffect(()=>{
    if(typeof window === "undefined") return;

    const initialModalValues = new WeakMap<HTMLElement,string>();

    function isModal(element: Element | null): element is HTMLElement {
      return Boolean(
        element instanceof HTMLElement &&
        (element.classList.contains("modal-backdrop") || element.classList.contains("preview-modal"))
      );
    }

    function editableState(modal: HTMLElement) {
      const controls = Array.from(
        modal.querySelectorAll<HTMLElement>("input, textarea, select, [contenteditable='true']")
      ).filter((element)=>{
        if(element.closest("[data-app-unsaved-confirm='true']")) return false;
        if(element instanceof HTMLInputElement){
          const type=(element.type || "text").toLowerCase();
          if(["button","submit","reset","hidden"].includes(type)) return false;
          return !element.disabled && !element.readOnly;
        }
        if(element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
        if(element instanceof HTMLSelectElement) return !element.disabled;
        return element.getAttribute("contenteditable") === "true";
      });

      return JSON.stringify(controls.map((element,index)=>{
        if(element instanceof HTMLInputElement){
          const type=(element.type || "text").toLowerCase();
          if(type === "checkbox" || type === "radio") return [index,element.name,type,element.checked];
          if(type === "file") return [index,element.name,type,Array.from(element.files || []).map(file=>`${file.name}:${file.size}:${file.lastModified}`)];
          return [index,element.name,type,element.value];
        }
        if(element instanceof HTMLTextAreaElement) return [index,element.name,"textarea",element.value];
        if(element instanceof HTMLSelectElement) return [index,element.name,"select",Array.from(element.selectedOptions).map(option=>option.value)];
        return [index,"","contenteditable",element.textContent || ""];
      }));
    }

    function captureInitialState(modal: HTMLElement) {
      if(modal.dataset.appUnsavedConfirm === "true" || initialModalValues.has(modal)) return;
      initialModalValues.set(modal,editableState(modal));
    }

    function modalHasUnsavedChanges(modal: HTMLElement) {
      if(modal.classList.contains("preview-modal")) return false;
      captureInitialState(modal);
      return initialModalValues.get(modal) !== editableState(modal);
    }

    function dismissButton(modal: HTMLElement): HTMLButtonElement | null {
      const explicit=modal.querySelector<HTMLButtonElement>("[data-modal-dismiss]");
      if(explicit) return explicit;
      const buttons=Array.from(modal.querySelectorAll<HTMLButtonElement>("button"));
      return buttons.find((button)=>{
        const label=(button.getAttribute("aria-label") || button.textContent || "").trim().toLowerCase();
        return label === "cerrar" || label.startsWith("cerrar ") || label === "cancelar" || label.startsWith("cancelar ") || label === "×" || label === "x";
      }) || null;
    }

    function topVisibleModal() {
      const modals=Array.from(document.querySelectorAll<HTMLElement>(".modal-backdrop, .preview-modal"))
        .filter((modal)=>{
          if(modal.dataset.appUnsavedConfirm === "true") return false;
          const style=window.getComputedStyle(modal);
          return style.display !== "none" && style.visibility !== "hidden" && modal.getClientRects().length>0;
        });
      return modals[modals.length-1] || null;
    }

    function requestDismiss(modal: HTMLElement) {
      const button=dismissButton(modal);
      if(!button) return;
      if(modalHasUnsavedChanges(modal)){
        setPendingModalDismiss(button);
        return;
      }
      button.click();
    }

    function handleDocumentClick(event: MouseEvent) {
      const target=event.target;
      if(!(target instanceof HTMLElement)) return;

      const confirmBackdrop=target.closest<HTMLElement>("[data-app-unsaved-confirm='true']");
      if(confirmBackdrop){
        if(target === confirmBackdrop) setPendingModalDismiss(null);
        return;
      }

      const clickedButton=target.closest<HTMLButtonElement>("button");
      if(clickedButton){
        const modal=clickedButton.closest<HTMLElement>(".modal-backdrop, .preview-modal");
        if(modal && isModal(modal) && dismissButton(modal) === clickedButton){
          if(clickedButton.dataset.appDismissBypass === "true"){
            delete clickedButton.dataset.appDismissBypass;
            return;
          }
          if(modalHasUnsavedChanges(modal)){
            event.preventDefault();
            event.stopPropagation();
            setPendingModalDismiss(clickedButton);
          }
          return;
        }
      }

      if(isModal(target)) requestDismiss(target);
    }

    function handleEscape(event: KeyboardEvent) {
      if(event.key !== "Escape") return;
      const confirm=document.querySelector<HTMLElement>("[data-app-unsaved-confirm='true']");
      if(confirm){
        event.preventDefault();
        event.stopPropagation();
        setPendingModalDismiss(null);
        return;
      }
      const modal=topVisibleModal();
      if(!modal) return;
      event.preventDefault();
      event.stopPropagation();
      requestDismiss(modal);
    }

    function scheduleCapture(element: Element) {
      const candidates: HTMLElement[]=[];
      if(isModal(element)) candidates.push(element);
      element.querySelectorAll?.<HTMLElement>(".modal-backdrop, .preview-modal").forEach(modal=>candidates.push(modal));
      if(!candidates.length) return;
      window.requestAnimationFrame(()=>candidates.forEach(captureInitialState));
    }

    document.querySelectorAll<HTMLElement>(".modal-backdrop, .preview-modal").forEach(captureInitialState);
    const observer=new MutationObserver((mutations)=>{
      mutations.forEach((mutation)=>mutation.addedNodes.forEach((node)=>{
        if(node instanceof Element) scheduleCapture(node);
      }));
    });
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener("click",handleDocumentClick,true);
    document.addEventListener("keydown",handleEscape,true);

    return ()=>{
      observer.disconnect();
      document.removeEventListener("click",handleDocumentClick,true);
      document.removeEventListener("keydown",handleEscape,true);
    };
  },[]);

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

  function confirmPendingModalDismiss(){
    const button=pendingModalDismiss;
    setPendingModalDismiss(null);
    if(!button) return;
    button.dataset.appDismissBypass="true";
    window.setTimeout(()=>button.click(),0);
  }

  const currentModuleKey = useMemo(()=>moduleKeyForPath(pathname),[pathname]);
  const currentModule = useMemo(()=>platformModules.find((module)=>module.key===currentModuleKey),[currentModuleKey]);
  const canViewCurrentModule = useMemo(()=>canUser(activeUser,currentModuleKey,"view"),[activeUser,currentModuleKey]);
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
    <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`} aria-label="Navegación principal" onDoubleClick={()=>sidebarCollapsed && setSidebarCollapsed(false)}>
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
                title={sidebarCollapsed ? label : description}
                data-tooltip={label}
                aria-label={label}
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
        {demoLoginAllowed && users.length>0 && <select className="sidebar-user-select" value={activeUser?.id||""} onChange={e=>chooseUser(e.target.value)} aria-label="Cambiar usuario activo">
          {users.map(user=><option key={user.id || user.email} value={user.id}>{user.name} · {user.roleLabel || user.roleKey}</option>)}
        </select>}
        {(authEnforced || firebaseUser) && <button className="sidebar-logout" type="button" onClick={logout}>Cerrar sesión</button>}
        {authEnforced && <p className="mini session-note">Sesión segura activa</p>}
        {canUser(activeUser,"usuarios","configure") && <Link className="mini user-config-link" href="/dashboard/usuarios">Configurar usuarios →</Link>}
      </div>
    </aside>
    <button className="sidebar-expand-rail" type="button" onClick={()=>setSidebarCollapsed(false)} aria-label="Abrir menú lateral" title="Abrir menú">
      <span>→</span>
    </button>
    <main className="main">
      {canViewCurrentModule && <OperationalCollaborationTools activeUser={activeUser}/>}
      {canViewCurrentModule ? children : <section className="hero access-denied-panel">
        <div>
          <p className="eyebrow">Acceso restringido</p>
          <h1>No tienes permiso para este módulo</h1>
          <p>Tu rol actual no tiene acceso a {currentModule?.label || "esta sección"}. Si necesitas entrar, solicita el permiso a Dirección o Administración.</p>
        </div>
        <Link className="btn" href="/dashboard">Volver al dashboard</Link>
      </section>}
    </main>
    <PendingMentionsWidget activeUser={activeUser}/>
    <FeedbackWidget/>
    {pendingModalDismiss && <div
      className="modal-backdrop"
      data-app-unsaved-confirm="true"
      onClick={(event)=>{if(event.target===event.currentTarget)setPendingModalDismiss(null);}}
    >
      <div className="modal-card" style={{width:"min(480px,92vw)"}}>
        <p className="eyebrow">Cambios sin guardar</p>
        <h2 style={{marginTop:0}}>¿Cerrar sin guardar?</h2>
        <p>Tienes cambios que todavía no se han guardado. Si cierras ahora, se perderán.</p>
        <div style={{display:"flex",gap:12,justifyContent:"flex-end",flexWrap:"wrap"}}>
          <button className="btn" type="button" onClick={()=>setPendingModalDismiss(null)}>Seguir editando</button>
          <button className="btn red" type="button" onClick={confirmPendingModalDismiss}>Cerrar sin guardar</button>
        </div>
      </div>
    </div>}
  </div>;
}
