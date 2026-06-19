import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
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

export const areas = ["Diseño", "Audiovisual"];
export const priorities = ["Baja", "Media", "Alta", "Urgente"];

export const organizationTeam = [
  { name: "Fernanda Gutierrez", area: "KAM", role: "Jefa de Key Accounts" },
  { name: "Gabriela Tapia", area: "KAM", role: "KAM con cuentas asignadas" },
  { name: "Mauricio Manzanilla", area: "Audiovisual", role: "Fotógrafo y editor de foto" },
  { name: "Pablo Soberanis", area: "KAM", role: "KAM con cuentas asignadas" },
  { name: "Paolette Pavon", area: "KAM", role: "KAM con cuentas asignadas" },
  { name: "Rodrigo Hernandez", area: "Copy", role: "Copy y creador de solicitudes" },
  { name: "Carlos Juarez", area: "Diseño", role: "Jefe de diseño" },
  { name: "Monica Lopez", area: "Content", role: "Programa posts y crea solicitudes" },
  { name: "Roberto Pech", area: "Content", role: "Jefe de content y departamentos creativos" },
  { name: "Antonio Pool", area: "Audiovisual", role: "Productor audiovisual y editor" },
  { name: "Icela Zapata", area: "Diseño", role: "Diseñadora" },
  { name: "Rodrigo Maldonado", area: "KAM", role: "KAM con cuentas asignadas" },
  { name: "Abril Ordoñez", area: "Audiovisual", role: "Editor audiovisual" },
  { name: "Jorge David", area: "Diseño", role: "Diseñadora" },
  { name: "Belinda Irene Lopez Benavides", area: "Audiovisual", role: "Editor audiovisual" }
];



export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "assign" | "billing" | "generate" | "configure";

export type PermissionMatrix = Record<string, Partial<Record<PermissionAction, boolean>>>;

export type PlatformModule = {
  key: string;
  label: string;
  route: string;
  description: string;
  sensitive?: boolean;
};

export type PlatformUser = {
  id?: string;
  name: string;
  email: string;
  roleKey: string;
  roleLabel: string;
  status: "active" | "inactive";
  isMaster?: boolean;
  department?: string;
  jobTitle?: string;
  phone?: string;
  scope: "all_clients" | "assigned_clients";
  clientIds: string[];
  permissions: PermissionMatrix;
  canBypassClientLimits?: boolean;
  canManageBilling?: boolean;
  authUid?: string;
  inviteStatus?: "pending_auth" | "auth_created" | "reset_sent" | "active" | "disabled";
  authCreatedAt?: unknown;
  passwordResetSentAt?: unknown;
  lastLoginAt?: unknown;
  mustChangePassword?: boolean;
  notes?: string;
};

export const permissionActions: { key: PermissionAction; label: string; description: string }[] = [
  { key: "view", label: "Ver", description: "Puede entrar al módulo y consultar información." },
  { key: "create", label: "Crear", description: "Puede crear registros o solicitudes." },
  { key: "edit", label: "Editar", description: "Puede modificar registros existentes." },
  { key: "delete", label: "Eliminar", description: "Puede eliminar o archivar registros." },
  { key: "approve", label: "Aprobar", description: "Puede aprobar piezas, entregables o movimientos." },
  { key: "assign", label: "Asignar", description: "Puede asignar tareas, responsables o carga de trabajo." },
  { key: "billing", label: "Facturación", description: "Puede ver costos, balances y datos para facturación." },
  { key: "generate", label: "Generar IA", description: "Puede generar en BUST It Now." },
  { key: "configure", label: "Configurar", description: "Puede cambiar reglas, permisos o parámetros del sistema." }
];

