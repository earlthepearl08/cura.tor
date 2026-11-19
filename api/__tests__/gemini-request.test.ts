import { describe, it, expect } from 'vitest';
import { sanitizeGeminiRequest, MAX_OUTPUT_TOKENS, TEXT_ONLY_MAX_OUTPUT_TOKENS, TEXT_ONLY_MAX_PROMPT_CHARS } from '../_lib/geminiRequest';

const img = { inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } };
const ok = (extra: Record<string, unknown> = {}) => ({
  contents: [{ parts: [{ text: 'Parse this card' }, img] }],
  generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT' }, ...extra },
});

describe('sanitizeGeminiRequest', () => {
  it('accepts the shape the app sends and forces a single user turn', () => {
    const r = sanitizeGeminiRequest(ok());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.contents).toEqual([{ role: 'user', parts: [{ text: 'Parse this card' }, img] }]);
    expect(r.body.generationConfig).toMatchObject({ temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' });
  });

  it('clamps maxOutputTokens and temperature', () => {
    const r = sanitizeGeminiRequest(ok({ maxOutputTokens: 1_000_000, temperature: 5 }));
    expect(r.ok && r.body.generationConfig.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS);
    expect(r.ok && r.body.generationConfig.temperature).toBe(1);
  });

  it('drops fields outside the allowlist (tools, thinking, safety overrides)', () => {
    const r = sanitizeGeminiRequest({ ...ok(), generationConfig: { ...ok().generationConfig, tools: [{}], candidateCount: 8 } as any });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.generationConfig).not.toHaveProperty('tools');
    expect(r.body.generationConfig).not.toHaveProperty('candidateCount');
  });

  it('allows text-only Reparse but caps prompt size and output tokens', () => {
    const r = sanitizeGeminiRequest({ contents: [{ parts: [{ text: 'Parse this OCR text' }] }], generationConfig: { maxOutputTokens: 8192 } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.generationConfig.maxOutputTokens).toBe(TEXT_ONLY_MAX_OUTPUT_TOKENS);
      expect(r.body.contents).toEqual([{ role: 'user', parts: [{ text: 'Parse this OCR text' }] }]);
    }
    expect(sanitizeGeminiRequest({ contents: [{ parts: [{ text: 'x'.repeat(TEXT_ONLY_MAX_PROMPT_CHARS + 1) }] }] }).ok).toBe(false);
    expect(sanitizeGeminiRequest({ contents: [{ parts: [img] }] }).ok).toBe(false);
  });

  it('rejects multi-turn conversations', () => {
    const c = ok().contents[0];
    expect(sanitizeGeminiRequest({ contents: [c, c] }).ok).toBe(false);
    expect(sanitizeGeminiRequest({ contents: [{ role: 'model', parts: c.parts }] }).ok).toBe(false);
  });

  it('rejects extra images, unknown part types and non-image mimes', () => {
    expect(sanitizeGeminiRequest({ contents: [{ parts: [{ text: 'x' }, img, img] }] }).ok).toBe(false);
    expect(sanitizeGeminiRequest({ contents: [{ parts: [{ text: 'x' }, { fileData: { fileUri: 'gs://x' } }] }] }).ok).toBe(false);
    expect(sanitizeGeminiRequest({ contents: [{ parts: [{ text: 'x' }, { inline_data: { mime_type: 'application/pdf', data: 'AA' } }] }] }).ok).toBe(false);
  });

  it('rejects oversized prompts', () => {
    expect(sanitizeGeminiRequest({ contents: [{ parts: [{ text: 'x'.repeat(50_000) }, img] }] }).ok).toBe(false);
  });
});
