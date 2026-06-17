"use client";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import {
  ClientAsset,
  GenerationRequest,
  getGenerationRequest,
  listClientAssets,
  listGeneratedImageRecords,
  saveGeneratedImageRecord,
  updateGeneratedImageRecord,
  updateGenerationRequest
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

export default function GenerationRequestPage() {
  const { requestId } = useParams<{ requestId: string }>();

  const [request, setRequest] = useState<GenerationRequest | null>(null);
  const [assets, setAssets] = useState<ClientAsset[]>([]);
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

    const generatedRecords = await listGeneratedImageRecords();
    const previousImages = generatedRecords
      .filter((record) => record.requestId === requestId)
      .sort((a, b) => Number(a.variantIndex || 0) - Number(b.variantIndex || 0))
      .map((record) => {
        const original = record.originalImageDataUrl || record.imageDataUrl || record.imageUrl || "";
        const final = record.finalImageDataUrl || (record.logoOverlayApplied ? record.imageDataUrl : "");
        return {
          id: record.id,
          base64: cleanBase64(original),
          originalBase64: cleanBase64(original),
          finalBase64: final ? cleanBase64(final) : undefined,
          logoOverlayApplied: Boolean(record.logoOverlayApplied)
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

  useEffect(() => { load(); }, [requestId]);

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedAssetIds.includes(asset.id || "")),
    [assets, selectedAssetIds]
  );
  const visualAssetCategories = useMemo(() => {
    const categories: string[] = Array.from(new Set(assets.filter((asset) => !isTextAsset(asset)).map((asset) => String(getAssetCategory(asset))).filter(Boolean)));
    return categories.sort((a, b) => a.localeCompare(b, "es"));
  }, [assets]);
  const visibleAssets = useMemo(() => {
    return assets.filter((asset) => !isTextAsset(asset) && (assetCategoryFilter === "all" || getAssetCategory(asset) === assetCategoryFilter));
  }, [assets, assetCategoryFilter]);
  const visualReferences = useReferences ? selectedAssets.filter(isImage) : [];
  const requestAttachmentReferences = useMemo(() => (request?.requestAttachments || [])
    .map((attachment: any) => ({ url: attachment.fileUrl || attachment.url || "", name: attachment.name || "Imagen puntual del brief" }))
    .filter((attachment: any) => attachment.url), [request]);
  const logoAssets = assets.filter(isLogo);
  const selectedLogo = assets.find((asset) => asset.id === logoOverlay.assetId);

  function inferLogoKind(asset?: ClientAsset) {
    const value = `${asset?.name || ""} ${asset?.type || ""} ${asset?.category || ""} ${(asset?.tags || []).join(" ")}`.toLowerCase();
    if (value.includes("imagotipo")) return "imagotipo";
    if (value.includes("isotipo")) return "isotipo";
    if (value.includes("monograma")) return "monograma";
    if (value.includes("blanco")) return "logo-blanco";
    if (value.includes("color")) return "logo-color";
    return "logotipo";
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
    setError("");
    setSuccess("");
    setGeneratedImages([]);
    setIsGenerating(true);

    try {
      const nextLogoOverlay = {
        ...logoOverlay,
        enabled: logoOverlay.enabled && Boolean(logoOverlay.fileUrl)
      };

      await updateGenerationRequest(requestId, {
        status: "generating",
        executedModel: selectedModel,
        selectedAssetIds,
        selectedAssetsSnapshot: selectedAssets,
        logoOverlay: nextLogoOverlay
      } as any);

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: request.generatedPrompt,
          format: request.format,
          model: selectedModel,
          variantCount,
          referenceImages: [
            ...requestAttachmentReferences,
            ...visualReferences.map((asset) => ({ url: asset.fileUrl, name: asset.name }))
          ],
          logoOverlay: nextLogoOverlay
        })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo generar imagen.");

      const images: GeneratedLocalImage[] = [];

      for (let index = 0; index < (payload.imagesBase64 || []).length; index++) {
        const base64 = cleanBase64(payload.imagesBase64[index]);
        const dataUrl = dataUrlFromBase64(base64);
        const ref: any = await saveGeneratedImageRecord({
          requestId,
          clientId: request.clientId,
          clientName: request.clientName,
          imageDataUrl: dataUrl,
          originalImageDataUrl: dataUrl,
          model: payload.executedModel || selectedModel,
          variantIndex: index + 1,
          logoOverlayApplied: false,
          status: "generated"
        });
        images.push({
          id: ref?.id || `${Date.now()}-${index}`,
          base64,
          originalBase64: base64,
          logoOverlayApplied: false
        });
      }

      setGeneratedImages(images);
      setSelectedImageIndex(0);

      await updateGenerationRequest(requestId, {
        status: "completed",
        executedModel: payload.executedModel || selectedModel,
        generationMode: payload.generationMode || "gemini"
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
        headers: { "Content-Type": "application/json" },
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
        await updateGeneratedImageRecord(image.id, {
          imageDataUrl: finalDataUrl,
          finalImageDataUrl: finalDataUrl,
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
      await updateGeneratedImageRecord(image.id, {
        imageDataUrl: dataUrlFromBase64(originalBase64),
        finalImageDataUrl: "",
        logoOverlayApplied: false,
        status: "generated"
      });
    }

    setSuccess("Logo quitado. La descarga vuelve a usar la imagen original.");
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

                <button type="button" onClick={generateImages} disabled={isGenerating} className="mt-5 h-14 w-full rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-400">{isGenerating ? "Generando imagen..." : "Generar imagen"}</button>

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
                            {image.logoOverlayApplied ? (
                              <span className="absolute bottom-3 left-3 rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">Logo aplicado</span>
                            ) : null}
                          </a>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => { setSelectedImageIndex(index); updateLogoOverlay({ enabled: true }); setIsLogoModalOpen(true); }} className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-950">Insertar logo</button>
                            <a download={downloadName} href={dataUrlFromBase64(visibleImage)} className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white">Descargar</a>
                          </div>
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
