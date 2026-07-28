import AppShell from "@/components/AppShell";
import DashboardAccessCards from "@/components/DashboardAccessCards";

export default function DashboardPage(){
  return <AppShell active="Dashboard">
    <section className="hero">
      <div>
        <p className="eyebrow">BUST Content OS</p>
        <h1>Dashboard</h1>
        <p>Flujo operativo: Content crea, Asignación distribuye, Producción genera material y Tareas ordena el día a día.</p>
      </div>
    </section>
    <DashboardAccessCards />
  </AppShell>;
}
