import Link from "next/link";

export default function DashboardPage(){return <main className="page"><section className="card"><p>BUST CONTENT OS</p><h1>Dashboard</h1><p>Base del sistema de contenido.</p><div className="grid"><Link href="/dashboard/planeador-ia">Planeador IA</Link><Link href="/dashboard/clientes">Clientes</Link><Link href="/dashboard/solicitudes">Solicitudes</Link><Link href="/dashboard/producciones">Producciones</Link></div></section></main>}
