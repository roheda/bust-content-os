"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentRequest, PlatformUser, TaskComment, listRequests, updateRequest } from "@/lib/data";

type PendingRow = {
  request: ContentRequest;
  comment: TaskComment;
  reason: string;
};

function normalize(value = "") {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9@._-]+/g, "");
}

function mentionTokens(user: PlatformUser | null | undefined) {
  if (!user) return [];
  const emailName = (user.email || "").split("@")[0];
  const firstName = (user.name || "").split(" ")[0];
  const tokens = [
    user.name,
    firstName,
    emailName,
    user.email,
    user.roleKey,
    user.roleLabel,
    user.department,
    user.jobTitle
  ]
    .filter(Boolean)
    .flatMap((x) => {
      const clean = normalize(String(x).replace(/^@/, ""));
      return clean ? [`@${clean}`, clean] : [];
    });
  return Array.from(new Set(tokens));
}

function targetTokens(user: PlatformUser | null | undefined) {
  if (!user) return [];
  const raw = [user.department, user.roleLabel, user.roleKey, user.jobTitle]
    .filter(Boolean)
    .map((x) => normalize(String(x)));
  const mapped: Record<string, string[]> = {
    kam: ["keyaccount", "cuenta", "content", "kam"],
    estrategia: ["estrategia", "content"],
    creativo: ["copy", "creativo", "content"],
    diseno: ["diseno", "diseño", "content"].map(normalize),
    audiovisual: ["audiovisual", "video", "produccion"],
    admin: ["content", "interno", "keyaccount", "diseno", "audiovisual"],
    master: ["content", "interno", "keyaccount", "diseno", "audiovisual", "cliente"]
  };
  return Array.from(new Set([...raw, ...(mapped[user.roleKey] || [])]));
}

function isResolved(comment: TaskComment) {
  return Boolean(comment.resolvedAt || comment.status === "resolved");
}

function matchesUser(row: { comment: TaskComment; request: ContentRequest }, user: PlatformUser | null) {
  if (!user) return { match: false, reason: "" };
  if (user.isMaster || user.roleKey === "master") {
    const hasWork = !isResolved(row.comment) && (row.comment.mentions?.length || row.comment.target !== "Interno");
    return { match: Boolean(hasWork), reason: "Vista Master" };
  }
  const userMentions = mentionTokens(user);
  const commentMentions = (row.comment.mentions || []).map(normalize);
  const body = normalize(row.comment.body || "");
  const mentionHit = userMentions.some((token) => commentMentions.includes(token) || body.includes(token));
  if (mentionHit) return { match: true, reason: "@mención directa" };

  const targets = targetTokens(user);
  const target = normalize(row.comment.target || "");
  const targetHit = Boolean(target && target !== "interno" && targets.some((token) => target.includes(token) || token.includes(target)));
  if (targetHit) return { match: true, reason: `Área: ${row.comment.target}` };
  return { match: false, reason: "" };
}

export default function PendingMentionsWidget({ activeUser }: { activeUser: PlatformUser | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");

  async function load() {
    setLoading(true);
    try {
      setRequests(await listRequests());
    } catch (error) {
      console.warn("No se pudieron cargar pendientes", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const rows = useMemo<PendingRow[]>(() => {
    return requests
      .flatMap((request) => (request.comments || []).map((comment) => ({ request, comment })))
      .map((row) => ({ ...row, result: matchesUser(row, activeUser) }))
      .filter((row) => row.result.match)
      .filter((row) => {
        if (filter === "open") return !isResolved(row.comment);
        if (filter === "resolved") return isResolved(row.comment);
        return true;
      })
      .sort((a, b) => (b.comment.createdAt || "").localeCompare(a.comment.createdAt || ""))
      .map((row) => ({ request: row.request, comment: row.comment, reason: row.result.reason }));
  }, [requests, activeUser, filter]);

  const openCount = useMemo(() => rows.filter((row) => !isResolved(row.comment)).length, [rows]);

  async function resolve(row: PendingRow) {
    if (!row.request.id) return;
    const comments = (row.request.comments || []).map((comment) => {
      if (comment.id !== row.comment.id) return comment;
      return {
        ...comment,
        status: "resolved" as const,
        resolvedAt: new Date().toISOString(),
        resolvedBy: activeUser?.name || activeUser?.email || "Usuario"
      };
    });
    await updateRequest(row.request.id, { comments });
    setRequests((prev) => prev.map((item) => item.id === row.request.id ? { ...item, comments } : item));
  }

  function goToTask(row: PendingRow) {
    const id = row.request.id ? `?task=${encodeURIComponent(row.request.id)}` : "";
    router.push(`/dashboard/tareas${id}`);
    setOpen(false);
  }

  return <>
    <button type="button" className={`pending-fab ${openCount ? "has-items" : ""}`} onClick={() => setOpen(!open)}>
      <span>Pendientes</span>
      <strong>{openCount}</strong>
    </button>
    {open && <aside className="pending-panel">
      <div className="pending-head">
        <div>
          <p className="eyebrow">@menciones</p>
          <h3>Pendientes flotantes</h3>
          <p className="mini">Dudas y comentarios donde te mencionan o van dirigidos a tu área.</p>
        </div>
        <button className="feedback-close" type="button" onClick={() => setOpen(false)}>✕</button>
      </div>

      <div className="pending-tabs">
        <button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>Abiertos</button>
        <button className={filter === "resolved" ? "active" : ""} onClick={() => setFilter("resolved")}>Resueltos</button>
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos</button>
        <button onClick={load}>{loading ? "Actualizando..." : "Actualizar"}</button>
      </div>

      <div className="pending-list">
        {!rows.length && <div className="pending-empty">No tienes pendientes en esta vista.</div>}
        {rows.slice(0, 50).map((row) => <article className={`pending-card ${isResolved(row.comment) ? "resolved" : ""}`} key={`${row.request.id}-${row.comment.id}`}>
          <div className="pending-card-top">
            <strong>{row.request.clientName || "Cliente"} · {row.request.contentType || "Contenido"}</strong>
            <span>{isResolved(row.comment) ? "Resuelto" : row.reason}</span>
          </div>
          <p>{row.comment.body}</p>
          <div className="pending-meta">
            <span>{row.comment.author || "Usuario"}</span>
            <span>{row.comment.target || "Sin área"}</span>
            <span>{row.comment.createdAt ? new Date(row.comment.createdAt).toLocaleString("es-MX") : "Sin fecha"}</span>
          </div>
          {!!row.comment.mentions?.length && <div className="pending-mentions">{row.comment.mentions.map((mention) => <span key={mention}>{mention}</span>)}</div>}
          {row.comment.resolvedAt && <p className="mini">Resuelto por {row.comment.resolvedBy || "Usuario"} · {new Date(row.comment.resolvedAt).toLocaleString("es-MX")}</p>}
          <div className="pending-actions">
            <button type="button" onClick={() => goToTask(row)}>Abrir solicitud</button>
            {!isResolved(row.comment) && <button type="button" className="done" onClick={() => resolve(row)}>Marcar resuelto</button>}
          </div>
        </article>)}
      </div>
    </aside>}
  </>;
}
