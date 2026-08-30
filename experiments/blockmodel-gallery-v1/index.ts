import { CULLFACE_NONE, Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { Material, RenderComponent } from 'playcanvas';
import registryDocument from '../../assets/registry/assets.json';
import { createAssetRegistry, type AssetEntry } from '../../src/core/assets/asset-registry.ts';
import type { Experiment, ExperimentContext } from '../../src/core/experiments/types.ts';
import { instantiateAsset } from '../../src/runtime/assets/glb-loader.ts';
import type { SceneContext } from '../../src/runtime/scene-context.ts';

// One pedestal per model. Order = display order, left to right.
// targetHeight rescales normalized GLBs (TRELLIS outputs ~unit-box models) to
// their design scale; omitted = model is already authored in meters.
const SHOWN: Array<{ assetId: string; label: string; targetHeight?: number }> = [
  { assetId: 'creature.mugosh.tripo-s1', label: 'mugosh V2 (Tripo)', targetHeight: 3.4 },
  { assetId: 'creature.eis-mugosh.tripo-s1', label: 'eis-mugosh V2 (Tripo)', targetHeight: 4.2 },
  { assetId: 'creature.flammenwolf.tripo-s1', label: 'flammenwolf V2 (Tripo)', targetHeight: 2.2 },
  { assetId: 'creature.veras.tripo-s1', label: 'veras V2 (Tripo, weak)', targetHeight: 1.0 },
  { assetId: 'creature.mugosh.blockmodel-a', label: 'mugosh A' },
  { assetId: 'creature.mugosh.blockmodel-b', label: 'mugosh B' },
  { assetId: 'creature.flammenwolf.blockmodel', label: 'flammenwolf' },
  { assetId: 'creature.steinwolf.blockmodel', label: 'steinwolf' },
  { assetId: 'creature.veras.blockmodel', label: 'veras' },
  { assetId: 'creature.zhalm.blockmodel', label: 'zhalm' },
  { assetId: 'prop.zhalm.sensor-node.blockmodel', label: 'sensor node' },
];

const material = (r: number, g: number, b: number) => {
  const m = new StandardMaterial();
  m.diffuse = new Color(r, g, b);
  m.update();
  return m;
};

/** World-space vertical bounds over all render mesh instances (reads fresh). */
function worldBoundsY(entity: Entity): { minY: number; maxY: number } {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const component of entity.findComponents('render') as RenderComponent[]) {
    for (const meshInstance of component.meshInstances) {
      const aabb = meshInstance.aabb; // world-space, lazily synced on read
      minY = Math.min(minY, aabb.center.y - aabb.halfExtents.y);
      maxY = Math.max(maxY, aabb.center.y + aabb.halfExtents.y);
    }
  }
  return { minY, maxY };
}

/**
 * Design-comparison gallery for generated block models: every asset comes
 * through the registry + GLB loader (fallback chain live), next to a
 * player-height reference capsule. Specs in assets/blockmodels/ are the
 * editing surface — regenerate with `npm run generate:assets`.
 */
