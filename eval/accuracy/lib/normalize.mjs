/**
 * Field normalization for fuzzy accuracy scoring.
 * Mirrors the intent of GEMINI_CORE_RULES / smartCapitalize without importing the React OCR bundle.
 */

export function normalizeString(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizePhone(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\(fax\)/gi, '')
    .replace(/[^\d+]/g, '')
    .replace(/(?!^)\+/g, '');
}

export function normalizeEmail(value) {
  return normalizeString(value);
}

export function asStringArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

export function stripMeta(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const { _meta, confidence, rawText, ...rest } = obj;
  return rest;
}

export function contactFields(entry) {
  const clean = stripMeta(entry) || {};
  return {
    name: String(clean.name ?? ''),
    company: String(clean.company ?? ''),
    position: String(clean.position ?? ''),
    phone: asStringArray(clean.phone),
    email: asStringArray(clean.email),
    address: String(clean.address ?? ''),
    notes: String(clean.notes ?? ''),
  };
}
