export type BuildPromptInput = {
  clientName?: string;
  clientIndustry?: string;
  format?: string;
  goal?: string;
  contentType?: string;
  mainMessage?: string;
  textBlocks?: Array<{
    id?: string;
    text?: string;
    role?: string;
    roleLabel?: string;
    priority?: string;
    priorityLabel?: string;
    instruction?: string;
    locked?: boolean;
  }>;
  copy?: {
    headline?: string;
    subheadline?: string;
    cta?: string;
    priceOrOffer?: string;
  };
  selectedEmotions?: string[];
  selectedVisualElements?: string[];
  specificInstructions?: string;
  brandBrainSnapshot?: {
    brandDescription?: string;
    tone?: string;
    colors?: string[];
    typography?: string;
    visualStyle?: string[];
    dos?: string[];
    donts?: string[];
    recommendedModels?: string[];
    importantDates?: string[];
  };
  selectedAssetsSnapshot?: Array<{
    name?: string;
    type?: string;
    category?: string;
    notes?: string;
    tags?: string[];
    fileUrl?: string;
  }>;
  requestAttachments?: Array<{
    name?: string;
    role?: string;
    notes?: string;
    fileUrl?: string;
    mimeType?: string;
  }>;
  logoOverlay?: {
    enabled?: boolean;
    assetId?: string;
    assetName?: string;
    fileUrl?: string;
    position?: string;
    size?: string;
  };
  /**
   * ai-text: the image model may render the official text blocks inside the image.
   * editable-layers: the image model must create the visual composition without text;
   * BUST It Now will place the same text blocks later as editable layers.
   */
  textRenderMode?: "ai-text" | "editable-layers" | "dual-output";
};

function formatLabel(format?: string) {
  const map: Record<string, string> = {
    "instagram-post": "Instagram post vertical 4:5",
    "instagram-story": "Instagram story 9:16",
    "square-post": "Square post 1:1",
    "reel-cover": "Reel cover vertical",
    "ad-creative": "Advertising creative",
  };
  return map[format || ""] || format || "Social media creative";
}

function goalLabel(goal?: string) {
  const map: Record<string, string> = {
    sell: "sell",
    inform: "inform",
    announce: "announce",
    position: "position the brand",
    interaction: "generate interaction",
    trust: "build trust",
  };
  return map[goal || ""] || goal || "communicate clearly";
}

function normalizeText(value?: string) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function sanitizeAttachmentNotes(notes?: string) {
  if (!notes?.trim()) {
    return "Use it as a visual reference for mood, atmosphere, composition, or product context without copying it directly.";
  }
  const normalized = normalizeText(notes);
  const mentionsWatermark =
    normalized.includes("marca de agua") ||
    normalized.includes("watermark") ||
    normalized.includes("quita marca") ||
    normalized.includes("quitar marca") ||
    normalized.includes("remove watermark");
  if (mentionsWatermark) {
    return "Use the reference only as inspiration for atmosphere and visual context. Do not copy it directly, do not reproduce watermarks, and create an original clean scene.";
  }
  return notes.trim();
}

function textBlockRoleLabel(role?: string) {
  const map: Record<string, string> = {
    headline: "main headline",
    subheadline: "secondary phrase",
    claim: "campaign claim",
    badge: "badge or sticker",
    bullet: "bullet point",
    price: "price",
    promotion: "promotion",
    cta: "call to action",
    date: "date",
    location: "location",
    disclaimer: "disclaimer",
    free: "free text",
  };
  return map[role || ""] || role || "text block";
}

function textBlockPriorityLabel(priority?: string) {
  const map: Record<string, string> = {
    high: "high priority",
    medium: "medium priority",
    low: "low priority",
  };
  return map[priority || ""] || priority || "medium priority";
}

