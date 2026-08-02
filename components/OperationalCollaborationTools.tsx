"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  ContentRequest,
  PlatformUser,
  canUser,
  listRequests,
  updateRequest,
} from "@/lib/data";

type ProductionPreparation = {
  productionDishes?: string[];
  productionSpecialRequirements?: string;
  productionTechnicalNotes?: string;
};

type EditablePreparation = {
  request: ContentRequest;
  dishes: string;
  specialRequirements: string;
  technicalNotes: string;
};

const ACTIVE_TASK_STATUSES = new Set([
  "asignada",
  "en_revision",
  "rebotada",
  "pendiente_aprobacion",
  "pendiente_aprobacion_kam",
  "aprobada_pendiente_copyout",
]);

function normalizeIdentity(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, " ")
    .trim();
}

function visualNumber(item: ContentRequest, fallback = 999999) {
  const raw = item.lotSequenceNumber ?? item.number;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function visualLabel(item: ContentRequest) {
  const number = visualNumber(item, 0);
  return number > 0 ? `Visual ${number}` : "Visual sin número";
}

function requestTopic(item: ContentRequest) {
  return item.topic?.trim() || item.creativeIdea?.trim() || item.contentType || "Sin tema";
}

function splitDishes(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[,\n;]/g);
  return Array.from(
    new Map(
      values
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .map((entry) => [normalizeIdentity(entry), entry]),
    ).values(),
  );
}

function preparationOf(item: ContentRequest): ProductionPreparation {
  return item as ContentRequest & ProductionPreparation;
}

function compareRequests(a: ContentRequest, b: ContentRequest) {
  const client = (a.clientName || "").localeCompare(b.clientName || "", "es", {
    numeric: true,
  });
  if (client) return client;
  const batch = (a.batchName || "").localeCompare(b.batchName || "", "es", {
    numeric: true,
  });
  if (batch) return batch;
  const number = visualNumber(a) - visualNumber(b);
  if (number) return number;
  return requestTopic(a).localeCompare(requestTopic(b), "es", { numeric: true });
}

function assignedToCurrentUser(item: ContentRequest, activeUser: PlatformUser | null) {
  if (!activeUser) return false;
  const row = item as ContentRequest & {
    assignedToId?: string;
    assignedUserId?: string;
    assigneeId?: string;
    assignedToEmail?: string;
  };
  const ids = new Set(
    [
      activeUser.id,
      activeUser.authUid,
      auth.currentUser?.uid,
      activeUser.email,
      auth.currentUser?.email,
    ]
      .map(normalizeIdentity)
      .filter(Boolean),
  );
  const directIds = [
    row.assignedToId,
    row.assignedUserId,
    row.assigneeId,
    row.assignedToEmail,
  ]
    .map(normalizeIdentity)
    .filter(Boolean);
  if (directIds.some((value) => ids.has(value))) return true;

  const names = [activeUser.name, activeUser.email, auth.currentUser?.displayName, auth.currentUser?.email]
    .map(normalizeIdentity)
    .filter(Boolean);
  const assigned = normalizeIdentity(item.assignedTo);
  return Boolean(assigned && names.some((name) => assigned === name || assigned.includes(name) || name.includes(assigned)));
}

export default function OperationalCollaborationTools({
  activeUser,
}: {
  activeUser: PlatformUser | null;
}) {
  const pathname = usePathname();
  const showProductionBoard = Boolean(pathname?.startsWith("/dashboard/producciones"));
  const showTaskBoard = Boolean(pathname?.startsWith("/dashboard/tareas"));
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!showProductionBoard && !showTaskBoard) return;
    setLoading(true);
    setError("");
    try {
      const rows = await listRequests();
      setRequests(rows.filter((item) => item.status !== "eliminada"));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la información operativa.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [showProductionBoard, showTaskBoard]);

  if (!showProductionBoard && !showTaskBoard) return null;

  if (showTaskBoard) {
    return (
      <AssignedTasksPanel
        activeUser={activeUser}
        requests={requests}
        loading={loading}
        error={error}
        onRefresh={load}
      />
    );
  }

  return (
    <ProductionPreparationBoard
      activeUser={activeUser}
      requests={requests}
      loading={loading}
      error={error}
      onRefresh={load}
    />
  );
}

