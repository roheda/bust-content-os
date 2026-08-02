"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import {
  useModulePermissions,
  permissionAlert,
} from "@/components/useModulePermissions";
import { authJsonHeaders } from "@/lib/client-auth";
import {
  Brand,
  ClientOperationalOverride,
  ClientBuyerPersona,
  ContentRequest,
  OperationalContentRule,
  TeamDailyCapacity,
  CleanupRetentionSettings,
  PlannerDraft,
  PlatformUser,
  RequestBatch,
  ReferenceFile,
  areas,
  contentTypes,
  defaultCleanupRetentionSettings,
  emptyRequest,
  getCleanupRetentionSettings,
  getRequestDate,
  hasMaterial,
  isImageFile,
  isVideoFile,
  estimateRequestCost,
  getDeliveryRisk,
  getCapacityTone,
  getOperationalPlan,
  addBusinessDays,
  subtractBusinessDays,
  todayDateKey,
  listUniqueBrands,
  listUsers,
  listPlannerDrafts,
  deletePlannerDraft,
  listClientOperationalOverrides,
  listOperationalContentRules,
  listTeamDailyCapacities,
  listRequestBatches,
  listRequests,
  markRequestBatchDeleted,
  objectives,
  savePlannerDraft,
  saveRequestBatch,
  updatePlannerDraft,
  suggestOperationalDueDate,
  uploadReferenceFiles,
} from "@/lib/data";

const creatorAreas = Array.from(new Set([...areas, "Fotografía"]));

function normalizeCreatorText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isPhotographyOnly(item: Partial<ContentRequest>) {
  const area = normalizeCreatorText(item.suggestedArea || "");
  const type = normalizeCreatorText(item.contentType || "");
  return area.includes("fotograf") || type === "foto";
}

function validateCreatorItemForCreator(
  item: ContentRequest,
  options: { strict?: boolean } = {},
) {
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
  if (!isPhotographyOnly(item) && !item.copyIn.trim()) return "Falta Copy In.";
  if (!item.cta.trim()) return "Falta CTA.";
  if (item.requiresProduction && !item.productionNotes.trim())
    return "Faltan notas para producción.";

  if (!item.requiresProduction && !hasMaterial(item)) {
    return "Si no requiere producción, debes marcar material disponible y agregar un link de material.";
  }

  return "";
}

type CsvImportPreview = {
  fileName: string;
  totalRows: number;
  validItems: ContentRequest[];
  errors: string[];
};

const creatorCsvHeaders = [
  "Numero", "Cliente", "NombreLote", "FechaPublicacion", "Tipo",
  "Objetivo", "Area", "BuyerPersona", "Tema", "IdeaCreativa",
  "MensajeClave", "CTA", "CopyIn", "Plataformas", "FormatoVisual",
  "Ubicacion", "RequiereProduccion", "MaterialDisponible",
  "LinksMaterial", "NotasProduccion", "Autor",
];

function csvEscape(value: unknown) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function detectCsvDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const counts = [",", ";", "\t"].map((delimiter) => ({
    delimiter,
    count: firstLine.split(delimiter).length - 1,
  }));
  return counts.sort((a, b) => b.count - a.count)[0]?.delimiter || ",";
}

function parseCsvTable(text: string) {
  const delimiter = detectCsvDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === delimiter) { row.push(cell.trim()); cell = ""; }
    else if (character === '\n') {
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else if (character !== '\r') cell += character;
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function normalizeCsvHeader(value = "") {
  return normalizeCreatorText(value).replace(/[^a-z0-9]/g, "");
}

function csvBoolean(value: string, fallback = false) {
  const normalized = normalizeCreatorText(value).trim();
  if (["si", "true", "1", "x", "yes"].includes(normalized)) return true;
  if (["no", "false", "0"].includes(normalized)) return false;
  return fallback;
}

function csvList(value = "") {
  return value.split(/\s*[|;]\s*|\s*,\s*/).map((item) => item.trim()).filter(Boolean);
}

function normalizeCsvDate(value = "") {
  const text = value.trim();
  const iso = text.match(/^(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})$/);
  if (local) return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  return "";
}

