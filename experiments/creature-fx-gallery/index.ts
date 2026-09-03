import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { CameraFrame } from 'playcanvas';
import mugoshProfile from '../../concepts/creatures/mugosh.json';
import flammenwolfProfile from '../../concepts/creatures/flammenwolf.json';
import verasProfile from '../../concepts/creatures/veras.json';
import zhalmProfile from '../../concepts/creatures/zhalm.json';
import { createConceptRegistry, type CreatureConcept } from '../../src/core/concepts/creature-concepts.ts';
import type { Experiment, ExperimentContext } from '../../src/core/experiments/types.ts';
import { clearFog, setFog } from '../../src/runtime/fx/atmosphere.ts';
import { createPostChain } from '../../src/runtime/fx/post.ts';
import type { SceneContext } from '../../src/runtime/scene-context.ts';
import type { CreatureHandle, FxLayer } from './creature-handle.ts';
import { buildFlammenwolf } from './creatures/flammenwolf.ts';
import { buildMugosh } from './creatures/mugosh.ts';
import { buildVeras } from './creatures/veras.ts';
import { buildZhalm } from './creatures/zhalm.ts';

const material = (r: number, g: number, b: number) => {
  const m = new StandardMaterial();
  m.diffuse = new Color(r, g, b);
  m.update();
  return m;
};

const FOG_COLOR = new Color(0.08, 0.06, 0.12);
const PEDESTAL_X = [-9, -3, 3, 9] as const;

/**
 * A design instrument, not game UI (addendum §3): four concept placeholders on
 * pedestals at player-relative scale, every FX layer individually disableable,
 * one deterministic FX state per profile activatable from the __gallery hook.
 * Explicitly NOT a creature framework (addendum §5).
 */
