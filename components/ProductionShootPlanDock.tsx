"use client";

import { useEffect, useMemo, useState } from "react";
import { useModulePermissions, permissionAlert } from "@/components/useModulePermissions";
import {
  ContentRequest,
  Production,
  listProductions,
  listRequests,
  updateProduction,
  updateRequest,
} from "@/lib/data";

type SourceKind = "production" | "batch";

type ShootSource = {
  key: string;
  kind: SourceKind;
  id: string;
  label: string;
  clientName: string;
  requestIds: string[];
  production?: Production;
};

type ParsedProductionNotes = {
  products: string[];
  model: string;
  shot: string;
  location: string;
  condition: string;
  order: string;
};

type PlanColumn = {
  request: ContentRequest;
  parsed: ParsedProductionNotes;
  visualNumber: number;
  tone: "photo" | "photo-model" | "video" | "video-model" | "mixed";
};

function normalizeText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTagLabel(value = "") {
  return value.replace(/^[-–—•\s]+/, "").replace(/\s+/g, " ").trim();
}

function splitProducts(value: string, plural = false) {
  const clean = cleanTagLabel(value);
  if (!clean) return [];
  const separator = plural ? /\s*[;,|]\s*/ : /\s*[;|]\s*/;
  return clean.split(separator).map(cleanTagLabel).filter(Boolean);
}

function parseProductionNotes(value = ""): ParsedProductionNotes {
  const parsed: ParsedProductionNotes = {
    products: [],
    model: "",
    shot: "",
    location: "",
    condition: "",
    order: "",
  };

  String(value || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(/^\s*##\s*([^:]+)\s*:\s*(.*)\s*$/i);
      if (!match) return;
      const key = normalizeText(match[1]);
      const tagValue = cleanTagLabel(match[2]);
      if (!tagValue) return;
      if (key === "producto" || key === "productos") {
        parsed.products.push(...splitProducts(tagValue, key === "productos"));
      } else if (key === "modelo" || key === "modelos") {
        parsed.model = [parsed.model, tagValue].filter(Boolean).join(" · ");
      } else if (key === "toma" || key === "tomas") {
        parsed.shot = [parsed.shot, tagValue].filter(Boolean).join(" · ");
      } else if (key === "locacion" || key === "locaciones" || key === "set") {
        parsed.location = [parsed.location, tagValue].filter(Boolean).join(" · ");
      } else if (key === "condicion" || key === "condiciones") {
        parsed.condition = [parsed.condition, tagValue].filter(Boolean).join(" · ");
      } else if (key === "orden") {
        parsed.order = [parsed.order, tagValue].filter(Boolean).join(" · ");
      }
    });

  const productMap = new Map<string, string>();
  parsed.products.forEach((product) => {
    const key = normalizeText(product);
    if (key && !productMap.has(key)) productMap.set(key, product);
  });
  parsed.products = Array.from(productMap.values());
  return parsed;
}

