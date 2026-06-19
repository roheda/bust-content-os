"use client";
import Link from "next/link";
import { ChangeEvent, memo, useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { buildGenerationPrompt } from "@/lib/build-generation-prompt";
import {
  Brand,
  calculateClientBillingBalance,
  ClientAsset,
  ContentRequest,
  GenerationRequest,
  listUniqueBrands,
  listClientAssets,
  listGeneratedImageRecords,
  listGenerationRequests,
  listRequests,
  saveGenerationRequest,
  saveClientTextAsset,
  uploadReferenceFiles,
  updateGenerationRequest
} from "@/lib/data";

type TextBlock = {
  id: string;
  text: string;
  role: string;
  priority: string;
  instruction: string;
  locked: boolean;
};

type RequestAttachment = {
  file?: File;
  preview: string;
  name: string;
  role: string;
  notes: string;
  fileUrl?: string;
  mimeType?: string;
};

const formats = [
  { id: "instagram-post", label: "Post Instagram 4:5" },
  { id: "instagram-story", label: "Story 9:16" },
  { id: "square-post", label: "Cuadrado 1:1" },
  { id: "reel-cover", label: "Portada de Reel" },
  { id: "ad-creative", label: "Creativo para pauta" }
];

const goals = [
  { id: "sell", label: "Vender" },
  { id: "inform", label: "Informar" },
  { id: "announce", label: "Anunciar" },
  { id: "position", label: "Posicionar marca" },
  { id: "interaction", label: "Generar interacción" },
  { id: "trust", label: "Dar confianza" }
];

const contentTypes = [
  { id: "promotion", label: "Promoción" },
  { id: "product", label: "Producto o servicio" },
  { id: "event", label: "Evento" },
  { id: "notice", label: "Aviso" },
  { id: "seasonal", label: "Fecha especial" },
  { id: "branding", label: "Contenido de marca" }
];

const roles = [
  { id: "headline", label: "Titular protagonista" },
  { id: "subheadline", label: "Frase secundaria" },
  { id: "claim", label: "Claim / frase de campaña" },
  { id: "badge", label: "Sello / badge" },
  { id: "bullet", label: "Bullet" },
  { id: "price", label: "Precio" },
  { id: "promotion", label: "Promoción" },
  { id: "cta", label: "CTA" },
  { id: "date", label: "Fecha" },
  { id: "location", label: "Ubicación" },
  { id: "disclaimer", label: "Disclaimer" },
  { id: "free", label: "Texto libre" }
];

const priorities = [
  { id: "high", label: "Alta" },
  { id: "medium", label: "Media" },
  { id: "low", label: "Baja" }
];

const emotions = ["Premium", "Urgente", "Elegante", "Comercial", "Tecnológico", "Cercano", "Apetitoso", "Familiar", "Sofisticado", "Divertido"];
const visualElements = ["Producto", "Persona", "Ambiente", "Local o espacio", "Precio", "Fecha", "CTA", "Fondo limpio", "Textura o patrón de marca"];

const supportedModels = [
  { id: "gemini-3-pro-image", label: "Gemini Pro Imagen · profesional · aprox $2.50 MXN/img" },
  { id: "gemini-3.1-flash-image", label: "Gemini 3.1 Flash Imagen · balanceado · aprox $1.90 MXN/img" },
  { id: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Imagen · rápido · aprox $1.20 MXN/img" }
];

const attachmentRoles = [
  { id: "producto-principal", label: "Producto principal" },
  { id: "platillo-principal", label: "Platillo principal" },
  { id: "referencia-visual", label: "Referencia visual" },
  { id: "persona-principal", label: "Persona principal" },
  { id: "fondo-ambiente", label: "Fondo / ambiente" },
  { id: "promocion", label: "Promoción" }
];

const logoPositions = [
  { id: "top-left", label: "Arriba izquierda" },
  { id: "top-right", label: "Arriba derecha" },
  { id: "bottom-left", label: "Abajo izquierda" },
  { id: "bottom-right", label: "Abajo derecha" },
  { id: "bottom-center", label: "Centro inferior" }
];

const logoSizes = [
  { id: "small", label: "Chico" },
  { id: "medium", label: "Mediano" },
  { id: "large", label: "Grande" }
];

function emptyBlock(): TextBlock {
  return {
    id: `text-block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: "",
    role: "headline",
    priority: "high",
    instruction: "",
    locked: true
  };
}

function isImage(asset: ClientAsset) {
  const path = `${asset.fileUrl} ${asset.storagePath || ""}`.toLowerCase();
  return (asset.mimeType || "").startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(path) || path.includes("firebasestorage.googleapis.com");
}

function isLogo(asset: ClientAsset) {
  const value = `${asset.type} ${asset.category} ${(asset.tags || []).join(" ")} ${asset.name}`.toLowerCase();
  return isImage(asset) && (value.includes("logo") || value.includes("logotipo"));
}

function isTextAsset(asset: ClientAsset) {
  const value = `${asset.type} ${asset.category} ${(asset.tags || []).join(" ")} ${asset.name} ${(asset as any).text || ""}`.toLowerCase();
  return value.includes("bloque-texto") || asset.type === "texto" || asset.mimeType === "text/plain";
}

function getAssetCategory(asset: ClientAsset) {
  if (isLogo(asset)) return "Logos";
  if (isTextAsset(asset)) return "Textos";
  return asset.category || asset.type || "Otros";
}

function formatStatus(status?: string) {
  if (status === "completed") return "Generado";
  if (status === "generating") return "Generando";
  if (status === "error") return "Error";
  return status || "brief_ready";
}

function getGeneratedImageUrl(image: any) {
  if (!image) return "";
  if (image.imageDataUrl) return image.imageDataUrl;
  if (image.imageUrl) return image.imageUrl;
  if (image.base64) return `data:image/png;base64,${image.base64}`;
  return "";
}

export default function BustItNowPage() {
  const [tab, setTab] = useState<"brief" | "tareas" | "briefs" | "historial" | "mapa">("brief");
  const [clients, setClients] = useState<Brand[]>([]);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [history, setHistory] = useState<GenerationRequest[]>([]);
  const [generatedRecords, setGeneratedRecords] = useState<any[]>([]);
  const [assets, setAssets] = useState<ClientAsset[]>([]);
  const [clientId, setClientId] = useState("");
  const [format, setFormat] = useState("instagram-post");
  const [goal, setGoal] = useState("sell");
  const [contentType, setContentType] = useState("promotion");
  const [mainMessage, setMainMessage] = useState("");
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([emptyBlock()]);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [selectedVisualElements, setSelectedVisualElements] = useState<string[]>([]);
  const [specificInstructions, setSpecificInstructions] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("gemini-3-pro-image");
  const [variantCount, setVariantCount] = useState(1);
  const [attachment, setAttachment] = useState<RequestAttachment | null>(null);
  const [logoOverlayEnabled, setLogoOverlayEnabled] = useState(false);
  const [selectedLogoAssetId, setSelectedLogoAssetId] = useState("");
  const [logoPosition, setLogoPosition] = useState("bottom-right");
  const [logoSize, setLogoSize] = useState("medium");
  const [prompt, setPrompt] = useState("");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [assetCategoryFilter, setAssetCategoryFilter] = useState("all");
  const [textAssetRoleFilter, setTextAssetRoleFilter] = useState("all");
  const [savingTextAssetId, setSavingTextAssetId] = useState("");

  async function load() {
    const [c, r, h, g] = await Promise.all([
      listUniqueBrands(),
      listRequests(),
      listGenerationRequests(),
      listGeneratedImageRecords()
    ]);
    setClients(c.filter((item) => (item.status || "active") !== "deleted").sort((a, b) => a.name.localeCompare(b.name, "es")));
    setRequests(r.filter((item) => item.status !== "eliminada"));
    setHistory(h);
    setGeneratedRecords(g);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    setAssetCategoryFilter("all");
    setTextAssetRoleFilter("all");

    if (!clientId) {
      setAssets([]);
      setSelectedAssetIds([]);
      setSelectedLogoAssetId("");
      return;
    }

    listClientAssets(clientId).then((rows) => {
      const sorted = [...rows].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
      setAssets(sorted);
      setSelectedAssetIds([]);
      const firstLogo = sorted.find(isLogo);
      setSelectedLogoAssetId(firstLogo?.id || "");
    });
  }, [clientId]);

  const client = clients.find((item) => item.id === clientId);
  const billingMonth = new Date().toISOString().slice(0, 7);
  const aiBillingBalance = useMemo(() => client ? calculateClientBillingBalance({ client, month: billingMonth, requests: [], productions: [], generatedImages: generatedRecords }) : null, [client, billingMonth, generatedRecords]);
  const selectedAssets = useMemo(() => assets.filter((asset) => selectedAssetIds.includes(asset.id || "")), [assets, selectedAssetIds]);
  const logoAssets = useMemo(() => assets.filter(isLogo), [assets]);
  const visualAssetCategories = useMemo(() => {
    const categories: string[] = Array.from(new Set(assets.filter((asset) => !isTextAsset(asset)).map((asset) => String(getAssetCategory(asset))).filter(Boolean)));
    return categories.sort((a, b) => a.localeCompare(b, "es"));
  }, [assets]);
  const visibleAssets = useMemo(() => {
    return assets.filter((asset) => !isTextAsset(asset) && (assetCategoryFilter === "all" || getAssetCategory(asset) === assetCategoryFilter));
  }, [assets, assetCategoryFilter]);
  const textAssetRoleOptions = useMemo(() => {
    const values: string[] = Array.from(new Set(assets.filter(isTextAsset).map((asset) => String((asset as any).visualRole || asset.category || "free"))));
    return values.sort((a, b) => a.localeCompare(b, "es"));
  }, [assets]);
  const visibleTextAssets = useMemo(() => {
    return assets.filter((asset) => isTextAsset(asset) && (textAssetRoleFilter === "all" || ((asset as any).visualRole || asset.category || "free") === textAssetRoleFilter));
  }, [assets, textAssetRoleFilter]);
  const sentTasks = useMemo(
    () => requests.filter((item) => Boolean(item.generatorStatus) && (clientFilter === "all" || item.clientId === clientFilter)),
    [requests, clientFilter]
  );
  const filteredHistory = useMemo(
    () => history.filter((item) => clientFilter === "all" || item.clientId === clientFilter),
    [history, clientFilter]
  );

  const briefItems = useMemo(() => {
    return filteredHistory
      .slice()
      .sort((a, b) => String(b.id || "").localeCompare(String(a.id || "")));
  }, [filteredHistory]);

  const feedItems = useMemo(() => {
    return generatedRecords
      .filter((image) => clientFilter === "all" || image.clientId === clientFilter)
      .map((image) => {
        const relatedRequest = history.find((request) => request.id === image.requestId);
        return {
          image,
          request: (relatedRequest || {
            id: image.requestId,
            clientId: image.clientId,
            clientName: image.clientName,
            mainMessage: `Variante ${image.variantIndex || ""}`.trim(),
            format: "",
            goal: "",
            contentType: "",
            selectedEmotions: [],
            selectedVisualElements: [],
            specificInstructions: "",
            textBlocks: [],
            selectedAssetIds: [],
            selectedAssetsSnapshot: [],
            status: image.status || "generated",
            executedModel: image.executedModel || ""
          }) as GenerationRequest,
          imageUrl: getGeneratedImageUrl({ ...image, imageDataUrl: image.finalImageDataUrl || image.imageDataUrl })
        };
      })
      .filter((item) => item.imageUrl)
      .sort((a, b) => String(b.image.id || "").localeCompare(String(a.image.id || "")));
  }, [generatedRecords, clientFilter, history]);

  function toggle(value: string, arr: string[], setter: (values: string[]) => void) {
    setter(arr.includes(value) ? arr.filter((item) => item !== value) : [...arr, value]);
  }

  const toggleAsset = useCallback((assetId: string) => {
    if (!assetId) return;
    setSelectedAssetIds((current) => current.includes(assetId) ? current.filter((item) => item !== assetId) : [...current, assetId]);
  }, []);

  function addTextAssetToBrief(asset: ClientAsset) {
    const text = String((asset as any).text || asset.notes || asset.name || "").trim();
    if (!text) return;
    setTextBlocks((blocks) => [
      ...blocks,
      {
        ...emptyBlock(),
        text,
        role: String((asset as any).visualRole || asset.category || "free"),
        priority: String((asset as any).priority || "medium"),
        instruction: asset.notes || ""
      }
    ]);
    setSuccess("Bloque de texto agregado al brief.");
  }

  async function saveBlockAsAsset(block: TextBlock) {
    if (!client?.id) return alert("Selecciona un cliente antes de guardar el bloque como asset.");
    if (!block.text.trim()) return alert("Escribe texto antes de guardarlo como asset.");

    setSavingTextAssetId(block.id);
    setError("");
    setSuccess("");
    try {
      await saveClientTextAsset(client.id, client.name, {
        name: `${roles.find((role) => role.id === block.role)?.label || "Texto"}: ${block.text.slice(0, 42)}`,
        role: block.role,
        priority: block.priority,
        text: block.text.trim(),
        instruction: block.instruction.trim()
      });
      const rows = await listClientAssets(client.id);
      setAssets([...rows].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)));
      setSuccess("Bloque guardado como asset de texto.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el bloque como asset.");
    } finally {
      setSavingTextAssetId("");
    }
  }

  function updateBlock(id: string, patch: Partial<TextBlock>) {
    setTextBlocks((blocks) => blocks.map((block) => block.id === id ? { ...block, ...patch } : block));
  }

  function cleanBlocks() {
    return textBlocks
      .filter((block) => block.text.trim())
      .map((block) => ({ ...block, text: block.text.trim(), instruction: block.instruction.trim() }));
  }

  function loadTask(task: ContentRequest) {
    setClientId(task.clientId);
    setMainMessage(task.creativeIdea || task.keyMessage || task.topic || "");
    setTextBlocks([{ ...emptyBlock(), text: task.copyOut || task.copyIn || task.keyMessage || "", role: "headline", priority: "high" }]);
    setSpecificInstructions(`Viene de Content OS. Cliente: ${task.clientName}. Lote: ${task.batchName || "Sin lote"}. CTA: ${task.cta || ""}`);
    setTab("brief");
  }

  function handleAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setAttachment(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("La referencia puntual debe ser una imagen PNG, JPG o WEBP.");
      return;
    }
    setAttachment({ file, preview: URL.createObjectURL(file), name: file.name, role: "producto-principal", notes: "", mimeType: file.type });
  }

  function currentAttachmentSnapshot(requestAttachmentsOverride?: any[]) {
    if (requestAttachmentsOverride) return requestAttachmentsOverride;
    return attachment ? [{
      name: attachment.name,
      role: attachment.role,
      notes: attachment.notes,
      fileUrl: attachment.fileUrl || attachment.preview,
      mimeType: attachment.mimeType || attachment.file?.type || ""
    }] : [];
  }

  async function persistAttachmentForBrief() {
    if (!attachment) return [];
    if (attachment.fileUrl) return currentAttachmentSnapshot();
    if (!client?.id) throw new Error("Selecciona un cliente antes de guardar el brief.");

    if (!attachment.file) throw new Error("Selecciona una imagen puntual válida antes de guardar el brief.");
    const uploaded = await uploadReferenceFiles([attachment.file], `generation-briefs/${client.id}`);
    const first = uploaded[0];
    if (!first?.url) throw new Error("No se pudo subir la imagen puntual del brief.");

    const saved = {
      name: attachment.name,
      role: attachment.role,
      notes: attachment.notes,
      fileUrl: first.url,
      mimeType: first.type || attachment.file.type
    };

    setAttachment((current) => current ? { ...current, fileUrl: first.url, mimeType: first.type || current.file?.type || "" } : current);
    return [saved];
  }

  function buildPrompt(requestAttachmentsOverride?: any[]) {
    const logoAsset = assets.find((asset) => asset.id === selectedLogoAssetId);
    const built = buildGenerationPrompt({
      clientName: client?.name,
      clientIndustry: client?.industry,
      format,
      goal,
      contentType,
      mainMessage,
      textBlocks: cleanBlocks(),
      selectedEmotions,
      selectedVisualElements,
      specificInstructions,
      brandBrainSnapshot: client?.brandBrain || {
        brandDescription: client?.brandNotes,
        tone: client?.tone,
        visualStyle: client?.visualStyle ? [client.visualStyle] : [],
        dos: client?.contentPillars ? [client.contentPillars] : []
      },
      selectedAssetsSnapshot: selectedAssets,
      requestAttachments: currentAttachmentSnapshot(requestAttachmentsOverride),
      logoOverlay: logoOverlayEnabled ? {
        enabled: true,
        assetId: selectedLogoAssetId,
        assetName: logoAsset?.name,
        fileUrl: logoAsset?.fileUrl,
        position: logoPosition,
        size: logoSize
      } : { enabled: false }
    });
    setPrompt(built);
    return built;
  }

  async function saveBriefOnly(status = "brief_ready") {
    if (!client) return alert("Selecciona un cliente.");
    if (!mainMessage.trim()) return alert("Escribe el mensaje principal.");
    if (cleanBlocks().length === 0) return alert("Agrega al menos un bloque de texto.");
    const requestAttachments = await persistAttachmentForBrief();
    const built = buildPrompt(requestAttachments);
    const ref: any = await saveGenerationRequest({
      clientId: client.id!,
      clientName: client.name,
      clientIndustry: client.industry,
      mainMessage: mainMessage.trim(),
      format,
      goal,
      contentType,
      selectedEmotions,
      selectedVisualElements,
      specificInstructions: specificInstructions.trim(),
      textBlocks: cleanBlocks(),
      selectedAssetIds,
      selectedAssetsSnapshot: selectedAssets,
      requestAttachments,
      brandBrainSnapshot: client.brandBrain,
      logoOverlay: { enabled: logoOverlayEnabled, assetId: selectedLogoAssetId, position: logoPosition, size: logoSize },
      generatedPrompt: built,
      executedModel: selectedModel,
      status
    });
    setSuccess("Brief guardado en Briefs.");
    await load();
    return ref?.id || "";
  }

  async function generate() {
    if (aiBillingBalance && aiBillingBalance.includedAiGenerations > 0) {
      const projected = aiBillingBalance.aiGenerations + variantCount;
      if (projected > aiBillingBalance.includedAiGenerations && !aiBillingBalance.onDemandEnabled) {
        setError(`Este cliente tiene límite de ${aiBillingBalance.includedAiGenerations} generaciones IA al mes. Ya lleva ${aiBillingBalance.aiGenerations}. Ajusta el límite o activa cobro bajo demanda en Clientes.`);
        return;
      }
    }
    setError("");
    setSuccess("");
    setGeneratedImages([]);
    if (!client) return alert("Selecciona un cliente.");
    setLoading(true);
    let requestId = "";
    try {
      requestId = await saveBriefOnly("generating") || "";
      const built = prompt || buildPrompt();
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: built,
          format,
          model: selectedModel,
          variantCount,
          referenceImages: selectedAssets.map((asset) => ({ url: asset.fileUrl, name: asset.name }))
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo generar.");
      setGeneratedImages(payload.imagesBase64 || []);
      if (requestId) await updateGenerationRequest(requestId, { status: "completed", executedModel: payload.executedModel, generationMode: payload.generationMode });
      setSuccess("Imagen generada correctamente.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar.");
      if (requestId) await updateGenerationRequest(requestId, { status: "error" });
    } finally {
      setLoading(false);
    }
  }

  function openHistoryItem(item: GenerationRequest) {
    setClientId(item.clientId);
    setMainMessage(item.mainMessage);
    setFormat(item.format);
    setGoal(item.goal);
    setContentType(item.contentType);
    setTextBlocks((item.textBlocks as any) || [emptyBlock()]);
    setSelectedEmotions(item.selectedEmotions || []);
    setSelectedVisualElements(item.selectedVisualElements || []);
    setSpecificInstructions(item.specificInstructions || "");
    const savedAttachment = (item.requestAttachments || [])[0] as any;
    setAttachment(savedAttachment?.fileUrl ? {
      preview: savedAttachment.fileUrl,
      name: savedAttachment.name || "Imagen puntual del brief",
      role: savedAttachment.role || "referencia-visual",
      notes: savedAttachment.notes || "",
      fileUrl: savedAttachment.fileUrl,
      mimeType: savedAttachment.mimeType || ""
    } : null);
    setPrompt(item.generatedPrompt || "");
    setTab("brief");
  }

  return (
    <AppShell active="BUST It Now">
      <main className="min-h-screen bg-zinc-100 text-zinc-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <header className="hero generator-apple-hero">
            <div className="generator-hero-copy">
              <p className="eyebrow">BUST It Now</p>
              <h1>Generador de piezas</h1>
              <p>Selecciona una marca, carga su Brand Brain, reutiliza sus bloques de texto y elige los assets que sí deben viajar al request.</p>
            </div>
          </header>

          <nav className="flex flex-wrap gap-2">
            {[
              ["brief", "Nuevo brief"],
              ["tareas", "Solicitudes desde Tareas"],
              ["briefs", "Briefs"],
              ["historial", "Historial"],
              ["mapa", "Integración"]
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id as any)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === id ? "bg-zinc-950 text-white" : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950"}`}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === "brief" ? (
            <>
              <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-6 rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
                  <section>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">1. Selecciona la marca</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Contexto automático del cliente</h2>
                    <select
                      value={clientId}
                      onChange={(event) => setClientId(event.target.value)}
                      className="mt-5 h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-base outline-none transition focus:border-zinc-950 focus:bg-white"
                    >
                      <option value="">Selecciona un cliente</option>
                      {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>

                    {client ? (
                      <div className="mt-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Cliente</p>
                        <p className="mt-2 text-lg font-semibold text-zinc-950">{client.name}</p>
                        <p className="mt-1 text-sm text-zinc-600">{client.industry || "Sin categoría"}</p>
                        {aiBillingBalance ? <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-zinc-700">IA mes: {aiBillingBalance.aiGenerations}/{aiBillingBalance.includedAiGenerations || "sin límite"} · Bajo demanda {aiBillingBalance.onDemandEnabled ? "activo" : "inactivo"}</p> : null}
                      </div>
                    ) : null}
                  </section>

                  <section className="border-t border-zinc-200 pt-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">2. Define la pieza</p>
                    <div className="mt-5 grid gap-5 md:grid-cols-3">
                      <FieldSelect label="Formato" value={format} onChange={setFormat} options={formats} />
                      <FieldSelect label="Objetivo" value={goal} onChange={setGoal} options={goals} />
                      <FieldSelect label="Tipo de contenido" value={contentType} onChange={setContentType} options={contentTypes} />
                      <FieldSelect label="Modelo" value={selectedModel} onChange={setSelectedModel} options={supportedModels} />
                      <FieldSelect label="Variantes" value={String(variantCount)} onChange={(value) => setVariantCount(Number(value))} options={[
                        { id: "1", label: "1 variante" },
                        { id: "2", label: "2 variantes" },
                        { id: "4", label: "4 variantes" }
                      ]} />
                    </div>
                  </section>

                  <section className="border-t border-zinc-200 pt-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">3. Mensaje y bloques de texto</p>
                    <div className="mt-5 space-y-2">
                      <label className="text-sm font-medium text-zinc-800">Mensaje principal</label>
                      <textarea
                        value={mainMessage}
                        onChange={(event) => setMainMessage(event.target.value)}
                        className="min-h-28 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-950 focus:bg-white"
                        placeholder="Ej. Promo del lanzamiento con 20% de descuento."
                      />
                    </div>

                    <div className="mt-6 flex justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold">Bloques de texto</h3>
                        <p className="mt-1 text-sm text-zinc-500">Estos textos viajan como texto oficial al diseño.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTextBlocks([...textBlocks, emptyBlock()])}
                        className="h-11 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold transition hover:bg-zinc-50"
                      >
                        Agregar bloque
                      </button>
                    </div>

                    <div className="mt-5 space-y-4">
                      {textBlocks.map((block) => (
                        <div key={block.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                          <textarea
                            value={block.text}
                            onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                            className="min-h-20 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-950"
                            placeholder="Texto exacto que debe aparecer"
                          />
                          <div className="mt-3 grid gap-3 md:grid-cols-4">
                            <FieldSelect label="Rol visual" value={block.role} onChange={(value) => updateBlock(block.id, { role: value })} options={roles} />
                            <FieldSelect label="Prioridad" value={block.priority} onChange={(value) => updateBlock(block.id, { priority: value })} options={priorities} />
                            <button
                              type="button"
                              onClick={() => saveBlockAsAsset(block)}
                              disabled={savingTextAssetId === block.id || !block.text.trim()}
                              className="mt-6 h-11 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
                            >
                              {savingTextAssetId === block.id ? "Guardando..." : "Guardar asset"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setTextBlocks(textBlocks.length > 1 ? textBlocks.filter((item) => item.id !== block.id) : [emptyBlock()])}
                              className="mt-6 h-11 rounded-2xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Eliminar
                            </button>
                          </div>
                          <input
                            value={block.instruction}
                            onChange={(event) => updateBlock(block.id, { instruction: event.target.value })}
                            className="mt-3 h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-950"
                            placeholder="Instrucción específica para este texto"
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="border-t border-zinc-200 pt-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">4. Referencia específica de esta pieza</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">Sube aquí un producto, platillo o imagen puntual que deba considerarse solo para este brief.</p>
                    <div className="mt-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                      <label className="mb-3 block text-sm font-medium text-zinc-800">Imagen puntual</label>
                      <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800">
                        Seleccionar archivo
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAttachment} className="sr-only" />
                      </label>
                      <span className="ml-3 align-middle text-sm text-zinc-500">{attachment?.name || "Sin archivo seleccionado"}</span>

                      {attachment ? (
                        <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
                          <div>
                            <img src={attachment.preview} alt={attachment.name} className="h-44 w-full rounded-2xl object-cover" />
                          </div>
                          <div className="grid gap-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-800">Nombre del archivo</label>
                                <input
                                  value={attachment.name}
                                  onChange={(event) => setAttachment({ ...attachment, name: event.target.value })}
                                  className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-950"
                                  placeholder="Ej. Hamburguesa doble"
                                />
                              </div>
                              <FieldSelect label="Rol de la imagen" value={attachment.role} onChange={(value) => setAttachment({ ...attachment, role: value })} options={attachmentRoles} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-zinc-800">Instrucción sobre este archivo</label>
                              <textarea
                                value={attachment.notes}
                                onChange={(event) => setAttachment({ ...attachment, notes: event.target.value })}
                                className="min-h-24 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-950"
                                placeholder="Ej. usar este producto como protagonista, respetar su forma y hacerlo el elemento principal del diseño"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setAttachment(null)}
                              className="h-11 rounded-2xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Quitar referencia puntual
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500">Aún no hay imagen puntual seleccionada para esta pieza.</div>
                      )}
                    </div>
                  </section>

                  <section className="border-t border-zinc-200 pt-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">5. Dirección visual</p>
                    <ChipGroup values={emotions} selected={selectedEmotions} onToggle={(value) => toggle(value, selectedEmotions, setSelectedEmotions)} />
                    <ChipGroup values={visualElements} selected={selectedVisualElements} onToggle={(value) => toggle(value, selectedVisualElements, setSelectedVisualElements)} />
                    <textarea
                      value={specificInstructions}
                      onChange={(event) => setSpecificInstructions(event.target.value)}
                      className="mt-5 min-h-24 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-950 focus:bg-white"
                      placeholder="Instrucciones puntuales"
                    />
                  </section>
                </div>

                <aside className="space-y-6">
                  <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Contexto leído</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Brand Brain</h2>
                    <div className="mt-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-5 text-sm leading-6 text-zinc-700">
                      <strong>{client?.name || "Selecciona cliente"}</strong><br />
                      Tono: {client?.brandBrain?.tone || client?.tone || "Pendiente"}<br />
                      Colores: {(client?.brandBrain?.colors || []).join(", ") || "Pendiente"}<br />
                      Tipografía: {client?.brandBrain?.typography || "Pendiente"}<br />
                      Assets: {assets.length}
                    </div>
                  </section>

                  <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Assets del cliente</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Elegir para este brief</h2>
                    <p className="mt-2 text-xs text-zinc-500">Los assets empiezan sin preselección. Los seleccionados se iluminan en verde.</p>
                    {visualAssetCategories.length ? (
                      <PillFilter
                        className="mt-4"
                        options={[{ id: "all", label: "Todos" }, ...visualAssetCategories.map((category) => ({ id: category, label: category }))]}
                        value={assetCategoryFilter}
                        onChange={setAssetCategoryFilter}
                      />
                    ) : null}
                    {assets.length === 0 ? (
                      <p className="mt-4 text-sm text-zinc-500">Selecciona cliente para ver assets.</p>
                    ) : (
                      <AssetPicker assets={visibleAssets} selectedAssetIds={selectedAssetIds} onToggle={toggleAsset} />
                    )}
                  </section>

                  <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Assets de texto</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Bloques guardados</h2>
                    <p className="mt-2 text-xs text-zinc-500">Filtra por rol visual y da clic para reutilizar un bloque en este brief.</p>
                    {textAssetRoleOptions.length ? (
                      <PillFilter
                        className="mt-4"
                        options={[{ id: "all", label: "Todos" }, ...textAssetRoleOptions.map((role) => ({ id: role, label: roles.find((item) => item.id === role)?.label || role }))]}
                        value={textAssetRoleFilter}
                        onChange={setTextAssetRoleFilter}
                      />
                    ) : null}
                    {visibleTextAssets.length ? (
                      <div className="mt-5 grid gap-3">
                        {visibleTextAssets.map((asset) => (
                          <button key={asset.id} type="button" onClick={() => addTextAssetToBrief(asset)} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50">
                            <div className="flex items-center justify-between gap-3">
                              <strong className="text-sm text-zinc-950">{asset.name}</strong>
                              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{roles.find((item) => item.id === ((asset as any).visualRole || asset.category))?.label || (asset as any).visualRole || asset.category}</span>
                            </div>
                            <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-600">{String((asset as any).text || asset.notes || "")}</p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-zinc-500">Aún no hay bloques de texto guardados como assets.</p>
                    )}
                  </section>

                  <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Acciones</p>
                    <div className="mt-5 grid gap-3">
                      <button type="button" onClick={() => buildPrompt()} className="h-12 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-50">Construir prompt</button>
                      <button type="button" onClick={() => saveBriefOnly()} className="h-12 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800">Guardar brief de generación</button>
                    </div>
                    {error ? <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">{error}</div> : null}
                    {success ? <div className="mt-5 rounded-3xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-medium text-green-700">{success}</div> : null}
                  </section>
                </aside>
              </section>

              {prompt ? (
                <section className="rounded-[2rem] border border-zinc-200 bg-zinc-950 p-6 text-white shadow-sm sm:p-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Prompt construido</p>
                  <pre className="mt-5 max-h-[460px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-zinc-200">{prompt}</pre>
                </section>
              ) : null}

            </>
          ) : null}

          {tab === "tareas" ? (
            <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-semibold tracking-tight">Solicitudes enviadas desde Tareas</h2>
              <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="mt-5 h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm">
                <option value="all">Todos los clientes</option>
                {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {sentTasks.map((task) => (
                  <article key={task.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                    <strong>{task.clientName} · {task.contentType}</strong>
                    <p className="mt-2 text-sm text-zinc-600">Lote: {task.batchName || "Sin lote"} · Estado: {task.generatorStatus}</p>
                    <p className="mt-3 text-sm leading-6 text-zinc-700">{task.creativeIdea}</p>
                    <button type="button" onClick={() => loadTask(task)} className="mt-4 rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">Abrir en generador</button>
                  </article>
                ))}
              </div>
              {!sentTasks.length ? <p className="mt-5 text-sm text-zinc-500">No hay solicitudes enviadas desde Tareas.</p> : null}
            </section>
          ) : null}

          {tab === "briefs" ? (
            <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Briefs</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Briefs listos para generar</h2>
                  <p className="mt-2 text-sm text-zinc-600">Aquí vive cada brief guardado. Desde esta vista abres el brief y generas las variantes que necesites.</p>
                </div>
                <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm">
                  <option value="all">Todos los clientes</option>
                  {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>

              {briefItems.length === 0 ? (
                <p className="mt-5 text-sm text-zinc-500">No hay briefs guardados.</p>
              ) : (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {briefItems.map((request) => (
                    <article key={request.id} className="rounded-[1.7rem] border border-zinc-200 bg-zinc-50 p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-xs font-bold text-white">{request.clientName?.slice(0, 1) || "B"}</div>
                        <div>
                          <strong className="block text-sm text-zinc-950">{request.clientName}</strong>
                          <span className="text-xs text-zinc-500">{formatStatus(request.status)}</span>
                        </div>
                      </div>
                      <p className="mt-4 line-clamp-3 text-sm font-semibold leading-6 text-zinc-950">{request.mainMessage}</p>
                      <p className="mt-2 text-xs text-zinc-500">{request.format} · {request.contentType} · {request.executedModel || "Sin modelo"}</p>
                      {(request.requestAttachments || []).length ? <p className="mt-2 text-xs font-medium text-zinc-700">Incluye imagen puntual del brief</p> : null}
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => openHistoryItem(request)} className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-50">Reusar brief</button>
                        {request.id ? <Link href={`/dashboard/generador/${request.id}`} className="rounded-2xl bg-zinc-950 px-3 py-2 text-center text-xs font-semibold text-white">Abrir / generar</Link> : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {tab === "historial" ? (
            <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Historial</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Feed de generaciones</h2>
                  <p className="mt-2 text-sm text-zinc-600">Vista tipo Instagram con la imagen generada de cada request.</p>
                </div>
                <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm">
                  <option value="all">Todos los clientes</option>
                  {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>

              {feedItems.length === 0 ? (
                <p className="mt-5 text-sm text-zinc-500">No hay generaciones en historial.</p>
              ) : (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {feedItems.map(({ request, image, imageUrl }) => (
                    <article key={image.id || `${request.id}-${image.variantIndex}`} className="overflow-hidden rounded-[1.7rem] border border-zinc-200 bg-zinc-50 shadow-sm">
                      <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950 text-xs font-bold text-white">{request.clientName?.slice(0, 1) || "B"}</div>
                        <div>
                          <strong className="block text-sm text-zinc-950">{request.clientName}</strong>
                          <span className="text-xs text-zinc-500">{formatStatus(request.status)}</span>
                        </div>
                      </div>
                      {imageUrl ? (
                        <a href={imageUrl} target="_blank" rel="noopener noreferrer" title="Abrir imagen en ventana nueva">
                          <img src={imageUrl} alt={request.mainMessage} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                        </a>
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center bg-zinc-200 p-6 text-center text-sm font-medium text-zinc-500">Sin imagen generada</div>
                      )}
                      <div className="space-y-3 bg-white p-4">
                        <p className="line-clamp-2 text-sm font-semibold text-zinc-950">{request.mainMessage}</p>
                        <p className="text-xs text-zinc-500">{request.format} · {request.contentType} · {request.executedModel || "Sin modelo"}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => openHistoryItem(request)} className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-50">Reusar</button>
                          {request.id ? <Link href={`/dashboard/generador/${request.id}`} className="rounded-2xl bg-zinc-950 px-3 py-2 text-center text-xs font-semibold text-white">Abrir</Link> : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {tab === "mapa" ? (
            <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-semibold tracking-tight">Integración real</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <Info title="clients.brandBrain" text="Memoria de marca real." />
                <Info title="clientAssets" text="Assets con metadata múltiple." />
                <Info title="generationRequests" text="Briefs, historial y prompts." />
                <Info title="contentRequests" text="Solicitudes desde Tareas." />
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}

function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { id: string; label: string }[] }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-800">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none transition focus:border-zinc-950 focus:bg-white">
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </div>
  );
}

function ChipGroup({ values, selected, onToggle }: { values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {values.map((value) => (
        <button key={value} type="button" onClick={() => onToggle(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${selected.includes(value) ? "bg-zinc-950 text-white" : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950"}`}>
          {value}
        </button>
      ))}
    </div>
  );
}

function PillFilter({ options, value, onChange, className = "" }: { options: { id: string; label: string }[]; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${value === option.id ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" : "border border-zinc-200 bg-white text-zinc-700 hover:border-emerald-400 hover:text-emerald-700"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const AssetPicker = memo(function AssetPicker({ assets, selectedAssetIds, onToggle }: { assets: ClientAsset[]; selectedAssetIds: string[]; onToggle: (assetId: string) => void }) {
  if (!assets.length) return <p className="mt-4 text-sm text-zinc-500">No hay assets para este filtro.</p>;

  return (
    <div className="mt-5 grid grid-cols-3 gap-2">
      {assets.map((asset) => {
        const selected = selectedAssetIds.includes(asset.id || "");
        return (
          <button
            type="button"
            key={asset.id}
            onClick={() => onToggle(asset.id || "")}
            className={`group relative overflow-hidden rounded-2xl border-2 text-left transition ${selected ? "border-emerald-500 ring-4 ring-emerald-200 shadow-lg shadow-emerald-100" : "border-zinc-200 hover:border-emerald-400"}`}
          >
            {isImage(asset) ? (
              <img src={asset.fileUrl} alt={asset.name} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-zinc-200 text-xs font-semibold text-zinc-600">Archivo</div>
            )}
            <span className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow ${selected ? "bg-emerald-500 text-white" : "bg-white text-zinc-950"}`}>{selected ? "✓" : "+"}</span>
          </button>
        );
      })}
    </div>
  );
});

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
      <strong>{title}</strong>
      <p className="mt-2 text-sm text-zinc-600">{text}</p>
    </div>
  );
}
