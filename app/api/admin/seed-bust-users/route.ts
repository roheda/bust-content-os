import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, firebaseAdminReady } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type PermissionAction = "view"|"create"|"edit"|"delete"|"approve"|"assign"|"billing"|"generate"|"configure";
type PermissionMatrix = Record<string, Partial<Record<PermissionAction, boolean>>>;

type SeedUser = {
  name: string;
  email: string;
  department: string;
  jobTitle: string;
  roleKey: string;
  roleLabel: string;
  notes: string;
  scope?: "all_clients" | "assigned_clients";
  canManageBilling?: boolean;
  canBypassClientLimits?: boolean;
};

const platformModules = [
  "dashboard","clientes","creador","asignacion","producciones","tareas","generador","aprobaciones","contenidos","reportes","configuracion","usuarios"
];

const fullActions: PermissionAction[] = ["view","create","edit","delete","approve","assign","billing","generate","configure"];

function matrixFor(modules: string[], actions: PermissionAction[]): PermissionMatrix {
  const matrix: PermissionMatrix = {};
  modules.forEach((moduleKey) => {
    matrix[moduleKey] = {};
    actions.forEach((action) => matrix[moduleKey][action] = true);
  });
  return matrix;
}

function mergeMatrices(...items: PermissionMatrix[]) {
  const merged: PermissionMatrix = {};
  items.forEach((matrix) => {
    Object.entries(matrix || {}).forEach(([moduleKey, actions]) => {
      merged[moduleKey] = { ...(merged[moduleKey] || {}), ...(actions || {}) };
    });
  });
  return merged;
}

function permissionsFor(roleKey: string): PermissionMatrix {
  if (roleKey === "master") return matrixFor(platformModules, fullActions);
  if (roleKey === "admin") return mergeMatrices(
    matrixFor(platformModules, ["view","create","edit","approve","assign","generate"]),
    matrixFor(["reportes"], ["billing"]),
    matrixFor(["configuracion"], ["configure"]),
    matrixFor(["usuarios"], ["configure"])
  );
  if (roleKey === "kam") return mergeMatrices(
    matrixFor(["dashboard","clientes","creador","asignacion","producciones","tareas","generador","aprobaciones","contenidos"], ["view"]),
    matrixFor(["creador","generador"], ["create","edit","generate"]),
    matrixFor(["aprobaciones"], ["approve"]),
    matrixFor(["contenidos"], ["edit"])
  );
  if (roleKey === "creativo") return mergeMatrices(
    matrixFor(["dashboard","creador","tareas","generador","contenidos"], ["view"]),
    matrixFor(["creador","tareas","generador","contenidos"], ["edit","generate"])
  );
  if (roleKey === "diseno_lead") return mergeMatrices(
    matrixFor(["dashboard","asignacion","tareas","generador","aprobaciones"], ["view"]),
    matrixFor(["asignacion"], ["assign","edit"]),
    matrixFor(["tareas","generador"], ["edit","generate"]),
    matrixFor(["aprobaciones"], ["approve"])
  );
  if (roleKey === "diseno") return mergeMatrices(
    matrixFor(["dashboard","tareas","generador","aprobaciones"], ["view"]),
    matrixFor(["tareas","generador"], ["edit","generate"])
  );
  if (roleKey === "content_lead") return mergeMatrices(
    matrixFor(["dashboard","clientes","creador","asignacion","tareas","generador","aprobaciones","contenidos","reportes"], ["view"]),
    matrixFor(["creador","tareas","generador"], ["create","edit","generate"]),
    matrixFor(["asignacion"], ["assign","edit"]),
    matrixFor(["aprobaciones"], ["approve"]),
    matrixFor(["contenidos"], ["edit","generate"])
  );
  if (roleKey === "content") return mergeMatrices(
    matrixFor(["dashboard","clientes","creador","tareas","generador","aprobaciones","contenidos"], ["view"]),
    matrixFor(["creador","tareas","generador"], ["create","edit","generate"]),
    matrixFor(["aprobaciones"], ["approve"]),
    matrixFor(["contenidos"], ["edit"])
  );
  if (roleKey === "audiovisual") return mergeMatrices(
    matrixFor(["dashboard","producciones","tareas","aprobaciones"], ["view"]),
    matrixFor(["producciones","tareas"], ["edit"])
  );
  return matrixFor(["dashboard"], ["view"]);
}


