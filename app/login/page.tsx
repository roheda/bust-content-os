import Link from "next/link";

export default function LoginPage() {
  return (
    <main>
      <h1>BUST Content OS</h1>
      <p>Inicio del sistema</p>
      <Link href="/dashboard">Abrir dashboard</Link>
    </main>
  );
}
