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
export const requestStates = ["draft", "validacion_content_sr", "requiere_cambios", "aprobada_content_sr", "edicion", "revision_kam", "programado", "publicado"];
export const draftStates = ["draft", "ready_to_publish", "published_to_requests"];

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
  keyMessage: string;
  cta: string;
  publishDate: string;
  status: string;
  source: string;
  batchId?: string;
  batchName?: string;
};

export type PlannerDraft = {
  id?: string;
  name: string;
  clientId: string;
  clientName: string;
  status: string;
  items: ContentRequest[];
};

export type RequestBatch = {
  id?: string;
  name: string;
  clientId: string;
  clientName: string;
  totalRequests: number;
  status: string;
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
  shotList: string;
  requirements: string;
  notes: string;
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
  keyMessage: "",
  cta: "",
  publishDate: "",
  status: "draft",
  source: "manual"
};

export function isImageFile(file: ReferenceFile) {
  const type = file.type || "";
  const name = (file.name || "").toLowerCase();
  return type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|avif|heic|heif)$/i.test(name);
}

export function getRequestDate(item: Partial<ContentRequest>) {
  return item.publishDate || "";
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

  await Promise.all(items.map((item, index) => saveRequest({
    ...item,
    number: index + 1,
    total: items.length,
    batchId,
    batchName: batch.name,
    status: "draft"
  })));

  return batchId;
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

export async function deleteRequest(id: string) {
  return deleteDoc(doc(db, "contentRequests", id));
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
