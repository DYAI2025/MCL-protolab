import { Color, Entity, Vec3 } from 'playcanvas';
import type { AppBase } from 'playcanvas';
import { emissiveMaterial, translucentMaterial } from '../../../src/runtime/fx/emissive.ts';
import { addParticles } from '../../../src/runtime/fx/particles.ts';
import { createTrail, type Trail } from '../../../src/runtime/fx/trail.ts';
import type { CreatureHandle } from '../creature-handle.ts';

/**
 * Core is player-head-sized; the glow may read larger than the core. Must read
 * benevolent/ethereal — translucent white-green shell over a small luminous
 * heart, internal drifting particles, a soft trail and a gentle omni light.
 * States: 'ambient' (hovers with a slow bob) and 'drifting' (slow orbit with
 * trail) — both deterministic.
 */
export function buildVeras(app: AppBase, parent: Entity, position: { x: number; y: number; z: number }): CreatureHandle {
  const root = new Entity('veras');
  root.setPosition(position.x, position.y, position.z);
  parent.addChild(root);

  const wisp = new Entity('wisp');
  wisp.setLocalPosition(0, 1.6, 0);
  root.addChild(wisp);

  // Translucent shell — depthWrite false so it reads ethereal, not like a
  // generic opaque glowing ball.
  const shell = new Entity('shell');
  shell.setLocalScale(0.7, 0.7, 0.7);
  shell.addComponent('render', {
    type: 'sphere',
    material: translucentMaterial(new Color(0.85, 1.0, 0.9), 0.32),
  });
  wisp.addChild(shell);

  const heart = new Entity('heart');
  heart.setLocalScale(0.26, 0.26, 0.26);
  heart.addComponent('render', {
    type: 'sphere',
    material: emissiveMaterial(new Color(0.6, 1.0, 0.75), 4),
  });
  wisp.addChild(heart);

  const motes = addParticles(wisp, 'motes', {
    numParticles: 40,
    lifetime: 2.2,
    rate: 0.05,
    emitterRadius: 0.32,
    colorCurve: [[0, 0.7, 1, 0.5], [0, 1.0, 1, 0.9], [0, 0.8, 1, 0.6]],
    alphaCurve: [0, 0, 0.3, 0.8, 1, 0],
    scaleCurve: [0, 0.03, 1, 0.06],
    velocity: new Vec3(0, 0.35, 0),
  });

  const glow = new Entity('glow');
  glow.addComponent('light', {
    type: 'omni', color: new Color(0.65, 1.0, 0.8), intensity: 1.2, range: 5, castShadows: false,
  });
  wisp.addChild(glow);

  const trail: Trail = createTrail(app, {
    maxPoints: 50,
    width: 0.18,
    color: new Color(0.55, 0.95, 0.7),
    minDistance: 0.08,
  });
  let trailEnabled = true;

  const STATES = ['ambient', 'drifting'];
  let current = 'ambient';
  let t = 0;
  const RADIUS = 2.4;

  return {
    id: 'veras',
    root,
    states: () => [...STATES],
    state: () => current,
    setState(state) {
      if (!STATES.includes(state)) throw new Error(`veras: unknown state "${state}". Known: ${STATES.join(', ')}`);
      current = state;
      if (state === 'ambient') {
        trail.clear();
        wisp.setLocalPosition(0, 1.6, 0);
        t = 0;
      }
    },
    setLayer(layer, enabled) {
      if (layer === 'emissive') heart.enabled = enabled;
      if (layer === 'particles') motes.enabled = enabled;
      if (layer === 'light') glow.enabled = enabled;
      if (layer === 'trail') {
        trailEnabled = enabled;
        if (!enabled) trail.clear();
      }
    },
    update(dt) {
      t += dt;
      if (current === 'ambient') {
        wisp.setLocalPosition(0, 1.6 + Math.sin(t * 1.4) * 0.18, 0);
        return;
      }
      // drifting: slow orbit at varying height
      const a = t * 0.5;
      wisp.setLocalPosition(Math.cos(a) * RADIUS, 1.6 + Math.sin(t * 1.1) * 0.3, Math.sin(a) * RADIUS);
      if (trailEnabled) {
        const p = wisp.getPosition();
        trail.push(new Vec3(p.x, p.y, p.z));
      }
    },
    destroy() {
      trail.destroy();
      root.destroy();
    },
  };
}
