import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";

export const maxDuration = 60;

type CopyRequestPayload = {
  item?: Record<string, unknown>;
  client?: Record<string, unknown>;
  approvedCopies?: string[];
};

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function listText(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((x) => String(x).trim())
        .filter(Boolean)
        .join(", ")
    : "";
}

function cleanModelText(value: string) {
  return value
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^copy\s*(out|final)?\s*:?/i, "")
    .trim();
}

function fallbackCopy(payload: CopyRequestPayload) {
  const item = payload.item || {};
  const client = payload.client || {};
  const copyRules = (client.copyRules || {}) as Record<string, unknown>;
  const brandName =
    asText(client.name) || asText(item.clientName) || "la marca";
  const objective =
    asText(item.objective) || asText(item.goal) || "comunicar valor";
  const contentType = asText(item.contentType) || asText(item.format) || "post";
  const idea =
    asText(item.creativeIdea) ||
    asText(item.topic) ||
    asText(item.keyMessage) ||
    "una propuesta relevante para la audiencia";
  const keyMessage = asText(item.keyMessage) || idea;
  const ctas =
    listText(copyRules.preferredCtas) ||
    asText(item.cta) ||
    "Escríbenos para más información";
  const hashtags = listText(copyRules.baseHashtags);
  const tone =
    asText(copyRules.tone) || asText(client.tone) || "claro y profesional";

  return `${brandName} tiene una propuesta pensada para conectar con su audiencia.

${keyMessage}

Este ${contentType.toLowerCase()} busca ${objective.toLowerCase()} con un mensaje ${tone.toLowerCase()}, directo y fácil de entender. ${idea}

${ctas}.${hashtags ? `\n\n${hashtags}` : ""}`;
}

function looksIncomplete(copy: string) {
  const clean = copy.trim();
  if (clean.length < 220) return true;
  if (!/[.!?…)]$/.test(clean)) return true;
  const lastWords = clean.split(/\s+/).slice(-3).join(" ").toLowerCase();
  return /\b(al|de|para|con|por|que|en|y|o|tu|su|la|el|los|las)$/i.test(
    lastWords,
  );
}

function buildPrompt(payload: CopyRequestPayload) {
  const item = payload.item || {};
  const client = payload.client || {};
  const copyRules = (client.copyRules || {}) as Record<string, unknown>;
  const approvedCopies = (payload.approvedCopies || [])
    .slice(0, 8)
    .join("\n---\n");

  return `Eres copywriter senior de una agencia de marketing.
Genera UN copy completo, cerrado y listo para publicar en redes sociales en español mexicano.
Extensión objetivo: 90 a 150 palabras, salvo que las reglas del cliente indiquen algo diferente.
No lo cortes a media frase. Termina siempre con una idea completa y un CTA claro.
No inventes datos duros, precios, promociones ni promesas no incluidas.
No copies literalmente ejemplos anteriores; solo aprende estilo.

CLIENTE:
Nombre: ${asText(client.name) || asText(item.clientName)}
Giro: ${asText(client.industry)}
Tono marca: ${asText(client.tone)}
Notas marca: ${asText(client.brandNotes)}

REGLAS DE COPY:
Tono específico: ${asText(copyRules.tone)}
Palabras permitidas: ${listText(copyRules.allowedWords)}
Palabras prohibidas: ${listText(copyRules.forbiddenWords)}
Emojis permitidos: ${listText(copyRules.allowedEmojis)}
CTAs preferidos: ${listText(copyRules.preferredCtas)}
Hashtags base: ${listText(copyRules.baseHashtags)}
Indicaciones especiales: ${asText(copyRules.specialInstructions)}
Nunca hacer: ${asText(copyRules.neverDo)}
Ejemplos internos aprobados: ${asText(copyRules.approvedExamples)}

CONTENIDO A TRABAJAR:
Formato: ${asText(item.contentType)}
Objetivo: ${asText(item.objective)}
Tema: ${asText(item.topic)}
Idea creativa: ${asText(item.creativeIdea)}
Mensaje clave: ${asText(item.keyMessage)}
CTA sugerido: ${asText(item.cta)}
Fecha publicación: ${asText(item.publishDate)}
Referencias: ${asText(item.referenceLinks)}
Copy actual / borrador si existe: ${asText(item.currentCopy)}
Contexto buyer persona: ${asText(item.buyerPersonaContext)}

COPYS APROBADOS ANTERIORES DEL MISMO CLIENTE:
${approvedCopies || "Sin ejemplos previos."}

Entrega solo el copy final, sin explicación, sin encabezados y sin dejar frases incompletas.`;
}

async function callOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 1200,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI no pudo generar el copy.");
  }

  const text =
    typeof data?.output_text === "string"
      ? data.output_text
      : Array.isArray(data?.output)
        ? data.output
            .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
            .map((part: any) => part?.text || part?.value || "")
            .join("\n")
        : "";

  return cleanModelText(text);
}

async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada.");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.72, maxOutputTokens: 1600 },
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini no pudo generar el copy.");
  }
  const copy = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("\n")
    .trim();

  return cleanModelText(copy || "");
}

export async function POST(request: Request) {
  const authCheck = await requireApiPermission(request, "contenidos", "generate");
  if (!authCheck.ok) return authCheck.response;

  const payload = (await request.json()) as CopyRequestPayload;
  const prompt = buildPrompt(payload);
  const errors: string[] = [];

  try {
    const copy = await callOpenAI(prompt);
    if (!looksIncomplete(copy)) return NextResponse.json({ copy, mode: "openai" });
    errors.push("OpenAI generó un texto incompleto.");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "OpenAI falló.");
  }

  try {
    const copy = await callGemini(prompt);
    if (!looksIncomplete(copy)) return NextResponse.json({ copy, mode: "gemini" });
    errors.push("Gemini generó un texto incompleto.");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Gemini falló.");
  }

  return NextResponse.json({
    copy: fallbackCopy(payload),
    mode: "fallback",
    providerErrors: errors.slice(0, 3),
  });
}