function buildUserAccess(uid: string, platformUserId: string, payload: any) {
  return {
    platformUserId,
    authUid: uid,
    email: (payload.email || "").trim().toLowerCase(),
    name: payload.name || "",
    roleKey: payload.roleKey || "kam",
    roleLabel: payload.roleLabel || payload.roleKey || "Usuario",
    status: payload.status || "active",
    isMaster: Boolean(payload.isMaster || payload.roleKey === "master"),
    department: payload.department || "",
    jobTitle: payload.jobTitle || "",
    scope: payload.scope || "assigned_clients",
    clientIds: payload.scope === "all_clients" ? [] : (payload.clientIds || []),
    permissions: payload.permissions || {},
    canBypassClientLimits: Boolean(payload.canBypassClientLimits),
    canManageBilling: Boolean(payload.canManageBilling),
    updatedAt: new Date().toISOString()
  };
}

const seedUsers: SeedUser[] = [
  { name:"Fernanda Gutierrez", email:"marifer@bust.mx", department:"Key Accounts", jobTitle:"Jefa de Key Accounts", roleKey:"admin", roleLabel:"Jefa de Key Accounts", notes:"KAM líder. Puede configurar operación, asignación y seguimiento general.", scope:"all_clients", canManageBilling:true },
  { name:"Gabriela Tapia", email:"gabs.bustmx@gmail.com", department:"Key Accounts", jobTitle:"KAM", roleKey:"kam", roleLabel:"KAM", notes:"KAM con cuentas asignadas." },
  { name:"Mauricio Manzanilla", email:"mau_photo@hotmail.com", department:"Audiovisual", jobTitle:"Fotógrafo y editor de foto", roleKey:"audiovisual", roleLabel:"Audiovisual", notes:"Fotógrafo y editor de foto." },
  { name:"Pablo Soberanis", email:"juansoberanisvazquez@gmail.com", department:"Key Accounts", jobTitle:"KAM", roleKey:"kam", roleLabel:"KAM", notes:"KAM con cuentas asignadas." },
  { name:"Paolette Pavon", email:"paolette.bust@gmail.com", department:"Key Accounts", jobTitle:"KAM", roleKey:"kam", roleLabel:"KAM", notes:"KAM con cuentas asignadas." },
  { name:"Rodrigo Hernandez", email:"copywriterbust2@gmail.com", department:"Copy", jobTitle:"Copywriter", roleKey:"creativo", roleLabel:"Copy / Creativo", notes:"Crea solicitudes y copy." },
  { name:"Carlos Juarez", email:"designbustmkt@gmail.com", department:"Diseño", jobTitle:"Jefe de Diseño", roleKey:"diseno_lead", roleLabel:"Jefe de Diseño", notes:"Jefe de diseño. Puede asignar y revisar carga de diseño." },
  { name:"Monica Lopez", email:"moniibust@gmail.com", department:"Content", jobTitle:"Content Manager", roleKey:"content", roleLabel:"Content", notes:"Programa posts y crea solicitudes." },
  { name:"Roberto Pech", email:"cafeinivoro@gmail.com", department:"Content", jobTitle:"Jefe de Content", roleKey:"content_lead", roleLabel:"Jefe de Content", notes:"Jefe de content y departamentos creativos." },
  { name:"Antonio Pool", email:"filmstlacuache7@gmail.com", department:"Audiovisual", jobTitle:"Productor audiovisual y editor", roleKey:"audiovisual", roleLabel:"Audiovisual", notes:"Productor audiovisual y editor." },
  { name:"Icela Zapata", email:"icelagreene19@gmail.com", department:"Diseño", jobTitle:"Diseñadora", roleKey:"diseno", roleLabel:"Diseño", notes:"Diseñadora." },
  { name:"Rodrigo Maldonado", email:"rodri.maldonado98@hotmail.com", department:"Key Accounts", jobTitle:"KAM", roleKey:"kam", roleLabel:"KAM", notes:"KAM con cuentas asignadas." },
  { name:"Abril Ordoñez", email:"abril.registros@gmail.com", department:"Audiovisual", jobTitle:"Editora audiovisual", roleKey:"audiovisual", roleLabel:"Audiovisual", notes:"Editora audiovisual." },
  { name:"Jorge David", email:"jorgedavid311003@gmail.com", department:"Diseño", jobTitle:"Diseñador", roleKey:"diseno", roleLabel:"Diseño", notes:"Diseñador." },
  { name:"Belinda Irene Lopez Benavides", email:"belizepol28@gmail.com", department:"Audiovisual", jobTitle:"Editora audiovisual", roleKey:"audiovisual", roleLabel:"Audiovisual", notes:"Editora audiovisual." }
];

