"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useModulePermissions, permissionAlert } from "@/components/useModulePermissions";
import { auth } from "@/lib/firebase";
import {
  ContentRequest,
  TaskComment,
  listRequests,
  subscribeRequests,
  updateRequest,
} from "@/lib/data";

function currentActorName() {
  const user = auth.currentUser;
  return user?.displayName || user?.email || "Usuario actual";
}

function splitLinks(value = "") {
  return value
    .split(/\s|,|\n/)
    .map((x) => x.trim())
    .filter(
      (x) =>
        x.startsWith("http://") ||
        x.startsWith("https://") ||
        x.includes("drive") ||
        x.includes("canva"),
    );
}

const reasons = [
  "Errores ortográficos",
  "Copy no alineado",
  "Diseño no alineado a marca",
  "Formato incorrecto",
  "Material incorrecto",
  "Falta información",
  "No cumple objetivo",
  "Baja calidad visual",
  "Otro",
];

type ReviewStage = "content" | "kam";
type SortKey =
  | "client"
  | "task"
  | "type"
  | "platforms"
  | "responsible"
  | "publishDate"
  | "link"
  | "status";

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [selected, setSelected] = useState<ContentRequest | null>(null);
  const [selectedStage, setSelectedStage] = useState<ReviewStage>("content");
  const [reason, setReason] = useState(reasons[0]);
  const [notes, setNotes] = useState("");

  const [clientFilter, setClientFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState<
    "content" | "kam" | "devueltas" | "historial" | "all"
  >("content");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("publishDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const permissions = useModulePermissions("aprobaciones");
  const canApproveAction = permissions.canApprove;

  async function load() {
    setRequests((await listRequests()).filter((x) => x.status !== "eliminada"));
  }
  useEffect(() => {
    const unsubscribe = subscribeRequests(
      (items) => setRequests(items.filter((x) => x.status !== "eliminada")),
      () => load(),
    );
    return () => unsubscribe();
  }, []);

  function taskTitle(item: ContentRequest) {
    return (
      item.topic ||
      item.creativeIdea ||
      `${item.contentType || "Pieza"} · ${item.objective || "Objetivo"}`
    );
  }
  function typeLabel(item: ContentRequest) {
    return (
      [item.contentType, item.objective].filter(Boolean).join(" · ") ||
      "Sin tipo"
    );
  }
  function platformsLabel(item: ContentRequest) {
    return item.platforms?.length
      ? item.platforms.join(", ")
      : item.visualFormat || item.feedPlacement || "Sin plataformas";
  }
  function normalizeExternalUrl(value?: string) {
    const url = (value || "").trim();
    if (!url) return "#";
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  function isContentPending(item: ContentRequest) {
    return (
      item.status === "pendiente_aprobacion" ||
      item.approvalStatus === "pendiente"
    );
  }
  function isKamPending(item: ContentRequest) {
    return (
      item.status === "pendiente_aprobacion_kam" ||
      item.approvalStatus === "content_aprobada"
    );
  }
  function isApprovedForContents(item: ContentRequest) {
    return (
      item.status === "aprobada_pendiente_copyout" ||
      item.status === "aprobada_pendiente_contenidos" ||
      (item.approvalStatus === "aprobada" && item.status !== "finalizada")
    );
  }
  function statusLabel(item: ContentRequest) {
    if (isContentPending(item)) return "Pendiente Content";
    if (isKamPending(item)) return "Pendiente KAM";
    if (isApprovedForContents(item)) return "Aprobada para Contenidos";
    if (item.status === "rebotada" || item.approvalStatus === "rechazada")
      return "Devuelta";
    if (item.status === "finalizada") return "Finalizada";
    return item.status || "Sin estado";
  }

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach((x) =>
      map.set(x.clientId || "sin-cliente", x.clientName || "Sin cliente"),
    );
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [requests]);
  const batches = useMemo(() => {
    const map = new Map<string, string>();
    requests
      .filter((x) => clientFilter === "all" || x.clientId === clientFilter)
      .forEach((x) =>
        map.set(x.batchId || "sin-lote", x.batchName || "Sin lote"),
      );
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [requests, clientFilter]);

  const filtered = useMemo(
    () =>
      requests
        .filter((x) => {
          const text =
            `${x.clientName} ${x.batchName} ${taskTitle(x)} ${typeLabel(x)} ${platformsLabel(x)} ${x.assignedTo || ""} ${x.finalPostLink || ""} ${x.creativeIdea || ""}`.toLowerCase();
          const stageOk =
            stageFilter === "all" ||
            (stageFilter === "content" && isContentPending(x)) ||
            (stageFilter === "kam" && isKamPending(x)) ||
            (stageFilter === "devueltas" &&
              (x.status === "rebotada" || x.approvalStatus === "rechazada")) ||
            (stageFilter === "historial" &&
              (isApprovedForContents(x) || x.status === "finalizada"));
          return (
            stageOk &&
            (clientFilter === "all" || x.clientId === clientFilter) &&
            (batchFilter === "all" ||
              (x.batchId || "sin-lote") === batchFilter) &&
            (!search.trim() || text.includes(search.trim().toLowerCase()))
          );
        })
        .sort((a, b) => {
          const values = (item: ContentRequest): Record<SortKey, string> => ({
            client: item.clientName || "",
            task: taskTitle(item),
            type: typeLabel(item),
            platforms: platformsLabel(item),
            responsible: item.assignedTo || "",
            publishDate: item.publishDate || "",
            link: item.finalPostLink || "",
            status: statusLabel(item),
          });
          const result = values(a)[sortKey].localeCompare(
            values(b)[sortKey],
            "es",
            { numeric: true, sensitivity: "base" },
          );
          return sortDirection === "asc" ? result : -result;
        }),
    [
      requests,
      clientFilter,
      batchFilter,
      stageFilter,
      search,
      sortKey,
      sortDirection,
    ],
  );

  const pendingContent = requests.filter(isContentPending).length;
  const pendingKam = requests.filter(isKamPending).length;
  const approvedContents = requests.filter(isApprovedForContents).length;
  const rejected = requests.filter(
    (x) => x.status === "rebotada" || x.approvalStatus === "rechazada",
  ).length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }
  function sortLabel(key: SortKey) {
    return sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : "";
  }

  function startReview(item: ContentRequest, stage: ReviewStage) {
    setSelected(item);
    setSelectedStage(stage);
    setReason(reasons[0]);
    setNotes("");
  }

  async function approveContent(item: ContentRequest) {
    if (!canApproveAction) return permissionAlert("aprobar piezas");
    if (!item.id) return;
    const log: TaskComment = {
      id: `${Date.now()}`,
      author: currentActorName(),
      target: "KAM",
      body: "Content aprobó la pieza. Pasa a revisión KAM.",
      mentions: ["@kam"],
      status: "open",
      createdAt: new Date().toISOString(),
    };
    await updateRequest(item.id, {
      status: "pendiente_aprobacion_kam",
      approvalStatus: "content_aprobada",
      approvalRejectionReason: "",
      approvalNotes: "",
      comments: [...(item.comments || []), log],
    });
    setSelected(null);
    await load();
    alert("Aprobada por Content. Ahora pasa a KAM.");
  }

  async function approveKam(item: ContentRequest) {
    if (!canApproveAction) return permissionAlert("aprobar piezas como KAM");
    if (!item.id) return;
    const log: TaskComment = {
      id: `${Date.now()}`,
      author: currentActorName(),
      target: "Copy",
      body: "KAM aprobó la pieza. Pasa a Contenidos para copy final y publicación.",
      mentions: ["@copy"],
      status: "open",
      createdAt: new Date().toISOString(),
    };
    await updateRequest(item.id, {
      status: "aprobada_pendiente_copyout",
      approvalStatus: "aprobada",
      approvalRejectionReason: "",
      approvalNotes: "",
      comments: [...(item.comments || []), log],
    });
    setSelected(null);
    await load();
    alert("Aprobada por KAM. Ya está en Contenidos.");
  }

  async function reject(item: ContentRequest) {
    if (!canApproveAction) return permissionAlert("devolver piezas desde Aprobaciones");
    if (!item.id) return;
    if (!reason) return alert("Selecciona motivo.");
    const target =
      selectedStage === "kam"
        ? "Content"
        : item.assignedArea || item.suggestedArea || "Responsable";
    const mention =
      selectedStage === "kam"
        ? "@content"
        : target.toLowerCase().includes("audio")
          ? "@audiovisual"
          : "@diseño";
    const noteText = notes.trim() ? ` Nota: ${notes.trim()}` : "";
    const log: TaskComment = {
      id: `${Date.now()}`,
      author: currentActorName(),
      target,
      body: `Pieza devuelta por ${selectedStage === "kam" ? "KAM" : "Content"}. Motivo: ${reason}.${noteText}`,
      mentions: [mention],
      status: "open",
      createdAt: new Date().toISOString(),
    };
    await updateRequest(item.id, {
      status: "rebotada",
      approvalStatus: "rechazada",
      approvalRejectionReason: reason,
      approvalNotes: notes,
      comments: [...(item.comments || []), log],
    });
    setSelected(null);
    setNotes("");
    await load();
    alert("Pieza devuelta con motivo.");
  }

  return (
    <AppShell active="Aprobaciones">
      <section className="hero">
        <div>
          <p className="eyebrow">Control de calidad</p>
          <h1>Aprobaciones</h1>
          <p>
            Doble aprobación: primero Content valida ejecución y brief; después
            KAM valida marca, cliente y salida comercial.
          </p>
        </div>
      </section>

      {!canApproveAction && (
        <section className="card readonly-note">
          Modo solo lectura: puedes revisar aprobaciones, pero tu rol no puede aprobar ni devolver piezas.
        </section>
      )}

      <section className="grid kpis">
        {[
          ["Pendientes Content", String(pendingContent)],
          ["Pendientes KAM", String(pendingKam)],
          ["Aprobadas para Contenidos", String(approvedContents)],
          ["Devueltas", String(rejected)],
        ].map(([a, b]) => (
          <div className="kpi" key={a}>
            <span>{a}</span>
            <strong>{b}</strong>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="finalized-group-title">
          <div>
            <h3>Bandeja de aprobaciones</h3>
            <p className="mini">
              Revisa por etapa sin mezclar el llenado de copy. El copy final
              vive en Contenidos.
            </p>
          </div>
        </div>
        <div className="finalized-toolbar">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as any)}
          >
            <option value="content">Pendientes Content</option>
            <option value="kam">Pendientes KAM</option>
            <option value="devueltas">Devueltas</option>
            <option value="historial">Aprobadas / historial</option>
            <option value="all">Todas</option>
          </select>
          <select
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value);
              setBatchFilter("all");
            }}
          >
            <option value="all">Todos los clientes</option>
            {clients.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
          >
            <option value="all">Todos los lotes</option>
            {batches.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tarea, responsable, link..."
          />
          <button
            className="btn"
            onClick={() => {
              setStageFilter("content");
              setClientFilter("all");
              setBatchFilter("all");
              setSearch("");
            }}
          >
            Limpiar
          </button>
        </div>

        <div className="approvals-row header">
          <button type="button" onClick={() => toggleSort("client")}>
            Cliente{sortLabel("client")}
          </button>
          <button type="button" onClick={() => toggleSort("task")}>
            Tarea{sortLabel("task")}
          </button>
          <button type="button" onClick={() => toggleSort("type")}>
            Tipo{sortLabel("type")}
          </button>
          <button type="button" onClick={() => toggleSort("platforms")}>
            Plataformas{sortLabel("platforms")}
          </button>
          <button type="button" onClick={() => toggleSort("responsible")}>
            Responsable{sortLabel("responsible")}
          </button>
          <button type="button" onClick={() => toggleSort("publishDate")}>
            Fecha{sortLabel("publishDate")}
          </button>
          <button type="button" onClick={() => toggleSort("link")}>
            Link{sortLabel("link")}
          </button>
          <button type="button" onClick={() => toggleSort("status")}>
            Estado{sortLabel("status")}
          </button>
          <span>Acciones</span>
        </div>
        {filtered.map((item) => {
          const stage: ReviewStage = isKamPending(item) ? "kam" : "content";
          return (
            <div className="approvals-row" key={item.id}>
              <span className="list-truncate-cell">
                <strong>{item.clientName || "Sin cliente"}</strong>
                <br />
                <small>{item.batchName || "Sin lote"}</small>
              </span>
              <span className="list-truncate-cell">{taskTitle(item)}</span>
              <span className="list-truncate-cell">{typeLabel(item)}</span>
              <span className="list-truncate-cell">{platformsLabel(item)}</span>
              <span className="list-truncate-cell">
                {item.assignedTo || "Sin responsable"}
              </span>
              <span className="list-truncate-cell">
                {item.publishDate || "Sin fecha"}
              </span>
              <span className="list-truncate-cell">
                {item.finalPostLink ? (
                  <a
                    href={normalizeExternalUrl(item.finalPostLink)}
                    target="_blank"
                  >
                    Abrir link
                  </a>
                ) : (
                  <span className="pill amber">Sin link</span>
                )}
              </span>
              <span>
                <span
                  className={
                    isApprovedForContents(item) || item.status === "finalizada"
                      ? "pill green"
                      : item.status === "rebotada"
                        ? "pill red"
                        : "pill"
                  }
                >
                  {statusLabel(item)}
                </span>
              </span>
              <span>
                {isContentPending(item) || isKamPending(item) ? (
                  <button
                    className="btn blue"
                    onClick={() => startReview(item, stage)}
                  >
                    Revisar
                  </button>
                ) : (
                  <button
                    className="btn"
                    onClick={() => startReview(item, stage)}
                  >
                    Ver
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {!filtered.length && (
          <p className="mini">No hay piezas con esos filtros.</p>
        )}
      </section>

      {selected && (
        <section className="card" style={{ marginTop: 20 }}>
          <h3>
            {selectedStage === "kam" ? "Revisión KAM" : "Revisión Content"}
          </h3>
          <p>
            <strong>
              {selected.clientName} · {typeLabel(selected)}
            </strong>
          </p>
          <p className="mini">
            <strong>Tarea:</strong> {taskTitle(selected)}
          </p>
          <p className="mini">
            <strong>Responsable:</strong>{" "}
            {selected.assignedTo || "Sin responsable"} ·{" "}
            <strong>Publica:</strong> {selected.publishDate || "Sin fecha"}
          </p>
          {selected.finalPostLink ? (
            <a
              className="link-card"
              href={normalizeExternalUrl(selected.finalPostLink)}
              target="_blank"
            >
              <span>{selected.finalPostLink}</span>
              <small>Abrir →</small>
            </a>
          ) : (
            <p className="mini">Sin link final.</p>
          )}

          <InitialRequestPanel
            item={selected}
            normalizeExternalUrl={normalizeExternalUrl}
          />

          <div className="field">
            <label>Motivo de devolución</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} disabled={!canApproveAction}>
              {reasons.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explica qué debe corregirse si se devuelve."
              disabled={!canApproveAction}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {canApproveAction && selectedStage === "content" && isContentPending(selected) && (
              <button
                className="btn blue"
                onClick={() => approveContent(selected)}
              >
                Aprobar para KAM
              </button>
            )}
            {canApproveAction && selectedStage === "kam" && isKamPending(selected) && (
              <button className="btn blue" onClick={() => approveKam(selected)}>
                Aprobar para Contenidos
              </button>
            )}
            {canApproveAction && (isContentPending(selected) || isKamPending(selected)) && (
              <button className="btn red" onClick={() => reject(selected)}>
                Devolver
              </button>
            )}
            <button className="btn" onClick={() => setSelected(null)}>
              Cerrar
            </button>
          </div>

          <div className="detail-section">
            <h4>Log de movimientos</h4>
            {(selected.comments || [])
              .slice()
              .reverse()
              .map((c) => (
                <div className="comment-box" key={c.id}>
                  <strong>
                    {c.author} → {c.target}
                  </strong>
                  <span className="mini">
                    {new Date(c.createdAt).toLocaleString("es-MX")}
                  </span>
                  <p>{c.body}</p>
                </div>
              ))}
            {!(selected.comments || []).length && (
              <p className="mini">Sin movimientos todavía.</p>
            )}
          </div>
        </section>
      )}
    </AppShell>
  );
}

function InitialRequestPanel({
  item,
  normalizeExternalUrl,
}: {
  item: ContentRequest;
  normalizeExternalUrl: (value?: string) => string;
}) {
  const referenceLinks = splitLinks(item.referenceLinks || "");
  const materialLinks = splitLinks(item.materialLinks || "");
  return (
    <div className="detail-section approval-initial-request">
      <h4>Solicitud inicial del post</h4>
      <div className="detail-copy">
        <strong>Cliente:</strong> {item.clientName || "Sin cliente"}
        {"\n"}
        <strong>Lote:</strong> {item.batchName || "Sin lote"}
        {"\n"}
        <strong>Tipo / objetivo:</strong>{" "}
        {[item.contentType, item.objective].filter(Boolean).join(" · ") ||
          "Sin tipo"}
        {"\n"}
        <strong>Fecha de publicación:</strong>{" "}
        {item.publishDate || item.clientDueDate || "Sin fecha"}
        {"\n"}
        <strong>Idea creativa:</strong> {item.creativeIdea || "Sin idea"}
        {"\n"}
        <strong>Copy In:</strong> {item.copyIn || "Sin Copy In"}
        {"\n"}
        <strong>Mensaje clave:</strong> {item.keyMessage || "Sin mensaje"}
        {"\n"}
        <strong>CTA:</strong> {item.cta || "Sin CTA"}
        {"\n"}
        <strong>Notas producción:</strong> {item.productionNotes || "Sin notas"}
      </div>
      {!!referenceLinks.length && (
        <div className="link-list" style={{ marginTop: 10 }}>
          {referenceLinks.map((link, index) => (
            <a
              className="link-card"
              key={`ref-${index}`}
              href={normalizeExternalUrl(link)}
              target="_blank"
            >
              <span>{link}</span>
              <small>Referencia →</small>
            </a>
          ))}
        </div>
      )}
      {!!materialLinks.length && (
        <div className="link-list" style={{ marginTop: 10 }}>
          {materialLinks.map((link, index) => (
            <a
              className="link-card"
              key={`mat-${index}`}
              href={normalizeExternalUrl(link)}
              target="_blank"
            >
              <span>{link}</span>
              <small>Material →</small>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
