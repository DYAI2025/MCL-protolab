import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createAssetRegistry } from './asset-registry.ts';

const registry = JSON.parse(readFileSync('assets/registry/assets.json', 'utf8'));

describe('createAssetRegistry', () => {
  it('resolves a registered id to its entry', () => {
    const r = createAssetRegistry(registry.assets);
    expect(r.resolve('character.hero.placeholder').kind).toBe('character');
  });

  it('falls back through fallback_asset_id when an entry is missing', () => {
    const r = createAssetRegistry([
      { asset_id: 'a', kind: 'prop', path: 'x', format: 'primitive', status: 'placeholder', version: '0.1.0', source: 's', license: 'l', provenance: 'p', fallback_asset_id: 'b' },
      { asset_id: 'b', kind: 'prop', path: 'y', format: 'primitive', status: 'placeholder', version: '0.1.0', source: 's', license: 'l', provenance: 'p', fallback_asset_id: null },
    ]);
    expect(r.resolveOrFallback('a').asset_id).toBe('a');
    expect(r.resolveOrFallback('missing', 'a').asset_id).toBe('a');
  });

  it('throws with the known-ids list rather than returning undefined', () => {
    const r = createAssetRegistry(registry.assets);
    expect(() => r.resolve('nope')).toThrow(/nope/);
  });

  it('detects a fallback cycle instead of hanging', () => {
    const r = createAssetRegistry([
      { asset_id: 'a', kind: 'prop', path: 'x', format: 'primitive', status: 'placeholder', version: '0.1.0', source: 's', license: 'l', provenance: 'p', fallback_asset_id: 'b' },
      { asset_id: 'b', kind: 'prop', path: 'y', format: 'primitive', status: 'placeholder', version: '0.1.0', source: 's', license: 'l', provenance: 'p', fallback_asset_id: 'a' },
    ]);
    expect(() => r.resolveOrFallback('missing', 'a')).not.toThrow();
  });

  it('every registry entry declares a resolvable fallback or null', () => {
    const ids = new Set(registry.assets.map((a: { asset_id: string }) => a.asset_id));
    for (const a of registry.assets) {
      if (a.fallback_asset_id !== null) expect(ids.has(a.fallback_asset_id)).toBe(true);
    }
  });
});