export const platformModules: PlatformModule[] = [
  { key: "dashboard", label: "Dashboard", route: "/dashboard", description: "Resumen general de la operación." },
  { key: "clientes", label: "Clientes", route: "/dashboard/clientes", description: "Alta, edición, Brand Brain, assets y configuración de clientes." },
  { key: "creador", label: "Creador de Solicitudes", route: "/dashboard/creador-solicitudes", description: "Crear lotes de contenidos y validar tiempos/materiales." },
  { key: "asignacion", label: "Asignación", route: "/dashboard/asignacion", description: "Distribuir piezas por persona, área y prioridad." },
  { key: "producciones", label: "Producciones", route: "/dashboard/producciones", description: "Programar y administrar producciones." },
  { key: "tareas", label: "Tareas", route: "/dashboard/tareas", description: "Operación diaria y avance de entregables." },
  { key: "generador", label: "BUST It Now", route: "/dashboard/generador", description: "Generación de imágenes, briefs y consumo IA." },
  { key: "aprobaciones", label: "Aprobaciones", route: "/dashboard/aprobaciones", description: "Revisión, aprobación y rechazos." },
  { key: "reportes", label: "Reportes", route: "/dashboard/reportes", description: "Reportes operativos, costos y balance de facturación.", sensitive: true },
  { key: "configuracion", label: "Configuración", route: "/dashboard/configuracion", description: "Costos, tiempos y reglas operativas.", sensitive: true },
  { key: "usuarios", label: "Usuarios", route: "/dashboard/usuarios", description: "Usuarios, permisos, clientes visibles y roles.", sensitive: true }
];

export const roleTemplates = [
  { key: "master", label: "Master", description: "Control total del sistema, usuarios, facturación, configuración y generación." },
  { key: "admin", label: "Administrador", description: "Opera todo el sistema excepto eliminar usuarios master." },
  { key: "direccion", label: "Dirección", description: "Visión completa, reportes, facturación y aprobaciones." },
  { key: "kam", label: "KAM / Cuenta", description: "Clientes asignados, solicitudes, aprobaciones y seguimiento." },
  { key: "estrategia", label: "Estrategia", description: "Planeación, briefs, solicitudes y revisión de contenido." },
  { key: "creativo", label: "Creativo / Copy", description: "Crea y edita solicitudes, copies y briefs." },
  { key: "diseno", label: "Diseño", description: "Ve y actualiza tareas de diseño y BUST It Now." },
  { key: "audiovisual", label: "Audiovisual", description: "Ve producciones, tareas y entregables audiovisuales." },
  { key: "cliente", label: "Cliente", description: "Acceso limitado a revisión/aprobación de su marca." }
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

export function getRoleTemplatePermissions(roleKey: string): PermissionMatrix {
  const everyModule = platformModules.map((m) => m.key);
  if (roleKey === "master") return matrixFor(everyModule, fullActions);
  if (roleKey === "admin") return mergeMatrices(
    matrixFor(everyModule, ["view","create","edit","approve","assign","generate"]),
    matrixFor(["reportes"], ["billing"]),
    matrixFor(["configuracion"], ["configure"]),
    matrixFor(["usuarios"], ["configure"])
  );
  if (roleKey === "direccion") return mergeMatrices(
    matrixFor(["dashboard","clientes","creador","asignacion","producciones","tareas","generador","aprobaciones","reportes"], ["view"]),
    matrixFor(["aprobaciones"], ["approve"]),
    matrixFor(["reportes"], ["billing"]),
    matrixFor(["generador"], ["generate"])
  );
  if (roleKey === "kam") return mergeMatrices(
    matrixFor(["dashboard","clientes","creador","asignacion","producciones","tareas","generador","aprobaciones"], ["view"]),
    matrixFor(["creador","generador"], ["create","edit","generate"]),
    matrixFor(["aprobaciones"], ["approve"])
  );
  if (roleKey === "estrategia") return mergeMatrices(
    matrixFor(["dashboard","clientes","creador","tareas","generador","aprobaciones"], ["view"]),
    matrixFor(["creador","generador"], ["create","edit","generate"])
  );
  if (roleKey === "creativo") return mergeMatrices(
    matrixFor(["dashboard","creador","tareas","generador"], ["view"]),
    matrixFor(["creador","tareas","generador"], ["edit","generate"])
  );
  if (roleKey === "diseno") return mergeMatrices(
    matrixFor(["dashboard","tareas","generador","aprobaciones"], ["view"]),
    matrixFor(["tareas","generador"], ["edit","generate"])
  );
  if (roleKey === "audiovisual") return mergeMatrices(
    matrixFor(["dashboard","producciones","tareas","aprobaciones"], ["view"]),
    matrixFor(["producciones","tareas"], ["edit"])
  );
  if (roleKey === "cliente") return mergeMatrices(
    matrixFor(["dashboard","aprobaciones"], ["view"]),
    matrixFor(["aprobaciones"], ["approve"])
  );
  return matrixFor(["dashboard"], ["view"]);
}

export function canUser(user: Partial<PlatformUser> | null | undefined, moduleKey: string, action: PermissionAction = "view") {
  if (!user) return true;
  if (user.isMaster || user.roleKey === "master") return true;
  return Boolean(user.permissions?.[moduleKey]?.[action]);
}

export function canAccessClient(user: Partial<PlatformUser> | null | undefined, clientId?: string) {
  if (!user || user.isMaster || user.scope !== "assigned_clients") return true;
  if (!clientId) return false;
  return (user.clientIds || []).includes(clientId);
}

export const emptyPlatformUser: PlatformUser = {
  name: "",
  email: "",
  roleKey: "kam",
  roleLabel: "KAM / Cuenta",
  status: "active",
  isMaster: false,
  department: "Operación",
  jobTitle: "",
  phone: "",
  scope: "assigned_clients",
  clientIds: [],
  permissions: getRoleTemplatePermissions("kam"),
  canBypassClientLimits: false,
  canManageBilling: false,
  authUid: "",
  inviteStatus: "pending_auth",
  notes: ""
};

export type BustItNowJob = {
  id?: string;
  clientId: string;
  clientName: string;
  contentRequestId?: string;
  batchId?: string;
  batchName?: string;
  source: string;
  title: string;
  format: string;
  objective: string;
  prompt: string;
  copyIn?: string;
  copyOut?: string;
  referenceLinks?: string;
  finalLink?: string;
  generatedPrompt?: string;
  executedModel?: string;
  generationMode?: string;
  status: string;
  assignedTo?: string;
  notes?: string;
};

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
  status?: "open" | "resolved";
  resolvedAt?: string;
  resolvedBy?: string;
};

