import { NextResponse } from "next/server";

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
  return Array.isArray(value) ? value.map((x) => String(x).trim()).filter(Boolean).join(", ") : "";
}

function fallbackCopy(payload: CopyRequestPayload) {
  const item = payload.item || {};
  const client = payload.client || {};
  const copyRules = (client.copyRules || {}) as Record<string, unknown>;
  const brandName = asText(client.name) || asText(item.clientName) || "la marca";
  const objective = asText(item.objective) || "comunicar valor";
  const contentType = asText(item.contentType) || "post";
  const idea = asText(item.creativeIdea) || asText(item.topic) || "una propuesta relevante para la audiencia";
  const ctas = listText(copyRules.preferredCtas) || asText(item.cta) || "Escríbenos para más información";
  const hashtags = listText(copyRules.baseHashtags);

  return `${brandName} presenta ${idea}.\n\nUna pieza pensada para ${objective.toLowerCase()} en formato ${contentType.toLowerCase()}, con un mensaje claro, directo y alineado a la marca.\n\n${ctas}.${hashtags ? `\n\n${hashtags}` : ""}`;
}

function buildPrompt(payload: CopyRequestPayload) {
  const item = payload.item || {};
  const client = payload.client || {};
  const copyRules = (client.copyRules || {}) as Record<string, unknown>;
  const approvedCopies = (payload.approvedCopies || []).slice(0, 8).join("\n---\n");

  return `Eres copywriter senior de una agencia de marketing.
Genera UN copy listo para redes sociales en español mexicano.
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

COPYS APROBADOS ANTERIORES DEL MISMO CLIENTE:
${approvedCopies || "Sin ejemplos previos."}

Entrega solo el copy final, sin explicación.`;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CopyRequestPayload;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ copy: fallbackCopy(payload), mode: "fallback" });
  }

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(payload) }] }],
        generationConfig: { temperature: 0.75, maxOutputTokens: 900 },
      }),
    });

    const data = await response.json();
    const copy = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n").trim();
    if (!response.ok || !copy) return NextResponse.json({ copy: fallbackCopy(payload), mode: "fallback" });
    return NextResponse.json({ copy, mode: "gemini" });
  } catch {
    return NextResponse.json({ copy: fallbackCopy(payload), mode: "fallback" });
  }
}