function logoPositionLabel(position?: string) {
  const map: Record<string, string> = {
    "top-left": "top-left corner",
    "top-right": "top-right corner",
    "bottom-left": "bottom-left corner",
    "bottom-right": "bottom-right corner",
    "bottom-center": "center bottom area",
  };
  return map[position || ""] || "selected clean area";
}

function shouldRemoveLogoInstruction(rule: string) {
  const normalized = normalizeText(rule);
  const mentionsLogo = normalized.includes("logo") || normalized.includes("logotipo");
  const mentionsLogoPlacement =
    normalized.includes("integrar") ||
    normalized.includes("incluir") ||
    normalized.includes("agregar") ||
    normalized.includes("poner") ||
    normalized.includes("mostrar") ||
    normalized.includes("presencia") ||
    normalized.includes("colocar") ||
    normalized.includes("espacio") ||
    normalized.includes("reservado") ||
    normalized.includes("overlay");
  return mentionsLogo && mentionsLogoPlacement;
}


type SelectedAssetSnapshot = NonNullable<BuildPromptInput["selectedAssetsSnapshot"]>[number];

function isFontAssetSnapshot(asset: SelectedAssetSnapshot) {
  const value = `${asset?.name || ""} ${asset?.type || ""} ${asset?.category || ""} ${(asset?.tags || []).join(" ")}`.toLowerCase();
  const fileUrl = String(asset?.fileUrl || "").toLowerCase();
  return value.includes("tipografia") || value.includes("tipografía") || value.includes("fuente") || value.includes("font") || /\.(otf|ttf|woff2?|eot)(\?|$)/i.test(fileUrl);
}

function cleanRules(rules?: string[], removeLogoInstructions = false) {
  const clean = (rules || [])
    .map((rule) => rule.trim())
    .filter(Boolean)
    .filter((rule) => !removeLogoInstructions || !shouldRemoveLogoInstruction(rule));
  return Array.from(new Set(clean));
}

function getOfficialTextBlocks(data: BuildPromptInput) {
  return (data.textBlocks || [])
    .map((block) => ({
      text: block.text?.trim() || "",
      role: block.role || "free",
      roleLabel: block.roleLabel || textBlockRoleLabel(block.role),
      priorityLabel: block.priorityLabel || textBlockPriorityLabel(block.priority),
      instruction: block.instruction?.trim() || "",
      locked: block.locked !== false,
    }))
    .filter((block) => block.text.length > 0);
}

function blockHasRole(blocks: ReturnType<typeof getOfficialTextBlocks>, roles: string[]) {
  return blocks.some((block) => roles.includes(block.role));
}

function buildTextBlocksText(data: BuildPromptInput, textRenderMode: "ai-text" | "editable-layers" = "ai-text") {
  const blocks = getOfficialTextBlocks(data);

  if (blocks.length > 0) {
    return blocks.map((block, index) => {
      const instruction = block.instruction ? ` Specific instruction: ${block.instruction}` : "";
      if (textRenderMode === "editable-layers") {
        return `${index + 1}. Editable layer text: "${block.text}" | Visual role: ${block.roleLabel} | Priority: ${block.priorityLabel}. DO NOT render this text, any letters, fake placeholder words, CTA, dates, prices, or typography names inside the generated image. Use this layer only to understand the communication intent, emotional weight, and art-direction context. Do not create a specific box, button, label, frame, bullet, or reserved placeholder area for this layer.${instruction}`;
      }
      const exactRule = block.locked
        ? "Use this text EXACTLY as written. Do not rewrite, translate, correct, abbreviate, change capitalization, fix spelling, or add words to it."
        : "You may adapt hierarchy and placement, but keep the meaning aligned with the text.";
      return `${index + 1}. Text: "${block.text}" | Visual role: ${block.roleLabel} | Priority: ${block.priorityLabel}. ${exactRule}${instruction}`;
    }).join("\n");
  }

  const legacyBlocks = [
    data.copy?.headline ? `1. Text: "${data.copy.headline}" | Visual role: main headline | Priority: high priority. Use this text EXACTLY as written.` : "",
    data.copy?.subheadline ? `2. Text: "${data.copy.subheadline}" | Visual role: secondary phrase | Priority: medium priority. Use this text EXACTLY as written.` : "",
    data.copy?.priceOrOffer ? `3. Text: "${data.copy.priceOrOffer}" | Visual role: price or promotion | Priority: high priority. Use this text EXACTLY as written.` : "",
    data.copy?.cta ? `4. Text: "${data.copy.cta}" | Visual role: call to action | Priority: low priority. Use this text EXACTLY as written.` : "",
  ].filter(Boolean);

  if (textRenderMode === "editable-layers") {
    return legacyBlocks.length
      ? legacyBlocks.join("\n").replace(/Text:/g, "Editable layer text:") + "\nDo NOT render these texts inside the generated image. They will be placed later as editable layers by BUST It Now."
      : "No editable text layers were specified.";
  }
  return legacyBlocks.length ? legacyBlocks.join("\n") : "No required in-image text blocks were specified.";
}

