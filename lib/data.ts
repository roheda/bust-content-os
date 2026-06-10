import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

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
};

export async function saveBrand(data: Brand) {
  return addDoc(collection(db, "clients"), { ...data, createdAt: serverTimestamp() });
}

export async function listBrands() {
  const q = query(collection(db, "clients"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Brand));
}

export async function savePieces(items: Piece[]) {
  const writes = items.map((x) => addDoc(collection(db, "contentRequests"), { ...x, createdAt: serverTimestamp() }));
  await Promise.all(writes);
}

export async function listPieces() {
  const q = query(collection(db, "contentRequests"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Piece));
}
