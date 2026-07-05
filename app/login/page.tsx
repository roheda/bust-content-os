"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { PlatformUser, findUserByAuth, listUsers, markUserLogin, updateUser } from "@/lib/data";

const authEnforced = process.env.NEXT_PUBLIC_AUTH_ENFORCED !== "false";
const demoLoginAllowed = !authEnforced && process.env.NODE_ENV !== "production";

export default function LoginPage(){
  const router = useRouter();
  const [users,setUsers]=useState<PlatformUser[]>([]);
  const [selected,setSelected]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [secureMode,setSecureMode]=useState(authEnforced);
  const [mustChangeProfile,setMustChangeProfile]=useState<PlatformUser | null>(null);
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");

  useEffect(()=>{
    let mounted = true;
    async function load(){
      try{
        const rows = await listUsers();
        if(!mounted) return;
        const active = rows.filter(u=>u.status!=="inactive");
        setUsers(active);
        const master = active.find(u=>u.isMaster || u.roleKey==="master") || active[0];
        setSelected(master?.id || "");
        setEmail(master?.email || "");
      }catch{setUsers([])}
    }
    load();

    const unsub = onAuthStateChanged(auth, async (firebaseUser)=>{
      if(!firebaseUser || !authEnforced) return;
      const profile = await findUserByAuth(firebaseUser.uid, firebaseUser.email || "");
      if(profile?.id && profile.status !== "inactive") {
        if(profile.mustChangePassword){
          setMustChangeProfile(profile);
          setSecureMode(true);
          setEmail(profile.email || firebaseUser.email || "");
          return;
        }
        window.localStorage.setItem("bust-active-user-id", profile.id);
        await markUserLogin(profile.id).catch(()=>{});
        router.replace("/dashboard");
      }
    });
    return ()=>{mounted=false; unsub();};
  },[router]);

  const selectedUser = useMemo(()=>users.find(u=>u.id===selected),[users,selected]);

  function enterDemo(){
    if(selected && typeof window !== "undefined") window.localStorage.setItem("bust-active-user-id", selected);
  }

  async function loginSecure(){
    setError("");
    setMessage("");
    if(!email.trim()) return setError("Escribe el correo del usuario.");
    if(!password) return setError("Escribe la contraseña.");
    setLoading(true);
    try{
      const credential = await signInWithEmailAndPassword(auth,email.trim().toLowerCase(),password);
      const profile = await findUserByAuth(credential.user.uid, credential.user.email || email);
      if(!profile?.id || profile.status === "inactive") {
        await signOut(auth).catch(()=>{});
        setError("Este correo no tiene usuario activo en BUST Content OS.");
        return;
      }
      if(profile.mustChangePassword){
        setMustChangeProfile(profile);
        setPassword("");
        setMessage("Por seguridad, cambia tu contraseña temporal para continuar.");
        return;
      }
      window.localStorage.setItem("bust-active-user-id", profile.id);
      await markUserLogin(profile.id).catch(()=>{});
      router.push("/dashboard");
    }catch(error:any){
      setError(error?.code === "auth/invalid-credential" ? "Correo o contraseña incorrectos." : (error?.message || "No se pudo iniciar sesión."));
    }finally{setLoading(false)}
  }


  async function completePasswordChange(){
    setError("");
    setMessage("");
    if(!auth.currentUser || !mustChangeProfile?.id) return setError("Vuelve a iniciar sesión para cambiar la contraseña.");
    if(newPassword.length < 8) return setError("La nueva contraseña debe tener al menos 8 caracteres.");
    if(newPassword !== confirmPassword) return setError("Las contraseñas no coinciden.");
    setLoading(true);
    try{
      await updatePassword(auth.currentUser,newPassword);
      await updateUser(mustChangeProfile.id,{mustChangePassword:false,inviteStatus:"active"});
      window.localStorage.setItem("bust-active-user-id", mustChangeProfile.id);
      await markUserLogin(mustChangeProfile.id).catch(()=>{});
      router.push("/dashboard");
    }catch(error:any){
      setError(error?.code === "auth/requires-recent-login" ? "Por seguridad, vuelve a iniciar sesión con la contraseña temporal e inténtalo de nuevo." : (error?.message || "No se pudo cambiar la contraseña."));
    }finally{setLoading(false)}
  }

  async function resetPassword(){
    setError("");
    setMessage("");
    const target = (email || selectedUser?.email || "").trim().toLowerCase();
    if(!target) return setError("Escribe el correo para enviar el link.");
    setLoading(true);
    try{
      await sendPasswordResetEmail(auth,target);
      setMessage("Listo. Se envió un correo para definir o recuperar contraseña.");
    }catch(error:any){
      setError(error?.message || "No se pudo enviar el correo de contraseña.");
    }finally{setLoading(false)}
  }

  return <main className="login">
    <section className="login-card">
      <div className="login-brand">
        <img className="login-lockup" src="/brand/bust-content-os-lockup-white.svg" alt="BUST Content OS" />
        <p className="eyebrow">Acceso interno seguro</p>
        <h1 style={{fontSize:44,margin:0}}>Operación de contenido.</h1>
        <p style={{color:"#cbd5e1",lineHeight:1.7}}>El sistema operativo creativo de BUST para solicitudes, producción, asignación, aprobación, usuarios y permisos.</p>
      </div>
      <div className="login-form">
        <p className="eyebrow">Acceso interno</p>
        <h2 style={{fontSize:32,marginTop:0}}>Entrar al sistema</h2>
        <p style={{color:"#667085",lineHeight:1.6}}>La contraseña se administra con Firebase Auth. BUST Content OS solo guarda permisos, clientes asignados y rol operativo.</p>

        {mustChangeProfile ? <div className="alert green">Contraseña temporal detectada. Crea tu contraseña personal para continuar.</div> : null}

        {!mustChangeProfile && demoLoginAllowed && <div className="auth-mode-tabs">
          <button type="button" className={!secureMode?"active":""} onClick={()=>setSecureMode(false)}>Modo prueba</button>
          <button type="button" className={secureMode?"active":""} onClick={()=>setSecureMode(true)}>Acceso con contraseña</button>
        </div>}

        {mustChangeProfile ? <>
          <div className="field"><label>Nueva contraseña</label><input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password"/></div>
          <div className="field"><label>Confirmar contraseña</label><input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repite tu nueva contraseña" autoComplete="new-password" onKeyDown={e=>{if(e.key==="Enter") completePasswordChange();}}/></div>
          {error && <div className="alert red">{error}</div>}
          {message && <div className="alert green">{message}</div>}
          <button className="btn blue" type="button" disabled={loading} onClick={completePasswordChange}>{loading?"Guardando...":"Cambiar contraseña y entrar →"}</button>
          <button className="btn" type="button" disabled={loading} onClick={async()=>{await signOut(auth); setMustChangeProfile(null); setNewPassword(""); setConfirmPassword("");}}>Cancelar</button>
        </> : !secureMode && demoLoginAllowed ? <>
          {users.length>0 && <div className="field"><label>Usuario</label><select value={selected} onChange={e=>{setSelected(e.target.value); const found=users.find(u=>u.id===e.target.value); if(found?.email) setEmail(found.email);}}>{users.map(user=><option key={user.id || user.email} value={user.id}>{user.name} · {user.roleLabel || user.roleKey}</option>)}</select></div>}
          <Link className="btn blue" href="/dashboard" onClick={enterDemo}>Entrar al dashboard →</Link>
          {users.length===0 && <p className="mini" style={{marginTop:14}}>Aún no hay usuarios guardados. Entra y crea el usuario master desde Usuarios.</p>}
        </> : <>
          <div className="field"><label>Correo</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@empresa.com" autoComplete="email"/></div>
          <div className="field"><label>Contraseña</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña" autoComplete="current-password" onKeyDown={e=>{if(e.key==="Enter") loginSecure();}}/></div>
          {error && <div className="alert red">{error}</div>}
          {message && <div className="alert green">{message}</div>}
          <button className="btn blue" type="button" disabled={loading} onClick={loginSecure}>{loading?"Entrando...":"Entrar con contraseña →"}</button>
          <button className="btn" type="button" disabled={loading} onClick={resetPassword}>Definir o recuperar contraseña</button>
          {demoLoginAllowed && <p className="mini" style={{marginTop:12}}>Modo prueba solo disponible en desarrollo local. Para producción usa NEXT_PUBLIC_AUTH_ENFORCED=true o deja la variable sin definir.</p>}
        </>}
      </div>
    </section>
  </main>;
}
