import { NextResponse } from "next/server";

export const maxDuration = 60;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function looksTooWeakOrIncomplete(value: string) {
  const text = value.trim();
  if (!text) return true;
  if (text.length < 260) return true;
  if (/[,:;\-–—]$/.test(text)) return true;
  if (/\b(desde|hacia|para|con|sin|porque|cuando|donde|que|de|del|la|el|un|una|los|las)$/i.test(text)) return true;
  return false;
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
      generationConfig: { temperature: 0.45, maxOutputTokens: 900 }
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
    ?.replace(/\s+/g, " ")
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

    const prompt = `Eres director creativo senior de una agencia. Tu tarea es perfeccionar únicamente el campo IDEA CREATIVA de una solicitud de contenido.

Objetivo del botón:
- NO generar copy final.
- NO resumir la idea.
- NO responder con una frase poética o incompleta.
- Sí convertir la idea base en una instrucción clara y accionable para producción, diseño o audiovisual.

Reglas de salida:
- Devuelve solo la idea creativa final, sin título, sin bullets, sin comillas y sin explicación.
- Escribe de 4 a 6 oraciones completas.
- Debe quedar suficientemente específico para que un productor, editor o diseñador sepa qué hacer.
- Incluye: concepto central, cómo inicia la pieza, qué se muestra en el desarrollo, tono visual/narrativo y cierre sugerido.
- Si es UGC, debe sonar natural, como contenido grabado por una persona real, no como anuncio corporativo.
- Si es reel/video, describe recorrido, planos o momentos clave, sin escribir un guion rígido palabra por palabra.
- Mantén la intención original del usuario y no inventes datos duros del cliente.
- La respuesta debe terminar con una oración completa.

Datos de la solicitud:
Cliente: ${clientName || "Sin cliente"}
Contexto del cliente: ${clientContext || "Sin contexto adicional"}
Tipo de pieza: ${contentType || "Sin tipo"}
Objetivo: ${objective || "Sin objetivo"}
Plataformas: ${platforms || "Sin plataformas"}
Formato visual: ${visualFormat || "Sin formato"}
Mensaje clave: ${keyMessage || "Sin mensaje clave"}
CTA: ${cta || "Sin CTA"}
Idea creativa actual: ${creativeIdea}`;

    let improved = await callGemini(prompt);

    if (looksTooWeakOrIncomplete(improved)) {
      improved = await callGemini(`${prompt}\n\nLa respuesta anterior quedó demasiado corta o incompleta. Vuelve a redactarla completa, específica y accionable en 4 a 6 oraciones. No la cortes a media frase.`);
    }

    return NextResponse.json({ creativeIdea: improved || creativeIdea });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo perfeccionar la idea.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
