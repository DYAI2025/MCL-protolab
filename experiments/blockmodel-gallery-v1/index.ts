import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import registryDocument from '../../assets/registry/assets.json';
import { createAssetRegistry, type AssetEntry } from '../../src/core/assets/asset-registry.ts';
import type { Experiment, ExperimentContext } from '../../src/core/experiments/types.ts';
import { instantiateAsset } from '../../src/runtime/assets/glb-loader.ts';
import type { SceneContext } from '../../src/runtime/scene-context.ts';

// One pedestal per generated model. Order = display order, left to right.
const SHOWN: Array<{ assetId: string; label: string }> = [
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

    SHOWN.forEach(({ assetId }, index) => {
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

    scene.movePlayerTo(new Vec3(0, 1.2, 6));
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
