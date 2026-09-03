import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { AppBase, CameraComponent } from 'playcanvas';
import registryDocument from '../../assets/registry/assets.json';
import { createAssetRegistry, type AssetEntry } from '../../src/core/assets/asset-registry.ts';
import type { Experiment, ExperimentContext } from '../../src/core/experiments/types.ts';
import { disableCulling, fitToHeight, worldBoundsY } from '../../src/runtime/assets/fit.ts';
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
  player_asset_id?: string;
  environment: { fogColor?: number[]; fogDensity?: number; skyColor?: number[]; keyLightIntensity?: number };
  entries: Array<{ asset_id: string; position: [number, number, number]; rotation_y: number; scale?: number; behavior?: string; name?: string }>;
}

const SET_SPAWN = '__set-spawn__'; // palette pseudo-asset: clicking places the player spawn

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

      // --- editor camera: hand-rolled fly cam ------------------------------
      // Right-mouse drag looks, WASD flies (Space/C up/down, Shift fast),
      // wheel dollies. The LEFT button stays exclusive to editing — the
      // official CameraControls orbits on left-drag and fought the
      // select/move/place interactions.
      const editorCamera = new Entity('editor-camera');
      editorCamera.addComponent('camera', { clearColor: new Color(0.05, 0.07, 0.09), farClip: 600 });
      editorCamera.setPosition(0, 22, 26);
      app.root.addChild(editorCamera);
      let camYaw = 0;
      let camPitch = -38;
      const flyKeys = new Set<string>();
      let looking = false;
      const applyCameraRotation = (): void => editorCamera.setEulerAngles(camPitch, camYaw, 0);
      applyCameraRotation();

      // --- state ----------------------------------------------------------
      const placed: Placed[] = [];
      let spawn: [number, number, number] = [0, 1.2, 14];
      let playerModelId = ''; // '' = default capsule
      let playerModelEntity: Entity | null = null;
      let playerSelect: HTMLSelectElement | null = null;
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

      // spawn marker — ghost capsule at the player start (edit mode only)
      const spawnMarker = new Entity('spawn-marker');
      spawnMarker.setLocalScale(1, 1.8, 1);
      spawnMarker.addComponent('render', { type: 'capsule', material: translucentMaterial(new Color(1.0, 0.9, 0.4), 0.4) });
      root.addChild(spawnMarker);
      const syncSpawnMarker = (): void => {
        spawnMarker.setPosition(spawn[0], 0.95, spawn[2]);
        spawnMarker.enabled = mode === 'edit';
      };

      const setSpawnPoint = (x: number, z: number): void => {
        spawn = [snap(x), 1.2, snap(z)];
        syncSpawnMarker();
        autosave();
        refreshStatus();
      };

      // --- player model swap ---------------------------------------------
      const applyPlayerModel = async (): Promise<void> => {
        const capsule = playerEntity?.findByName('player-model') as Entity | null;
        if (playerModelEntity) { playerModelEntity.destroy(); playerModelEntity = null; }
        if (!playerEntity) return;
        if (!playerModelId) {
          if (capsule?.render) capsule.render.enabled = true;
          return;
        }
        try {
          const model = await instantiateAsset(app, registry.resolve(playerModelId), (id) => registry.resolve(id));
          model.name = 'player-model-swap'; // stable name so destroy() can find it
          disableCulling(model);
          playerEntity.addChild(model);
          // Scale to player height (1.8 m) and rest the feet at the capsule
          // bottom (player origin is the capsule center, ground at -1 local).
          const before = worldBoundsY(model);
          const height = before.maxY - before.minY;
          if (Number.isFinite(height) && height > 0.001) {
            const factor = 1.8 / height;
            model.setLocalScale(factor, factor, factor);
            const after = worldBoundsY(model);
            const playerFeet = playerEntity.getPosition().y - 1;
            model.setLocalPosition(0, model.getLocalPosition().y + (playerFeet - after.minY), 0);
          }
          model.setLocalEulerAngles(0, 180, 0);
          playerModelEntity = model;
          if (capsule?.render) capsule.render.enabled = false;
        } catch (error) {
          console.error(`[editor] player model failed: ${String(error)}`);
          if (capsule?.render) capsule.render.enabled = true;
        }
      };

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
        ...(playerModelId ? { player_asset_id: playerModelId } : {}),
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
        playerModelId = layout.player_asset_id ?? '';
        if (playerSelect) playerSelect.value = playerModelId;
        syncSpawnMarker();
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
          void applyPlayerModel();
        }
        syncMarker();
        syncSpawnMarker();
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
        if (mode !== 'edit') return;
        if (event.button === 2) { looking = true; return; } // fly-cam look
        if (event.button !== 0) return;
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
        if (mode !== 'edit') return;
        if (looking) {
          camYaw -= event.movementX * 0.25;
          camPitch = Math.max(-85, Math.min(85, camPitch - event.movementY * 0.25));
          applyCameraRotation();
          return;
        }
        if (!dragging || !selected) return;
        const point = groundPoint(event.clientX, event.clientY);
        if (!point) return;
        applyTransform(selected, point.x, point.z);
        syncMarker();
      };
      const onPointerUp = (event: PointerEvent): void => {
        if (event.button === 2) { looking = false; return; }
        if (mode !== 'edit') return;
        const wasDrag = dragging;
        dragging = false;
        if (wasDrag) { autosave(); return; }
        // plain click on empty ground with a palette selection -> place
        if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 4) return;
        if ((event.target as HTMLElement).closest('#inspector')) return;
        const point = groundPoint(event.clientX, event.clientY);
        if (!point) return;
        if (paletteAsset === SET_SPAWN) { setSpawnPoint(point.x, point.z); return; }
        if (nearestPlaced(point.x, point.z, 2.0)) return; // handled as selection on pointerdown
        if (paletteAsset) void placeAsset(paletteAsset, point.x, point.z, paletteBehavior || undefined);
      };
      const onContextMenu = (event: Event): void => { if (mode === 'edit') event.preventDefault(); };
      const onWheel = (event: WheelEvent): void => {
        if (mode !== 'edit' || (event.target as HTMLElement).closest('#inspector')) return;
        event.preventDefault();
        const forward = editorCamera.forward;
        const step = event.deltaY * -0.03;
        const p = editorCamera.getPosition();
        editorCamera.setPosition(p.x + forward.x * step, Math.max(1, p.y + forward.y * step), p.z + forward.z * step);
      };
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('contextmenu', onContextMenu);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      domCleanup.push(() => {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('contextmenu', onContextMenu);
        canvas.removeEventListener('wheel', onWheel);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      });

      const FLY_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyC', 'ShiftLeft', 'ShiftRight']);
      const onKeyUp = (event: KeyboardEvent): void => { flyKeys.delete(event.code); };
      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.code === 'Tab') {
          event.preventDefault();
          setMode(mode === 'edit' ? 'play' : 'edit');
          return;
        }
        if (mode === 'edit' && FLY_CODES.has(event.code)) flyKeys.add(event.code);
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
      window.addEventListener('keyup', onKeyUp);
      domCleanup.push(() => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      });

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
        hint.textContent = 'Kamera: rechte Maus schwenken · WASD fliegen · Space/C hoch/runter · Shift schnell · Rad zoom — Editieren: Linksklick platzieren/wählen · ziehen verschieben · Q/E drehen · +/- Größe · D Kopie · Entf löschen · G Raster';
        hint.style.cssText = 'opacity:0.55;margin-bottom:8px;';
        panel.append(heading, statusLine, hint);

        const assetSelect = document.createElement('select');
        assetSelect.style.cssText = 'width:100%;margin-bottom:4px;';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '— choose asset —';
        assetSelect.append(placeholder);
        const spawnOption = document.createElement('option');
        spawnOption.value = SET_SPAWN;
        spawnOption.textContent = '🧍 Spieler-Spawn setzen (klicken)';
        assetSelect.append(spawnOption);
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
          paletteBehavior = (paletteAsset && paletteAsset !== SET_SPAWN ? (defaultBehaviorFor(paletteAsset) ?? '') : '') as BehaviorPreset | '';
          rebuildBehaviorOptions();
        });
        behaviorSelect.addEventListener('change', () => { paletteBehavior = behaviorSelect.value as BehaviorPreset | ''; });
        panel.append(assetSelect, behaviorSelect);

        // player model picker — swaps the capsule when play mode starts
        playerSelect = document.createElement('select');
        playerSelect.style.cssText = 'width:100%;margin-bottom:6px;';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'player model: capsule (default)';
        playerSelect.append(defaultOption);
        for (const id of registry.ids()) {
          const entry = registry.resolve(id);
          if (entry.path.startsWith('primitive:') || (entry.kind !== 'character' && entry.kind !== 'creature')) continue;
          const option = document.createElement('option');
          option.value = entry.asset_id;
          option.textContent = `player model: ${entry.asset_id.replace(/^creature\./, '')}`;
          playerSelect.append(option);
        }
        playerSelect.addEventListener('change', () => {
          playerModelId = playerSelect?.value ?? '';
          autosave();
          if (mode === 'play') void applyPlayerModel();
        });
        panel.append(playerSelect);

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
        panel.append(row);

        const playButton = document.createElement('button');
        playButton.textContent = '▶ Play / Edit  (Tab)';
        playButton.style.cssText = 'width:100%;margin-top:6px;font-size:12px;padding:5px;cursor:pointer;font-weight:600;';
        playButton.addEventListener('click', () => setMode(mode === 'edit' ? 'play' : 'edit'));
        panel.append(playButton);

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
        if (mode === 'edit' && flyKeys.size > 0) {
          const speed = (flyKeys.has('ShiftLeft') || flyKeys.has('ShiftRight') ? 36 : 12) * dt;
          const forward = editorCamera.forward;
          const right = editorCamera.right;
          let dx = 0, dy = 0, dz = 0;
          if (flyKeys.has('KeyW')) { dx += forward.x * speed; dy += forward.y * speed; dz += forward.z * speed; }
          if (flyKeys.has('KeyS')) { dx -= forward.x * speed; dy -= forward.y * speed; dz -= forward.z * speed; }
          if (flyKeys.has('KeyD')) { dx += right.x * speed; dz += right.z * speed; }
          if (flyKeys.has('KeyA')) { dx -= right.x * speed; dz -= right.z * speed; }
          if (flyKeys.has('Space')) dy += speed;
          if (flyKeys.has('KeyC')) dy -= speed;
          const p = editorCamera.getPosition();
          editorCamera.setPosition(p.x + dx, Math.max(0.6, p.y + dy), p.z + dz);
        }
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
      syncSpawnMarker();

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
        setSpawn: (x: number, z: number) => setSpawnPoint(x, z),
        spawnPos: () => [...spawn],
        setPlayerModel: (id: string) => { playerModelId = id; if (playerSelect) playerSelect.value = id; },
        playerModel: () => playerModelId,
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
        if (playerEntity) {
          playerEntity.enabled = true;
          playerEntity.findByName('player-model-swap')?.destroy();
          const capsule = playerEntity.findByName('player-model') as Entity | null;
          if (capsule?.render) capsule.render.enabled = true;
        }
        appRef.root.findByName('editor-camera')?.destroy();
      }
      onUpdate = null;
      root?.destroy();
      root = null;
      appRef = null;
    },
  };
}
