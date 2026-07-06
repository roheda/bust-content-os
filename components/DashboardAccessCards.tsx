"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { PlatformUser, canUser, findUserByAuth, listUsers } from "@/lib/data";

const authEnforced = process.env.NEXT_PUBLIC_AUTH_ENFORCED !== "false";
const demoLoginAllowed = !authEnforced && process.env.NODE_ENV !== "production";

const modules = [
  { key: "creador", title: "Creador de Solicitudes", desc: "Content crea lotes completos y valida material/producción.", href: "/dashboard/creador-solicitudes" },
  { key: "asignacion", title: "Asignación", desc: "Jefes de área asignan piezas listas o las mandan a producción.", href: "/dashboard/asignacion" },
  { key: "producciones", title: "Producciones", desc: "Agrupa solicitudes y crea briefs de producción.", href: "/dashboard/producciones" },
  { key: "tareas", title: "Tareas", desc: "Panel operativo por fecha, persona, estado y vencimiento.", href: "/dashboard/tareas" },
  { key: "ia_operativa", title: "IA Operativa", desc: "Aprende de cargas, rebotes, tiempos y finalizadas para sugerir mejores decisiones.", href: "/dashboard/planeador-ia" },
  { key: "clientes", title: "Clientes", desc: "Base de marca y paquetes.", href: "/dashboard/clientes" },
  { key: "reportes", title: "Reportes", desc: "Métricas de avance, carga, calidad y bloqueos.", href: "/dashboard/reportes" },
  { key: "usuarios", title: "Usuarios", desc: "Roles, permisos, clientes asignados y usuario master.", href: "/dashboard/usuarios" }
];

export default function DashboardAccessCards() {
  const [activeUser,setActiveUser] = useState<PlatformUser | null>(null);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    let mounted = true;
    async function loadDemoMode(){
      try{
        const rows = await listUsers();
        const saved = typeof window !== "undefined" ? window.localStorage.getItem("bust-active-user-id") : "";
        const selected = rows.find((user)=>user.id===saved) || rows.find((user)=>user.isMaster || user.roleKey==="master") || rows[0] || null;
        if(mounted) setActiveUser(selected);
      }finally{
        if(mounted) setLoading(false);
      }
    }

    if(demoLoginAllowed){
      loadDemoMode();
      return ()=>{mounted=false;};
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser)=>{
      if(!mounted) return;
      if(!firebaseUser){
        setActiveUser(null);
        setLoading(false);
        return;
      }
      try{
        const profile = await findUserByAuth(firebaseUser.uid, firebaseUser.email || "");
        if(mounted) setActiveUser(profile?.status === "active" ? profile : null);
      }finally{
        if(mounted) setLoading(false);
      }
    });
    return ()=>{mounted=false; unsub();};
  },[]);

  const visibleModules = useMemo(()=>modules.filter((module)=>canUser(activeUser,module.key,"view")),[activeUser]);
  const canCreateRequests = canUser(activeUser,"creador","view") && canUser(activeUser,"creador","create");

  if(loading) return <section className="grid cards"><div className="card"><span className="badge">Permisos</span><h3>Cargando accesos...</h3><p>Validando los módulos disponibles para tu rol.</p></div></section>;

  return <>
    {canCreateRequests ? <div className="dashboard-primary-action"><Link className="btn" href="/dashboard/creador-solicitudes">Crear solicitudes →</Link></div> : null}
    <section className="grid cards">
      {visibleModules.map((module)=><Link className="card" href={module.href} key={module.key}><span className="badge">Módulo</span><h3>{module.title}</h3><p>{module.desc}</p></Link>)}
      {!visibleModules.length ? <div className="card"><span className="badge">Accesos</span><h3>Sin módulos disponibles</h3><p>Tu usuario no tiene permisos visibles. Solicita apoyo a Administración.</p></div> : null}
    </section>
  </>;
}
