import { Entity } from 'playcanvas';
import type { AppBase, Asset } from 'playcanvas';
import type { AssetEntry } from '../../core/assets/asset-registry.ts';

interface ContainerResourceLike { instantiateRenderEntity(): Entity }

/** Loads a GLB container by URL and instantiates its render entity. */
export function loadContainer(app: AppBase, url: string): Promise<Entity> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(url, 'container', (err: string | null, asset?: Asset) => {
      if (err || !asset) {
        reject(new Error(`container load failed for ${url}: ${err ?? 'no asset'}`));
        return;
      }
      resolve((asset.resource as ContainerResourceLike).instantiateRenderEntity());
    });
  });
}

/**
 * Resolves a registry entry to a scene entity. GLB paths load through the
 * ContainerHandler; `primitive:<type>` paths build an engine primitive. On a
 * GLB load failure the declared fallback entry is tried once — the registry's
 * fallback contract made visible at runtime.
 */
export async function instantiateAsset(
  app: AppBase,
  entry: AssetEntry,
  resolveFallback: (id: string) => AssetEntry,
): Promise<Entity> {
  if (entry.path.startsWith('primitive:')) {
    const type = entry.path.slice('primitive:'.length);
    const entity = new Entity(entry.asset_id);
    entity.addComponent('render', { type });
    return entity;
  }
  try {
    const entity = await loadContainer(app, entry.path);
    entity.name = entry.asset_id;
    return entity;
  } catch (error) {
    if (entry.fallback_asset_id) {
      console.warn(`[assets] ${entry.asset_id} failed (${String(error)}); using fallback ${entry.fallback_asset_id}`);
      return instantiateAsset(app, resolveFallback(entry.fallback_asset_id), resolveFallback);
    }
    throw error;
  }
}
