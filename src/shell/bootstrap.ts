import { Vec3 } from 'playcanvas';
import { createCreatureFxGalleryExperiment } from '../../experiments/creature-fx-gallery/index.ts';
import { createPlaygroundExperiment } from '../../experiments/playground/index.ts';
import { createTunables } from '../core/config/tunables.ts';
import { createEmitter } from '../core/events/emitter.ts';
import type { ProtolabEvents } from '../core/events/protolab-events.ts';
import { createExperimentRegistry } from '../core/experiments/registry.ts';
import type { ExperimentContext } from '../core/experiments/types.ts';
import type { InspectorSnapshot } from '../core/debug/inspector-state.ts';
import { bootRuntime } from '../runtime/boot.ts';
import { mountInspector } from '../runtime/debug/inspector.ts';
import { createPlayerRig } from '../runtime/player/third-person.ts';
import type { SceneContext } from '../runtime/scene-context.ts';

/**
 * The single composition root (enforced by shell-is-the-only-composition-root):
 * wires runtime, core and experiments together and owns the reset path.
 */
export async function bootstrap(canvas: HTMLCanvasElement): Promise<void> {
  const app = await bootRuntime(canvas);

  const tunables = createTunables({
    'player.walkSpeed': { value: 5, min: 0, max: 20, step: 0.1 },
    'player.sprintSpeed': { value: 8, min: 0, max: 30, step: 0.1 },
    'player.jumpForce': { value: 600, min: 0, max: 2000, step: 10 },
    'camera.distance': { value: 5, min: 1.5, max: 15, step: 0.1 },
    'camera.sensitivity': { value: 0.15, min: 0.01, max: 1, step: 0.01 },
  });

  const bus = createEmitter<ProtolabEvents>();
  const registry = createExperimentRegistry(bus);

  const rig = createPlayerRig(app, new Vec3(0, 1.2, 0), tunables);

  tunables.subscribe((key, value) => {
    const c = rig.controller as Record<string, number>;
    if (key === 'player.walkSpeed') c.speedGround = value * 10;
    if (key === 'player.jumpForce') c.jumpForce = value;
    if (key === 'camera.distance') c.cameraDistance = value;
    if (key === 'camera.sensitivity') c.lookSens = value;
  });

  const movePlayerTo = (position: Vec3): void => {
    const body = rig.player.rigidbody;
    if (body) {
      body.teleport(position);
      // Teleport alone keeps momentum on a dynamic body — zero it explicitly.
      body.linearVelocity = Vec3.ZERO;
      body.angularVelocity = Vec3.ZERO;
    } else {
      rig.player.setPosition(position);
    }
  };

  const scene: SceneContext = { app, movePlayerTo };
  const ctx: ExperimentContext = { scene, tunables };

  registry.register(createPlaygroundExperiment());
  registry.register(createCreatureFxGalleryExperiment());

  const requested = new URLSearchParams(window.location.search).get('experiment') ?? 'playground';
  registry.load(requested, ctx);

  const doReset = (): void => registry.reset(ctx);
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyR') doReset();
  });

  // PLAYER_MOVED is emitted at inspector cadence; the inspector snapshot is its
  // consumer, so the event bus is load-bearing rather than decorative.
  let lastMoved: ProtolabEvents['PLAYER_MOVED'] = { x: 0, y: 0, z: 0, speed: 0 };
  bus.on('PLAYER_MOVED', (payload) => { lastMoved = payload; });
  bus.on('EXPERIMENT_RESET', ({ id }) => { console.debug(`[protolab] reset: ${id}`); });

  let sincePlayerEvent = 0;
  app.on('update', (dt: number) => {
    sincePlayerEvent += dt;
    if (sincePlayerEvent < 0.1) return;
    sincePlayerEvent = 0;
    const p = rig.player.getPosition();
    const v = rig.player.rigidbody?.linearVelocity;
    const speed = v ? Math.hypot(v.x, v.z) : 0;
    bus.emit('PLAYER_MOVED', { x: p.x, y: p.y, z: p.z, speed });
  });

  const snapshot = (): InspectorSnapshot => {
    const walkSpeed = tunables.get('player.walkSpeed');
    const movementState = lastMoved.speed < 0.2 ? 'idle' : lastMoved.speed <= walkSpeed ? 'walk' : 'jog';
    return {
      experimentId: registry.activeId(),
      position: { x: lastMoved.x, y: lastMoved.y, z: lastMoved.z },
      speed: lastMoved.speed,
      movementState,
      fps: 0, // overwritten by the inspector's own frame counter
    };
  };

  const inspectorContainer = document.getElementById('inspector');
  if (inspectorContainer) {
    mountInspector({ app, container: inspectorContainer, tunables, snapshot, onReset: doReset });
  }

  // Test hook — read by the Playwright smoke spec. Not game logic.
  // stepForward drives the controller's KeyboardMouseSource directly because its
  // keydown listener drops synthetic events unless the canvas holds pointer lock
  // (KeyboardMouseSource._onKeyDown, verified against v2.21.4) — real keyboard
  // input in a headless page never reaches it. Mission §7 permits this hook; the
  // manual gate remains the human-input proof.
  type DesktopInputLike = { _setKey(code: string, value: number): void };
  const firstCrate = () => app.root.find((node) => node.name.startsWith('crate-'))[0];
  (window as unknown as Record<string, unknown>).__protolab = {
    cratePosition: () => firstCrate()?.getPosition().clone() ?? { x: 0, y: 0, z: 0 },
    playerPosition: () => rig.player.getPosition().clone(),
    physicsAlive: () => app.systems.rigidbody?.gravity.y ?? 0,
    stepForward: (on: boolean) => {
      const input = (rig.controller as unknown as { _desktopInput: DesktopInputLike })._desktopInput;
      input._setKey('KeyW', on ? 1 : 0);
    },
    teleportPlayer: (x: number, y: number, z: number) => movePlayerTo(new Vec3(x, y, z)),
    reset: () => doReset(),
    loadExperiment: (id: string) => registry.load(id, ctx),
    activeExperiment: () => registry.activeId(),
    experiments: () => registry.ids(),
  };
}
