import { NextResponse } from "next/server";

export const maxDuration = 60;

type BuyerPersona = {
  id?: string;
  name: string;
  description: string;
  pains?: string;
  desires?: string;
  contentAngles?: string;
};

function normalizeUrl(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function cleanText(value: string) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
  const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1]
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i)?.[1]
    || "";
  return { title: cleanText(title), description: cleanText(description) };
}

function getRelevantLinks(html: string, baseUrl: string) {
  const base = new URL(baseUrl);
  const matches = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
  const candidates: string[] = [];
  const keywords = /(nosotros|about|quienes|quiénes|servicios|services|productos|products|desarrollos|proyectos|menu|menú|contacto|contact|ubicacion|ubicación|catalogo|catálogo|experiencias|planes|paquetes|inmuebles|propiedades|casas|departamentos)/i;

  for (const match of matches) {
    const href = match[1] || "";
    const label = cleanText(match[2] || "");
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) continue;
    try {
      const url = new URL(href, base.href);
      if (url.origin !== base.origin) continue;
      url.hash = "";
      const full = url.toString();
      if (full === base.href) continue;
      if (keywords.test(full) || keywords.test(label)) candidates.push(full);
    } catch {}
  }

  return Array.from(new Set(candidates)).slice(0, 5);
}

async function fetchPage(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "BUST-Content-OS/1.0 (+https://bustcontentos.com)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    const html = await response.text();
    return { ok: response.ok, url: response.url || url, html };
  } finally {
    clearTimeout(timer);
  }
}

function safeJsonParse(text: string) {
  const cleaned = String(text || "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error("La IA no devolvió JSON válido.");
}

function sanitizeArray(value: unknown) {
  if (Array.isArray(value)) return value.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 12);
  if (typeof value === "string") return value.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 12);
  return [];
}

function sanitizePersonas(value: unknown): BuyerPersona[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map((item: any, index) => ({
    id: item?.id || `persona-${index + 1}`,
    name: String(item?.name || item?.nombre || `Buyer persona ${index + 1}`).trim(),
    description: String(item?.description || item?.descripcion || item?.summary || "").trim(),
    pains: String(item?.pains || item?.painPoints || item?.dolores || "").trim(),
    desires: String(item?.desires || item?.motivations || item?.deseos || "").trim(),
    contentAngles: String(item?.contentAngles || item?.angulos || item?.contentIdeas || "").trim()
  })).filter((p) => p.name || p.description);
}

async function callOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Falta configurar OPENAI_API_KEY en Vercel.");
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
      max_output_tokens: 3000
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "No se pudo analizar el sitio con OpenAI.");
  return typeof payload?.output_text === "string"
    ? payload.output_text
    : Array.isArray(payload?.output)
      ? payload.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
          .map((part: any) => part?.text || part?.value || "")
          .join(" ")
      : "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const website = normalizeUrl(body.website);
    const currentClient = body.currentClient || {};
    if (!website) return NextResponse.json({ error: "Agrega el sitio web del cliente." }, { status: 400 });

    const home = await fetchPage(website);
    if (!home.ok && !home.html) return NextResponse.json({ error: "No se pudo leer el sitio web." }, { status: 422 });

    const links = getRelevantLinks(home.html, home.url);
    const pages = [{ url: home.url, html: home.html }];
    for (const link of links) {
      try {
        const page = await fetchPage(link);
        if (page.html) pages.push({ url: page.url, html: page.html });
      } catch {}
    }

    const scraped = pages.map((page, index) => {
      const meta = extractMeta(page.html);
      const text = cleanText(page.html).slice(0, index === 0 ? 9000 : 4000);
      return `URL: ${page.url}\nTITLE: ${meta.title}\nDESCRIPTION: ${meta.description}\nTEXT: ${text}`;
    }).join("\n\n---\n\n").slice(0, 26000);

    const prompt = `Actúa como un estratega senior de contenido, planner y content manager para una agencia de marketing en México.

Tu tarea es analizar el sitio web de un cliente y devolver un JSON que ayude a crear su ficha en BUST Content OS. Usa el sitio como fuente principal y complementa con los datos previamente capturados si existen. No inventes datos duros que el sitio no sustente; cuando tengas incertidumbre, redacta como inferencia estratégica.

Devuelve SOLO JSON válido con esta estructura exacta:
{
  "name": "",
  "industry": "",
  "brandDescription": "",
  "tone": "",
  "brandPersonality": "",
  "visualStyle": [""],
  "colors": [""],
  "typography": "",
  "dos": [""],
  "donts": [""],
  "marketScope": "Local | Regional | Nacional | Internacional",
  "marketRegion": "",
  "primaryCity": "",
  "serviceArea": "",
  "offerSummary": "",
  "valueProposition": "",
  "localAudienceContext": "",
  "contentPillars": "",
  "customerPainPoints": [""],
  "contentAngles": [""],
  "buyerPersonas": [
    {"name":"", "description":"", "pains":"", "desires":"", "contentAngles":""}
  ],
  "recommendedPlatforms": ["Instagram", "Facebook", "TikTok"],
  "analysisNotes": ""
}

Reglas:
- Crea 3 o 4 buyer personas útiles para crear contenido, no perfiles genéricos.
- Cada buyer persona debe tener un nombre de trabajo claro, por ejemplo: "Familia que busca casa lista", "Inversionista patrimonial", "Comprador primerizo", "Turista explorador".
- Cada buyer persona debe explicar a quién le habla la marca, qué le duele, qué desea y qué ángulos de contenido podrían funcionarle.
- Identifica si el cliente parece local, regional, nacional o internacional y aterrízalo a ciudad/región cuando sea posible.
- En marcas locales/regionales de México, adapta lenguaje y contexto al mercado real sin clichés.
- contentPillars debe ser un texto práctico con 4 a 6 pilares separados por comas.
- dos y donts deben orientar al equipo creativo.
- No uses bullets en strings largos; solo arrays donde se pide array.

Datos previos del cliente:
${JSON.stringify(currentClient, null, 2)}

Contenido leído del sitio:
${scraped}`;

    const output = await callOpenAI(prompt);
    const json = safeJsonParse(output);

    const result = {
      name: String(json.name || currentClient.name || "").trim(),
      industry: String(json.industry || currentClient.industry || "").trim(),
      brandDescription: String(json.brandDescription || "").trim(),
      tone: String(json.tone || "").trim(),
      brandPersonality: String(json.brandPersonality || "").trim(),
      visualStyle: sanitizeArray(json.visualStyle),
      colors: sanitizeArray(json.colors),
      typography: String(json.typography || "").trim(),
      dos: sanitizeArray(json.dos),
      donts: sanitizeArray(json.donts),
      marketScope: String(json.marketScope || "").trim(),
      marketRegion: String(json.marketRegion || "").trim(),
      primaryCity: String(json.primaryCity || "").trim(),
      serviceArea: String(json.serviceArea || "").trim(),
      offerSummary: String(json.offerSummary || "").trim(),
      valueProposition: String(json.valueProposition || "").trim(),
      localAudienceContext: String(json.localAudienceContext || "").trim(),
      contentPillars: String(json.contentPillars || "").trim(),
      customerPainPoints: sanitizeArray(json.customerPainPoints),
      contentAngles: sanitizeArray(json.contentAngles),
      buyerPersonas: sanitizePersonas(json.buyerPersonas),
      recommendedPlatforms: sanitizeArray(json.recommendedPlatforms),
      analysisNotes: String(json.analysisNotes || "").trim(),
      website: home.url || website,
      pagesRead: pages.map((p) => p.url)
    };

    return NextResponse.json({ context: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo analizar el sitio web.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
