import { NextResponse } from "next/server";

export const maxDuration = 60;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta configurar GEMINI_API_KEY.");

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.55, maxOutputTokens: 280 }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "No se pudo perfeccionar la idea.";
    throw new Error(message);
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    ?.join(" ")
    ?.trim();

  return text || "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const clientName = normalizeText(body.clientName);
    const clientContext = normalizeText(body.clientContext);
    const contentType = normalizeText(body.contentType);
    const objective = normalizeText(body.objective);
    const platforms = Array.isArray(body.platforms) ? body.platforms.join(", ") : normalizeText(body.platforms);
    const visualFormat = normalizeText(body.visualFormat);
    const creativeIdea = normalizeText(body.creativeIdea);
    const keyMessage = normalizeText(body.keyMessage);
    const cta = normalizeText(body.cta);

    if (!creativeIdea) {
      return NextResponse.json({ error: "Escribe primero una idea creativa base." }, { status: 400 });
    }

    const prompt = `Eres director creativo senior de una agencia. Perfecciona únicamente la IDEA CREATIVA de una solicitud de contenido.

Reglas:
- Devuelve solo la idea creativa final, sin títulos, sin bullets y sin explicación.
- No inventes información del cliente que no esté en el contexto.
- Mantén la intención original, pero mejora claridad, dirección visual y accionabilidad para producción/diseño.
- Debe ser entendible para KAM, diseño y audiovisual.
- Extensión ideal: 2 a 4 oraciones.

Cliente: ${clientName || "Sin cliente"}
Contexto del cliente: ${clientContext || "Sin contexto adicional"}
Tipo de pieza: ${contentType || "Sin tipo"}
Objetivo: ${objective || "Sin objetivo"}
Plataformas: ${platforms || "Sin plataformas"}
Formato visual: ${visualFormat || "Sin formato"}
Mensaje clave: ${keyMessage || "Sin mensaje clave"}
CTA: ${cta || "Sin CTA"}
Idea creativa actual: ${creativeIdea}`;

    const improved = await callGemini(prompt);
    return NextResponse.json({ creativeIdea: improved || creativeIdea });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo perfeccionar la idea.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