async function canConfigureFromToken(token: string) {
  if (!adminAuth || !adminDb) return false;
  const decoded = await adminAuth.verifyIdToken(token);
  const byUid = await adminDb.collection("platformUsers").where("authUid", "==", decoded.uid).limit(1).get();
  const doc = !byUid.empty ? byUid.docs[0] : decoded.email ? (await adminDb.collection("platformUsers").where("email", "==", decoded.email.toLowerCase()).limit(1).get()).docs[0] : null;
  if (!doc) return false;
  const actor = doc.data() as any;
  return Boolean(actor && actor.status !== "inactive" && (actor.isMaster || actor.roleKey === "master" || actor.permissions?.usuarios?.configure));
}

async function assertAllowed(req: NextRequest) {
  const setupToken = process.env.AUTH_SETUP_TOKEN;
  const providedSetupToken = req.headers.get("x-setup-token") || "";
  const authorization = req.headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (setupToken && providedSetupToken && providedSetupToken === setupToken) return true;
  if (bearerToken) return canConfigureFromToken(bearerToken);
  return false;
}

export async function POST(req: NextRequest) {
  try {
    if (!firebaseAdminReady || !adminAuth || !adminDb) {
      return NextResponse.json({ ok:false, error:"Faltan variables FIREBASE_ADMIN_* en Vercel." }, { status:503 });
    }
    const allowed = await assertAllowed(req);
    if (!allowed) return NextResponse.json({ ok:false, error:"No tienes permiso para cargar usuarios." }, { status:403 });

    const body = await req.json().catch(()=>({}));
    const tempPassword = String(body.tempPassword || "");
    const resetExistingPasswords = Boolean(body.resetExistingPasswords);
    if (tempPassword.length < 8) {
      return NextResponse.json({ ok:false, error:"La contraseña temporal debe tener al menos 8 caracteres." }, { status:400 });
    }

    const results:any[] = [];
    for (const item of seedUsers) {
      const email = item.email.trim().toLowerCase();
      let authUser;
      let authCreated = false;
      try {
        authUser = await adminAuth.getUserByEmail(email);
        if (resetExistingPasswords) {
          authUser = await adminAuth.updateUser(authUser.uid, { password: tempPassword, displayName: item.name, disabled:false });
        } else if (authUser.displayName !== item.name) {
          authUser = await adminAuth.updateUser(authUser.uid, { displayName: item.name, disabled:false });
        }
      } catch (error:any) {
        if (error?.code !== "auth/user-not-found") throw error;
        authUser = await adminAuth.createUser({
          email,
          password: tempPassword,
          displayName: item.name,
          emailVerified:false,
          disabled:false
        });
        authCreated = true;
      }

      const existing = await adminDb.collection("platformUsers").where("email", "==", email).limit(1).get();
      const payload = {
        name:item.name,
        email,
        department:item.department,
        jobTitle:item.jobTitle,
        roleKey:item.roleKey,
        roleLabel:item.roleLabel,
        status:"active",
        isMaster:false,
        scope:item.scope || "assigned_clients",
        clientIds:[],
        permissions:permissionsFor(item.roleKey),
        canBypassClientLimits:Boolean(item.canBypassClientLimits),
        canManageBilling:Boolean(item.canManageBilling),
        authUid:authUser.uid,
        inviteStatus:"auth_created",
        mustChangePassword:true,
        notes:item.notes,
        seededFrom:"LISTA USUARIOS Y PUESTOS.xlsx",
        updatedAt:new Date().toISOString()
      };

      if (existing.empty) {
        const ref = await adminDb.collection("platformUsers").add({ ...payload, createdAt:new Date().toISOString() });
        await adminDb.collection("userAccess").doc(authUser.uid).set(buildUserAccess(authUser.uid, ref.id, payload), { merge:true });
        results.push({ email, id:ref.id, authCreated, platformUser:"created", userAccess:"synced" });
      } else {
        await existing.docs[0].ref.set(payload, { merge:true });
        await adminDb.collection("userAccess").doc(authUser.uid).set(buildUserAccess(authUser.uid, existing.docs[0].id, payload), { merge:true });
        results.push({ email, id:existing.docs[0].id, authCreated, platformUser:"updated", userAccess:"synced" });
      }
    }

    return NextResponse.json({ ok:true, count:results.length, results });
  } catch (error:any) {
    console.error("seed-bust-users", error);
    return NextResponse.json({ ok:false, error:error?.message || "No se pudo cargar el equipo BUST." }, { status:500 });
  }
}
