"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import {
  ClientAsset,
  GenerationRequest,
  getGenerationRequest,
  listClientAssets,
  saveGeneratedImageRecord,
  updateGenerationRequest
} from "@/lib/data";

const models = [
  { id: "gemini-3-pro-image", label: "Gemini Pro Imagen · profesional · aprox $2.50 MXN/img" },
  { id: "gemini-3.1-flash-image", label: "Gemini 3.1 Flash Imagen · balanceado · aprox $1.90 MXN/img" },
  { id: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Imagen · rápido · aprox $1.20 MXN/img" }
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

function isImage(asset: ClientAsset) {
  const path = `${asset.fileUrl} ${asset.storagePath || ""}`.toLowerCase();
  return (asset.mimeType || "").startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(path) || path.includes("firebasestorage.googleapis.com");
}

function isLogo(asset: ClientAsset) {
  const value = `${asset.type} ${asset.category} ${(asset.tags || []).join(" ")} ${asset.name}`.toLowerCase();
  return isImage(asset) && (value.includes("logo") || value.includes("logotipo"));
}

function formatStatus(status?: string) {
  if (status === "completed") return "completed";
  if (status === "generating") return "generating";
  if (status === "error") return "error";
  return status || "brief_ready";
}

function dataUrlFromBase64(base64: string) {
  return `data:image/png;base64,${base64}`;
}

export default function GenerationRequestPage() {
  const { requestId } = useParams<{ requestId: string }>();

  const [request, setRequest] = useState<GenerationRequest | null>(null);
  const [assets, setAssets] = useState<ClientAsset[]>([]);
  const [selectedModel, setSelectedModel] = useState("gemini-3-pro-image");
  const [variantCount, setVariantCount] = useState(1);
  const [useReferences, setUseReferences] = useState(true);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [logoOverlayEnabled, setLogoOverlayEnabled] = useState(false);
  const [selectedLogoAssetId, setSelectedLogoAssetId] = useState("");
  const [logoPosition, setLogoPosition] = useState("bottom-right");
  const [logoSize, setLogoSize] = useState("medium");

  async function load() {
    const found = await getGenerationRequest(requestId);
    setRequest(found);
    if (found?.clientId) {
      const clientAssets = await listClientAssets(found.clientId);
      setAssets(clientAssets);
      const selected = found.selectedAssetIds?.length ? found.selectedAssetIds : clientAssets.filter((asset) => asset.isFeatured && !isLogo(asset)).map((asset) => asset.id || "");
      setSelectedAssetIds(selected.filter(Boolean));
      const logo = clientAssets.find(isLogo);
      if (logo) setSelectedLogoAssetId(logo.id || "");
    }
    if (found?.executedModel && models.some((model) => model.id === found.executedModel)) setSelectedModel(found.executedModel);
  }

  useEffect(() => { load(); }, [requestId]);

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedAssetIds.includes(asset.id || "")),
    [assets, selectedAssetIds]
  );
  const visualReferences = useReferences ? selectedAssets.filter(isImage) : [];
  const logoAssets = assets.filter(isLogo);
  const selectedLogo = assets.find((asset) => asset.id === selectedLogoAssetId);

  function toggleAsset(id: string) {
    setSelectedAssetIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function generateImages() {
    if (!request) return;
    setError("");
    setSuccess("");
    setGeneratedImages([]);
    setIsGenerating(true);

    try {
      await updateGenerationRequest(requestId, {
        status: "generating",
        executedModel: selectedModel,
        selectedAssetIds,
        selectedAssetsSnapshot: selectedAssets,
        logoOverlay: {
          enabled: logoOverlayEnabled,
          assetId: selectedLogoAssetId,
          assetName: selectedLogo?.name,
          fileUrl: selectedLogo?.fileUrl,
          position: logoPosition,
          size: logoSize
        }
      });

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: request.generatedPrompt,
          format: request.format,
          model: selectedModel,
          variantCount,
          referenceImages: visualReferences.map((asset) => ({ url: asset.fileUrl, name: asset.name }))
        })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo generar imagen.");

      const images = payload.imagesBase64 || [];
      setGeneratedImages(images);

      for (let index = 0; index < images.length; index++) {
        await saveGeneratedImageRecord({
          requestId,
          clientId: request.clientId,
          clientName: request.clientName,
          imageDataUrl: dataUrlFromBase64(images[index]),
          model: payload.executedModel || selectedModel,
          variantIndex: index + 1,
          logoOverlayApplied: false,
          status: "generated"
        });
      }

      await updateGenerationRequest(requestId, {
        status: "completed",
        executedModel: payload.executedModel || selectedModel,
        generationMode: payload.generationMode || "gemini"
      });

      setSuccess("Imagen generada correctamente.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar.");
      await updateGenerationRequest(requestId, { status: "error" });
    } finally {
      setIsGenerating(false);
    }
  }

  async function applyLogoOverlay() {
    if (!generatedImages[selectedImageIndex]) return alert("Primero genera una imagen.");
    if (!selectedLogo) return alert("Selecciona un logo.");
    setLogoOverlayEnabled(true);
    setSuccess("Logo overlay activado en la vista previa. El siguiente paso será quemarlo dentro del PNG con Sharp.");
  }

  if (!request) {
    return <AppShell active="BUST It Now">
      <main className="min-h-screen bg-zinc-100 p-8 text-zinc-950">
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm">
          <p>Cargando request...</p>
        </section>
      </main>
    </AppShell>;
  }

  return <AppShell active="BUST It Now">
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
              {(request.textBlocks || []).length ? <div className="mt-1 space-y-1">
                {(request.textBlocks as any[]).map((block, index) => <p key={index}>{block.role || "Texto"}: {block.text}</p>)}
              </div> : <p className="mt-1">-</p>}

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
                {[1,2,4].map((count) => <button key={count} type="button" onClick={() => setVariantCount(count)} className={`h-12 rounded-2xl border px-4 text-sm font-semibold transition ${variantCount===count ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50"}`}>{count === 1 ? "1 imagen" : `${count} variantes`}</button>)}
              </div>

              <div className="mt-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <strong className="text-sm text-zinc-950">Usar referencias visuales reales</strong>
                    <p className="mt-1 text-sm leading-5 text-zinc-600">{visualReferences.length} referencia(s) de imagen disponibles para apoyar la generación.</p>
                  </div>
                  <button type="button" onClick={() => setUseReferences(!useReferences)} className={`rounded-full px-5 py-2 text-sm font-semibold ${useReferences ? "bg-zinc-950 text-white" : "bg-white text-zinc-700 border border-zinc-200"}`}>{useReferences ? "Activo" : "Inactivo"}</button>
                </div>

                {assets.length ? <div className="mt-4 space-y-3">
                  {assets.filter(isImage).map((asset) => <button type="button" key={asset.id} onClick={() => toggleAsset(asset.id || "")} className={`flex w-full items-center gap-3 rounded-3xl border p-3 text-left transition ${selectedAssetIds.includes(asset.id || "") ? "border-zinc-950 bg-white" : "border-zinc-200 bg-white/70 hover:border-zinc-400"}`}>
                    <img src={asset.fileUrl} alt={asset.name} className="h-14 w-14 rounded-2xl object-cover" />
                    <span><strong className="block text-xs text-zinc-950">{asset.name}</strong><span className="text-xs text-zinc-500">{asset.type} · {asset.category || "Sin categoría"}</span></span>
                  </button>)}
                </div> : null}
              </div>

              <button type="button" onClick={generateImages} disabled={isGenerating} className="mt-5 h-14 w-full rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-400">{isGenerating ? "Generando imagen..." : "Generar imagen"}</button>

              {error ? <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">{error}</div> : null}
              {success ? <div className="mt-5 rounded-3xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-medium text-green-700">{success}</div> : null}
            </article>

            <article className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">Logo posterior</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Insertar logo después</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">Activa el overlay después de generar para ver el logo sobre la imagen seleccionada.</p>

              <div className="mt-5 grid gap-3">
                <select value={selectedLogoAssetId} onChange={(event) => setSelectedLogoAssetId(event.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-950">
                  <option value="">Selecciona logo</option>
                  {logoAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
                <select value={logoPosition} onChange={(event) => setLogoPosition(event.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-950">
                  {logoPositions.map((position) => <option key={position.id} value={position.id}>{position.label}</option>)}
                </select>
                <select value={logoSize} onChange={(event) => setLogoSize(event.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-950">
                  {logoSizes.map((size) => <option key={size.id} value={size.id}>{size.label}</option>)}
                </select>
                <button type="button" onClick={applyLogoOverlay} className="h-12 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-50">Aplicar logo a vista previa</button>
              </div>
            </article>

            <article className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">Resultados</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Imágenes generadas</h2>
              {generatedImages.length === 0 ? <p className="mt-4 text-sm text-zinc-600">Aún no hay imágenes generadas para este request.</p> : <div className="mt-5 grid gap-4">
                {generatedImages.map((image, index) => <article key={index} className={`rounded-3xl border p-3 ${selectedImageIndex===index ? "border-zinc-950" : "border-zinc-200"}`}>
                  <button type="button" onClick={() => setSelectedImageIndex(index)} className="relative block w-full overflow-hidden rounded-2xl bg-zinc-100">
                    <img src={dataUrlFromBase64(image)} alt={`Generada ${index+1}`} className="w-full rounded-2xl" />
                    {logoOverlayEnabled && selectedLogo?.fileUrl && selectedImageIndex===index ? <img src={selectedLogo.fileUrl} alt="Logo overlay" className={`absolute ${logoPositionClass(logoPosition)} ${logoSizeClass(logoSize)} object-contain drop-shadow-lg`} /> : null}
                  </button>
                  <a download={`${request.clientName}-variante-${index+1}.png`} href={dataUrlFromBase64(image)} className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white">Descargar</a>
                </article>)}
              </div>}
            </article>
          </aside>
        </section>
      </div>
    </main>
  </AppShell>;
}

function toggleAssetFactory() { return null; }

function logoPositionClass(position: string) {
  if (position === "top-left") return "left-5 top-5";
  if (position === "top-right") return "right-5 top-5";
  if (position === "bottom-left") return "bottom-5 left-5";
  if (position === "bottom-center") return "bottom-5 left-1/2 -translate-x-1/2";
  return "bottom-5 right-5";
}

function logoSizeClass(size: string) {
  if (size === "small") return "h-10 w-20";
  if (size === "large") return "h-20 w-40";
  return "h-14 w-28";
}

function InfoBox({ label, value }: { label: string; value?: string }) {
  return <div className="rounded-3xl bg-zinc-50 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
    <p className="mt-2 text-sm text-zinc-950">{value || "-"}</p>
  </div>;
}
