import {
  asStringArray,
  contactFields,
  normalizeEmail,
  normalizePhone,
  normalizeString,
} from './normalize.mjs';

/** Secondary fields — scored for diagnostics but not the sellability gate. */
const SECONDARY_STRING_FIELDS = ['position', 'address', 'notes'];

/** P0 accuracy proof fields (product-readiness review). */
export const PRIMARY_FIELDS = ['name', 'company', 'phone', 'email'];

const STRING_FIELDS = ['name', 'company', ...SECONDARY_STRING_FIELDS];
const ARRAY_FIELDS = ['phone', 'email'];

function stringsEqual(a, b) {
  return normalizeString(a) === normalizeString(b);
}

function phoneEqual(a, b) {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Allow truncated OCR (last 7–10 digits) without equating unrelated short stubs.
  const minLen = 7;
  if (na.length >= minLen && nb.length >= minLen) {
    return na.endsWith(nb) || nb.endsWith(na);
  }
  return false;
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

function fieldMatchSummary(fields, keys) {
  const scoredKeys = keys.filter((k) => fields[k] && !fields[k].skipped);
  const hits = scoredKeys.filter((k) => fields[k].match).length;
  const total = scoredKeys.length;
  return {
    hits,
    total,
    accuracy: total === 0 ? 1 : hits / total,
    keys: scoredKeys,
  };
}

/**
 * Score one predicted contact against one expected contact.
 * Headline metric: primaryAccuracy over name / company / phone / email.
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

  const phoneStats = setF1(expected.phone, predicted.phone, phoneEqual);
  fields.phone = {
    ...phoneStats,
    match: phoneStats.f1 >= 0.999,
    skipped: phoneStats.emptyBoth,
    expected: expected.phone,
    predicted: predicted.phone,
  };
  const emailStats = setF1(expected.email, predicted.email, emailEqual);
  fields.email = {
    ...emailStats,
    match: emailStats.f1 >= 0.999,
    skipped: emailStats.emptyBoth,
    expected: expected.email,
    predicted: predicted.email,
  };

  const all = fieldMatchSummary(fields, [...STRING_FIELDS, ...ARRAY_FIELDS]);
  const primary = fieldMatchSummary(fields, PRIMARY_FIELDS);
  const secondary = fieldMatchSummary(fields, SECONDARY_STRING_FIELDS);

  return {
    fields,
    /** @deprecated use primaryAccuracy — kept for older report consumers */
    fieldAccuracy: primary.accuracy,
    hits: primary.hits,
    total: primary.total,
    primaryAccuracy: primary.accuracy,
    primaryHits: primary.hits,
    primaryTotal: primary.total,
    secondaryAccuracy: secondary.accuracy,
    allFieldAccuracy: all.accuracy,
  };
}

/**
 * Align predicted rows to expected rows by best primary-field accuracy (greedy).
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
      if (s.primaryAccuracy > bestScore) {
        bestScore = s.primaryAccuracy;
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
        primaryAccuracy: 0,
        secondaryAccuracy: 0,
        allFieldAccuracy: 0,
        hits: 0,
        total: PRIMARY_FIELDS.length,
        primaryHits: 0,
        primaryTotal: PRIMARY_FIELDS.length,
        missing: true,
      });
    }
  }

  const extraPredicted = predicted.length - used.size;
  const avgPrimary =
    rowScores.length === 0
      ? 0
      : rowScores.reduce((sum, r) => sum + r.primaryAccuracy, 0) / rowScores.length;
  const avgAll =
    rowScores.length === 0
      ? 0
      : rowScores.reduce((sum, r) => sum + (r.allFieldAccuracy ?? r.fieldAccuracy), 0) /
        rowScores.length;

  return {
    rowScores,
    avgFieldAccuracy: avgPrimary,
    avgPrimaryAccuracy: avgPrimary,
    avgAllFieldAccuracy: avgAll,
    extraPredicted,
    expectedCount: expected.length,
    predictedCount: predicted.length,
  };
}

function aggregateByKeys(scores, keys) {
  const perField = Object.fromEntries(keys.map((k) => [k, { hits: 0, total: 0 }]));
  let hits = 0;
  let total = 0;
  for (const s of scores) {
    for (const k of keys) {
      if (!s.fields[k] || s.fields[k].skipped) continue;
      perField[k].total += 1;
      total += 1;
      if (s.fields[k].match) {
        perField[k].hits += 1;
        hits += 1;
      }
    }
  }
  return {
    accuracy: total === 0 ? 0 : hits / total,
    hits,
    total,
    perField: Object.fromEntries(
      Object.entries(perField).map(([k, v]) => [k, v.total === 0 ? null : v.hits / v.total])
    ),
  };
}

/** Aggregate macro field accuracy across contacts (cards). */
export function aggregateCardScores(scores) {
  const primary = aggregateByKeys(scores, PRIMARY_FIELDS);
  const all = aggregateByKeys(scores, [...STRING_FIELDS, ...ARRAY_FIELDS]);
  return {
    fixtures: scores.length,
    /** Headline sellability metric */
    primaryAccuracy: primary.accuracy,
    primaryPerField: primary.perField,
    overallFieldAccuracy: primary.accuracy,
    perField: all.perField,
    allFieldAccuracy: all.accuracy,
  };
}