export type ReferenceFile = {
  name: string;
  url: string;
  type: string;
};

export type BrandBrain = {
  brandDescription?: string;
  tone?: string;
  colors?: string[];
  typography?: string;
  visualStyle?: string[];
  dos?: string[];
  donts?: string[];
  recommendedModels?: string[];
};

export type ClientAsset = {
  id?: string;
  clientId: string;
  clientName?: string;
  name: string;
  type: string;
  category: string;
  tags: string[];
  notes: string;
  fileUrl: string;
  storagePath: string;
  mimeType: string;
  isFeatured: boolean;
};

export type GenerationRequest = {
  id?: string;
  clientId: string;
  clientName: string;
  clientIndustry?: string;
  mainMessage: string;
  format: string;
  goal: string;
  contentType: string;
  selectedEmotions: string[];
  selectedVisualElements: string[];
  specificInstructions: string;
  textBlocks: any[];
  selectedAssetIds: string[];
  selectedAssetsSnapshot: ClientAsset[];
  brandBrainSnapshot?: BrandBrain;
  requestAttachments?: any[];
  logoOverlay?: any;
  generatedPrompt?: string;
  executedModel?: string;
  generationMode?: string;
  status: string;
};

export type ClientBillingConfig = {
  monthlyRetainer?: number;
  includedFinalizedContents?: number;
  includedProductions?: number;
  includedProductionBudget?: number;
  includedAiGenerations?: number;
  onDemandEnabled?: boolean;
  extraContentRate?: number;
  extraProductionRate?: number;
  extraAiGenerationRate?: number;
  billingNotes?: string;
};

export type ClientBillingBalance = {
  clientId: string;
  clientName: string;
  month: string;
  monthlyRetainer: number;
  finalizedContents: number;
  includedFinalizedContents: number;
  billableExtraContents: number;
  extraContentRate: number;
  extraContentCharge: number;
  productions: number;
  includedProductions: number;
  billableExtraProductions: number;
  extraProductionRate: number;
  extraProductionCharge: number;
  productionCostConsumed: number;
  includedProductionBudget: number;
  billableProductionBudgetOverage: number;
  aiGenerations: number;
  includedAiGenerations: number;
  billableExtraAiGenerations: number;
  extraAiGenerationRate: number;
  extraAiCharge: number;
  onDemandEnabled: boolean;
  estimatedInvoiceTotal: number;
  consumedValue: number;
};

