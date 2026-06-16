import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./firebase";

export const contentTypes = ["Reel", "Carrusel", "Post", "Story", "TikTok", "Foto", "Diseño", "Blog"];
export const objectives = ["Ventas", "Reservas", "Awareness", "Confianza", "Educativo", "Engagement", "Tráfico", "Comunidad"];

export const requestStates = [
  "lista_asignacion",
  "pendiente_produccion",
  "produccion_programada",
  "material_listo",
  "asignada",
  "en_ejecucion",
  "en_revision",
  "lista_programar",
  "programada",
  "publicada",
  "bloqueada",
  "cancelada"
];

export const areas = ["Diseño", "Audiovisual", "Copy", "Mixto"];
export const priorities = ["Baja", "Media", "Alta", "Urgente"];

export type FeedbackItem = {
  id?: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  author: string;
  module: string;
};

export type TaskComment = {
  id: string;
  author: string;
  target: string;
  body: string;
  createdAt: string;
  mentions: string[];
};

export type ReferenceFile = {
  name: string;
  url: string;
  type: string;
};

export type Brand = {
  id?: string;
  name: string;
  industry: string;
  tone: string;
  audience: string;
  platforms: string[];
  posts: number;
  reels: number;
  productions: number;
  month?: string;
  brandNotes?: string;
  status?: string;
  accountOwner?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  instagram?: string;
  location?: string;
  packageName?: string;
  services?: string[];
  brandPersonality?: string;
  visualStyle?: string;
  contentPillars?: string;
  sharedSystems?: string[];
  bustItNowStatus?: string;
};

export type ContentRequest = {
  id?: string;
  clientId: string;
  clientName: string;
  number: number;
  total: number;
  contentType: string;
  objective: string;
  topic: string;
  creativeIdea: string;
  referenceLinks: string;
  referenceFiles: ReferenceFile[];
  copyIn: string;
  copyOut?: string;
  keyMessage: string;
  cta: string;
  publishDate: string;
  status: string;
  source: string;
  batchId?: string;
  batchName?: string;
  batchDueDate?: string;

  requiresProduction: boolean;
  materialAvailable: boolean;
  materialLinks: string;
  materialFiles: ReferenceFile[];
  productionNotes: string;
  suggestedArea: string;

  assignedArea?: string;
  assignedTo?: string;
  priority?: string;
  dueDate?: string;
  internalNotes?: string;
  finalPostLink?: string;
  approvalStatus?: string;
  approvalRejectionReason?: string;
  approvalNotes?: string;
  generatorStatus?: string;
  generatorSentAt?: string;
  generatorNotes?: string;
  deletedAt?: string;
  deletedReason?: string;
  rejectionNote?: string;
  rejectedAt?: string;
  comments?: TaskComment[];
  productionId?: string;
  productionName?: string;
};

export type PlannerDraft = {
  id?: string;
  name: string;
  clientId: string;
  clientName: string;
  status: string;
  batchDueDate: string;
  items: ContentRequest[];
};

export type RequestBatch = {
  id?: string;
  name: string;
  clientId: string;
  clientName: string;
  totalRequests: number;
  status: string;
  batchDueDate: string;
};

export type Production = {
  id?: string;
  title: string;
  clientId: string;
  clientName: string;
  requestIds: string[];
  objective: string;
  location: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  producer: string;
  team: string;
  shotList: string;
  requirements: string;
  notes: string;
  materialLinks?: string;
  materialLinksByRequest?: Record<string, string>;
  materialFiles?: ReferenceFile[];
  status: string;
};

export const emptyRequest: ContentRequest = {
  clientId: "",
  clientName: "",
  number: 1,
  total: 1,
  contentType: "Reel",
  objective: "Ventas",
  topic: "",
  creativeIdea: "",
  referenceLinks: "",
  referenceFiles: [],
  copyIn: "",
  copyOut: "",
  keyMessage: "",
  cta: "",
  publishDate: "",
  status: "lista_asignacion",
  source: "manual",
  batchDueDate: "",
  requiresProduction: false,
  materialAvailable: false,
  materialLinks: "",
  materialFiles: [],
  productionNotes: "",
  suggestedArea: "Diseño",
  assignedArea: "",
  assignedTo: "",
  priority: "Media",
  dueDate: "",
  internalNotes: "",
  finalPostLink: "",
  approvalStatus: "",
  approvalRejectionReason: "",
  approvalNotes: "",
  generatorStatus: "",
  generatorSentAt: "",
  generatorNotes: "",
  deletedAt: "",
  deletedReason: "",
  comments: [],
};

export function isImageFile(file: ReferenceFile) {
  const type = file.type || "";
  const name = (file.name || "").toLowerCase();
  return type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|avif|heic|heif)$/i.test(name);
}

