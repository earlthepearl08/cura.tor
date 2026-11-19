import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Vercel Hobby rejects deployments with more than 12 serverless functions —
// the build succeeds and then fails silently at "Deploying outputs". Every
// production deploy from Oct 2 to Nov 2026 failed this way (15 functions).
// Files/dirs starting with "_" are not deployed as functions.
const LIMIT = 12;
const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function countFunctions(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...countFunctions(full));
    else if (/\.(ts|js|mjs|cjs)$/.test(name) && !/\.(test|spec)\./.test(name)) out.push(full);
  }
  return out;
}

describe('Vercel function budget', () => {
  it(`deploys at most ${LIMIT} functions from api/`, () => {
    const fns = countFunctions(API_DIR);
    expect(fns.length, fns.map(f => f.slice(API_DIR.length)).join('\n')).toBeLessThanOrEqual(LIMIT);
  });
});
