import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { AppBase } from 'playcanvas';
import { ThirdPersonController } from 'playcanvas/scripts/esm/third-person-controller.mjs';

export interface PlayerRig { player: Entity; camera: Entity; controller: unknown }

/**
 * ThirdPersonController requirements, verified against the v2.21.4 source:
 *  - the `camera` attribute is REQUIRED; initialize() throws without it;
 *  - the camera MUST be a top-level entity, not a child of the character;
 *  - it auto-adds a capsule collision {radius: 0.5, height: 2} and a dynamic
 *    rigidbody {mass: 100, angularFactor: Vec3.ZERO} if they are absent.
 */
export function createPlayerRig(app: AppBase, spawn: Vec3, tunables: { get(key: string): number }): PlayerRig {
  const camera = new Entity('camera');
  camera.addComponent('camera', { clearColor: new Color(0.48, 0.72, 0.9), farClip: 500 });
  app.root.addChild(camera); // top-level, NOT parented to the player

  const bodyMaterial = new StandardMaterial();
  bodyMaterial.diffuse = new Color(0.85, 0.78, 0.6);
  bodyMaterial.update();

  const player = new Entity('player');
  player.setPosition(spawn);
  player.addComponent('collision', { type: 'capsule', radius: 0.5, height: 2 });
  player.addComponent('rigidbody', {
    type: 'dynamic', mass: 100, linearDamping: 0, angularDamping: 0,
    angularFactor: Vec3.ZERO, friction: 0.5, restitution: 0,
  });

  // Visible placeholder capsule as a child, so the controller can turn the model
  // independently of the physics body.
  const model = new Entity('player-model');
  model.addComponent('render', { type: 'capsule', material: bodyMaterial });
  player.addChild(model);
  app.root.addChild(player);

  player.addComponent('script');
  const controller = player.script?.create(ThirdPersonController, {
    properties: {
      camera,
      characterModel: model,
      speedGround: tunables.get('player.walkSpeed') * 10,
      sprintMult: tunables.get('player.sprintSpeed') / Math.max(tunables.get('player.walkSpeed'), 0.001),
      jumpForce: tunables.get('player.jumpForce'),
      cameraDistance: tunables.get('camera.distance'),
      lookSens: tunables.get('camera.sensitivity'),
      // Action-adventure framing, not shooter over-the-shoulder (mission §6 C).
      initialPitch: 20, pitchMin: -30, pitchMax: 75, cameraHeight: 1.4,
    },
  });

  return { player, camera, controller };
}
