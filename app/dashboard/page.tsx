import Link from "next/link";
import AppShell from "@/components/AppShell";

const modules = [
  ["Planeador IA", "Borradores en Firestore y publicación de lotes.", "/dashboard/planeador-ia"],
  ["Solicitudes", "Solicitudes publicadas desde los lotes.", "/dashboard/solicitudes"],
  ["Clientes", "Base para Brand Brain.", "/dashboard/clientes"],
  ["Producciones", "Agrupa solicitudes en una producción.", "/dashboard/producciones"],
  ["Aprobaciones", "Flujo de revisión posterior.", "/dashboard/aprobaciones"],
  ["Reportes", "Métricas y operación.", "/dashboard/reportes"]
];

export default function DashboardPage(){
  return <AppShell active="Dashboard">
    <section className="hero">
      <div>
        <p className="eyebrow">BUST Content OS</p>
        <h1>Dashboard</h1>
        <p>Versión limpia del Planeador IA conectada a Firestore.</p>
      </div>
      <Link className="btn" href="/dashboard/planeador-ia">Abrir Planeador IA →</Link>
    </section>
    <section className="grid cards">
      {modules.map(([title,desc,href])=><Link className="card" href={href} key={title}><span className="badge">Módulo</span><h3>{title}</h3><p>{desc}</p></Link>)}
    </section>
  </AppShell>;
}
