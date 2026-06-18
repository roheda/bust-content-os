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
};

function canConfigureUsers(user?: PlatformUserDoc | null) {
  return Boolean(
    user &&
    user.status !== "inactive" &&
    (user.isMaster || user.roleKey === "master" || user.permissions?.usuarios?.configure)
  );
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
      return NextResponse.json({
        ok: false,
        error: "Faltan variables FIREBASE_ADMIN_* en Vercel para crear usuarios de Firebase Auth."
      }, { status: 503 });
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

    if (!allowed) {
      return NextResponse.json({ ok: false, error: "No tienes permiso para crear accesos de Firebase Auth." }, { status: 403 });
    }

    const body = await req.json();
    const platformUserId = String(body.platformUserId || "");
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();

    if (!platformUserId || !email) {
      return NextResponse.json({ ok: false, error: "Falta platformUserId o email." }, { status: 400 });
    }

    let authUser;
    let created = false;
    try {
      authUser = await adminAuth.getUserByEmail(email);
    } catch (error: any) {
      if (error?.code !== "auth/user-not-found") throw error;
      authUser = await adminAuth.createUser({
        email,
        displayName: name || email,
        emailVerified: false,
        disabled: false
      });
      created = true;
    }

    if (name && authUser.displayName !== name) {
      authUser = await adminAuth.updateUser(authUser.uid, { displayName: name, disabled: false });
    }

    await adminDb.collection("platformUsers").doc(platformUserId).set({
      authUid: authUser.uid,
      email,
      inviteStatus: created ? "auth_created" : "auth_created",
      authCreatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ ok: true, uid: authUser.uid, created });
  } catch (error: any) {
    console.error("create-auth-user", error);
    return NextResponse.json({ ok: false, error: error?.message || "No se pudo crear el acceso." }, { status: 500 });
  }
}
