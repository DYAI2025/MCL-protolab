import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createConceptRegistry } from './creature-concepts.ts';

const profiles = readdirSync('concepts/creatures')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join('concepts/creatures', f), 'utf8')));

describe('creature concepts', () => {
  it('ships exactly the four addendum profiles', () => {
    expect(profiles.map((p) => p.id).sort()).toEqual(['flammenwolf', 'mugosh', 'veras', 'zhalm']);
  });

  it('resolves a profile by id', () => {
    expect(createConceptRegistry(profiles).get('mugosh').display_name).toBe('Mugosh');
  });

  it('every profile declares at least one source ref and one non-goal', () => {
    for (const p of profiles) {
      expect(p.source_refs.length, p.id).toBeGreaterThan(0);
      expect(p.non_goals.length, p.id).toBeGreaterThan(0);
    }
  });

  it('exposes the visual layers the gallery must be able to render', () => {
    const layers = new Set(profiles.flatMap((p) => p.visual_layers));
    for (const required of ['geometry', 'material', 'emissive', 'light']) expect(layers.has(required)).toBe(true);
  });

  it('preserves the Zhalm naming CONFLICT rather than resolving it in code', () => {
    expect(profiles.find((p) => p.id === 'zhalm')?.design_status).toBe('CONFLICT');
  });
});