export type ClientBuyerPersona = {
  id?: string;
  name: string;
  description: string;
  pains?: string;
  desires?: string;
  contentAngles?: string;
  priority?: number;
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
  brandBrain?: BrandBrain;
  status?: string;
  accountOwner?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  instagram?: string;
  location?: string;
  buyerPersonas?: ClientBuyerPersona[];
  valueProposition?: string;
  contentAngles?: string[];
  customerPainPoints?: string[];
  websiteAnalysisAt?: string;
  websiteAnalysisSource?: string;
  analysisNotes?: string;
  recommendedPlatforms?: string[];
  marketScope?: string;
  marketRegion?: string;
  primaryCity?: string;
  serviceArea?: string;
  offerSummary?: string;
  localAudienceContext?: string;
  packageName?: string;
  billingConfig?: ClientBillingConfig;
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
  platforms?: string[];
  visualFormat?: string;
  feedPlacement?: string;
  buyerPersonaId?: string;
  buyerPersonaName?: string;
  buyerPersonaSnapshot?: ClientBuyerPersona | null;
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
  locations?: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  producer: string;
  team: string;
  teamMembers?: string[];
  shotList: string;
  requirements: string;
  notes: string;
  materialLinks?: string;
  materialLinksByRequest?: Record<string, string>;
  materialFiles?: ReferenceFile[];
  status: string;
};

export type OperationalContentRule = {
  id?: string;
  contentType: string;
  label: string;
  area: string;
  internalCost: number;
  productionCost: number;
  editingHours: number;
  deliveryDays: number;
  bufferHours: number;
  requiresProductionDefault: boolean;
  active: boolean;
  notes?: string;
};

export type ClientOperationalOverride = {
  id?: string;
  clientId: string;
  clientName: string;
  contentType: string;
  internalCost?: number;
  productionCost?: number;
  editingHours?: number;
  deliveryDays?: number;
  bufferHours?: number;
  notes?: string;
  active: boolean;
};

export const defaultOperationalRules: OperationalContentRule[] = [
  { contentType: "Reel", label: "Post Reel", area: "Audiovisual", internalCost: 1500, productionCost: 0, editingHours: 6, deliveryDays: 4, bufferHours: 8, requiresProductionDefault: false, active: true, notes: "Edición corta vertical con copy y entrega para redes." },
  { contentType: "TikTok", label: "TikTok / Short", area: "Audiovisual", internalCost: 1300, productionCost: 0, editingHours: 5, deliveryDays: 3, bufferHours: 6, requiresProductionDefault: false, active: true, notes: "Pieza vertical rápida con ritmo dinámico." },
  { contentType: "Carrusel", label: "Carrusel", area: "Diseño", internalCost: 1200, productionCost: 0, editingHours: 4, deliveryDays: 3, bufferHours: 6, requiresProductionDefault: false, active: true, notes: "Diseño multipágina con copy in listo." },
  { contentType: "Post", label: "Post estático", area: "Diseño", internalCost: 750, productionCost: 0, editingHours: 2, deliveryDays: 2, bufferHours: 4, requiresProductionDefault: false, active: true, notes: "Diseño simple de feed." },
  { contentType: "Story", label: "Story", area: "Diseño", internalCost: 450, productionCost: 0, editingHours: 1, deliveryDays: 1, bufferHours: 2, requiresProductionDefault: false, active: true, notes: "Story con adaptación rápida." },
  { contentType: "Foto", label: "Foto / selección", area: "Audiovisual", internalCost: 650, productionCost: 0, editingHours: 2, deliveryDays: 2, bufferHours: 4, requiresProductionDefault: false, active: true, notes: "Edición, selección o adaptación de foto." },
  { contentType: "Diseño", label: "Diseño especial", area: "Diseño", internalCost: 1500, productionCost: 0, editingHours: 5, deliveryDays: 4, bufferHours: 8, requiresProductionDefault: false, active: true, notes: "Pieza gráfica con mayor carga visual." },
  { contentType: "Blog", label: "Blog / artículo", area: "Copy", internalCost: 1800, productionCost: 0, editingHours: 5, deliveryDays: 5, bufferHours: 8, requiresProductionDefault: false, active: true, notes: "Copy largo con estructura editorial." },
  { contentType: "Producción", label: "Producción base", area: "Audiovisual", internalCost: 0, productionCost: 4000, editingHours: 0, deliveryDays: 7, bufferHours: 24, requiresProductionDefault: true, active: true, notes: "Costo base de producción interna o coordinación." }
];

