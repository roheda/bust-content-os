import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, firebaseAdminReady } from "@/lib/firebase-admin";
import { isSetupTokenValid } from "@/lib/setup-token";

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

function seedUsersFromEnv(): SeedUser[] {
  const raw = process.env.BUST_SEED_USERS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        name: String(item?.name || "").trim(),
        email: String(item?.email || "").trim().toLowerCase(),
        department: String(item?.department || ""),
        jobTitle: String(item?.jobTitle || ""),
        roleKey: String(item?.roleKey || "kam"),
        roleLabel: String(item?.roleLabel || item?.roleKey || "Usuario"),
        notes: String(item?.notes || ""),
        scope: (item?.scope === "all_clients" ? "all_clients" : "assigned_clients") as SeedUser["scope"],
        canManageBilling: Boolean(item?.canManageBilling),
        canBypassClientLimits: Boolean(item?.canBypassClientLimits),
      }))
      .filter((item) => item.name && item.email);
  } catch {
    return [];
  }
}


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
  const providedSetupToken = req.headers.get("x-setup-token") || "";
  const authorization = req.headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (isSetupTokenValid(providedSetupToken)) return true;
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
    const seedUsers = seedUsersFromEnv();
    if (!seedUsers.length) {
      return NextResponse.json({ ok:false, error:"La carga masiva está desactivada o falta BUST_SEED_USERS_JSON en Vercel. Crea usuarios individualmente desde Usuarios o configura esa variable temporalmente." }, { status:400 });
    }
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
        seededFrom:"BUST_SEED_USERS_JSON",
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
