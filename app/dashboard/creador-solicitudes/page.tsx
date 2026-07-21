"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
  validateCreatorItem,
} from "@/lib/data";

export default function CreatorPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
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
  const [items, setItems] = useState<ContentRequest[]>([]);
  const [manual, setManual] = useState<ContentRequest>(emptyRequest);
  const [preview, setPreview] = useState<ReferenceFile | null>(null);
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
  const [feedback, setFeedback] = useState<{ type: "success" | "info"; message: string } | null>(null);
  const [localRecovery, setLocalRecovery] = useState<any | null>(null);
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
  const [manualCount, setManualCount] = useState(5);
  const permissions = useModulePermissions("creador");
  const canCreateRequests = permissions.canCreate || permissions.canEdit;
  const canGenerateRequests =
    permissions.canGenerate || permissions.canCreate || permissions.canEdit;
  const canDeleteDrafts = permissions.canDelete || permissions.canEdit;

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
    ] = await Promise.all([
      listUniqueBrands(),
      listRequests(),
      listPlannerDrafts(),
      listRequestBatches(),
      listOperationalContentRules(),
      listClientOperationalOverrides(),
      listTeamDailyCapacities(),
      getCleanupRetentionSettings(),
    ]);
    setBrands(loadedBrands);
    setRequests(loadedRequests);
    setDrafts(loadedDrafts);
    setBatches(loadedBatches);
    setCostRules(loadedRules);
    setClientOverrides(loadedOverrides);
    setTeamCapacities(loadedCapacities);
    setCleanupSettings(loadedCleanupSettings);
    if (!clientId && loadedBrands[0]?.id) {
      setClientId(loadedBrands[0].id);
      if (!draftName)
        setDraftName(
          `${loadedBrands[0].name} · Creado ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
        );
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(autosaveKey);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const hasWork = Boolean((parsed.items || []).length || parsed.draftName || parsed.startDate || parsed.batchDueDate);
      if (hasWork) setLocalRecovery(parsed);
    } catch (error) {
      console.warn("No se pudo recuperar autosave del creador", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasWork = Boolean(items.length || draftName.trim() || batchDueDate || startDate || manual.creativeIdea?.trim() || manual.copyIn?.trim() || manual.topic?.trim());
    if (!hasWork) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(autosaveKey, JSON.stringify({
          savedAt: new Date().toISOString(),
          clientId, draftName, batchDueDate, items, manual, creatorMode,
          aiCount, startDate, interval, types, goals, themes, must, manualCount
        }));
      } catch (error) {
        console.warn("No se pudo guardar autosave del creador", error);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [clientId, draftName, batchDueDate, items, manual, creatorMode, aiCount, startDate, interval, types, goals, themes, must, manualCount]);

  useEffect(() => {
    if (!items.length) setAddPanelCollapsed(false);
  }, [items.length]);

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
    if (typeof window !== "undefined") window.localStorage.removeItem(autosaveKey);
    setLocalRecovery(null);
  }

  function restoreLocalAutosave() {
    if (!localRecovery) return;
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
    setThemes(localRecovery.themes || "Experiencia,Producto estrella,Testimonios");
    setMust(localRecovery.must || "");
    setManualCount(Number(localRecovery.manualCount || 5));
    setAddPanelCollapsed(Boolean((localRecovery.items || []).length));
    setLocalRecovery(null);
    showFeedback("Borrador local restaurado desde guardado automático.", "info");
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

  function defaultBatchName(clientName = client?.name || "Cliente") {
    return `${clientName} · Creado ${creationDateLabel()}`;
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

  function prepareItemsForPersistence(list: ContentRequest[], dueDateValue = batchDueDate) {
    return normalizeCreatorItems(
      list.map((item) => ({
        ...item,
        id: undefined,
        clientId: client?.id || item.clientId || "",
        clientName: client?.name || item.clientName || "",
        batchDueDate: dueDateValue,
        dueDate: item.dueDate || dueDateValue,
      })),
    );
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
    return !name || / · (Lote|Creado) /.test(name);
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
    setClientId(nextClientId);
    setCurrentDraftId("");
    setItems([]);
    setExpandedItemIndex(null);
    setAddPanelCollapsed(false);
    setManual(emptyRequest);
    setBatchDueDate("");
    if (selectedClient) setDraftName(defaultBatchName(selectedClient.name));
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
    return {
      ...base,
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
    };
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
          successfulContext: successfulRequestsContext(),
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

  async function saveDraft() {
    if (!canCreateRequests)
      return permissionAlert("guardar borradores de solicitudes");
    if (!client?.id) return alert("Selecciona cliente");
    const name = draftName || defaultBatchName(client.name);
    const itemsForSave = prepareItemsForPersistence(items, batchDueDate);
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
        });
      } else {
        const ref = await savePlannerDraft({
          name,
          clientId: client.id,
          clientName: client.name,
          status: "draft",
          batchDueDate,
          items: itemsForSave,
        });
        setCurrentDraftId(ref.id);
      }
      setDraftName(name);
      setItems(itemsForSave);
      await load();
      showFeedback(`Borrador guardado correctamente: ${name}. ${itemsForSave.length} solicitud(es) guardada(s).`);
    } finally {
      publishingBatchRef.current = false;
      setPublishingBatch(false);
      setBusy(false);
    }
  }

  function openDraft(draft: PlannerDraft) {
    setCurrentDraftId(draft.id || "");
    setDraftName(draft.name);
    setBatchDueDate(draft.batchDueDate || "");
    setClientId(draft.clientId);
    setItems(
      normalizeCreatorItems(
        (draft.items || []).map((item) => ({
          ...item,
          batchDueDate: draft.batchDueDate || item.batchDueDate || "",
        })),
      ),
    );
    setExpandedItemIndex(null);
    setAddPanelCollapsed(Boolean((draft.items || []).length));
  }

  function newDraft() {
    clearLocalAutosave();
    setCurrentDraftId("");
    setDraftName("");
    setBatchDueDate("");
    setItems([]);
    setManual(emptyRequest);
    setExpandedItemIndex(null);
    setAddPanelCollapsed(false);
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

    const clonedItems = activeBatchItems.map((item) => ({
      ...item,
      id: undefined,
      localDraftId: createLocalDraftId("reuse"),
      batchId: undefined,
      batchName: undefined,
      batchDueDate: "",
      dueDate: "",
      publishDate: "",
      status: item.requiresProduction ? "pendiente_produccion" : "lista_asignacion",
      source: "reuse",
    }));

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
    const suggestedArea = ["Reel", "TikTok", "Foto"].includes(contentType)
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
            suggestedArea: proposal.suggestedArea || fallback.suggestedArea,
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
      setExpandedItemIndex(null);
      setAddPanelCollapsed(true);
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
      setExpandedItemIndex(null);
      setAddPanelCollapsed(true);
      alert(
        `No se pudo completar con IA externa. Agregué propuestas completas base para no detener el flujo. Detalle: ${error instanceof Error ? error.message : "Error desconocido"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  function addManualBlankBatch() {
    if (!client?.id) return alert("Selecciona cliente");
    if (!startDate) return alert("Define la primera fecha de publicación.");
    if (!draftName) setDraftName(defaultBatchName(client.name));
    const count = Math.max(1, Number(manualCount || 1));
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
          publishDate: addDays(startDate, index * Math.max(1, interval)),
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
    setExpandedItemIndex(null);
    setAddPanelCollapsed(true);
    showFeedback(`${count} solicitud(es) en blanco agregada(s) al lote.`);
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
    const updated = { ...next[index], [k]: v };
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
    };
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
    const duplicated = {
      ...source,
      id: undefined,
      localDraftId: createLocalDraftId("duplicate"),
      source: "manual",
      number: items.length + 1,
      total: items.length + 1,
      status: initialOperationalStatus(source),
    };
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
      .map((item, index) => ({ index, error: validateCreatorItem(item) }))
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
          id: undefined,
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
          submittedBy: "Content"
        },
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
        });
      setItems([]);
      setCurrentDraftId("");
      setExpandedItemIndex(null);
      setDraftName("");
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
      <div className="page-title">
        <p className="eyebrow">Content</p>
        <h1>Creador de Solicitudes</h1>
        <p>
          Content crea lotes completos. La fecha límite del lote es la entrega
          operativa; cada pieza mantiene su fecha de publicación.
        </p>
      </div>

      <section className="grid kpis">
        {[
          ["Cliente", client?.name || "Sin cliente"],
          ["En lote", String(items.length)],
          ["Costo solicitud", money(operationalSummary.totalCost)],
          ["Piezas", `${operationalSummary.totalPieces} contenidos`],
          ["Fecha viable", operationalSummary.viableDate || "Sin fecha"],
          ["Semáforo", operationalSummary.riskLabel],
        ].map(([a, b]) => (
          <div className="kpi" key={a}>
            <span>{a}</span>
            <strong>{b}</strong>
          </div>
        ))}
      </section>

      <div className="batch-bar">
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label>Nombre del lote</label>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Ej. Cliente · Semana 2 julio"
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Fecha límite del lote</label>
          <input
            type="date"
            value={batchDueDate}
            onChange={(e) =>
              setBusinessDate(
                setBatchDueDate,
                e.target.value,
                "fecha límite del lote",
              )
            }
          />
        </div>
        <button
          className="btn blue"
          onClick={saveDraft}
          disabled={!canCreateRequests}
        >
          Guardar borrador
        </button>
        <button
          className="btn dark"
          onClick={publishBatch}
          disabled={busy || publishingBatch || !canCreateRequests}
        >
          {publishingBatch
            ? "Enviando lote..."
            : busy
              ? "Cargando referencias..."
              : "Aprobar lote y enviar a Asignación"}
        </button>
        <button
          className="btn red"
          onClick={newDraft}
          disabled={!canCreateRequests}
        >
          Nuevo
        </button>
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

      {localRecovery && !items.length && (
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
                <div className="field">
                  <label>Cliente</label>
                  <select
                    value={clientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                  >
                    {brands.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </div>

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
                      <strong>Modo IA</strong>
                      <span>
                        Genera propuestas automáticamente con base en el brief,
                        reglas del cliente y configuración del lote.
                      </span>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>Cuántas</label>
                        <input
                          type="number"
                          value={aiCount}
                          onChange={(e) => setAiCount(Number(e.target.value))}
                        />
                      </div>
                      <div className="field">
                        <label>Primera fecha de publicación</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                        <p className="mini field-note">
                          Puede ser sábado o domingo.
                        </p>
                      </div>
                      <div className="field">
                        <label>Cada cuántos días</label>
                        <input
                          type="number"
                          value={interval}
                          onChange={(e) => setInterval(Number(e.target.value))}
                        />
                      </div>
                      <div className="field">
                        <label>Tipos</label>
                        <input
                          value={types}
                          onChange={(e) => setTypes(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Objetivos</label>
                        <input
                          value={goals}
                          onChange={(e) => setGoals(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Temas</label>
                        <input
                          value={themes}
                          onChange={(e) => setThemes(e.target.value)}
                        />
                      </div>
                      <div className="field full">
                        <label>Factores obligatorios</label>
                        <textarea
                          value={must}
                          onChange={(e) => setMust(e.target.value)}
                        />
                      </div>
                    </div>
                    <button
                      className="btn blue"
                      onClick={generateAI}
                      disabled={busy || !canGenerateRequests}
                    >
                      {busy
                        ? "Generando publicaciones..."
                        : "Generar publicaciones completas con IA"}
                    </button>
                  </div>
                ) : (
                  <div className="creator-mode-panel">
                    <div className="mode-intro">
                      <strong>Modo Manual</strong>
                      <span>
                        Crea espacios en blanco por cantidad, fecha e intervalo.
                        No usa IA ni prellena copy o idea.
                      </span>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>Cuántas solicitudes</label>
                        <input
                          type="number"
                          min="1"
                          value={manualCount}
                          onChange={(e) =>
                            setManualCount(Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Primera fecha de publicación</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                        <p className="mini field-note">
                          La publicación sí puede caer en sábado o domingo.
                        </p>
                      </div>
                      <div className="field">
                        <label>Cada cuántos días</label>
                        <input
                          type="number"
                          min="1"
                          value={interval}
                          onChange={(e) => setInterval(Number(e.target.value))}
                        />
                      </div>
                      <div className="field">
                        <label>Formato base</label>
                        <select
                          value={manual.contentType}
                          onChange={(e) =>
                            setManualField("contentType", e.target.value)
                          }
                        >
                          {contentTypes.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Objetivo base</label>
                        <select
                          value={manual.objective}
                          onChange={(e) =>
                            setManualField("objective", e.target.value)
                          }
                        >
                          {objectives.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Área base</label>
                        <select
                          value={manual.suggestedArea}
                          onChange={(e) =>
                            setManualField("suggestedArea", e.target.value)
                          }
                        >
                          {areas.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      className="btn blue"
                      onClick={addManualBlankBatch}
                      disabled={!canCreateRequests}
                    >
                      Crear solicitudes en blanco
                    </button>
                    <h3 style={{ marginTop: 28 }}>
                      Agregar una solicitud manual completa
                    </h3>
                    <RequestForm
                      request={manual}
                      buyerPersonas={client?.buyerPersonas || []}
                      onPersonaChange={(persona) =>
                        setManual({
                          ...manual,
                          buyerPersonaId: persona?.id || "",
                          buyerPersonaName:
                            persona?.name || "Sin enfoque particular",
                          buyerPersonaSnapshot: persona || null,
                        })
                      }
                      onChange={setManualField}
                      onUpload={uploadToManual}
                      onPreview={setPreview}
                      onImprove={() => improveCreativeIdea("manual")}
                      improving={improvingKey === "manual"}
                      onRemove={(_, index) =>
                        setManual({
                          ...manual,
                          referenceFiles: manual.referenceFiles.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    />
                    <button
                      className="btn"
                      onClick={addManual}
                      disabled={!canCreateRequests}
                    >
                      Agregar manual completa al lote
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h3>Lote actual</h3>
            {!items.length ? (
              <div className="empty">Todavía no hay solicitudes.</div>
            ) : (
              <div className="creator-accordion-list">
                {items.map((item, index) => {
                  const error = validateCreatorItem(item);
                  const expanded = expandedItemIndex === index;
                  return (
                    <div
                      className={`creator-accordion-card ${expanded ? "expanded" : "collapsed"}`}
                      key={index}
                    >
                      <button
                        type="button"
                        className="creator-accordion-summary"
                        onClick={() => toggleItem(index)}
                        aria-expanded={expanded}
                      >
                        <div className="summary-main">
                          <span className="request-index-pill">
                            Solicitud {index + 1} de {items.length}
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
                            {expanded ? "Ocultar" : "Editar"}
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
                                  {areas.map((x) => (
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
                              <label>Copy In</label>
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
            )}
          </div>
        </div>

        <aside className="grid creator-planning-sidebar">
          <PlanningSummaryCard
            summary={planningSummary}
            forceReason={forceReason}
            forceNotes={forceNotes}
            setForceReason={setForceReason}
            setForceNotes={setForceNotes}
          />
          <div className="card planning-calendar-card">
            <h3>Calendario del lote</h3>
            <CalendarPanel items={calendarItems} />
          </div>
          <div className="card">
            <h3>Borradores guardados</h3>
            <div className="draft-list">
              {drafts.map((draft) => (
                <div className="draft-item" key={draft.id}>
                  <strong>{draft.name}</strong>
                  <span className="mini">
                    {draft.clientName} · {draft.items?.length || 0} solicitudes
                    · Límite: {draft.batchDueDate || "Sin fecha"} ·{" "}
                    {draft.status}
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
              {!drafts.length && <p className="mini">Aún no hay borradores.</p>}
            </div>
          </div>
          <div className="card">
            <h3>Lotes realizados para reusar</h3>
            <div className="batch-reuse-grid">
              {reusableBatches.map((batch) => (
                <div className="batch-reuse-card" key={batch.id}>
                  <strong>{batch.name}</strong>
                  <span className="mini">
                    {batch.clientName} · Límite anterior:{" "}
                    {batch.batchDueDate || "Sin fecha"} ·{" "}
                    {batch.totalRequests || 0} solicitudes
                  </span>
                  <div className="draft-actions">
                    <button className="btn" onClick={() => reuseBatch(batch)}>
                      Reusar lote
                    </button>
                    <button className="btn red" onClick={() => hideReusableBatch(batch)} disabled={!canDeleteDrafts}>
                      Eliminar de reuso
                    </button>
                  </div>
                </div>
              ))}
              {!reusableBatches.length && (
                <p className="mini">
                  No hay lotes recientes disponibles para reusar. Si tienes historial, activa “Ver historial completo”.
                </p>
              )}
              {totalReusableBatches > Math.max(1, Number(cleanupSettings.reuseBatchLimit || 5)) && (
                <button className="btn" onClick={() => setShowFullReuseHistory((value) => !value)}>
                  {showFullReuseHistory ? "Mostrar solo recientes" : "Ver historial completo"}
                </button>
              )}
            </div>
          </div>
        </aside>
      </section>

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
          {areas.map((x) => (
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
        <label>Copy In</label>
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
    item.copyIn,
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
  if (!item.copyIn) missing.push("copy in");
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
