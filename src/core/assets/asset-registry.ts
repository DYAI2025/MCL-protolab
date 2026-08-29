export interface AssetEntry {
  asset_id: string;
  kind: string;
  path: string;
  format: string;
  status: 'placeholder' | 'candidate' | 'approved_for_prototype';
  version: string;
  source: string;
  license: string;
  provenance: string;
  fallback_asset_id: string | null;
}

export function createAssetRegistry(entries: readonly AssetEntry[]) {
  const byId = new Map(entries.map((e) => [e.asset_id, e]));

  function resolve(id: string): AssetEntry {
    const entry = byId.get(id);
    if (!entry) throw new Error(`Unknown asset_id "${id}". Known: ${[...byId.keys()].join(', ')}`);
    return entry;
  }

  function resolveOrFallback(id: string, fallbackId?: string): AssetEntry {
    const seen = new Set<string>();
    let current: string | undefined = byId.has(id) ? id : fallbackId;
    while (current && !seen.has(current)) {
      seen.add(current);
      const entry = byId.get(current);
      if (entry) return entry;
      current = undefined;
    }
    throw new Error(`Unresolvable asset "${id}" (fallback "${fallbackId ?? 'none'}").`);
  }

  return { resolve, resolveOrFallback, ids: () => [...byId.keys()] };
}

export type AssetRegistry = ReturnType<typeof createAssetRegistry>;