function AssignedTasksPanel({
  activeUser,
  requests,
  loading,
  error,
  onRefresh,
}: {
  activeUser: PlatformUser | null;
  requests: ContentRequest[];
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
}) {
  const assigned = useMemo(
    () =>
      requests
        .filter((item) => ACTIVE_TASK_STATUSES.has(item.status || ""))
        .filter((item) => assignedToCurrentUser(item, activeUser))
        .sort(compareRequests),
    [requests, activeUser],
  );

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; client: string; items: ContentRequest[] }>();
    assigned.forEach((item) => {
      const key = item.batchId || `${item.clientId || "cliente"}-sin-lote`;
      if (!map.has(key)) {
        map.set(key, {
          name: item.batchName || "Sin lote",
          client: item.clientName || "Sin cliente",
          items: [],
        });
      }
      map.get(key)!.items.push(item);
    });
    return Array.from(map.entries()).sort(([, a], [, b]) =>
      `${a.client} ${a.name}`.localeCompare(`${b.client} ${b.name}`, "es", {
        numeric: true,
      }),
    );
  }, [assigned]);

  function openTask(item: ContentRequest) {
    if (!item.id) return;
    window.dispatchEvent(new CustomEvent("bust-open-task", { detail: item.id }));
    window.setTimeout(() => {
      document.querySelector(".modal-backdrop")?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    }, 60);
  }

  return (
    <section className="card" style={{ marginBottom: 22 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p className="eyebrow">Acceso directo personal</p>
          <h2 style={{ margin: "0 0 6px" }}>Mis tareas asignadas por número de visual</h2>
          <p className="mini" style={{ margin: 0 }}>
            Muestra cualquier tarea asignada directamente a {activeUser?.name || "tu usuario"}, aunque el área sea Mixto, Diseño, Fotografía o Audiovisual.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="pill blue">{assigned.length} activas</span>
          <button className="btn" type="button" onClick={onRefresh} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {error && <div className="inline-feedback info" style={{ marginTop: 14 }}>{error}</div>}

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {groups.map(([key, group]) => (
          <details key={key} open className="draft-item" style={{ padding: 14 }}>
            <summary style={{ cursor: "pointer", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <strong>{group.client} · {group.name}</strong>
              <span className="pill">{group.items.length} visuales</span>
            </summary>
            <div style={{ display: "grid", gap: 9, marginTop: 12 }}>
              {group.items
                .slice()
                .sort((a, b) => visualNumber(a) - visualNumber(b))
                .map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(90px,auto) minmax(0,1fr) auto",
                      gap: 12,
                      alignItems: "center",
                      padding: 12,
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                    }}
                  >
                    <div>
                      <strong>{visualLabel(item)}</strong>
                      <div className="mini">#{visualNumber(item, 0) || "--"}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <strong>{requestTopic(item)}</strong>
                      <div className="mini">
                        {item.assignedArea || item.suggestedArea || "Sin área"} · {item.status || "Sin estado"}
                      </div>
                    </div>
                    <button className="btn blue" type="button" onClick={() => openTask(item)}>
                      Abrir tarea
                    </button>
                  </div>
                ))}
            </div>
          </details>
        ))}
        {!loading && !groups.length && (
          <p className="mini">No hay tareas activas asignadas directamente a este perfil.</p>
        )}
      </div>
    </section>
  );
}

