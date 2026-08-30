import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { AppBase, CameraComponent } from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';
import registryDocument from '../../assets/registry/assets.json';
import { createAssetRegistry, type AssetEntry } from '../../src/core/assets/asset-registry.ts';
import type { Experiment, ExperimentContext } from '../../src/core/experiments/types.ts';
import { disableCulling, fitToHeight } from '../../src/runtime/assets/fit.ts';
import { instantiateAsset } from '../../src/runtime/assets/glb-loader.ts';
import { clearFog, setFog } from '../../src/runtime/fx/atmosphere.ts';
import { translucentMaterial } from '../../src/runtime/fx/emissive.ts';
import type { SceneContext } from '../../src/runtime/scene-context.ts';
import { createBehaviorSystem, defaultBehaviorFor, BEHAVIOR_PRESETS, type BehaviorPreset, type BehaviorSystem } from './behaviors.ts';

interface Placed {
  assetId: string;
  entity: Entity;
  rotationY: number;
  scale: number;
  behavior?: BehaviorPreset;
}

interface WorldLayout {
  id: string;
  title: string;
  design_status: string;
  source_refs: string[];
  spawn: [number, number, number];
  environment: { fogColor?: number[]; fogDensity?: number; skyColor?: number[]; keyLightIntensity?: number };
  entries: Array<{ asset_id: string; position: [number, number, number]; rotation_y: number; scale?: number; behavior?: string; name?: string }>;
}

// Design heights for normalized generated models (same values as the gallery).
const TARGET_HEIGHTS: Record<string, number> = {
  'creature.mugosh.tripo-s1': 3.4,
  'creature.eis-mugosh.tripo-s1': 4.2,
  'creature.flammenwolf.tripo-s1': 2.2,
  'creature.veras.tripo-s1': 1.0,
};

const AUTOSAVE_KEY = 'mcl-protolab.world-editor.autosave';
const DEFAULT_ENV = { fogColor: [0.05, 0.07, 0.09], fogDensity: 0.012, skyColor: [0.05, 0.07, 0.09], keyLightIntensity: 1.4 };

// Repo worlds, statically bundled by Vite.
const REPO_WORLDS = import.meta.glob('../../worlds/*.json', { eager: true, import: 'default' }) as Record<string, WorldLayout>;

const matte = (r: number, g: number, b: number) => {
  const m = new StandardMaterial();
  m.diffuse = new Color(r, g, b);
  m.update();
  return m;
};