export function createBlockmodelGalleryExperiment(): Experiment {
  const registry = createAssetRegistry((registryDocument as { assets: AssetEntry[] }).assets);

  let root: Entity | null = null;
  let loaded = new Map<string, boolean>();
  let usedFallback = new Map<string, boolean>();

  const build = (ctx: ExperimentContext): void => {
    const scene = ctx.scene as SceneContext;
    const app = scene.app;

    root = new Entity('blockmodel-gallery');
    app.root.addChild(root);
    loaded = new Map();
    usedFallback = new Map();

    const floor = new Entity('floor');
    floor.setLocalScale(70, 0.4, 30);
    floor.setPosition(0, -0.2, 0);
    floor.addComponent('render', { type: 'box', material: material(0.2, 0.19, 0.22) });
    floor.addComponent('collision', { type: 'box', halfExtents: new Vec3(35, 0.2, 15) });
    floor.addComponent('rigidbody', { type: 'static' });
    root.addChild(floor);

    const key = new Entity('key-light');
    key.addComponent('light', { type: 'directional', intensity: 2.2, castShadows: true, shadowDistance: 60, shadowBias: 0.2, normalOffsetBias: 0.05 });
    key.setEulerAngles(50, 30, 0);
    root.addChild(key);

    const referenceMaterial = material(0.62, 0.62, 0.66);
    const pedestalMaterial = material(0.32, 0.31, 0.36);
    const spacing = 8;
    const offset = ((SHOWN.length - 1) * spacing) / 2;

    SHOWN.forEach(({ assetId, targetHeight }, index) => {
      const x = index * spacing - offset;
      const pedestal = new Entity(`pedestal-${assetId}`);
      pedestal.setLocalScale(5, 0.3, 5);
      pedestal.setPosition(x, 0.15, -6);
      pedestal.addComponent('render', { type: 'cylinder', material: pedestalMaterial });
      root?.addChild(pedestal);

      const reference = new Entity(`reference-${assetId}`);
      reference.setLocalScale(1, 1.8, 1);
      reference.setPosition(x + 2.9, 1.2, -6);
      reference.addComponent('render', { type: 'capsule', material: referenceMaterial });
      root?.addChild(reference);

      void instantiateAsset(app, registry.resolve(assetId), (id) => registry.resolve(id))
        .then((entity) => {
          if (!root) { entity.destroy(); return; }
          entity.setPosition(x, 0.3, -6);
          entity.setEulerAngles(0, 180, 0); // specs model faces toward -z; player views from +z
          root.addChild(entity);
          if (targetHeight) {
            // Generated candidate meshes (TRELLIS) ship with inverted winding —
            // without this the model culls itself invisible. Review-only fix;
            // an approved asset gets its winding corrected in cleanup.
            const seen = new Set<Material>();
            for (const component of entity.findComponents('render') as RenderComponent[]) {
              for (const meshInstance of component.meshInstances) {
                const mat = meshInstance.material as Material;
                if (seen.has(mat)) continue;
                seen.add(mat);
                mat.cull = CULLFACE_NONE;
                mat.update();
              }
            }
            // Measure in world space, scale, re-measure, then drop the lowest
            // point onto the pedestal — self-correcting, no stale math.
            const before = worldBoundsY(entity);
            const height = before.maxY - before.minY;
            if (Number.isFinite(height) && height > 0.001) {
              const factor = targetHeight / height;
              entity.setLocalScale(factor, factor, factor);
              const after = worldBoundsY(entity);
              if (Number.isFinite(after.minY)) {
                const p = entity.getPosition();
                entity.setPosition(p.x, p.y + (0.3 - after.minY), p.z);
              }
            }
          }
          loaded.set(assetId, true);
          usedFallback.set(assetId, entity.name !== assetId);
        })
        .catch((error: unknown) => {
          loaded.set(assetId, false);
          console.error(`[blockmodel-gallery] ${assetId}: ${String(error)}`);
        });
    });

    // Test hook — read by the gallery smoke spec.
    (window as unknown as Record<string, unknown>).__blockgallery = {
      ids: () => SHOWN.map((s) => s.assetId),
      loaded: (id: string) => loaded.get(id) ?? null,
      allLoaded: () => SHOWN.every((s) => loaded.get(s.assetId) === true),
      usedFallback: (id: string) => usedFallback.get(id) ?? null,
    };

    // Spawn facing the Mugosh comparison cluster (V2 candidate + both grayboxes).
    scene.movePlayerTo(new Vec3(-22, 1.2, 6));
  };

  return {
    id: 'blockmodel-gallery-v1',
    tunables: { 'player.walkSpeed': 5, 'player.sprintSpeed': 8, 'player.jumpForce': 600, 'camera.distance': 5, 'camera.sensitivity': 0.15 },

    init(ctx: ExperimentContext) {
      build(ctx);
    },

    reset(ctx: ExperimentContext) {
      this.destroy(ctx);
      this.init(ctx);
    },

    destroy() {
      delete (window as unknown as Record<string, unknown>).__blockgallery;
      root?.destroy();
      root = null;
    },
  };
}