function ProductionPreparationBoard({
  activeUser,
  requests,
  loading,
  error,
  onRefresh,
}: {
  activeUser: PlatformUser | null;
  requests: ContentRequest[];
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [selectedDish, setSelectedDish] = useState("Todos");
  const [editing, setEditing] = useState<EditablePreparation | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const canEdit = canUser(activeUser, "producciones", "edit") || canUser(activeUser, "producciones", "create");

  const productionRequests = useMemo(
    () =>
      requests
        .filter((item) => item.requiresProduction)
        .filter((item) => !["eliminada", "cancelada", "finalizada"].includes(item.status || ""))
        .sort(compareRequests),
    [requests],
  );

  const dishCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    productionRequests.forEach((item) => {
      const dishes = splitDishes(preparationOf(item).productionDishes);
      (dishes.length ? dishes : ["Sin platillo definido"]).forEach((dish) => {
        const key = normalizeIdentity(dish);
        const current = counts.get(key) || { label: dish, count: 0 };
        current.count += 1;
        counts.set(key, current);
      });
    });
    return Array.from(counts.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "es", { numeric: true }),
    );
  }, [productionRequests]);

  const visible = useMemo(() => {
    const needle = normalizeIdentity(search);
    return productionRequests.filter((item) => {
      const prep = preparationOf(item);
      const dishes = splitDishes(prep.productionDishes);
      const dishOk =
        selectedDish === "Todos" ||
        (selectedDish === "Sin platillo definido"
          ? !dishes.length
          : dishes.some((dish) => normalizeIdentity(dish) === normalizeIdentity(selectedDish)));
      const haystack = normalizeIdentity(
        `${item.clientName} ${item.batchName} ${item.topic} ${item.creativeIdea} ${item.productionNotes} ${prep.productionTechnicalNotes} ${prep.productionSpecialRequirements} ${dishes.join(" ")}`,
      );
      return dishOk && (!needle || haystack.includes(needle));
    });
  }, [productionRequests, selectedDish, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ContentRequest[]>();
    visible.forEach((item) => {
      const dishes = splitDishes(preparationOf(item).productionDishes);
      const labels = selectedDish === "Todos" ? (dishes.length ? dishes : ["Sin platillo definido"]) : [selectedDish];
      labels.forEach((label) => {
        if (!map.has(label)) map.set(label, []);
        map.get(label)!.push(item);
      });
    });
    return Array.from(map.entries())
      .map(([label, items]) => [label, items.sort(compareRequests)] as const)
      .sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }));
  }, [visible, selectedDish]);

  const alerts = useMemo(
    () =>
      productionRequests
        .filter((item) => Boolean(preparationOf(item).productionSpecialRequirements?.trim()))
        .sort(compareRequests),
    [productionRequests],
  );

  function openEditor(item: ContentRequest) {
    const prep = preparationOf(item);
    setEditing({
      request: item,
      dishes: splitDishes(prep.productionDishes).join(", "),
      specialRequirements: prep.productionSpecialRequirements || "",
      technicalNotes: prep.productionTechnicalNotes || "",
    });
    setMessage("");
  }

  async function saveEditor() {
    if (!editing?.request.id || !canEdit) return;
    setSaving(true);
    setMessage("");
    try {
      await updateRequest(
        editing.request.id,
        {
          productionDishes: splitDishes(editing.dishes),
          productionSpecialRequirements: editing.specialRequirements.trim(),
          productionTechnicalNotes: editing.technicalNotes.trim(),
        } as any,
      );
      setMessage("Preparación del visual guardada.");
      await onRefresh();
      setEditing(null);
    } catch (saveError) {
      setMessage(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la preparación del visual.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" style={{ marginBottom: 22 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p className="eyebrow">Preparación previa</p>
          <h2 style={{ margin: "0 0 6px" }}>Platillos, props y notas técnicas por visual</h2>
          <p className="mini" style={{ margin: 0 }}>
            Agrupa visuales que comparten platillos y concentra lo que debe conseguirse antes de la producción.
          </p>
        </div>
        <button className="btn" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar tablero"}
        </button>
      </div>

      {error && <div className="inline-feedback info" style={{ marginTop: 14 }}>{error}</div>}
      {message && <div className="inline-feedback info" style={{ marginTop: 14 }}>{message}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        <button
          type="button"
          className={selectedDish === "Todos" ? "chip-btn selected" : "chip-btn"}
          onClick={() => setSelectedDish("Todos")}
        >
          Todos · {productionRequests.length}
        </button>
        {dishCounts.map((dish) => (
          <button
            type="button"
            className={selectedDish === dish.label ? "chip-btn selected" : "chip-btn"}
            key={dish.label}
            onClick={() => setSelectedDish(dish.label)}
          >
            {dish.label} · {dish.count}
          </button>
        ))}
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label>Buscar visual, lote, platillo, prop o nota</label>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ej. hamburguesa, lentes, cartulina, Visual 4..."
        />
      </div>

      <details open style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer" }}>
          <strong>Alertas y cosas especiales por conseguir</strong>{" "}
          <span className="pill orange">{alerts.length}</span>
        </summary>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {alerts.map((item) => (
            <div className="inline-feedback info" key={item.id} style={{ alignItems: "flex-start" }}>
              <strong>{visualLabel(item)} · {item.clientName}</strong>
              <span>
                {item.batchName || "Sin lote"} · {requestTopic(item)}<br />
                <b>Necesario:</b> {preparationOf(item).productionSpecialRequirements}
              </span>
              <button className="btn" type="button" onClick={() => openEditor(item)} disabled={!canEdit}>
                Editar
              </button>
            </div>
          ))}
          {!alerts.length && <p className="mini">Todavía no hay props o necesidades especiales registradas.</p>}
        </div>
      </details>

      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        {grouped.map(([dish, items]) => (
          <details open className="draft-item" style={{ padding: 14 }} key={dish}>
            <summary style={{ cursor: "pointer", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <strong>{dish}</strong>
              <span className="pill blue">{items.length} visuales</span>
            </summary>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {items.map((item) => {
                const prep = preparationOf(item);
                const dishes = splitDishes(prep.productionDishes);
                return (
                  <article
                    key={`${dish}-${item.id}`}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                      padding: 13,
                      display: "grid",
                      gap: 9,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <strong>{visualLabel(item)} · {requestTopic(item)}</strong>
                        <div className="mini">{item.clientName} · {item.batchName || "Sin lote"}</div>
                      </div>
                      <button className="btn blue" type="button" onClick={() => openEditor(item)} disabled={!canEdit}>
                        Editar preparación
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(dishes.length ? dishes : ["Sin platillo definido"]).map((entry) => (
                        <span className="pill" key={entry}>{entry}</span>
                      ))}
                    </div>
                    {prep.productionSpecialRequirements && (
                      <div className="inline-feedback info" style={{ alignItems: "flex-start" }}>
                        <strong>Alerta / prop</strong>
                        <span>{prep.productionSpecialRequirements}</span>
                      </div>
                    )}
                    <div className="detail-copy">
                      <strong>Notas técnicas:</strong>{" "}
                      {prep.productionTechnicalNotes || "Sin descripción técnica adicional."}
                      {item.productionNotes ? `\nNotas generales: ${item.productionNotes}` : ""}
                    </div>
                  </article>
                );
              })}
            </div>
          </details>
        ))}
        {!loading && !grouped.length && <p className="mini">No hay visuales que coincidan con los filtros.</p>}
      </div>

      {editing && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ width: "min(760px,94vw)" }}>
            <p className="eyebrow">Preparación por visual</p>
            <h2 style={{ marginTop: 0 }}>{visualLabel(editing.request)} · {requestTopic(editing.request)}</h2>
            <p className="mini">{editing.request.clientName} · {editing.request.batchName || "Sin lote"}</p>

            <div className="field">
              <label>Platillos necesarios</label>
              <input
                value={editing.dishes}
                onChange={(event) => setEditing({ ...editing, dishes: event.target.value })}
                placeholder="Ej. Hamburguesa clásica, papas trufadas, limonada"
              />
              <p className="mini">Sepáralos por coma. Se convertirán en burbujas para agrupar visuales.</p>
            </div>
            <div className="field">
              <label>Cosas especiales, props o alertas</label>
              <textarea
                value={editing.specialRequirements}
                onChange={(event) => setEditing({ ...editing, specialRequirements: event.target.value })}
                placeholder="Ej. Cartulina negra, lentes, hielo seco, mantel, florero, modelo, permiso especial..."
              />
            </div>
            <div className="field">
              <label>Notas técnicas de producción por visual</label>
              <textarea
                value={editing.technicalNotes}
                onChange={(event) => setEditing({ ...editing, technicalNotes: event.target.value })}
                placeholder="Describe encuadre, iluminación, movimiento, orden de tomas, referencia y forma de ejecución."
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className="btn" type="button" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn blue" type="button" onClick={saveEditor} disabled={saving || !canEdit}>
                {saving ? "Guardando..." : "Guardar preparación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