function requestVisualNumber(request: ContentRequest, fallback: number) {
  const raw = request.lotSequenceNumber ?? request.number ?? fallback;
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function shotTone(request: ContentRequest, parsed: ParsedProductionNotes): PlanColumn["tone"] {
  const text = normalizeText(
    `${parsed.shot} ${request.contentType || ""} ${request.visualFormat || ""} ${request.feedPlacement || ""}`,
  );
  const modelText = normalizeText(parsed.model);
  const hasModel = Boolean(modelText && !/^(no|sin modelo|no aplica)$/.test(modelText));
  const hasVideo = /video|reel|tik|b-roll|broll|grabar|grabacion|camara/.test(text);
  const hasPhoto = /foto|fotograf|imagen|post|carrusel|estatico/.test(text);
  if (hasVideo && hasPhoto) return "mixed";
  if (hasVideo && hasModel) return "video-model";
  if (hasVideo) return "video";
  if (hasModel) return "photo-model";
  return "photo";
}

function referencesForRequest(request: ContentRequest) {
  const links = String(request.referenceLinks || "")
    .split(/\s|,|\n/)
    .map((value) => value.trim())
    .filter((value) => /^https?:\/\//i.test(value));
  const files = (request.referenceFiles || [])
    .map((file) => file.url)
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set([...links, ...files]));
}

function moveValue(values: string[], value: string, direction: -1 | 1) {
  const index = values.indexOf(value);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= values.length) return values;
  const next = [...values];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function buildProductOrder(columns: PlanColumn[]) {
  const map = new Map<string, string>();
  columns.forEach((column) => {
    column.parsed.products.forEach((product) => {
      const key = normalizeText(product);
      if (key && !map.has(key)) map.set(key, product);
    });
  });
  return Array.from(map.values());
}

function buildWhatsAppSummary(
  source: ShootSource | null,
  columns: PlanColumn[],
  products: string[],
) {
  if (!source || !columns.length) return "";
  const lines: string[] = [
    `*PLAN DE RODAJE · ${source.clientName || "CLIENTE"}*`,
    source.kind === "production" ? `_${source.label}_` : `_Plan preliminar · ${source.label}_`,
    "",
  ];

  products.forEach((product, productIndex) => {
    const matching = columns.filter((column) =>
      column.parsed.products.some(
        (candidate) => normalizeText(candidate) === normalizeText(product),
      ),
    );
    if (!matching.length) return;
    lines.push(`*${productIndex + 1}. ${product.toUpperCase()}*`, "");
    matching.forEach((column) => {
      const request = column.request;
      const parsed = column.parsed;
      lines.push(
        `Post #${column.visualNumber} · ${request.topic || request.contentType || "Sin tema"}`,
        `Tipo: ${parsed.shot || request.contentType || "Por definir"}`,
      );
      if (parsed.model) lines.push(`Modelo: ${parsed.model}`);
      if (parsed.location) lines.push(`Locación: ${parsed.location}`);
      if (parsed.condition) lines.push(`Condición: ${parsed.condition}`);
      if (parsed.order) lines.push(`Orden: ${parsed.order}`);
      const references = referencesForRequest(request);
      if (references.length) {
        lines.push("Referencia:", ...references);
      }
      lines.push("");
    });
  });

  const withoutProduct = columns.filter((column) => !column.parsed.products.length);
  if (withoutProduct.length) {
    lines.push("*VISUALES POR CLASIFICAR*", "");
    withoutProduct.forEach((column) => {
      lines.push(
        `Post #${column.visualNumber} · ${column.request.topic || column.request.contentType || "Sin tema"}`,
        "Falta agregar ##Producto en Notas de producción.",
        "",
      );
    });
  }
  return lines.join("\n").trim();
}

export default function ProductionShootPlanDock() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [sourceKey, setSourceKey] = useState("");
  const [visualOrder, setVisualOrder] = useState<string[]>([]);
  const [productOrder, setProductOrder] = useState<string[]>([]);
  const [planReady, setPlanReady] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const permissions = useModulePermissions("producciones");
  const canEdit = permissions.canEdit || permissions.canCreate;

  async function load() {
    setLoading(true);
    try {
      const [loadedRequests, loadedProductions] = await Promise.all([
        listRequests(),
        listProductions(),
      ]);
      setRequests(loadedRequests.filter((request) => request.status !== "eliminada"));
      setProductions(loadedProductions.filter((production) => production.status !== "eliminada"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && !requests.length && !loading) load();
  }, [open]);

  const sources = useMemo(() => {
    const productionSources: ShootSource[] = productions.map((production) => ({
      key: `production:${production.id}`,
      kind: "production",
      id: production.id || "",
      label: production.title || `Producción ${production.clientName || ""}`,
      clientName: production.clientName || "Sin cliente",
      requestIds: production.requestIds || [],
      production,
    }));

    const pendingMap = new Map<string, ShootSource>();
    requests
      .filter((request) => request.requiresProduction && !request.productionId)
      .forEach((request) => {
        const id = request.batchId || `client-${request.clientId || request.clientName}`;
        const key = `batch:${id}`;
        if (!pendingMap.has(key)) {
          pendingMap.set(key, {
            key,
            kind: "batch",
            id,
            label: request.batchName || `Pendientes ${request.clientName || ""}`,
            clientName: request.clientName || "Sin cliente",
            requestIds: [],
          });
        }
        if (request.id) pendingMap.get(key)!.requestIds.push(request.id);
      });

    return [
      ...productionSources.sort((a, b) => b.label.localeCompare(a.label, "es")),
      ...Array.from(pendingMap.values()).sort((a, b) =>
        a.label.localeCompare(b.label, "es"),
      ),
    ];
  }, [productions, requests]);

  const selectedSource = useMemo(
    () => sources.find((source) => source.key === sourceKey) || null,
    [sources, sourceKey],
  );

  useEffect(() => {
    if (!sources.length) {
      if (sourceKey) setSourceKey("");
      return;
    }
    if (!sources.some((source) => source.key === sourceKey))
      setSourceKey(sources[0].key);
  }, [sources, sourceKey]);

  useEffect(() => {
    if (!selectedSource) {
      setVisualOrder([]);
      setProductOrder([]);
      setPlanReady(false);
      return;
    }
    const requestMap = new Map(requests.map((request) => [request.id, request]));
    const production = selectedSource.production;
    const ids = [...selectedSource.requestIds].sort((a, b) => {
      const requestA = requestMap.get(a);
      const requestB = requestMap.get(b);
      if (selectedSource.kind === "production") {
        const orderA =
          production?.productionOrder?.[a] || requestA?.productionOrder || 9999;
        const orderB =
          production?.productionOrder?.[b] || requestB?.productionOrder || 9999;
        if (orderA !== orderB) return Number(orderA) - Number(orderB);
      }
      return (
        requestVisualNumber(requestA || ({} as ContentRequest), 9999) -
        requestVisualNumber(requestB || ({} as ContentRequest), 9999)
      );
    });
    setVisualOrder(ids);
    setProductOrder(
      Array.isArray((production as any)?.shootingPlanProductOrder)
        ? (production as any).shootingPlanProductOrder
        : [],
    );
    setPlanReady(false);
  }, [selectedSource?.key, requests]);

  const requestMap = useMemo(
    () => new Map(requests.map((request) => [request.id, request])),
    [requests],
  );

  const columns = useMemo(() => {
    return visualOrder
      .map((id, index) => {
        const request = requestMap.get(id);
        if (!request) return null;
        const parsed = parseProductionNotes(request.productionNotes || "");
        return {
          request,
          parsed,
          visualNumber: requestVisualNumber(request, index + 1),
          tone: shotTone(request, parsed),
        } as PlanColumn;
      })
      .filter(Boolean) as PlanColumn[];
  }, [visualOrder, requestMap]);

  const detectedProductOrder = useMemo(() => buildProductOrder(columns), [columns]);
  const activeProducts = useMemo(() => {
    const detectedMap = new Map(
      detectedProductOrder.map((product) => [normalizeText(product), product]),
    );
    const saved = productOrder.filter((product) =>
      detectedMap.has(normalizeText(product)),
    );
    const savedKeys = new Set(saved.map(normalizeText));
    return [
      ...saved,
      ...detectedProductOrder.filter(
        (product) => !savedKeys.has(normalizeText(product)),
      ),
    ];
  }, [detectedProductOrder, productOrder]);
  const missingProducts = columns.filter((column) => !column.parsed.products.length);
  const missingShot = columns.filter((column) => !column.parsed.shot);
  const missingLocation = columns.filter((column) => !column.parsed.location);
  const whatsappSummary = useMemo(
    () => buildWhatsAppSummary(selectedSource, columns, activeProducts),
    [selectedSource, columns, activeProducts],
  );

  function generatePlan() {
    setProductOrder(detectedProductOrder);
    setPlanReady(true);
    setCopyStatus("");
  }

  function moveVisual(id: string, direction: -1 | 1) {
    setVisualOrder((current) => moveValue(current, id, direction));
    setPlanReady(true);
  }

  function moveProduct(product: string, direction: -1 | 1) {
    setProductOrder((current) =>
      moveValue(current.length ? current : detectedProductOrder, product, direction),
    );
    setPlanReady(true);
  }

  async function copySummary() {
    if (!whatsappSummary) return;
    try {
      await navigator.clipboard.writeText(whatsappSummary);
      setCopyStatus("Resumen copiado");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = whatsappSummary;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      setCopyStatus("Resumen copiado");
    }
    window.setTimeout(() => setCopyStatus(""), 2500);
  }

  async function savePlanOrder() {
    if (!canEdit) return permissionAlert("guardar el plan de rodaje");
    if (!selectedSource || selectedSource.kind !== "production" || !selectedSource.id)
      return alert("El orden solo puede guardarse cuando ya existe una producción.");
    setSaving(true);
    try {
      const order: Record<string, number> = {};
      visualOrder.forEach((id, index) => {
        order[id] = index + 1;
      });
      await updateProduction(
        selectedSource.id,
        {
          productionOrder: order,
          productionOrderMode: "manual",
          productionOrderGeneratedAt: new Date().toISOString(),
          shootingPlanProductOrder: activeProducts,
          shootingPlanGeneratedAt: new Date().toISOString(),
        } as any,
      );
      await Promise.all(
        visualOrder.map((id, index) =>
          updateRequest(id, {
            productionOrder: index + 1,
            manualOrderEdited: true,
          }),
        ),
      );
      await load();
      alert("Orden visual y orden de productos guardados en la producción.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style jsx global>{`
        .shoot-plan-launcher {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 1150;
          border: 0;
          border-radius: 999px;
          padding: 13px 18px;
          background: var(--brand-dark, #343a40);
          color: #fff;
          font-weight: 950;
          box-shadow: 0 14px 36px rgba(0,0,0,.22);
          cursor: pointer;
        }
        .shoot-plan-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1200;
          background: rgba(15, 23, 42, .48);
          display: grid;
          justify-items: end;
        }
        .shoot-plan-drawer {
          width: min(1180px, 96vw);
          height: 100vh;
          overflow: auto;
          background: #f6f7f8;
          box-shadow: -24px 0 60px rgba(0,0,0,.22);
          padding: 20px;
        }
        .shoot-plan-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        .shoot-plan-head h2 { margin: 2px 0 5px; }
        .shoot-plan-source {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) auto auto;
          gap: 10px;
          align-items: end;
          border: 1px solid rgba(52,58,64,.12);
          border-radius: 20px;
          background: #fff;
          padding: 14px;
        }
        .shoot-plan-source .field { margin: 0; }
        .shoot-plan-kpis {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin: 14px 0;
        }
        .shoot-plan-kpi {
          border: 1px solid rgba(52,58,64,.1);
          border-radius: 16px;
          background: #fff;
          padding: 12px;
        }
        .shoot-plan-kpi span { display:block; color:#667085; font-size:10px; font-weight:900; text-transform:uppercase; }
        .shoot-plan-kpi strong { display:block; margin-top:4px; font-size:22px; }
        .shoot-plan-warning {
          border: 1px solid #fed7aa;
          border-radius: 16px;
          background: #fff7ed;
          color: #9a3412;
          padding: 11px 13px;
          margin-bottom: 12px;
          font-size: 12px;
          font-weight: 750;
        }
        .shoot-plan-section {
          border: 1px solid rgba(52,58,64,.12);
          border-radius: 22px;
          background: #fff;
          padding: 16px;
          margin-top: 14px;
        }
        .shoot-plan-section-head {
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:12px;
          margin-bottom:12px;
        }
        .shoot-plan-section-head h3 { margin:0 0 4px; }
        .shoot-plan-legend { display:flex; gap:7px; flex-wrap:wrap; }
        .shoot-plan-legend span { border-radius:999px; padding:6px 9px; font-size:10px; font-weight:900; border:1px solid rgba(52,58,64,.12); }
        .shoot-plan-table-wrap { overflow:auto; }
        .shoot-plan-table { border-collapse:separate; border-spacing:4px; min-width:100%; }
        .shoot-plan-table th, .shoot-plan-table td { min-width:78px; border-radius:9px; padding:8px; text-align:center; font-size:12px; }
        .shoot-plan-table th { background:#eef0f2; }
        .shoot-plan-table .product-heading { min-width:220px; text-align:left; position:sticky; left:0; z-index:2; background:#fff; border:1px solid rgba(52,58,64,.1); }
        .shoot-plan-table .visual-heading { min-width:105px; }
        .shoot-plan-table .visual-actions, .shoot-plan-row-actions { display:flex; justify-content:center; gap:4px; margin-top:5px; }
        .shoot-plan-mini-button { border:1px solid rgba(52,58,64,.15); background:#fff; border-radius:8px; padding:3px 6px; cursor:pointer; }
        .shoot-cell { border:1px solid rgba(52,58,64,.12); font-weight:950; }
        .shoot-cell.empty { background:#f8fafc; color:#cbd5e1; }
        .shoot-cell.photo { background:#fff; }
        .shoot-cell.photo-model { background:#d8ad18; color:#111827; }
        .shoot-cell.video { background:#3b82f6; color:#07111f; }
        .shoot-cell.video-model { background:#ef0ad7; color:#111827; }
        .shoot-cell.mixed { background:#8b5cf6; color:#fff; }
        .shoot-sequence-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:10px; }
        .shoot-sequence-card { border:1px solid rgba(52,58,64,.1); border-radius:16px; padding:12px; background:#f8fafc; }
        .shoot-sequence-card h4 { margin:0 0 8px; }
        .shoot-sequence-item { border-top:1px solid rgba(52,58,64,.08); padding:8px 0; font-size:12px; }
        .shoot-sequence-item:first-of-type { border-top:0; }
        .shoot-summary-text { width:100%; min-height:320px; white-space:pre-wrap; font-family:inherit; line-height:1.5; }
        @media (max-width: 760px) {
          .shoot-plan-drawer { width:100vw; padding:13px; }
          .shoot-plan-source { grid-template-columns:1fr; }
          .shoot-plan-kpis { grid-template-columns:1fr 1fr; }
          .shoot-plan-head { flex-direction:column; }
          .shoot-sequence-grid { grid-template-columns:1fr; }
        }
        @media print {
          .shoot-plan-launcher, .shoot-plan-backdrop { display:none !important; }
        }
      `}</style>

      <button className="shoot-plan-launcher" type="button" onClick={() => setOpen(true)}>
        Plan de rodaje
      </button>

      {open && (
        <div className="shoot-plan-backdrop" onClick={() => setOpen(false)}>
          <aside className="shoot-plan-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="shoot-plan-head">
              <div>
                <p className="eyebrow">Producción</p>
                <h2>Generador de plan de rodaje</h2>
                <p className="mini">
                  Convierte las nomenclaturas ## de Notas de producción en una matriz de productos, visuales y resumen para WhatsApp.
                </p>
              </div>
              <button className="btn red" type="button" onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>

            <div className="shoot-plan-source">
              <div className="field">
                <label>Producción o lote pendiente</label>
                <select
                  value={sourceKey}
                  onChange={(event) => setSourceKey(event.target.value)}
                  disabled={loading}
                >
                  {!sources.length && <option value="">Sin producciones disponibles</option>}
                  {productions.length > 0 && (
                    <optgroup label="Producciones creadas">
                      {sources.filter((source) => source.kind === "production").map((source) => (
                        <option key={source.key} value={source.key}>
                          {source.clientName} · {source.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {sources.some((source) => source.kind === "batch") && (
                    <optgroup label="Lotes pendientes de producción">
                      {sources.filter((source) => source.kind === "batch").map((source) => (
                        <option key={source.key} value={source.key}>
                          {source.clientName} · {source.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <button className="btn dark" type="button" onClick={generatePlan} disabled={!columns.length}>
                Generar / actualizar plan
              </button>
              <button className="btn" type="button" onClick={load} disabled={loading}>
                {loading ? "Actualizando..." : "Actualizar datos"}
              </button>
            </div>

            <div className="shoot-plan-kpis">
              <div className="shoot-plan-kpi"><span>Visuales</span><strong>{columns.length}</strong></div>
              <div className="shoot-plan-kpi"><span>Productos</span><strong>{detectedProductOrder.length}</strong></div>
              <div className="shoot-plan-kpi"><span>Con modelo</span><strong>{columns.filter((column) => column.parsed.model).length}</strong></div>
              <div className="shoot-plan-kpi"><span>Alertas</span><strong>{missingProducts.length + missingShot.length}</strong></div>
            </div>

            {!!missingProducts.length && (
              <div className="shoot-plan-warning">
                {missingProducts.length} visual(es) no tienen ##Producto. Permanecerán en el resumen como pendientes de clasificar.
              </div>
            )}
            {!!missingShot.length && (
              <div className="shoot-plan-warning">
                {missingShot.length} visual(es) no tienen ##Toma. El sistema inferirá foto o video desde el tipo de contenido.
              </div>
            )}
            {!!missingLocation.length && (
              <div className="shoot-plan-warning">
                {missingLocation.length} visual(es) no tienen ##Locación. Pueden mantenerse así, pero no podrán agruparse por set.
              </div>
            )}

            {(planReady || columns.length > 0) && (
              <>
                <section className="shoot-plan-section">
                  <div className="shoot-plan-section-head">
                    <div>
                      <h3>Matriz del plan de rodaje</h3>
                      <p className="mini">Las columnas son el orden de grabación; las filas son el orden de salida de productos. Ajusta ambos con las flechas.</p>
                    </div>
                    <div className="shoot-plan-legend">
                      <span>Blanco · Foto producto</span>
                      <span style={{ background: "#d8ad18" }}>Ocre · Foto modelo</span>
                      <span style={{ background: "#3b82f6" }}>Azul · Video B-roll</span>
                      <span style={{ background: "#ef0ad7" }}>Magenta · Video modelo</span>
                      <span style={{ background: "#8b5cf6", color: "white" }}>Morado · Mixto</span>
                    </div>
                  </div>
                  <div className="shoot-plan-table-wrap">
                    <table className="shoot-plan-table">
                      <thead>
                        <tr>
                          <th className="product-heading">Producto / elemento</th>
                          {columns.map((column) => (
                            <th className="visual-heading" key={column.request.id}>
                              V{column.visualNumber}
                              <div className="shoot-plan-visual-actions">
                                <button className="shoot-plan-mini-button" type="button" onClick={() => moveVisual(column.request.id!, -1)}>←</button>
                                <button className="shoot-plan-mini-button" type="button" onClick={() => moveVisual(column.request.id!, 1)}>→</button>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeProducts.map((product) => (
                          <tr key={normalizeText(product)}>
                            <th className="product-heading">
                              {product}
                              <div className="shoot-plan-row-actions">
                                <button className="shoot-plan-mini-button" type="button" onClick={() => moveProduct(product, -1)}>↑</button>
                                <button className="shoot-plan-mini-button" type="button" onClick={() => moveProduct(product, 1)}>↓</button>
                              </div>
                            </th>
                            {columns.map((column) => {
                              const included = column.parsed.products.some(
                                (candidate) => normalizeText(candidate) === normalizeText(product),
                              );
                              return (
                                <td
                                  className={included ? `shoot-cell ${column.tone}` : "shoot-cell empty"}
                                  key={`${normalizeText(product)}-${column.request.id}`}
                                  title={included ? column.parsed.shot || column.request.contentType : "No aparece"}
                                >
                                  {included ? `V${column.visualNumber}` : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!activeProducts.length && <p className="mini">No se detectaron productos. Agrega al menos una línea ##Producto en cada nota de producción.</p>}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                    <button className="btn blue" type="button" onClick={savePlanOrder} disabled={!canEdit || selectedSource?.kind !== "production" || saving}>
                      {saving ? "Guardando..." : "Guardar orden en producción"}
                    </button>
                    {selectedSource?.kind === "batch" && <span className="mini">Este plan es preliminar. Crea la producción para guardar el orden definitivo.</span>}
                  </div>
                </section>

                <section className="shoot-plan-section">
                  <div className="shoot-plan-section-head">
                    <div>
                      <h3>Secuencia operativa</h3>
                      <p className="mini">Resumen por producto en el orden en que debe salir al set.</p>
                    </div>
                  </div>
                  <div className="shoot-sequence-grid">
                    {activeProducts.map((product, productIndex) => {
                      const matching = columns.filter((column) =>
                        column.parsed.products.some(
                          (candidate) => normalizeText(candidate) === normalizeText(product),
                        ),
                      );
                      return (
                        <article className="shoot-sequence-card" key={normalizeText(product)}>
                          <h4>{productIndex + 1}. {product}</h4>
                          {matching.map((column) => (
                            <div className="shoot-sequence-item" key={column.request.id}>
                              <strong>V{column.visualNumber} · {column.request.topic || column.request.contentType}</strong>
                              <div>{column.parsed.shot || column.request.contentType || "Toma por definir"}</div>
                              {column.parsed.model && <div>Modelo: {column.parsed.model}</div>}
                              {column.parsed.condition && <div>Condición: {column.parsed.condition}</div>}
                              {column.parsed.order && <div>Orden: {column.parsed.order}</div>}
                            </div>
                          ))}
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="shoot-plan-section">
                  <div className="shoot-plan-section-head">
                    <div>
                      <h3>Resumen para WhatsApp</h3>
                      <p className="mini">Incluye producto, número de post, tipo de toma, modelo, locación, condiciones y links de referencia.</p>
                    </div>
                    <button className="btn dark" type="button" onClick={copySummary} disabled={!whatsappSummary}>
                      {copyStatus || "Copiar resumen"}
                    </button>
                  </div>
                  <textarea className="shoot-summary-text" readOnly value={whatsappSummary} />
                </section>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
