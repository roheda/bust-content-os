import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
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
  "rebotada",
  "lista_programar",
  "programada",
  "publicada",
  "bloqueada",
  "pendiente_aprobacion_kam",
  "aprobada_pendiente_copyout",
  "finalizada",
  "cancelada",
  "eliminada",
  "pendiente_copy"
];

export const areas = ["Diseño", "Audiovisual", "Copy", "Mixto"];
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
  { key: "ia_operativa", label: "IA Operativa", route: "/dashboard/planeador-ia", description: "Brief score, aprendizaje del equipo, priorización y riesgos operativos." },
  { key: "generador", label: "BUST It Now", route: "/dashboard/generador", description: "Generación de imágenes, briefs y consumo IA." },
  { key: "aprobaciones", label: "Aprobaciones", route: "/dashboard/aprobaciones", description: "Doble aprobación: Content y KAM antes de publicar." },
  { key: "contenidos", label: "Contenidos", route: "/dashboard/contenidos", description: "Copy final, links, exportación y cierre de publicaciones." },
  { key: "reportes", label: "Reportes", route: "/dashboard/reportes", description: "Reportes operativos, costos y balance de facturación.", sensitive: true },
  { key: "configuracion", label: "Configuración", route: "/dashboard/configuracion", description: "Costos, tiempos y reglas operativas.", sensitive: true },
  { key: "usuarios", label: "Usuarios", route: "/dashboard/usuarios", description: "Usuarios, permisos, clientes visibles y roles.", sensitive: true }
];

export const roleTemplates = [
  { key: "master", label: "Master", description: "Control total del sistema, usuarios, facturación, configuración y generación." },
  { key: "admin", label: "Administrador", description: "Opera todo el sistema excepto eliminar usuarios master." },
  { key: "direccion", label: "Dirección", description: "Visión completa, reportes, facturación y aprobaciones." },
  { key: "kam", label: "KAM / Cuenta", description: "Clientes asignados, solicitudes, aprobación KAM y seguimiento." },
  { key: "content_lead", label: "Jefe de Content", description: "Aprueba como Content, asigna operación y supervisa contenidos." },
  { key: "content", label: "Content", description: "Crea solicitudes, programa contenidos y participa en revisión Content." },
  { key: "estrategia", label: "Estrategia", description: "Planeación, briefs, solicitudes y revisión de contenido." },
  { key: "creativo", label: "Creativo / Copy", description: "Crea solicitudes, redacta copy final y gestiona Contenidos." },
  { key: "diseno_lead", label: "Jefe de Diseño", description: "Asigna y revisa carga del área de diseño." },
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
    matrixFor(["dashboard","clientes","creador","asignacion","producciones","tareas","ia_operativa","generador","aprobaciones","contenidos","reportes"], ["view"]),
    matrixFor(["aprobaciones"], ["approve"]),
    matrixFor(["contenidos"], ["edit"]),
    matrixFor(["reportes"], ["billing"]),
    matrixFor(["generador"], ["generate"])
  );
  if (roleKey === "kam") return mergeMatrices(
    matrixFor(["dashboard","clientes","creador","asignacion","producciones","tareas","ia_operativa","generador","aprobaciones","contenidos"], ["view"]),
    matrixFor(["creador","generador"], ["create","edit","generate"]),
    matrixFor(["aprobaciones"], ["approve"]),
    matrixFor(["contenidos"], ["edit"])
  );
  if (roleKey === "content_lead") return mergeMatrices(
    matrixFor(["dashboard","clientes","creador","asignacion","tareas","ia_operativa","generador","aprobaciones","contenidos","reportes"], ["view"]),
    matrixFor(["creador","tareas","generador"], ["create","edit","generate"]),
    matrixFor(["asignacion"], ["assign","edit"]),
    matrixFor(["aprobaciones"], ["approve"]),
    matrixFor(["contenidos"], ["edit","generate"])
  );
  if (roleKey === "content") return mergeMatrices(
    matrixFor(["dashboard","clientes","creador","tareas","ia_operativa","generador","aprobaciones","contenidos"], ["view"]),
    matrixFor(["creador","tareas","generador"], ["create","edit","generate"]),
    matrixFor(["aprobaciones"], ["approve"]),
    matrixFor(["contenidos"], ["edit"])
  );
  if (roleKey === "estrategia") return mergeMatrices(
    matrixFor(["dashboard","clientes","creador","tareas","ia_operativa","generador","aprobaciones","contenidos"], ["view"]),
    matrixFor(["creador","generador"], ["create","edit","generate"]),
    matrixFor(["contenidos"], ["edit"])
  );
  if (roleKey === "creativo") return mergeMatrices(
    matrixFor(["dashboard","creador","tareas","ia_operativa","generador","contenidos"], ["view"]),
    matrixFor(["creador","tareas","generador","contenidos"], ["edit","generate"])
  );
  if (roleKey === "diseno_lead") return mergeMatrices(
    matrixFor(["dashboard","asignacion","tareas","ia_operativa","generador","aprobaciones"], ["view"]),
    matrixFor(["asignacion"], ["assign","edit"]),
    matrixFor(["tareas","generador"], ["edit","generate"]),
    matrixFor(["aprobaciones"], ["approve"])
  );
  if (roleKey === "diseno") return mergeMatrices(
    matrixFor(["dashboard","tareas","ia_operativa","generador","aprobaciones"], ["view"]),
    matrixFor(["tareas","generador"], ["edit","generate"])
  );
  if (roleKey === "audiovisual") return mergeMatrices(
    matrixFor(["dashboard","producciones","tareas","ia_operativa","aprobaciones"], ["view"]),
    matrixFor(["producciones","tareas"], ["edit"])
  );
  if (roleKey === "cliente") return mergeMatrices(
    matrixFor(["dashboard","aprobaciones"], ["view"]),
    matrixFor(["aprobaciones"], ["approve"])
  );
  return matrixFor(["dashboard"], ["view"]);
}

