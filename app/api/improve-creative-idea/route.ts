import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-auth";

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
  marketContext: string;
  successfulContext: string;
  buyerPersonaName: string;
  buyerPersonaContext: string;
}) {
  const piece = input.contentType || "pieza de contenido";
  const client = input.clientName || "el cliente";
  const format = input.visualFormat ? ` en formato ${input.visualFormat}` : "";
  const platforms = input.platforms ? ` para ${input.platforms}` : "";
  const market = input.marketContext ? ` Adaptar el enfoque al contexto comercial del cliente: ${input.marketContext}.` : "";
  const objective = input.objective ? ` El objetivo principal es ${input.objective.toLowerCase()}.` : "";
  const keyMessage = input.keyMessage ? ` Debe reforzar como mensaje central: ${input.keyMessage}.` : "";
  const cta = input.cta ? ` Cerrar con una invitación clara a ${input.cta.toLowerCase()}.` : " Cerrar con una invitación sencilla a pedir más información o avanzar al siguiente paso.";
  const learning = input.successfulContext ? " Usar como referencia el historial de contenidos finalizados del cliente para mantener continuidad con lo que ya funcionó, sin copiar ideas anteriores." : "";
  const persona = input.buyerPersonaContext ? ` Enfocar la idea considerando este buyer persona: ${input.buyerPersonaContext}.` : "";

  return `Crear un ${piece}${format}${platforms} para ${client}, tomando como base esta idea: ${input.creativeIdea}.${market}${learning}${persona} La pieza debe iniciar con un momento natural y fácil de entender que introduzca la situación desde la experiencia de una persona real, evitando que se sienta como un anuncio rígido. En el desarrollo, mostrar los elementos más importantes de la idea con acciones concretas, cambios de plano y detalles visuales que ayuden a que el equipo de producción o edición sepa exactamente qué capturar. El tono debe sentirse estratégico, cercano y profesional, con criterio de content manager senior para que la pieza conecte con la audiencia real del cliente.${objective}${keyMessage} ${cta}`.replace(/\s+/g, " ").trim();
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
      max_output_tokens: 1200
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "No se pudo perfeccionar la idea con OpenAI.";
    throw new Error(message);
  }

  const outputText = typeof payload?.output_text === "string"
    ? payload.output_text
    : Array.isArray(payload?.output)
      ? payload.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
          .map((part: any) => part?.text || part?.value || "")
          .join(" ")
      : "";

  return {
    text: outputText.replace(/\s+/g, " ").trim(),
    finishReason: payload?.status === "incomplete" ? "MAX_TOKENS" : "STOP"
  };
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
    const message = payload?.error?.message || "No se pudo perfeccionar la idea con Gemini.";
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

async function callBestAvailableModel(prompt: string) {
  try {
    return await callOpenAI(prompt);
  } catch (openAIError) {
    try {
      return await callGemini(prompt);
    } catch (geminiError) {
      const openMessage = openAIError instanceof Error ? openAIError.message : String(openAIError);
      const geminiMessage = geminiError instanceof Error ? geminiError.message : String(geminiError);
      throw new Error(`No se pudo perfeccionar la idea. OpenAI: ${openMessage}. Gemini: ${geminiMessage}`);
    }
  }
}

export async function POST(req: Request) {
  try {
    const authCheck = await requireApiPermission(req, "creador", "generate");
    if (!authCheck.ok) return authCheck.response;
    const body = await req.json();
    const clientName = normalizeText(body.clientName);
    const clientContext = normalizeText(body.clientContext);
    const successfulContext = normalizeText(body.successfulContext);
    const marketContext = normalizeText(body.marketContext);
    const buyerPersonaName = normalizeText(body.buyerPersonaName);
    const buyerPersonaContext = normalizeText(body.buyerPersonaContext);
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
- Usa entre 100 y 160 palabras.
- No cortes frases a la mitad.
- No termines con conectores como: con, desde, para, que, donde, iniciando, muestra.
- La última oración debe ser un cierre completo y accionable.
- No generes copy final ni guion palabra por palabra; solo una instrucción creativa clara.
- No copies literalmente solicitudes finalizadas; úsalas solo como aprendizaje de tono, estructura y ángulos que han funcionado.`;

    const prompt = `Actúa como un Content Manager senior profesional con expertise en creación de contenido para redes sociales, estrategia creativa, UGC, contenido inmobiliario/comercial y adaptación regional de mensajes.

Tu tarea es perfeccionar únicamente el campo IDEA CREATIVA de una solicitud de contenido.

Objetivo del botón:
- NO generar copy final.
- NO resumir la idea.
- NO responder con una frase poética o incompleta.
- Sí convertir la idea base en una instrucción clara, accionable y útil para producción, diseño o audiovisual.
- Sí analizar el contexto del cliente, su alcance geográfico, región, ciudad y oferta para que la idea se sienta realista para su mercado.
- Sí revisar el historial de solicitudes finalizadas del cliente para inferir qué tipo de enfoque, tono o estructura ya se ha usado/funcionado, sin repetirlo literalmente.
- Sí adaptar la idea al buyer persona elegido; si dice sin enfoque particular, usar el contexto general sin forzar segmentación.

${outputRules}

Contenido esperado:
- Concepto central.
- Cómo inicia la pieza.
- Qué se muestra en el desarrollo.
- Tono visual/narrativo.
- Adaptación al mercado/región del cliente.
- Cierre sugerido.

Criterios de estilo:
- Si es UGC, debe sonar natural, como contenido grabado por una persona real, no como anuncio corporativo.
- Si es reel/video, describe recorrido, planos o momentos clave, sin escribir un guion rígido palabra por palabra.
- Si el cliente es regional o local, aterriza la idea al contexto de su ciudad o región sin usar clichés forzados.
- Mantén la intención original del usuario y no inventes datos duros del cliente.

Datos del cliente:
Cliente: ${clientName || "Sin cliente"}
Contexto estratégico del cliente: ${clientContext || "Sin contexto adicional"}
Contexto de alcance/mercado: ${marketContext || "Sin alcance o región definida"}
Historial resumido de solicitudes finalizadas del cliente: ${successfulContext || "Sin historial finalizado disponible"}

Buyer persona elegido: ${buyerPersonaName || "Sin enfoque particular"}
Contexto del buyer persona: ${buyerPersonaContext || "Sin enfoque particular"}

Datos de la solicitud actual:
Tipo de pieza: ${contentType || "Sin tipo"}
Objetivo: ${objective || "Sin objetivo"}
Plataformas: ${platforms || "Sin plataformas"}
Formato visual: ${visualFormat || "Sin formato"}
Mensaje clave: ${keyMessage || "Sin mensaje clave"}
CTA: ${cta || "Sin CTA"}
Idea creativa actual: ${creativeIdea}`;

    let result = await callBestAvailableModel(prompt);
    let improved = result.text;

    if (result.finishReason === "MAX_TOKENS" || looksTooWeakOrIncomplete(improved)) {
      result = await callBestAvailableModel(`${prompt}\n\nLa respuesta anterior quedó cortada o demasiado corta. Rehazla completa en exactamente 5 oraciones, entre 100 y 160 palabras, terminando con una oración completa.`);
      improved = result.text;
    }

    if (result.finishReason === "MAX_TOKENS" || looksTooWeakOrIncomplete(improved)) {
      improved = buildSafeFallbackIdea({ clientName, contentType, platforms, visualFormat, creativeIdea, objective, keyMessage, cta, marketContext, successfulContext, buyerPersonaName, buyerPersonaContext });
    }

    return NextResponse.json({ creativeIdea: improved || creativeIdea });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo perfeccionar la idea.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
