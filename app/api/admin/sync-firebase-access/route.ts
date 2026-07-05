import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, firebaseAdminReady } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type PlatformUserDoc = {
  email?: string;
  name?: string;
  roleKey?: string;
  roleLabel?: string;
  isMaster?: boolean;
  status?: string;
  permissions?: Record<string, Record<string, boolean>>;
  scope?: "all_clients" | "assigned_clients";
  clientIds?: string[];
  department?: string;
  jobTitle?: string;
  canBypassClientLimits?: boolean;
  canManageBilling?: boolean;
  authUid?: string;
};

function canConfigureUsers(user?: PlatformUserDoc | null) {
  return Boolean(
    user &&
    user.status !== "inactive" &&
    (user.isMaster || user.roleKey === "master" || user.permissions?.usuarios?.configure)
  );
}

function buildUserAccess(uid: string, platformUserId: string, profile: PlatformUserDoc) {
  const roleKey = profile.roleKey || "kam";
  return {
    platformUserId,
    authUid: uid,
    email: (profile.email || "").trim().toLowerCase(),
    name: profile.name || "",
    roleKey,
    roleLabel: profile.roleLabel || roleKey,
    status: profile.status || "active",
    isMaster: Boolean(profile.isMaster || roleKey === "master"),
    department: profile.department || "",
    jobTitle: profile.jobTitle || "",
    scope: profile.scope || "assigned_clients",
    clientIds: profile.scope === "all_clients" ? [] : (profile.clientIds || []),
    permissions: profile.permissions || {},
    canBypassClientLimits: Boolean(profile.canBypassClientLimits),
    canManageBilling: Boolean(profile.canManageBilling),
    updatedAt: new Date().toISOString()
  };
}

async function getActorFromToken(token: string) {
  if (!adminAuth || !adminDb) return null;
  const decoded = await adminAuth.verifyIdToken(token);
  const byUid = await adminDb.collection("platformUsers").where("authUid", "==", decoded.uid).limit(1).get();
  if (!byUid.empty) return byUid.docs[0].data() as PlatformUserDoc;
  if (decoded.email) {
    const byEmail = await adminDb.collection("platformUsers").where("email", "==", decoded.email.toLowerCase()).limit(1).get();
    if (!byEmail.empty) return byEmail.docs[0].data() as PlatformUserDoc;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!firebaseAdminReady || !adminAuth || !adminDb) {
      return NextResponse.json({ ok:false, error:"Faltan variables FIREBASE_ADMIN_* en Vercel." }, { status:503 });
    }

    const setupToken = process.env.AUTH_SETUP_TOKEN;
    const providedSetupToken = req.headers.get("x-setup-token") || "";
    const authorization = req.headers.get("authorization") || "";
    const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

    let allowed = Boolean(setupToken && providedSetupToken && providedSetupToken === setupToken);
    if (!allowed && bearerToken) {
      const actor = await getActorFromToken(bearerToken);
      allowed = canConfigureUsers(actor);
    }
    if (!allowed) return NextResponse.json({ ok:false, error:"No tienes permiso para sincronizar accesos." }, { status:403 });

    const snap = await adminDb.collection("platformUsers").get();
    const results: any[] = [];

    for (const documentSnap of snap.docs) {
      const profile = documentSnap.data() as PlatformUserDoc;
      let uid = profile.authUid || "";

      if (!uid && profile.email) {
        try {
          const userRecord = await adminAuth.getUserByEmail(profile.email.trim().toLowerCase());
          uid = userRecord.uid;
          await documentSnap.ref.set({ authUid: uid, updatedAt: new Date().toISOString() }, { merge:true });
        } catch (error:any) {
          results.push({ id: documentSnap.id, email: profile.email || "", ok:false, error: error?.message || "Sin Auth UID" });
          continue;
        }
      }

      if (!uid) {
        results.push({ id: documentSnap.id, email: profile.email || "", ok:false, error:"Usuario sin authUid ni email." });
        continue;
      }

      await adminDb.collection("userAccess").doc(uid).set(buildUserAccess(uid, documentSnap.id, { ...profile, authUid: uid }), { merge:true });
      results.push({ id: documentSnap.id, uid, email: profile.email || "", ok:true });
    }

    return NextResponse.json({ ok:true, count:results.length, synced:results.filter(item=>item.ok).length, results });
  } catch (error:any) {
    console.error("sync-firebase-access", error);
    return NextResponse.json({ ok:false, error:error?.message || "No se pudo sincronizar userAccess." }, { status:500 });
  }
}
