import {
  asStringArray,
  contactFields,
  normalizeEmail,
  normalizePhone,
  normalizeString,
} from './normalize.mjs';

const STRING_FIELDS = ['name', 'company', 'position', 'address', 'notes'];
const ARRAY_FIELDS = ['phone', 'email'];

function stringsEqual(a, b) {
  return normalizeString(a) === normalizeString(b);
}

function phoneEqual(a, b) {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  // Allow suffix match so "+639175551234" ≈ "9175551234"
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

function emailEqual(a, b) {
  return normalizeEmail(a) === normalizeEmail(b);
}

function setF1(expectedArr, predictedArr, equalFn) {
  const expected = asStringArray(expectedArr);
  const predicted = asStringArray(predictedArr);
  if (expected.length === 0 && predicted.length === 0) {
    return { precision: 1, recall: 1, f1: 1, tp: 0, fp: 0, fn: 0, emptyBoth: true };
  }
  const matchedPred = new Set();
  let tp = 0;
  for (const exp of expected) {
    const idx = predicted.findIndex((p, i) => !matchedPred.has(i) && equalFn(exp, p));
    if (idx >= 0) {
      matchedPred.add(idx);
      tp += 1;
    }
  }
  const fp = predicted.length - tp;
  const fn = expected.length - tp;
  const precision = predicted.length === 0 ? (expected.length === 0 ? 1 : 0) : tp / predicted.length;
  const recall = expected.length === 0 ? (predicted.length === 0 ? 1 : 0) : tp / expected.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, tp, fp, fn, emptyBoth: false };
}

/**
 * Score one predicted contact against one expected contact.
 * Returns per-field match booleans + array F1 for phone/email.
 */
export function scoreContact(expectedRaw, predictedRaw) {
  const expected = contactFields(expectedRaw);
  const predicted = contactFields(predictedRaw);
  const fields = {};

  for (const key of STRING_FIELDS) {
    const expEmpty = !expected[key].trim();
    const predEmpty = !predicted[key].trim();
    const match = stringsEqual(expected[key], predicted[key]);
    fields[key] = {
      match,
      skipped: expEmpty && predEmpty,
      expected: expected[key],
      predicted: predicted[key],
    };
  }

  fields.phone = {
    ...setF1(expected.phone, predicted.phone, phoneEqual),
    match: setF1(expected.phone, predicted.phone, phoneEqual).f1 >= 0.999,
    expected: expected.phone,
    predicted: predicted.phone,
  };
  fields.email = {
    ...setF1(expected.email, predicted.email, emailEqual),
    match: setF1(expected.email, predicted.email, emailEqual).f1 >= 0.999,
    expected: expected.email,
    predicted: predicted.email,
  };

  const scoredKeys = [...STRING_FIELDS, ...ARRAY_FIELDS].filter((k) => !fields[k].skipped);
  const hits = scoredKeys.filter((k) => fields[k].match).length;
  const fieldAccuracy = scoredKeys.length === 0 ? 1 : hits / scoredKeys.length;

  return { fields, fieldAccuracy, hits, total: scoredKeys.length };
}

/**
 * Align predicted rows to expected rows by best name+company fuzzy match (greedy).
 * Used for log sheets where row order may differ slightly.
 */
export function scoreLogSheet(expectedEntries, predictedEntries) {
  const expected = expectedEntries.map(contactFields);
  const predicted = predictedEntries.map(contactFields);
  const used = new Set();
  const rowScores = [];

  for (const exp of expected) {
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < predicted.length; i++) {
      if (used.has(i)) continue;
      const s = scoreContact(exp, predicted[i]);
      if (s.fieldAccuracy > bestScore) {
        bestScore = s.fieldAccuracy;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      used.add(bestIdx);
      rowScores.push({
        expectedName: exp.name,
        predictedName: predicted[bestIdx].name,
        ...scoreContact(exp, predicted[bestIdx]),
      });
    } else {
      rowScores.push({
        expectedName: exp.name,
        predictedName: null,
        fields: {},
        fieldAccuracy: 0,
        hits: 0,
        total: 7,
        missing: true,
      });
    }
  }

  const extraPredicted = predicted.length - used.size;
  const avg =
    rowScores.length === 0
      ? 0
      : rowScores.reduce((sum, r) => sum + r.fieldAccuracy, 0) / rowScores.length;

  return { rowScores, avgFieldAccuracy: avg, extraPredicted, expectedCount: expected.length, predictedCount: predicted.length };
}

/** Aggregate macro field accuracy across contacts (cards). */
export function aggregateCardScores(scores) {
  const keys = [...STRING_FIELDS, ...ARRAY_FIELDS];
  const perField = Object.fromEntries(keys.map((k) => [k, { hits: 0, total: 0 }]));
  let hits = 0;
  let total = 0;
  for (const s of scores) {
    hits += s.hits;
    total += s.total;
    for (const k of keys) {
      if (!s.fields[k] || s.fields[k].skipped) continue;
      perField[k].total += 1;
      if (s.fields[k].match) perField[k].hits += 1;
    }
  }
  return {
    overallFieldAccuracy: total === 0 ? 0 : hits / total,
    perField: Object.fromEntries(
      Object.entries(perField).map(([k, v]) => [k, v.total === 0 ? null : v.hits / v.total])
    ),
    fixtures: scores.length,
  };
}