export function getRequestDate(item: Partial<ContentRequest>) {
  return item.publishDate || "";
}

export function hasMaterial(item: Partial<ContentRequest>) {
  const files = item.materialFiles?.length || 0;
  const links = (item.materialLinks || "").trim().length;
  return Boolean(item.materialAvailable && (files > 0 || links > 0));
}

export function getOperationalStatus(item: ContentRequest) {
  if (item.status === "rebotada") return "rebotada";
  if (item.status === "asignada") return "asignada";
  if (item.status === "material_listo") return "lista_asignacion";
  if (item.requiresProduction && hasMaterial(item)) return "lista_asignacion";
  if (item.requiresProduction) return item.productionId ? "produccion_programada" : "pendiente_produccion";
  if (!hasMaterial(item)) return "bloqueada";
  return item.status || "lista_asignacion";
}

export function validateCreatorItem(item: ContentRequest) {
  if (!item.clientId || !item.clientName) return "Falta cliente.";
  if (!item.contentType) return "Falta tipo de contenido.";
  if (!item.objective) return "Falta objetivo.";
  if (!item.creativeIdea.trim()) return "Falta idea creativa.";
  if (!item.copyIn.trim()) return "Falta Copy In.";
  if (!item.publishDate) return "Falta fecha de publicación.";

  if (!item.requiresProduction && !hasMaterial(item)) {
    return "Si no requiere producción, debes marcar material disponible y subir archivo o agregar link de material.";
  }

  return "";
}

export async function uploadReferenceFiles(files: FileList | File[], folder = "content-request-references") {
  const list = Array.from(files);
  const uploaded: ReferenceFile[] = [];

  for (const file of list) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${folder}/${Date.now()}-${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    uploaded.push({ name: file.name, url, type: file.type || "" });
  }

  return uploaded;
}

export async function saveBrand(data: Brand) {
  return addDoc(collection(db, "clients"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateBrand(id: string, data: Partial<Brand>) {
  return updateDoc(doc(db, "clients", id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteBrand(id: string) {
  return deleteDoc(doc(db, "clients", id));
}

export async function listBrands() {
  const q = query(collection(db, "clients"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Brand));
}

export async function savePlannerDraft(draft: PlannerDraft) {
  return addDoc(collection(db, "plannerDrafts"), {
    ...draft,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updatePlannerDraft(id: string, data: Partial<PlannerDraft>) {
  return updateDoc(doc(db, "plannerDrafts", id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function listPlannerDrafts() {
  const q = query(collection(db, "plannerDrafts"), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlannerDraft));
}

export async function deletePlannerDraft(id: string) {
  return deleteDoc(doc(db, "plannerDrafts", id));
}

export async function saveRequest(item: ContentRequest) {
  return addDoc(collection(db, "contentRequests"), {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function saveRequestBatch(batch: RequestBatch, items: ContentRequest[]) {
  const batchRef = await addDoc(collection(db, "requestBatches"), {
    ...batch,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  const batchId = batchRef.id;

  await Promise.all(items.map((item, index) => {
    const status = item.requiresProduction ? "pendiente_produccion" : "lista_asignacion";
    return saveRequest({
      ...item,
      number: index + 1,
      total: items.length,
      batchId,
      batchName: batch.name,
      batchDueDate: batch.batchDueDate,
      dueDate: item.dueDate || batch.batchDueDate,
      status
    });
  }));

  return batchId;
}


export async function listRequestBatches() {
  const q = query(collection(db, "requestBatches"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RequestBatch));
}

export async function listRequests() {
  const q = query(collection(db, "contentRequests"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContentRequest));
}

export async function updateRequest(id: string, data: Partial<ContentRequest>) {
  return updateDoc(doc(db, "contentRequests", id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteRequest(id: string, reason = "Eliminada desde sistema") {
  return updateDoc(doc(db, "contentRequests", id), {
    status: "eliminada",
    deletedAt: new Date().toISOString(),
    deletedReason: reason,
    updatedAt: serverTimestamp()
  });
}

export async function saveProduction(item: Production) {
  return addDoc(collection(db, "productions"), {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function listProductions() {
  const q = query(collection(db, "productions"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Production));
}

export async function updateProduction(id: string, data: Partial<Production>) {
  return updateDoc(doc(db, "productions", id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}


export async function saveFeedback(item: FeedbackItem) {
  return addDoc(collection(db, "systemFeedback"), {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function listFeedback() {
  const q = query(collection(db, "systemFeedback"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedbackItem));
}

export async function updateFeedback(id: string, data: Partial<FeedbackItem>) {
  return updateDoc(doc(db, "systemFeedback", id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}
