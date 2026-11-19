import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// package.json is "type": "module", so Vercel runs api/ as native Node ESM,
// which does not guess extensions: `from './_lib/scanGuards'` crashes the
// function at load (ERR_MODULE_NOT_FOUND). Relative imports must end in .js.
const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === '__tests__' || name === 'node_modules') return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.ts$/.test(name) ? [full] : [];
  });
}

describe('api/ ESM relative imports', () => {
  it('every relative import specifies a .js extension', () => {
    const bad: string[] = [];
    for (const file of sourceFiles(API_DIR)) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
        if (!m[1].endsWith('.js')) bad.push(`${file.slice(API_DIR.length)}: ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