function buildVisualElementsText(data: BuildPromptInput, textRenderMode: "ai-text" | "editable-layers" = "ai-text") {
  const blocks = getOfficialTextBlocks(data);
  const omitted: string[] = [];
  const filteredElements = (data.selectedVisualElements || []).filter((element) => {
    const normalized = normalizeText(element);
    if (normalized.includes("logo")) {
      omitted.push(element);
      return false;
    }
    if (textRenderMode === "editable-layers" && (normalized === "fecha" || normalized === "precio" || normalized === "cta" || normalized.includes("call to action") || normalized.includes("texto"))) {
      omitted.push(element);
      return false;
    }
    if (normalized === "fecha" && !blockHasRole(blocks, ["date"])) {
      omitted.push(element);
      return false;
    }
    if (normalized === "precio" && !blockHasRole(blocks, ["price", "promotion"])) {
      omitted.push(element);
      return false;
    }
    if (normalized === "cta" && !blockHasRole(blocks, ["cta"])) {
      omitted.push(element);
      return false;
    }
    return true;
  });

  const baseText = filteredElements.length ? filteredElements.join(", ") : "Not specified";
  if (!omitted.length) return baseText;
  return `${baseText}\n- Do NOT include these text-dependent elements because no official text block was provided for them: ${omitted.join(", ")}. Do not invent dates, prices, CTAs, logos, brand marks, or extra text.`;
}

