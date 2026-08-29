import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import { createTunables } from './core/config/tunables.ts';
import { bootRuntime } from './runtime/boot.ts';
import { createPlayerRig } from './runtime/player/third-person.ts';
import './style.css';

const canvas = document.getElementById('application-canvas') as HTMLCanvasElement;
const app = await bootRuntime(canvas);

const tunables = createTunables({
  'player.walkSpeed': { value: 5, min: 0, max: 20, step: 0.1 },
  'player.sprintSpeed': { value: 8, min: 0, max: 30, step: 0.1 },
  'player.jumpForce': { value: 600, min: 0, max: 2000, step: 10 },
  'camera.distance': { value: 5, min: 1.5, max: 15, step: 0.1 },
  'camera.sensitivity': { value: 0.15, min: 0.01, max: 1, step: 0.01 },
});

const groundMaterial = new StandardMaterial();
groundMaterial.diffuse = new Color(0.2, 0.4, 0.18);
groundMaterial.update();

const ground = new Entity('ground');
ground.setLocalScale(20, 0.2, 20);
ground.setPosition(0, -0.1, 0);
ground.addComponent('render', { type: 'box', material: groundMaterial });
ground.addComponent('collision', { type: 'box', halfExtents: new Vec3(10, 0.1, 10) });
ground.addComponent('rigidbody', { type: 'static' });
app.root.addChild(ground);

const crate = new Entity('crate');
crate.setPosition(3, 6, -3);
crate.addComponent('render', { type: 'box' });
crate.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.5, 0.5, 0.5) });
crate.addComponent('rigidbody', { type: 'dynamic', mass: 10 });
app.root.addChild(crate);

const rig = createPlayerRig(app, new Vec3(0, 1.2, 0), tunables);

tunables.subscribe((key, value) => {
  const c = rig.controller as Record<string, number>;
  if (key === 'player.walkSpeed') c.speedGround = value * 10;
  if (key === 'player.jumpForce') c.jumpForce = value;
  if (key === 'camera.distance') c.cameraDistance = value;
  if (key === 'camera.sensitivity') c.lookSens = value;
});

const light = new Entity('light');
light.addComponent('light', { type: 'directional', intensity: 2.5, castShadows: true, shadowBias: 0.2, normalOffsetBias: 0.05 });
light.setEulerAngles(45, 30, 0);
app.root.addChild(light);

// Test hook — read by the Playwright smoke spec. Not game logic.
// stepForward drives the controller's KeyboardMouseSource directly because its
// keydown listener drops synthetic events unless the canvas holds pointer lock
// (KeyboardMouseSource._onKeyDown, verified against v2.21.4) — real keyboard
// input in a headless page never reaches it. Mission §7 permits this hook; the
// manual gate remains the human-input proof.
type DesktopInputLike = { _setKey(code: string, value: number): void };
(window as unknown as Record<string, unknown>).__protolab = {
  cratePosition: () => crate.getPosition().clone(),
  playerPosition: () => rig.player.getPosition().clone(),
  physicsAlive: () => app.systems.rigidbody?.gravity.y ?? 0,
  stepForward: (on: boolean) => {
    const input = (rig.controller as unknown as { _desktopInput: DesktopInputLike })._desktopInput;
    input._setKey('KeyW', on ? 1 : 0);
  },
};
