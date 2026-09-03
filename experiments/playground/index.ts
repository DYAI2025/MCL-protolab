import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { Experiment, ExperimentContext } from '../../src/core/experiments/types.ts';
import type { SceneContext } from '../../src/runtime/scene-context.ts';

interface Restorable { entity: Entity; position: Vec3; }

const material = (r: number, g: number, b: number) => {
  const m = new StandardMaterial();
  m.diffuse = new Color(r, g, b);
  m.update();
  return m;
};

export function createPlaygroundExperiment(): Experiment {
  let root: Entity | null = null;
  let restorables: Restorable[] = [];
  const SPAWN = new Vec3(0, 1.2, 0);

  return {
    id: 'playground',
    tunables: { 'player.walkSpeed': 5, 'player.sprintSpeed': 8, 'player.jumpForce': 600, 'camera.distance': 5, 'camera.sensitivity': 0.15 },

    init(ctx: ExperimentContext) {
      const scene = ctx.scene as SceneContext;
      root = new Entity('playground');
      scene.app.root.addChild(root);
      restorables = [];

      const ground = new Entity('ground');
      ground.setLocalScale(40, 0.4, 40);
      ground.setPosition(0, -0.2, 0);
      ground.addComponent('render', { type: 'box', material: material(0.22, 0.38, 0.2) });
      ground.addComponent('collision', { type: 'box', halfExtents: new Vec3(20, 0.2, 20) });
      ground.addComponent('rigidbody', { type: 'static' });
      root.addChild(ground);

      // Ramp — a rotated static box, so the ground check has a real slope to handle.
      const ramp = new Entity('ramp');
      ramp.setLocalScale(6, 0.4, 10);
      ramp.setPosition(9, 1.2, -4);
      ramp.setEulerAngles(-14, 0, 0);
      ramp.addComponent('render', { type: 'box', material: material(0.45, 0.42, 0.38) });
      ramp.addComponent('collision', { type: 'box', halfExtents: new Vec3(3, 0.2, 5) });
      ramp.addComponent('rigidbody', { type: 'static' });
      root.addChild(ramp);

      // Static obstacles.
      for (const [x, z, h] of [[-6, -6, 2], [-9, 3, 3], [5, 7, 1.5], [12, 5, 4]] as const) {
        const block = new Entity(`obstacle-${x}-${z}`);
        block.setLocalScale(2, h, 2);
        block.setPosition(x, h / 2, z);
        block.addComponent('render', { type: 'box', material: material(0.5, 0.45, 0.4) });
        block.addComponent('collision', { type: 'box', halfExtents: new Vec3(1, h / 2, 1) });
        block.addComponent('rigidbody', { type: 'static' });
        root.addChild(block);
      }

      // Orientation landmarks: coloured pillars at the cardinal directions.
      const marks: Array<[number, number, [number, number, number]]> = [
        [0, -18, [0.8, 0.2, 0.2]], [0, 18, [0.2, 0.4, 0.8]],
        [-18, 0, [0.85, 0.75, 0.2]], [18, 0, [0.2, 0.7, 0.4]],
      ];
      for (const [x, z, rgb] of marks) {
        const pillar = new Entity(`landmark-${x}-${z}`);
        pillar.setLocalScale(1, 8, 1);
        pillar.setPosition(x, 4, z);
        pillar.addComponent('render', { type: 'cylinder', material: material(...rgb) });
        root.addChild(pillar);
      }

      // Dynamic props — proof that physics is stepping.
      for (const [x, z] of [[2, -3], [3.2, -3.6], [2.6, -4.4]] as const) {
        const crate = new Entity(`crate-${x}-${z}`);
        const position = new Vec3(x, 3, z);
        crate.setPosition(position);
        crate.addComponent('render', { type: 'box', material: material(0.65, 0.5, 0.3) });
        crate.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.5, 0.5, 0.5) });
        crate.addComponent('rigidbody', { type: 'dynamic', mass: 8, friction: 0.6, restitution: 0.1 });
        root.addChild(crate);
        restorables.push({ entity: crate, position: position.clone() });
      }

      const key = new Entity('key-light');
      key.addComponent('light', { type: 'directional', intensity: 2.4, castShadows: true, shadowDistance: 60, shadowBias: 0.2, normalOffsetBias: 0.05 });
      key.setEulerAngles(48, 34, 0);
      root.addChild(key);

      scene.movePlayerTo(SPAWN);
    },

    reset(ctx: ExperimentContext) {
      const scene = ctx.scene as SceneContext;
      for (const { entity, position } of restorables) {
        entity.rigidbody?.teleport(position);
        // linearVelocity/angularVelocity silently no-op on non-dynamic bodies —
        // these are dynamic, so this is the correct way to stop them dead.
        if (entity.rigidbody) {
          entity.rigidbody.linearVelocity = Vec3.ZERO;
          entity.rigidbody.angularVelocity = Vec3.ZERO;
        }
      }
      scene.movePlayerTo(SPAWN);
    },

    destroy() {
      root?.destroy();
      root = null;
      restorables = [];
    },
  };
}
