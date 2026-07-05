import { NextResponse } from "next/server";
import { adminAuth, adminDb, firebaseAdminReady } from "./firebase-admin";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "assign" | "billing" | "generate" | "configure";

type AccessDoc = {
  status?: string;
  roleKey?: string;
  isMaster?: boolean;
  permissions?: Record<string, Partial<Record<PermissionAction, boolean>>>;
};

const authEnforced = process.env.NEXT_PUBLIC_AUTH_ENFORCED !== "false";
const demoApiAllowed = !authEnforced && process.env.NODE_ENV !== "production";

export async function requireApiPermission(req: Request, moduleKey: string, action: PermissionAction = "view") {
  // En desarrollo local se puede probar sin sesión. En producción nunca se omite la validación.
  if (demoApiAllowed) return { ok: true as const, uid: "dev" };

  if (!firebaseAdminReady || !adminAuth || !adminDb) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Firebase Admin no está configurado en el servidor." }, { status: 503 })
    };
  }

  const authorization = req.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Sesión requerida." }, { status: 401 })
    };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const accessSnap = await adminDb.collection("userAccess").doc(decoded.uid).get();
    const access = accessSnap.exists ? (accessSnap.data() as AccessDoc) : null;

    if (!access || access.status === "inactive") {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Usuario sin acceso activo." }, { status: 403 })
      };
    }

    const allowed = Boolean(
      access.isMaster ||
      access.roleKey === "master" ||
      access.permissions?.[moduleKey]?.[action]
    );

    if (!allowed) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "No tienes permiso para esta acción." }, { status: 403 })
      };
    }

    return { ok: true as const, uid: decoded.uid, access };
  } catch (error:any) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: error?.message || "Token inválido." }, { status: 401 })
    };
  }
}
