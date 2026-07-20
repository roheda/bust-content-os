import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";

export const maxDuration = 60;

type OrderItem = {
  id: string;
  clientName?: string;
  batchName?: string;
  contentType?: string;
  objective?: string;
  topic?: string;
  creativeIdea?: string;
  keyMessage?: string;
  copyIn?: string;
  cta?: string;
  productionNotes?: string;
  visualFormat?: string;
  feedPlacement?: string;
  publishDate?: string;
  referenceLinks?: string;
  referenceFiles?: unknown[];
  materialLinks?: string;
  materialFiles?: unknown[];
  productionSpecificMaterialLink?: string;
  productionGeneralMaterialLinks?: string;
  productionMaterialFiles?: unknown[];
};

type SuggestedOrderItem = {
  id: string;
  order: number;
  group: string;
  moment: string;
  priority: "normal" | "high" | "immediate";
  requiresImmediateCapture: boolean;
  reason: string;
};

type Payload = {
  items?: OrderItem[];
  client?: Record<string, unknown> | null;
  instructions?: string;
  productionMode?: string;
};

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function listText(value: unknown) {
  return Array.isArray(value)
    ? value.map((x) => String(x).trim()).filter(Boolean).join(", ")
    : asText(value);
}

function normalize(value: string) {
  return (value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function inferProductionMeta(item: OrderItem) {
  const text = normalize([
    item.contentType,
    item.objective,
    item.topic,
    item.creativeIdea,
    item.keyMessage,
    item.copyIn,
    item.productionNotes,
    item.visualFormat,
    item.feedPlacement,
  ].filter(Boolean).join(" "));

  const isVideo = /reel|video|tik|toma|grab|vertical|story/.test(text);
  const isStory = /story|stories|historia/.test(text);
  const isBeverage = /bebida|drink|coctel|cocktail|vino|sake|cerveza|te de la casa|agua|refresco|copa|bar/.test(text);
  const isDessert = /postre|helado|pastel|cake|dulce/.test(text);
  const isAmbience = /ambiente|sucursal|fachada|entrada|local|restaurante|mesa vacia|interior|exterior|decoracion|salon|lugar|espacio/.test(text);
  const isPeople = /modelo|persona|cliente|comensal|familia|pareja|amigos|equipo|staff|mesero|chef|mesa completa|lifestyle/.test(text);
  const isPrep = /preparacion|preparar|cortar|emplatar|salsear|topping|sirviendo|cocina|chef|detras|proceso|flameado|accion/.test(text);
  const isHot = /caliente|vapor|ramen|udon|yakisoba|arroz|sopa|caldo|carne|hamburguesa|pasta|taco|frito|plancha|horno|tempura|pollo|alitas|papas|queso fundido/.test(text);
  const isCold = /frio|sushi|roll|atun|ceviche|ensalada|tiradito|sashimi|nigiri|tostada|entrada|carpaccio|crudo/.test(text);
  const isProduct = /producto|platillo|menu|close|hero|detalle|textura|ingrediente/.test(text);

  let group = "Mesa completa / tomas finales";
  let moment = "Al cierre de la producción";
  let score = 70;
  let priority: SuggestedOrderItem["priority"] = "normal";
  let immediate = false;

  if (isAmbience) {
    group = "Ambiente / locación";
    moment = "Antes de montar producto o llenar mesa";
    score = 10;
  } else if (isBeverage) {
    group = "Bebidas";
    moment = "Al inicio; pueden sostener la mesa mientras cocina prepara platillos";
    score = 20;
  } else if (isCold) {
    group = "Platillos fríos / entradas";
    moment = "Cuando salgan de cocina; permiten más margen para foto y video";
    score = 30;
  } else if (isPrep) {
    group = "Acciones de cocina / preparación";
    moment = "Coordinar al momento con cocina antes de servir";
    score = 40;
    priority = "high";
    immediate = true;
  } else if (isHot) {
    group = "Platillos calientes";
    moment = "Capturar inmediatamente al salir de cocina";
    score = 50;
    priority = "immediate";
    immediate = true;
  } else if (isDessert) {
    group = "Postres";
    moment = "Después de platillos fuertes, antes de mesa final";
    score = 60;
  } else if (isPeople) {
    group = "Personas / mesa completa";
    moment = "Cuando ya exista producto suficiente montado";
    score = 80;
  } else if (isProduct) {
    group = "Producto / detalle";
    moment = "Después de ambiente y bebidas, según salida de cocina";
    score = 45;
  }

  if (isVideo && immediate) score -= 3;
  if (isVideo && !isAmbience) priority = priority === "normal" ? "high" : priority;
  if (isStory) score += 8;

  return { group, moment, score, priority, immediate, isVideo };
}

function fallbackOrder(items: OrderItem[]): SuggestedOrderItem[] {
  return items
    .map((item, index) => {
      const meta = inferProductionMeta(item);
      return { item, index, meta };
    })
    .sort((a, b) => {
      if (a.meta.score !== b.meta.score) return a.meta.score - b.meta.score;
      if (a.item.publishDate !== b.item.publishDate) return String(a.item.publishDate || "").localeCompare(String(b.item.publishDate || ""));
      return a.index - b.index;
    })
    .map(({ item, meta }, index) => ({
      id: item.id,
      order: index + 1,
      group: meta.group,
      moment: meta.moment,
      priority: meta.priority,
      requiresImmediateCapture: meta.immediate,
      reason: meta.immediate
        ? "Conviene capturarlo justo al salir o al ejecutarse la acción para conservar temperatura, textura o movimiento."
        : `Se coloca en ${meta.group.toLowerCase()} para ordenar la producción por montaje, tiempos de cocina y eficiencia de toma.`,
    }));
}

function buildPrompt(payload: Payload) {
  const items = payload.items || [];
  const client = payload.client || {};
  const brandBrain = (client.brandBrain || {}) as Record<string, unknown>;
  const copyRules = (client.copyRules || {}) as Record<string, unknown>;

  return `Eres productor audiovisual senior y asistente de dirección para sesiones de foto y video de una agencia.
Ordena las solicitudes seleccionadas para que el equipo sepa qué grabar o fotografiar primero y qué dejar al final.
Lee con cuidado TODA la información de cada solicitud, no solo el tipo de contenido: objetivo, tema, idea visual, mensaje, copy, CTA, notas de producción, referencias, links, archivos, lote y reglas del cliente. Deduce qué está plasmando cada visual antes de moverlo.
Piensa especialmente en restaurantes: platillos calientes deben capturarse al salir de cocina, videos y acciones deben hacerse antes que la foto final si la temperatura/textura importa, bebidas pueden ayudar al montaje, ambiente conviene antes de que el set se ensucie, mesa completa y personas al final cuando ya hay producto suficiente.
Si no hay evidencia suficiente para clasificar una solicitud, márcala como Producción general y explica que requiere revisión manual.

Devuelve SOLO JSON válido con esta forma exacta:
{"items":[{"id":"...","order":1,"group":"...","moment":"...","priority":"normal|high|immediate","requiresImmediateCapture":true,"reason":"explicación breve operativa"}]}

No inventes solicitudes. Usa todos los IDs exactamente una vez. El orden debe ser práctico para una producción real.

CLIENTE:
Nombre: ${asText(client.name)}
Giro: ${asText(client.industry)}
Tono/Notas: ${asText(client.tone)} ${asText(client.brandNotes)}
Brand Brain: ${asText(brandBrain.brandDescription)}
Dos: ${listText(brandBrain.dos)}
Donts: ${listText(brandBrain.donts)}
Reglas de copy/producción: ${asText(copyRules.specialInstructions)} ${asText(copyRules.neverDo)}

MODO: ${asText(payload.productionMode) || "producción general"}
INSTRUCCIONES DEL EQUIPO:
${asText(payload.instructions) || "Sin instrucciones adicionales."}

SOLICITUDES:
${items.map((item, index) => `
${index + 1}. ID: ${item.id}
Cliente: ${item.clientName || ""}
Lote: ${item.batchName || ""}
Formato: ${item.contentType || ""} ${item.visualFormat || ""} ${item.feedPlacement || ""}
Objetivo: ${item.objective || ""}
Tema: ${item.topic || ""}
Idea visual: ${item.creativeIdea || ""}
Mensaje/Copy: ${item.keyMessage || ""} ${item.copyIn || ""}
CTA: ${item.cta || ""}
Notas de producción: ${item.productionNotes || ""}
Fecha publicación: ${item.publishDate || ""}
Referencias: ${item.referenceLinks || ""}`).join("\n---\n")}`;
}

function parseJson(text: string, itemIds: string[]) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : cleaned);
  const rows = Array.isArray(parsed?.items) ? parsed.items : [];
  const seen = new Set<string>();
  const valid: SuggestedOrderItem[] = [];
  rows.forEach((row: any) => {
    const id = String(row?.id || "").trim();
    if (!itemIds.includes(id) || seen.has(id)) return;
    seen.add(id);
    valid.push({
      id,
      order: Number(row?.order || valid.length + 1),
      group: asText(row?.group) || "Producción general",
      moment: asText(row?.moment) || "Según disponibilidad de producción",
      priority: row?.priority === "immediate" || row?.priority === "high" ? row.priority : "normal",
      requiresImmediateCapture: Boolean(row?.requiresImmediateCapture),
      reason: asText(row?.reason) || "Orden sugerido por eficiencia de producción.",
    });
  });

  const missing = itemIds.filter((id) => !seen.has(id));
  if (missing.length) {
    const fallback = fallbackOrder(missing.map((id) => ({ id })));
    fallback.forEach((row) => valid.push({ ...row, order: valid.length + 1 }));
  }

  return valid.map((row, index) => ({ ...row, order: index + 1 }));
}

