import { NextResponse } from "next/server";

export const maxDuration = 60;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanModelText(value: string) {
  return value
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^copy\s*out\s*final\s*:?/i, "")
    .trim();
}

function looksTooWeak(value: string) {
  const text = value.trim();
  if (!text) return true;
  if (text.length < 35) return true;
  if (/[,:;\-–—]$/.test(text)) return true;
  if (/\b(y|de|para|con|sin|que|en|por|al|del|la|el|un|una)$/i.test(text)) return true;
  return false;
}

function buildFallbackCopy(input: {
  draft: string;
  clientName: string;
  contentType: string;
  objective: string;
  creativeIdea: string;
  keyMessage: string;
  cta: string;
}) {
  const client = input.clientName || "la marca";
  const idea = input.creativeIdea || input.draft || "esta pieza";
  const keyMessage = input.keyMessage ? `\n\n${input.keyMessage}` : "";
  const cta = input.cta ? `\n\n${input.cta}` : "\n\nEscríbenos para más información.";
  return `${idea}\n\nUna propuesta pensada para mostrar lo mejor de ${client} de forma clara, cercana y atractiva.${keyMessage}${cta}`.trim();
}

async function callOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Falta configurar OPENAI_API_KEY.");
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 900
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "No se pudo mejorar el Copy Out con OpenAI.";
    throw new Error(message);
  }

  const outputText = typeof payload?.output_text === "string"
    ? payload.output_text
    : Array.isArray(payload?.output)
      ? payload.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
          .map((part: any) => part?.text || part?.value || "")
          .join(" ")
      : "";

  return cleanModelText(outputText);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const draft = normalizeText(body.copyDraft);
    const clientName = normalizeText(body.clientName);
    const contentType = normalizeText(body.contentType);
    const objective = normalizeText(body.objective);
    const platforms = Array.isArray(body.platforms) ? body.platforms.filter(Boolean).join(", ") : normalizeText(body.platforms);
    const visualFormat = normalizeText(body.visualFormat);
    const feedPlacement = normalizeText(body.feedPlacement);
    const creativeIdea = normalizeText(body.creativeIdea);
    const copyIn = normalizeText(body.copyIn);
    const keyMessage = normalizeText(body.keyMessage);
    const cta = normalizeText(body.cta);
    const buyerPersonaName = normalizeText(body.buyerPersonaName);
    const buyerPersonaContext = normalizeText(body.buyerPersonaContext);
    const successfulCopies = Array.isArray(body.successfulCopies) ? body.successfulCopies.slice(0, 12).map((item: any, index: number) => {
      return `${index + 1}. ${normalizeText(item.copyOut || item.copy || item.text)}${item.contentType ? ` | Tipo: ${item.contentType}` : ""}${item.objective ? ` | Objetivo: ${item.objective}` : ""}`;
    }).filter((item: string) => item.length > 4).join("\n") : "";

    const baseDraft = draft || copyIn || creativeIdea;
    if (!baseDraft) {
      return NextResponse.json({ error: "Escribe una base de copy o idea creativa antes de mejorar con IA." }, { status: 400 });
    }

    const prompt = `Actúa como Content Manager senior y copywriter profesional especializado en redes sociales para marcas comerciales.

Objetivo: mejorar el Copy Out final que se publicará. Debes entregar SOLO el copy final, sin explicación, sin encabezados y sin markdown.

Reglas de calidad:
- Corrige ortografía, claridad, ritmo y estructura.
- Mantén el mensaje fiel a la solicitud; no inventes promociones, precios, fechas ni datos no proporcionados.
- Adapta el tono al cliente, objetivo, plataforma y buyer persona.
- Haz que el copy sea publicable: hook claro, desarrollo breve y cierre/CTA natural.
- Usa emojis solo si aportan y con moderación.
- Si el copy va a Instagram/Facebook/TikTok, puede incluir saltos de línea para legibilidad.
- Si agregas hashtags, máximo 3 y solo si son útiles.
- Aprende del historial de copys aprobados del cliente para mantener estilo, pero NO copies literalmente.

Cliente: ${clientName || "No especificado"}
Tipo de contenido: ${contentType || "No especificado"}
Objetivo: ${objective || "No especificado"}
Plataformas: ${platforms || "No especificado"}
Formato visual: ${visualFormat || "No especificado"}
Ubicación/placement: ${feedPlacement || "No especificado"}
Buyer persona: ${buyerPersonaName || "Sin enfoque particular"}
Contexto buyer persona: ${buyerPersonaContext || "Sin contexto específico"}
Idea creativa: ${creativeIdea || "No especificada"}
Copy In: ${copyIn || "No especificado"}
Mensaje clave: ${keyMessage || "No especificado"}
CTA solicitado: ${cta || "No especificado"}

Base actual del Copy Out a mejorar:
${baseDraft}

Base de aprendizaje: copys previamente aprobados/finalizados del mismo cliente:
${successfulCopies || "No hay historial aprobado disponible todavía."}

Entrega únicamente el Copy Out final listo para publicar.`;

    let improved = "";
    try {
      improved = await callOpenAI(prompt);
    } catch (error) {
      console.error("OpenAI Copy Out error", error);
    }

    if (looksTooWeak(improved)) {
      improved = buildFallbackCopy({ draft: baseDraft, clientName, contentType, objective, creativeIdea, keyMessage, cta });
    }

    return NextResponse.json({ improvedCopyOut: improved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo mejorar el Copy Out.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
