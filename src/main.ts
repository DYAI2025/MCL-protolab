import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import { bootRuntime } from './runtime/boot.ts';
import './style.css';

const canvas = document.getElementById('application-canvas') as HTMLCanvasElement;
const app = await bootRuntime(canvas);

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
crate.setPosition(0, 6, 0);
crate.addComponent('render', { type: 'box' });
crate.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.5, 0.5, 0.5) });
crate.addComponent('rigidbody', { type: 'dynamic', mass: 10 });
app.root.addChild(crate);

const camera = new Entity('camera');
camera.addComponent('camera', { clearColor: new Color(0.48, 0.72, 0.9) });
camera.setPosition(0, 4, 10);
camera.lookAt(0, 1, 0);
app.root.addChild(camera);

const light = new Entity('light');
light.addComponent('light', { type: 'directional', intensity: 2.5, castShadows: true, shadowBias: 0.2, normalOffsetBias: 0.05 });
light.setEulerAngles(45, 30, 0);
app.root.addChild(light);

// Test hook — read by the Playwright smoke spec. Not game logic.
(window as unknown as Record<string, unknown>).__protolab = {
  cratePosition: () => crate.getPosition().clone(),
  physicsAlive: () => app.systems.rigidbody?.gravity.y ?? 0,
};
