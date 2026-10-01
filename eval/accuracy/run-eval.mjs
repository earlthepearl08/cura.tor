#!/usr/bin/env node
/**
 * Cura.Tor accuracy golden-set runner.
 *
 * Usage:
 *   node eval/accuracy/run-eval.mjs              # mock mode (default, no API key)
 *   node eval/accuracy/run-eval.mjs --live       # call Gemini when image.* present
 *   npm run eval:accuracy
 *   npm run eval:accuracy:live
 *
 * Exit code 0 always after a successful run report; use --fail-under <0-1>
 * to fail CI when overall field accuracy drops below a threshold.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateCardScores, scoreContact, scoreLogSheet } from './lib/score.mjs';
import { callGeminiVision } from './lib/gemini-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const FIXTURES = path.join(ROOT, 'fixtures');
const MOCKS = path.join(ROOT, 'mocks');
const RESULTS = path.join(ROOT, 'results');

function parseArgs(argv) {
  const opts = { live: false, failUnder: null, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') opts.live = true;
    else if (a === '--fail-under') opts.failUnder = Number(argv[++i]);
    else if (a === '--only') opts.only = argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

function findImage(dir) {
  for (const name of ['image.jpg', 'image.jpeg', 'image.png', 'image.webp']) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function listFixtureDirs(kind) {
  const base = path.join(FIXTURES, kind);
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      id: d.name,
      kind: kind === 'cards' ? 'card' : 'log-sheet',
      dir: path.join(base, d.name),
    }));
}

function loadExpected(fixture) {
  const expectedPath = path.join(fixture.dir, 'expected.json');
  if (!fs.existsSync(expectedPath)) {
    throw new Error(`Missing expected.json in ${fixture.dir}`);
  }
  return JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
}

function loadMock(fixture) {
  const mockPath = path.join(MOCKS, `${fixture.id}.json`);
  if (!fs.existsSync(mockPath)) {
    throw new Error(`Missing mock ${mockPath} (required when not in --live or no image)`);
  }
  return JSON.parse(fs.readFileSync(mockPath, 'utf8'));
}

async function predict(fixture, opts) {
  const imagePath = findImage(fixture.dir);
  if (opts.live && imagePath) {
    return {
      mode: 'live',
      entries: await callGeminiVision({
        imagePath,
        kind: fixture.kind === 'log-sheet' ? 'log-sheet' : 'card',
      }),
    };
  }
  if (opts.live && !imagePath) {
    console.warn(`  [warn] ${fixture.id}: --live but no image.* — falling back to mock`);
  }
  return { mode: 'mock', entries: loadMock(fixture) };
}

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage: node eval/accuracy/run-eval.mjs [--live] [--fail-under 0.8] [--only fixture-id]`);
    process.exit(0);
  }

  let fixtures = [...listFixtureDirs('cards'), ...listFixtureDirs('log-sheets')];
  if (opts.only) fixtures = fixtures.filter((f) => f.id === opts.only);
  if (fixtures.length === 0) {
    console.error('No fixtures found under eval/accuracy/fixtures/');
    process.exit(1);
  }

  console.log(`Cura.Tor accuracy eval — ${opts.live ? 'LIVE (Gemini)' : 'MOCK'} mode`);
  console.log(`Fixtures: ${fixtures.length}\n`);

  const cardScores = [];
  const sheetResults = [];
  const details = [];

  for (const fixture of fixtures) {
    process.stdout.write(`• ${fixture.id} (${fixture.kind})… `);
    try {
      const expected = loadExpected(fixture);
      const { mode, entries } = await predict(fixture, opts);

      if (fixture.kind === 'card') {
        const expectedContact = expected.entries ? expected.entries[0] : expected;
        const predicted = entries[0] || {};
        const score = scoreContact(expectedContact, predicted);
        cardScores.push(score);
        details.push({ id: fixture.id, kind: 'card', mode, score });
        console.log(`${mode} — field accuracy ${pct(score.fieldAccuracy)} (${score.hits}/${score.total})`);
      } else {
        const expectedEntries = expected.entries || expected;
        const sheetScore = scoreLogSheet(expectedEntries, entries);
        sheetResults.push(sheetScore);
        details.push({ id: fixture.id, kind: 'log-sheet', mode, score: sheetScore });
        console.log(
          `${mode} — avg row field accuracy ${pct(sheetScore.avgFieldAccuracy)} ` +
            `(${sheetScore.predictedCount} pred / ${sheetScore.expectedCount} exp` +
            (sheetScore.extraPredicted ? `, +${sheetScore.extraPredicted} extra` : '') +
            `)`
        );
      }
    } catch (err) {
      console.log('ERROR');
      console.error(`  ${err.message || err}`);
      details.push({ id: fixture.id, kind: fixture.kind, error: String(err.message || err) });
    }
  }

  const cardAgg = aggregateCardScores(cardScores);
  const sheetAvg =
    sheetResults.length === 0
      ? null
      : sheetResults.reduce((s, r) => s + r.avgFieldAccuracy, 0) / sheetResults.length;

  console.log('\n── Summary ──');
  console.log(`Cards (${cardAgg.fixtures}): overall field accuracy ${pct(cardAgg.overallFieldAccuracy)}`);
  if (cardAgg.fixtures) {
    for (const [field, value] of Object.entries(cardAgg.perField)) {
      if (value == null) continue;
      console.log(`  ${field.padEnd(10)} ${pct(value)}`);
    }
  }
  if (sheetAvg != null) {
    console.log(`Log sheets (${sheetResults.length}): avg row field accuracy ${pct(sheetAvg)}`);
  }

  const targetCards = 30;
  const targetSheets = 10;
  const cardCount = listFixtureDirs('cards').length;
  const sheetCount = listFixtureDirs('log-sheets').length;
  console.log(
    `\nGolden-set progress: cards ${cardCount}/${targetCards}, log sheets ${sheetCount}/${targetSheets}`
  );
  if (cardCount < targetCards || sheetCount < targetSheets) {
    console.log('  → See eval/accuracy/README.md for how to add fixtures.');
  }

  fs.mkdirSync(RESULTS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(RESULTS, `report-${stamp}.json`);
  const report = {
    generatedAt: new Date().toISOString(),
    mode: opts.live ? 'live' : 'mock',
    progress: { cards: cardCount, targetCards, logSheets: sheetCount, targetSheets },
    cards: cardAgg,
    logSheets: { fixtures: sheetResults.length, avgFieldAccuracy: sheetAvg },
    details,
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${path.relative(process.cwd(), outPath)}`);

  if (opts.failUnder != null && !Number.isNaN(opts.failUnder)) {
    const overall =
      cardAgg.fixtures > 0
        ? cardAgg.overallFieldAccuracy
        : sheetAvg != null
          ? sheetAvg
          : 0;
    if (overall < opts.failUnder) {
      console.error(`FAIL: overall ${pct(overall)} < fail-under ${pct(opts.failUnder)}`);
      process.exit(2);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
