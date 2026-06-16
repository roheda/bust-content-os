import Link from "next/link";

const items = [
  ["Dashboard", "/dashboard"],
  ["Clientes", "/dashboard/clientes"],
  ["Creador de Solicitudes", "/dashboard/creador-solicitudes"],
  ["Asignación", "/dashboard/asignacion"],
  ["Producciones", "/dashboard/producciones"],
  ["Tareas", "/dashboard/tareas"],
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
        <h1 className="logo">BUST</h1>
        <nav className="nav">
          {items.map(([label, href]) => <Link className={active === label ? "active" : ""} href={href} key={href}>{label}</Link>)}
        </nav>
      </div>
      <div className="userbox">
        <strong>Operación Content</strong><br/>
        Creador · Asignación · Tareas
      </div>
    </aside>
    <main className="main">{children}</main>
  </div>;
}
