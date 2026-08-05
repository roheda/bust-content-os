"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useModulePermissions, permissionAlert } from "@/components/useModulePermissions";
import { auth } from "@/lib/firebase";
import {
  ContentRequest,
  TaskComment,
  buildRevisionUpdate,
  listRequests,
  subscribeRequests,
  updateRequest,
} from "@/lib/data";
import styles from "./approvals.module.css";

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
type StageFilter = "content" | "kam" | "devueltas" | "historial" | "all";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<ReviewStage>("content");
  const [reason, setReason] = useState(reasons[0]);
  const [notes, setNotes] = useState("");

  const [clientFilter, setClientFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState<StageFilter>("content");
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

  useEffect(() => {
    if (!selectedId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeReview();
      if (event.key === "ArrowLeft") navigateReview(-1);
      if (event.key === "ArrowRight") navigateReview(1);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedId]);

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

  function reviewStageFor(item: ContentRequest): ReviewStage {
    return isKamPending(item) ? "kam" : "content";
  }

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach((x) =>
      map.set(x.clientId || "sin-cliente", x.clientName || "Sin cliente"),
    );
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [requests]);

  const batches = useMemo(() => {
    const map = new Map<string, string>();
    requests
      .filter((x) => clientFilter === "all" || x.clientId === clientFilter)
      .forEach((x) =>
        map.set(x.batchId || "sin-lote", x.batchName || "Sin lote"),
      );
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
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

  const selected = useMemo(
    () => requests.find((item) => item.id === selectedId) || null,
    [requests, selectedId],
  );

  const selectedIndex = useMemo(
    () => filtered.findIndex((item) => item.id === selectedId),
    [filtered, selectedId],
  );

  const pendingContent = requests.filter(isContentPending).length;
  const pendingKam = requests.filter(isKamPending).length;
  const approvedContents = requests.filter(isApprovedForContents).length;
  const rejected = requests.filter(
    (x) => x.status === "rebotada" || x.approvalStatus === "rechazada",
  ).length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function sortLabel(key: SortKey) {
    return sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : "";
  }

  function startReview(item: ContentRequest, stage = reviewStageFor(item)) {
    if (!item.id) return;
    setSelectedId(item.id);
    setSelectedStage(stage);
    setReason(reasons[0]);
    setNotes("");
  }

  function closeReview() {
    setSelectedId(null);
    setNotes("");
  }

  function navigateReview(direction: -1 | 1) {
    if (!filtered.length) return;
    const current = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = Math.min(
      filtered.length - 1,
      Math.max(0, current + direction),
    );
    const nextItem = filtered[nextIndex];
    if (nextItem && nextItem.id !== selectedId) startReview(nextItem);
  }

  function nextSelectionId(currentId?: string) {
    if (!currentId) return null;
    const currentIndex = filtered.findIndex((item) => item.id === currentId);
    if (currentIndex < 0) return null;
    return filtered[currentIndex + 1]?.id || filtered[currentIndex - 1]?.id || null;
  }

  function selectAfterAction(nextId: string | null) {
    if (!nextId) {
      closeReview();
      return;
    }
    const next = requests.find((item) => item.id === nextId);
    setSelectedId(nextId);
    if (next) setSelectedStage(reviewStageFor(next));
    setReason(reasons[0]);
    setNotes("");
  }

  async function approveContent(item: ContentRequest) {
    if (!canApproveAction) return permissionAlert("aprobar piezas");
    if (!item.id) return;
    const nextId = nextSelectionId(item.id);
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
    await load();
    selectAfterAction(nextId);
    alert("Aprobada por Content. Ahora pasa a KAM.");
  }

  async function approveKam(item: ContentRequest) {
    if (!canApproveAction) return permissionAlert("aprobar piezas como KAM");
    if (!item.id) return;
    const nextId = nextSelectionId(item.id);
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
    await load();
    selectAfterAction(nextId);
    alert("Aprobada por KAM. Ya está en Contenidos.");
  }

  async function reject(item: ContentRequest) {
    if (!canApproveAction)
      return permissionAlert("devolver piezas desde Aprobaciones");
    if (!item.id) return;
    if (!reason) return alert("Selecciona motivo.");
    const nextId = nextSelectionId(item.id);
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
    const revisionUpdate = buildRevisionUpdate(item, {
      actor: currentActorName(),
      reason,
      stage: selectedStage === "kam" ? "Aprobación KAM" : "Aprobación Content",
      note: notes,
    });
    await updateRequest(item.id, {
      ...revisionUpdate,
      status: "rebotada",
      approvalStatus: "rechazada",
      approvalRejectionReason: reason,
      approvalNotes: notes,
      comments: [...(item.comments || []), log],
    });
    await load();
    selectAfterAction(nextId);
    alert("Pieza devuelta con motivo.");
  }

  const selectedIsPending = Boolean(
    selected && (isContentPending(selected) || isKamPending(selected)),
  );

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
          Modo solo lectura: puedes revisar aprobaciones, pero tu rol no puede
          aprobar ni devolver piezas.
        </section>
      )}

      <section className="grid kpis">
        {[
          ["Pendientes Content", String(pendingContent)],
          ["Pendientes KAM", String(pendingKam)],
          ["Aprobadas para Contenidos", String(approvedContents)],
          ["Devueltas", String(rejected)],
        ].map(([label, value]) => (
          <div className="kpi" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="finalized-group-title">
          <div>
            <h3>Bandeja de aprobaciones</h3>
            <p className="mini">
              La lista permanece compacta. Al revisar, la publicación se abre
              en una ventana con navegación anterior y siguiente.
            </p>
          </div>
          <span className="pill">{filtered.length} visibles</span>
        </div>

        <div className="finalized-toolbar">
          <select
            value={stageFilter}
            onChange={(event) =>
              setStageFilter(event.target.value as StageFilter)
            }
          >
            <option value="content">Pendientes Content</option>
            <option value="kam">Pendientes KAM</option>
            <option value="devueltas">Devueltas</option>
            <option value="historial">Aprobadas / historial</option>
            <option value="all">Todas</option>
          </select>
          <select
            value={clientFilter}
            onChange={(event) => {
              setClientFilter(event.target.value);
              setBatchFilter("all");
            }}
          >
            <option value="all">Todos los clientes</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <select
            value={batchFilter}
            onChange={(event) => setBatchFilter(event.target.value)}
          >
            <option value="all">Todos los lotes</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar tarea, responsable, link..."
          />
          <button
            className="btn"
            onClick={() => {
              setStageFilter("content");
              setClientFilter("all");
              setBatchFilter("all");
              setSearch("");
              setSortKey("publishDate");
              setSortDirection("asc");
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
          const stage = reviewStageFor(item);
          return (
            <div
              className={`approvals-row ${
                selectedId === item.id ? styles.selectedRow : ""
              }`}
              key={item.id}
            >
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
                    rel="noreferrer"
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
                <button
                  className={
                    isContentPending(item) || isKamPending(item)
                      ? "btn blue"
                      : "btn"
                  }
                  onClick={() => startReview(item, stage)}
                >
                  {isContentPending(item) || isKamPending(item)
                    ? "Revisar"
                    : "Ver"}
                </button>
              </span>
            </div>
          );
        })}

        {!filtered.length && (
          <p className="mini">No hay piezas con esos filtros.</p>
        )}
      </section>

      {selected && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeReview();
          }}
        >
          <section
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-review-title"
          >
            <header className={styles.modalHeader}>
              <div className={styles.modalHeading}>
                <div>
                  <p className="eyebrow">
                    {selectedStage === "kam"
                      ? "Revisión KAM"
                      : "Revisión Content"}
                  </p>
                  <h2 id="approval-review-title">{taskTitle(selected)}</h2>
                  <p className="mini">
                    {selected.clientName || "Sin cliente"} ·{" "}
                    {selected.batchName || "Sin lote"}
                  </p>
                </div>
                <button type="button" className="btn" onClick={closeReview}>
                  Cerrar
                </button>
              </div>

              <div className={styles.modalNavigation}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigateReview(-1)}
                  disabled={selectedIndex <= 0}
                >
                  ← Anterior
                </button>
                <strong>
                  {selectedIndex >= 0 ? selectedIndex + 1 : "–"} de{" "}
                  {filtered.length}
                </strong>
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigateReview(1)}
                  disabled={
                    selectedIndex < 0 || selectedIndex >= filtered.length - 1
                  }
                >
                  Siguiente →
                </button>
              </div>
            </header>

            <div className={styles.modalBody}>
              <section className={styles.summaryGrid}>
                <div>
                  <span className="mini">Estado</span>
                  <strong>{statusLabel(selected)}</strong>
                </div>
                <div>
                  <span className="mini">Responsable</span>
                  <strong>{selected.assignedTo || "Sin responsable"}</strong>
                </div>
                <div>
                  <span className="mini">Publicación</span>
                  <strong>{selected.publishDate || "Sin fecha"}</strong>
                </div>
                <div>
                  <span className="mini">Plataformas</span>
                  <strong>{platformsLabel(selected)}</strong>
                </div>
              </section>

              <section className={styles.reviewSection}>
                <h4>Pieza final</h4>
                {selected.finalPostLink ? (
                  <a
                    className="link-card"
                    href={normalizeExternalUrl(selected.finalPostLink)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>{selected.finalPostLink}</span>
                    <small>Abrir pieza →</small>
                  </a>
                ) : (
                  <p className="mini">Sin link final.</p>
                )}
              </section>

              <InitialRequestPanel
                item={selected}
                normalizeExternalUrl={normalizeExternalUrl}
              />

              {selectedIsPending ? (
                <section className={styles.reviewSection}>
                  <div>
                    <h4>Devolución y comentarios</h4>
                    <p className="mini">
                      Llena estos campos únicamente cuando la pieza requiera
                      correcciones.
                    </p>
                  </div>
                  <div className={styles.decisionGrid}>
                    <div className="field">
                      <label>Motivo de devolución</label>
                      <select
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        disabled={!canApproveAction}
                      >
                        {reasons.map((itemReason) => (
                          <option key={itemReason}>{itemReason}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Notas</label>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Explica exactamente qué debe corregirse."
                        disabled={!canApproveAction}
                      />
                    </div>
                  </div>
                </section>
              ) : (
                <section className={styles.reviewSection}>
                  <h4>Resultado de revisión</h4>
                  <p className="mini">
                    <strong>Motivo registrado:</strong>{" "}
                    {selected.approvalRejectionReason || "Sin devolución"}
                  </p>
                  {selected.approvalNotes && <p>{selected.approvalNotes}</p>}
                </section>
              )}

              <section className={styles.reviewSection}>
                <h4>Log de movimientos</h4>
                <div className={styles.logList}>
                  {(selected.comments || [])
                    .slice()
                    .reverse()
                    .map((comment) => (
                      <div className="comment-box" key={comment.id}>
                        <strong>
                          {comment.author} → {comment.target}
                        </strong>
                        <span className="mini">
                          {new Date(comment.createdAt).toLocaleString("es-MX")}
                        </span>
                        <p>{comment.body}</p>
                      </div>
                    ))}
                  {!(selected.comments || []).length && (
                    <p className="mini">Sin movimientos todavía.</p>
                  )}
                </div>
              </section>
            </div>

            <footer className={styles.modalActions}>
              {canApproveAction &&
                selectedStage === "content" &&
                isContentPending(selected) && (
                  <button
                    className="btn blue"
                    onClick={() => approveContent(selected)}
                  >
                    Aprobar para KAM
                  </button>
                )}
              {canApproveAction &&
                selectedStage === "kam" &&
                isKamPending(selected) && (
                  <button
                    className="btn blue"
                    onClick={() => approveKam(selected)}
                  >
                    Aprobar para Contenidos
                  </button>
                )}
              {canApproveAction && selectedIsPending && (
                <button className="btn red" onClick={() => reject(selected)}>
                  Devolver con comentarios
                </button>
              )}
              <button className="btn" onClick={closeReview}>
                Cerrar revisión
              </button>
            </footer>
          </section>
        </div>
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
    <section className={styles.reviewSection}>
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
        <div className={styles.linkList}>
          {referenceLinks.map((link, index) => (
            <a
              className="link-card"
              key={`ref-${index}`}
              href={normalizeExternalUrl(link)}
              target="_blank"
              rel="noreferrer"
            >
              <span>{link}</span>
              <small>Referencia →</small>
            </a>
          ))}
        </div>
      )}

      {!!materialLinks.length && (
        <div className={styles.linkList}>
          {materialLinks.map((link, index) => (
            <a
              className="link-card"
              key={`mat-${index}`}
              href={normalizeExternalUrl(link)}
              target="_blank"
              rel="noreferrer"
            >
              <span>{link}</span>
              <small>Material →</small>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
