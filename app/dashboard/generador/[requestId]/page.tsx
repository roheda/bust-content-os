"use client";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { authJsonHeaders } from "@/lib/client-auth";
import { buildGenerationPrompt } from "@/lib/build-generation-prompt";
import {
  Brand,
  ClientAsset,
  GenerationRequest,
  calculateClientBillingBalance,
  getGenerationRequest,
  listClientAssets,
  listGeneratedImageRecords,
  listUniqueBrands,
  saveGeneratedImageRecord,
  updateGeneratedImageRecord,
  updateGenerationRequest,
  uploadGeneratedImageDataUrl
} from "@/lib/data";

type LogoOverlayXY = {
  enabled: boolean;
  assetId?: string;
  assetName?: string;
  fileUrl?: string;
  logoKind?: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
};

type GeneratedLocalImage = {
  id: string;
  base64: string;
  originalBase64?: string;
  finalBase64?: string;
  logoOverlayApplied?: boolean;
  variantKind?: "reference-ai" | "editable-base" | "single";
  variantLabel?: string;
  variantPairIndex?: number;
};

type EditableTextLayer = {
  id: string;
  text: string;
  role: string;
  enabled: boolean;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  sizePercent: number;
  color: string;
  backgroundColor: string;
  backgroundEnabled: boolean;
  align: "left" | "center" | "right";
  weight: number;
  fontFamily?: string;
  uppercase: boolean;
};

