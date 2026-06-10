import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
export const states=["draft","validacion_content_sr","requiere_cambios","produccion","edicion","revision_kam","programado","publicado"];
export type Brand={id?:string;name:string;industry:string;tone:string;audience:string;platforms:string[];posts:number;reels:number;productions:number;month?:string};
export type Piece={id?:string;brandId:string;brandName:string;number:number;total:number;format:string;topic:string;goal:string;production:boolean;date:string;state:string;assignee?:string;notes?:string};
export async function saveBrand(data:Brand){return addDoc(collection(db,"clients"),{...data,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})}
export async function updateBrand(id:string,data:Partial<Brand>){return updateDoc(doc(db,"clients",id),{...data,updatedAt:serverTimestamp()})}
export async function deleteBrand(id:string){return deleteDoc(doc(db,"clients",id))}
export async function listBrands(){const q=query(collection(db,"clients"),orderBy("createdAt","desc"));const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()} as Brand))}
export async function savePieces(items:Piece[]){await Promise.all(items.map(x=>addDoc(collection(db,"contentRequests"),{...x,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})))}
export async function listPieces(){const q=query(collection(db,"contentRequests"),orderBy("createdAt","desc"));const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()} as Piece))}
export async function updatePiece(id:string,data:Partial<Piece>){return updateDoc(doc(db,"contentRequests",id),{...data,updatedAt:serverTimestamp()})}
export async function deletePiece(id:string){return deleteDoc(doc(db,"contentRequests",id))}