export function mergeOperationalRule(
  contentType: string,
  rules: OperationalContentRule[] = [],
  overrides: ClientOperationalOverride[] = [],
  clientId?: string
) {
  const base = rules.find(rule => rule.active !== false && rule.contentType === contentType)
    || defaultOperationalRules.find(rule => rule.contentType === contentType)
    || defaultOperationalRules[0];
  const override = overrides.find(item => item.active !== false && item.clientId === clientId && item.contentType === contentType);
  return {
    ...base,
    internalCost: override?.internalCost ?? base.internalCost,
    productionCost: override?.productionCost ?? base.productionCost,
    editingHours: override?.editingHours ?? base.editingHours,
    deliveryDays: override?.deliveryDays ?? base.deliveryDays,
    bufferHours: override?.bufferHours ?? base.bufferHours,
    notes: override?.notes || base.notes
  };
}

export function estimateRequestCost(
  item: Partial<ContentRequest>,
  rules: OperationalContentRule[] = [],
  overrides: ClientOperationalOverride[] = []
) {
  const rule = mergeOperationalRule(item.contentType || "Post", rules, overrides, item.clientId);
  const productionCost = item.requiresProduction ? rule.productionCost : 0;
  return {
    rule,
    internalCost: Number(rule.internalCost || 0),
    productionCost: Number(productionCost || 0),
    totalCost: Number(rule.internalCost || 0) + Number(productionCost || 0),
    editingHours: Number(rule.editingHours || 0),
    deliveryDays: Number(rule.deliveryDays || 0),
    bufferHours: Number(rule.bufferHours || 0)
  };
}

export function suggestOperationalDueDate(publishDate: string, deliveryDays: number) {
  if (!publishDate) return "";
  const d = new Date(publishDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() - Math.max(0, Number(deliveryDays || 0)));
  return d.toISOString().slice(0, 10);
}