function safeCreatorExitHref(value = "") {
  const fallback = "/dashboard/creador-solicitudes";
  if (typeof window === "undefined") return fallback;
  try {
    const url = new URL(value || fallback, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    const isKnownAppRoute =
      url.pathname === "/dashboard" ||
      url.pathname.startsWith("/dashboard/") ||
      url.pathname === "/login";
    if (!isKnownAppRoute) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export default function CreatorPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [drafts, setDrafts] = useState<PlannerDraft[]>([]);
  const [batches, setBatches] = useState<RequestBatch[]>([]);
  const [costRules, setCostRules] = useState<OperationalContentRule[]>([]);
  const [clientOverrides, setClientOverrides] = useState<
    ClientOperationalOverride[]
  >([]);
  const [teamCapacities, setTeamCapacities] = useState<TeamDailyCapacity[]>([]);
  const [cleanupSettings, setCleanupSettings] = useState<CleanupRetentionSettings>(defaultCleanupRetentionSettings);
  const [showFullReuseHistory, setShowFullReuseHistory] = useState(false);
  const [forceReason, setForceReason] = useState("");
  const [forceNotes, setForceNotes] = useState("");
  const [currentDraftId, setCurrentDraftId] = useState("");
  const [draftName, setDraftName] = useState("");
  const [batchDueDate, setBatchDueDate] = useState("");
  const [clientId, setClientId] = useState("");
  const [batchOwnerId, setBatchOwnerId] = useState("");
  const [batchOwnerName, setBatchOwnerName] = useState("");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [items, setItems] = useState<ContentRequest[]>([]);
  const [manual, setManual] = useState<ContentRequest>(emptyRequest);
  const [preview, setPreview] = useState<ReferenceFile | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvImportPreview | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishingBatch, setPublishingBatch] = useState(false);
  const publishingBatchRef = useRef(false);
  const referenceMaxBytes = 80 * 1024 * 1024;
  const [improvingKey, setImprovingKey] = useState<string>("");
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(
    null,
  );
  const [creatorMode, setCreatorMode] = useState<"ia" | "manual">("ia");
  const [addPanelCollapsed, setAddPanelCollapsed] = useState(false);
  const [batchConfigCollapsed, setBatchConfigCollapsed] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<"list" | "accordion">("list");
  const [aiStartingPoint, setAiStartingPoint] = useState<"fresh" | "reference">("fresh");
  const [aiReferenceBatchId, setAiReferenceBatchId] = useState("");
  const [aiCreativityLevel, setAiCreativityLevel] = useState<
    "conservative" | "balanced" | "exploratory"
  >("balanced");
  const [aiChangeNotes, setAiChangeNotes] = useState("");
  const [aiMustInclude, setAiMustInclude] = useState("");
  const [aiMustAvoid, setAiMustAvoid] = useState("");
  const [aiKeepTone, setAiKeepTone] = useState(true);
  const [aiKeepFormats, setAiKeepFormats] = useState(true);
  const [aiKeepFrequency, setAiKeepFrequency] = useState(true);
  const [aiKeepObjectives, setAiKeepObjectives] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "info"; message: string } | null>(null);
  const [localRecovery, setLocalRecovery] = useState<any | null>(null);
  const [autosaveAt, setAutosaveAt] = useState("");
  const [leaveWarning, setLeaveWarning] = useState<{ href: string } | null>(null);
  const savedSnapshotRef = useRef("");
  const dirtyRef = useRef(false);
  const bypassNavigationRef = useRef(false);
  const latestAutosavePayloadRef = useRef<any | null>(null);
  const autosaveKey = "bust-content-os:creator-autosave:v82";

  const [aiCount, setAiCount] = useState(5);
  const [startDate, setStartDate] = useState("");
  const [interval, setInterval] = useState(2);
  const [types, setTypes] = useState("Reel,Carrusel,Post");
  const [goals, setGoals] = useState("Ventas,Awareness,Confianza");
  const [themes, setThemes] = useState(
    "Experiencia,Producto estrella,Testimonios",
  );
  const [must, setMust] = useState(
    "CTA claro, alineado al tono de marca y sin contenido de relleno.",
  );
  const [manualCount, setManualCount] = useState(1);
  const permissions = useModulePermissions("creador");
  const activeUser = permissions.activeUser;
  const canCreateRequests = permissions.canCreate || permissions.canEdit;
  const canGenerateRequests =
    permissions.canGenerate || permissions.canCreate || permissions.canEdit;
  const canDeleteDrafts = permissions.canDelete || permissions.canEdit;

  function hasMeaningfulCreatorWork() {
    return Boolean(
      items.length ||
        batchDueDate ||
        startDate ||
        manual.creativeIdea?.trim() ||
        manual.copyIn?.trim() ||
        manual.topic?.trim(),
    );
  }

  function currentCreatorSnapshot() {
    return JSON.stringify({
      clientId,
      draftName,
      batchDueDate,
      items,
      manual,
      creatorMode,
      aiCount,
      startDate,
      interval,
      types,
      goals,
      themes,
      must,
      manualCount,
      aiStartingPoint,
      aiReferenceBatchId,
      aiCreativityLevel,
      aiChangeNotes,
      aiMustInclude,
      aiMustAvoid,
      aiKeepTone,
      aiKeepFormats,
      aiKeepFrequency,
      aiKeepObjectives,
      batchOwnerId,
      batchOwnerName,
      collaboratorIds,
    });
  }

  function currentAutosavePayload() {
    return {
      savedAt: new Date().toISOString(),
      clientId,
      draftName,
      batchDueDate,
      items,
      manual,
      creatorMode,
      aiCount,
      startDate,
      interval,
      types,
      goals,
      themes,
      must,
      manualCount,
      aiStartingPoint,
      aiReferenceBatchId,
      aiCreativityLevel,
      aiChangeNotes,
      aiMustInclude,
      aiMustAvoid,
      aiKeepTone,
      aiKeepFormats,
      aiKeepFrequency,
      aiKeepObjectives,
      batchOwnerId,
      batchOwnerName,
      collaboratorIds,
    };
  }

  function persistLocalAutosaveNow(updateStatus = true) {
    if (typeof window === "undefined") return false;
    const payload = {
      ...(latestAutosavePayloadRef.current || currentAutosavePayload()),
      savedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(autosaveKey, JSON.stringify(payload));
      latestAutosavePayloadRef.current = payload;
      if (updateStatus) setAutosaveAt(payload.savedAt);
      return true;
    } catch (error) {
      console.warn("No se pudo guardar autosave del creador", error);
      return false;
    }
  }

  async function load() {
    const [
      loadedBrands,
      loadedRequests,
      loadedDrafts,
      loadedBatches,
      loadedRules,
      loadedOverrides,
      loadedCapacities,
      loadedCleanupSettings,
      loadedUsers,
    ] = await Promise.all([
      listUniqueBrands(),
      listRequests(),
      listPlannerDrafts(),
      listRequestBatches(),
      listOperationalContentRules(),
      listClientOperationalOverrides(),
      listTeamDailyCapacities(),
      getCleanupRetentionSettings(),
      listUsers().catch(() => [] as PlatformUser[]),
  ]);
    setBrands(loadedBrands);
    setRequests(loadedRequests);
    setDrafts(loadedDrafts);
    setBatches(loadedBatches);
    setCostRules(loadedRules);
    setClientOverrides(loadedOverrides);
    setTeamCapacities(loadedCapacities);
    setCleanupSettings(loadedCleanupSettings);
    setUsers(loadedUsers.filter((user) => user.status !== "inactive"));
    if (!clientId && loadedBrands[0]?.id) {
      setClientId(loadedBrands[0].id);
      if (!draftName) setDraftName(defaultBatchName(loadedBrands[0].name));
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!activeUser?.id) return;
    if (!batchOwnerId) setBatchOwnerId(activeUser.id);
    if (!batchOwnerName) setBatchOwnerName(activeUser.name || activeUser.email || "Content");
  }, [activeUser?.id, activeUser?.name, activeUser?.email, batchOwnerId, batchOwnerName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(autosaveKey);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const hasWork = Boolean(
        (parsed.items || []).length ||
          parsed.batchDueDate ||
          parsed.startDate ||
          parsed.manual?.creativeIdea?.trim() ||
          parsed.manual?.copyIn?.trim() ||
          parsed.manual?.topic?.trim(),
      );
      if (hasWork) {
        setLocalRecovery(parsed);
        setAutosaveAt(parsed.savedAt || "");
      }
    } catch (error) {
      console.warn("No se pudo recuperar autosave del creador", error);
    }
  }, []);

  useEffect(() => {
    const snapshot = currentCreatorSnapshot();
    latestAutosavePayloadRef.current = currentAutosavePayload();

    dirtyRef.current =
      hasMeaningfulCreatorWork() && snapshot !== savedSnapshotRef.current;
  }, [
    clientId,
    draftName,
    batchDueDate,
    items,
    manual,
    creatorMode,
    aiCount,
    startDate,
    interval,
    types,
    goals,
    themes,
    must,
    manualCount,
    aiStartingPoint,
    aiReferenceBatchId,
    aiCreativityLevel,
    aiChangeNotes,
    aiMustInclude,
    aiMustAvoid,
    aiKeepTone,
    aiKeepFormats,
    aiKeepFrequency,
    aiKeepObjectives,
    batchOwnerId,
    batchOwnerName,
    collaboratorIds,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localRecovery) return;
    if (!hasMeaningfulCreatorWork()) return;
    if (currentCreatorSnapshot() === savedSnapshotRef.current) return;

    const timer = window.setTimeout(() => {
      persistLocalAutosaveNow(true);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    clientId,
    draftName,
    batchDueDate,
    items,
    manual,
    creatorMode,
    aiCount,
    startDate,
    interval,
    types,
    goals,
    themes,
    must,
    manualCount,
    aiStartingPoint,
    aiReferenceBatchId,
    aiCreativityLevel,
    aiChangeNotes,
    aiMustInclude,
    aiMustAvoid,
    aiKeepTone,
    aiKeepFormats,
    aiKeepFrequency,
    aiKeepObjectives,
    batchOwnerId,
    batchOwnerName,
    collaboratorIds,
    localRecovery,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      persistLocalAutosaveNow(false);
      event.preventDefault();
      event.returnValue = "";
    }

    function interceptNavigation(event: MouseEvent) {
      if (bypassNavigationRef.current || !dirtyRef.current) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;

      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;

      event.preventDefault();
      event.stopPropagation();
      persistLocalAutosaveNow(true);
      setLeaveWarning({ href: safeCreatorExitHref(`${url.pathname}${url.search}${url.hash}`) });
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", interceptNavigation, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", interceptNavigation, true);
    };
  }, []);

  useEffect(() => {
    if (!items.length) setAddPanelCollapsed(false);
  }, [items.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("bust-content-os:creator-workspace-view");
    if (stored === "list" || stored === "accordion") setWorkspaceView(stored);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(
        "bust-content-os:creator-workspace-view",
        workspaceView,
      );
    if (
      workspaceView === "list" &&
      items.length &&
      (expandedItemIndex === null || expandedItemIndex >= items.length)
    )
      setExpandedItemIndex(0);
  }, [workspaceView, items.length, expandedItemIndex]);

  const client = brands.find((x) => x.id === clientId) || brands[0];
  const existing = client?.id
    ? requests.filter((x) => x.clientId === client.id).length
    : 0;
  const calendarItems = useMemo(() => {
    const saved = client?.id
      ? requests.filter((x) => x.clientId === client.id)
      : requests;
    return [...saved, ...items].filter((x) => getRequestDate(x));
  }, [client?.id, requests, items]);

  const planningSummary = useMemo(
    () =>
      buildPlanningSummary(
        items,
        requests,
        costRules,
        clientOverrides,
        teamCapacities,
      ),
    [items, requests, costRules, clientOverrides, teamCapacities],
  );
  const operationalSummary = planningSummary;

  function split(v: string) {
    return v
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  function addDays(date: string, days: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function isWeekendDate(value?: string) {
    if (!value) return false;
    const d = new Date(`${value}T12:00:00`);
    const day = d.getDay();
    return day === 0 || day === 6;
  }

  function nextBusinessDate(value: string) {
    if (!value) return value;
    const d = new Date(`${value}T12:00:00`);
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    return d.toISOString().slice(0, 10);
  }

  function setBusinessDate(
    setter: (value: string) => void,
    value: string,
    label = "fecha",
  ) {
    // Usar solo para fechas de trabajo interno. Las fechas de publicación sí pueden caer en sábado o domingo.
    if (value && isWeekendDate(value)) {
      alert(`La ${label} no puede ser sábado o domingo. Elige un día hábil.`);
      return;
    }
    setter(value);
  }

  function extractDateKeyFromText(value: string) {
    const text = String(value || "");
    const iso = text.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    const local = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/);
    if (local) return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
    return "";
  }

  function relevantImportantDatesForSchedule(count = aiCount) {
    const allDates = client?.brandBrain?.importantDates || [];
    if (!startDate) return [];
    const endDate = addDays(startDate, (Math.max(1, count) - 1) * Math.max(1, interval));
    return allDates.filter((value) => {
      const date = extractDateKeyFromText(value);
      return Boolean(date && date >= startDate && date <= endDate);
    });
  }

  function clearLocalAutosave() {
    if (typeof window !== "undefined")
      window.localStorage.removeItem(autosaveKey);
    latestAutosavePayloadRef.current = null;
    setAutosaveAt("");
    setLocalRecovery(null);
  }

  function restoreLocalAutosave() {
    if (!localRecovery) return;
    const recoveredAt =
      localRecovery.savedAt || new Date().toISOString();
    setClientId(localRecovery.clientId || clientId);
    setDraftName(localRecovery.draftName || "");
    setBatchDueDate(localRecovery.batchDueDate || "");
    setItems(normalizeCreatorItems(localRecovery.items || []));
    setManual(localRecovery.manual || emptyRequest);
    setCreatorMode(localRecovery.creatorMode || "ia");
    setAiCount(Number(localRecovery.aiCount || 5));
    setStartDate(localRecovery.startDate || "");
    setInterval(Number(localRecovery.interval || 2));
    setTypes(localRecovery.types || "Reel,Carrusel,Post");
    setGoals(localRecovery.goals || "Ventas,Awareness,Confianza");
    setThemes(
      localRecovery.themes || "Experiencia,Producto estrella,Testimonios",
    );
    setMust(localRecovery.must || "");
    setManualCount(Number(localRecovery.manualCount || 1));
    setAiStartingPoint(localRecovery.aiStartingPoint || "fresh");
    setAiReferenceBatchId(localRecovery.aiReferenceBatchId || "");
    setAiCreativityLevel(localRecovery.aiCreativityLevel || "balanced");
    setAiChangeNotes(localRecovery.aiChangeNotes || "");
    setAiMustInclude(localRecovery.aiMustInclude || "");
    setAiMustAvoid(localRecovery.aiMustAvoid || "");
    setAiKeepTone(localRecovery.aiKeepTone !== false);
    setAiKeepFormats(localRecovery.aiKeepFormats !== false);
    setAiKeepFrequency(localRecovery.aiKeepFrequency !== false);
    setAiKeepObjectives(localRecovery.aiKeepObjectives !== false);
    setBatchOwnerId(localRecovery.batchOwnerId || activeUser?.id || "");
    setBatchOwnerName(localRecovery.batchOwnerName || activeUser?.name || "");
    setCollaboratorIds(Array.isArray(localRecovery.collaboratorIds) ? localRecovery.collaboratorIds : []);
    setAddPanelCollapsed(Boolean((localRecovery.items || []).length));
    setAutosaveAt(recoveredAt);
    setLocalRecovery(null);
    showFeedback(
      "Borrador local restaurado desde guardado automático.",
      "info",
    );
  }

  function showFeedback(message: string, type: "success" | "info" = "success") {
    setFeedback({ message, type });
    window.setTimeout(() => setFeedback(null), 4500);
  }

  function shouldStartInProduction(req: Partial<ContentRequest>) {
    const content = `${req.contentType || ""} ${req.suggestedArea || ""}`
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    return Boolean(
      req.requiresProduction ||
        content.includes("audiovisual") ||
        content.includes("video") ||
        content.includes("reel") ||
        content.includes("tiktok") ||
        content.includes("foto"),
    );
  }

  function initialOperationalStatus(req: Partial<ContentRequest>) {
    // La ruta operativa final la decide el checkbox/campo requiresProduction.
    // Un Reel puede ir directo a asignación si ya tiene material listo o no requiere producción.
    return req.requiresProduction ? "pendiente_produccion" : "lista_asignacion";
  }

  function creationDateLabel() {
    return new Date().toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function monthYearLabel(dateValue = startDate) {
    const parsed = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
    const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    const month = safeDate.toLocaleDateString("es-MX", { month: "long" });
    const capitalizedMonth = `${month.charAt(0).toUpperCase()}${month.slice(1)}`;
    return `${capitalizedMonth} ${safeDate.getFullYear()}`;
  }

  function defaultBatchName(clientName = client?.name || "Cliente", dateValue = startDate) {
    return `Parrilla ${clientName} ${monthYearLabel(dateValue)}`;
  }

  function createLocalDraftId(prefix = "draft") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeCreatorItems(list: ContentRequest[]) {
    const total = list.length;
    return list.map((item, index) => {
      const requiresProduction = Boolean(item.requiresProduction);
      const base = {
        ...item,
        localDraftId: item.localDraftId || createLocalDraftId(String(item.source || "item")),
        number: index + 1,
       total,
        status: initialOperationalStatus({ ...item, requiresProduction }),
        materialAvailable: requiresProduction ? false : item.materialAvailable,
        productionSpecificMaterialLink: requiresProduction ? "" : item.productionSpecificMaterialLink || "",
        productionGeneralMaterialLinks: requiresProduction ? "" : item.productionGeneralMaterialLinks || "",
        materialDeliveredAt: requiresProduction ? "" : item.materialDeliveredAt || "",
      };
      const plan = getOperationalPlan({ ...base, batchDueDate: base.batchDueDate || batchDueDate }, costRules, clientOverrides);
      const risk = getDeliveryRisk(plan.clientDueDate, plan.deliveryDays);
      return {
        ...base,
        clientDueDate: plan.clientDueDate,
        internalDueDate: plan.internalDueDate,
        productionDueDate: requiresProduction ? plan.productionDueDate : "",
        dueDate: base.dueDate || plan.internalDueDate || base.batchDueDate || batchDueDate,
        operationalCost: plan.totalCost,
        operationalHours: plan.editingHours,
        operationalWeight: 1,
        operationalRisk:
          risk.tone === "bad" ? "red" : risk.tone === "mid" ? "yellow" : "green",
      } as ContentRequest;
    });
  }

  function stripUndefinedDeep<T>(value: T): T {
    if (Array.isArray(value)) {
      return value
        .filter((entry) => entry !== undefined)
        .map((entry) => stripUndefinedDeep(entry)) as T;
    }

    if (value && typeof value === "object") {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) return value;

      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, entry]) => entry !== undefined)
          .map(([key, entry]) => [key, stripUndefinedDeep(entry)]),
      ) as T;
    }

    return value;
  }

  function prepareItemsForPersistence(list: ContentRequest[], dueDateValue = batchDueDate) {
    const prepared = normalizeCreatorItems(
      list.map((item) => {
        const { id: _id, ...itemWithoutFirestoreId } = item;
        const collaboration = collaborationMetadata();
        return {
          ...itemWithoutFirestoreId,
          createdById: (item as any).createdById || collaboration.ownerId,
          createdByName: (item as any).createdByName || collaboration.ownerName,
          createdAt: (item as any).createdAt || new Date().toISOString(),
          lastEditedById: activeUser?.id || collaboration.ownerId,
          lastEditedByName: activeUser?.name || activeUser?.email || collaboration.ownerName,
          lastEditedAt: new Date().toISOString(),
          collaboratorIds: collaboration.collaboratorIds,
          collaboratorNames: collaboration.collaboratorNames,
          clientId: client?.id || item.clientId || "",
          clientName: client?.name || item.clientName || "",
          batchDueDate: dueDateValue,
          dueDate: item.dueDate || dueDateValue,
        } as ContentRequest;
      }),
    );

    return stripUndefinedDeep(prepared);
  }

  function recoveredReuseItem(number: number, total: number, batch: RequestBatch): ContentRequest {
    return {
      ...emptyRequest,
      localDraftId: createLocalDraftId("reuse-recovered"),
      clientId: batch.clientId,
      clientName: batch.clientName,
      number,
      total,
      contentType: "Post",
      objective: "Ventas",
      platforms: ["Instagram", "Facebook"],
      visualFormat: "Cuadrado 1:1",
      feedPlacement: "Feed",
      topic: `Solicitud ${number} faltante del lote original`,
      creativeIdea:
        "Completar manualmente. El lote original declara esta solicitud, pero no se encontró el registro completo al reusar el lote.",
      keyMessage: "Completar mensaje clave antes de enviar.",
      copyIn: "Completar copy in antes de enviar.",
      copyStatus: "en_proceso",
      cta: "Completar CTA",
      publishDate: "",
      status: "lista_asignacion",
      source: "reuse-recovered",
      requiresProduction: false,
      materialAvailable: true,
      materialLinks: "Solicitud recuperada para cuadrar el conteo del lote original.",
      suggestedArea: "Diseño",
    };
  }


  function isAutoBatchName(name: string) {
    return !name || / · (Lote|Creado) /.test(name) || /^Parrilla .+ [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+ \d{4}$/.test(name);
  }

  function handleClientChange(nextClientId: string) {
    const selectedClient = brands.find((brand) => brand.id === nextClientId);
    const hasWorkInProgress =
      items.length > 0 ||
      currentDraftId ||
      manual.creativeIdea?.trim() ||
      manual.copyIn?.trim();
    if (hasWorkInProgress) {
      const ok = window.confirm(
        "Cambiar de cliente limpiará el lote actual para evitar mezclar solicitudes de otro cliente. ¿Continuar?",
      );
      if (!ok) return;
    }
    savedSnapshotRef.current = "";
    dirtyRef.current = false;
    clearLocalAutosave();
    setClientId(nextClientId);
    setCurrentDraftId("");
    setBatchOwnerId(activeUser?.id || "");
    setBatchOwnerName(activeUser?.name || activeUser?.email || "");
    setCollaboratorIds([]);
    setItems([]);
    setExpandedItemIndex(null);
    setAddPanelCollapsed(false);
    setManual(emptyRequest);
    setBatchDueDate("");
    setAiReferenceBatchId("");
    setAiStartingPoint("fresh");
    if (selectedClient) setDraftName(defaultBatchName(selectedClient.name));
  }

  const eligibleCollaborators = useMemo(() =>
    users.filter((user) => {
      if (!user.id || user.status === "inactive" || user.id === batchOwnerId) return false;
      const role = normalizeCreatorText(user.roleKey || "");
      const department = normalizeCreatorText(user.department || "");
      const title = normalizeCreatorText(user.jobTitle || "");
      return ["content", "content_lead", "estrategia"].includes(role) || department.includes("content") || title.includes("content");
    }).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es")),
  [users, batchOwnerId]);

  const selectedCollaborators = useMemo(() =>
    collaboratorIds.map((id) => users.find((user) => user.id === id)).filter(Boolean) as PlatformUser[],
  [collaboratorIds, users]);

  function collaborationMetadata() {
    const ownerName = batchOwnerName || activeUser?.name || activeUser?.email || "Content";
    return {
      ownerId: batchOwnerId || activeUser?.id || "",
      ownerName,
      collaboratorIds,
      collaboratorNames: selectedCollaborators.map((user) => user.name || user.email).filter(Boolean),
      lastEditedById: activeUser?.id || "",
      lastEditedByName: activeUser?.name || activeUser?.email || ownerName,
      lastEditedAt: new Date().toISOString(),
    };
  }

  function toggleCollaborator(userId: string) {
    setCollaboratorIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  }

  function downloadBatchCsv() {
    const metadata = collaborationMetadata();
    const rows: unknown[][] = items.map((item, index) => [
      index + 1, client?.name || item.clientName || "",
      draftName || defaultBatchName(client?.name || item.clientName || "Cliente"),
      item.publishDate || "", item.contentType || "", item.objective || "",
      item.suggestedArea || "", item.buyerPersonaName || "", item.topic || "",
      item.creativeIdea || "", item.keyMessage || "", item.cta || "", item.copyIn || "",
      item.platforms || [], item.visualFormat || "", item.feedPlacement || "",
      item.requiresProduction ? "Sí" : "No", item.materialAvailable ? "Sí" : "No",
      item.materialLinks || "", item.productionNotes || "",
      (item as any).createdByName || metadata.ownerName,
    ]);
    const csvRows: unknown[][] = [creatorCsvHeaders, ...rows];
    const csv = `\uFEFF${csvRows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeName = (draftName || defaultBatchName(client?.name || "Cliente")).replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ _-]/g, "").trim().replace(/\s+/g, "-");
    anchor.href = url;
    anchor.download = `${safeName || "parrilla"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showFeedback(items.length ? `Lote exportado para Excel: ${items.length} visual(es).` : "Plantilla CSV descargada para llenar en Excel.", "info");
  }

  function matchCatalogValue(value: string, catalog: string[], fallback: string) {
    const normalized = normalizeCreatorText(value);
    return catalog.find((option) => normalizeCreatorText(option) === normalized) || fallback;
  }

  async function previewCsvImport(file?: File | null) {
    if (!file) return;
    if (!client?.id) {
      if (csvInputRef.current) csvInputRef.current.value = "";
      return alert("Selecciona cliente antes de importar el CSV.");
    }
    try {
      const text = await file.text();
      const table = parseCsvTable(text.replace(/^\uFEFF/, ""));
      if (table.length < 2) throw new Error("El archivo no contiene filas para importar.");
      const headers = table[0].map(normalizeCsvHeader);
      const indexOf = (...aliases: string[]) => headers.findIndex((header) => aliases.map(normalizeCsvHeader).includes(header));
      const column = {
        date: indexOf("FechaPublicacion", "Fecha", "PublishDate"),
        type: indexOf("Tipo", "TipoContenido", "ContentType"),
        objective: indexOf("Objetivo", "Objective"),
        area: indexOf("Area", "AreaSugerida", "SuggestedArea"),
        persona: indexOf("BuyerPersona", "Persona"),
        topic: indexOf("Tema", "Topic"),
        idea: indexOf("IdeaCreativa", "Idea", "CreativeIdea"),
        message: indexOf("MensajeClave", "KeyMessage"),
        cta: indexOf("CTA"), copy: indexOf("CopyIn", "Copy"),
        platforms: indexOf("Plataformas", "Platforms"),
        format: indexOf("FormatoVisual", "Formato", "VisualFormat"),
        placement: indexOf("Ubicacion", "FeedPlacement"),
        production: indexOf("RequiereProduccion", "Produccion", "RequiresProduction"),
        material: indexOf("MaterialDisponible", "MaterialAvailable"),
        links: indexOf("LinksMaterial", "MaterialLinks", "Links"),
        notes: indexOf("NotasProduccion", "ProductionNotes"),
      };
      const valueAt = (row: string[], position: number) => position >= 0 ? String(row[position] || "").trim() : "";
      const validItems: ContentRequest[] = [];
      const errors: string[] = [];
      table.slice(1).forEach((row, rowIndex) => {
        const line = rowIndex + 2;
        const publishDate = normalizeCsvDate(valueAt(row, column.date));
        if (!publishDate) { errors.push(`Fila ${line}: FechaPublicacion debe usar YYYY-MM-DD o DD/MM/YYYY.`); return; }
        const rawType = valueAt(row, column.type);
        const rawObjective = valueAt(row, column.objective);
        const rawArea = valueAt(row, column.area);
        const contentType = matchCatalogValue(rawType, contentTypes, rawType ? "" : "Post");
        const objective = matchCatalogValue(rawObjective, objectives, rawObjective ? "" : "Ventas");
        const suggestedArea = matchCatalogValue(rawArea, creatorAreas, rawArea ? "" : "Diseño");
        if (!contentType) { errors.push(`Fila ${line}: tipo no reconocido (${rawType}).`); return; }
        if (!objective) { errors.push(`Fila ${line}: objetivo no reconocido (${rawObjective}).`); return; }
        if (!suggestedArea) { errors.push(`Fila ${line}: área no reconocida (${rawArea}).`); return; }
        const requiresProduction = csvBoolean(valueAt(row, column.production), false);
        validItems.push(hydrate({
          ...emptyRequest, clientId: client.id!, clientName: client.name,
          number: items.length + validItems.length + 1, total: items.length + table.length - 1,
          publishDate, contentType, objective, suggestedArea,
          buyerPersonaName: valueAt(row, column.persona) || "Sin enfoque particular",
          topic: valueAt(row, column.topic), creativeIdea: valueAt(row, column.idea),
          keyMessage: valueAt(row, column.message), cta: valueAt(row, column.cta),
          copyIn: valueAt(row, column.copy), copyStatus: valueAt(row, column.copy) ? "listo_para_revision" : "pendiente",
          platforms: csvList(valueAt(row, column.platforms)), visualFormat: valueAt(row, column.format),
          feedPlacement: valueAt(row, column.placement), requiresProduction,
          materialAvailable: requiresProduction ? false : csvBoolean(valueAt(row, column.material), false),
          materialLinks: valueAt(row, column.links), productionNotes: valueAt(row, column.notes), source: "csv-import",
        }, "csv-import"));
      });
      setCsvPreview({ fileName: file.name, totalRows: Math.max(0, table.length - 1), validItems, errors });
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo leer el CSV.");
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  }

  function confirmCsvImport() {
    if (!csvPreview?.validItems.length) return;
    const importedCount = csvPreview.validItems.length;
    const firstNewIndex = items.length;
    setItems(normalizeCreatorItems([...items, ...csvPreview.validItems]));
    setExpandedItemIndex(firstNewIndex);
    setWorkspaceView("list");
    setAddPanelCollapsed(true);
    setCsvPreview(null);
    showFeedback(`${importedCount} visual(es) agregados desde CSV. Ningún contenido existente fue reemplazado.`);
  }

  function hydrate(req: ContentRequest, source: string): ContentRequest {
    const base = {
      ...req,
      clientId: client?.id || "",
      clientName: client?.name || "",
      batchDueDate,
    };
    const plan = getOperationalPlan(base, costRules, clientOverrides);
    const risk = getDeliveryRisk(plan.clientDueDate, plan.deliveryDays);
    const metadata = collaborationMetadata();
    return {
      ...base,
      createdById: (base as any).createdById || metadata.ownerId,
      createdByName: (base as any).createdByName || metadata.ownerName,
      createdAt: (base as any).createdAt || new Date().toISOString(),
      lastEditedById: activeUser?.id || metadata.ownerId,
      lastEditedByName: activeUser?.name || activeUser?.email || metadata.ownerName,
      lastEditedAt: new Date().toISOString(),
      total: items.length + 1,
      number: items.length + 1,
      status: initialOperationalStatus(req),
      copyStatus:
        req.copyStatus ||
        ((req.copyIn || req.copyOut || "").trim()
          ? "listo_para_revision"
          : "pendiente"),
      clientDueDate: plan.clientDueDate,
      internalDueDate: plan.internalDueDate,
      productionDueDate: req.requiresProduction ? plan.productionDueDate : "",
      dueDate: req.dueDate || plan.internalDueDate || batchDueDate,
      operationalCost: plan.totalCost,
      operationalHours: plan.editingHours,
      operationalWeight: 1,
      operationalRisk:
        risk.tone === "bad" ? "red" : risk.tone === "mid" ? "yellow" : "green",
      source,
    } as ContentRequest;
  }

  function setManualField(k: keyof ContentRequest, v: any) {
    setManual({ ...manual, [k]: v });
  }

  function clientContext(scheduleImportantDates?: string[]) {
    if (!client) return "";
    const brain = client.brandBrain || {};
    return [
      client.brandNotes && `Notas de marca: ${client.brandNotes}`,
      client.brandPersonality && `Personalidad: ${client.brandPersonality}`,
      client.visualStyle && `Estilo visual operativo: ${client.visualStyle}`,
      client.contentPillars && `Pilares de contenido: ${client.contentPillars}`,
      client.valueProposition &&
        `Propuesta de valor: ${client.valueProposition}`,
      (client.contentAngles || []).length
        ? `Ángulos de contenido recomendados: ${(client.contentAngles || []).join(", ")}`
        : "",
      (client.customerPainPoints || []).length
        ? `Dolores de la audiencia: ${(client.customerPainPoints || []).join(", ")}`
        : "",
      (client.buyerPersonas || []).length
        ? `Buyer personas disponibles: ${(client.buyerPersonas || []).map((p) => p.name).join(", ")}`
        : "",
      brain.brandDescription &&
        `Descripción de marca: ${brain.brandDescription}`,
      brain.tone && `Tono: ${brain.tone}`,
      brain.typography &&
        `Tipografía oficial registrada: ${brain.typography} (solo referencia de marca; no usar como titular ni copy visible)`,
      ((scheduleImportantDates ?? brain.importantDates) || []).length
        ? `Fechas importantes del cliente dentro de la parrilla: ${((scheduleImportantDates ?? brain.importantDates) || []).join(" | ")}`
        : "",
      (brain.visualStyle || []).length
        ? `Estilo visual del Brand Brain: ${(brain.visualStyle || []).join(", ")}`
        : "",
      (brain.dos || []).length
        ? `Sí hacer: ${(brain.dos || []).join(", ")}`
        : "",
      (brain.donts || []).length
        ? `Evitar: ${(brain.donts || []).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function marketContext() {
    if (!client) return "";
    return [
      client.marketScope && `Alcance del cliente: ${client.marketScope}`,
      client.marketRegion && `Región: ${client.marketRegion}`,
      client.primaryCity && `Ciudad base: ${client.primaryCity}`,
      client.serviceArea && `Zona de servicio/venta: ${client.serviceArea}`,
      client.offerSummary && `Qué ofrece: ${client.offerSummary}`,
      client.localAudienceContext &&
        `Contexto de audiencia local: ${client.localAudienceContext}`,
      client.location && `Ubicación registrada: ${client.location}`,
      client.website && `Sitio web: ${client.website}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function buyerPersonaContext(item?: Partial<ContentRequest>) {
    if (!client) return "";
    const personas = client.buyerPersonas || [];
    const selected =
      personas.find((p) => p.id && p.id === item?.buyerPersonaId) ||
      personas.find((p) => p.name && p.name === item?.buyerPersonaName);
    if (!selected || !item?.buyerPersonaId) {
    return "Sin enfoque particular. Usar el contexto general de la marca y no forzar la pieza a un buyer persona específico.";
    }
    return [
      `Buyer persona elegido: ${selected.name}`,
      selected.description && `Descripción: ${selected.description}`,
      selected.pains && `Dolores: ${selected.pains}`,
      selected.desires && `Deseos: ${selected.desires}`,
      selected.contentAngles &&
        `Ángulos recomendados: ${selected.contentAngles}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function successfulRequestsContext() {
    if (!client?.id) return "";
    return requests
      .filter((x) => x.clientId === client.id && x.status === "finalizada")
      .slice(0, 8)
      .map((x, index) =>
        [
          `${index + 1}. ${x.contentType || "Contenido"} · ${x.objective || "Sin objetivo"} · ${x.visualFormat || x.feedPlacement || "Sin formato"}`,
          x.topic ? `Tema: ${x.topic}` : "",
          x.creativeIdea ? `Idea usada: ${x.creativeIdea}` : "",
          x.copyOut ? `Copy final: ${x.copyOut}` : "",
          x.approvalNotes ? `Nota de aprobación: ${x.approvalNotes}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      )
      .join("\n");
  }

  async function improveCreativeIdea(target: "manual" | number) {
    if (!canGenerateRequests) return permissionAlert("mejorar ideas con IA");
    const item = target === "manual" ? manual : items[target];
    if (!item?.creativeIdea?.trim())
      return alert("Primero escribe una idea creativa base.");
    const key = target === "manual" ? "manual" : String(target);
    setImprovingKey(key);
    try {
      const response = await fetch("/api/improve-creative-idea", {
        method: "POST",
        headers: await authJsonHeaders(),
        body: JSON.stringify({
         clientName: client?.name || item.clientName,
          clientContext: clientContext(),
          marketContext: marketContext(),
          successfulContext: [
            successfulRequestsContext(),
            buildAiGenerationInstructions(),
          ]
            .filter(Boolean)
            .join("\n\n"),
          buyerPersonaName: item.buyerPersonaName || "Sin enfoque particular",
          buyerPersonaContext: buyerPersonaContext(item),
          contentType: item.contentType,
          objective: item.objective,
          platforms: item.platforms || [],
          visualFormat: item.visualFormat || item.feedPlacement || "",
          creativeIdea: item.creativeIdea,
          keyMessage: item.keyMessage,
          cta: item.cta,
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload?.error || "No se pudo perfeccionar la idea.");
      if (target === "manual")
        setManual({
          ...manual,
          creativeIdea: payload.creativeIdea || manual.creativeIdea,
        });
      else
        updateItem(
          target,
          "creativeIdea",
          payload.creativeIdea || item.creativeIdea,
        );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "No se pudo perfeccionar la idea.",
      );
    } finally {
      setImprovingKey("");
    }
  }

  async function saveDraft(): Promise<boolean> {
    if (!canCreateRequests) {
      permissionAlert("guardar borradores de solicitudes");
      return false;
    }
    if (!client?.id) {
      alert("Selecciona cliente");
      return false;
    }
    const name = draftName || defaultBatchName(client.name);
    const itemsForSave = prepareItemsForPersistence(items, batchDueDate);
    const collaboration = collaborationMetadata();
    setBusy(true);
    try {
      if (currentDraftId) {
        await updatePlannerDraft(currentDraftId, {
          name,
          clientId: client.id,
          clientName: client.name,
          status: "draft",
          batchDueDate,
          items: itemsForSave,
          ...collaboration,
        } as any);
      } else {
        const ref = await savePlannerDraft({
          name,
          clientId: client.id,
          clientName: client.name,
          status: "draft",
          batchDueDate,
          items: itemsForSave,
          ...collaboration,
          createdById: collaboration.ownerId,
          createdByName: collaboration.ownerName,
        } as any);
        setCurrentDraftId(ref.id);
      }
      savedSnapshotRef.current = JSON.stringify({
        clientId: client.id,
        draftName: name,
        batchDueDate,
        items: itemsForSave,
        manual,
        creatorMode,
        aiCount,
        startDate,
        interval,
        types,
        goals,
        themes,
        must,
        manualCount,
        aiStartingPoint,
        aiReferenceBatchId,
        aiCreativityLevel,
        aiChangeNotes,
        aiMustInclude,
        aiMustAvoid,
        aiKeepTone,
        aiKeepFormats,
        aiKeepFrequency,
        aiKeepObjectives,
        batchOwnerId: collaboration.ownerId,
        batchOwnerName: collaboration.ownerName,
        collaboratorIds: collaboration.collaboratorIds,
      });
      dirtyRef.current = false;
      clearLocalAutosave();
      setDraftName(name);
      setItems(itemsForSave);
      await load();
      showFeedback(
        `Borrador guardado correctamente: ${name}. ${itemsForSave.length} solicitud(es) guardada(s).`,
      );
      return true;
    } catch (error) {
      alert(
        error instanceof Error
          ? `No se pudo guardar el borrador: ${error.message}`
          : "No se pudo guardar el borrador.",
      );
      return false;
    } finally {
      publishingBatchRef.current = false;
      setPublishingBatch(false);
      setBusy(false);
    }
  }

  async function saveDraftAndLeave() {
    if (!leaveWarning) return;
    const href = leaveWarning.href;
    const saved = await saveDraft();
    if (!saved) return;
    dirtyRef.current = false;
    bypassNavigationRef.current = true;
    setLeaveWarning(null);
    router.push(safeCreatorExitHref(href));
  }

  function leaveWithoutSaving() {
    if (!leaveWarning) return;
    const href = leaveWarning.href;
    persistLocalAutosaveNow(false);
    bypassNavigationRef.current = true;
    setLeaveWarning(null);
    router.push(safeCreatorExitHref(href));
  }

  function openDraft(draft: PlannerDraft) {
    const loadedItems = normalizeCreatorItems(
      (draft.items || []).map((item) => ({
        ...item,
        batchDueDate: draft.batchDueDate || item.batchDueDate || "",
      })),
    );
    savedSnapshotRef.current = JSON.stringify({
      clientId: draft.clientId,
      draftName: draft.name,
      batchDueDate: draft.batchDueDate || "",
      items: loadedItems,
      manual,
      creatorMode,
      aiCount,
      startDate,
      interval,
      types,
      goals,
      themes,
      must,
      manualCount,
      aiStartingPoint,
      aiReferenceBatchId,
      aiCreativityLevel,
      aiChangeNotes,
      aiMustInclude,
      aiMustAvoid,
      aiKeepTone,
      aiKeepFormats,
      aiKeepFrequency,
      aiKeepObjectives,
      batchOwnerId: (draft as any).ownerId || (draft as any).createdById || activeUser?.id || "",
      batchOwnerName: (draft as any).ownerName || (draft as any).createdByName || activeUser?.name || "",
      collaboratorIds: Array.isArray((draft as any).collaboratorIds) ? (draft as any).collaboratorIds : [],
    });
    dirtyRef.current = false;
    clearLocalAutosave();
    setCurrentDraftId(draft.id || "");
    setDraftName(draft.name);
    setBatchDueDate(draft.batchDueDate || "");
    setClientId(draft.clientId);
    setBatchOwnerId((draft as any).ownerId || (draft as any).createdById || activeUser?.id || "");
    setBatchOwnerName((draft as any).ownerName || (draft as any).createdByName || activeUser?.name || "");
    setCollaboratorIds(Array.isArray((draft as any).collaboratorIds) ? (draft as any).collaboratorIds : []);
    setItems(loadedItems);
    setExpandedItemIndex(null);
    setAddPanelCollapsed(Boolean((draft.items || []).length));
  }

  function newDraft() {
    savedSnapshotRef.current = "";
    dirtyRef.current = false;
    clearLocalAutosave();
    setCurrentDraftId("");
    setDraftName(client?.name ? defaultBatchName(client.name) : "");
    setBatchDueDate("");
    setBatchOwnerId(activeUser?.id || "");
    setBatchOwnerName(activeUser?.name || activeUser?.email || "");
    setCollaboratorIds([]);
    setItems([]);
    setManual(emptyRequest);
    setExpandedItemIndex(null);
    setAddPanelCollapsed(false);
    setBatchConfigCollapsed(false);
    setAiReferenceBatchId("");
    setAiStartingPoint("fresh");
    setAiChangeNotes("");
    setAiMustInclude("");
    setAiMustAvoid("");
  }

  function reuseBatch(batch: RequestBatch) {
    const activeBatchItems = requests
      .filter((x) => x.batchId === batch.id)
      .filter((x) => x.status !== "eliminada")
      .sort((a, b) => (a.number || 0) - (b.number || 0));
    if (!activeBatchItems.length)
      return alert("Este lote no tiene solicitudes activas para reusar.");

    const declaredTotal = Math.max(
      Number(batch.totalRequests || 0),
      activeBatchItems.length,
    );
    const existingNumbers = new Set(
      activeBatchItems.map((item, index) => Number(item.number || index + 1)),
    );
    const missingNumbers = Array.from({ length: declaredTotal })
      .map((_, index) => index + 1)
      .filter((number) => !existingNumbers.has(number));

    const clonedItems = activeBatchItems.map((item) => {
      const {
        id: _id,
        batchId: _batchId,
        batchName: _batchName,
        ...itemWithoutPreviousBatch
      } = item;
      return {
        ...itemWithoutPreviousBatch,
        localDraftId: createLocalDraftId("reuse"),
        batchDueDate: "",
        dueDate: "",
        publishDate: "",
        status: item.requiresProduction ? "pendiente_produccion" : "lista_asignacion",
        source: "reuse",
      } as ContentRequest;
    });

    const recoveredItems = missingNumbers.map((number) =>
      recoveredReuseItem(number, declaredTotal, batch),
    );
    const nextItems = normalizeCreatorItems(
      [...clonedItems, ...recoveredItems].sort(
        (a, b) => (a.number || 0) - (b.number || 0),
      ),
    );

    setCurrentDraftId("");
    setClientId(batch.clientId);
    setDraftName(`${batch.name} · Reuso`);
    setBatchDueDate("");
    setItems(nextItems);
    setExpandedItemIndex(null);
    setAddPanelCollapsed(true);
    showFeedback(
      missingNumbers.length
        ? `Lote reutilizado con advertencia: ${activeBatchItems.length} solicitud(es) encontradas y ${missingNumbers.length} espacio(s) recuperado(s) para completar el conteo original de ${declaredTotal}. Revisa las solicitudes recuperadas antes de enviar.`
        : `Lote reutilizado correctamente: ${nextItems.length} solicitud(es).`,
      missingNumbers.length ? "info" : "success",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildFallbackAiProposal(
    index: number,
    typeList: string[],
    goalList: string[],
    themeList: string[],
    scheduleImportantDates: string[] = relevantImportantDatesForSchedule(Math.max(1, aiCount)),
  ) {
    const contentType =
      typeList[index % Math.max(typeList.length, 1)] || "Post";
    const objective =
      goalList[index % Math.max(goalList.length, 1)] || "Ventas";
    const topic =
      themeList[index % Math.max(themeList.length, 1)] || "Tema estratégico";
    const suggestedArea =
      contentType === "Foto"
        ? "Fotografía"
        : ["Reel", "TikTok"].includes(contentType)
          ? "Audiovisual"
          : "Diseño";
    const personas = client?.buyerPersonas || [];
    const persona = personas.length ? personas[index % personas.length] : null;
    const importantDates = scheduleImportantDates || [];
    const importantDate = importantDates.length
      ? importantDates[index % importantDates.length]
      : "";
    const isVideoLike = ["Reel", "TikTok", "Foto"].includes(contentType);
    const publishDate = startDate
      ? addDays(startDate, index * Math.max(1, interval))
      : "";
    const personaName = persona?.name || "audiencia general de la marca";
    const dateContext = importantDate
      ? ` Considerar como oportunidad editorial la fecha importante: ${importantDate}.`
      : "";
    const format = ["Reel", "TikTok"].includes(contentType)
      ? "Vertical 9:16"
      : contentType === "Carrusel"
        ? "Carrusel Feed"
        : "Cuadrado 1:1";
    const feed =
      contentType === "Carrusel"
        ? "Carrousel para el Feed"
        : ["Reel", "TikTok"].includes(contentType)
          ? contentType
          : "Feed";
    return hydrate(
      {
        ...emptyRequest,
        contentType,
        objective,
        topic: `${topic}${importantDate ? ` · ${importantDate}` : ""}`,
        platforms:
          contentType === "TikTok" ? ["TikTok"] : ["Instagram", "Facebook"],
        visualFormat: format,
        feedPlacement: feed,
        buyerPersonaId: persona?.id || "",
        buyerPersonaName: persona?.name || "Sin enfoque particular",
        buyerPersonaSnapshot: persona || null,
        suggestedArea,
        creativeIdea: `Crear un ${contentType.toLowerCase()} para ${client?.name || "el cliente"} enfocado en ${objective.toLowerCase()}, dirigido a ${personaName}. La pieza debe aterrizar el tema ${topic} con una situación clara, visual y fácil de ejecutar por el equipo. Debe usar el tono de marca, conectar con el contexto comercial del cliente y evitar sentirse genérica.${dateContext} El cierre debe dejar claro el siguiente paso para la audiencia y facilitar que el diseño o edición construyan una publicación lista para operar.`,
        keyMessage:
          must || `Mensaje central alineado a ${objective} para ${topic}.`,
        copyIn: `Propuesta de copy: ${topic} explicado con enfoque en ${objective.toLowerCase()} para ${personaName}. Usar un encabezado claro, desarrollo breve con beneficio concreto y cierre con CTA.`,
        copyStatus: "listo_para_revision",
        cta:
          objective === "Reservas"
            ? "Reserva por WhatsApp"
            : objective === "Tráfico"
              ? "Conoce más"
              : "Solicita información",
        requiresProduction: isVideoLike,
        materialAvailable: !isVideoLike,
        materialLinks: isVideoLike
          ? ""
          : "No requiere producción. Usar assets de marca, material existente, stock o generación IA según el brief.",
        productionNotes: isVideoLike
          ? `Producción necesaria para capturar material del tema: ${topic}. Priorizar tomas útiles para ${format}, planos de recurso, detalles del producto/servicio y cierre visual para CTA.`
         : "",
        publishDate,
      },
      "auto",
    );
  }

  async function generateAI() {
    if (!canGenerateRequests)
      return permissionAlert("generar publicaciones con IA");
    if (!client?.id) return alert("Selecciona cliente");
    if (!startDate)
      return alert(
        "Define la primera fecha para que la IA pueda generar publicaciones completas con fecha.",
      );
    if (!draftName) setDraftName(defaultBatchName(client.name));
    const typeList = split(types),
      goalList = split(goals),
      themeList = split(themes);
    const targetCount = Math.max(1, aiCount);
    const scheduleImportantDates = relevantImportantDatesForSchedule(targetCount);
    setBusy(true);
    try {
      const response = await fetch("/api/generate-content-proposals", {
        method: "POST",
        headers: await authJsonHeaders(),
        body: JSON.stringify({
          count: targetCount,
          startDate,
          interval: Math.max(1, interval),
          types: typeList,
          goals: goalList,
          themes: themeList,
          must,
          client: {
            id: client.id,
            name: client.name,
            industry: client.industry,
            brandNotes: client.brandNotes,
            brandPersonality: client.brandPersonality,
            visualStyle: client.visualStyle,
            contentPillars: client.contentPillars,
            valueProposition: client.valueProposition,
            contentAngles: client.contentAngles,
            customerPainPoints: client.customerPainPoints,
            marketScope: client.marketScope,
            marketRegion: client.marketRegion,
            primaryCity: client.primaryCity,
            serviceArea: client.serviceArea,
            offerSummary: client.offerSummary,
            localAudienceContext: client.localAudienceContext,
            brandBrain: { ...(client.brandBrain || {}), importantDates: scheduleImportantDates },
            buyerPersonas: client.buyerPersonas || [],
          },
          clientContext: clientContext(scheduleImportantDates),
          marketContext: marketContext(),
          successfulContext: successfulRequestsContext(),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.proposals))
        throw new Error(
          payload?.error || "No se pudieron generar propuestas completas.",
        );
      const proposalList = Array.isArray(payload.proposals) ? payload.proposals : [];
      const generated = Array.from({ length: targetCount }).map((_, index) => {
        const proposal = proposalList[index] || {};
        const fallback = buildFallbackAiProposal(
          index,
          typeList,
          goalList,
          themeList,
          scheduleImportantDates,
        );
        const contentType = proposal.contentType || fallback.contentType;
        const requiresProduction =
          typeof proposal.requiresProduction === "boolean"
            ? proposal.requiresProduction
            : fallback.requiresProduction;
        return hydrate(
          {
            ...emptyRequest,
            ...fallback,
            ...proposal,
            clientId: client.id!,
            clientName: client.name,
            number: items.length + index + 1,
            total: items.length + targetCount,
            contentType,
            objective: proposal.objective || fallback.objective,
            platforms:
              Array.isArray(proposal.platforms) && proposal.platforms.length
                ? proposal.platforms
                : fallback.platforms,
            visualFormat: proposal.visualFormat || fallback.visualFormat,
            feedPlacement: proposal.feedPlacement || fallback.feedPlacement,
            buyerPersonaId: proposal.buyerPersonaId || fallback.buyerPersonaId,
            buyerPersonaName:
              proposal.buyerPersonaName || fallback.buyerPersonaName,
            buyerPersonaSnapshot:
              proposal.buyerPersonaSnapshot || fallback.buyerPersonaSnapshot,
            topic: proposal.topic || fallback.topic,
            creativeIdea: proposal.creativeIdea || fallback.creativeIdea,
            keyMessage: proposal.keyMessage || fallback.keyMessage,
            copyIn: proposal.copyIn || fallback.copyIn,
            copyStatus:
              proposal.copyIn || fallback.copyIn
                ? "listo_para_revision"
                : "pendiente",
            cta: proposal.cta || fallback.cta,
            suggestedArea:
              contentType === "Foto"
                ? "Fotografía"
                : proposal.suggestedArea || fallback.suggestedArea,
            requiresProduction,
            materialAvailable: requiresProduction
              ? false
              : typeof proposal.materialAvailable === "boolean"
                ? proposal.materialAvailable
                : fallback.materialAvailable,
            materialLinks: requiresProduction
              ? ""
              : proposal.materialLinks || fallback.materialLinks,
            productionNotes:
              proposal.productionNotes ||
              (requiresProduction ? fallback.productionNotes : ""),
            publishDate: fallback.publishDate,
            source: "ai-complete",
          },
          "ai-complete",
        );
      });
      const numbered = generated.map((item: any, index: number) => ({
        ...item,
        number: items.length + index + 1,
        total: items.length + generated.length,
      }));
      setItems(normalizeCreatorItems([...items, ...numbered]));
      setExpandedItemIndex(items.length);
      setWorkspaceView("list");
      setAddPanelCollapsed(true);
      setBatchConfigCollapsed(true);
      showFeedback(`${generated.length} solicitud(es) generada(s) y agregada(s) al lote.`);
    } catch (error) {
      const generated = Array.from({ length: targetCount }).map((_, i) =>
        buildFallbackAiProposal(i, typeList, goalList, themeList, scheduleImportantDates),
      );
      const numbered = generated.map((item: any, index: number) => ({
        ...item,
        number: items.length + index + 1,
        total: items.length + generated.length,
      }));
      setItems(normalizeCreatorItems([...items, ...numbered]));
      setExpandedItemIndex(items.length);
      setWorkspaceView("list");
      setAddPanelCollapsed(true);
      setBatchConfigCollapsed(true);
      alert(
        `No se pudo completar con IA externa. Agregué propuestas completas base para no detener el flujo. Detalle: ${error instanceof Error ? error.message : "Error desconocido"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  function addManualBlankBatch(countOverride?: number) {
    if (!client?.id) return alert("Selecciona cliente");
    if (!draftName) setDraftName(defaultBatchName(client.name));

    const count = Math.max(1, Number(countOverride || manualCount || 1));
    const lastPublishDate = items[items.length - 1]?.publishDate || "";
    const firstNewDate =
      countOverride && lastPublishDate
        ? addDays(lastPublishDate, Math.max(1, interval))
        : startDate;

    if (!firstNewDate)
      return alert(
        "Define la primera fecha de publicación para crear el primer visual.",
      );

    const firstNewIndex = items.length;
    const generated = Array.from({ length: count }).map((_, index) =>
      hydrate(
        {
          ...emptyRequest,
          clientId: client.id!,
          clientName: client.name,
          number: items.length + index + 1,
          total: items.length + count,
          contentType: manual.contentType || "Post",
          objective: manual.objective || "Ventas",
          platforms: manual.platforms || [],
          visualFormat: manual.visualFormat || "",
          feedPlacement: manual.feedPlacement || "",
          suggestedArea: manual.suggestedArea || "Diseño",
          publishDate: addDays(
            firstNewDate,
            index * Math.max(1, interval),
          ),
          topic: "",
          creativeIdea: "",
          copyIn: "",
          copyOut: "",
          copyStatus: "pendiente",
          keyMessage: "",
          cta: "",
          requiresProduction: shouldStartInProduction({
            contentType: manual.contentType || "Post",
            suggestedArea: manual.suggestedArea || "Diseño",
          }),
          materialAvailable: false,
          materialLinks: "",
          source: "manual-blank",
        },
        "manual-blank",
      ),
    );

    setItems(normalizeCreatorItems([...items, ...generated]));
    setExpandedItemIndex(firstNewIndex);
    setWorkspaceView("list");
    setAddPanelCollapsed(true);
    setBatchConfigCollapsed(true);
    showFeedback(
      count === 1
        ? "Visual 1 listo para trabajar."
        : `${count} visuales en blanco agregados al lote.`,
    );
  }

  function addManual() {
    if (!client?.id) return alert("Selecciona cliente");
    if (!manual.creativeIdea && !manual.topic && !manual.copyIn)
      return alert(
        "Agrega al menos tema, idea o copy para una solicitud manual completa; para generar espacios vacíos usa Modo Manual > Crear solicitudes en blanco.",
      );
    if (!draftName) setDraftName(defaultBatchName(client.name));
    setItems(
      normalizeCreatorItems([
        ...items,
        hydrate(
          {
            ...manual,
            copyStatus: manual.copyIn?.trim()
              ? "listo_para_revision"
              : "pendiente",
          },
          "manual",
        ),
      ]),
    );
    setExpandedItemIndex(null);
    setAddPanelCollapsed(true);
    setManual(emptyRequest);
    showFeedback("Solicitud manual agregada al lote.");
  }

  function updateItem(index: number, k: keyof ContentRequest, v: any) {
    const next = [...items];
    const updated = { ...next[index], [k]: v, lastEditedById: activeUser?.id || batchOwnerId, lastEditedByName: activeUser?.name || activeUser?.email || batchOwnerName || "Content", lastEditedAt: new Date().toISOString() } as ContentRequest;
    if (
      k === "contentType" ||
      k === "publishDate" ||
      k === "requiresProduction" ||
      k === "batchDueDate"
    ) {
      const plan = getOperationalPlan(updated, costRules, clientOverrides);
      const risk = getDeliveryRisk(plan.clientDueDate, plan.deliveryDays);
      updated.clientDueDate = plan.clientDueDate;
      updated.internalDueDate = plan.internalDueDate;
      updated.productionDueDate = updated.requiresProduction
        ? plan.productionDueDate
        : "";
      updated.dueDate = plan.internalDueDate || updated.dueDate;
      updated.operationalCost = plan.totalCost;
      updated.operationalHours = plan.editingHours;
      updated.operationalWeight = 1;
      updated.operationalRisk =
        risk.tone === "bad" ? "red" : risk.tone === "mid" ? "yellow" : "green";
    }
    next[index] = updated;
    if (
      k === "copyIn" &&
      next[index].copyStatus !== "listo_para_revision" &&
      next[index].copyStatus !== "aprobado"
    ) {
      next[index].copyStatus = String(v || "").trim()
        ? "en_proceso"
        : "pendiente";
    }
    if (k === "requiresProduction") {
      next[index].status = v ? "pendiente_produccion" : "lista_asignacion";
      next[index].materialAvailable = v ? false : next[index].materialAvailable;
      if (v) {
        next[index].productionSpecificMaterialLink = "";
        next[index].productionGeneralMaterialLinks = "";
        next[index].materialDeliveredAt = "";
      }
    }
    setItems(normalizeCreatorItems(next));
  }

  function updateItemPersona(index: number, persona?: ClientBuyerPersona) {
    const next = [...items];
    next[index] = {
      ...next[index],
      buyerPersonaId: persona?.id || "",
      buyerPersonaName: persona?.name || "Sin enfoque particular",
      buyerPersonaSnapshot: persona || null,
      lastEditedById: activeUser?.id || batchOwnerId,
      lastEditedByName: activeUser?.name || activeUser?.email || batchOwnerName || "Content",
      lastEditedAt: new Date().toISOString(),
    } as ContentRequest;
    setItems(normalizeCreatorItems(next));
  }

  function removeItem(index: number) {
    if (!confirm("¿Quitar solicitud del borrador?")) return;
    setItems(normalizeCreatorItems(items.filter((_, i) => i !== index)));
    setExpandedItemIndex((current) => {
      if (current === null) return null;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
  }

  function duplicateItem(index: number) {
    const source = items[index];
    const { id: _id, ...sourceWithoutFirestoreId } = source;
    const duplicated = {
      ...sourceWithoutFirestoreId,
      localDraftId: createLocalDraftId("duplicate"),
      source: "manual",
      createdById: activeUser?.id || batchOwnerId,
      createdByName: activeUser?.name || activeUser?.email || batchOwnerName || "Content",
      createdAt: new Date().toISOString(),
      lastEditedById: activeUser?.id || batchOwnerId,
      lastEditedByName: activeUser?.name || activeUser?.email || batchOwnerName || "Content",
      lastEditedAt: new Date().toISOString(),
      number: items.length + 1,
      total: items.length + 1,
      status: initialOperationalStatus(source),
    } as ContentRequest;
    setItems(normalizeCreatorItems([...items, duplicated]));
    setExpandedItemIndex(null);
    setAddPanelCollapsed(true);
    showFeedback("Solicitud duplicada y agregada al lote.", "info");
  }

  async function uploadToManual(kind: "reference", files: FileList | null) {
    if (!canCreateRequests) return permissionAlert("subir referencias al lote");
    if (!files) return;
    setBusy(true);
    try {
      const uploaded = await uploadReferenceFiles(
        files,
        "content-request-references",
        {
          maxBytes: referenceMaxBytes,
          temporary: true,
          allowedTypes:
            /^(image\/|video\/)|\.(jpg|jpeg|png|webp|gif|heic|heif|mp4|mov|m4v|webm)$/i,
        },
      );
      setManual({
        ...manual,
        referenceFiles: [...(manual.referenceFiles || []), ...uploaded],
      });
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "No se pudo subir la referencia.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function uploadToItem(
    index: number,
    kind: "reference",
    files: FileList | null,
  ) {
    if (!canCreateRequests)
      return permissionAlert("subir referencias a solicitudes");
    if (!files) return;
    setBusy(true);
    try {
      const uploaded = await uploadReferenceFiles(
        files,
        "content-request-references",
        {
          maxBytes: referenceMaxBytes,
          temporary: true,
          allowedTypes:
            /^(image\/|video\/)|\.(jpg|jpeg|png|webp|gif|heic|heif|mp4|mov|m4v|webm)$/i,
        },
      );
      const next = [...items];
      next[index] = {
        ...next[index],
        referenceFiles: [...(next[index].referenceFiles || []), ...uploaded],
      };
      setItems(next);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "No se pudo subir la referencia.",
      );
    } finally {
      setBusy(false);
    }
  }

  function removeFileFromItem(
    index: number,
    kind: "reference",
    fileIndex: number,
  ) {
    const next = [...items];
    next[index] = {
      ...next[index],
      referenceFiles: (next[index].referenceFiles || []).filter(
        (_, i) => i !== fileIndex,
      ),
    };
    setItems(next);
  }

  function stableSubmissionKey(name: string, preparedItems: ContentRequest[]) {
    const base = [
      currentDraftId || "local-draft",
      client?.id || "no-client",
      name,
      batchDueDate,
      preparedItems.length,
      preparedItems.map((item, index) => `${item.localDraftId || item.number || index + 1}:${item.topic || item.objective || item.contentType || "post"}`).join("|")
    ].join("::");
    let hash = 0;
    for (let index = 0; index < base.length; index += 1) {
      hash = ((hash << 5) - hash + base.charCodeAt(index)) | 0;
    }
    return `batch-submit-${Math.abs(hash)}-${base.length}`;
  }

  function validateBatch(list: ContentRequest[] = items) {
    if (!list.length) {
      alert("No hay solicitudes en el lote");
      return false;
    }
    const errors = list
      .map((item, index) => ({ index, error: validateCreatorItemForCreator(item) }))
      .filter((x) => x.error);
    if (errors.length) {
      alert(
        `No se puede enviar. Solicitud ${errors[0].index + 1}: ${errors[0].error}`,
      );
      return false;
    }
    const today = todayDateKey();
    const expiredProduction = list.findIndex((item) => {
      const plan = getOperationalPlan(item, costRules, clientOverrides);
      return Boolean(
        item.requiresProduction &&
        plan.productionDueDate &&
        plan.productionDueDate < today,
      );
    });
    if (expiredProduction >= 0) {
      alert(
        `No se puede enviar. Solicitud ${expiredProduction + 1}: la fecha máxima de producción ya pasó. Mueve la fecha de publicación o cambia el contenido a material disponible.`,
      );
      return false;
    }
    return true;
  }

  async function publishBatch() {
    if (!canCreateRequests)
      return permissionAlert("aprobar lotes y enviarlos a asignación");
    if (publishingBatchRef.current || publishingBatch) return;
    if (busy) return alert("Espera a que termine la carga de referencias.");
    if (!client?.id) return alert("Selecciona cliente");
    const name = draftName || defaultBatchName(client.name);
    const collaboration = collaborationMetadata();
    if (!batchDueDate) return alert("Define la fecha límite del lote.");
    const preparedItems = prepareItemsForPersistence(items, batchDueDate).map(
      (x, i) => {
        const plan = getOperationalPlan(
          { ...x, batchDueDate },
          costRules,
          clientOverrides,
        );
        const risk = getDeliveryRisk(plan.clientDueDate, plan.deliveryDays);
        return {
          ...x,
          number: i + 1,
          total: items.length,
          batchDueDate,
          clientDueDate: plan.clientDueDate,
          internalDueDate: plan.internalDueDate,
          productionDueDate: x.requiresProduction ? plan.productionDueDate : "",
          dueDate: x.dueDate || plan.internalDueDate || batchDueDate,
          operationalCost: plan.totalCost,
          operationalHours: plan.editingHours,
          operationalWeight: 1,
          operationalRisk:
            risk.tone === "bad" || planningSummary.riskTone === "red"
              ? "red"
              : risk.tone === "mid"
                ? "yellow"
                : "green",
          forcedDate: planningSummary.riskTone === "red",
          forcedDateReason:
            planningSummary.riskTone === "red" ? forceReason : "",
          forcedDateNotes:
            planningSummary.riskTone === "red" ? forceNotes : "",
         status: x.requiresProduction ? "pendiente_produccion" : "lista_asignacion",
        } as ContentRequest;
      },
    );
    if (!validateBatch(preparedItems)) return;
    if (preparedItems.length !== items.length) {
      return alert(
        `No se puede enviar: en pantalla hay ${items.length} solicitud(es), pero se prepararon ${preparedItems.length}. Guarda borrador y vuelve a intentar.`,
      );
    }
    if (planningSummary.riskTone === "red" && !forceReason) {
      return alert(
        "La fecha no es viable con la carga o tiempos actuales. Elige una fecha viable o agrega justificación para forzarla.",
      );
    }
    const submissionKey = stableSubmissionKey(name, preparedItems);
    publishingBatchRef.current = true;
    setPublishingBatch(true);
    setBusy(true);
    try {
      const summary = await saveRequestBatch(
      {
          name,
          clientId: client.id,
          clientName: client.name,
          totalRequests: preparedItems.length,
          status: "sent_to_assignment",
          batchDueDate,
          submissionKey,
          submissionStatus: "in_progress",
          submittedAt: new Date().toISOString(),
          submittedBy: activeUser?.name || activeUser?.email || collaboration.ownerName,
          submittedById: activeUser?.id || collaboration.ownerId,
          sentByName: activeUser?.name || activeUser?.email || collaboration.ownerName,
          sentById: activeUser?.id || collaboration.ownerId,
          ...collaboration,
        } as any,
        preparedItems,
      );
      if ((summary as any).duplicate) {
        showFeedback("Este lote ya fue enviado anteriormente. No se duplicó.", "info");
        await load();
        return;
      }
      if (summary.total !== preparedItems.length) {
        alert(
          `El lote no se marcó como completado porque se esperaba guardar ${preparedItems.length} solicitud(es) y el sistema reportó ${summary.total}.`,
        );
        return;
      }
      if (currentDraftId)
        await updatePlannerDraft(currentDraftId, {
          status: "sent_to_assignment",
          batchDueDate,
          items: preparedItems,
          ...collaboration,
          sentById: activeUser?.id || collaboration.ownerId,
          sentByName: activeUser?.name || activeUser?.email || collaboration.ownerName,
          sentAt: new Date().toISOString(),
        } as any);
      savedSnapshotRef.current = "";
      dirtyRef.current = false;
      setItems([]);
      setCurrentDraftId("");
      setExpandedItemIndex(null);
      setDraftName(client?.name ? defaultBatchName(client.name) : "");
      setCollaboratorIds([]);
      setBatchOwnerId(activeUser?.id || "");
      setBatchOwnerName(activeUser?.name || activeUser?.email || "");
      setForceReason("");
      setForceNotes("");
      clearLocalAutosave();
      await load();
      showFeedback(
        `Lote enviado correctamente. ${summary.total} solicitud(es) procesadas: ${summary.productionCount} a Producción y ${summary.assignmentCount} a Asignación. 0 omitidas.`,
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? `No se pudo enviar el lote: ${error.message}`
          : "No se pudo enviar el lote.",
      );
    } finally {
      publishingBatchRef.current = false;
      setPublishingBatch(false);
      setBusy(false);
    }
  }


  async function removeDraft(id?: string) {
    if (!canDeleteDrafts) return permissionAlert("eliminar borradores");
    if (!id) return;
    const ok = window.confirm(
      "¿Seguro que quieres eliminar este borrador? Esta acción no afecta solicitudes ya enviadas.",
    );
    if (!ok) return;
    await deletePlannerDraft(id);
    if (currentDraftId === id) {
      setCurrentDraftId("");
      setItems([]);
      setExpandedItemIndex(null);
      setDraftName(client?.name ? defaultBatchName(client.name) : "");
    }
    await load();
  }

  function toggleItem(index: number) {
    setExpandedItemIndex((current) => (current === index ? null : index));
  }

  const activeBatchIds = useMemo(() => {
    return new Set(
      requests
        .filter((request) => request.status !== "eliminada")
        .map((request) => request.batchId)
        .filter(Boolean) as string[],
    );
  }, [requests]);

  const reusableBatches = useMemo(() => {
    const base = batches.filter((batch) => {
      if (client?.id && batch.clientId !== client.id) return false;
      if (["eliminada", "deleted", "archived"].includes(String(batch.status || ""))) return false;
      if (cleanupSettings.hideDeletedByDefault !== false && batch.id && !activeBatchIds.has(batch.id)) return false;
      return true;
    });
    const limit = Math.max(1, Number(cleanupSettings.reuseBatchLimit || 5));
    return showFullReuseHistory ? base : base.slice(0, limit);
  }, [batches, client?.id, cleanupSettings.hideDeletedByDefault, cleanupSettings.reuseBatchLimit, activeBatchIds, showFullReuseHistory]);

  const totalReusableBatches = useMemo(() => batches.filter((batch) => {
    if (client?.id && batch.clientId !== client.id) return false;
    if (["eliminada", "deleted", "archived"].includes(String(batch.status || ""))) return false;
    if (cleanupSettings.hideDeletedByDefault !== false && batch.id && !activeBatchIds.has(batch.id)) return false;
    return true;
  }).length, [batches, client?.id, cleanupSettings.hideDeletedByDefault, activeBatchIds]);

  const aiReferenceBatches = useMemo(
    () =>
      batches
        .filter((batch) => {
          if (!batch.id) return false;
          if (client?.id && batch.clientId !== client.id) return false;
          if (
            ["eliminada", "deleted", "archived"].includes(
              String(batch.status || ""),
            )
          )
            return false;
          return activeBatchIds.has(batch.id);
        })
        .map((batch) => {
          const batchItems = requests.filter(
            (request) =>
              request.batchId === batch.id && request.status !== "eliminada",
          );
          return {
            ...batch,
            activeItems: batchItems,
            activeCount: batchItems.length,
          };
        })
        .filter((batch) => batch.activeCount > 0)
        .sort((a, b) =>
          String((b as any).createdAt || b.batchDueDate || "").localeCompare(
            String((a as any).createdAt || a.batchDueDate || ""),
          ),
        ),
    [batches, client?.id, requests, activeBatchIds],
  );

  const aiReferenceBatch = useMemo(
    () =>
      aiReferenceBatches.find((batch) => batch.id === aiReferenceBatchId) ||
      null,
    [aiReferenceBatches, aiReferenceBatchId],
  );

  const aiReferenceItems = useMemo(
    () => aiReferenceBatch?.activeItems || [],
    [aiReferenceBatch],
  );

  const aiReferenceSummary = useMemo(() => {
    const typeCounts = new Map<string, number>();
    const objectiveCounts = new Map<string, number>();
    aiReferenceItems.forEach((item) => {
      const type = item.contentType || "Sin tipo";
      const objective = item.objective || "Sin objetivo";
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      objectiveCounts.set(objective, (objectiveCounts.get(objective) || 0) + 1);
    });
    const topEntries = (map: Map<string, number>) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([label, count]) => `${label}: ${count}`)
        .join(" · ");
    return {
      types: topEntries(typeCounts),
      objectives: topEntries(objectiveCounts),
      productionCount: aiReferenceItems.filter((item) => item.requiresProduction)
        .length,
    };
  }, [aiReferenceItems]);

  function buildAiGenerationInstructions() {
    const base: string[] = [];
    if (aiStartingPoint !== "reference" || !aiReferenceBatch) {
      if (aiMustInclude.trim())
        base.push(`Debe incluir: ${aiMustInclude.trim()}`);
      if (aiMustAvoid.trim())
        base.push(`No debe incluir: ${aiMustAvoid.trim()}`);
      if (aiChangeNotes.trim())
        base.push(`Dirección adicional: ${aiChangeNotes.trim()}`);
      return base.join("\n");
    }

    const keep = [
      aiKeepTone && "tono y estilo de comunicación",
      aiKeepFormats && "proporción y mezcla de formatos",
      aiKeepFrequency && "ritmo editorial y frecuencia",
      aiKeepObjectives && "balance de objetivos",
    ].filter(Boolean);

    const referenceRows = aiReferenceItems.slice(0, 30).map((item, index) => ({
      visual: index + 1,
      type: item.contentType,
      objective: item.objective,
      topic: item.topic,
      creativeIdea: item.creativeIdea,
      keyMessage: item.keyMessage,
      cta: item.cta,
      platforms: item.platforms,
      requiresProduction: item.requiresProduction,
    }));

    base.push(
      `Usa como referencia operativa el lote "${aiReferenceBatch.name}" del mismo cliente.`,
      `Conserva: ${keep.join(", ") || "solo el nivel general de calidad"}.`,
      `Nivel de cambio: ${
        aiCreativityLevel === "conservative"
          ? "conservador; mantener estructura y renovar temas"
          : aiCreativityLevel === "exploratory"
            ? "exploratorio; proponer ángulos y formatos notablemente nuevos"
            : "equilibrado; conservar lo que funciona sin repetir ideas"
      }.`,
      "No copies literalmente temas, ideas, mensajes, copy ni CTA del lote de referencia.",
      `Contenido del lote de referencia: ${JSON.stringify(referenceRows)}`,
    );
    if (aiChangeNotes.trim())
      base.push(`Cambios solicitados respecto al lote anterior: ${aiChangeNotes.trim()}`);
    if (aiMustInclude.trim())
      base.push(`La nueva parrilla debe incluir: ${aiMustInclude.trim()}`);
    if (aiMustAvoid.trim())
      base.push(`La nueva parrilla no debe incluir: ${aiMustAvoid.trim()}`);
    return base.join("\n");
  }

  async function hideReusableBatch(batch: RequestBatch) {
    if (!canDeleteDrafts) return permissionAlert("eliminar lote de reuso");
    if (!batch.id) return;
    const ok = window.confirm(`¿Ocultar/eliminar el lote "${batch.name}" de Lotes realizados para reusar? Sus solicitudes operativas no se borran con esta acción.`);
    if (!ok) return;
    await markRequestBatchDeleted(batch.id, "Oculto desde Lotes realizados para reusar");
    await load();
    showFeedback("Lote eliminado de la lista de reuso.");
  }

  return (
    <AppShell active="Creador de Solicitudes">
      <style jsx global>{`
        .creator-batch-config {
          margin: 20px 0 12px;
          border: 1px solid rgba(52, 58, 64, 0.14);
          border-radius: 28px;
          overflow: hidden;
          background: rgba(248, 249, 250, 0.92);
          box-shadow: 0 18px 48px rgba(52, 58, 64, 0.07);
        }
        .creator-batch-config-head {
          width: 100%;
          border: 0;
          padding: 18px 20px;
          background: linear-gradient(135deg, #ffffff, #f6fff1);
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: center;
          text-align: left;
          color: var(--brand-dark);
          cursor: pointer;
        }
        .creator-batch-config-head h2 {
          margin: 0;
          font-size: 22px;
          letter-spacing: -0.04em;
        }
        .creator-batch-config-head .eyebrow { margin-bottom: 5px; }
        .creator-batch-config-head > div > span {
          display: block;
          margin-top: 5px;
          color: #667085;
          font-size: 12px;
          font-weight: 800;
        }
        .creator-batch-config-summary {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }
        .creator-batch-config-body {
          padding: 18px 20px 20px;
          border-top: 1px solid rgba(52, 58, 64, 0.1);
          background: rgba(255, 255, 255, 0.92);
        }
        .creator-batch-fields {
          display: grid;
          grid-template-columns: minmax(190px, 0.8fr) minmax(280px, 1.35fr) minmax(210px, 0.7fr);
          gap: 14px;
          align-items: end;
        }
        .creator-batch-fields .field { margin: 0; }
        .creator-batch-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 16px;
        }
        .creator-batch-config.collapsed .creator-batch-config-head {
          padding-block: 14px;
        }

        .creator-ai-start {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .creator-ai-start button {
          border: 1px solid rgba(52, 58, 64, 0.14);
          border-radius: 20px;
          background: #fff;
          padding: 14px;
          text-align: left;
          color: var(--brand-dark);
          font-weight: 950;
          cursor: pointer;
          display: grid;
          gap: 5px;
        }
        .creator-ai-start button small {
          color: #667085;
          font-size: 12px;
          line-height: 1.4;
          font-weight: 750;
        }
        .creator-ai-start button.active {
          border-color: rgba(158, 252, 123, 0.95);
          background: linear-gradient(135deg, rgba(158, 252, 123, 0.28), #fff);
          box-shadow: 0 0 0 3px rgba(158, 252, 123, 0.18);
        }
        .creator-ai-reference,
        .creator-ai-direction {
          border: 1px solid rgba(52, 58, 64, 0.12);
          border-radius: 22px;
          background: rgba(248, 249, 250, 0.82);
          padding: 15px;
        }
        .creator-ai-reference-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 10px;
        }
        .creator-ai-reference-summary > div {
          border: 1px solid rgba(52, 58, 64, 0.1);
          border-radius: 16px;
          background: #fff;
          padding: 11px;
          min-width: 0;
        }
        .creator-ai-reference-summary span {
          display: block;
          color: #667085;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .creator-ai-reference-summary strong {
          display: block;
          margin-top: 5px;
          font-size: 12px;
          line-height: 1.35;
        }
        .creator-ai-direction {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .creator-inline-label {
          display: block;
          margin-bottom: 9px;
          color: #667085;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .creator-ai-direction .full { grid-column: 1 / -1; }
        .creator-primary-action {
          width: 100%;
          min-height: 50px;
        }

        .creator-workspace-card { padding: 0 !important; overflow: hidden; }
        .creator-workspace-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 17px 18px;
          border-bottom: 1px solid rgba(52, 58, 64, 0.1);
          background: linear-gradient(180deg, #fff, #f8fafc);
        }
        .creator-workspace-head h3 { margin: 0; }
        .creator-workspace-head .eyebrow { margin-bottom: 4px; }
        .creator-workspace-head-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }
        .creator-view-switch {
          display: flex;
          gap: 5px;
          padding: 4px;
          border: 1px solid rgba(52, 58, 64, 0.14);
          border-radius: 999px;
          background: #f3f4f6;
        }
        .creator-view-switch button {
          border: 0;
          border-radius: 999px;
          background: transparent;
          padding: 9px 12px;
          color: #667085;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }
        .creator-view-switch button.active {
          background: var(--brand-dark);
          color: #fff;
          box-shadow: 0 8px 18px rgba(52, 58, 64, 0.14);
        }
        .creator-empty-workspace { margin: 18px; }
        .creator-workspace {
          display: grid;
          min-height: 520px;
        }
        .creator-workspace-list {
          grid-template-columns: 260px minmax(0, 1fr);
        }
        .creator-workspace-accordion {
          grid-template-columns: 1fr;
        }
        .creator-visual-list {
          min-width: 0;
          padding: 12px;
          border-right: 1px solid rgba(52, 58, 64, 0.1);
          background: rgba(237, 234, 230, 0.48);
          max-height: calc(100vh - 210px);
          overflow-y: auto;
        }
        .creator-visual-list-head {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
          padding: 4px 4px 10px;
        }
        .creator-visual-list-item {
          width: 100%;
          border: 1px solid rgba(52, 58, 64, 0.1);
          border-radius: 17px;
          background: #fff;
          padding: 10px;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) 26px;
          gap: 9px;
          align-items: center;
          text-align: left;
          color: var(--brand-dark);
          cursor: pointer;
          margin-bottom: 8px;
        }
        .creator-visual-list-item.active {
          border-color: rgba(158, 252, 123, 0.95);
          background: linear-gradient(135deg, rgba(158, 252, 123, 0.3), #fff);
          box-shadow: 0 10px 24px rgba(52, 58, 64, 0.08);
        }
        .creator-visual-number {
          width: 31px;
          height: 31px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: var(--brand-dark);
          color: #fff;
          font-size: 12px;
          font-weight: 950;
        }
        .creator-visual-list-copy {
          min-width: 0;
          display: grid;
          gap: 3px;
        }
        .creator-visual-list-copy strong,
        .creator-visual-list-copy small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .creator-visual-list-copy strong { font-size: 12.5px; }
        .creator-visual-list-copy small {
          color: #667085;
          font-size: 10.5px;
          font-weight: 750;
        }
        .creator-visual-status {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 950;
        }
        .creator-visual-status.ready {
          background: rgba(158, 252, 123, 0.4);
          color: #315425;
        }
        .creator-visual-status.pending {
          background: #fff1f2;
          color: #b42318;
        }
        .creator-workspace-editor {
          min-width: 0;
          padding: 14px;
          overflow: visible;
        }
        .creator-workspace-editor .creator-accordion-list { margin-top: 0; }
        .creator-workspace-list .creator-accordion-card {
          box-shadow: none;
          border-radius: 20px;
        }
        .creator-workspace-list .creator-accordion-summary {
          cursor: default;
        }

        .creator-sidebar-section {
          border: 1px solid rgba(52, 58, 64, 0.13);
          border-radius: 22px;
          background: rgba(248, 249, 250, 0.9);
          overflow: hidden;
          box-shadow: 0 12px 32px rgba(52, 58, 64, 0.06);
        }
        .creator-sidebar-section > summary {
          list-style: none;
          cursor: pointer;
          padding: 13px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: var(--brand-dark);
          font-size: 13px;
          font-weight: 950;
          background: linear-gradient(180deg, #fff, #f8fafc);
        }
        .creator-sidebar-section > summary::-webkit-details-marker {
          display: none;
        }
        .creator-sidebar-section > summary::after {
          content: "＋";
          color: #667085;
          font-size: 16px;
        }
        .creator-sidebar-section[open] > summary::after { content: "−"; }
        .creator-sidebar-section > summary small {
          margin-left: auto;
          color: #667085;
          font-size: 10px;
          font-weight: 850;
        }
        .creator-sidebar-section-body {
          border-top: 1px solid rgba(52, 58, 64, 0.09);
          padding: 10px;
          background: rgba(255, 255, 255, 0.74);
        }
        .creator-sidebar-section-body > .card {
          padding: 12px !important;
          border: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
        }
        .creator-sidebar-section-body .planning-summary-card {
          padding: 12px !important;
          border: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
        }

        .creator-collaboration-panel, .creator-file-tools { margin-top:14px; border:1px solid rgba(52,58,64,.12); border-radius:22px; background:rgba(248,249,250,.78); padding:15px; }
        .creator-collaboration-head, .creator-file-tools { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
        .creator-collaboration-head strong, .creator-file-tools strong { display:block; color:var(--brand-dark); }
        .creator-collaboration-head span:not(.pill), .creator-file-tools span { display:block; margin-top:4px; color:#667085; font-size:12px; line-height:1.45; font-weight:750; }
        .creator-collaborator-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:9px; margin-top:12px; }
        .creator-collaborator { border:1px solid rgba(52,58,64,.12); border-radius:17px; background:#fff; padding:11px 12px; display:grid; gap:3px; text-align:left; color:var(--brand-dark); cursor:pointer; }
        .creator-collaborator strong { font-size:13px; } .creator-collaborator span { color:#667085; font-size:11px; font-weight:750; }
        .creator-collaborator.selected { border-color:rgba(158,252,123,.95); background:linear-gradient(135deg,rgba(158,252,123,.34),#fff); box-shadow:0 0 0 3px rgba(158,252,123,.16); }
        .creator-file-actions { display:flex; justify-content:flex-end; gap:9px; flex-wrap:wrap; }
        .creator-csv-preview { display:grid; gap:14px; }
        .creator-csv-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
        .creator-csv-summary > div { border:1px solid var(--line); border-radius:16px; padding:12px; background:#fff; }
        .creator-csv-summary span { display:block; color:#667085; font-size:10px; font-weight:900; text-transform:uppercase; }
        .creator-csv-summary strong { display:block; margin-top:5px; font-size:22px; }
        .creator-csv-errors { max-height:220px; overflow:auto; border:1px solid #fecaca; background:#fff1f2; border-radius:16px; padding:12px; color:#991b1b; font-size:12px; line-height:1.5; }

        @media (max-width: 1180px) {
          .creator-batch-fields { grid-template-columns: 1fr 1fr; }
          .creator-batch-fields .field:nth-child(2) { grid-column: 1 / -1; }
          .creator-ai-reference-summary { grid-template-columns: 1fr 1fr; }
          .creator-workspace-list { grid-template-columns: 220px minmax(0, 1fr); }
          .creator-visual-list { max-height: none; }
        }
        @media (max-width: 860px) {
          .creator-batch-config-head,
          .creator-ai-start,
          .creator-ai-direction,
          .creator-workspace-list {
            grid-template-columns: 1fr;
          }
          .creator-batch-config-summary,
          .creator-batch-actions,
          .creator-workspace-head-actions {
            justify-content: flex-start;
          }
          .creator-batch-fields { grid-template-columns: 1fr; }
          .creator-batch-fields .field:nth-child(2) { grid-column: auto; }
          .creator-collaboration-head, .creator-file-tools { flex-direction:column; }
          .creator-file-actions { justify-content:flex-start; }
          .creator-csv-summary { grid-template-columns:1fr; }
          .creator-workspace-head {
            align-items: flex-start;
            flex-direction: column;
          }
          .creator-visual-list {
            border-right: 0;
            border-bottom: 1px solid rgba(52, 58, 64, 0.1);
            display: flex;
            gap: 8px;
            overflow-x: auto;
          }
          .creator-visual-list-head { min-width: 130px; }
          .creator-visual-list-item {
            min-width: 220px;
            margin-bottom: 0;
          }
          .creator-ai-reference-summary { grid-template-columns: 1fr; }
        }
      `}</style>
      <div className="page-title">
        <p className="eyebrow">Content</p>
        <h1>Creador de Solicitudes</h1>
        <p>
          Content crea lotes completos. La fecha límite del lote es la entrega
          operativa; cada pieza mantiene su fecha de publicación.
        </p>
      </div>

      <section
        className={`creator-batch-config ${batchConfigCollapsed ? "collapsed" : "open"}`}
      >
        <button
          type="button"
          className="creator-batch-config-head"
          onClick={() => setBatchConfigCollapsed((value) => !value)}
          aria-expanded={!batchConfigCollapsed}
        >
          <div>
            <p className="eyebrow">Configuración del lote</p>
            <h2>{draftName || "Nuevo lote de contenido"}</h2>
            <span>
              {client?.name || "Sin cliente"} ·{" "}
              {currentDraftId
                ? `Borrador #${currentDraftId.slice(0, 7).toUpperCase()}`
                : "Sin guardar todavía"}
            </span>
          </div>
          <div className="creator-batch-config-summary">
            <span className="pill">{items.length} visuales</span>
            <span className="pill">{collaboratorIds.length} colaboradores</span>
            <span className="pill">
              {batchDueDate ? `Límite ${batchDueDate}` : "Sin fecha límite"}
            </span>
            <span
              className={
                operationalSummary.riskTone === "red"
                  ? "pill red"
                  : "pill green"
              }
            >
              {operationalSummary.riskLabel}
            </span>
            <span className="summary-chevron">
              {batchConfigCollapsed ? "Configurar" : "Minimizar"}
            </span>
          </div>
        </button>

        {!batchConfigCollapsed && (
          <div className="creator-batch-config-body">
            <div className="creator-batch-fields">
              <div className="field">
                <label>Cliente</label>
                <select
                  value={clientId}
                  onChange={(event) => handleClientChange(event.target.value)}
                >
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Nombre del lote</label>
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="Parrilla Cliente Mes Año"
                />
              </div>
              <div className="field">
                <label>Fecha límite operativa</label>
                <input
                  type="date"
                  value={batchDueDate}
                  onChange={(event) =>
                    setBusinessDate(
                      setBatchDueDate,
                      event.target.value,
                      "fecha límite del lote",
                    )
                  }
                />
              </div>
            </div>

            <div className="creator-collaboration-panel">
              <div className="creator-collaboration-head">
                <div>
                  <p className="eyebrow">Colaboración del lote</p>
                  <strong>Responsable: {batchOwnerName || activeUser?.name || "Content"}</strong>
                  <span>Los colaboradores seleccionados pueden abrir y editar este mismo borrador. Se conserva el autor y el último editor de cada visual; evita editar el mismo visual al mismo tiempo en esta versión.</span>
                </div>
                <span className="pill">{collaboratorIds.length} colaboradores</span>
              </div>
              <div className="creator-collaborator-grid">
                {eligibleCollaborators.map((user) => (
                  <button type="button" key={user.id} className={collaboratorIds.includes(user.id || "") ? "creator-collaborator selected" : "creator-collaborator"} onClick={() => user.id && toggleCollaborator(user.id)}>
                    <strong>{user.name}</strong>
                    <span>{user.jobTitle || user.roleLabel || "Content Manager"}</span>
                  </button>
                ))}
                {!eligibleCollaborators.length && <p className="mini">No hay otros usuarios de Content activos para agregar.</p>}
              </div>
            </div>

            <div className="creator-file-tools">
              <div>
                <strong>Respaldo en Excel</strong>
                <span>Exporta o importa CSV compatible con Excel. La importación solo agrega visuales nuevos y nunca reemplaza los existentes.</span>
              </div>
              <div className="creator-file-actions">
                <button className="btn" type="button" onClick={downloadBatchCsv}>{items.length ? "Exportar lote CSV" : "Descargar plantilla CSV"}</button>
                <button className="btn" type="button" onClick={() => csvInputRef.current?.click()} disabled={!client?.id}>Importar CSV</button>
                <input ref={csvInputRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => previewCsvImport(event.target.files?.[0])} />
              </div>
            </div>

            <div className="creator-batch-actions">
              <button
                className="btn"
                type="button"
                onClick={saveDraft}
                disabled={busy || !canCreateRequests}
              >
                {busy && !publishingBatch ? "Guardando..." : "Guardar borrador"}
              </button>
              <button
                className="btn dark"
                type="button"
                onClick={publishBatch}
                disabled={
                  busy ||
                  publishingBatch ||
                  !canCreateRequests ||
                  !items.length
                }
              >
                {publishingBatch
                  ? "Enviando lote..."
                  : "Revisar y enviar a Asignación"}
              </button>
              <button
                className="btn red"
                type="button"
                onClick={newDraft}
                disabled={busy || !canCreateRequests}
              >
                Nuevo lote
              </button>
            </div>
          </div>
        )}
      </section>

      <div
        className="mini"
        style={{
          margin: "-8px 0 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ color: "#166534" }}>
          {autosaveAt
            ? `✓ Autoguardado local ${new Date(autosaveAt).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}`
            : hasMeaningfulCreatorWork()
              ? "Autoguardado local pendiente..."
              : "Autoguardado local listo"}
        </strong>
        <span>Se actualiza 700 ms después del último cambio.</span>
      </div>

      <div
        className={`operational-alert ${operationalSummary.riskTone === "red" ? "risk" : "ok"}`}
      >
        {operationalSummary.riskTone === "red"
          ? `Fecha en riesgo: ${operationalSummary.riskReason}`
          : "La solicitud cabe con los tiempos y capacidad configurada."}
        <span>
          {" "}
          Configura costos, tiempos y capacidad diaria en Configuración.
        </span>
      </div>

      {localRecovery && (
        <div className="inline-feedback info" style={{ alignItems: "center" }}>
          <strong>Autoguardado</strong>
          <span>
            Encontré un borrador local de {localRecovery.savedAt ? new Date(localRecovery.savedAt).toLocaleString("es-MX") : "una sesión anterior"}.
          </span>
          <button className="btn blue" type="button" onClick={restoreLocalAutosave}>
            Restaurar
          </button>
          <button className="btn" type="button" onClick={clearLocalAutosave}>
            Descartar
          </button>
        </div>
      )}

      {feedback && (
        <>
          <div className={`inline-feedback ${feedback.type}`}>
            <strong>{feedback.type === "success" ? "Listo" : "Actualizado"}</strong>
            <span>{feedback.message}</span>
          </div>
          <div className={`toast-feedback ${feedback.type}`} role="status" aria-live="polite">
            <strong>{feedback.type === "success" ? "Listo" : "Actualizado"}</strong>
            <span>{feedback.message}</span>
          </div>
        </>
      )}

      <section className="grid two-col creator-layout">
        <div className="grid">
          <div
            className={`card creator-add-card ${addPanelCollapsed && items.length ? "is-collapsed" : "is-open"}`}
          >
            <button
              type="button"
              className="creator-add-toggle"
              onClick={() =>
                items.length
                  ? setAddPanelCollapsed(!addPanelCollapsed)
                  : setAddPanelCollapsed(false)
              }
              aria-expanded={!(addPanelCollapsed && items.length)}
            >
              <div className="creator-add-title">
                <p className="eyebrow">Solicitudes</p>
                <h3>Agregar solicitudes</h3>
                <span>
                  {items.length
                    ? "Panel minimizado para trabajar el lote sin scroll innecesario."
                    : "Configura el cliente, modo y fechas para armar el lote."}
                </span>
              </div>
              <div className="creator-add-summary">
                <span className="pill">
                  {creatorMode === "ia" ? "Modo IA" : "Modo Manual"}
                </span>
                <span className="pill green">{items.length} en lote</span>
                {startDate && <span className="pill">Inicio {startDate}</span>}
                <span className="summary-chevron">
                  {items.length
                    ? addPanelCollapsed
                      ? "Editar generación"
                      : "Minimizar"
                    : "Configurar"}
                </span>
              </div>
            </button>
            {!(addPanelCollapsed && items.length) && (
              <div className="creator-add-body">
                <div
                  className="creator-mode-tabs"
                  role="tablist"
                  aria-label="Modo de creación"
                >
                  <button
                    type="button"
                    className={creatorMode === "ia" ? "active" : ""}
                    onClick={() => setCreatorMode("ia")}
                  >
                    Modo IA
                  </button>
                  <button
                    type="button"
                    className={creatorMode === "manual" ? "active" : ""}
                    onClick={() => setCreatorMode("manual")}
                  >
                    Modo Manual
                  </button>
                </div>

                {creatorMode === "ia" ? (
                  <div className="creator-mode-panel">
                    <div className="mode-intro">
                      <strong>Modo IA guiado</strong>
                      <span>
                        Crea desde cero o toma como referencia una parrilla
                        anterior del mismo cliente sin repetir contenidos.
                      </span>
                    </div>

                    <div className="creator-ai-start">
                      <button
                        type="button"
                        className={aiStartingPoint === "fresh" ? "active" : ""}
                        onClick={() => {
                          setAiStartingPoint("fresh");
                          setAiReferenceBatchId("");
                        }}
                      >
                        Crear desde cero
                        <small>Brand Brain, buyer personas y reglas actuales.</small>
                      </button>
                      <button
                        type="button"
                        className={
                          aiStartingPoint === "reference" ? "active" : ""
                        }
                        onClick={() => setAiStartingPoint("reference")}
                      >
                        Inspirarme en un lote anterior
                        <small>
                          Conserva estructura y estilo, pero genera ideas nuevas.
                        </small>
                      </button>
                    </div>

                    {aiStartingPoint === "reference" && (
                      <div className="creator-ai-reference">
                        <div className="field">
                          <label>Parrilla de referencia</label>
                          <select
                            value={aiReferenceBatchId}
                            onChange={(event) =>
                              setAiReferenceBatchId(event.target.value)
                            }
                          >
                            <option value="">Seleccionar lote realizado</option>
                            {aiReferenceBatches.map((batch) => (
                              <option key={batch.id} value={batch.id}>
                                {batch.name} · {batch.activeCount} visuales
                              </option>
                            ))}
                          </select>
                        </div>

                        {aiReferenceBatch && (
                          <div className="creator-ai-reference-summary">
                            <div>
                              <span>Lote elegido</span>
                              <strong>{aiReferenceBatch.name}</strong>
                            </div>
                            <div>
                              <span>Formatos</span>
                              <strong>
                                {aiReferenceSummary.types || "Sin información"}
                              </strong>
                            </div>
                            <div>
                              <span>Objetivos</span>
                              <strong>
                                {aiReferenceSummary.objectives ||
                                  "Sin información"}
                              </strong>
                            </div>
                            <div>
                              <span>Producción</span>
                              <strong>
                                {aiReferenceSummary.productionCount} de{" "}
                                {aiReferenceItems.length} visuales
                              </strong>
                            </div>
                          </div>
                        )}

                        {!aiReferenceBatches.length && (
                          <p className="mini">
                            Este cliente todavía no tiene lotes realizados
                            disponibles como referencia.
                          </p>
                        )}
                      </div>
                    )}

                    {aiStartingPoint === "reference" && (
                      <div className="creator-ai-direction">
                        <div>
                          <label className="creator-inline-label">Qué conservar del lote anterior</label>
                          <div className="chip-group">
                            <button type="button" className={aiKeepTone ? "chip-btn selected" : "chip-btn"} onClick={() => setAiKeepTone((value) => !value)}>Tono</button>
                            <button type="button" className={aiKeepFormats ? "chip-btn selected" : "chip-btn"} onClick={() => setAiKeepFormats((value) => !value)}>Formatos</button>
                            <button type="button" className={aiKeepFrequency ? "chip-btn selected" : "chip-btn"} onClick={() => setAiKeepFrequency((value) => !value)}>Frecuencia</button>
                            <button type="button" className={aiKeepObjectives ? "chip-btn selected" : "chip-btn"} onClick={() => setAiKeepObjectives((value) => !value)}>Objetivos</button>
                          </div>
                        </div>
                        <div className="field">
                          <label>Qué tan diferente debe ser</label>
                          <select value={aiCreativityLevel} onChange={(event) => setAiCreativityLevel(event.target.value as "conservative" | "balanced" | "exploratory")}>
                            <option value="conservative">Conservador · misma estructura</option>
                            <option value="balanced">Equilibrado · conserva y renueva</option>
                            <option value="exploratory">Exploratorio · nuevas rutas creativas</option>
                          </select>
                        </div>
                        <div className="field full">
                          <label>Qué quieres modificar respecto al lote anterior</label>
                          <textarea value={aiChangeNotes} onChange={(event) => setAiChangeNotes(event.target.value)} placeholder="Ej. Mantener el tono y la proporción de Reels, pero dar más peso a experiencia, producto nuevo y contenido compartible." />
                        </div>
                      </div>
                    )}

                    <div className="creator-ai-direction">
                      <div className="field">
                        <label>Esta parrilla debe incluir</label>
                        <textarea value={aiMustInclude} onChange={(event) => setAiMustInclude(event.target.value)} placeholder="Productos, campañas, promociones o temas obligatorios." />
                      </div>
                      <div className="field">
                        <label>Esta parrilla no debe incluir</label>
                        <textarea value={aiMustAvoid} onChange={(event) => setAiMustAvoid(event.target.value)} placeholder="Temas repetidos, productos, promociones o enfoques a evitar." />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="field">
                        <label>Cuántos visuales</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={aiCount}
                          onChange={(event) =>
                            setAiCount(Number(event.target.value))
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Primera fecha de publicación</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(event) => {
                            const nextDate = event.target.value;
                            if (client?.name && isAutoBatchName(draftName)) setDraftName(defaultBatchName(client.name, nextDate));
                            setStartDate(nextDate);
                          }}
                        />
                        <p className="mini field-note">
                          Puede ser sábado o domingo.
                        </p>
                      </div>
                      <div className="field">
                        <label>Cada cuántos días</label>
                        <input
                          type="number"
                          min="1"
                          value={interval}
                          onChange={(event) =>
                            setInterval(Number(event.target.value))
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Tipos permitidos</label>
                        <input
                          value={types}
                          onChange={(event) => setTypes(event.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Objetivos</label>
                        <input
                          value={goals}
                          onChange={(event) => setGoals(event.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Temas base</label>
                        <input
                          value={themes}
                          onChange={(event) => setThemes(event.target.value)}
                        />
                      </div>
                      <div className="field full">
                        <label>Reglas generales obligatorias</label>
                        <textarea
                          value={must}
                          onChange={(event) => setMust(event.target.value)}
                        />
                      </div>
                    </div>

                    <button
                      className="btn dark creator-primary-action"
                      onClick={generateAI}
                      disabled={
                        busy ||
                        !canGenerateRequests ||
                        (aiStartingPoint === "reference" &&
                          !aiReferenceBatchId)
                      }
                    >
                      {busy
                        ? "Generando propuestas..."
                        : aiStartingPoint === "reference"
                          ? "Generar nueva parrilla con esta referencia"
                          : "Generar propuestas con IA"}
                    </button>
                  </div>
                ) : (
                  <div className="creator-mode-panel">
                    <div className="mode-intro">
                      <strong>Modo Manual</strong>
                      <span>
                        Primero crea la cantidad de visuales. Después trabaja uno
                        por uno en el espacio del lote.
                      </span>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>Cuántos visuales quieres iniciar</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={manualCount}
                          onChange={(event) =>
                            setManualCount(
                              Math.max(1, Number(event.target.value || 1)),
                            )
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Primera fecha de publicación</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(event) => {
                            const nextDate = event.target.value;
                            if (client?.name && isAutoBatchName(draftName)) setDraftName(defaultBatchName(client.name, nextDate));
                            setStartDate(nextDate);
                          }}
                        />
                        <p className="mini field-note">
                          La publicación puede caer en sábado o domingo.
                        </p>
                      </div>
                      <div className="field">
                        <label>Cada cuántos días</label>
                        <input
                          type="number"
                          min="1"
                          value={interval}
                          onChange={(event) =>
                            setInterval(Number(event.target.value))
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Formato base</label>
                        <select
                          value={manual.contentType}
                          onChange={(event) =>
                            setManualField("contentType", event.target.value)
                          }
                        >
                          {contentTypes.map((type) => (
                            <option key={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Objetivo base</label>
                        <select
                          value={manual.objective}
                          onChange={(event) =>
                            setManualField("objective", event.target.value)
                          }
                        >
                          {objectives.map((objective) => (
                            <option key={objective}>{objective}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Área base</label>
                        <select
                          value={manual.suggestedArea}
                          onChange={(event) =>
                            setManualField("suggestedArea", event.target.value)
                          }
                        >
                          {creatorAreas.map((area) => (
                            <option key={area}>{area}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      className="btn dark creator-primary-action"
                      onClick={() => addManualBlankBatch()}
                      disabled={!canCreateRequests}
                    >
                      {manualCount === 1
                        ? "Crear Visual 1 y empezar"
                        : `Crear ${manualCount} visuales y empezar`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card creator-workspace-card">
            <div className="creator-workspace-head">
              <div>
                <p className="eyebrow">Espacio de trabajo</p>
                <h3>Lote actual</h3>
                <span className="mini">
                  Selecciona una vista y trabaja un visual a la vez.
                </span>
              </div>
              <div className="creator-workspace-head-actions">
                <div className="creator-view-switch" role="tablist">
                  <button
                    type="button"
                    className={workspaceView === "list" ? "active" : ""}
                    onClick={() => setWorkspaceView("list")}
                  >
                    Lista lateral
                  </button>
                  <button
                    type="button"
                    className={workspaceView === "accordion" ? "active" : ""}
                    onClick={() => setWorkspaceView("accordion")}
                  >
                    Acordeón
                  </button>
                </div>
                <button
                  className="btn"
                  type="button"
                  onClick={() => addManualBlankBatch(1)}
                  disabled={!canCreateRequests}
                >
                  + Agregar visual
                </button>
              </div>
            </div>
            {!items.length ? (
              <div className="empty creator-empty-workspace">
                Primero configura Modo Manual o Modo IA para crear tu primer
                visual.
              </div>
            ) : (
              <div className={`creator-workspace creator-workspace-${workspaceView}`}>
                {workspaceView === "list" && (
                  <aside className="creator-visual-list">
                    <div className="creator-visual-list-head">
                      <strong>{items.length} visuales</strong>
                      <span className="mini">
                        {items.filter((item) => !validateCreatorItemForCreator(item)).length} listos
                      </span>
                    </div>
                    {items.map((item, index) => {
                      const itemError = validateCreatorItemForCreator(item);
                      return (
                        <button
                          type="button"
                          key={item.localDraftId || index}
                          className={
                            expandedItemIndex === index
                              ? "creator-visual-list-item active"
                              : "creator-visual-list-item"
                          }
                          onClick={() => setExpandedItemIndex(index)}
                        >
                          <span className="creator-visual-number">
                            {index + 1}
                          </span>
                          <span className="creator-visual-list-copy">
                            <strong>
                              {item.topic ||
                                item.contentType ||
                                `Visual ${index + 1}`}
                            </strong>
                            <small>
                              {item.contentType || "Sin tipo"} ·{" "}
                              {item.publishDate || "Sin fecha"}
                            </small>
                          </span>
                          <span
                            className={
                              itemError
                                ? "creator-visual-status pending"
                                : "creator-visual-status ready"
                            }
                            title={itemError || "Visual completo"}
                          >
                            {itemError ? "!" : "✓"}
                          </span>
                        </button>
                      );
                    })}
                  </aside>
                )}
                <div className="creator-workspace-editor">
                  <div className="creator-accordion-list">
                {items
                  .map((item, index) => ({ item, index }))
                  .filter(
                    ({ index }) =>
                      workspaceView === "accordion" ||
                      index === (expandedItemIndex ?? 0),
                  )
                  .map(({ item, index }) => {
                  const error = validateCreatorItemForCreator(item);
                  const expanded =
                    workspaceView === "list" || expandedItemIndex === index;
                  return (
                    <div
                      className={`creator-accordion-card ${expanded ? "expanded" : "collapsed"}`}
                      key={index}
                    >
                      <button
                        type="button"
                        className="creator-accordion-summary"
                        onClick={() =>
                          workspaceView === "accordion"
                            ? toggleItem(index)
                            : setExpandedItemIndex(index)
                        }
                        aria-expanded={expanded}
                      >
                        <div className="summary-main">
                          <span className="request-index-pill">
                            Visual {index + 1} de {items.length}
                          </span>
                          <strong>
                            {item.topic ||
                              item.contentType ||
                              "Nueva solicitud"}
                          </strong>
                          <span className="summary-muted">
                            {item.contentType || "Sin tipo"} ·{" "}
                            {item.objective || "Sin objetivo"}
                          </span>
                          <span className="summary-muted">
                            Autor: {(item as any).createdByName || batchOwnerName || "Content"} · Última edición: {(item as any).lastEditedByName || (item as any).createdByName || batchOwnerName || "Content"}
                          </span>
                        </div>
                        <div className="summary-meta">
                          <span>{item.suggestedArea || "Sin área"}</span>
                          <span>{item.publishDate || "Sin fecha"}</span>
                          {item.requiresProduction ? (
                            <span>Producción</span>
                          ) : (
                            <span>
                              {item.materialAvailable
                                ? "Material listo"
                                : "Sin material"}
                            </span>
                          )}
                          <span
                            className={
                              briefCompleteness(item) >= 80
                                ? "pill green"
                                : briefCompleteness(item) >= 60
                                  ? "pill yellow"
                                  : "pill red"
                            }
                          >
                            Brief {briefCompleteness(item)}/100
                          </span>
                          {error ? (
                            <span className="pill red">Pendiente</span>
                          ) : (
                            <span className="pill green">Lista</span>
                          )}
                          <span className="summary-chevron">
                            {workspaceView === "list"
                              ? "Editando"
                              : expanded
                                ? "Ocultar"
                                : "Editar"}
                          </span>
                        </div>
                      </button>
                      {expanded && (
                        <div className="creator-accordion-body">
                          <section className="creator-section creator-section-core">
                            <div className="section-title">
                              <strong>Información base</strong>
                              <span>Define tipo, objetivo, área y fecha.</span>
                            </div>
                            <div className="creator-compact-grid">
                              <div className="field">
                                <label>Tipo</label>
                                <select
                                  value={item.contentType}
                                  onChange={(e) =>
                                    updateItem(
                                      index,
                                      "contentType",
                                      e.target.value,
                                    )
                                  }
                                >
                                  {contentTypes.map((x) => (
                                    <option key={x}>{x}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field">
                                <label>Objetivo</label>
                                <select
                                  value={item.objective}
                                  onChange={(e) =>
                                    updateItem(
                                      index,
                                      "objective",
                                      e.target.value,
                                    )
                                  }
                                >
                                  {objectives.map((x) => (
                                    <option key={x}>{x}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field">
                                <label>Área sugerida</label>
                                <select
                                  value={item.suggestedArea}
                                  onChange={(e) =>
                                    updateItem(
                                      index,
                                      "suggestedArea",
                                      e.target.value,
                                    )
                                  }
                                >
                                  {creatorAreas.map((x) => (
                                    <option key={x}>{x}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field">
                                <label>Fecha publicación</label>
                                <input
                                  type="date"
                                  value={item.publishDate}
                                  onChange={(e) =>
                                    updateItem(
                                      index,
                                      "publishDate",
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                              <div className="field full">
                                <label>Tema / publicación</label>
                                <input
                                  value={item.topic}
                                  onChange={(e) =>
                                    updateItem(index, "topic", e.target.value)
                                  }
                                  placeholder="Ej. Promoción julio, testimonio, producto estrella"
                                />
                              </div>
                            </div>
                            <BuyerPersonaSelector
                              request={item}
                              buyerPersonas={client?.buyerPersonas || []}
                              onSelect={(persona) =>
                                updateItemPersona(index, persona)
                              }
                            />
                            <PostInfoSelector
                              request={item}
                              onChange={(k, v) => updateItem(index, k, v)}
                            />
                            <BriefScoreCard request={item} />
                          </section>

                          <section className="creator-section">
                            <div className="section-title">
                              <strong>Idea y copy</strong>
                              <span>Información para ejecución creativa.</span>
                            </div>
                            <CreativeIdeaField
                              value={item.creativeIdea}
                              onChange={(v) =>
                                updateItem(index, "creativeIdea", v)
                              }
                              onImprove={() => improveCreativeIdea(index)}
                              busy={improvingKey === String(index)}
                            />
                            <div className="creator-compact-grid">
                              <div className="field">
                                <label>Mensaje clave</label>
                                <input
                                  value={item.keyMessage}
                                  onChange={(e) =>
                                    updateItem(
                                      index,
                                      "keyMessage",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Qué debe quedar claro"
                                />
                              </div>
                              <div className="field">
                                <label>CTA</label>
                                <input
                                  value={item.cta}
                                  onChange={(e) =>
                                    updateItem(index, "cta", e.target.value)
                                  }
                                  placeholder="Ej. Solicita información"
                                />
                              </div>
                            </div>
                            <div className="field">
                              <label>Copy In{isPhotographyOnly(item) ? " (opcional para Fotografía)" : ""}</label>
                              <textarea
                                value={item.copyIn}
                                onChange={(e) =>
                                  updateItem(index, "copyIn", e.target.value)
                                }
                              />
                            </div>
                            <OperationalEstimate
                              item={item}
                              rules={costRules}
                              overrides={clientOverrides}
                            />
                          </section>

                          <section className="creator-section">
                            <div className="section-title">
                              <strong>Material y referencias</strong>
                              <span>
                                Material final por link; referencias temporales
                                pueden ser imagen o video.
                              </span>
                            </div>
                            <div className="creator-material-grid">
                              <div>
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={item.requiresProduction}
                                    onChange={(e) =>
                                      updateItem(
                                        index,
                                        "requiresProduction",
                                        e.target.checked,
                                      )
                                    }
                                  />{" "}
                                  Requiere producción
                                </label>
                                {!item.requiresProduction && (
                                  <label className="check-row">
                                    <input
                                      type="checkbox"
                                      checked={item.materialAvailable}
                                      onChange={(e) =>
                                        updateItem(
                                          index,
                                          "materialAvailable",
                                          e.target.checked,
                                        )
                                      }
                                    />{" "}
                                    Material disponible
                                  </label>
                                )}
                                <div className="field">
                                  <label>Links de material</label>
                                  <textarea
                                    value={item.materialLinks}
                                    onChange={(e) =>
                                      updateItem(
                                        index,
                                        "materialLinks",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Drive, Dropbox, Frame, etc."
                                  />
                                </div>
                                <p className="mini field-note">
                                  Para material final usa links de
                                  Drive/Frame/Dropbox. No se cargan archivos
                                  pesados en solicitudes.
                                </p>
                                {item.requiresProduction && (
                                  <div className="field">
                                    <label>Notas para producción</label>
                                    <textarea
                                      value={item.productionNotes}
                                      onChange={(e) =>
                                        updateItem(
                                          index,
                                          "productionNotes",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="Tomas necesarias, estilo, locación, etc."
                                    />
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="field">
                                  <label>Links inspiración</label>
                                  <textarea
                                    value={item.referenceLinks}
                                    onChange={(e) =>
                                      updateItem(
                                        index,
                                        "referenceLinks",
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*,video/mp4,video/quicktime,video/webm"
                                  onChange={(e) =>
                                    uploadToItem(
                                      index,
                                      "reference",
                                      e.target.files,
                                    )
                                  }
                                />
                                <p className="mini field-note">
                                  Referencia temporal hasta 80 MB. Se elimina al
                                  finalizar la solicitud.
                                </p>
                                <FileList
                                  files={item.referenceFiles || []}
                                  onPreview={setPreview}
                                  onRemove={(i) =>
                                    removeFileFromItem(index, "reference", i)
                                  }
                                />
                              </div>
                            </div>
                          </section>

                          <div className="creator-accordion-actions">
                            {error ? (
                              <span className="pill red">{error}</span>
                            ) : (
                              <span className="pill green">
                                Lista para enviar
                              </span>
                            )}
                            <div>
                              <button
                                className="btn"
                                onClick={() => duplicateItem(index)}
                                disabled={!canCreateRequests}
                              >
                                Duplicar
                              </button>
                              <button
                                className="btn red"
                                onClick={() => removeItem(index)}
                                disabled={!canCreateRequests}
                              >
                                Quitar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="grid creator-planning-sidebar">
          <details className="creator-sidebar-section" open>
            <summary>
              <span>Planeación viva</span>
              <small>{planningSummary.riskLabel}</small>
            </summary>
            <div className="creator-sidebar-section-body">
              <PlanningSummaryCard
                summary={planningSummary}
                forceReason={forceReason}
                forceNotes={forceNotes}
                setForceReason={setForceReason}
                setForceNotes={setForceNotes}
              />
            </div>
          </details>

          <details className="creator-sidebar-section">
            <summary>
              <span>Calendario del lote</span>
              <small>{calendarItems.length} fechas</small>
            </summary>
            <div className="creator-sidebar-section-body">
              <div className="card planning-calendar-card">
                <CalendarPanel items={calendarItems} />
              </div>
            </div>
          </details>

          <details className="creator-sidebar-section">
            <summary>
              <span>Borradores guardados</span>
              <small>{drafts.length}</small>
            </summary>
            <div className="creator-sidebar-section-body">
              <div className="card">
                <div className="draft-list">
                  {drafts.map((draft) => (
                    <div className="draft-item" key={draft.id}>
                      <strong>{draft.name}</strong>
                      <span className="mini">
                        {draft.clientName} · {draft.items?.length || 0} visuales ·
                        Límite: {draft.batchDueDate || "Sin fecha"} ·{" "}
                        {draft.status}
                      </span>
                      <span className="mini">
                        Responsable: {(draft as any).ownerName || (draft as any).createdByName || "Content"}
                        {Array.isArray((draft as any).collaboratorNames) && (draft as any).collaboratorNames.length
                          ? ` · Colaboradores: ${(draft as any).collaboratorNames.join(", ")}`
                          : ""}
                      </span>
                      <div className="draft-actions">
                        <button className="btn" onClick={() => openDraft(draft)}>
                          Abrir
                        </button>
                        <button
                          className="btn red"
                          onClick={() => removeDraft(draft.id)}
                          disabled={!canDeleteDrafts}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                  {!drafts.length && (
                    <p className="mini">Aún no hay borradores.</p>
                  )}
                </div>
              </div>
            </div>
          </details>

          <details className="creator-sidebar-section">
            <summary>
              <span>Lotes realizados para reusar</span>
              <small>{totalReusableBatches}</small>
            </summary>
            <div className="creator-sidebar-section-body">
              <div className="card">
                <div className="batch-reuse-grid">
                  {reusableBatches.map((batch) => (
                    <div className="batch-reuse-card" key={batch.id}>
                      <strong>{batch.name}</strong>
                      <span className="mini">
                        {batch.clientName} · Límite anterior:{" "}
                        {batch.batchDueDate || "Sin fecha"} ·{" "}
                        {batch.totalRequests || 0} visuales
                      </span>
                      <div className="draft-actions">
                        <button className="btn" onClick={() => reuseBatch(batch)}>
                          Reusar lote
                        </button>
                        <button
                          className="btn red"
                          onClick={() => hideReusableBatch(batch)}
                          disabled={!canDeleteDrafts}
                        >
                          Eliminar de reuso
                        </button>
                      </div>
                    </div>
                  ))}
                  {!reusableBatches.length && (
                    <p className="mini">
                      No hay lotes recientes disponibles para reusar.
                    </p>
                  )}
                  {totalReusableBatches >
                    Math.max(
                      1,
                      Number(cleanupSettings.reuseBatchLimit || 5),
                    ) && (
                    <button
                      className="btn"
                      onClick={() =>
                        setShowFullReuseHistory((value) => !value)
                      }
                    >
                      {showFullReuseHistory
                        ? "Mostrar solo recientes"
                        : "Ver historial completo"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </details>
        </aside>
      </section>

      {csvPreview && (
        <div className="modal-backdrop">
          <div className="modal-card creator-csv-preview" style={{ width: "min(760px,94vw)" }}>
            <div><p className="eyebrow">Vista previa de importación</p><h2 style={{ margin:0 }}>{csvPreview.fileName}</h2><p className="mini">Solo se agregarán las filas válidas al final del lote actual. Los visuales existentes no se modifican.</p></div>
            <div className="creator-csv-summary">
              <div><span>Filas detectadas</span><strong>{csvPreview.totalRows}</strong></div>
              <div><span>Listas para agregar</span><strong>{csvPreview.validItems.length}</strong></div>
              <div><span>Con errores</span><strong>{csvPreview.errors.length}</strong></div>
            </div>
            {csvPreview.validItems.length > 0 && <div className="draft-list">
              {csvPreview.validItems.slice(0,5).map((item,index) => <div className="draft-item" key={item.localDraftId || index}><strong>Visual {items.length + index + 1} · {item.contentType} · {item.topic || "Sin tema todavía"}</strong><span className="mini">{item.publishDate} · {item.objective} · {item.suggestedArea}</span></div>)}
              {csvPreview.validItems.length > 5 && <p className="mini">Y {csvPreview.validItems.length - 5} visual(es) más.</p>}
            </div>}
            {csvPreview.errors.length > 0 && <div className="creator-csv-errors">{csvPreview.errors.slice(0,20).map((error) => <div key={error}>{error}</div>)}{csvPreview.errors.length > 20 && <div>Y {csvPreview.errors.length - 20} error(es) más.</div>}</div>}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, flexWrap:"wrap" }}>
              <button className="btn" type="button" onClick={() => setCsvPreview(null)}>Cancelar</button>
              <button className="btn dark" type="button" onClick={confirmCsvImport} disabled={!csvPreview.validItems.length}>Agregar {csvPreview.validItems.length} visual(es)</button>
            </div>
          </div>
        </div>
      )}

      {leaveWarning && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ width: "min(540px,92vw)" }}>
            <p className="eyebrow">Trabajo sin guardar</p>
            <h2 style={{ marginTop: 0 }}>Tienes un lote sin guardar</h2>
            <p>
              Hay cambios en el Creador de Solicitudes que todavía no se han
              guardado como borrador. El autoguardado local mantiene una copia
              de recuperación, pero conviene guardar el borrador antes de salir.
            </p>
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "flex-end",
                flexWrap: "wrap",
                marginTop: 18,
              }}
            >
              <button
                className="btn"
                data-modal-dismiss
                onClick={() => setLeaveWarning(null)}
              >
                Seguir editando
              </button>
              <button
                className="btn blue"
                onClick={saveDraftAndLeave}
                disabled={busy}
              >
                {busy ? "Guardando..." : "Guardar borrador y salir"}
              </button>
              <button className="btn red" onClick={leaveWithoutSaving}>
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <PreviewModal file={preview} onClose={() => setPreview(null)} />
      )}
    </AppShell>
  );
}

type PlanningSummary = ReturnType<typeof buildPlanningSummary>;

function buildPlanningSummary(
  items: ContentRequest[],
  existing: ContentRequest[],
  rules: OperationalContentRule[],
  overrides: ClientOperationalOverride[],
  capacities: TeamDailyCapacity[],
) {
  const planned = items.map((item) => ({
    item,
    plan: getOperationalPlan(item, rules, overrides),
    risk: getDeliveryRisk(
      item.publishDate || item.batchDueDate || item.clientDueDate || "",
      getOperationalPlan(item, rules, overrides).deliveryDays,
    ),
  }));
  const totalCost = planned.reduce((sum, row) => sum + row.plan.totalCost, 0);
  const totalHours = planned.reduce(
    (sum, row) => sum + row.plan.editingHours,
    0,
  );
  const totalPieces = planned.length;
  const byArea: Record<string, { count: number; hours: number; cost: number }> =
    {};
  planned.forEach(({ item, plan }) => {
    const area = item.suggestedArea || plan.rule.area || "Sin área";
    byArea[area] = byArea[area] || { count: 0, hours: 0, cost: 0 };
    byArea[area].count += 1;
    byArea[area].hours += plan.editingHours;
    byArea[area].cost += plan.totalCost;
  });
  const today = todayDateKey();
  const productionItems = planned.filter(({ item }) => item.requiresProduction);
  const productionDueDates = productionItems
    .map(({ plan }) => plan.productionDueDate)
    .filter(Boolean)
    .sort();
  const expiredProductionDates = productionDueDates.filter(
    (date) => date < today,
  );
  const validProductionDates = productionDueDates.filter(
    (date) => date >= today,
  );
  const hasExpiredProduction = expiredProductionDates.length > 0;
  const internalDates = planned
    .map(({ plan }) => plan.internalDueDate)
    .filter(Boolean)
    .sort();
  const clientDates = planned
    .map(({ plan }) => plan.clientDueDate)
    .filter(Boolean)
    .sort();
  const earliestInternalDue = internalDates[0] || "";
  const latestClientDue = clientDates[clientDates.length - 1] || "";
  const maxDeliveryDays = Math.max(
    0,
    ...planned.map(
      ({ plan, item }) =>
        Number(plan.deliveryDays || 0) +
        (item.requiresProduction
          ? Math.max(1, Math.ceil(Number(plan.bufferHours || 8) / 8))
          : 0),
    ),
  );
  const minimumViableDate = addBusinessDays(
    new Date().toISOString().slice(0, 10),
    maxDeliveryDays,
  );
  const requestedTooSoon = clientDates.some(
    (date) => date && date < minimumViableDate,
  );

  const areaCapacity: Record<string, number> = {};
  capacities
    .filter((x) => x.active !== false)
    .forEach((cap) => {
      areaCapacity[cap.area] =
        (areaCapacity[cap.area] || 0) + Number(cap.dailyCapacityUnits || 5);
   });
  const areaLoadToday: Record<string, number> = {};
  existing
    .filter(
      (task) =>
        ![
          "pendiente_aprobacion",
          "pendiente_aprobacion_kam",
          "aprobada_pendiente_copyout",
          "finalizada",
          "cancelada",
          "eliminada",
        ].includes(task.status || ""),
    )
    .forEach((task) => {
      const plan = getOperationalPlan(task, rules, overrides);
      const area =
        task.assignedArea || task.suggestedArea || plan.rule.area || "Sin área";
      const date =
        task.plannedWorkDate || task.dueDate || task.internalDueDate || "";
      if (date && (!earliestInternalDue || date <= earliestInternalDue)) {
        areaLoadToday[area] = (areaLoadToday[area] || 0) + 1;
      }
    });
  const areaWarnings = Object.entries(byArea).map(([area, row]) => {
    const cap = areaCapacity[area] || 5;
    const projected = row.count + (areaLoadToday[area] || 0);
    const tone = getCapacityTone(projected, Math.max(cap, 1));
    return {
      area,
      ...row,
      capacity: cap,
      projected,
      tone: tone.tone,
      label: tone.label,
    };
  });
  const overload = areaWarnings.some(
    (row) => row.tone === "red" || row.tone === "orange",
  );
  const riskTone = !items.length
    ? "green"
    : hasExpiredProduction || requestedTooSoon || overload
      ? "red"
      : planned.some((row) => row.risk.tone === "mid")
        ? "yellow"
        : "green";
  const viableDate =
    requestedTooSoon || hasExpiredProduction
      ? minimumViableDate
      : latestClientDue;
  const productionDueLabel = hasExpiredProduction
    ? "Ya no viable"
    : validProductionDates[0] || "";
  const riskReason = hasExpiredProduction
    ? "la fecha máxima de producción ya pasó; debe usarse material disponible o mover la publicación"
    : requestedTooSoon
      ? `la primera fecha viable por tiempos configurados es ${minimumViableDate}`
      : overload
        ? "la carga por área supera las piezas disponibles por día"
        : "sin riesgo crítico";
  return {
    totalCost,
    totalHours,
    totalPieces,
    byArea,
    productionCount: productionItems.length,
    productionDueDate: productionDueDates[0] || "",
    productionDueLabel,
    hasExpiredProduction,
    expiredProductionCount: expiredProductionDates.length,
    earliestInternalDue,
    latestClientDue,
    viableDate,
    riskTone,
    riskLabel:
      riskTone === "red"
        ? "Rojo"
        : riskTone === "yellow"
          ? "Amarillo"
          : "Verde",
    riskReason,
    areaWarnings,
    riskCount: planned.filter((row) => row.risk.tone === "bad").length,
  };
}

function PlanningSummaryCard({
  summary,
  forceReason,
  forceNotes,
  setForceReason,
  setForceNotes,
}: {
  summary: PlanningSummary;
  forceReason: string;
  forceNotes: string;
  setForceReason: (v: string) => void;
  setForceNotes: (v: string) => void;
}) {
  return (
    <div className={`card planning-summary-card ${summary.riskTone}`}>
      <div className="planning-summary-head">
        <div>
          <p className="eyebrow">Planeación viva</p>
          <h3>Viabilidad de solicitud</h3>
        </div>
        <span
          className={`pill ${summary.riskTone === "red" ? "red" : summary.riskTone === "yellow" ? "yellow" : "green"}`}
        >
          {summary.riskLabel}
        </span>
      </div>
      <div className="planning-metrics-grid">
        <div>
          <span>Costo solicitud</span>
          <strong>{money(summary.totalCost)}</strong>
        </div>
        <div>
          <span>Horas estimadas</span>
          <strong>{summary.totalHours} h</strong>
        </div>
        <div>
          <span>Piezas</span>
          <strong>{summary.totalPieces}</strong>
        </div>
        <div>
          <span>Fecha viable</span>
          <strong>{summary.viableDate || "Sin fecha"}</strong>
        </div>
        <div>
          <span>Entrega interna</span>
          <strong>{summary.earliestInternalDue || "Sin fecha"}</strong>
        </div>
        <div className={summary.hasExpiredProduction ? "metric-danger" : ""}>
          <span>Máx. producción</span>
          <strong>{summary.productionDueLabel || "No aplica"}</strong>
        </div>
      </div>
      <div className="planning-area-list">
        <strong>Carga por área</strong>
        {summary.areaWarnings.map((row) => (
          <div className="planning-area-row" key={row.area}>
            <span>{row.area}</span>
            <small>
             {row.count} pieza(s) · {row.hours} h
            </small>
            <b className={`capacity-dot ${row.tone}`}>
              {row.projected} / {row.capacity} piezas
            </b>
          </div>
        ))}
        {!summary.areaWarnings.length && (
          <p className="mini">Agrega contenidos para calcular carga.</p>
        )}
      </div>
      {summary.hasExpiredProduction && (
        <div className="production-expired-alert">
          <strong>Producción ya no viable</strong>
          <span>
            Hay {summary.expiredProductionCount} pieza(s) cuya fecha máxima de
            producción ya pasó. Para avanzar, mueve la fecha de publicación o
            desactiva producción y trabaja con material disponible.
          </span>
        </div>
       )}
      <p className="mini">
        {summary.riskTone === "red"
          ? `Riesgo: ${summary.riskReason}.`
          : "La fecha se calcula con horas por pieza, producción requerida y capacidad diaria en piezas."}
      </p>
     {summary.riskTone === "red" && (
        <div className="force-date-box">
          <h4>Forzar fecha con justificación</h4>
          <div className="field">
            <label>Motivo</label>
            <select
                 value={forceReason}
              onChange={(e) => setForceReason(e.target.value)}
            >
              <option value="">Selecciona motivo...</option>
              <option>Cliente urgente</option>
              <option>Campaña pagada activa</option>
              <option>Solicitud de dirección</option>
              <option>Contenido prioritario</option>
              <option>Otro</option>
            </select>
          </div>
          <div className="field">
            <label>Notas</label>
            <textarea
              value={forceNotes}
              onChange={(e) => setForceNotes(e.target.value)}
              placeholder="Explica por qué se acepta el riesgo operativo."
            />
          </div>
        </div>
      )}
    </div>
  );
}

function RequestForm({
  request,
  buyerPersonas,
  onPersonaChange,
  onChange,
  onUpload,
  onPreview,
  onImprove,
  improving,
  onRemove,
}: {
  request: ContentRequest;
  buyerPersonas: ClientBuyerPersona[];
  onPersonaChange: (persona?: ClientBuyerPersona) => void;
  onChange: (k: keyof ContentRequest, v: any) => void;
  onUpload: (kind: "reference", files: FileList | null) => void;
  onPreview: (file: ReferenceFile) => void;
  onImprove: () => void;
  improving: boolean;
  onRemove: (kind: "reference", index: number) => void;
}) {
  return (
    <div className="request-form-grid">
      <div className="field">
        <label>Tipo</label>
        <select
          value={request.contentType}
          onChange={(e) => onChange("contentType", e.target.value)}
        >
          {contentTypes.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Objetivo</label>
        <select
          value={request.objective}
          onChange={(e) => onChange("objective", e.target.value)}
        >
          {objectives.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Área sugerida</label>
        <select
          value={request.suggestedArea}
          onChange={(e) => onChange("suggestedArea", e.target.value)}
        >
          {creatorAreas.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Fecha publicación</label>
        <input
          type="date"
          value={request.publishDate}
          onChange={(e) => onChange("publishDate", e.target.value)}
        />
      </div>
      <div className="field full">
        <label>Tema / publicación</label>
        <input
          value={request.topic}
          onChange={(e) => onChange("topic", e.target.value)}
          placeholder="Ej. Promoción julio, testimonio, producto estrella"
        />
      </div>
      <BuyerPersonaSelector
        request={request}
        buyerPersonas={buyerPersonas}
        onSelect={onPersonaChange}
      />
      <PostInfoSelector request={request} onChange={onChange} />
      <CreativeIdeaField
        value={request.creativeIdea}
        onChange={(value) => onChange("creativeIdea", value)}
        onImprove={onImprove}
        busy={improving}
      />
      <div className="field">
        <label>Mensaje clave</label>
        <input
          value={request.keyMessage}
          onChange={(e) => onChange("keyMessage", e.target.value)}
          placeholder="Qué debe quedar claro"
        />
      </div>
      <div className="field">
        <label>CTA</label>
        <input
          value={request.cta}
          onChange={(e) => onChange("cta", e.target.value)}
          placeholder="Ej. Solicita información"
        />
      </div>
      <div className="field full">
        <label>Copy In{isPhotographyOnly(request) ? " (opcional para Fotografía)" : ""}</label>
        <textarea
          value={request.copyIn}
          onChange={(e) => onChange("copyIn", e.target.value)}
        />
      </div>
      <div className="field full">
        <label>Inspiración / referencias</label>
        <textarea
          value={request.referenceLinks}
          onChange={(e) => onChange("referenceLinks", e.target.value)}
        />
        <input
          type="file"
          multiple
          accept="image/*,video/mp4,video/quicktime,video/webm"
          onChange={(e) => onUpload("reference", e.target.files)}
        />
        <p className="mini field-note">
          Referencia temporal: imagen o video hasta 80 MB. Se eliminará al
          finalizar la solicitud.
        </p>
        <FileList
          files={request.referenceFiles || []}
          onPreview={onPreview}
          onRemove={(i) => onRemove("reference", i)}
        />
      </div>
      <div className="field full">
        <label>Producción / Material</label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={request.requiresProduction}
            onChange={(e) => onChange("requiresProduction", e.target.checked)}
          />{" "}
          Requiere producción
        </label>
        {!request.requiresProduction && (
          <label className="check-row">
            <input
              type="checkbox"
              checked={request.materialAvailable}
              onChange={(e) => onChange("materialAvailable", e.target.checked)}
            />{" "}
            Material disponible
          </label>
        )}
        <textarea
          value={request.materialLinks}
          onChange={(e) => onChange("materialLinks", e.target.value)}
          placeholder="Links de material si ya existe"
        />
        <p className="mini field-note">
          No cargues archivos de material aquí. Pega el link de
          Drive/Frame/Dropbox para evitar saturar Storage.
        </p>
      </div>
    </div>
  );
}

function briefCompleteness(item: ContentRequest) {
  const checks = [
    item.clientName,
    item.contentType,
    item.objective,
    item.suggestedArea,
    item.publishDate,
    item.topic,
    item.creativeIdea && item.creativeIdea.length > 40,
    item.keyMessage,
    isPhotographyOnly(item) ? true : item.copyIn,
    item.cta,
    item.platforms?.length,
    item.visualFormat || item.feedPlacement,
    item.requiresProduction
      ? item.productionNotes
      : item.materialAvailable || item.materialLinks,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function briefMissingFields(item: ContentRequest) {
  const missing: string[] = [];
  if (!item.contentType) missing.push("tipo");
  if (!item.objective) missing.push("objetivo");
  if (!item.suggestedArea) missing.push("área");
  if (!item.publishDate) missing.push("fecha");
  if (!item.topic) missing.push("tema");
  if (!item.creativeIdea || item.creativeIdea.length < 40)
    missing.push("idea clara");
  if (!item.keyMessage) missing.push("mensaje clave");
  if (!isPhotographyOnly(item) && !item.copyIn) missing.push("copy in");
  if (!item.cta) missing.push("CTA");
  if (!item.platforms?.length) missing.push("plataformas");
  if (item.requiresProduction && !item.productionNotes)
    missing.push("notas producción");
  if (
    !item.requiresProduction &&
    !item.materialAvailable &&
    !item.materialLinks
  )
    missing.push("material/link");
  return missing;
}

function BriefScoreCard({ request }: { request: ContentRequest }) {
  const score = briefCompleteness(request);
  const missing = briefMissingFields(request);
  return (
    <div className="brief-score-mini">
      <div>
        <strong>Brief Score {score}/100</strong>
        <span>La IA usa esto para prevenir rebotes.</span>
      </div>
      <span
        className={
          score >= 80 ? "pill green" : score >= 60 ? "pill yellow" : "pill red"
        }
      >
        {score >= 80 ? "Sólido" : score >= 60 ? "Mejorable" : "Riesgo"}
      </span>
      {!!missing.length && <p>Falta: {missing.join(", ")}</p>}
    </div>
  );
}

const platformOptions = ["Instagram", "Facebook", "TikTok"];
const formatOptions = [
  "Vertical 9:16",
  "Cuadrado 1:1",
  "Carrusel Feed",
  "Horizontal 16:9",
  "Story 9:16",
];
const feedOptions = [
  "Feed",
  "Carrousel para el Feed",
  "Reel",
  "Story",
  "TikTok",
  "Portada Reel",
];

function toggleArrayValue(values: string[] | undefined, value: string) {
  const current = values || [];
  return current.includes(value)
    ? current.filter((x) => x !== value)
    : [...current, value];
}

function BuyerPersonaSelector({
  request,
  buyerPersonas,
  onSelect,
}: {
  request: ContentRequest;
  buyerPersonas: ClientBuyerPersona[];
  onSelect: (persona?: ClientBuyerPersona) => void;
}) {
  const personas = (buyerPersonas || []).filter((persona) => persona?.name);
  const selectedId = request.buyerPersonaId || "";

  function handleSelect(id: string) {
    if (!id) {
      onSelect(undefined);
      return;
    }
    const persona = personas.find((p) => (p.id || p.name) === id);
    onSelect(persona);
  }

  return (
    <div className="persona-selector full">
      <div className="post-info-title">Buyer persona de esta solicitud</div>
      <p className="mini persona-help">
        Elige a quién va dirigida esta pieza. Si no aplica, deja la opción
        general de marca.
      </p>
      {personas.length ? (
        <div className="field persona-field">
          <label>Enfoque de audiencia</label>
          <select
            value={selectedId}
            onChange={(event) => handleSelect(event.target.value)}
          >
            <option value="">Sin enfoque particular</option>
            {personas.map((persona, index) => {
              const id = persona.id || persona.name || String(index);
              return (
                <option key={id} value={id}>
                  {persona.name}
                </option>
              );
            })}
          </select>
        </div>
      ) : (
        <div className="persona-empty">
          Este cliente todavía no tiene buyer personas configurados. La
          solicitud usará el contexto general de la marca.
        </div>
      )}
      {request.buyerPersonaId && request.buyerPersonaSnapshot?.description ? (
        <p className="mini persona-help">
          {request.buyerPersonaSnapshot.description}
        </p>
      ) : (
        <p className="mini persona-help">
          Si eliges uno, la IA enfocará la idea creativa hacia ese perfil.
        </p>
      )}
    </div>
  );
}

function PostInfoSelector({
  request,
  onChange,
}: {
  request: ContentRequest;
  onChange: (k: keyof ContentRequest, v: any) => void;
}) {
  return (
    <div className="post-info-card full">
      <div className="post-info-title">Información visual del post</div>
      <div className="chip-group">
        {platformOptions.map((option) => (
          <button
            type="button"
            className={
              (request.platforms || []).includes(option)
                ? "chip-btn selected"
                : "chip-btn"
            }
            key={option}
            onClick={() =>
              onChange("platforms", toggleArrayValue(request.platforms, option))
            }
          >
            {option}
          </button>
        ))}
      </div>
      <div className="chip-group">
        {formatOptions.map((option) => (
          <button
            type="button"
            className={
              request.visualFormat === option ? "chip-btn selected" : "chip-btn"
            }
            key={option}
            onClick={() => onChange("visualFormat", option)}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="chip-group">
        {feedOptions.map((option) => (
          <button
            type="button"
            className={
              request.feedPlacement === option
                ? "chip-btn selected"
                : "chip-btn"
            }
            key={option}
            onClick={() => onChange("feedPlacement", option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function CreativeIdeaField({
  value,
  onChange,
  onImprove,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  onImprove: () => void;
  busy: boolean;
}) {
  return (
    <div className="field full creative-field">
      <label>Idea creativa</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe la idea base de la pieza. Luego puedes mejorarla con IA."
      />
      <button
        type="button"
        className="btn ai-inside ai-only-button"
        aria-label={busy ? "Mejorando idea con AI" : "Mejorar idea con AI"}
        title={busy ? "Mejorando idea con AI" : "Mejorar idea con AI"}
        onClick={onImprove}
        disabled={busy}
      >
        <span className="ai-inside-badge" aria-hidden="true">
          <span className="spark-main">✦</span>
          <span className="spark-mini">✦</span>
          <span>AI</span>
        </span>
      </button>
    </div>
  );
}

function FileList({
  files,
  onPreview,
  onRemove,
}: {
  files: ReferenceFile[];
  onPreview: (file: ReferenceFile) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="ref-grid">
      {(files || []).map((file, index) => (
        <button
          type="button"
          className="ref-thumb"
          onClick={() => onPreview(file)}
          key={index}
        >
          {isImageFile(file) ? (
            <img src={file.url} alt="Referencia" />
          ) : isVideoFile(file) ? (
            <video src={file.url} muted playsInline preload="metadata" />
          ) : (
            <div className="ref-thumb-file">Archivo</div>
          )}
          <span
            className="ref-delete"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(index);
            }}
          >
            Eliminar
          </span>
        </button>
      ))}
    </div>
  );
}

function PreviewModal({
  file,
  onClose,
}: {
  file: ReferenceFile;
  onClose: () => void;
}) {
  return (
    <div className="preview-modal" onClick={onClose}>
      <div className="preview-box" onClick={(e) => e.stopPropagation()}>
        <div className="preview-actions">
          <strong>{file.name}</strong>
          <button className="btn red" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {isImageFile(file) ? (
          <img src={file.url} alt={file.name} />
        ) : isVideoFile(file) ? (
          <video src={file.url} controls playsInline />
        ) : (
          <p>Archivo no previsualizable.</p>
        )}
      </div>
    </div>
  );
}

function CalendarPanel({ items }: { items: ContentRequest[] }) {
  const groups: Record<string, string[]> = {};
  for (const item of items) {
    const raw = getRequestDate(item);
    if (!raw) continue;
    const d = new Date(raw + "T00:00:00");
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toLocaleDateString("es-MX", {
      month: "long",
      year: "numeric",
    });
    groups[key] = groups[key] || [];
    groups[key].push(String(d.getDate()));
  }
  const entries = Object.entries(groups);
  if (!entries.length) return <p className="mini">Sin fechas.</p>;
  return (
    <div className="calendar-panel">
      {entries.map(([month, days]) => (
        <div className="month-card" key={month}>
          <div className="month-title">{month}</div>
          <div className="days">
            {Array.from(new Set(days))
              .sort((a, b) => Number(a) - Number(b))
              .map((day) => (
                <span className="day-dot" key={day}>
                  {day}
                </span>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OperationalEstimate({
  item,
  rules,
  overrides,
}: {
  item: ContentRequest;
  rules: OperationalContentRule[];
  overrides: ClientOperationalOverride[];
}) {
  const cost = estimateRequestCost(item, rules, overrides);
  const risk = getDeliveryRisk(item.publishDate, cost.deliveryDays);
  const dueDate = suggestOperationalDueDate(
    item.publishDate,
    cost.deliveryDays,
  );
  return (
    <div className={`operational-card ${risk.tone}`}>
      <strong>{money(cost.totalCost)}</strong>
      <span>
        {cost.editingHours} h edición · {cost.deliveryDays} días mínimos
      </span>
      <span>
        {risk.label}
        {dueDate ? ` · Entrega interna sugerida: ${dueDate}` : ""}
      </span>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