export function createCreatureFxGalleryExperiment(): Experiment {
  const concepts = createConceptRegistry([
    mugoshProfile, flammenwolfProfile, verasProfile, zhalmProfile,
  ] as CreatureConcept[]);

  let root: Entity | null = null;
  let handles: CreatureHandle[] = [];
  let post: CameraFrame | null = null;
  let controls: HTMLElement | null = null;
  let onUpdate: ((dt: number) => void) | null = null;
  let appRef: SceneContext['app'] | null = null;

  const teardownGlobals = (): void => {
    if (appRef && onUpdate) appRef.off('update', onUpdate);
    onUpdate = null;
    if (post) { post.destroy(); post = null; }
    if (appRef) clearFog(appRef);
    controls?.remove();
    controls = null;
    delete (window as unknown as Record<string, unknown>).__gallery;
  };

  const build = (ctx: ExperimentContext): void => {
    const scene = ctx.scene as SceneContext;
    const app = scene.app;
    appRef = app;

    root = new Entity('creature-fx-gallery');
    app.root.addChild(root);

    const floor = new Entity('floor');
    floor.setLocalScale(60, 0.4, 30);
    floor.setPosition(0, -0.2, 0);
    floor.addComponent('render', { type: 'box', material: material(0.14, 0.13, 0.18) });
    floor.addComponent('collision', { type: 'box', halfExtents: new Vec3(30, 0.2, 15) });
    floor.addComponent('rigidbody', { type: 'static' });
    root.addChild(floor);

    const key = new Entity('key-light');
    key.addComponent('light', { type: 'directional', intensity: 1.6, castShadows: true, shadowDistance: 50, shadowBias: 0.2, normalOffsetBias: 0.05 });
    key.setEulerAngles(52, 28, 0);
    root.addChild(key);

    const referenceMaterial = material(0.6, 0.6, 0.65);
    for (const x of PEDESTAL_X) {
      const pedestal = new Entity(`pedestal-${x}`);
      pedestal.setLocalScale(4.4, 0.3, 4.4);
      pedestal.setPosition(x, 0.15, -6);
      pedestal.addComponent('render', { type: 'cylinder', material: material(0.3, 0.3, 0.36) });
      root.addChild(pedestal);

      // Reference capsule at player height, so silhouette and scale can be judged.
      const reference = new Entity(`reference-${x}`);
      reference.setLocalScale(1, 1.8, 1);
      reference.setPosition(x + 2.6, 0.9 + 0.3, -6);
      reference.addComponent('render', { type: 'capsule', material: referenceMaterial });
      root.addChild(reference);
    }

    const y = 0.3;
    handles = [
      buildMugosh(root, { x: PEDESTAL_X[0], y, z: -6 }),
      buildFlammenwolf(app, root, { x: PEDESTAL_X[1], y, z: -6 }),
      buildVeras(app, root, { x: PEDESTAL_X[2], y, z: -6 }),
      buildZhalm(root, { x: PEDESTAL_X[3], y, z: -6 }),
    ];

    // Sanity: every profile in the registry has a builder and vice versa.
    const built = handles.map((h) => h.id).sort();
    const declared = concepts.ids().sort();
    if (JSON.stringify(built) !== JSON.stringify(declared)) {
      throw new Error(`gallery/profile mismatch: built=${built.join(',')} declared=${declared.join(',')}`);
    }

    setFog(app, FOG_COLOR, 0.015);

    const cameraEntity = app.root.findByName('camera') as Entity | null;
    if (cameraEntity?.camera) post = createPostChain(app, cameraEntity.camera, 0.02);

    onUpdate = (dt: number) => { for (const handle of handles) handle.update(dt); };
    app.on('update', onUpdate);

    // Layer toggles — the "reducible/disableable" requirement from addendum §3.
    const inspectorHost = document.getElementById('inspector');
    if (inspectorHost) {
      controls = document.createElement('div');
      controls.style.cssText = 'background:rgba(13,17,23,0.82);padding:10px 14px;margin:0 10px 10px;border-radius:8px;font-size:11px;min-width:230px;max-width:280px;';
      const heading = document.createElement('h2');
      heading.textContent = 'GALLERY LAYERS';
      heading.style.cssText = 'margin:0 0 4px;font-size:11px;letter-spacing:0.08em;opacity:0.6;';
      controls.append(heading);

      const layerToggle = (label: string, apply: (on: boolean) => void): void => {
        const wrap = document.createElement('label');
        wrap.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:2px;cursor:pointer;';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = true;
        box.addEventListener('change', () => apply(box.checked));
        const text = document.createElement('span');
        text.textContent = label;
        wrap.append(box, text);
        controls?.append(wrap);
      };

      for (const layer of ['emissive', 'particles', 'trail', 'light'] as FxLayer[]) {
        layerToggle(layer, (on) => { for (const handle of handles) handle.setLayer(layer, on); });
      }
      layerToggle('fog', (on) => {
        if (on) setFog(app, FOG_COLOR, 0.015); else clearFog(app);
      });
      layerToggle('post (bloom)', (on) => {
        if (!post) return;
        post.bloom.intensity = on ? 0.02 : 0;
        post.update();
      });
      inspectorHost.append(controls);
    }

    // Deterministic FX state hook, required by addendum §6.
    (window as unknown as Record<string, unknown>).__gallery = {
      ids: () => handles.map((h) => h.id),
      states: (id: string) => handles.find((h) => h.id === id)?.states() ?? [],
      state: (id: string) => handles.find((h) => h.id === id)?.state() ?? null,
      setState: (id: string, state: string) => {
        const handle = handles.find((h) => h.id === id);
        if (!handle) throw new Error(`gallery: unknown creature "${id}"`);
        handle.setState(state);
      },
      readabilityGoal: (id: string) => concepts.get(id).fx_profile.readability_goal,
    };

    scene.movePlayerTo(new Vec3(0, 1.2, 6));
  };

  return {
    id: 'creature-fx-gallery',
    tunables: { 'player.walkSpeed': 5, 'player.sprintSpeed': 8, 'player.jumpForce': 600, 'camera.distance': 5, 'camera.sensitivity': 0.15 },

    init(ctx: ExperimentContext) {
      build(ctx);
    },

    reset(ctx: ExperimentContext) {
      // Full rebuild per the contract's reset_strategy — destroy, then init.
      for (const handle of handles) handle.destroy();
      handles = [];
      root?.destroy();
      root = null;
      teardownGlobals();
      build(ctx);
    },

    destroy() {
      for (const handle of handles) handle.destroy();
      handles = [];
      root?.destroy();
      root = null;
      teardownGlobals();
      appRef = null;
    },
  };
}
