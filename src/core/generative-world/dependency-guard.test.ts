import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// MCL-82 AC8 / MCL-83 AC1: the generative-world core may not reach a provider,
// SDK, backend or network, and stays deterministic (no clock, no randomness).
const DIR = 'src/core/generative-world';
const sources = readdirSync(DIR).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'));

const importSpecifiers = (code: string): string[] =>
  [...code.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((match) => match[1] ?? '');

const isAllowedImport = (specifier: string): boolean =>
  specifier.startsWith('./')
  || /^\.\.\/\.\.\/\.\.\/schemas\/[a-z-]+\.schema\.json$/.test(specifier)
  || specifier === 'ajv/dist/2020.js';

describe('generative-world core boundary', () => {
  it('scans the core modules', () => {
    expect(sources.length).toBeGreaterThanOrEqual(5);
  });

  it('imports only its own modules, the contract schemas and ajv', () => {
    for (const file of sources) {
      for (const specifier of importSpecifiers(readFileSync(join(DIR, file), 'utf8'))) {
        expect(isAllowedImport(specifier), `${file} imports ${specifier}`).toBe(true);
      }
    }
  });

  it('uses no network, clock or randomness APIs', () => {
    const forbidden = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b|Date\.now|new Date\(|Math\.random|performance\.now/;
    for (const file of sources) {
      expect(readFileSync(join(DIR, file), 'utf8'), file).not.toMatch(forbidden);
    }
  });
});