const models = [
  { id: "gemini-3-pro-image", label: "Gemini Pro Imagen · profesional · aprox $2.50 MXN/img" },
  { id: "gemini-3.1-flash-image", label: "Gemini 3.1 Flash Imagen · balanceado · aprox $1.90 MXN/img" },
  { id: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Imagen · rápido · aprox $1.20 MXN/img" }
];

const logoKinds = [
  { id: "logotipo", label: "Logotipo horizontal" },
  { id: "imagotipo", label: "Imagotipo" },
  { id: "isotipo", label: "Isotipo / símbolo" },
  { id: "monograma", label: "Monograma" },
  { id: "logo-blanco", label: "Logo blanco" },
  { id: "logo-color", label: "Logo a color" }
];

const logoPresets = [
  { id: "bottom-right", label: "Inferior derecha", xPercent: 86, yPercent: 88, widthPercent: 20 },
  { id: "bottom-left", label: "Inferior izquierda", xPercent: 14, yPercent: 88, widthPercent: 20 },
  { id: "bottom-center", label: "Centro inferior", xPercent: 50, yPercent: 88, widthPercent: 22 },
  { id: "top-right", label: "Superior derecha", xPercent: 86, yPercent: 12, widthPercent: 18 },
  { id: "top-left", label: "Superior izquierda", xPercent: 14, yPercent: 12, widthPercent: 18 },
  { id: "center", label: "Centro", xPercent: 50, yPercent: 50, widthPercent: 26 }
];

function isImage(asset: ClientAsset) {
  const path = `${asset.fileUrl} ${asset.storagePath || ""}`.toLowerCase();
  return (asset.mimeType || "").startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(path) || path.includes("firebasestorage.googleapis.com");
}

function isLogo(asset: ClientAsset) {
  const value = `${asset.type} ${asset.category} ${(asset.tags || []).join(" ")} ${asset.name}`.toLowerCase();
  return isImage(asset) && (
    value.includes("logo") ||
    value.includes("logotipo") ||
    value.includes("imagotipo") ||
    value.includes("isotipo") ||
    value.includes("monograma")
  );
}

function isTextAsset(asset: ClientAsset) {
  const value = `${asset.type} ${asset.category} ${(asset.tags || []).join(" ")} ${asset.name} ${(asset as any).text || ""}`.toLowerCase();
  return value.includes("bloque-texto") || asset.type === "texto" || asset.mimeType === "text/plain";
}

function isFontAsset(asset: ClientAsset) {
  const value = `${asset.type} ${asset.category} ${(asset.tags || []).join(" ")} ${asset.name} ${asset.mimeType || ""} ${(asset as any).originalFileName || ""}`.toLowerCase();
  return asset.type === "font" || value.includes("tipografia") || value.includes("fuente") || /\.(otf|ttf|woff2?|eot)(\?|$)/i.test(`${asset.fileUrl || ""} ${asset.storagePath || ""}`);
}

function fontFamilyFromAsset(asset: ClientAsset) {
  return String((asset as any).fontFamily || `BUST-Font-${asset.id || asset.name}`).replace(/"/g, "");
}

function safeFontFamily(value?: string) {
  return String(value || "Arial").replace(/"/g, "");
}

function quoteFontFamily(value?: string) {
  return `"${safeFontFamily(value)}"`;
}

function fontFormatFromUrl(url?: string, mimeType?: string) {
  const source = `${url || ""} ${mimeType || ""}`.toLowerCase();
  if (source.includes("woff2")) return "woff2";
  if (source.includes("woff")) return "woff";
  if (source.includes("ttf") || source.includes("truetype")) return "truetype";
  if (source.includes("otf") || source.includes("opentype")) return "opentype";
  return "opentype";
}

function proxiedFontUrl(asset: ClientAsset) {
  if (!asset.fileUrl) return "";
  const direct = String(asset.fileUrl);
  if (direct.startsWith("/api/font-proxy")) return direct;
  if (direct.startsWith("/")) return direct;
  return `/api/font-proxy?url=${encodeURIComponent(direct)}&name=${encodeURIComponent(asset.name || (asset as any).originalFileName || "font")}`;
}

function proxiedImageUrl(source: string) {
  const direct = String(source || "");
  if (!direct || direct.startsWith("data:image/") || direct.startsWith("blob:")) return direct;
  if (direct.startsWith("/api/image-proxy") || direct.startsWith("/")) return direct;
  if (direct.startsWith("http")) return `/api/image-proxy?url=${encodeURIComponent(direct)}`;
  return direct;
}

function fontAssetStyleId(asset: ClientAsset) {
  return `bust-font-${String(asset.id || fontFamilyFromAsset(asset)).replace(/[^a-z0-9_-]+/gi, "-")}`;
}

function normalizeHexColor(value: string) {
  const source = String(value || "").trim();
  const match = source.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  if (!match) return "";
  const raw = match[1];
  if (raw.length === 3) return `#${raw.split("").map((char) => `${char}${char}`).join("")}`.toUpperCase();
  return `#${raw}`.toUpperCase();
}

function colorNameToHex(value: string) {
  const source = String(value || "").toLowerCase();
  const colorMap: Record<string, string> = {
    blanco: "#FFFFFF", white: "#FFFFFF",
    negro: "#000000", black: "#000000",
    naranja: "#F97316", orange: "#F97316",
    amarillo: "#FACC15", yellow: "#FACC15",
    rojo: "#EF4444", red: "#EF4444",
    azul: "#2563EB", blue: "#2563EB",
    verde: "#22C55E", green: "#22C55E",
    morado: "#7C3AED", purple: "#7C3AED",
    rosa: "#EC4899", pink: "#EC4899",
    gris: "#6B7280", gray: "#6B7280", grey: "#6B7280",
    beige: "#EDEAE6", crema: "#F5F0E6", cream: "#F5F0E6",
  };
  return Object.entries(colorMap).find(([name]) => source.includes(name))?.[1] || "";
}

function extractBrandColors(...sources: any[]) {
  const values = sources.flatMap((source) => {
    if (!source) return [];
    if (Array.isArray(source)) return source;
    return String(source).split(/[\n,;/|]+/g);
  });
  const colors: { label: string; value: string }[] = [];
  values.forEach((raw) => {
    const label = String(raw || "").trim();
    const value = normalizeHexColor(label) || colorNameToHex(label);
    if (!value || colors.some((item) => item.value === value)) return;
    colors.push({ label: label || value, value });
  });
  return colors;
}

function getAssetCategory(asset: ClientAsset) {
  if (isLogo(asset)) return "Logos";
  if (isTextAsset(asset)) return "Textos";
  return asset.category || asset.type || "Otros";
}

function dataUrlFromBase64(base64: string) {
  if (base64.startsWith("data:image/") || base64.startsWith("http") || base64.startsWith("blob:")) return base64;
  return `data:image/png;base64,${base64}`;
}

function cleanBase64(value: string) {
  if (value.startsWith("http") || value.startsWith("blob:")) return value;
  return value.includes(",") ? value.split(",").pop() || "" : value;
}

function isRemoteImageSource(value: string) {
  return value.startsWith("http") || value.startsWith("blob:");
}

function formatStatus(status?: string) {
  if (status === "completed") return "completed";
  if (status === "generating") return "generating";
  if (status === "error") return "error";
  return status || "brief_ready";
}

function defaultLayerFromBlock(block: any, index: number): EditableTextLayer {
  const role = String(block?.role || "free");
  const priority = String(block?.priority || "medium");
  const roleDefaults: Record<string, Partial<EditableTextLayer>> = {
    headline: { xPercent: 50, yPercent: 18, widthPercent: 78, sizePercent: 8.2, color: "#ffffff", align: "center", weight: 900, uppercase: false },
    subheadline: { xPercent: 50, yPercent: 28, widthPercent: 74, sizePercent: 4.8, color: "#ffffff", align: "center", weight: 700 },
    claim: { xPercent: 50, yPercent: 36, widthPercent: 70, sizePercent: 4.4, color: "#ffffff", align: "center", weight: 800 },
    badge: { xPercent: 50, yPercent: 12, widthPercent: 42, sizePercent: 3.4, color: "#111827", backgroundEnabled: true, backgroundColor: "#9EFC7B", align: "center", weight: 900 },
    bullet: { xPercent: 50, yPercent: 43, widthPercent: 70, sizePercent: 4.2, color: "#f97316", align: "center", weight: 900 },
    price: { xPercent: 50, yPercent: 48, widthPercent: 60, sizePercent: 6.8, color: "#ffffff", align: "center", weight: 900 },
    promotion: { xPercent: 50, yPercent: 44, widthPercent: 68, sizePercent: 4.8, color: "#f97316", align: "center", weight: 900 },
    cta: { xPercent: 50, yPercent: 78, widthPercent: 54, sizePercent: 4.4, color: "#ffffff", backgroundEnabled: true, backgroundColor: "#f97316", align: "center", weight: 900 },
    date: { xPercent: 50, yPercent: 86, widthPercent: 70, sizePercent: 3.2, color: "#ffffff", align: "center", weight: 600 },
    location: { xPercent: 50, yPercent: 88, widthPercent: 70, sizePercent: 3.0, color: "#ffffff", align: "center", weight: 600 },
    disclaimer: { xPercent: 50, yPercent: 94, widthPercent: 82, sizePercent: 2.6, color: "#ffffff", align: "center", weight: 500 },
    free: { xPercent: 50, yPercent: Math.min(88, 22 + index * 10), widthPercent: 72, sizePercent: 3.8, color: "#ffffff", align: "center", weight: 700 }
  };
  const fallbackSize = priority === "high" ? 5.4 : priority === "low" ? 2.8 : 4.0;
  return {
    id: String(block?.id || `layer-${index}-${Date.now()}`),
    text: String(block?.text || ""),
    role,
    enabled: true,
    xPercent: 50,
    yPercent: Math.min(92, 18 + index * 9),
    widthPercent: 72,
    sizePercent: fallbackSize,
    color: "#ffffff",
    backgroundColor: "#111827",
    backgroundEnabled: false,
    align: "center",
    weight: priority === "high" ? 900 : priority === "low" ? 500 : 700,
    fontFamily: "Arial",
    uppercase: false,
    ...roleDefaults[role]
  } as EditableTextLayer;
}

function buildDefaultTextLayers(blocks?: any[]): EditableTextLayer[] {
  return (blocks || []).filter((block) => String(block?.text || "").trim()).map((block, index) => defaultLayerFromBlock(block, index));
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export default function GenerationRequestPage() {
  const { requestId } = useParams<{ requestId: string }>();

  const [request, setRequest] = useState<GenerationRequest | null>(null);
  const [assets, setAssets] = useState<ClientAsset[]>([]);
  const [client, setClient] = useState<Brand | null>(null);
  const [allGeneratedRecords, setAllGeneratedRecords] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState("gemini-3-pro-image");
  const [variantCount, setVariantCount] = useState(1);
  const [useReferences, setUseReferences] = useState(true);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedLocalImage[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplyingLogo, setIsApplyingLogo] = useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [assetCategoryFilter, setAssetCategoryFilter] = useState("all");
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [textLayers, setTextLayers] = useState<EditableTextLayer[]>([]);
  const [downloadTextLoading, setDownloadTextLoading] = useState(false);
  const [fontLoadStatus, setFontLoadStatus] = useState<Record<string, "loading" | "ready" | "error">>({});

  const [logoOverlay, setLogoOverlay] = useState<LogoOverlayXY>({
    enabled: false,
    assetId: "",
    assetName: "",
    fileUrl: "",
    logoKind: "logotipo",
    xPercent: 86,
    yPercent: 88,
    widthPercent: 20
  });

  async function load() {
    const found = await getGenerationRequest(requestId);
    setRequest(found);
    setTextLayers(Array.isArray((found as any)?.editableTextLayers) && (found as any).editableTextLayers.length ? (found as any).editableTextLayers : buildDefaultTextLayers((found as any)?.textBlocks));

    const [generatedRecords, brands] = await Promise.all([listGeneratedImageRecords(), listUniqueBrands()]);
    setAllGeneratedRecords(generatedRecords);
    setClient(brands.find((brand) => brand.id === found?.clientId) || null);
    const previousImages = generatedRecords
      .filter((record) => record.requestId === requestId)
      .sort((a, b) => {
        const pairA = Number(a.variantPairIndex || a.variantIndex || 0);
        const pairB = Number(b.variantPairIndex || b.variantIndex || 0);
        if (pairA !== pairB) return pairA - pairB;
        const order = (kind: string) => kind === "reference-ai" ? 0 : kind === "editable-base" ? 1 : 2;
        return order(String(a.variantKind || "single")) - order(String(b.variantKind || "single"));
      })
      .map((record) => {
        const original = record.originalImageUrl || record.originalImageDataUrl || record.imageUrl || record.imageDataUrl || "";
        const final = record.finalImageUrl || record.finalImageDataUrl || (record.logoOverlayApplied ? (record.imageUrl || record.imageDataUrl) : "");
        const variantKind = record.variantKind || record.renderMode || "single";
        return {
          id: record.id,
          base64: cleanBase64(original),
          originalBase64: cleanBase64(original),
          finalBase64: final ? cleanBase64(final) : undefined,
          logoOverlayApplied: Boolean(record.logoOverlayApplied),
          variantKind,
          variantLabel: record.variantLabel || (variantKind === "reference-ai" ? "Referencia IA" : variantKind === "editable-base" ? "Base editable" : `Variante ${record.variantIndex || ""}`),
          variantPairIndex: Number(record.variantPairIndex || record.variantIndex || 0)
        };
      })
      .filter((image) => image.base64);
    setGeneratedImages(previousImages);

    if (found?.clientId) {
      const clientAssets = await listClientAssets(found.clientId);
      setAssets(clientAssets);

      const selected = found.selectedAssetIds?.length ? found.selectedAssetIds : [];

      setSelectedAssetIds(selected.filter(Boolean));
      setAssetCategoryFilter("all");

      const existingLogoOverlay = (found as any).logoOverlay || {};
      const logos = clientAssets.filter(isLogo);
      const firstLogo = existingLogoOverlay.assetId
        ? clientAssets.find((asset) => asset.id === existingLogoOverlay.assetId)
        : logos[0];

      setLogoOverlay({
        enabled: existingLogoOverlay.enabled === true,
        assetId: firstLogo?.id || "",
        assetName: firstLogo?.name || "",
        fileUrl: firstLogo?.fileUrl || "",
        logoKind: existingLogoOverlay.logoKind || inferLogoKind(firstLogo),
        xPercent: Number(existingLogoOverlay.xPercent ?? 86),
        yPercent: Number(existingLogoOverlay.yPercent ?? 88),
        widthPercent: Number(existingLogoOverlay.widthPercent ?? 20)
      });
    }

    if (found?.executedModel && models.some((model) => model.id === found.executedModel)) {
      setSelectedModel(found.executedModel);
    }
  }


  const fontAssets = useMemo(() => assets.filter(isFontAsset), [assets]);
  const fontOptions = useMemo(() => [
    { label: "Arial / sistema", family: "Arial" },
    ...fontAssets.map((asset) => ({ label: asset.name || (asset as any).originalFileName || "Fuente", family: fontFamilyFromAsset(asset) }))
  ], [fontAssets]);

  const brandColorOptions = useMemo(() => extractBrandColors(
    request?.brandBrainSnapshot?.colors,
    client?.brandBrain?.colors,
    (client as any)?.colors
  ), [request, client]);

  useEffect(() => { load(); }, [requestId]);

  useEffect(() => {
    if (typeof window === "undefined" || !fontAssets.length) return;
    let cancelled = false;

    async function loadFonts() {
      await Promise.all(fontAssets.map(async (asset) => {
        if (!asset.fileUrl) return;
        const family = fontFamilyFromAsset(asset);
        const fontUrl = proxiedFontUrl(asset);
        setFontLoadStatus((current) => ({ ...current, [family]: "loading" }));
        try {
          const existing = Array.from(document.fonts).some((fontFace) => fontFace.family.replace(/["']/g, "") === family);
          if (!existing) {
            const styleId = fontAssetStyleId(asset);
            if (!document.getElementById(styleId)) {
              const style = document.createElement("style");
              style.id = styleId;
              style.textContent = `@font-face{font-family:${quoteFontFamily(family)};src:url("${fontUrl}") format("${fontFormatFromUrl(asset.fileUrl, asset.mimeType)}");font-weight:100 900;font-style:normal;font-display:swap;}`;
              document.head.appendChild(style);
            }
            const fontFace = new FontFace(family, `url("${fontUrl}")`);
            const loaded = await fontFace.load();
            if (!cancelled) document.fonts.add(loaded);
          }
          await document.fonts.load(`700 24px ${quoteFontFamily(family)}`);
          if (!cancelled) setFontLoadStatus((current) => ({ ...current, [family]: "ready" }));
        } catch {
          if (!cancelled) setFontLoadStatus((current) => ({ ...current, [family]: "error" }));
        }
      }));
    }

    loadFonts();
    return () => { cancelled = true; };
  }, [fontAssets]);

  useEffect(() => {
    if (!fontAssets.length) return;
    const firstFamily = fontFamilyFromAsset(fontAssets[0]);
    setTextLayers((current) => current.map((layer) => !layer.fontFamily || layer.fontFamily === "Arial" ? { ...layer, fontFamily: firstFamily } : layer));
  }, [fontAssets]);

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedAssetIds.includes(asset.id || "")),
    [assets, selectedAssetIds]
  );
  const selectedVisualAssets = useMemo(
    () => selectedAssets.filter((asset) => !isTextAsset(asset) && !isFontAsset(asset)),
    [selectedAssets]
  );
  const visualAssetCategories = useMemo(() => {
    const categories: string[] = Array.from(new Set(assets.filter((asset) => !isTextAsset(asset) && !isFontAsset(asset)).map((asset) => String(getAssetCategory(asset))).filter(Boolean)));
    return categories.sort((a, b) => a.localeCompare(b, "es"));
  }, [assets]);
  const visibleAssets = useMemo(() => {
    return assets.filter((asset) => !isTextAsset(asset) && !isFontAsset(asset) && (assetCategoryFilter === "all" || getAssetCategory(asset) === assetCategoryFilter));
  }, [assets, assetCategoryFilter]);
  const visualReferences = useReferences ? selectedVisualAssets.filter(isImage) : [];
  const requestAttachmentReferences = useMemo(() => (request?.requestAttachments || [])
    .map((attachment: any) => ({ url: attachment.fileUrl || attachment.url || "", name: attachment.name || "Imagen puntual del brief" }))
    .filter((attachment: any) => attachment.url), [request]);
  const logoAssets = assets.filter(isLogo);
  const selectedLogo = assets.find((asset) => asset.id === logoOverlay.assetId);
  const billingMonth = new Date().toISOString().slice(0, 7);
  const aiBillingBalance = useMemo(() => client ? calculateClientBillingBalance({
    client,
    month: billingMonth,
    requests: [],
    productions: [],
    generatedImages: allGeneratedRecords
  }) : null, [client, billingMonth, allGeneratedRecords]);

  function inferLogoKind(asset?: ClientAsset) {
    const value = `${asset?.name || ""} ${asset?.type || ""} ${asset?.category || ""} ${(asset?.tags || []).join(" ")}`.toLowerCase();
    if (value.includes("imagotipo")) return "imagotipo";
    if (value.includes("isotipo")) return "isotipo";
    if (value.includes("monograma")) return "monograma";
    if (value.includes("blanco")) return "logo-blanco";
    if (value.includes("color")) return "logo-color";
    return "logotipo";
  }


  function buildPromptForMode(mode: "ai-text" | "editable-layers") {
    if (!request) return "";
    const currentRequest = request;
    return buildGenerationPrompt({
      clientName: currentRequest.clientName,
      clientIndustry: currentRequest.clientIndustry,
      format: currentRequest.format,
      goal: currentRequest.goal,
      contentType: currentRequest.contentType,
      textRenderMode: mode,
      mainMessage: currentRequest.mainMessage,
      textBlocks: (currentRequest as any).textBlocks || [],
      selectedEmotions: currentRequest.selectedEmotions || [],
      selectedVisualElements: currentRequest.selectedVisualElements || [],
      specificInstructions: currentRequest.specificInstructions || "",
      brandBrainSnapshot: currentRequest.brandBrainSnapshot as any,
      selectedAssetsSnapshot: currentRequest.selectedAssetsSnapshot || [],
      requestAttachments: (currentRequest as any).requestAttachments || [],
      logoOverlay: currentRequest.logoOverlay || { enabled: false }
    });
  }

  function getGenerationModeLabel(mode?: string) {
    if (mode === "editable-layers") return "Solo composición / texto editable";
    return "IA genera texto";
  }

  function updateLogoOverlay(patch: Partial<LogoOverlayXY>) {
    setLogoOverlay((current) => ({ ...current, ...patch }));
  }

  function handleSelectLogo(assetId: string) {
    const asset = assets.find((item) => item.id === assetId);
    updateLogoOverlay({
      assetId,
      assetName: asset?.name || "",
      fileUrl: asset?.fileUrl || "",
      logoKind: inferLogoKind(asset)
    });
  }

  function applyPreset(presetId: string) {
    const preset = logoPresets.find((item) => item.id === presetId);
    if (!preset) return;
    updateLogoOverlay({
      xPercent: preset.xPercent,
      yPercent: preset.yPercent,
      widthPercent: preset.widthPercent
    });
  }

  const toggleAsset = useCallback((id: string) => {
    if (!id) return;
    setSelectedAssetIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }, []);

  async function generateImages() {
    if (!request) return;
    const currentRequest = request;
    const outputMode: "ai-text" | "editable-layers" = (currentRequest as any).textRenderMode === "editable-layers" ? "editable-layers" : "ai-text";
    const generatedCount = variantCount;
    if (aiBillingBalance && aiBillingBalance.includedAiGenerations > 0) {
      const projected = aiBillingBalance.aiGenerations + generatedCount;
      const exceeds = projected > aiBillingBalance.includedAiGenerations;
      if (exceeds && !aiBillingBalance.onDemandEnabled) {
        setError(`Este cliente tiene límite de ${aiBillingBalance.includedAiGenerations} generaciones IA al mes. Ya lleva ${aiBillingBalance.aiGenerations}. Activa cobro bajo demanda o aumenta el límite en Clientes.`);
        return;
      }
      if (exceeds && aiBillingBalance.onDemandEnabled) {
        const extra = projected - aiBillingBalance.includedAiGenerations;
        const charge = extra * aiBillingBalance.extraAiGenerationRate;
        setSuccess(`Esta generación supera el incluido mensual. Se registrará como consumo bajo demanda estimado: ${money(charge)}.`);
      }
    }
    setError("");
    setSuccess("");
    setGeneratedImages([]);
    setIsGenerating(true);

    try {
      const nextLogoOverlay = {
        ...logoOverlay,
        enabled: logoOverlay.enabled && Boolean(logoOverlay.fileUrl)
      };

      const generationPrompt = buildPromptForMode(outputMode) || currentRequest.generatedPrompt || "";

      await updateGenerationRequest(requestId, {
        status: "generating",
        executedModel: selectedModel,
        selectedAssetIds,
        selectedAssetsSnapshot: selectedVisualAssets,
        logoOverlay: nextLogoOverlay,
        generatedPrompt: generationPrompt
      } as any);

      const referenceImages = [
        ...requestAttachmentReferences,
        ...visualReferences.map((asset) => ({ url: asset.fileUrl, name: asset.name }))
      ];

      async function requestImages(mode: "ai-text" | "editable-layers") {
        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: await authJsonHeaders(),
          body: JSON.stringify({
            prompt: generationPrompt,
            format: currentRequest.format,
            model: selectedModel,
            variantCount,
            referenceImages,
            logoOverlay: nextLogoOverlay
          })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "No se pudo generar imagen.");
        return payload;
      }

      const runs = [
        { kind: outputMode === "editable-layers" ? "editable-base" as const : "single" as const, label: outputMode === "editable-layers" ? "Base editable" : "IA con texto", payload: await requestImages(outputMode) }
      ];

      const images: GeneratedLocalImage[] = [];
      let recordIndex = 0;

      for (const run of runs) {
        for (let index = 0; index < (run.payload.imagesBase64 || []).length; index++) {
          recordIndex += 1;
          const base64 = cleanBase64(run.payload.imagesBase64[index]);
          const dataUrl = dataUrlFromBase64(base64);
          const pairIndex = index + 1;
          const label = `variant-${pairIndex}`;
          const stored = await uploadGeneratedImageDataUrl(requestId, dataUrl, label);
          const ref: any = await saveGeneratedImageRecord({
            requestId,
            clientId: currentRequest.clientId,
            clientName: currentRequest.clientName,
            imageUrl: stored.imageUrl,
            storagePath: stored.storagePath,
            originalImageUrl: stored.imageUrl,
            originalStoragePath: stored.storagePath,
            model: run.payload.executedModel || selectedModel,
            variantIndex: recordIndex,
            variantPairIndex: pairIndex,
            variantKind: run.kind,
            variantLabel: run.label,
            textRenderMode: outputMode,
            logoOverlayApplied: false,
            status: "generated"
          } as any);
          images.push({
            id: ref?.id || `${Date.now()}-${recordIndex}`,
            base64,
            originalBase64: base64,
            logoOverlayApplied: false,
            variantKind: run.kind,
            variantLabel: run.label,
            variantPairIndex: pairIndex
          });
        }
      }

      setGeneratedImages(images);
      setSelectedImageIndex(0);

      const firstPayload = runs[0]?.payload || {};
      await updateGenerationRequest(requestId, {
        status: "completed",
        executedModel: firstPayload.executedModel || selectedModel,
        generationMode: firstPayload.generationMode || "gemini"
      } as any);

      setSuccess("Imagen generada correctamente.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar.");
      await updateGenerationRequest(requestId, { status: "error" } as any);
    } finally {
      setIsGenerating(false);
    }
  }

  async function applyLogoToSelectedImage(imageIndex = selectedImageIndex) {
    const image = generatedImages[imageIndex];
    if (!image) return alert("Primero genera una imagen.");
    if (!logoOverlay.fileUrl) return alert("Selecciona un logotipo / imagotipo / isotipo.");

    setSelectedImageIndex(imageIndex);
    setIsApplyingLogo(true);
    setError("");
    setSuccess("");

    try {
      const originalSource = image.originalBase64 || image.base64;
      const response = await fetch("/api/apply-logo-overlay", {
        method: "POST",
        headers: await authJsonHeaders(),
        body: JSON.stringify({
          imageBase64: isRemoteImageSource(originalSource) ? "" : originalSource,
          imageUrl: isRemoteImageSource(originalSource) ? originalSource : "",
          logoOverlay: {
            ...logoOverlay,
            enabled: true
          }
        })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo aplicar el logo.");

      const finalBase64 = cleanBase64(payload.imageBase64);
      const finalDataUrl = dataUrlFromBase64(finalBase64);

      setGeneratedImages((current) =>
        current.map((item, index) =>
          index === imageIndex
            ? {
                ...item,
                finalBase64,
                logoOverlayApplied: true
              }
            : item
        )
      );

      if (image.id) {
        const storedFinal = await uploadGeneratedImageDataUrl(requestId, finalDataUrl, `variant-${imageIndex + 1}-logo`);
        await updateGeneratedImageRecord(image.id, {
          imageUrl: storedFinal.imageUrl,
          storagePath: storedFinal.storagePath,
          finalImageUrl: storedFinal.imageUrl,
          finalStoragePath: storedFinal.storagePath,
          finalImageDataUrl: "",
          imageDataUrl: "",
          logoOverlayApplied: true,
          logoOverlay,
          status: "generated_with_logo"
        });
      }

      setSelectedImageIndex(imageIndex);
      setIsLogoModalOpen(false);
      setSuccess("Logo insertado. Ya puedes descargar la versión con logo o quitarlo si no te gusta.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aplicar logo.");
    } finally {
      setIsApplyingLogo(false);
    }
  }

  async function removeLogoFromSelectedImage(imageIndex = selectedImageIndex) {
    const image = generatedImages[imageIndex];
    if (!image) return;
    const originalBase64 = image.originalBase64 || image.base64;

    setGeneratedImages((current) =>
      current.map((item, index) =>
        index === imageIndex
          ? { ...item, base64: originalBase64, originalBase64, finalBase64: undefined, logoOverlayApplied: false }
          : item
      )
    );

    if (image.id) {
      const originalIsRemote = isRemoteImageSource(originalBase64);
      const restored = originalIsRemote
        ? { imageUrl: originalBase64, storagePath: "" }
        : await uploadGeneratedImageDataUrl(requestId, dataUrlFromBase64(originalBase64), `variant-${imageIndex + 1}-restored`);
      await updateGeneratedImageRecord(image.id, {
        imageUrl: restored.imageUrl,
        storagePath: restored.storagePath,
        finalImageUrl: "",
        finalStoragePath: "",
        finalImageDataUrl: "",
        imageDataUrl: "",
        logoOverlayApplied: false,
        status: "generated"
      });
    }

    setSuccess("Logo quitado. La descarga vuelve a usar la imagen original.");
  }


  function updateTextLayer(id: string, patch: Partial<EditableTextLayer>) {
    setTextLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ...patch } : layer));
  }

  async function saveEditableTextLayers() {
    await updateGenerationRequest(requestId, { editableTextLayers: textLayers } as any);
    setSuccess("Capas de texto guardadas en el brief.");
    await load();
  }

  async function downloadEditedTextImage(imageIndex = selectedImageIndex) {
    if (!request) return alert("Primero espera a que cargue el brief.");
    const image = generatedImages[imageIndex];
    if (!image) return alert("Primero genera una imagen.");
    const downloadClientName = request.clientName || "BUST-It-Now";
    setDownloadTextLoading(true);
    setError("");
    try {
      const rawSource = dataUrlFromBase64(image.finalBase64 || image.base64);
      const source = proxiedImageUrl(rawSource);
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("No se pudo cargar la imagen para exportar. Intenta regenerar la imagen o abrirla y volver a descargar."));
        img.src = source;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo preparar el lienzo.");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (typeof document !== "undefined" && document.fonts) await document.fonts.ready;
      const enabledLayers = textLayers.filter((layer) => layer.enabled && layer.text.trim());
      for (const layer of enabledLayers) {
        const text = layer.uppercase ? layer.text.toUpperCase() : layer.text;
        const fontSize = Math.max(10, Math.round(canvas.width * (Number(layer.sizePercent || 4) / 100)));
        const maxWidth = canvas.width * (Number(layer.widthPercent || 70) / 100);
        const x = canvas.width * (Number(layer.xPercent || 50) / 100);
        const y = canvas.height * (Number(layer.yPercent || 50) / 100);
        const layerFontFamily = quoteFontFamily(layer.fontFamily);
        if (typeof document !== "undefined" && document.fonts) await document.fonts.load(`${Number(layer.weight || 700)} ${fontSize}px ${layerFontFamily}`);
        ctx.font = `${Number(layer.weight || 700)} ${fontSize}px ${layerFontFamily}, Arial, Helvetica, sans-serif`;
        ctx.textAlign = layer.align;
        ctx.textBaseline = "middle";
        const lines = wrapCanvasText(ctx, text, maxWidth);
        const lineHeight = fontSize * 1.15;
        const totalHeight = lines.length * lineHeight;
        let boxX = x;
        if (layer.align === "center") boxX = x - maxWidth / 2;
        if (layer.align === "right") boxX = x - maxWidth;
        if (layer.backgroundEnabled) {
          const padX = fontSize * 0.65;
          const padY = fontSize * 0.45;
          const boxY = y - totalHeight / 2 - padY;
          ctx.fillStyle = layer.backgroundColor || "#111827";
          roundRectPath(ctx, boxX - padX, boxY, maxWidth + padX * 2, totalHeight + padY * 2, fontSize * 0.8);
          ctx.fill();
        }
        ctx.fillStyle = layer.color || "#ffffff";
        lines.forEach((line, lineIndex) => {
          ctx.fillText(line, x, y - totalHeight / 2 + lineHeight / 2 + lineIndex * lineHeight, maxWidth);
        });
      }
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value) resolve(value);
          else reject(new Error("No se pudo preparar el archivo PNG."));
        }, "image/png", 0.95);
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${downloadClientName}-variante-${imageIndex + 1}-texto-editable.png`;
      link.href = objectUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      setSuccess("Imagen final descargada con texto editable.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar la imagen con texto editable.");
    } finally {
      setDownloadTextLoading(false);
    }
  }

  const selectedImageForLogo = generatedImages[selectedImageIndex];
  const selectedVisibleImage = selectedImageForLogo ? (selectedImageForLogo.finalBase64 || selectedImageForLogo.base64) : "";

  if (!request) {
    return (
      <AppShell active="BUST It Now">
        <main className="min-h-screen bg-zinc-100 p-8 text-zinc-950">
          <section className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm">
            <p>Cargando request...</p>
          </section>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell active="BUST It Now">
      <main className="min-h-screen bg-zinc-100 text-zinc-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <header className="rounded-b-[2rem] bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-300/60 sm:p-8">
            <Link href="/dashboard/generador" className="mb-4 inline-flex text-sm font-medium text-zinc-300 transition hover:text-white">← Volver al generador</Link>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-400">REQUEST DE GENERACIÓN</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{request.clientName}</h1>
            <p className="mt-5 text-sm text-zinc-300">Estado actual: {formatStatus(request.status)}</p>
          </header>

          <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <article className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">Resumen del brief</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Datos del request</h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <InfoBox label="Objetivo" value={request.goal} />
                <InfoBox label="Formato" value={request.format} />
                <InfoBox label="Tipo" value={request.contentType} />
                <InfoBox label="Modo de salida" value={getGenerationModeLabel((request as any).textRenderMode)} />
                <InfoBox label="Modelo actual" value={models.find((model) => model.id === selectedModel)?.label || selectedModel} />
              </div>

              <div className="mt-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-5 text-sm leading-6 text-zinc-700">
                <strong className="text-zinc-950">Mensaje principal</strong>
                <p className="mt-1">{request.mainMessage || "-"}</p>

                <strong className="mt-5 block text-zinc-950">Copy</strong>
                {(request.textBlocks || []).length ? (
                  <div className="mt-1 space-y-1">
                    {(request.textBlocks as any[]).map((block, index) => <p key={index}>{block.role || "Texto"}: {block.text}</p>)}
                  </div>
                ) : <p className="mt-1">-</p>}

                <strong className="mt-5 block text-zinc-950">Dirección visual</strong>
                <p>Emociones: {(request.selectedEmotions || []).join(", ") || "-"}</p>
                <p>Elementos: {(request.selectedVisualElements || []).join(", ") || "-"}</p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <p className="mr-auto text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">Prompt final</p>
                <button type="button" onClick={() => navigator.clipboard.writeText(request.generatedPrompt || "")} className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-zinc-50">📋 Copiar prompt</button>
                <a download={`${request.clientName}-prompt.txt`} href={`data:text/plain;charset=utf-8,${encodeURIComponent(request.generatedPrompt || "")}`} className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-zinc-50">⬇️ Descargar .txt</a>
              </div>

              <pre className="mt-5 max-h-[430px] overflow-auto whitespace-pre-wrap rounded-3xl border border-zinc-200 bg-white p-5 text-xs leading-5 text-zinc-700">{request.generatedPrompt || "Este request no tiene prompt final guardado."}</pre>
            </article>

            <aside className="space-y-6">
              <article className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">Acción</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">Generar variantes</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">Puedes reutilizar este mismo brief y cambiar el motor antes de generar nuevas variantes.</p>

                <label className="mt-6 block text-sm font-medium text-zinc-800">Modelo para esta generación</label>
                <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-zinc-950 bg-white px-4 text-sm outline-none">
                  {models.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                </select>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[1, 2, 4].map((count) => (
                    <button key={count} type="button" onClick={() => setVariantCount(count)} className={`h-12 rounded-2xl border px-4 text-sm font-semibold transition ${variantCount === count ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50"}`}>
                      {count === 1 ? "1 imagen" : `${count} variantes`}
                    </button>
                  ))}
                </div>

                <div className="mt-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <strong className="text-sm text-zinc-950">Usar referencias visuales reales</strong>
                      <p className="mt-1 text-sm leading-5 text-zinc-600">{visualReferences.length} referencia(s) de imagen disponibles para apoyar la generación.</p>
                    </div>
                    <button type="button" onClick={() => setUseReferences(!useReferences)} className={`rounded-full px-5 py-2 text-sm font-semibold ${useReferences ? "bg-zinc-950 text-white" : "bg-white text-zinc-700 border border-zinc-200"}`}>{useReferences ? "Activo" : "Inactivo"}</button>
                  </div>

                  {visualAssetCategories.length ? (
                    <PillFilter
                      className="mt-4"
                      options={[{ id: "all", label: "Todos" }, ...visualAssetCategories.map((category) => ({ id: category, label: category }))]}
                      value={assetCategoryFilter}
                      onChange={setAssetCategoryFilter}
                    />
                  ) : null}

                  {assets.length ? (
                    <AssetPicker assets={visibleAssets.filter((asset) => isImage(asset) && !isLogo(asset))} selectedAssetIds={selectedAssetIds} onToggle={toggleAsset} />
                  ) : null}
                </div>

                {aiBillingBalance ? (
                  <div className={`mt-5 rounded-3xl border p-4 text-sm ${aiBillingBalance.includedAiGenerations && aiBillingBalance.aiGenerations + variantCount > aiBillingBalance.includedAiGenerations ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
                    <strong>Consumo IA del mes</strong>
                    <p className="mt-1">{aiBillingBalance.aiGenerations}/{aiBillingBalance.includedAiGenerations || "sin límite"} generaciones usadas en {billingMonth}. Esta acción suma {variantCount}.</p>
                    {aiBillingBalance.includedAiGenerations && aiBillingBalance.aiGenerations + variantCount > aiBillingBalance.includedAiGenerations ? <p className="mt-1">Excedente estimado bajo demanda: {money(Math.max(0, aiBillingBalance.aiGenerations + variantCount - aiBillingBalance.includedAiGenerations) * aiBillingBalance.extraAiGenerationRate)}.</p> : null}
                  </div>
                ) : null}

                <button type="button" onClick={generateImages} disabled={isGenerating} className="mt-5 h-14 w-full rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-400">{isGenerating ? "Generando..." : "Generar imagen"}</button>

                {error ? <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">{error}</div> : null}
                {success ? <div className="mt-5 rounded-3xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-medium text-green-700">{success}</div> : null}
              </article>

              <article className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">Logo posterior</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">Insertar logo</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">Abre una ventana, escoge la imagen generada, elige el logo y muévelo en tiempo real con X/Y y tamaño antes de insertarlo.</p>
                <button
                  type="button"
                  onClick={() => { updateLogoOverlay({ enabled: true }); setIsLogoModalOpen(true); }}
                  disabled={!generatedImages.length}
                  className="mt-5 h-12 w-full rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-300"
                >
                  Insertar logo
                </button>
                {!generatedImages.length ? <p className="mt-3 text-xs text-zinc-500">Primero genera una o más imágenes desde este brief.</p> : null}
              </article>

              <article className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">Resultados</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">Imágenes generadas</h2>
                {generatedImages.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-600">Aún no hay imágenes generadas para este request.</p>
                ) : (
                  <div className="mt-5 grid gap-4">
                    {generatedImages.map((image, index) => {
                      const visibleImage = image.finalBase64 || image.base64;
                      const downloadName = image.logoOverlayApplied
                        ? `${request.clientName}-variante-${index + 1}-con-logo.png`
                        : `${request.clientName}-variante-${index + 1}.png`;

                      return (
                        <article key={image.id} className={`rounded-3xl border-2 p-3 transition ${selectedImageIndex === index ? "border-emerald-500 ring-4 ring-emerald-100" : "border-zinc-200"}`}>
                          <a href={dataUrlFromBase64(visibleImage)} target="_blank" rel="noopener noreferrer" className="relative block w-full overflow-hidden rounded-2xl bg-zinc-100" title="Abrir imagen en ventana nueva">
                            <img src={dataUrlFromBase64(visibleImage)} alt={`Generada ${index + 1}`} loading="lazy" decoding="async" className="w-full rounded-2xl" />
                            {image.variantLabel ? <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${image.variantKind === "editable-base" ? "bg-emerald-600 text-white" : "bg-zinc-950 text-white"}`}>{image.variantPairIndex ? `${image.variantPairIndex} · ` : ""}{image.variantLabel}</span> : null}
                            {image.logoOverlayApplied ? (
                              <span className="absolute bottom-3 left-3 rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">Logo aplicado</span>
                            ) : null}
                          </a>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => { setSelectedImageIndex(index); updateLogoOverlay({ enabled: true }); setIsLogoModalOpen(true); }} className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-950">Insertar logo</button>
                            <a download={downloadName} href={dataUrlFromBase64(visibleImage)} className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white">Descargar</a>
                          </div>
                          <button type="button" onClick={() => { setSelectedImageIndex(index); setTextEditorOpen(true); }} className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800">{image.variantKind === "reference-ai" ? "Editar texto encima" : "Editar texto"}</button>
                          {image.logoOverlayApplied ? (
                            <button type="button" onClick={() => removeLogoFromSelectedImage(index)} className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-950">Quitar logo</button>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </article>
            </aside>
          </section>
        </div>
      </main>

      {textEditorOpen ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8">
          <section className="mx-auto grid max-w-7xl gap-6 rounded-[2rem] bg-white p-5 text-zinc-950 shadow-2xl lg:grid-cols-[1.12fr_0.88fr] sm:p-8">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">Editor de texto</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Capas editables del brief</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">Usa los mismos bloques de texto del brief. En modo “Texto editable” la imagen base debe venir sin letras; en modo IA puedes usarlo para montar una versión corregida encima.</p>
                </div>
                <button type="button" onClick={() => setTextEditorOpen(false)} className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Cerrar</button>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {generatedImages.map((image, index) => (
                  <button key={image.id} type="button" onClick={() => setSelectedImageIndex(index)} className={`overflow-hidden rounded-2xl border-2 p-1 transition ${selectedImageIndex === index ? "border-emerald-500 ring-4 ring-emerald-200" : "border-zinc-200 hover:border-emerald-400"}`}>
                    <img src={dataUrlFromBase64(image.finalBase64 || image.base64)} alt={`Variante ${index + 1}`} className="aspect-square w-full rounded-xl object-cover" />
                  </button>
                ))}
              </div>
              <div className="mt-5 overflow-hidden rounded-[1.7rem] border border-zinc-200 bg-zinc-100">
                {selectedVisibleImage ? (
                  <div className="relative mx-auto max-w-3xl">
                    <img src={dataUrlFromBase64(selectedVisibleImage)} alt="Previsualización con texto editable" className="w-full" />
                    {textLayers.filter((layer) => layer.enabled && layer.text.trim()).map((layer) => (
                      <div
                        key={layer.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-pre-line px-3 py-2 leading-tight drop-shadow-lg"
                        style={{
                          left: `${layer.xPercent}%`,
                          top: `${layer.yPercent}%`,
                          width: `${layer.widthPercent}%`,
                          color: layer.color,
                          background: layer.backgroundEnabled ? layer.backgroundColor : "transparent",
                          borderRadius: layer.backgroundEnabled ? "999px" : "0",
                          textAlign: layer.align,
                          fontWeight: layer.weight,
                          fontFamily: `${quoteFontFamily(layer.fontFamily)}, Arial, Helvetica, sans-serif`,
                          fontSize: `clamp(12px, ${layer.sizePercent * 0.42}vw, 72px)`,
                          textTransform: layer.uppercase ? "uppercase" : "none"
                        }}
                      >
                        {layer.text}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-80 items-center justify-center p-8 text-center text-sm text-zinc-500">No hay imagen seleccionada.</div>
                )}
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-[1.7rem] border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Tipografías del cliente</p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">{fontAssets.length ? `${fontAssets.length} fuente(s) cargada(s) desde Assets.` : "No hay fuentes cargadas. Puedes subir OTF/TTF/WOFF en Clientes → Assets."}</p>
                <p className="mt-2 text-xs font-semibold text-emerald-800">{brandColorOptions.length ? `${brandColorOptions.length} color(es) de marca disponibles para texto y fondo.` : "Agrega colores HEX en Brand Brain para activar paleta rápida."}</p>
                {client?.id ? <Link href={`/dashboard/clientes/${client.id}/assets`} className="mt-3 inline-flex rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800">Abrir Assets</Link> : null}
              </div>
              <div className="rounded-[1.7rem] border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Modo recomendado</p>
                <p className="mt-2 text-sm leading-6 text-zinc-700">{(request as any).textRenderMode === "editable-layers" ? "Este brief está preparado para imagen base sin texto + capas editables." : "Este brief fue generado con texto IA. Puedes superponer capas, pero el texto pegado en la imagen no se borra automáticamente."}</p>
              </div>

              <div className="max-h-[62vh] space-y-4 overflow-auto pr-1">
                {textLayers.map((layer) => (
                  <div key={layer.id} className="rounded-[1.4rem] border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm text-zinc-950">{layer.role}</strong>
                      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600"><input type="checkbox" checked={layer.enabled} onChange={(event) => updateTextLayer(layer.id, { enabled: event.target.checked })} /> Visible</label>
                    </div>
                    <textarea value={layer.text} onChange={(event) => updateTextLayer(layer.id, { text: event.target.value })} className="mt-3 min-h-20 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-950" />
                    <label className="mt-3 block text-xs font-semibold text-zinc-600">Fuente
                      <select value={layer.fontFamily || "Arial"} onChange={(event) => updateTextLayer(layer.id, { fontFamily: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-950">
                        {fontOptions.map((font) => <option key={`${layer.id}-${font.family}`} value={font.family}>{font.label}</option>)}
                      </select>
                      {layer.fontFamily && layer.fontFamily !== "Arial" ? <span className={`mt-1 block text-[11px] font-semibold ${fontLoadStatus[layer.fontFamily] === "ready" ? "text-emerald-700" : fontLoadStatus[layer.fontFamily] === "error" ? "text-red-600" : "text-zinc-500"}`}>{fontLoadStatus[layer.fontFamily] === "ready" ? "Fuente cargada" : fontLoadStatus[layer.fontFamily] === "error" ? "No se pudo cargar esta fuente. Revisa el archivo o vuelve a subirlo." : "Cargando fuente..."}</span> : null}
                    </label>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <MiniRange label="X" value={layer.xPercent} min={0} max={100} onChange={(value) => updateTextLayer(layer.id, { xPercent: value })} />
                      <MiniRange label="Y" value={layer.yPercent} min={0} max={100} onChange={(value) => updateTextLayer(layer.id, { yPercent: value })} />
                      <MiniRange label="Ancho" value={layer.widthPercent} min={20} max={100} onChange={(value) => updateTextLayer(layer.id, { widthPercent: value })} />
                      <MiniRange label="Tamaño" value={layer.sizePercent} min={1.6} max={12} step={0.2} onChange={(value) => updateTextLayer(layer.id, { sizePercent: value })} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="text-xs font-semibold text-zinc-600">Color<input type="color" value={layer.color} onChange={(event) => updateTextLayer(layer.id, { color: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-white" /></label>
                      <label className="text-xs font-semibold text-zinc-600">Fondo<input type="color" value={layer.backgroundColor} onChange={(event) => updateTextLayer(layer.id, { backgroundColor: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-white" /></label>
                    </div>
                    {brandColorOptions.length ? (
                      <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">Colores de marca</p>
                        <div className="mt-2 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="w-12 text-[11px] font-bold text-zinc-500">Texto</span>
                            {brandColorOptions.map((color) => (
                              <button
                                key={`${layer.id}-text-${color.value}`}
                                type="button"
                                title={`Aplicar al texto: ${color.label}`}
                                aria-label={`Aplicar ${color.value} al texto`}
                                onClick={() => updateTextLayer(layer.id, { color: color.value })}
                                className={`h-8 w-8 rounded-full border shadow-sm transition hover:scale-105 ${layer.color.toUpperCase() === color.value ? "ring-2 ring-zinc-950 ring-offset-2" : "border-zinc-200"}`}
                                style={{ backgroundColor: color.value }}
                              />
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="w-12 text-[11px] font-bold text-zinc-500">Fondo</span>
                            {brandColorOptions.map((color) => (
                              <button
                                key={`${layer.id}-bg-${color.value}`}
                                type="button"
                                title={`Aplicar al fondo: ${color.label}`}
                                aria-label={`Aplicar ${color.value} al fondo`}
                                onClick={() => updateTextLayer(layer.id, { backgroundColor: color.value, backgroundEnabled: true })}
                                className={`h-8 w-8 rounded-full border shadow-sm transition hover:scale-105 ${layer.backgroundEnabled && layer.backgroundColor.toUpperCase() === color.value ? "ring-2 ring-zinc-950 ring-offset-2" : "border-zinc-200"}`}
                                style={{ backgroundColor: color.value }}
                              />
                            ))}
                            <button type="button" onClick={() => updateTextLayer(layer.id, { backgroundEnabled: false })} className="h-8 rounded-full border border-zinc-200 bg-white px-3 text-[11px] font-bold text-zinc-600">Sin fondo</button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {(["left","center","right"] as const).map((align) => <button key={align} type="button" onClick={() => updateTextLayer(layer.id, { align })} className={`rounded-xl border px-2 py-2 text-xs font-semibold ${layer.align === align ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700"}`}>{align}</button>)}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-zinc-600">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={layer.backgroundEnabled} onChange={(event) => updateTextLayer(layer.id, { backgroundEnabled: event.target.checked })} /> Fondo</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={layer.uppercase} onChange={(event) => updateTextLayer(layer.id, { uppercase: event.target.checked })} /> Mayúsculas</label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 rounded-[1.7rem] border border-zinc-200 bg-white p-5">
                <button type="button" onClick={saveEditableTextLayers} className="h-12 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-950">Guardar edición</button>
                <button type="button" onClick={() => downloadEditedTextImage(selectedImageIndex)} disabled={downloadTextLoading || !selectedVisibleImage} className="h-12 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-300">{downloadTextLoading ? "Exportando..." : "Descargar imagen final"}</button>
              </div>
            </aside>
          </section>
        </div>
      ) : null}

      {isLogoModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8">
          <section className="mx-auto grid max-w-7xl gap-6 rounded-[2rem] bg-white p-5 text-zinc-950 shadow-2xl lg:grid-cols-[1.15fr_0.85fr] sm:p-8">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">Insertar logo</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Escoge imagen, logo y posición</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">La previsualización se mueve en tiempo real. El PNG final solo cambia cuando presionas “Insertar logo”.</p>
                </div>
                <button type="button" onClick={() => setIsLogoModalOpen(false)} className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Cerrar</button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {generatedImages.map((image, index) => (
                  <button key={image.id} type="button" onClick={() => setSelectedImageIndex(index)} className={`overflow-hidden rounded-2xl border-2 p-1 transition ${selectedImageIndex === index ? "border-emerald-500 ring-4 ring-emerald-200" : "border-zinc-200 hover:border-emerald-400"}`}>
                    <img src={dataUrlFromBase64(image.finalBase64 || image.base64)} alt={`Variante ${index + 1}`} className="aspect-square w-full rounded-xl object-cover" />
                  </button>
                ))}
              </div>

              <div className="mt-5 overflow-hidden rounded-[1.7rem] border border-zinc-200 bg-zinc-100">
                {selectedVisibleImage ? (
                  <div className="relative">
                    <img src={dataUrlFromBase64(selectedVisibleImage)} alt="Previsualización con logo" className="w-full" />
                    {selectedLogo?.fileUrl ? (
                      <img
                        src={selectedLogo.fileUrl}
                        alt="Logo overlay preview"
                        className="absolute object-contain drop-shadow-lg"
                        style={{
                          left: `${logoOverlay.xPercent}%`,
                          top: `${logoOverlay.yPercent}%`,
                          width: `${logoOverlay.widthPercent}%`,
                          transform: "translate(-50%, -50%)"
                        }}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="flex min-h-80 items-center justify-center p-8 text-center text-sm text-zinc-500">No hay imagen seleccionada.</div>
                )}
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-[1.7rem] border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Tipo de logo</p>
                <select value={logoOverlay.logoKind} onChange={(event) => updateLogoOverlay({ logoKind: event.target.value })} className="mt-3 h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-950">
                  {logoKinds.map((kind) => <option key={kind.id} value={kind.id}>{kind.label}</option>)}
                </select>
              </div>

              <div className="rounded-[1.7rem] border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Logos del cliente</p>
                {logoAssets.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {logoAssets.map((asset) => (
                      <button key={asset.id} type="button" onClick={() => handleSelectLogo(asset.id || "")} className={`rounded-2xl border-2 bg-white p-3 text-left transition ${logoOverlay.assetId === asset.id ? "border-emerald-500 ring-4 ring-emerald-200" : "border-zinc-200 hover:border-emerald-400"}`}>
                        <img src={asset.fileUrl} alt={asset.name} className="h-16 w-full rounded-xl object-contain" />
                        <strong className="mt-2 block text-xs text-zinc-950">{asset.name}</strong>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">No hay logos cargados en assets del cliente.</p>
                )}
              </div>

              <div className="rounded-[1.7rem] border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Posición rápida</p>
                <select onChange={(event) => applyPreset(event.target.value)} className="mt-3 h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-950" defaultValue="">
                  <option value="" disabled>Preset rápido de posición</option>
                  {logoPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                </select>
                <div className="mt-5 grid gap-5">
                  <RangeControl label="X horizontal" value={logoOverlay.xPercent} min={0} max={100} suffix="%" onChange={(value) => updateLogoOverlay({ xPercent: value })} />
                  <RangeControl label="Y vertical" value={logoOverlay.yPercent} min={0} max={100} suffix="%" onChange={(value) => updateLogoOverlay({ yPercent: value })} />
                  <RangeControl label="Ancho del logo" value={logoOverlay.widthPercent} min={6} max={60} suffix="%" onChange={(value) => updateLogoOverlay({ widthPercent: value })} />
                </div>
              </div>

              <div className="grid gap-3 rounded-[1.7rem] border border-zinc-200 bg-white p-5">
                <button type="button" onClick={() => applyLogoToSelectedImage(selectedImageIndex)} disabled={isApplyingLogo || !selectedLogo?.fileUrl || !selectedImageForLogo} className="h-12 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-300">{isApplyingLogo ? "Insertando logo..." : "Insertar logo"}</button>
                {selectedImageForLogo?.logoOverlayApplied ? (
                  <button type="button" onClick={() => removeLogoFromSelectedImage(selectedImageIndex)} className="h-12 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-950">Quitar logo</button>
                ) : null}
                {selectedVisibleImage ? (
                  <a download={`${request.clientName}-variante-${selectedImageIndex + 1}${selectedImageForLogo?.logoOverlayApplied ? "-con-logo" : ""}.png`} href={dataUrlFromBase64(selectedVisibleImage)} className="inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-950">Descargar</a>
                ) : null}
              </div>
            </aside>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function money(value:number){
  return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number(value||0));
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
            key={asset.id}
            type="button"
            onClick={() => onToggle(asset.id || "")}
            className={`relative overflow-hidden rounded-2xl border-2 text-left transition ${selected ? "border-emerald-500 ring-4 ring-emerald-200 shadow-lg shadow-emerald-100" : "border-zinc-200 hover:border-emerald-400"}`}
          >
            {isImage(asset) ? <img src={asset.fileUrl} alt={asset.name} loading="lazy" decoding="async" className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center bg-zinc-100 text-xs text-zinc-500">Archivo</div>}
            <span className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow ${selected ? "bg-emerald-500 text-white" : "bg-white text-zinc-950"}`}>{selected ? "✓" : "+"}</span>
          </button>
        );
      })}
    </div>
  );
});

function MiniRange({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label className="text-xs font-semibold text-zinc-600">
      <span className="flex justify-between"><span>{label}</span><span>{Math.round(value)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full accent-zinc-950" />
    </label>
  );
}

function RangeControl({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-zinc-800">{label}</label>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-zinc-950" />
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-3xl bg-zinc-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm text-zinc-950">{value || "-"}</p>
    </div>
  );
}
