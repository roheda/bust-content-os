import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage, firebaseAdminReady } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const backupCollectionNames = [
  "clients",
  "clientAssets",
  "requestBatches",
  "contentRequests",
  "plannerDrafts",
  "productions",
  "operationalContentRules",
  "clientOperationalOverrides",
  "teamDailyCapacities",
  "generationRequests",
  "generatedImages",
  "bustItNowJobs",
  "systemFeedback",
  "platformUsers",
  "userAccess",
  "systemSettings"
];

type BackupSettings = {
  enabled?: boolean;
  frequency?: "daily" | "weekly";
  backupHour?: number;
  timezone?: string;
  retainBackups?: number;
  includeDeleted?: boolean;
  lastAutoBackupAt?: string;
};

const defaultSettings: Required<Omit<BackupSettings, "lastAutoBackupAt">> = {
  enabled: true,
  frequency: "daily",
  backupHour: 23,
  timezone: "America/Merida",
  retainBackups: 14,
  includeDeleted: true
};

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function getLocalParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateKey: `${byType.year}-${byType.month}-${byType.day}`,
    hour: Number(byType.hour || 0)
  };
}

function daysSince(value?: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return (Date.now() - time) / (24 * 60 * 60 * 1000);
}

function shouldRun(settings: BackupSettings) {
  if (!settings.enabled) return { ok: false, reason: "Respaldos automáticos desactivados." };
  const timezone = settings.timezone || defaultSettings.timezone;
  const targetHour = Math.min(23, Math.max(0, Number(settings.backupHour ?? defaultSettings.backupHour)));
  const now = new Date();
  const local = getLocalParts(now, timezone);
  if (local.hour !== targetHour) return { ok: false, reason: `Aún no corresponde la hora configurada (${targetHour}:00 ${timezone}).` };

  const last = settings.lastAutoBackupAt;
  const lastLocal = last ? getLocalParts(new Date(last), timezone) : null;
  if (lastLocal?.dateKey === local.dateKey) return { ok: false, reason: "Ya existe respaldo automático de hoy." };
  if ((settings.frequency || defaultSettings.frequency) === "weekly" && daysSince(last) < 6.5) {
    return { ok: false, reason: "La frecuencia semanal aún no vence." };
  }
  return { ok: true, reason: "Respaldando." };
}

function authorize(req: NextRequest) {
  const secret = process.env.BACKUP_CRON_SECRET || process.env.CRON_SECRET || process.env.AUTH_SETUP_TOKEN || "";
  const authorization = req.headers.get("authorization") || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const headerSecret = req.headers.get("x-backup-secret") || req.nextUrl.searchParams.get("secret") || "";
  return Boolean(secret && (bearer === secret || headerSecret === secret));
}

async function loadSettings() {
  if (!adminDb) return defaultSettings;
  const snap = await adminDb.collection("systemSettings").doc("backupAutomation").get();
  if (!snap.exists) return defaultSettings;
  return { ...defaultSettings, ...(snap.data() as BackupSettings) };
}

async function collectBackupPayload(includeDeleted: boolean) {
  if (!adminDb) throw new Error("Admin DB no disponible.");
  const collections: Record<string, { id: string; data: any }[]> = {};
  const counts: Record<string, number> = {};
  let totalDocuments = 0;

  for (const collectionName of backupCollectionNames) {
    const snap = await adminDb.collection(collectionName).get();
    let docs = snap.docs.map((item) => ({ id: item.id, data: jsonSafe(item.data()) }));
    if (!includeDeleted && ["contentRequests", "requestBatches"].includes(collectionName)) {
      docs = docs.filter((item) => !["eliminada", "deleted", "archived"].includes(String(item.data?.status || "")));
    }
    collections[collectionName] = docs;
    counts[collectionName] = docs.length;
    totalDocuments += docs.length;
  }

  return {
    backupVersion: "v8.4",
    generatedAt: new Date().toISOString(),
    app: "BUST Content OS",
    automatic: true,
    collections,
    counts,
    totalDocuments
  };
}

async function purgeOldBackups(retainBackups: number) {
  if (!adminDb || !adminStorage) return 0;
  const keep = Math.max(1, Number(retainBackups || defaultSettings.retainBackups));
  const snap = await adminDb.collection("systemBackups").orderBy("createdAt", "desc").get();
  const old = snap.docs.slice(keep);
  const bucket = adminStorage.bucket();
  for (const item of old) {
    const data = item.data();
    if (data.storagePath) {
      try { await bucket.file(data.storagePath).delete({ ignoreNotFound: true }); } catch (error) { console.warn("No se pudo borrar respaldo viejo", error); }
    }
    await item.ref.delete();
  }
  return old.length;
}

async function createBackup(settings: BackupSettings) {
  if (!adminDb || !adminStorage) throw new Error("Firebase Admin no está disponible.");
  const payload = await collectBackupPayload(settings.includeDeleted !== false);
  const json = JSON.stringify(payload, null, 2);
  const slug = new Date().toISOString().replace(/[:.]/g, "-");
  const storagePath = `system-backups/${slug}-automatic.json`;
  const bucket = adminStorage.bucket();
  const file = bucket.file(storagePath);
  await file.save(json, {
    resumable: false,
    contentType: "application/json",
    metadata: { cacheControl: "private, max-age=0" }
  });

  const [signedUrl] = await file.getSignedUrl({ action: "read", expires: "01-01-2100" });
  const meta = {
    type: "automatic",
    status: "completed",
    createdAt: payload.generatedAt,
    createdAtTimestamp: new Date(),
    createdBy: "Sistema automático",
    fileUrl: signedUrl,
    storagePath,
    sizeBytes: Buffer.byteLength(json, "utf8"),
    collections: payload.counts,
    totalDocuments: payload.totalDocuments,
    backupVersion: payload.backupVersion,
    notes: `Frecuencia ${settings.frequency || defaultSettings.frequency}`,
    updatedAt: new Date()
  };
  const ref = await adminDb.collection("systemBackups").add(meta);
  await adminDb.collection("systemSettings").doc("backupAutomation").set({
    ...settings,
    lastAutoBackupAt: payload.generatedAt,
    lastAutoBackupStatus: "completed",
    updatedAt: new Date()
  }, { merge: true });
  const purged = await purgeOldBackups(settings.retainBackups || defaultSettings.retainBackups);
  return { id: ref.id, ...meta, purged };
}

export async function GET(req: NextRequest) {
  try {
    if (!firebaseAdminReady || !adminDb || !adminStorage) {
      return NextResponse.json({ ok: false, error: "Faltan variables FIREBASE_ADMIN_* / Storage en Vercel." }, { status: 503 });
    }
    if (!authorize(req)) {
      return NextResponse.json({ ok: false, error: "No autorizado. Configura BACKUP_CRON_SECRET o CRON_SECRET." }, { status: 403 });
    }

    const settings = await loadSettings();
    const due = shouldRun(settings);
    if (!due.ok) return NextResponse.json({ ok: true, skipped: true, reason: due.reason });
    const backup = await createBackup(settings);
    return NextResponse.json({ ok: true, backup });
  } catch (error: any) {
    console.error("run-auto-backup", error);
    try {
      await adminDb?.collection("systemSettings").doc("backupAutomation").set({ lastAutoBackupStatus: error?.message || "failed", updatedAt: new Date() }, { merge: true });
    } catch {}
    return NextResponse.json({ ok: false, error: error?.message || "No se pudo generar respaldo automático." }, { status: 500 });
  }
}
