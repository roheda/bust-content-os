import Link from "next/link";

export default function DashboardPage() {
  return (
    <main>
      <h1>BUST Content OS</h1>
      <p>Dashboard inicial del sistema de contenido.</p>
      <nav>
        <Link href="/dashboard/planeador-ia">Planeador IA</Link>
      </nav>
    </main>
  );
}
