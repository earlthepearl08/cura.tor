/**
 * Server-side allowlist for /api/gemini request bodies.
 *
 * The client builds the prompt (it lives in src/services/ocr.ts), but the
 * server decides what actually reaches Google. Before this, /api/gemini
 * forwarded `contents` and `generationConfig` verbatim, so any signed-in user
 * could use the owner's Gemini key as a general-purpose LLM (multi-turn chat,
 * unbounded maxOutputTokens, tools, other models' features).
 *
 * Accepted shape (exactly what the app sends today):
 *   contents: [{ parts: [{ text }, { inline_data: { mime_type, data } }] }]
 *   or, for ContactReview "Reparse", a single bounded text part (no image)
 *   generationConfig: { temperature, maxOutputTokens, responseMimeType, responseSchema, topK, topP }
 */

export const MAX_OUTPUT_TOKENS = 8192;
export const MAX_PROMPT_CHARS = 40_000;
/** base64 chars; ~3.3 MB decoded — client compresses to 2048px JPEG, well under this. */
export const MAX_IMAGE_B64_CHARS = 4_500_000;
export const MAX_SCHEMA_CHARS = 20_000;
/**
 * Text-only requests (ContactReview "Reparse" re-runs the parser on edited OCR
 * text, no image) are allowed but tightly bounded so the endpoint can't serve
 * as a general-purpose LLM: short prompt, small output, still charged a scan.
 */
export const TEXT_ONLY_MAX_PROMPT_CHARS = 16_000;
export const TEXT_ONLY_MAX_OUTPUT_TOKENS = 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type SanitizedGemini =
  | { ok: true; body: { contents: unknown[]; generationConfig: Record<string, unknown> } }
  | { ok: false; error: string };

function clampNumber(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.min(max, Math.max(min, v));
}

export function sanitizeGeminiRequest(input: { contents?: unknown; generationConfig?: unknown }): SanitizedGemini {
  const { contents, generationConfig } = input;

  if (!Array.isArray(contents) || contents.length !== 1) {
    return { ok: false, error: 'contents must contain exactly one turn' };
  }
  const turn = contents[0] as any;
  if (!turn || typeof turn !== 'object' || !Array.isArray(turn.parts)) {
    return { ok: false, error: 'contents[0].parts must be an array' };
  }
  if (turn.role !== undefined && turn.role !== 'user') {
    return { ok: false, error: 'only a single user turn is allowed' };
  }

  let text: string | null = null;
  let image: { mime_type: string; data: string } | null = null;
  for (const part of turn.parts) {
    if (!part || typeof part !== 'object') return { ok: false, error: 'invalid part' };
    const keys = Object.keys(part);
    if (keys.length === 1 && typeof part.text === 'string') {
      if (text !== null) return { ok: false, error: 'only one text part is allowed' };
      if (part.text.length > MAX_PROMPT_CHARS) return { ok: false, error: 'prompt too long' };
      text = part.text;
      continue;
    }
    const inline = part.inline_data ?? part.inlineData;
    if (keys.length === 1 && inline && typeof inline === 'object') {
      if (image !== null) return { ok: false, error: 'only one image is allowed' };
      const mime = inline.mime_type ?? inline.mimeType;
      if (typeof mime !== 'string' || !ALLOWED_MIME.has(mime)) {
        return { ok: false, error: 'unsupported image type' };
      }
      if (typeof inline.data !== 'string' || inline.data.length === 0) {
        return { ok: false, error: 'image data missing' };
      }
      if (inline.data.length > MAX_IMAGE_B64_CHARS) return { ok: false, error: 'image too large' };
      image = { mime_type: mime, data: inline.data };
      continue;
    }
    return { ok: false, error: 'unsupported part type' };
  }
  if (text === null) {
    return { ok: false, error: 'a prompt is required' };
  }
  const textOnly = image === null;
  if (textOnly && text.length > TEXT_ONLY_MAX_PROMPT_CHARS) {
    return { ok: false, error: 'prompt too long for a text-only request' };
  }

  const gc = (generationConfig && typeof generationConfig === 'object' ? generationConfig : {}) as any;
  const out: Record<string, unknown> = {
    maxOutputTokens: clampNumber(gc.maxOutputTokens, 1, textOnly ? TEXT_ONLY_MAX_OUTPUT_TOKENS : MAX_OUTPUT_TOKENS)
      ?? (textOnly ? TEXT_ONLY_MAX_OUTPUT_TOKENS : 2048),
  };
  const temperature = clampNumber(gc.temperature, 0, 1);
  if (temperature !== undefined) out.temperature = temperature;
  const topK = clampNumber(gc.topK, 1, 64);
  if (topK !== undefined) out.topK = Math.round(topK);
  const topP = clampNumber(gc.topP, 0, 1);
  if (topP !== undefined) out.topP = topP;
  if (gc.responseMimeType !== undefined) {
    if (gc.responseMimeType !== 'application/json' && gc.responseMimeType !== 'text/plain') {
      return { ok: false, error: 'unsupported responseMimeType' };
    }
    out.responseMimeType = gc.responseMimeType;
  }
  if (gc.responseSchema !== undefined) {
    if (typeof gc.responseSchema !== 'object' || gc.responseSchema === null) {
      return { ok: false, error: 'invalid responseSchema' };
    }
    if (JSON.stringify(gc.responseSchema).length > MAX_SCHEMA_CHARS) {
      return { ok: false, error: 'responseSchema too large' };
    }
    out.responseSchema = gc.responseSchema;
  }

  return {
    ok: true,
    body: {
      contents: [{ role: 'user', parts: image ? [{ text }, { inline_data: image }] : [{ text }] }],
      generationConfig: out,
    },
  };
}