export function createWorldEditorExperiment(): Experiment {
  const registry = createAssetRegistry((registryDocument as { assets: AssetEntry[] }).assets);

  let root: Entity | null = null;
  let appRef: AppBase | null = null;
  let panel: HTMLElement | null = null;
  let onUpdate: ((dt: number) => void) | null = null;
  const domCleanup: Array<() => void> = [];

  return {
    id: 'world-editor-v1',
    tunables: {
      'player.walkSpeed': 5, 'player.sprintSpeed': 8, 'player.jumpForce': 600,
      'camera.distance': 5, 'camera.sensitivity': 0.15,
      'zhalm.walkNoise': 3, 'zhalm.sprintNoise': 9, 'zhalm.linkRange': 14, 'zhalm.pulseSpeed': 10,
      'zhalm.alertDecay': 0.12, 'zhalm.investigateSpeed': 3, 'zhalm.chaseSpeed': 6.5, 'zhalm.catchDistance': 1.4,
    },

    init(ctx: ExperimentContext) {
      const scene = ctx.scene as SceneContext;
      const app = scene.app;
      const tunables = ctx.tunables;
      appRef = app;

      root = new Entity('world-editor');
      app.root.addChild(root);

      // --- ground + light ------------------------------------------------
      const ground = new Entity('ground');
      ground.setLocalScale(140, 0.4, 140);
      ground.setPosition(0, -0.2, 0);
      ground.addComponent('render', { type: 'box', material: matte(0.12, 0.16, 0.12) });
      ground.addComponent('collision', { type: 'box', halfExtents: new Vec3(70, 0.2, 70) });
      ground.addComponent('rigidbody', { type: 'static' });
      root.addChild(ground);

      const key = new Entity('key-light');
      key.addComponent('light', { type: 'directional', intensity: DEFAULT_ENV.keyLightIntensity, castShadows: true, shadowDistance: 80, shadowBias: 0.2, normalOffsetBias: 0.05 });
      key.setEulerAngles(52, -28, 0);
      root.addChild(key);

      const playerEntity = app.root.findByName('player') as Entity | null;
      const playCamera = app.root.findByName('camera') as Entity | null;

      const applyEnvironment = (env: WorldLayout['environment']): void => {
        const fog = env.fogColor ?? DEFAULT_ENV.fogColor;
        const sky = env.skyColor ?? DEFAULT_ENV.skyColor;
        setFog(app, new Color(fog[0], fog[1], fog[2]), env.fogDensity ?? DEFAULT_ENV.fogDensity);
        const camera = playCamera?.camera;
        if (camera) camera.clearColor = new Color(sky[0], sky[1], sky[2]);
        if (editorCamera.camera) editorCamera.camera.clearColor = new Color(sky[0], sky[1], sky[2]);
        if (key.light) key.light.intensity = env.keyLightIntensity ?? DEFAULT_ENV.keyLightIntensity;
      };

      // --- editor camera (orbit + fly, official script) -------------------
      const editorCamera = new Entity('editor-camera');
      editorCamera.addComponent('camera', { clearColor: new Color(0.05, 0.07, 0.09), farClip: 600 });
      editorCamera.setPosition(0, 22, 26);
      app.root.addChild(editorCamera);
      editorCamera.addComponent('script');
      editorCamera.script?.create(CameraControls, {
        properties: { focusPoint: new Vec3(0, 0, 0), sceneSize: 40 },
      });

      // --- state ----------------------------------------------------------
      const placed: Placed[] = [];
      let spawn: [number, number, number] = [0, 1.2, 14];
      let environment: WorldLayout['environment'] = { ...DEFAULT_ENV };
      let worldMeta = { id: 'untitled-world', title: 'Untitled world', design_status: 'TENTATIVE', source_refs: ['MLOA:22544386'] };
      let mode: 'edit' | 'play' = 'edit';
      let selected: Placed | null = null;
      let paletteAsset: string | null = null;
      let paletteBehavior: BehaviorPreset | '' = '';
      let gridSnap = true;
      let noiseTimer = 0;
      let caught = 0;

      const behaviors: BehaviorSystem = createBehaviorSystem({
        app,
        root,
        getPlayerPosition: () => (playerEntity ? playerEntity.getPosition() : null),
        getTunable: (k) => tunables.get(k),
        onCaught: () => {
          caught += 1;
          scene.movePlayerTo(new Vec3(spawn[0], spawn[1], spawn[2]));
          behaviors.stopPlay();
          behaviors.startPlay();
          refreshStatus();
        },
      });

      // selection marker
      const marker = new Entity('selection-marker');
      marker.setLocalScale(1.6, 0.04, 1.6);
      marker.addComponent('render', { type: 'cylinder', material: translucentMaterial(new Color(0.4, 0.8, 1.0), 0.35) });
      marker.enabled = false;
      root.addChild(marker);

      const syncMarker = (): void => {
        if (!selected) { marker.enabled = false; return; }
        const p = selected.entity.getPosition();
        marker.setPosition(p.x, 0.06, p.z);
        marker.enabled = mode === 'edit';
      };

      // --- placement core -------------------------------------------------
      const snap = (v: number): number => (gridSnap ? Math.round(v) : v);

      const applyTransform = (item: Placed, x: number, z: number): void => {
        item.entity.setPosition(snap(x), 0, snap(z));
        item.entity.setEulerAngles(0, item.rotationY, 0);
        const targetHeight = TARGET_HEIGHTS[item.assetId];
        if (targetHeight) fitToHeight(item.entity, targetHeight * item.scale, 0);
        else if (item.scale !== 1) item.entity.setLocalScale(item.scale, item.scale, item.scale);
      };

      const placeAsset = async (assetId: string, x: number, z: number, behavior?: BehaviorPreset, rotationY = 180, scale = 1): Promise<Placed | null> => {
        try {
          const entity = await instantiateAsset(app, registry.resolve(assetId), (id) => registry.resolve(id));
          if (!root) { entity.destroy(); return null; }
          root.addChild(entity);
          if (TARGET_HEIGHTS[assetId]) disableCulling(entity);
          const item: Placed = { assetId, entity, rotationY, scale, ...(behavior ? { behavior } : {}) };
          applyTransform(item, x, z);
          if (behavior) behaviors.add(entity, behavior);
          placed.push(item);
          autosave();
          refreshStatus();
          return item;
        } catch (error) {
          console.error(`[editor] place failed for ${assetId}: ${String(error)}`);
          return null;
        }
      };

      const removePlaced = (item: Placed): void => {
        behaviors.remove(item.entity);
        item.entity.destroy();
        const index = placed.indexOf(item);
        if (index >= 0) placed.splice(index, 1);
        if (selected === item) selected = null;
        syncMarker();
        autosave();
        refreshStatus();
      };

      const clearAll = (): void => {
        for (const item of [...placed]) removePlaced(item);
      };

      // --- persistence ----------------------------------------------------
      const serialize = (): WorldLayout => ({
        ...worldMeta,
        spawn,
        environment,
        entries: placed.map((item) => {
          const p = item.entity.getPosition();
          return {
            asset_id: item.assetId,
            position: [Number(p.x.toFixed(2)), 0, Number(p.z.toFixed(2))] as [number, number, number],
            rotation_y: item.rotationY,
            ...(item.scale !== 1 ? { scale: item.scale } : {}),
            ...(item.behavior ? { behavior: item.behavior } : {}),
          };
        }),
      });

      const loadLayout = async (layout: WorldLayout): Promise<void> => {
        clearAll();
        worldMeta = { id: layout.id, title: layout.title, design_status: layout.design_status, source_refs: layout.source_refs };
        spawn = layout.spawn;
        environment = layout.environment ?? { ...DEFAULT_ENV };
        applyEnvironment(environment);
        for (const entry of layout.entries) {
          await placeAsset(entry.asset_id, entry.position[0], entry.position[2], entry.behavior as BehaviorPreset | undefined, entry.rotation_y, entry.scale ?? 1);
        }
        refreshStatus();
      };

      const autosave = (): void => {
        try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serialize())); } catch { /* storage unavailable — fine */ }
      };

      // --- mode switch ----------------------------------------------------
      const setMode = (next: 'edit' | 'play'): void => {
        if (mode === next) return;
        mode = next;
        const editing = next === 'edit';
        if (editorCamera.camera) editorCamera.camera.enabled = editing;
        if (playCamera?.camera) playCamera.camera.enabled = !editing;
        if (playerEntity) playerEntity.enabled = !editing;
        if (editing) {
          behaviors.stopPlay();
          document.exitPointerLock?.();
        } else {
          selected = null;
          behaviors.startPlay();
          scene.movePlayerTo(new Vec3(spawn[0], spawn[1], spawn[2]));
        }
        syncMarker();
        refreshStatus();
      };
      // start in edit mode
      if (playCamera?.camera) playCamera.camera.enabled = false;
      if (playerEntity) playerEntity.enabled = false;

      // --- pointer interaction -------------------------------------------
      const canvas = app.graphicsDevice.canvas as HTMLCanvasElement;
      const groundPoint = (clientX: number, clientY: number): { x: number; z: number } | null => {
        const camera = editorCamera.camera as CameraComponent | null;
        if (!camera) return null;
        const rect = canvas.getBoundingClientRect();
        const sx = ((clientX - rect.left) / rect.width) * canvas.clientWidth;
        const sy = ((clientY - rect.top) / rect.height) * canvas.clientHeight;
        const near = camera.screenToWorld(sx, sy, camera.nearClip);
        const far = camera.screenToWorld(sx, sy, camera.farClip);
        const dy = far.y - near.y;
        if (Math.abs(dy) < 1e-6) return null;
        const t = -near.y / dy;
        if (t < 0 || t > 1) return null;
        return { x: near.x + (far.x - near.x) * t, z: near.z + (far.z - near.z) * t };
      };

      const nearestPlaced = (x: number, z: number, radius: number): Placed | null => {
        let best: Placed | null = null;
        let bestDistance = radius;
        for (const item of placed) {
          const p = item.entity.getPosition();
          const distance = Math.hypot(p.x - x, p.z - z);
          if (distance < bestDistance) { best = item; bestDistance = distance; }
        }
        return best;
      };

      let dragging = false;
      let downAt: { x: number; y: number } | null = null;

      const onPointerDown = (event: PointerEvent): void => {
        if (mode !== 'edit' || event.button !== 0) return;
        if ((event.target as HTMLElement).closest('#inspector')) return;
        downAt = { x: event.clientX, y: event.clientY };
        const point = groundPoint(event.clientX, event.clientY);
        if (!point) return;
        const hit = nearestPlaced(point.x, point.z, 2.0);
        if (hit) {
          selected = hit;
          dragging = true;
          syncMarker();
          refreshStatus();
        }
      };
      const onPointerMove = (event: PointerEvent): void => {
        if (!dragging || !selected || mode !== 'edit') return;
        const point = groundPoint(event.clientX, event.clientY);
        if (!point) return;
        applyTransform(selected, point.x, point.z);
        syncMarker();
      };
      const onPointerUp = (event: PointerEvent): void => {
        if (mode !== 'edit') return;
        const wasDrag = dragging;
        dragging = false;
        if (wasDrag) { autosave(); return; }
        // plain click on empty ground with a palette selection -> place
        if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 4) return;
        if ((event.target as HTMLElement).closest('#inspector')) return;
        const point = groundPoint(event.clientX, event.clientY);
        if (!point) return;
        if (nearestPlaced(point.x, point.z, 2.0)) return; // handled as selection on pointerdown
        if (paletteAsset) void placeAsset(paletteAsset, point.x, point.z, paletteBehavior || undefined);
      };
      canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      domCleanup.push(() => {
        canvas.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      });

      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.code === 'Tab') {
          event.preventDefault();
          setMode(mode === 'edit' ? 'play' : 'edit');
          return;
        }
        if (mode !== 'edit' || !selected) return;
        if (event.code === 'KeyQ') { selected.rotationY -= 15; }
        else if (event.code === 'KeyE') { selected.rotationY += 15; }
        else if (event.code === 'Equal' || event.code === 'NumpadAdd') { selected.scale = Math.min(selected.scale * 1.1, 10); }
        else if (event.code === 'Minus' || event.code === 'NumpadSubtract') { selected.scale = Math.max(selected.scale * 0.9, 0.1); }
        else if (event.code === 'Backspace' || event.code === 'Delete') { removePlaced(selected); return; }
        else if (event.code === 'KeyG') { gridSnap = !gridSnap; refreshStatus(); return; }
        else if (event.code === 'KeyD') {
          const p = selected.entity.getPosition();
          void placeAsset(selected.assetId, p.x + 2, p.z, selected.behavior, selected.rotationY, selected.scale);
          return;
        } else return;
        const p = selected.entity.getPosition();
        applyTransform(selected, p.x, p.z);
        autosave();
      };
      window.addEventListener('keydown', onKeyDown);
      domCleanup.push(() => window.removeEventListener('keydown', onKeyDown));

      // --- panel ----------------------------------------------------------
      let statusLine: HTMLElement | null = null;
      const refreshStatus = (): void => {
        if (statusLine) {
          statusLine.textContent = `${mode.toUpperCase()} · ${placed.length} objects · alert ${behaviors.level()} · caught ${caught}` +
            (selected ? ` · sel: ${selected.assetId.split('.').slice(-2).join('.')}` : '') + (gridSnap ? ' · snap' : '');
        }
      };

      const host = document.getElementById('inspector');
      if (host) {
        panel = document.createElement('div');
        panel.style.cssText = 'background:rgba(13,17,23,0.85);padding:10px 14px;margin:0 10px 10px;border-radius:8px;font-size:11px;min-width:230px;max-width:280px;';
        const heading = document.createElement('h2');
        heading.textContent = 'WORLD EDITOR';
        heading.style.cssText = 'margin:0 0 4px;font-size:11px;letter-spacing:0.08em;opacity:0.6;';
        statusLine = document.createElement('div');
        statusLine.style.cssText = 'margin-bottom:6px;opacity:0.85;';
        const hint = document.createElement('div');
        hint.textContent = 'Click: place/select · drag: move · Q/E rotate · +/- scale · D dup · Del remove · G snap · Tab play';
        hint.style.cssText = 'opacity:0.5;margin-bottom:8px;';
        panel.append(heading, statusLine, hint);

        const assetSelect = document.createElement('select');
        assetSelect.style.cssText = 'width:100%;margin-bottom:4px;';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '— choose asset —';
        assetSelect.append(placeholder);
        const byKind = new Map<string, AssetEntry[]>();
        for (const entry of registry.ids().map((id) => registry.resolve(id))) {
          if (entry.path.startsWith('primitive:')) continue;
          const list = byKind.get(entry.kind) ?? [];
          list.push(entry);
          byKind.set(entry.kind, list);
        }
        for (const [kind, entries] of byKind) {
          const group = document.createElement('optgroup');
          group.label = kind;
          for (const entry of entries) {
            const option = document.createElement('option');
            option.value = entry.asset_id;
            option.textContent = entry.asset_id.replace(/^(creature|prop|environment)\./, '');
            group.append(option);
          }
          assetSelect.append(group);
        }
        const behaviorSelect = document.createElement('select');
        behaviorSelect.style.cssText = 'width:100%;margin-bottom:6px;';
        const rebuildBehaviorOptions = (): void => {
          behaviorSelect.innerHTML = '';
          const none = document.createElement('option');
          none.value = '';
          none.textContent = 'behavior: none (static)';
          behaviorSelect.append(none);
          for (const preset of BEHAVIOR_PRESETS) {
            const option = document.createElement('option');
            option.value = preset;
            option.textContent = `behavior: ${preset}`;
            behaviorSelect.append(option);
          }
          behaviorSelect.value = paletteBehavior;
        };
        rebuildBehaviorOptions();
        assetSelect.addEventListener('change', () => {
          paletteAsset = assetSelect.value || null;
          paletteBehavior = (paletteAsset ? (defaultBehaviorFor(paletteAsset) ?? '') : '') as BehaviorPreset | '';
          rebuildBehaviorOptions();
        });
        behaviorSelect.addEventListener('change', () => { paletteBehavior = behaviorSelect.value as BehaviorPreset | ''; });
        panel.append(assetSelect, behaviorSelect);

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;';
        const button = (label: string, onClick: () => void): HTMLButtonElement => {
          const b = document.createElement('button');
          b.textContent = label;
          b.style.cssText = 'font-size:11px;padding:2px 8px;cursor:pointer;';
          b.addEventListener('click', onClick);
          row.append(b);
          return b;
        };
        button('Export', () => {
          const blob = new Blob([`${JSON.stringify(serialize(), null, 2)}\n`], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${worldMeta.id}.json`;
          a.click();
          URL.revokeObjectURL(a.href);
        });
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => {
          const file = fileInput.files?.[0];
          if (!file) return;
          void file.text().then((text) => loadLayout(JSON.parse(text) as WorldLayout));
        });
        panel.append(fileInput);
        button('Import', () => fileInput.click());
        button('Clear', () => { clearAll(); autosave(); });
        button('Play/Edit', () => setMode(mode === 'edit' ? 'play' : 'edit'));
        panel.append(row);

        const worldSelect = document.createElement('select');
        worldSelect.style.cssText = 'width:100%;margin-top:6px;';
        const worldPlaceholder = document.createElement('option');
        worldPlaceholder.value = '';
        worldPlaceholder.textContent = '— load repo world —';
        worldSelect.append(worldPlaceholder);
        for (const [path, layout] of Object.entries(REPO_WORLDS)) {
          if (path.includes('_template')) continue;
          const option = document.createElement('option');
          option.value = path;
          option.textContent = layout.title;
          worldSelect.append(option);
        }
        worldSelect.addEventListener('change', () => {
          const layout = REPO_WORLDS[worldSelect.value];
          if (layout) void loadLayout(layout);
        });
        panel.append(worldSelect);
        host.append(panel);
      }

      // --- update loop ----------------------------------------------------
      onUpdate = (dt: number) => {
        behaviors.update(dt);
        if (mode === 'play' && playerEntity?.rigidbody) {
          noiseTimer += dt;
          const v = playerEntity.rigidbody.linearVelocity;
          const speed = Math.hypot(v.x, v.z);
          if (noiseTimer >= 0.35 && speed > 0.6) {
            noiseTimer = 0;
            const loud = speed > tunables.get('player.walkSpeed') + 0.6 ? tunables.get('zhalm.sprintNoise') : tunables.get('zhalm.walkNoise');
            const p = playerEntity.getPosition();
            behaviors.noiseAt(p.x, p.z, loud);
          }
          refreshStatus();
        }
      };
      app.on('update', onUpdate);

      applyEnvironment(environment);

      // Restore autosave if present.
      try {
        const saved = localStorage.getItem(AUTOSAVE_KEY);
        if (saved) void loadLayout(JSON.parse(saved) as WorldLayout);
      } catch { /* ignore corrupt autosave */ }

      refreshStatus();

      // Test hook — deterministic access for the smoke suite (mission §7).
      (window as unknown as Record<string, unknown>).__editor = {
        place: (assetId: string, x: number, z: number, behavior?: string) =>
          placeAsset(assetId, x, z, behavior as BehaviorPreset | undefined),
        count: () => placed.length,
        serialize: () => serialize(),
        load: (layout: WorldLayout) => loadLayout(layout),
        setMode: (m: 'edit' | 'play') => setMode(m),
        mode: () => mode,
        level: () => behaviors.level(),
        noiseAt: (x: number, z: number, r: number) => behaviors.noiseAt(x, z, r),
        caught: () => caught,
        clear: () => clearAll(),
      };
    },

    reset(ctx: ExperimentContext) {
      this.destroy(ctx);
      this.init(ctx);
    },

    destroy() {
      for (const cleanup of domCleanup.splice(0)) cleanup();
      panel?.remove();
      panel = null;
      delete (window as unknown as Record<string, unknown>).__editor;
      if (appRef) {
        if (onUpdate) appRef.off('update', onUpdate);
        clearFog(appRef);
        const playCamera = appRef.root.findByName('camera') as Entity | null;
        const playerEntity = appRef.root.findByName('player') as Entity | null;
        if (playCamera?.camera) {
          playCamera.camera.enabled = true;
          playCamera.camera.clearColor = new Color(0.48, 0.72, 0.9);
        }
        if (playerEntity) playerEntity.enabled = true;
        appRef.root.findByName('editor-camera')?.destroy();
      }
      onUpdate = null;
      root?.destroy();
      root = null;
      appRef = null;
    },
  };
}
