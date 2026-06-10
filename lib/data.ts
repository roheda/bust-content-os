import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export const states = ["draft","validacion_content_sr","requiere_cambios","produccion","edicion","revision_kam","programado","publicado"];
export const formats = ["Reel","Carrusel","Post","Story","TikTok","Foto","Diseño"];
export const goals = ["Ventas","Reservas","Awareness","Confianza","Educativo","Engagement","Tráfico"];

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
};

export type Piece = {
  id?: string;
  brandId: string;
  brandName: string;
  number: number;
  total: number;
  format: string;
  topic: string;
  goal: string;
  production: boolean;
  date: string;
  state: string;
  assignee?: string;
  keyMessage?: string;
  cta?: string;
  notes?: string;
  source?: string;
};

export const emptyPiece: Piece = {
  brandId: "",
  brandName: "",
  number: 1,
  total: 1,
  format: "Reel",
  topic: "",
  goal: "Ventas",
  production: false,
  date: "",
  state: "draft",
  assignee: "",
  keyMessage: "",
  cta: "",
  notes: "",
  source: "manual",
};

export async function saveBrand(data: Brand) {
  return addDoc(collection(db, "clients"), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updateBrand(id: string, data: Partial<Brand>) {
  return updateDoc(doc(db, "clients", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteBrand(id: string) {
  return deleteDoc(doc(db, "clients", id));
}

export async function listBrands() {
  const q = query(collection(db, "clients"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Brand));
}

export async function savePiece(item: Piece) {
  return addDoc(collection(db, "contentRequests"), { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function savePieces(items: Piece[]) {
  const writes = items.map((x) => addDoc(collection(db, "contentRequests"), { ...x, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await Promise.all(writes);
}

export async function listPieces() {
  const q = query(collection(db, "contentRequests"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Piece));
}

export async function updatePiece(id: string, data: Partial<Piece>) {
  return updateDoc(doc(db, "contentRequests", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deletePiece(id: string) {
  return deleteDoc(doc(db, "contentRequests", id));
}