export function buildGenerationPrompt(data: BuildPromptInput) {
  const logoOverlayEnabled = data.logoOverlay?.enabled === true;
  const textRenderMode: "ai-text" | "editable-layers" = data.textRenderMode === "editable-layers" ? "editable-layers" : "ai-text";
  const requestAttachmentsText = data.requestAttachments?.length
    ? data.requestAttachments.map((attachment, index) => {
        const attachmentName = attachment.name || "Specific attachment for this piece";
        const attachmentRole = attachment.role || "specific reference";
        const attachmentNotes = sanitizeAttachmentNotes(attachment.notes);
        return `${index + 1}. ${attachmentName} (${attachmentRole}). This exact attached image is part of the brief and must be considered as a direct visual reference. Instruction: ${attachmentNotes || "Follow this attachment closely according to its role."}`;
      }).join("\n")
    : "No specific request attachments.";

  const logoOverlayText = logoOverlayEnabled
    ? `The official logo must NOT be generated by the AI. Generate the design without any logo, brand mark, monogram, top-center brand lockup, fake emblem, or brand-name logo. Leave clean visual space in the ${logoPositionLabel(data.logoOverlay?.position)}. The system will place the real official logo after image generation as a fixed overlay layer.`
    : "No logo overlay requested. Do NOT include any logo, brand mark, monogram, top-center brand lockup, big brand initial, fake emblem, or brand-name logo. Use the brand only through colors, mood, layout, and visual style.";

  const visualAssets = (data.selectedAssetsSnapshot || []).filter((asset) => !isFontAssetSnapshot(asset));
  const assetsText = visualAssets.length
    ? visualAssets.map((asset, index) => {
        const tags = asset.tags?.length ? ` Tags: ${asset.tags.join(", ")}.` : "";
        const notes = asset.notes ? ` Notes: ${sanitizeAttachmentNotes(asset.notes)}.` : "";
        return `${index + 1}. ${asset.name || "Asset"} (${asset.type || "asset"}${asset.category ? ` / ${asset.category}` : ""}).${tags}${notes}`;
      }).join("\n")
    : "No general brand visual assets selected. Font files are intentionally excluded from image prompts and are used only by the editable text editor.";

  const textBlocksText = buildTextBlocksText(data, textRenderMode);
  const visualElementsText = buildVisualElementsText(data, textRenderMode);
  const cleanDos = cleanRules(data.brandBrainSnapshot?.dos, true);
  const cleanDonts = cleanRules(data.brandBrainSnapshot?.donts, false);
  const dos = cleanDos.length ? cleanDos.join("; ") : "Keep the communication aligned with the brand and make the main message easy to read.";
  const donts = cleanDonts.length ? cleanDonts.join("; ") : "Avoid visual decisions that conflict with the brand.";

  return `
Create a high-quality branded social media image that feels professionally art-directed, polished, and ready for a real commercial campaign.

PROJECT CONTEXT
- Brand: ${data.clientName || "Unknown brand"}
- Industry: ${data.clientIndustry || "Unknown industry"}
- Format: ${formatLabel(data.format)}
- Objective: ${goalLabel(data.goal)}
- Content type: ${data.contentType || "general content"}

MAIN COMMUNICATION
${textRenderMode === "editable-layers" ? `- Strategic message for composition only: ${data.mainMessage || ""}
- IMPORTANT: Do not render, write, imitate, trace, or approximate any words from this message inside the image. Use it only to understand the scene, mood, subject matter, commercial intention, and overall art direction.` : `- Main message: ${data.mainMessage || ""}`}

${textRenderMode === "editable-layers" ? "TEXT LAYERS FOR THE POST-EDITOR" : "TEXT BLOCKS TO USE IN THE DESIGN"}
${textRenderMode === "editable-layers" ? "These are the official text layers for this piece. The generated image must NOT include readable text. Use these layers only to understand what the visual must communicate. Do not reserve exact spaces, boxes, buttons, bullets, frames, or forced containers for each layer; BUST It Now will place editable text later with real fonts." : "These are the official text blocks for this piece. Treat them as flexible design elements, not as a fixed template. Arrange them dynamically according to role, priority, and visual hierarchy."}
${textBlocksText}

VISUAL / EMOTIONAL DIRECTION
- Must transmit: ${data.selectedEmotions?.join(", ") || "Not specified"}
- Must include visually: ${visualElementsText}
- Extra instructions: ${data.specificInstructions || "None"}

SPECIFIC ATTACHMENTS FOR THIS PIECE
Use the attached image files as direct references for this exact brief. If the attachment role is product, dish, person, promotion, background, or visual reference, preserve the relevant subject, proportions, colors, and context as much as the generation model allows. Do not ignore these attachments when the brief is reused. Do not copy protected marks, watermarks, or source-image text directly.
${requestAttachmentsText}

POST-GENERATION LOGO OVERLAY
${logoOverlayText}

BRAND BRAIN
- Brand description: ${data.brandBrainSnapshot?.brandDescription || "Not specified"}
- Tone: ${data.brandBrainSnapshot?.tone || "Not specified"}
- Colors: ${data.brandBrainSnapshot?.colors?.join(", ") || "Not specified"}
- Typography: official font names/files from Brand Brain are intentionally NOT sent as visible text instructions. Never render the typography field as a headline, label, signature, brand word, or any visible copy. Use it only as an invisible style reference when text rendering is enabled; the real fonts are applied later by the editor.
- Important client dates: ${data.brandBrainSnapshot?.importantDates?.join(", ") || "Not specified"}
- Visual style: ${data.brandBrainSnapshot?.visualStyle?.join(", ") || "Not specified"}

DO
- ${dos}

DON'T
- ${donts}

AVAILABLE BRAND ASSETS
These are general client assets selected to inform the visual identity, style, composition, and brand universe of the design.
${assetsText}

ART DIRECTION RULES
- Make the piece feel designed by a strong advertising art director, not like a generic template.
- Create visual depth, deliberate hierarchy, premium finishing, and an intentional composition.
- Use strong focal points, background treatment, subtle lighting, shadows, and graphic systems that support the message.
- If a specific product, dish, or object attachment is provided, prioritize it visually and make it feel integrated into the design.
- If a visual reference contains text, treat that text as layout/style inspiration only unless it exactly matches one of the official text blocks above.
- Keep the communication instantly understandable at a glance.
- Respect the brand style, emotional tone, and commercial objective.
- Avoid random decorative clutter that does not reinforce the message.

TEXT RULES
${textRenderMode === "editable-layers" ? `- ABSOLUTE EMPTY-TEXT MODE: Do NOT place readable text, letters, numbers, fake text, placeholder copy, typography names, CTAs, dates, prices, legal disclaimers, logos, brand-name lockups, or any text-like marks inside the generated image.
- Never write generic placeholder labels such as "CTA", "CTA NOW", "SALE", "PROMO", "CLICK HERE", "TITLE", "HEADLINE", "TEXT", "DATE", "PRICE", "LOGO", "Lorem ipsum", or any invented words.
- Never write typography or font names from the Brand Brain, such as OTF/TTF font family names, as visible words in the image.
- Do not create CTA buttons, empty labels, reserved title zones, forced blank boxes, bullet containers, or artificial text areas just because the text layers include CTA, date, price, or headline roles.
- Create a polished text-free visual composition that feels natural and complete on its own, while remaining usable as a background for editable text later.
- The text layers are real content that BUST It Now will place after image generation using editable typography.
- Avoid text-like marks or gibberish. Background signs, screens, labels, or mock headlines must be removed or abstracted.
- The final image must look like a strong advertising visual without readable text, not like a layout with placeholder text areas.` : `- Use only the official text blocks listed above when placing text inside the image.
- Typography or font names from the Brand Brain are invisible style references only; never place them as headlines, titles, labels, signatures, brand words, decorative marks, or visible copy.
- Do not force every block to appear at the same size; use hierarchy based on priority.
- Do not invent extra words, numbers, dates, product names, or claims.
- Do not include a date unless there is an official text block with role date.
- Do not include a price unless there is an official text block with role price or promotion.
- Do not include a CTA unless there is an official text block with role CTA.
- Do not add any logo text, brand-name placeholder, brand-name header, monogram, or logo label.
- If a block is marked exact, it must appear exactly as written, including accents, spelling, punctuation, and capitalization.
- If text appears inside the image, it must be clean, legible, and placed with clear hierarchy.`}

BRAND SAFETY RULES
- Do not distort, rewrite, or fabricate brand names.
- Do not invent a new brand identity that contradicts the Brand Brain.
- Do not recreate logos inside the generated image.
- Do not create false product details that are not supported by the brief or attachments.

OUTPUT RULES
- Produce a finished, high-quality social media advertising image${textRenderMode === "editable-layers" ? " base without any readable text, no placeholder CTA text, and no invented copy" : ""}.
- Match the selected format and aspect ratio.
- Avoid bland stock-template aesthetics.
- Avoid clutter, low contrast, weak hierarchy, or overly flat compositions.
`.trim();
}
