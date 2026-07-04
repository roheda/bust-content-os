import { NextResponse } from "next/server";

export const maxDuration = 90;

type Persona = { id?: string; name?: string; description?: string; pains?: string; desires?: string; contentAngles?: string };

type Proposal = {
  contentType: string;
  objective: string;
  platforms: string[];
  visualFormat: string;
  feedPlacement: string;
  buyerPersonaId?: string;
  buyerPersonaName?: string;
  buyerPersonaSnapshot?: Persona | null;
  topic: string;
  creativeIdea: string;
  keyMessage: string;
  copyIn: string;
  cta: string;
  publishDate: string;
  suggestedArea: string;
  requiresProduction: boolean;
  materialAvailable: boolean;
  materialLinks: string;
  productionNotes: string;
};

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextBusinessDate(date: string) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatFor(contentType: string) {
  if (["Reel", "TikTok"].includes(contentType)) return "Vertical 9:16";
  if (contentType === "Carrusel") return "Carrusel Feed";
  if (contentType === "Story") return "Story 9:16";
  return "Cuadrado 1:1";
}

function feedFor(contentType: string) {
  if (contentType === "Carrusel") return "Carrousel para el Feed";
  if (["Reel", "TikTok", "Story"].includes(contentType)) return contentType;
  return "Feed";
}

function ctaFor(objective: string) {
  const normalized = objective.toLowerCase();
  if (normalized.includes("reserva")) return "Reserva por WhatsApp";
  if (normalized.includes("tráfico") || normalized.includes("trafico")) return "Conoce más";
  if (normalized.includes("engagement") || normalized.includes("comunidad")) return "Comenta o compártelo";
  return "Solicita información";
}

function buildFallbackProposal(input: {
  index: number;
  count: number;
  startDate: string;
  interval: number;
  types: string[];
  goals: string[];
  themes: string[];
  must: string;
  client: any;
}): Proposal {
  const { index, startDate, interval, types, goals, themes, must, client } = input;
  const contentType = types[index % Math.max(types.length, 1)] || "Post";
  const objective = goals[index % Math.max(goals.length, 1)] || "Ventas";
  const theme = themes[index % Math.max(themes.length, 1)] || "Tema estratégico";
  const personas: Persona[] = Array.isArray(client?.buyerPersonas) ? client.buyerPersonas : [];
  const persona = personas.length ? personas[index % personas.length] : null;
  const importantDates = asList(client?.brandBrain?.importantDates);
  const importantDate = importantDates.length ? importantDates[index % importantDates.length] : "";
  const isVideoLike = ["Reel", "TikTok", "Foto"].includes(contentType);
  const personaName = persona?.name || "audiencia general de la marca";
  const dateContext = importantDate ? ` Integrar como oportunidad editorial la fecha importante: ${importantDate}.` : "";
  const publishDate = nextBusinessDate(addDays(startDate, index * Math.max(1, interval)));
  const visualFormat = formatFor(contentType);

  return {
    contentType,
    objective,
    platforms: contentType === "TikTok" ? ["TikTok"] : ["Instagram", "Facebook"],
    visualFormat,
    feedPlacement: feedFor(contentType),
    buyerPersonaId: persona?.id || "",
    buyerPersonaName: persona?.name || "Sin enfoque particular",
    buyerPersonaSnapshot: persona,
    topic: `${theme}${importantDate ? ` · ${importantDate}` : ""}`,
    creativeIdea: `Crear un ${contentType.toLowerCase()} para ${client?.name || "el cliente"} enfocado en ${objective.toLowerCase()}, dirigido a ${personaName}. La pieza debe aterrizar el tema ${theme} con una situación clara, visual y fácil de ejecutar por el equipo. Debe usar el tono de marca, conectar con el contexto comercial del cliente y evitar sentirse genérica.${dateContext} El cierre debe dejar claro el siguiente paso para la audiencia y facilitar que diseño o edición construyan una publicación lista para operar.`,
    keyMessage: must || `Mensaje central alineado a ${objective} para ${theme}.`,
    copyIn: `Encabezado sugerido: ${theme}. Desarrollo: explicar el beneficio principal con un ejemplo concreto para ${personaName}. Cierre: ${ctaFor(objective)}. Mantener tono de marca y evitar relleno.`,
    cta: ctaFor(objective),
    publishDate,
    suggestedArea: isVideoLike ? "Audiovisual" : "Diseño",
    requiresProduction: isVideoLike,
    materialAvailable: !isVideoLike,
    materialLinks: isVideoLike ? "" : "No requiere producción. Usar assets de marca, material existente, stock o generación IA según el brief.",
    productionNotes: isVideoLike ? `Producción necesaria para capturar material del tema: ${theme}. Priorizar tomas verticales, recursos, detalles, transiciones limpias y cierre visual para CTA.` : ""
  };
}

function safeParseJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("La IA no devolvió JSON válido.");
  return JSON.parse(cleaned.slice(first, last + 1));
}

async function callOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY");
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: prompt, max_output_tokens: 5000 })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "No se pudo generar con OpenAI.");
  return typeof payload.output_text === "string"
    ? payload.output_text
    : Array.isArray(payload.output)
      ? payload.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : []).map((part: any) => part?.text || part?.value || "").join(" ")
      : "";
}

async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.45, maxOutputTokens: 5000, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "No se pudo generar con Gemini.");
  return payload?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join(" ") || "";
}

async function callBest(prompt: string) {
  try { return await callOpenAI(prompt); }
  catch { return await callGemini(prompt); }
}

function normalizeProposal(raw: any, fallback: Proposal): Proposal {
  const contentType = asText(raw?.contentType) || fallback.contentType;
  const objective = asText(raw?.objective) || fallback.objective;
  const isVideoLike = ["Reel", "TikTok", "Foto"].includes(contentType);
  return {
    ...fallback,
    ...raw,
    contentType,
    objective,
    platforms: Array.isArray(raw?.platforms) && raw.platforms.length ? raw.platforms.map(String) : fallback.platforms,
    visualFormat: asText(raw?.visualFormat) || formatFor(contentType),
    feedPlacement: asText(raw?.feedPlacement) || feedFor(contentType),
    topic: asText(raw?.topic) || fallback.topic,
    creativeIdea: asText(raw?.creativeIdea) || fallback.creativeIdea,
    keyMessage: asText(raw?.keyMessage) || fallback.keyMessage,
    copyIn: asText(raw?.copyIn) || fallback.copyIn,
    cta: asText(raw?.cta) || ctaFor(objective),
    publishDate: nextBusinessDate(asText(raw?.publishDate) || fallback.publishDate),
    suggestedArea: asText(raw?.suggestedArea) || (isVideoLike ? "Audiovisual" : "Diseño"),
    requiresProduction: typeof raw?.requiresProduction === "boolean" ? raw.requiresProduction : isVideoLike,
    materialAvailable: typeof raw?.materialAvailable === "boolean" ? raw.materialAvailable : !isVideoLike,
    materialLinks: asText(raw?.materialLinks) || (!isVideoLike ? fallback.materialLinks : ""),
    productionNotes: asText(raw?.productionNotes) || (isVideoLike ? fallback.productionNotes : "")
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const count = Math.max(1, Math.min(30, Number(body.count || 5)));
    const startDate = asText(body.startDate);
    if (!startDate) return NextResponse.json({ error: "Falta primera fecha." }, { status: 400 });
    const interval = Math.max(1, Number(body.interval || 2));
    const types = asList(body.types);
    const goals = asList(body.goals);
    const themes = asList(body.themes);
    const must = asText(body.must);
    const client = body.client || {};
    const importantDates = asList(client?.brandBrain?.importantDates);
    const personas: Persona[] = Array.isArray(client.buyerPersonas) ? client.buyerPersonas : [];

    const fallback = Array.from({ length: count }).map((_, index) => buildFallbackProposal({ index, count, startDate, interval, types, goals, themes, must, client }));

    const prompt = `Actúa como estratega senior de content marketing para una agencia. Genera ${count} publicaciones completas para cargar en un sistema operativo de solicitudes.

Debes devolver exclusivamente JSON válido con esta forma:
{"proposals":[{"contentType":"Post|Carrusel|Reel|Story|TikTok|Foto|Diseño|Blog","objective":"","platforms":["Instagram"],"visualFormat":"","feedPlacement":"","buyerPersonaId":"","buyerPersonaName":"","topic":"","creativeIdea":"","keyMessage":"","copyIn":"","cta":"","publishDate":"YYYY-MM-DD","suggestedArea":"Diseño|Audiovisual","requiresProduction":false,"materialAvailable":true,"materialLinks":"","productionNotes":""}]}

Reglas:
- Llena todos los campos de cada propuesta. No dejes placeholders vacíos.
- Usa únicamente estos tipos si aplican: ${types.join(", ") || "Post, Carrusel, Reel"}.
- Usa estos objetivos si aplican: ${goals.join(", ") || "Ventas, Awareness, Confianza"}.
- Usa estos temas como base: ${themes.join(", ") || "Temas estratégicos"}.
- Fechas: primera fecha ${startDate}, separación ${interval} días, nunca sábado o domingo.
- Buyer personas disponibles: ${personas.map((p) => `${p.id || p.name}: ${p.name} - ${p.description || ""}`).join(" | ") || "sin buyer personas"}. Asigna buyer persona cuando tenga sentido.
- Fechas importantes del cliente que siempre deben considerarse si son pertinentes: ${importantDates.join(" | ") || "sin fechas registradas"}.
- Si la pieza es Reel, TikTok o Foto y requiere capturar material nuevo, marca requiresProduction true y llena productionNotes.
- Si no requiere producción, marca materialAvailable true y materialLinks con una nota clara de insumos: assets de marca, stock, IA o material existente.
- Copy In debe venir como copy base listo para trabajar, no como “pendiente”.
- Creative Idea debe ser accionable para diseño/audiovisual, con enfoque visual y contexto de ejecución.
- No uses la tipografía del Brand Brain como título, tema o copy. La tipografía solo es referencia visual.

Cliente:
${JSON.stringify({
  name: client.name,
  industry: client.industry,
  brandNotes: client.brandNotes,
  brandPersonality: client.brandPersonality,
  visualStyle: client.visualStyle,
  contentPillars: client.contentPillars,
  valueProposition: client.valueProposition,
  contentAngles: client.contentAngles,
  customerPainPoints: client.customerPainPoints,
  marketScope: client.marketScope,
  marketRegion: client.marketRegion,
  primaryCity: client.primaryCity,
  serviceArea: client.serviceArea,
  offerSummary: client.offerSummary,
  localAudienceContext: client.localAudienceContext,
  brandBrain: { ...client.brandBrain, typography: "solo referencia visual; no usar como texto" },
  buyerPersonas: personas
})}

Factores obligatorios: ${must || "sin factores adicionales"}
Contexto resumido de cliente: ${asText(body.clientContext)}
Contexto de mercado: ${asText(body.marketContext)}
Historial de contenidos finalizados: ${asText(body.successfulContext)}`;

    try {
      const text = await callBest(prompt);
      const parsed = safeParseJson(text);
      const rawProposals = Array.isArray(parsed?.proposals) ? parsed.proposals : [];
      const proposals = fallback.map((item, index) => normalizeProposal(rawProposals[index], item));
      return NextResponse.json({ proposals, source: "model" });
    } catch (error) {
      return NextResponse.json({ proposals: fallback, source: "fallback", warning: error instanceof Error ? error.message : "IA no disponible" });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error generando propuestas." }, { status: 500 });
  }
}