export function getDeliveryRisk(publishDate: string, deliveryDays: number) {
  if (!publishDate) return { tone: "mid" as const, label: "Sin fecha de publicación" };
  const today = new Date();
  const publish = new Date(publishDate + "T00:00:00");
  const diffDays = Math.ceil((publish.getTime() - new Date(today.toISOString().slice(0,10) + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24));
  if (Number.isNaN(diffDays)) return { tone: "mid" as const, label: "Fecha inválida" };
  if (diffDays < deliveryDays) return { tone: "bad" as const, label: `Riesgo: requiere ${deliveryDays} días y quedan ${Math.max(0, diffDays)}` };
  if (diffDays <= deliveryDays + 1) return { tone: "mid" as const, label: "Tiempo justo" };
  return { tone: "good" as const, label: "Tiempo viable" };
}

export const emptyRequest: ContentRequest = {
  clientId: "",
  clientName: "",
  number: 1,
  total: 1,
  contentType: "Reel",
  objective: "Ventas",
  platforms: [],
  visualFormat: "",
  feedPlacement: "",
  buyerPersonaId: "",
  buyerPersonaName: "Sin enfoque particular",
  buyerPersonaSnapshot: null,
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

export function canAssignRequest(item: Partial<ContentRequest>) {
  // Una solicitud solo puede pasar a ejecución si ya tiene insumos reales.
  // Si requiere producción, no basta con tener producción programada: debe estar marcado material listo
  // y tener archivos o links de material entregado.
  return hasMaterial(item);
}

export function getOperationalStatus(item: ContentRequest) {
  if (item.status === "rebotada") return "rebotada";
  if (item.status === "asignada") return "asignada";
  if (item.status === "material_listo" && hasMaterial(item)) return "lista_asignacion";
  if (item.requiresProduction && canAssignRequest(item)) return "lista_asignacion";
  if (item.requiresProduction) return item.productionId ? "produccion_programada" : "pendiente_produccion";
  if (!canAssignRequest(item)) return "bloqueada";
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

export async function listOperationalContentRules() {
  const snap = await getDocs(collection(db, "operationalContentRules"));
  const custom = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OperationalContentRule));
  const customTypes = new Set(custom.map(rule => rule.contentType));
  return [
    ...custom,
    ...defaultOperationalRules.filter(rule => !customTypes.has(rule.contentType))
  ].sort((a, b) => (a.contentType || "").localeCompare(b.contentType || "", "es"));
}

export async function saveOperationalContentRule(item: OperationalContentRule) {
  return addDoc(collection(db, "operationalContentRules"), {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateOperationalContentRule(id: string, data: Partial<OperationalContentRule>) {
  return updateDoc(doc(db, "operationalContentRules", id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteOperationalContentRule(id: string) {
  return deleteDoc(doc(db, "operationalContentRules", id));
}

export async function listClientOperationalOverrides() {
  const snap = await getDocs(collection(db, "clientOperationalOverrides"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientOperationalOverride));
}


function omitUndefined<T extends Record<string, any>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

export async function saveClientOperationalOverride(item: ClientOperationalOverride) {
  return addDoc(collection(db, "clientOperationalOverrides"), {
    ...omitUndefined(item),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateClientOperationalOverride(id: string, data: Partial<ClientOperationalOverride>) {
  return updateDoc(doc(db, "clientOperationalOverrides", id), {
    ...omitUndefined(data),
    updatedAt: serverTimestamp()
  });
}

export async function deleteClientOperationalOverride(id: string) {
  return deleteDoc(doc(db, "clientOperationalOverrides", id));
}



export async function listUsers() {
  const snap = await getDocs(collection(db, "platformUsers"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlatformUser));
}


export async function findUserByAuth(authUid?: string, email?: string) {
  const cleanEmail = (email || "").trim().toLowerCase();

  if (authUid) {
    const byUid = await getDocs(query(collection(db, "platformUsers"), where("authUid", "==", authUid), limit(1)));
    if (!byUid.empty) return { id: byUid.docs[0].id, ...byUid.docs[0].data() } as PlatformUser;
  }

  if (cleanEmail) {
    const byEmail = await getDocs(query(collection(db, "platformUsers"), where("email", "==", cleanEmail), limit(1)));
    if (!byEmail.empty) return { id: byEmail.docs[0].id, ...byEmail.docs[0].data() } as PlatformUser;
  }

  return null;
}

export async function markUserLogin(id: string) {
  return updateDoc(doc(db, "platformUsers", id), {
    inviteStatus: "active",
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function saveUser(item: PlatformUser) {
  return addDoc(collection(db, "platformUsers"), {
    ...omitUndefined(item),
    email: (item.email || "").trim().toLowerCase(),
    inviteStatus: item.inviteStatus || "pending_auth",
    authUid: item.authUid || "",
    clientIds: item.scope === "all_clients" ? [] : (item.clientIds || []),
    permissions: item.isMaster ? getRoleTemplatePermissions("master") : (item.permissions || getRoleTemplatePermissions(item.roleKey)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateUser(id: string, data: Partial<PlatformUser>) {
  const payload: Partial<PlatformUser> = {
    ...data,
    email: data.email ? data.email.trim().toLowerCase() : data.email,
    authUid: data.authUid,
    inviteStatus: data.inviteStatus,
    passwordResetSentAt: data.passwordResetSentAt,
    lastLoginAt: data.lastLoginAt,
    mustChangePassword: data.mustChangePassword,
    clientIds: data.scope === "all_clients" ? [] : data.clientIds,
    permissions: data.isMaster ? getRoleTemplatePermissions("master") : data.permissions
  };
  return updateDoc(doc(db, "platformUsers", id), {
    ...omitUndefined(payload),
    updatedAt: serverTimestamp()
  });
}

export async function deleteUser(id: string) {
  return deleteDoc(doc(db, "platformUsers", id));
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


export async function saveBustItNowJob(item: BustItNowJob) {
  return addDoc(collection(db, "bustItNowJobs"), {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function listBustItNowJobs() {
  const q = query(collection(db, "bustItNowJobs"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BustItNowJob));
}

export async function updateBustItNowJob(id: string, data: Partial<BustItNowJob>) {
  return updateDoc(doc(db, "bustItNowJobs", id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function listClientAssets(clientId?: string) {
  const snap = await getDocs(collection(db, "clientAssets"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientAsset)).filter((asset) => !clientId || asset.clientId === clientId);
}

export async function uploadClientAsset(clientId: string, clientName: string, file: File, meta: { name: string; type: string; category: string; tags: string[]; notes: string }) {
  const safe = file.name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-") || "asset";
  const storagePath = `clients/${clientId}/${meta.type}/${Date.now()}-${safe}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type || undefined });
  const fileUrl = await getDownloadURL(storageRef);
  return addDoc(collection(db, "clientAssets"), {
    clientId, clientName, name: meta.name, type: meta.type, category: meta.category,
    tags: meta.tags, notes: meta.notes, fileUrl, storagePath, mimeType: file.type || "",
    originalFileName: file.name, isFeatured: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}


export async function saveClientTextAsset(clientId: string, clientName: string, meta: { name: string; role: string; priority?: string; text: string; instruction?: string }) {
  return addDoc(collection(db, "clientAssets"), {
    clientId,
    clientName,
    name: meta.name || meta.text.slice(0, 48) || "Bloque de texto",
    type: "texto",
    category: meta.role || "free",
    tags: ["bloque-texto", meta.role || "free", meta.priority || "medium"].filter(Boolean),
    notes: meta.instruction || "",
    text: meta.text,
    visualRole: meta.role || "free",
    priority: meta.priority || "medium",
    fileUrl: "",
    storagePath: "",
    mimeType: "text/plain",
    isFeatured: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateClientAsset(id: string, data: Partial<ClientAsset>) {
  return updateDoc(doc(db, "clientAssets", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteClientAsset(id: string) {
  return deleteDoc(doc(db, "clientAssets", id));
}

export async function saveGenerationRequest(item: GenerationRequest) {
  return addDoc(collection(db, "generationRequests"), { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updateGenerationRequest(id: string, data: Partial<GenerationRequest>) {
  return updateDoc(doc(db, "generationRequests", id), { ...data, updatedAt: serverTimestamp() });
}

export async function listGenerationRequests() {
  const snap = await getDocs(collection(db, "generationRequests"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GenerationRequest));
}



export const defaultClientBillingConfig: Required<ClientBillingConfig> = {
  monthlyRetainer: 0,
  includedFinalizedContents: 0,
  includedProductions: 0,
  includedProductionBudget: 0,
  includedAiGenerations: 0,
  onDemandEnabled: true,
  extraContentRate: 0,
  extraProductionRate: 0,
  extraAiGenerationRate: 0,
  billingNotes: ""
};

export function getClientBillingConfig(client?: Partial<Brand> | null): Required<ClientBillingConfig> {
  return {
    ...defaultClientBillingConfig,
    ...(client?.billingConfig || {})
  };
}

export function getRecordMonth(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 7);
  if (value?.toDate) return value.toDate().toISOString().slice(0, 7);
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000).toISOString().slice(0, 7);
  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 7);
  } catch {
    return "";
  }
}

export function getRequestOperationalMonth(item: Partial<ContentRequest>) {
  return (item.publishDate || item.dueDate || item.batchDueDate || "").slice(0, 7);
}

export function calculateClientBillingBalance(args: {
  client: Brand;
  month: string;
  requests: ContentRequest[];
  productions?: Production[];
  generatedImages?: any[];
  rules?: OperationalContentRule[];
  overrides?: ClientOperationalOverride[];
}): ClientBillingBalance {
  const { client, month, requests, productions = [], generatedImages = [], rules = [], overrides = [] } = args;
  const config = getClientBillingConfig(client);
  const clientRequests = requests.filter((item) => item.clientId === client.id && (!month || getRequestOperationalMonth(item) === month));
  const finalized = clientRequests.filter((item) => item.status === "finalizada");
  const productionRequests = clientRequests.filter((item) => item.requiresProduction || item.productionId);
  const clientProductions = productions.filter((item) => item.clientId === client.id && (!month || (item.scheduledDate || "").slice(0, 7) === month));
  const productionCount = Math.max(productionRequests.length, clientProductions.length);
  const productionCostConsumed = productionRequests.reduce((sum, item) => sum + estimateRequestCost(item, rules, overrides).productionCost, 0);
  const aiGenerations = generatedImages.filter((item) => item.clientId === client.id && (!month || getRecordMonth(item.generatedAt || item.createdAt || item.updatedAt) === month)).length;

  const billableExtraContents = Math.max(0, finalized.length - Number(config.includedFinalizedContents || 0));
  const billableExtraProductions = Math.max(0, productionCount - Number(config.includedProductions || 0));
  const billableProductionBudgetOverage = Math.max(0, productionCostConsumed - Number(config.includedProductionBudget || 0));
  const billableExtraAiGenerations = Math.max(0, aiGenerations - Number(config.includedAiGenerations || 0));

  const extraContentCharge = billableExtraContents * Number(config.extraContentRate || 0);
  const extraProductionCharge = billableExtraProductions * Number(config.extraProductionRate || 0) + billableProductionBudgetOverage;
  const extraAiCharge = billableExtraAiGenerations * Number(config.extraAiGenerationRate || 0);
  const estimatedInvoiceTotal = Number(config.monthlyRetainer || 0) + (config.onDemandEnabled ? extraContentCharge + extraProductionCharge + extraAiCharge : 0);
  const consumedValue = finalized.reduce((sum, item) => sum + estimateRequestCost(item, rules, overrides).totalCost, 0) + productionCostConsumed + aiGenerations * Number(config.extraAiGenerationRate || 0);

  return {
    clientId: client.id || "",
    clientName: client.name || "Sin cliente",
    month,
    monthlyRetainer: Number(config.monthlyRetainer || 0),
    finalizedContents: finalized.length,
    includedFinalizedContents: Number(config.includedFinalizedContents || 0),
    billableExtraContents,
    extraContentRate: Number(config.extraContentRate || 0),
    extraContentCharge,
    productions: productionCount,
    includedProductions: Number(config.includedProductions || 0),
    billableExtraProductions,
    extraProductionRate: Number(config.extraProductionRate || 0),
    extraProductionCharge,
    productionCostConsumed,
    includedProductionBudget: Number(config.includedProductionBudget || 0),
    billableProductionBudgetOverage,
    aiGenerations,
    includedAiGenerations: Number(config.includedAiGenerations || 0),
    billableExtraAiGenerations,
    extraAiGenerationRate: Number(config.extraAiGenerationRate || 0),
    extraAiCharge,
    onDemandEnabled: Boolean(config.onDemandEnabled),
    estimatedInvoiceTotal,
    consumedValue
  };
}

function normalizeClientNameForDedupe(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function clientCompletenessScore(client: Brand) {
  let score = 0;
  const fields = [
    "brandBrain",
    "brandNotes",
    "industry",
    "tone",
    "visualStyle",
    "contentPillars",
    "services",
    "sharedSystems",
    "website",
    "buyerPersonas",
    "valueProposition",
    "contentAngles",
    "customerPainPoints",
    "instagram",
    "contactName"
  ];

  for (const field of fields) {
    const value = (client as any)[field];
    if (Array.isArray(value) && value.length) score += 2;
    else if (value && typeof value === "object" && Object.keys(value).length) score += 5;
    else if (String(value || "").trim()) score += 2;
  }

  if ((client.status || "active") !== "deleted") score += 10;
  if ((client as any).migratedFrom === "bust-it-now") score += 1;

  return score;
}

export function dedupeBrandsByName(brands: Brand[]) {
  const map = new Map<string, Brand>();

  for (const brand of brands) {
    if ((brand.status || "active") === "deleted") continue;

    const key = normalizeClientNameForDedupe(brand.name || "");
    if (!key) continue;

    const current = map.get(key);
    if (!current || clientCompletenessScore(brand) > clientCompletenessScore(current)) {
      map.set(key, brand);
    }
  }

  return Array.from(map.values()).sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
}


export async function listUniqueBrands() {
  const brands = await listBrands();
  return dedupeBrandsByName(brands);
}

export async function getGenerationRequest(id: string) {
  const snap = await getDoc(doc(db, "generationRequests", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as GenerationRequest;
}

export async function saveGeneratedImageRecord(item: {
  requestId: string;
  clientId: string;
  clientName: string;
  imageDataUrl?: string;
  imageUrl?: string;
  storagePath?: string;
  model?: string;
  variantIndex?: number;
  logoOverlayApplied?: boolean;
  originalImageDataUrl?: string;
  finalImageDataUrl?: string;
  logoOverlay?: any;
  status?: string;
  generatedAt?: string;
}) {
  return addDoc(collection(db, "generatedImages"), {
    generatedAt: item.generatedAt || new Date().toISOString(),
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function listGeneratedImageRecords() {
  const snap = await getDocs(collection(db, "generatedImages"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
}

export async function updateGeneratedImageRecord(id: string, data: any) {
  return updateDoc(doc(db, "generatedImages", id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}
