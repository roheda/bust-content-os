import Link from "next/link";
import FeedbackWidget from "./FeedbackWidget";

const items = [
  ["Dashboard", "/dashboard"],
  ["Clientes", "/dashboard/clientes"],
  ["Creador de Solicitudes", "/dashboard/creador-solicitudes"],
  ["Contenidos", "/dashboard/solicitudes"],
  ["Asignación", "/dashboard/asignacion"],
  ["Producciones", "/dashboard/producciones"],
  ["Tareas", "/dashboard/tareas"],
  ["BUST It Now", "/dashboard/generador"],
  ["Aprobaciones", "/dashboard/aprobaciones"],
  ["Reportes", "/dashboard/reportes"]
];

export default function AppShell({
  children,
  active = "Dashboard"
}: {
  children: React.ReactNode;
  active?: string;
}) {
  return <div className="shell">
    <aside className="sidebar">
      <div>
        <h1 className="logo">BUST<br/><span>Content OS</span></h1>
        <nav className="nav">
          {items.map(([label, href]) => <Link className={active === label ? "active" : ""} href={href} key={href}>{label}</Link>)}
        </nav>
      </div>
      <div className="userbox">
        <strong>BUST Content OS</strong><br/>
        Sistema oficial · BUST It Now módulo
      </div>
    </aside>
    <main className="main">{children}</main>
    <FeedbackWidget/>
  </div>;
}
