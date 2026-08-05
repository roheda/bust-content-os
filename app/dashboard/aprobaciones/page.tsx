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

type ApprovalGroup = {
  id: string;
  clientName: string;
  batchName: string;
  items: ContentRequest[];
  approved: number;
  total: number;
};

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<ReviewStage>("content");
  const [reason, setReason] = useState(reasons[0]);
  const [notes, setNotes] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

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

  function statusTone(item: ContentRequest) {
    if (isApprovedForContents(item) || item.status === "finalizada") return "green";
    if (item.status === "rebotada" || item.approvalStatus === "rechazada")
      return "red";
    if (isKamPending(item)) return "purple";
    return "amber";
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

  const groups = useMemo<ApprovalGroup[]>(() => {
    const map = new Map<string, ApprovalGroup>();
    filtered.forEach((item) => {
      const clientId = item.clientId || "sin-cliente";
      const batchId = item.batchId || "sin-lote";
      const id = `${clientId}::${batchId}`;
      if (!map.has(id)) {
        const allGroupItems = requests.filter(
          (row) =>
            (row.clientId || "sin-cliente") === clientId &&
            (row.batchId || "sin-lote") === batchId,
        );
        map.set(id, {
          id,
          clientName: item.clientName || "Sin cliente",
          batchName: item.batchName || "Sin lote",
          items: [],
          approved: allGroupItems.filter(
            (row) => isApprovedForContents(row) || row.status === "finalizada",
          ).length,
          total: allGroupItems.length,
        });
      }
      map.get(id)!.items.push(item);
    });
    return Array.from(map.values()).sort((a, b) => {
      const clientCompare = a.clientName.localeCompare(b.clientName, "es");
      if (clientCompare) return clientCompare;
      return a.batchName.localeCompare(b.batchName, "es", { numeric: true });
    });
  }, [filtered, requests]);

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
    if (nextItem) startReview(nextItem);
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

  function toggleGroup(groupId: string) {
    setCollapsedGroups((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
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

      <section className={styles.workspace}>
        <div className={`card ${styles.queueCard}`}>
          <div className={styles.queueHeading}>
            <div>
              <p className="eyebrow">Bandeja</p>
              <h3>Contenidos por revisar</h3>
              <p className="mini">
                Elige una pieza y revísala sin perder de vista el listado.
              </p>
            </div>
            <span className="pill">{filtered.length} visibles</span>
          </div>

          <div className={styles.filters}>
            <label className={styles.filterField}>
              <span>Etapa</span>
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
            </label>
            <label className={styles.filterField}>
              <span>Cliente</span>
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
            </label>
            <label className={styles.filterField}>
              <span>Lote</span>
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
            </label>
            <label className={styles.filterField}>
              <span>Orden</span>
              <div className={styles.sortControl}>
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                >
                  <option value="publishDate">Fecha de publicación</option>
                  <option value="client">Cliente</option>
                  <option value="task">Tarea</option>
                  <option value="type">Tipo</option>
                  <option value="platforms">Plataformas</option>
                  <option value="responsible">Responsable</option>
                  <option value="status">Estado</option>
                </select>
                <button
                  type="button"
                  className="btn"
                  title="Cambiar dirección del orden"
                  onClick={() =>
                    setSortDirection((current) =>
                      current === "asc" ? "desc" : "asc",
                    )
                  }
                >
                  {sortDirection === "asc" ? "Ascendente" : "Descendente"}
                </button>
              </div>
            </label>
            <label className={`${styles.filterField} ${styles.searchField}`}>
              <span>Buscar</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tarea, responsable, link, idea..."
              />
            </label>
            <button
              type="button"
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
              Limpiar filtros
            </button>
          </div>

          <div className={styles.groupList}>
            {groups.map((group) => {
              const collapsed = collapsedGroups.includes(group.id);
              const progress = group.total
                ? Math.round((group.approved / group.total) * 100)
                : 0;
              return (
                <section className={styles.groupBlock} key={group.id}>
                  <button
                    type="button"
                    className={styles.groupHeader}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <span className={styles.groupChevron}>
                      {collapsed ? "▸" : "▾"}
                    </span>
                    <span className={styles.groupIdentity}>
                      <strong>{group.batchName}</strong>
                      <small>{group.clientName}</small>
                    </span>
                    <span className={styles.groupProgress}>
                      <span>
                        {group.approved} de {group.total} aprobadas
                      </span>
                      <span className={styles.progressTrack}>
                        <span
                          className={styles.progressBar}
                          style={{ width: `${progress}%` }}
                        />
                      </span>
                    </span>
                    <span className="pill">{group.items.length} visibles</span>
                  </button>

                  {!collapsed && (
                    <div className={styles.groupItems}>
                      {group.items.map((item) => {
                        const isSelected = selectedId === item.id;
                        const stage = reviewStageFor(item);
                        return (
                          <article
                            className={`${styles.queueItem} ${
                              isSelected ? styles.queueItemSelected : ""
                            }`}
                            key={item.id}
                          >
                            <button
                              type="button"
                              className={styles.queueItemMain}
                              onClick={() => startReview(item, stage)}
                            >
                              <span className={styles.queueTopline}>
                                <span className={`pill ${statusTone(item)}`}>
                                  {statusLabel(item)}
                                </span>
                                <span className="mini">
                                  {item.publishDate || "Sin fecha"}
                                </span>
                              </span>
                              <strong className={styles.queueTitle}>
                                {taskTitle(item)}
                              </strong>
                              <span className={styles.queueMeta}>
                                {typeLabel(item)}
                              </span>
                              <span className={styles.queueMeta}>
                                {platformsLabel(item)} ·{" "}
                                {item.assignedTo || "Sin responsable"}
                              </span>
                            </button>
                            <div className={styles.queueActions}>
                              {item.finalPostLink ? (
                                <a
                                  className="btn"
                                  href={normalizeExternalUrl(item.finalPostLink)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Abrir pieza
                                </a>
                              ) : (
                                <span className="pill amber">Sin link</span>
                              )}
                              <button
                                type="button"
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
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
            {!groups.length && (
              <div className={styles.emptyState}>
                No hay piezas con esos filtros.
              </div>
            )}
          </div>
        </div>

        {selected && (
          <button
            type="button"
            className={styles.mobileBackdrop}
            onClick={closeReview}
            aria-label="Cerrar revisión"
          />
        )}

        <aside
          className={`card ${styles.reviewCard} ${
            selected ? styles.reviewCardActive : ""
          }`}
        >
          {!selected ? (
            <div className={styles.reviewPlaceholder}>
              <span className={styles.placeholderIcon}>✓</span>
              <h3>Selecciona un contenido</h3>
              <p>
                La revisión aparecerá aquí. El listado permanecerá visible para
                avanzar entre piezas sin bajar al final de la página.
              </p>
            </div>
          ) : (
            <>
              <header className={styles.reviewHeader}>
                <div className={styles.reviewHeaderTop}>
                  <div>
                    <p className="eyebrow">
                      {selectedStage === "kam"
                        ? "Revisión KAM"
                        : "Revisión Content"}
                    </p>
                    <h2 className={styles.reviewTitle}>{taskTitle(selected)}</h2>
                    <p className="mini">
                      {selected.clientName || "Sin cliente"} ·{" "}
                      {selected.batchName || "Sin lote"}
                    </p>
                  </div>
                  <button type="button" className="btn" onClick={closeReview}>
                    Cerrar
                  </button>
                </div>

                <div className={styles.reviewNav}>
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

              <div className={styles.reviewBody}>
                <section className={styles.reviewSummary}>
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
                    <div className={styles.sectionHeading}>
                      <div>
                        <h4>Devolución y comentarios</h4>
                        <p className="mini">
                          Estos campos solo se usan cuando la pieza requiere
                          correcciones.
                        </p>
                      </div>
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

              <footer className={styles.reviewActions}>
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
            </>
          )}
        </aside>
      </section>
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
