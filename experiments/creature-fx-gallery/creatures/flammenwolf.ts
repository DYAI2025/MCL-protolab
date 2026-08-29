import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { AppBase } from 'playcanvas';
import { emissiveMaterial } from '../../../src/runtime/fx/emissive.ts';
import { addParticles } from '../../../src/runtime/fx/particles.ts';
import { createTrail, type Trail } from '../../../src/runtime/fx/trail.ts';
import type { CreatureHandle } from '../creature-handle.ts';

const pelt = (r: number, g: number, b: number) => {
  const m = new StandardMaterial();
  m.diffuse = new Color(r, g, b);
  m.update();
  return m;
};

/**
 * ~1.5x player scale. Fire must be visible in the open mouth and along the
 * body, embers drift upward, and a burn trail follows while it moves.
 * States: 'idle' (standing, trail cleared) and 'prowling' (circles its
 * pedestal, trail active) — both deterministic.
 */
export function buildFlammenwolf(app: AppBase, parent: Entity, position: { x: number; y: number; z: number }): CreatureHandle {
  const root = new Entity('flammenwolf');
  root.setPosition(position.x, position.y, position.z);
  parent.addChild(root);

  const wolf = new Entity('wolf');
  root.addChild(wolf);

  const charcoal = pelt(0.16, 0.12, 0.1);
  const ashen = pelt(0.28, 0.2, 0.16);

  const body = new Entity('body');
  body.setLocalScale(0.9, 0.9, 2.2);
  body.setLocalPosition(0, 1.1, 0);
  body.addComponent('render', { type: 'box', material: charcoal });
  wolf.addChild(body);

  for (const [x, z] of [[-0.32, -0.8], [0.32, -0.8], [-0.32, 0.8], [0.32, 0.8]] as const) {
    const leg = new Entity(`leg-${x}-${z}`);
    leg.setLocalScale(0.28, 0.7, 0.28);
    leg.setLocalPosition(x, 0.35, z);
    leg.addComponent('render', { type: 'box', material: ashen });
    wolf.addChild(leg);
  }

  const head = new Entity('head');
  head.setLocalScale(0.55, 0.5, 0.7);
  head.setLocalPosition(0, 1.7, -1.3);
  head.addComponent('render', { type: 'box', material: ashen });
  wolf.addChild(head);

  // Open mouth: an emissive wedge visible from the front.
  const mouthFire = emissiveMaterial(new Color(1.0, 0.45, 0.08), 4);
  const mouth = new Entity('mouth');
  mouth.setLocalScale(0.35, 0.18, 0.4);
  mouth.setLocalPosition(0, 1.55, -1.62);
  mouth.addComponent('render', { type: 'box', material: mouthFire });
  wolf.addChild(mouth);

  const spineFire = emissiveMaterial(new Color(1.0, 0.3, 0.05), 3);
  const spine = new Entity('spine');
  spine.setLocalScale(0.25, 0.2, 1.8);
  spine.setLocalPosition(0, 1.62, 0);
  spine.addComponent('render', { type: 'box', material: spineFire });
  wolf.addChild(spine);

  const embers = addParticles(wolf, 'embers', {
    numParticles: 60,
    lifetime: 1.4,
    rate: 0.02,
    emitterRadius: 0.9,
    colorCurve: [[0, 1.0, 1, 0.55], [0, 0.35, 1, 0.1], [0, 0.05, 1, 0.02]],
    alphaCurve: [0, 0.9, 1, 0],
    scaleCurve: [0, 0.09, 1, 0.02],
    velocity: new Vec3(0, 1.6, 0),
  });
  embers.setLocalPosition(0, 1.4, 0);

  const glowLight = new Entity('glow-light');
  glowLight.addComponent('light', {
    type: 'omni', color: new Color(1.0, 0.42, 0.1), intensity: 1.8, range: 7, castShadows: false,
  });
  glowLight.setLocalPosition(0, 1.4, 0);
  wolf.addChild(glowLight);

  const trail: Trail = createTrail(app, {
    maxPoints: 40,
    width: 0.35,
    color: new Color(1.0, 0.35, 0.06),
    minDistance: 0.12,
  });
  let trailEnabled = true;

  const STATES = ['idle', 'prowling'];
  let current = 'idle';
  let angle = 0;
  const RADIUS = 3.2;

  return {
    id: 'flammenwolf',
    root,
    states: () => [...STATES],
    state: () => current,
    setState(state) {
      if (!STATES.includes(state)) throw new Error(`flammenwolf: unknown state "${state}". Known: ${STATES.join(', ')}`);
      current = state;
      if (state === 'idle') {
        trail.clear();
        wolf.setLocalPosition(0, 0, 0);
        wolf.setLocalEulerAngles(0, 0, 0);
        angle = 0;
      }
    },
    setLayer(layer, enabled) {
      if (layer === 'emissive') { mouth.enabled = enabled; spine.enabled = enabled; }
      if (layer === 'particles') embers.enabled = enabled;
      if (layer === 'light') glowLight.enabled = enabled;
      if (layer === 'trail') {
        trailEnabled = enabled;
        if (!enabled) trail.clear();
      }
    },
    update(dt) {
      if (current !== 'prowling') return;
      angle += dt * 0.7;
      wolf.setLocalPosition(Math.cos(angle) * RADIUS, 0, Math.sin(angle) * RADIUS);
      wolf.setLocalEulerAngles(0, -(angle * 180) / Math.PI, 0);
      if (trailEnabled) {
        const p = wolf.getPosition();
        trail.push(new Vec3(p.x, p.y + 0.25, p.z));
      }
    },
    destroy() {
      trail.destroy();
      root.destroy();
    },
  };
}