async function callOpenAI(prompt: string, itemIds: string[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: prompt, max_output_tokens: 2200 }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI no pudo ordenar la producción.");
  const text = typeof data?.output_text === "string"
    ? data.output_text
    : Array.isArray(data?.output)
      ? data.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : []).map((part: any) => part?.text || part?.value || "").join("\n")
      : "";
  return parseJson(text, itemIds);
}

async function callGemini(prompt: string, itemIds: string[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada.");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.25, maxOutputTokens: 2400 } }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Gemini no pudo ordenar la producción.");
  const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n") || "";
  return parseJson(text, itemIds);
}

export async function POST(request: Request) {
  const authCheck = await requireApiPermission(request, "producciones", "edit");
  if (!authCheck.ok) return authCheck.response;

  const payload = (await request.json()) as Payload;
  const items = (payload.items || []).filter((item) => item?.id);
  const itemIds = items.map((item) => item.id);
  if (!items.length) return NextResponse.json({ error: "No hay solicitudes para ordenar." }, { status: 400 });

  const prompt = buildPrompt({ ...payload, items });
  const errors: string[] = [];

  try {
    const order = await callOpenAI(prompt, itemIds);
    return NextResponse.json({ items: order, mode: "openai" });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "OpenAI falló.");
  }

  try {
    const order = await callGemini(prompt, itemIds);
    return NextResponse.json({ items: order, mode: "gemini", providerErrors: errors.slice(0, 2) });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Gemini falló.");
  }

  return NextResponse.json({ items: fallbackOrder(items), mode: "fallback", providerErrors: errors.slice(0, 3) });
}