export function canUser(user: Partial<PlatformUser> | null | undefined, moduleKey: string, action: PermissionAction = "view") {
  if (!user) return false;
  if (user.status === "inactive") return false;
  if (user.isMaster || user.roleKey === "master") return true;
  const explicitModule = user.permissions?.[moduleKey];
  if (explicitModule && typeof explicitModule[action] !== "undefined") return Boolean(explicitModule[action]);
  // Fallback para módulos nuevos agregados después de crear usuarios existentes.
  // Respeta permisos personalizados existentes; solo completa módulos faltantes con el alcance base del rol.
  return Boolean(getRoleTemplatePermissions(user.roleKey || "kam")?.[moduleKey]?.[action]);
}

export function moduleKeyForPath(pathname?: string | null) {
  const cleanPath = (pathname || "/dashboard").split("?")[0].replace(/\/$/, "") || "/dashboard";
  if (cleanPath === "/dashboard") return "dashboard";
  if (cleanPath.startsWith("/dashboard/clientes")) return "clientes";
  if (cleanPath.startsWith("/dashboard/creador-solicitudes")) return "creador";
  if (cleanPath.startsWith("/dashboard/asignacion") || cleanPath.startsWith("/dashboard/solicitudes")) return "asignacion";
  if (cleanPath.startsWith("/dashboard/producciones")) return "producciones";
  if (cleanPath.startsWith("/dashboard/tareas") || cleanPath.startsWith("/dashboard/calendario")) return "tareas";
  if (cleanPath.startsWith("/dashboard/planeador-ia")) return "ia_operativa";
  if (cleanPath.startsWith("/dashboard/generador")) return "generador";
  if (cleanPath.startsWith("/dashboard/aprobaciones")) return "aprobaciones";
  if (cleanPath.startsWith("/dashboard/contenidos")) return "contenidos";
  if (cleanPath.startsWith("/dashboard/reportes") || cleanPath.startsWith("/dashboard/eliminadas")) return "reportes";
  if (cleanPath.startsWith("/dashboard/configuracion")) return "configuracion";
  if (cleanPath.startsWith("/dashboard/usuarios")) return "usuarios";
  const routeMatch = [...platformModules]
    .sort((a,b)=>b.route.length-a.route.length)
    .find((module)=>cleanPath === module.route || cleanPath.startsWith(`${module.route}/`));
  return routeMatch?.key || "dashboard";
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
  textRenderMode?: "ai-text" | "editable-layers" | "dual-output";
  editableTextLayers?: any[];
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

export type RevisionEvent = {
  id: string;
  at: string;
  by: string;
  person: string;
  area: string;
  reason: string;
  stage: string;
  note?: string;
};

export type ReferenceFile = {
  name: string;
  url: string;
  type: string;
  storagePath?: string;
  size?: number;
  temporary?: boolean;
  uploadedAt?: string;
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
  importantDates?: string[];
};


export type CopyRules = {
  tone?: string;
  allowedWords?: string[];
  forbiddenWords?: string[];
  allowedEmojis?: string[];
  preferredCtas?: string[];
  baseHashtags?: string[];
  specialInstructions?: string;
  approvedExamples?: string;
  neverDo?: string;
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
  originalFileName?: string;
  fontFamily?: string;
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
  referenceGeneratedPrompt?: string;
  editableGeneratedPrompt?: string;
  executedModel?: string;
  generationMode?: string;
  textRenderMode?: "ai-text" | "editable-layers" | "dual-output";
  editableTextLayers?: any[];
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
  revisionCount: number;
  revisionCost: number;
  revisionHours: number;
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
  copyRules?: CopyRules;
  status?: "active" | "inactive" | "deleted" | "archived" | string;
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
  copyStatus?: "pendiente" | "en_proceso" | "listo_para_revision" | "aprobado";
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
  productionSpecificMaterialLink?: string;
  productionGeneralMaterialLinks?: string;
  productionMaterialFiles?: ReferenceFile[];
  materialDeliveredAt?: string;
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
  revisionCount?: number;
  revisionHistory?: RevisionEvent[];
  revisionCost?: number;
  revisionHours?: number;
  lastRevisionAt?: string;
  lastRevisionBy?: string;
  lastRevisionPerson?: string;
  lastRevisionArea?: string;
  lastRevisionReason?: string;
  productionId?: string;
  productionName?: string;

  // Planeación operativa automática
  clientDueDate?: string;
  internalDueDate?: string;
  plannedWorkDate?: string;
  productionDueDate?: string;
  operationalCost?: number;
  operationalHours?: number;
  operationalWeight?: number;
  operationalRisk?: "green" | "yellow" | "orange" | "red";
  forcedDate?: boolean;
  forcedDateReason?: string;
  forcedDateNotes?: string;
  carriedOver?: boolean;
  carriedOverFromDate?: string;
  carriedOverDays?: number;
  localDraftId?: string;
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
  durationMinutes?: number;
  producer: string;
  team: string;
  teamMembers?: string[];
  shotList: string;
  requirements: string;
  notes: string;
  materialLinks?: string;
  materialLinksByRequest?: Record<string, string>;
  materialFiles?: ReferenceFile[];
  materialDueDate?: string;
  materialDeliveredAt?: string;
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
  revisionCostMultiplier?: number;
  revisionHoursMultiplier?: number;
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
  revisionCostMultiplier?: number;
  revisionHoursMultiplier?: number;
  deliveryDays?: number;
  bufferHours?: number;
  notes?: string;
  active: boolean;
};

export type TeamDailyCapacity = {
  id?: string;
  personName: string;
  area: string;
  dailyCapacityUnits: number; // piezas máximas por día (nombre legacy para no romper datos existentes)
  active: boolean;
  notes?: string;
};

export type OperationalPlan = {
  rule: OperationalContentRule;
  internalCost: number;
  productionCost: number;
  totalCost: number;
  baseCost?: number;
  revisionCost?: number;
  revisionCount?: number;
  editingHours: number;
  baseEditingHours?: number;
  revisionHours?: number;
  revisionCostMultiplier?: number;
  revisionHoursMultiplier?: number;
  deliveryDays: number;
  bufferHours: number;
  operationalWeight: number; // peso legacy; ahora se mantiene en 1 pieza
  clientDueDate: string;
  internalDueDate: string;
  productionDueDate: string;
};

export const defaultDailyCapacityUnits = 5; // piezas por día
export const defaultRevisionCostMultiplier = 0.25; // cada rebote suma 25% del costo configurado de la pieza
export const defaultRevisionHoursMultiplier = 0.25; // cada rebote suma 25% del tiempo de edición configurado

export const defaultTeamDailyCapacities: TeamDailyCapacity[] = organizationTeam
  .filter((member) => ["Diseño", "Audiovisual"].includes(member.area))
  .map((member) => ({
    personName: member.name,
    area: member.area,
    dailyCapacityUnits: defaultDailyCapacityUnits,
    active: true,
    notes: "Capacidad default en piezas por día. Ajustar en Configuración según rol/persona."
  }));

export const defaultOperationalRules: OperationalContentRule[] = [
  { contentType: "Reel", label: "Post Reel", area: "Audiovisual", internalCost: 1500, productionCost: 0, editingHours: 6, revisionCostMultiplier: defaultRevisionCostMultiplier, revisionHoursMultiplier: defaultRevisionHoursMultiplier, deliveryDays: 4, bufferHours: 8, requiresProductionDefault: false, active: true, notes: "Edición corta vertical con copy y entrega para redes." },
  { contentType: "TikTok", label: "TikTok / Short", area: "Audiovisual", internalCost: 1300, productionCost: 0, editingHours: 5, revisionCostMultiplier: defaultRevisionCostMultiplier, revisionHoursMultiplier: defaultRevisionHoursMultiplier, deliveryDays: 3, bufferHours: 6, requiresProductionDefault: false, active: true, notes: "Pieza vertical rápida con ritmo dinámico." },
  { contentType: "Carrusel", label: "Carrusel", area: "Diseño", internalCost: 1200, productionCost: 0, editingHours: 4, revisionCostMultiplier: defaultRevisionCostMultiplier, revisionHoursMultiplier: defaultRevisionHoursMultiplier, deliveryDays: 3, bufferHours: 6, requiresProductionDefault: false, active: true, notes: "Diseño multipágina con copy in listo." },
  { contentType: "Post", label: "Post estático", area: "Diseño", internalCost: 750, productionCost: 0, editingHours: 2, revisionCostMultiplier: defaultRevisionCostMultiplier, revisionHoursMultiplier: defaultRevisionHoursMultiplier, deliveryDays: 2, bufferHours: 4, requiresProductionDefault: false, active: true, notes: "Diseño simple de feed." },
  { contentType: "Story", label: "Story", area: "Diseño", internalCost: 450, productionCost: 0, editingHours: 1, revisionCostMultiplier: defaultRevisionCostMultiplier, revisionHoursMultiplier: defaultRevisionHoursMultiplier, deliveryDays: 1, bufferHours: 2, requiresProductionDefault: false, active: true, notes: "Story con adaptación rápida." },
  { contentType: "Foto", label: "Foto / selección", area: "Audiovisual", internalCost: 650, productionCost: 0, editingHours: 2, revisionCostMultiplier: defaultRevisionCostMultiplier, revisionHoursMultiplier: defaultRevisionHoursMultiplier, deliveryDays: 2, bufferHours: 4, requiresProductionDefault: false, active: true, notes: "Edición, selección o adaptación de foto." },
  { contentType: "Diseño", label: "Diseño especial", area: "Diseño", internalCost: 1500, productionCost: 0, editingHours: 5, revisionCostMultiplier: defaultRevisionCostMultiplier, revisionHoursMultiplier: defaultRevisionHoursMultiplier, deliveryDays: 4, bufferHours: 8, requiresProductionDefault: false, active: true, notes: "Pieza gráfica con mayor carga visual." },
  { contentType: "Blog", label: "Blog / artículo", area: "Copy", internalCost: 1800, productionCost: 0, editingHours: 5, revisionCostMultiplier: defaultRevisionCostMultiplier, revisionHoursMultiplier: defaultRevisionHoursMultiplier, deliveryDays: 5, bufferHours: 8, requiresProductionDefault: false, active: true, notes: "Copy largo con estructura editorial." },
  { contentType: "Producción", label: "Producción base", area: "Audiovisual", internalCost: 0, productionCost: 4000, editingHours: 0, revisionCostMultiplier: defaultRevisionCostMultiplier, revisionHoursMultiplier: defaultRevisionHoursMultiplier, deliveryDays: 7, bufferHours: 24, requiresProductionDefault: true, active: true, notes: "Costo base de producción interna o coordinación." }
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
  // v8.1: se eliminan los costos/tiempos especiales por cliente.
  // Los overrides legacy permanecen en Firebase por historial, pero ya no afectan cálculos.
  return {
    ...base,
    internalCost: base.internalCost,
    productionCost: base.productionCost,
    editingHours: base.editingHours,
    deliveryDays: base.deliveryDays,
    bufferHours: base.bufferHours,
    revisionCostMultiplier: base.revisionCostMultiplier ?? defaultRevisionCostMultiplier,
    revisionHoursMultiplier: base.revisionHoursMultiplier ?? defaultRevisionHoursMultiplier,
    notes: base.notes
  };
}

export function getRevisionCount(item: Partial<ContentRequest>) {
  const explicit = Number(item.revisionCount || 0);
  const history = Number(item.revisionHistory?.length || 0);
  const legacy = (item.comments || []).filter((comment) => {
    const body = String(comment.body || "").toLowerCase();
    return body.includes("devuelta") || body.includes("rebotada") || body.includes("rechazada");
  }).length;
  return Math.max(explicit, history, legacy, 0);
}

function roundOne(value: number) {
  return Math.round(Number(value || 0) * 10) / 10;
}

export function estimateRequestCost(
  item: Partial<ContentRequest>,
  rules: OperationalContentRule[] = [],
  overrides: ClientOperationalOverride[] = []
) {
  const rule = mergeOperationalRule(item.contentType || "Post", rules, overrides, item.clientId);
  const internalCost = Number(rule.internalCost || 0);
  const productionCost = item.requiresProduction ? Number(rule.productionCost || 0) : 0;
  const baseCost = internalCost + productionCost;
  const baseEditingHours = Number(rule.editingHours || 0);
  const revisionCount = getRevisionCount(item);
  const revisionCostMultiplier = Number(rule.revisionCostMultiplier ?? defaultRevisionCostMultiplier);
  const revisionHoursMultiplier = Number(rule.revisionHoursMultiplier ?? defaultRevisionHoursMultiplier);
  const revisionCost = Math.round(revisionCount * baseCost * revisionCostMultiplier);
  const revisionHours = roundOne(revisionCount * baseEditingHours * revisionHoursMultiplier);
  return {
    rule,
    internalCost,
    productionCost,
    baseCost,
    revisionCount,
    revisionCostMultiplier,
    revisionHoursMultiplier,
    revisionCost,
    totalCost: baseCost + revisionCost,
    baseEditingHours,
    revisionHours,
    editingHours: roundOne(baseEditingHours + revisionHours),
    deliveryDays: Number(rule.deliveryDays || 0),
    bufferHours: Number(rule.bufferHours || 0)
  };
}

export function buildRevisionUpdate(
  item: Partial<ContentRequest>,
  options: { actor: string; reason: string; stage: string; note?: string }
) {
  const at = new Date().toISOString();
  const today = todayDateKey();
  const previousDate = item.plannedWorkDate || item.dueDate || item.internalDueDate || item.batchDueDate || item.publishDate || "";
  const person = item.assignedTo || "Sin responsable";
  const area = item.assignedArea || item.suggestedArea || "Sin área";
  const history = [...(item.revisionHistory || [])];
  const nextCount = Math.max(getRevisionCount(item), history.length) + 1;
  history.push({
    id: `${Date.now()}-${nextCount}`,
    at,
    by: options.actor || "Sistema",
    person,
    area,
    reason: options.reason || "Sin motivo",
    stage: options.stage || "Revisión",
    note: options.note || ""
  });
  return {
    revisionCount: nextCount,
    revisionHistory: history,
    lastRevisionAt: at,
    lastRevisionBy: options.actor || "Sistema",
    lastRevisionPerson: person,
    lastRevisionArea: area,
    lastRevisionReason: options.reason || "Sin motivo",
    plannedWorkDate: today,
    dueDate: today,
    internalDueDate: today,
    priority: item.priority === "Urgente" ? "Urgente" : "Alta",
    carriedOver: true,
    carriedOverFromDate: previousDate,
    carriedOverDays: previousDate ? Math.max(0, businessDaysBetween(previousDate, today)) : 0
  };
}

export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function todayDateKey() {
  return toDateKey(new Date());
}

export function isBusinessDate(value?: string) {
  if (!value) return false;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

export function addBusinessDays(value: string, days: number) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const direction = days >= 0 ? 1 : -1;
  let remaining = Math.abs(Math.trunc(days));
  while (remaining > 0) {
    date.setDate(date.getDate() + direction);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return toDateKey(date);
}

export function subtractBusinessDays(value: string, days: number) {
  return addBusinessDays(value, -Math.max(0, Number(days || 0)));
}

export function businessDaysBetween(startValue: string, endValue: string) {
  if (!startValue || !endValue) return 0;
  const start = new Date(`${startValue}T12:00:00`);
  const end = new Date(`${endValue}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const direction = start <= end ? 1 : -1;
  let count = 0;
  const cursor = new Date(start);
  while (toDateKey(cursor) !== toDateKey(end)) {
    cursor.setDate(cursor.getDate() + direction);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += direction;
  }
  return count;
}

export function suggestOperationalDueDate(publishDate: string, deliveryDays: number) {
  if (!publishDate) return "";
  return subtractBusinessDays(publishDate, Math.max(0, Number(deliveryDays || 0)));
}

export function suggestProductionDueDate(publishDate: string, deliveryDays: number, bufferHours = 8) {
  if (!publishDate) return "";
  const internalDueDate = suggestOperationalDueDate(publishDate, deliveryDays);
  const productionLeadDays = Math.max(1, Math.ceil(Number(bufferHours || 8) / 8));
  return subtractBusinessDays(internalDueDate || publishDate, productionLeadDays);
}

export function operationalWeightFromHours(hours: number) {
  // Legacy: antes convertía horas a peso por horas.
  // Ahora la capacidad se mide por pieza; las horas siguen siendo esfuerzo estimado.
  return 1;
}

export function getOperationalPlan(
  item: Partial<ContentRequest>,
  rules: OperationalContentRule[] = [],
  overrides: ClientOperationalOverride[] = []
): OperationalPlan {
  const estimate = estimateRequestCost(item, rules, overrides);
  const clientDueDate = item.publishDate || item.batchDueDate || item.clientDueDate || item.dueDate || "";
  const internalDueDate = item.internalDueDate || suggestOperationalDueDate(clientDueDate, estimate.deliveryDays) || item.dueDate || clientDueDate;
  const productionDueDate = item.requiresProduction ? (item.productionDueDate || suggestProductionDueDate(clientDueDate, estimate.deliveryDays, estimate.bufferHours)) : "";
  return {
    ...estimate,
    operationalWeight: 1,
    clientDueDate,
    internalDueDate,
    productionDueDate
  };
}

export function getCapacityForPerson(personName = "", area = "", capacities: TeamDailyCapacity[] = []) {
  const found = capacities.find((item) => item.active !== false && item.personName === personName);
  if (found) return Number(found.dailyCapacityUnits || defaultDailyCapacityUnits);
  const defaultFound = defaultTeamDailyCapacities.find((item) => item.personName === personName);
  if (defaultFound) return Number(defaultFound.dailyCapacityUnits || defaultDailyCapacityUnits);
  return defaultDailyCapacityUnits;
}

export function getCapacityTone(load: number, capacity: number) {
  const safeCapacity = Math.max(0.1, Number(capacity || defaultDailyCapacityUnits));
  const ratio = Number(load || 0) / safeCapacity;
  if (ratio <= 0.85) return { tone: "green" as const, label: "Verde", ratio };
  if (ratio <= 1) return { tone: "yellow" as const, label: "Amarillo", ratio };
  if (ratio <= 1.2) return { tone: "orange" as const, label: "Naranja", ratio };
  return { tone: "red" as const, label: "Rojo", ratio };
}

export function getEffectiveWorkDate(item: Partial<ContentRequest>, todayKey = todayDateKey()) {
  const planned = item.plannedWorkDate || item.dueDate || item.internalDueDate || item.batchDueDate || item.publishDate || "";
  if (!planned) return "";
  const closed = ["pendiente_aprobacion", "pendiente_aprobacion_kam", "aprobada_pendiente_copyout", "aprobada", "finalizada", "programada", "publicada", "cancelada", "eliminada"].includes(item.status || "");
  if (!closed && planned < todayKey) return todayKey;
  return planned;
}

export function planWorkDateForAssignment(
  item: ContentRequest,
  allRequests: ContentRequest[] = [],
  capacities: TeamDailyCapacity[] = [],
  rules: OperationalContentRule[] = [],
  overrides: ClientOperationalOverride[] = [],
  assignedTo = item.assignedTo || "",
  assignedArea = item.assignedArea || item.suggestedArea || ""
) {
  const todayKey = todayDateKey();
  const plan = getOperationalPlan({ ...item, assignedTo, assignedArea }, rules, overrides);
  const deadline = plan.internalDueDate || item.dueDate || item.batchDueDate || item.publishDate || todayKey;
  const weight = 1;
  const capacity = getCapacityForPerson(assignedTo, assignedArea, capacities);
  const loadByDate: Record<string, number> = {};

  allRequests
    .filter((task) => task.id !== item.id)
    .filter((task) => task.assignedTo === assignedTo)
    .filter((task) => !["pendiente_aprobacion", "pendiente_aprobacion_kam", "aprobada_pendiente_copyout", "aprobada", "finalizada", "programada", "publicada", "cancelada", "eliminada"].includes(task.status || ""))
    .forEach((task) => {
      const date = getEffectiveWorkDate(task, todayKey);
      if (!date) return;
      const taskPlan = getOperationalPlan(task, rules, overrides);
      loadByDate[date] = (loadByDate[date] || 0) + 1;
    });

  let cursor = todayKey;
  let guard = 0;
  while (cursor && cursor <= deadline && guard < 180) {
    if (isBusinessDate(cursor) && (loadByDate[cursor] || 0) + weight <= capacity) {
      return { plannedWorkDate: cursor, capacity, projectedLoad: (loadByDate[cursor] || 0) + weight, weight, plan, overflow: false };
    }
    cursor = addBusinessDays(cursor, 1);
    guard += 1;
  }

  const fallback = isBusinessDate(deadline) ? deadline : addBusinessDays(deadline || todayKey, 1);
  return { plannedWorkDate: fallback || todayKey, capacity, projectedLoad: (loadByDate[fallback] || 0) + weight, weight, plan, overflow: true };
}

export function getDeliveryRisk(publishDate: string, deliveryDays: number) {
  if (!publishDate) return { tone: "mid" as const, label: "Sin fecha de publicación" };
  const today = todayDateKey();
  const minDate = addBusinessDays(today, Math.max(0, Number(deliveryDays || 0)));
  if (publishDate < minDate) return { tone: "bad" as const, label: `Riesgo: primera fecha viable ${minDate}` };
  if (businessDaysBetween(today, publishDate) <= deliveryDays + 1) return { tone: "mid" as const, label: "Tiempo justo" };
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
  copyStatus: "pendiente",
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
  revisionCount: 0,
  revisionHistory: [],
  revisionCost: 0,
  revisionHours: 0,
  lastRevisionAt: "",
  lastRevisionBy: "",
  lastRevisionPerson: "",
  lastRevisionArea: "",
  lastRevisionReason: "",
  clientDueDate: "",
  internalDueDate: "",
  plannedWorkDate: "",
  productionDueDate: "",
  operationalCost: 0,
  operationalHours: 0,
  operationalWeight: 1,
  operationalRisk: "green",
  forcedDate: false,
  forcedDateReason: "",
  forcedDateNotes: "",
  carriedOver: false,
  carriedOverFromDate: "",
  carriedOverDays: 0,
};

export function isImageFile(file: ReferenceFile) {
  const type = file.type || "";
  const name = (file.name || "").toLowerCase();
  return type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|avif|heic|heif)$/i.test(name);
}

export function isVideoFile(file: ReferenceFile) {
  const type = file.type || "";
  const name = (file.name || "").toLowerCase();
  return type.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|mpeg|mpg)$/i.test(name);
}

export function getRequestDate(item: Partial<ContentRequest>) {
  return item.publishDate || "";
}

export function hasMaterial(item: Partial<ContentRequest>) {
  const files = item.materialFiles?.length || 0;
  const links = (item.materialLinks || "").trim().length;
  return Boolean(item.materialAvailable && (files > 0 || links > 0));
}

export function hasProductionDeliveredMaterial(item: Partial<ContentRequest>) {
  const productionFiles = (item.productionMaterialFiles || []).length;
  const specific = (item.productionSpecificMaterialLink || "").trim().length;
  const general = (item.productionGeneralMaterialLinks || "").trim().length;
  return Boolean(item.materialDeliveredAt || specific || general || productionFiles);
}

export function canAssignRequest(item: Partial<ContentRequest>) {
  // Si requiere producción, los links pegados desde el creador NO cuentan como material listo.
  // Solo se desbloquea cuando Producción entrega material con evidencia real.
  if (item.requiresProduction) return hasProductionDeliveredMaterial(item);
  return true;
}

export function getOperationalStatus(item: ContentRequest) {
  if (item.requiresProduction && item.status === "material_listo" && !hasProductionDeliveredMaterial(item)) {
    return item.productionId ? "produccion_programada" : "pendiente_produccion";
  }
  const directStatuses = [
    "eliminada",
    "finalizada",
    "aprobada_pendiente_copyout",
    "pendiente_aprobacion_kam",
    "pendiente_aprobacion",
    "publicada",
    "programada",
    "lista_programar",
    "en_revision",
    "en_ejecucion",
    "rebotada",
    "asignada",
    "cancelada",
    "pendiente_produccion",
    "produccion_programada",
    "material_listo",
    "lista_asignacion"
  ];
  if (directStatuses.includes(item.status || "")) return item.status || "lista_asignacion";
  // pendiente_copy es un estado de copy, no de asignación. Si llega a Asignación
  // por datos heredados o borradores antiguos, se normaliza al flujo operativo real.
  if (item.status === "pendiente_copy") {
    return item.requiresProduction ? "pendiente_produccion" : "lista_asignacion";
  }
  if (item.status === "material_listo" && hasMaterial(item)) return "lista_asignacion";
  if (item.requiresProduction && canAssignRequest(item)) return "lista_asignacion";
  if (item.requiresProduction) return item.productionId ? "produccion_programada" : "pendiente_produccion";
  if (!canAssignRequest(item)) return "bloqueada";
  return item.status || "lista_asignacion";
}

export function validateCreatorItem(item: ContentRequest, options: { strict?: boolean } = {}) {
  const strict = options.strict !== false;
  if (!item.clientId || !item.clientName) return "Falta cliente.";
  if (!item.contentType) return "Falta tipo de contenido.";
  if (!item.objective) return "Falta objetivo.";
  if (!item.suggestedArea) return "Falta área sugerida.";
  if (!item.publishDate) return "Falta fecha de publicación.";

  if (!strict) return "";

  if (!item.platforms?.length) return "Falta plataforma.";
  if (!item.visualFormat && !item.feedPlacement) return "Falta formato visual.";
  if (!item.topic.trim()) return "Falta tema.";
  if (!item.creativeIdea.trim()) return "Falta idea creativa.";
  if (!item.keyMessage.trim()) return "Falta mensaje clave.";
  if (!item.copyIn.trim()) return "Falta Copy In.";
  if (!item.cta.trim()) return "Falta CTA.";
  if (item.requiresProduction && !item.productionNotes.trim()) return "Faltan notas para producción.";

  if (!item.requiresProduction && !hasMaterial(item)) {
    return "Si no requiere producción, debes marcar material disponible y agregar un link de material.";
  }

  return "";
}

export async function uploadReferenceFiles(
  files: FileList | File[],
  folder = "content-request-references",
  options: { maxBytes?: number; temporary?: boolean; allowedTypes?: RegExp } = {}
) {
  const list = Array.from(files);
  const uploaded: ReferenceFile[] = [];
  const maxBytes = options.maxBytes || 80 * 1024 * 1024;

  for (const file of list) {
    if (file.size > maxBytes) {
      throw new Error(`${file.name} pesa ${Math.ceil(file.size / 1024 / 1024)} MB. Máximo permitido: ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
    }
    if (options.allowedTypes && !options.allowedTypes.test(file.type || file.name || "")) {
      throw new Error(`${file.name} no es un formato permitido. Usa imagen o video.`);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${folder}/${Date.now()}-${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    uploaded.push({
      name: file.name,
      url,
      type: file.type || "",
      storagePath,
      size: file.size,
      temporary: Boolean(options.temporary),
      uploadedAt: new Date().toISOString()
    });
  }

  return uploaded;
}

export async function deleteStorageFiles(files: ReferenceFile[] = []) {
  await Promise.all((files || [])
    .filter((file) => file.storagePath)
    .map(async (file) => {
      try {
        await deleteObject(ref(storage, file.storagePath!));
      } catch (error) {
        console.warn("No se pudo eliminar archivo temporal", file.storagePath, error);
      }
    }));
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

export async function deleteClientOperationalData(clientId: string) {
  const collectionNames = [
    "contentRequests",
    "plannerDrafts",
    "requestBatches",
    "productions",
    "bustItNowJobs",
    "generationRequests",
    "generatedImages"
  ];

  const summary: Record<string, number> = {};

  for (const collectionName of collectionNames) {
    const snap = await getDocs(collection(db, collectionName));
    const matches = snap.docs.filter((documentSnap) => {
      const row = documentSnap.data() as { clientId?: string };
      return row.clientId === clientId;
    });
    await Promise.all(matches.map((documentSnap) => deleteDoc(doc(db, collectionName, documentSnap.id))));
    summary[collectionName] = matches.length;
  }

  return summary;
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
  const normalizedItems = items.map((item, index) => ({
    ...item,
    id: undefined,
    localDraftId: item.localDraftId || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    number: index + 1,
    total: items.length
  }));

  const productionCount = normalizedItems.filter((item) => item.requiresProduction).length;
  const assignmentCount = normalizedItems.length - productionCount;

  const firestoreBatch = writeBatch(db);
  const batchRef = doc(collection(db, "requestBatches"));
  firestoreBatch.set(batchRef, {
    ...batch,
    totalRequests: normalizedItems.length,
    status: batch.status || "sent_to_assignment",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  normalizedItems.forEach((item, index) => {
    const hasCopy = Boolean((item.copyIn || item.copyOut || "").trim());
    const status = item.requiresProduction ? "pendiente_produccion" : "lista_asignacion";
    const plan = getOperationalPlan({ ...item, batchDueDate: batch.batchDueDate });
    const requestRef = doc(collection(db, "contentRequests"));
    const { id: _id, ...requestPayload } = item;
    firestoreBatch.set(requestRef, {
      ...requestPayload,
      number: index + 1,
      total: normalizedItems.length,
      batchId: batchRef.id,
      batchName: batch.name,
      batchDueDate: batch.batchDueDate,
      clientDueDate: plan.clientDueDate || item.publishDate || batch.batchDueDate,
      internalDueDate: plan.internalDueDate || item.dueDate || batch.batchDueDate,
      productionDueDate: item.requiresProduction ? plan.productionDueDate : "",
      dueDate: item.dueDate || plan.internalDueDate || batch.batchDueDate,
      copyStatus: item.copyStatus || (hasCopy ? "listo_para_revision" : "pendiente"),
      operationalCost: item.operationalCost ?? plan.totalCost,
      operationalHours: item.operationalHours ?? plan.editingHours,
      operationalWeight: 1,
      operationalRisk: item.operationalRisk || "green",
      status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  await firestoreBatch.commit();

  return {
    batchId: batchRef.id,
    total: normalizedItems.length,
    assignmentCount,
    productionCount,
    omitted: [] as string[]
  };
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

export function subscribeRequests(onChange: (items: ContentRequest[]) => void, onError?: (error: unknown) => void) {
  const q = query(collection(db, "contentRequests"), orderBy("createdAt", "desc"));
  return onSnapshot(q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContentRequest))),
    (error) => {
      console.warn("No se pudo escuchar contentRequests en tiempo real", error);
      onError?.(error);
    }
  );
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

export async function listTeamDailyCapacities() {
  const snap = await getDocs(collection(db, "teamDailyCapacities"));
  const custom = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeamDailyCapacity));
  const customPeople = new Set(custom.map(item => item.personName));
  return [
    ...custom,
    ...defaultTeamDailyCapacities.filter(item => !customPeople.has(item.personName))
  ].sort((a, b) => (a.area || "").localeCompare(b.area || "", "es") || (a.personName || "").localeCompare(b.personName || "", "es"));
}

export async function saveTeamDailyCapacity(item: TeamDailyCapacity) {
  return addDoc(collection(db, "teamDailyCapacities"), {
    ...item,
    dailyCapacityUnits: Number(item.dailyCapacityUnits || defaultDailyCapacityUnits),
    active: item.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateTeamDailyCapacity(id: string, data: Partial<TeamDailyCapacity>) {
  return updateDoc(doc(db, "teamDailyCapacities", id), {
    ...data,
    dailyCapacityUnits: data.dailyCapacityUnits === undefined ? data.dailyCapacityUnits : Number(data.dailyCapacityUnits || defaultDailyCapacityUnits),
    updatedAt: serverTimestamp()
  });
}

export async function deleteTeamDailyCapacity(id: string) {
  return deleteDoc(doc(db, "teamDailyCapacities", id));
}



export async function listUsers() {
  const snap = await getDocs(collection(db, "platformUsers"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlatformUser));
}


export async function findUserByAuth(authUid?: string, email?: string) {
  const cleanEmail = (email || "").trim().toLowerCase();

  // Producción: las reglas de Firebase pueden autorizar de forma segura con userAccess/{uid}.
  // Este documento espejo evita depender de queries abiertas a platformUsers para iniciar sesión.
  if (authUid) {
    try {
      const accessSnap = await getDoc(doc(db, "userAccess", authUid));
      if (accessSnap.exists()) {
        const access = accessSnap.data() as any;
        const platformUserId = access.platformUserId || authUid;
        const profileSnap = await getDoc(doc(db, "platformUsers", platformUserId));
        if (profileSnap.exists()) return { id: profileSnap.id, ...profileSnap.data() } as PlatformUser;
        return {
          id: platformUserId,
          name: access.name || cleanEmail || "Usuario",
          email: access.email || cleanEmail,
          roleKey: access.roleKey || "kam",
          roleLabel: access.roleLabel || access.roleKey || "Usuario",
          status: access.status || "active",
          isMaster: Boolean(access.isMaster),
          scope: access.scope || "assigned_clients",
          clientIds: access.clientIds || [],
          permissions: access.permissions || getRoleTemplatePermissions(access.roleKey || "kam"),
          authUid
        } as PlatformUser;
      }
    } catch (error) {
      console.warn("No se pudo leer userAccess; intentando fallback legacy", error);
    }

    const byUid = await getDocs(query(collection(db, "platformUsers"), where("authUid", "==", authUid), limit(1)));
    if (!byUid.empty) return { id: byUid.docs[0].id, ...byUid.docs[0].data() } as PlatformUser;
  }

  if (cleanEmail) {
    const byEmail = await getDocs(query(collection(db, "platformUsers"), where("email", "==", cleanEmail), limit(1)));
    if (!byEmail.empty) return { id: byEmail.docs[0].id, ...byEmail.docs[0].data() } as PlatformUser;
  }

  return null;
}

function userAccessPayload(item: Partial<PlatformUser>, platformUserId?: string) {
  const roleKey = item.roleKey || "kam";
  const permissions = item.isMaster ? getRoleTemplatePermissions("master") : (item.permissions || getRoleTemplatePermissions(roleKey));
  return omitUndefined({
    platformUserId,
    name: item.name || "",
    email: (item.email || "").trim().toLowerCase(),
    roleKey,
    roleLabel: item.roleLabel || roleKey,
    status: item.status || "active",
    isMaster: Boolean(item.isMaster || roleKey === "master"),
    department: item.department || "",
    jobTitle: item.jobTitle || "",
    scope: item.scope || "assigned_clients",
    clientIds: item.scope === "all_clients" ? [] : (item.clientIds || []),
    permissions,
    canBypassClientLimits: Boolean(item.canBypassClientLimits),
    canManageBilling: Boolean(item.canManageBilling),
    updatedAt: serverTimestamp()
  });
}

export async function syncUserAccessMirror(platformUserId: string, data: Partial<PlatformUser>) {
  if (!data.authUid) return null;
  return setDoc(doc(db, "userAccess", data.authUid), userAccessPayload(data, platformUserId), { merge: true });
}

export async function markUserLogin(id: string) {
  return updateDoc(doc(db, "platformUsers", id), {
    inviteStatus: "active",
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function saveUser(item: PlatformUser) {
  const ref = await addDoc(collection(db, "platformUsers"), {
    ...omitUndefined(item),
    email: (item.email || "").trim().toLowerCase(),
    inviteStatus: item.inviteStatus || "pending_auth",
    authUid: item.authUid || "",
    clientIds: item.scope === "all_clients" ? [] : (item.clientIds || []),
    permissions: item.isMaster ? getRoleTemplatePermissions("master") : (item.permissions || getRoleTemplatePermissions(item.roleKey)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  if (item.authUid) await syncUserAccessMirror(ref.id, item).catch((error)=>console.warn("No se pudo sincronizar userAccess", error));
  return ref;
}

export async function updateUser(id: string, data: Partial<PlatformUser>) {
  const currentSnap = await getDoc(doc(db, "platformUsers", id)).catch(()=>null);
  const current = currentSnap?.exists() ? ({ id, ...currentSnap.data() } as PlatformUser) : ({} as PlatformUser);
  const merged: Partial<PlatformUser> = { ...current, ...data };
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
  await updateDoc(doc(db, "platformUsers", id), {
    ...omitUndefined(payload),
    updatedAt: serverTimestamp()
  });
  const authUid = data.authUid || current.authUid;
  if (authUid) await syncUserAccessMirror(id, { ...merged, authUid }).catch((error)=>console.warn("No se pudo sincronizar userAccess", error));
}

export async function deleteUser(id: string) {
  const currentSnap = await getDoc(doc(db, "platformUsers", id)).catch(()=>null);
  const authUid = currentSnap?.exists() ? (currentSnap.data() as PlatformUser).authUid : "";
  await deleteDoc(doc(db, "platformUsers", id));
  if (authUid) await deleteDoc(doc(db, "userAccess", authUid)).catch(()=>{});
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
  const isFont = meta.type === "font" || /\.(otf|ttf|woff2?|eot)$/i.test(file.name);
  const fontFamily = isFont ? `BUST-${clientId}-${(meta.name || file.name).replace(/\.[^/.]+$/," ").replace(/[^a-z0-9]+/gi,"-").replace(/^-+|-+$/g,"")}` : "";
  return addDoc(collection(db, "clientAssets"), {
    clientId, clientName, name: meta.name, type: meta.type, category: meta.category,
    tags: meta.tags, notes: meta.notes, fileUrl, storagePath, mimeType: file.type || "",
    originalFileName: file.name, fontFamily, isFeatured: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
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

export async function deleteClientAsset(id: string, storagePath?: string) {
  if (storagePath) {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch (error) {
      console.warn("No se pudo eliminar asset de Storage; se eliminará el registro", storagePath, error);
    }
  }
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
  const revisionSummary = clientRequests.reduce((acc, item) => {
    const cost = estimateRequestCost(item, rules, overrides);
    acc.count += cost.revisionCount;
    acc.cost += cost.revisionCost;
    acc.hours += cost.revisionHours;
    return acc;
  }, { count: 0, cost: 0, hours: 0 });
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
    revisionCount: revisionSummary.count,
    revisionCost: revisionSummary.cost,
    revisionHours: revisionSummary.hours,
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

export function isBrandActive(brand: Partial<Brand> | null | undefined) {
  if (!brand) return false;
  return !["deleted", "archived", "inactive", "inactivo", "eliminada", "eliminado"].includes(
    String(brand.status || "active").toLowerCase(),
  );
}

export function dedupeBrandsByName(brands: Brand[]) {
  const map = new Map<string, Brand>();

  for (const brand of brands) {
    if (!isBrandActive(brand)) continue;

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

export async function uploadGeneratedImageDataUrl(requestId: string, dataUrl: string, label = "generated") {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const contentType = blob.type || "image/png";
  const extension = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  const safeRequest = String(requestId || "request").replace(/[^a-zA-Z0-9._-]/g, "-");
  const safeLabel = String(label || "generated").replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `generated-images/${safeRequest}/${Date.now()}-${safeLabel}.${extension}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, { contentType });
  const imageUrl = await getDownloadURL(storageRef);
  return { imageUrl, storagePath, size: blob.size, contentType };
}

export async function saveGeneratedImageRecord(item: {
  requestId: string;
  clientId: string;
  clientName: string;
  imageDataUrl?: string;
  imageUrl?: string;
  storagePath?: string;
  finalImageUrl?: string;
  finalStoragePath?: string;
  originalImageUrl?: string;
  originalStoragePath?: string;
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
