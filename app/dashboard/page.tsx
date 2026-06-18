import Link from "next/link";
import AppShell from "@/components/AppShell";

const modules = [
  ["Creador de Solicitudes", "Content crea lotes completos y valida material/producción.", "/dashboard/creador-solicitudes"],
  ["Asignación", "Jefes de área asignan piezas listas o las mandan a producción.", "/dashboard/asignacion"],
  ["Producciones", "Agrupa solicitudes y crea briefs de producción.", "/dashboard/producciones"],
  ["Tareas", "Panel operativo por fecha, persona, estado y vencimiento.", "/dashboard/tareas"],
  ["Clientes", "Base de marca y paquetes.", "/dashboard/clientes"],
  ["Reportes", "Métricas de avance, carga, calidad y bloqueos.", "/dashboard/reportes"],
  ["Usuarios", "Roles, permisos, clientes asignados y usuario master.", "/dashboard/usuarios"]
];

export default function DashboardPage(){
  return <AppShell active="Dashboard">
    <section className="hero">
      <div>
        <p className="eyebrow">BUST Content OS</p>
        <h1>Dashboard</h1>
        <p>Flujo operativo: Content crea, Asignación distribuye, Producción genera material y Tareas ordena el día a día.</p>
      </div>
      <Link className="btn" href="/dashboard/creador-solicitudes">Crear solicitudes →</Link>
    </section>
    <section className="grid cards">
      {modules.map(([title,desc,href])=><Link className="card" href={href} key={title}><span className="badge">Módulo</span><h3>{title}</h3><p>{desc}</p></Link>)}
    </section>
  </AppShell>;
}
