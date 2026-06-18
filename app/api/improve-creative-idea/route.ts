import { NextResponse } from "next/server";

export const maxDuration = 60;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sentenceCount(value: string) {
  return (value.match(/[.!?¿¡]+(?:\s|$)/g) || []).length;
}

function looksTooWeakOrIncomplete(value: string) {
  const text = value.trim();
  if (!text) return true;
  if (text.length < 420) return true;
  if (sentenceCount(text) < 4) return true;
  if (/[,:;\-–—]$/.test(text)) return true;
  if (/\b(desde|hacia|para|con|sin|porque|cuando|donde|que|de|del|la|el|un|una|los|las|al|en|muestra|iniciando|captura|can)$/i.test(text)) return true;
  return false;
}

function buildSafeFallbackIdea(input: {
  clientName: string;
  contentType: string;
  platforms: string;
  visualFormat: string;
  creativeIdea: string;
  objective: string;
  keyMessage: string;
  cta: string;
}) {
  const piece = input.contentType || "pieza de contenido";
  const client = input.clientName || "el cliente";
  const format = input.visualFormat ? ` en formato ${input.visualFormat}` : "";
  const platforms = input.platforms ? ` para ${input.platforms}` : "";
  const objective = input.objective ? ` El objetivo principal es ${input.objective.toLowerCase()}.` : "";
  const keyMessage = input.keyMessage ? ` Debe reforzar como mensaje central: ${input.keyMessage}.` : "";
  const cta = input.cta ? ` Cerrar con una invitación clara a ${input.cta.toLowerCase()}.` : " Cerrar con una invitación sencilla a pedir más información o avanzar al siguiente paso.";

  return `Crear un ${piece}${format}${platforms} para ${client}, tomando como base esta idea: ${input.creativeIdea}. La pieza debe iniciar con un momento natural y fácil de entender que introduzca la situación desde la experiencia de una persona real, evitando que se sienta como un anuncio rígido. En el desarrollo, mostrar los elementos más importantes de la idea con acciones concretas, cambios de plano y detalles visuales que ayuden a que el equipo de producción o edición sepa exactamente qué capturar. El tono debe sentirse cercano, aspiracional y auténtico, manteniendo una narrativa clara de inicio, recorrido y cierre.${objective}${keyMessage} ${cta}`.replace(/\s+/g, " ").trim();
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
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 4096,
        responseMimeType: "text/plain",
        thinkingConfig: { thinkingBudget: 0 }
      }
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

  const finishReason = payload?.candidates?.[0]?.finishReason || "";

  return { text: text || "", finishReason };
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

    const outputRules = `Reglas estrictas de salida:
- Devuelve solo la idea creativa final, sin título, sin bullets, sin comillas y sin explicación.
- Escribe exactamente 5 oraciones completas.
- Usa entre 90 y 140 palabras.
- No cortes frases a la mitad.
- No termines con conectores como: con, desde, para, que, donde, iniciando, muestra.
- La última oración debe ser un cierre completo y accionable.
- No generes copy final ni guion palabra por palabra; solo una instrucción creativa clara.`;

    const prompt = `Eres director creativo senior de una agencia. Tu tarea es perfeccionar únicamente el campo IDEA CREATIVA de una solicitud de contenido.

Objetivo del botón:
- NO generar copy final.
- NO resumir la idea.
- NO responder con una frase poética o incompleta.
- Sí convertir la idea base en una instrucción clara y accionable para producción, diseño o audiovisual.

${outputRules}

Contenido esperado:
- Concepto central.
- Cómo inicia la pieza.
- Qué se muestra en el desarrollo.
- Tono visual/narrativo.
- Cierre sugerido.

Criterios de estilo:
- Si es UGC, debe sonar natural, como contenido grabado por una persona real, no como anuncio corporativo.
- Si es reel/video, describe recorrido, planos o momentos clave, sin escribir un guion rígido palabra por palabra.
- Mantén la intención original del usuario y no inventes datos duros del cliente.

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

    let result = await callGemini(prompt);
    let improved = result.text;

    if (result.finishReason === "MAX_TOKENS" || looksTooWeakOrIncomplete(improved)) {
      result = await callGemini(`${prompt}\n\nLa respuesta anterior quedó cortada o demasiado corta. Rehazla completa en exactamente 5 oraciones, entre 90 y 140 palabras, terminando con una oración completa.`);
      improved = result.text;
    }

    if (result.finishReason === "MAX_TOKENS" || looksTooWeakOrIncomplete(improved)) {
      improved = buildSafeFallbackIdea({ clientName, contentType, platforms, visualFormat, creativeIdea, objective, keyMessage, cta });
    }

    return NextResponse.json({ creativeIdea: improved || creativeIdea });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo perfeccionar la idea.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
