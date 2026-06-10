import Link from "next/link";

export default function LoginPage(){
  return <main className="login">
    <section className="login-card">
      <div className="login-brand">
        <p className="eyebrow">BUST Content OS</p>
        <h1 style={{fontSize:44,margin:0}}>Planeador IA formal.</h1>
        <p style={{color:"#cbd5e1",lineHeight:1.7}}>Borradores, lotes, solicitudes y referencias guardados en Firebase.</p>
      </div>
      <div className="login-form">
        <p className="eyebrow">Acceso demo</p>
        <h2 style={{fontSize:32,marginTop:0}}>Entrar al sistema</h2>
        <p style={{color:"#667085",lineHeight:1.6}}>Esta versión ya usa Firestore para el flujo del planeador.</p>
        <Link className="btn blue" href="/dashboard">Entrar al dashboard →</Link>
      </div>
    </section>
  </main>;
}
