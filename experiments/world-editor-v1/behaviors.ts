import { Color, Entity, Vec3 } from 'playcanvas';
import type { AppBase } from 'playcanvas';
import { createSoundNetwork, type SoundNetwork } from '../../src/core/sound-network/network.ts';
import { worldBoundsY } from '../../src/runtime/assets/fit.ts';
import { emissiveMaterial } from '../../src/runtime/fx/emissive.ts';
import { addParticles } from '../../src/runtime/fx/particles.ts';
import { createTrail, type Trail } from '../../src/runtime/fx/trail.ts';

// Behavior presets for placed creatures. Deliberately experiment-local (the
// gallery/forest stay untouched); patterns are lifted from zhalm-forest-v1 and
// creature-fx-gallery. Prototype simplification, documented: Mugosh horn
// states react to player DISTANCE as a proxy for the relationship system —
// the real relationship model is MCL-7 design work, not this editor's job.

export type BehaviorPreset =
  | 'mugosh-guardian' | 'flammenwolf-hostile' | 'veras-gentle'
  | 'zhalm-node' | 'zhalm-guardian';

export const BEHAVIOR_PRESETS: BehaviorPreset[] = [
  'mugosh-guardian', 'flammenwolf-hostile', 'veras-gentle', 'zhalm-node', 'zhalm-guardian',
];

/** Default behavior offered in the palette per asset_id prefix. */
export function defaultBehaviorFor(assetId: string): BehaviorPreset | undefined {
  if (assetId.startsWith('creature.mugosh.') || assetId.startsWith('creature.eis-mugosh.')) return 'mugosh-guardian';
  if (assetId.startsWith('creature.flammenwolf.')) return 'flammenwolf-hostile';
  if (assetId.startsWith('creature.veras.')) return 'veras-gentle';
  if (assetId.startsWith('creature.zhalm.')) return 'zhalm-guardian';
  if (assetId.startsWith('creature.steinwolf.')) return 'flammenwolf-hostile';
  if (assetId.includes('sensor-node')) return 'zhalm-node';
  return undefined;
}

const HORN_STATES: Record<string, { color: Color; intensity: number }> = {
  calm: { color: new Color(0.25, 0.5, 1.0), intensity: 2.2 },
  wary: { color: new Color(0.95, 0.97, 1.0), intensity: 3.5 },
  hostile: { color: new Color(1.0, 0.08, 0.05), intensity: 4.5 },
};

const NODE_COLOR = new Color(0.35, 0.05, 0.6);
const NODE_BASE = 0.5;
const NODE_PEAK = 5;

interface Actor {
  entity: Entity;
  preset: BehaviorPreset;
  home: Vec3;
  headOffset: number;
  // per-preset scratch state
  phase: number;
  overlay?: Entity;
  light?: Entity;
  trail?: Trail;
  nodeId?: string;
}

export interface BehaviorSystemOptions {
  app: AppBase;
  root: Entity;
  getPlayerPosition(): Vec3 | null;
  getTunable(key: string): number;
  onCaught(): void;
}

export function createBehaviorSystem(options: BehaviorSystemOptions) {
  const { app, root, getPlayerPosition, getTunable, onCaught } = options;
  const actors: Actor[] = [];
  let network: SoundNetwork | null = null;
  let playing = false;
  let nodeCounter = 0;

  const attachOverlays = (actor: Actor): void => {
    if (actor.preset === 'mugosh-guardian') {
      const overlay = new Entity('horn-overlay');
      overlay.setLocalScale(0.22, 0.7, 0.22);
      overlay.addComponent('render', { type: 'cone', material: emissiveMaterial(HORN_STATES['calm']!.color, HORN_STATES['calm']!.intensity) });
      root.addChild(overlay);
      const light = new Entity('horn-light');
      light.addComponent('light', { type: 'omni', color: HORN_STATES['calm']!.color, intensity: 1.2, range: 7, castShadows: false });
      root.addChild(light);
      actor.overlay = overlay;
      actor.light = light;
    }
    if (actor.preset === 'flammenwolf-hostile') {
      const embers = addParticles(root, 'wolf-embers', {
        numParticles: 40, lifetime: 1.2, rate: 0.03, emitterRadius: 0.7,
        colorCurve: [[0, 1.0, 1, 0.55], [0, 0.35, 1, 0.1], [0, 0.05, 1, 0.02]],
        alphaCurve: [0, 0.8, 1, 0],
        scaleCurve: [0, 0.08, 1, 0.02],
        velocity: new Vec3(0, 1.2, 0),
      });
      const light = new Entity('wolf-light');
      light.addComponent('light', { type: 'omni', color: new Color(1.0, 0.42, 0.1), intensity: 1.5, range: 6, castShadows: false });
      root.addChild(light);
      actor.overlay = embers;
      actor.light = light;
      actor.trail = createTrail(app, { maxPoints: 36, width: 0.3, color: new Color(1.0, 0.35, 0.06), minDistance: 0.12 });
    }
    if (actor.preset === 'veras-gentle') {
      const light = new Entity('veras-light');
      light.addComponent('light', { type: 'omni', color: new Color(0.65, 1.0, 0.8), intensity: 1.1, range: 5, castShadows: false });
      root.addChild(light);
      actor.light = light;
      actor.trail = createTrail(app, { maxPoints: 44, width: 0.16, color: new Color(0.55, 0.95, 0.7), minDistance: 0.08 });
    }
    if (actor.preset === 'zhalm-node') {
      const orb = new Entity('node-glow');
      orb.setLocalScale(0.45, 0.45, 0.45);
      orb.addComponent('render', { type: 'sphere', material: emissiveMaterial(NODE_COLOR, NODE_BASE) });
      root.addChild(orb);
      actor.overlay = orb;
      actor.nodeId = `en${nodeCounter++}`;
    }
    if (actor.preset === 'zhalm-guardian') {
      const core = new Entity('zhalm-core');
      core.setLocalScale(0.5, 0.5, 0.5);
      core.addComponent('render', { type: 'sphere', material: emissiveMaterial(NODE_COLOR, 2.5) });
      root.addChild(core);
      const light = new Entity('zhalm-light');
      light.addComponent('light', { type: 'omni', color: NODE_COLOR, intensity: 1.2, range: 8, castShadows: false });
      root.addChild(light);
      actor.overlay = core;
      actor.light = light;
    }
  };

  const syncOverlays = (actor: Actor): void => {
    const p = actor.entity.getPosition();
    const top = p.y + actor.headOffset;
    actor.overlay?.setPosition(p.x, actor.preset === 'zhalm-node' ? p.y + Math.max(actor.headOffset - 0.1, 0.4) : top + 0.25, p.z);
    actor.light?.setPosition(p.x, top + 0.3, p.z);
  };

  const setHorn = (actor: Actor, state: keyof typeof HORN_STATES): void => {
    const spec = HORN_STATES[state]!;
    const render = actor.overlay?.render;
    const material = render?.meshInstances[0]?.material;
    if (material && 'emissive' in material) {
      const std = material as unknown as { emissive: Color; emissiveIntensity: number; update(): void };
      if (!std.emissive.equals(spec.color)) {
        std.emissive = spec.color;
        std.emissiveIntensity = spec.intensity;
        std.update();
        if (actor.light?.light) actor.light.light.color = spec.color;
      }
    }
  };

  const moveToward = (entity: Entity, target: { x: number; z: number }, speed: number, dt: number): number => {
    const p = entity.getPosition();
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 0.3) {
      const step = Math.min(speed * dt, distance);
      entity.setPosition(p.x + (dx / distance) * step, p.y, p.z + (dz / distance) * step);
      entity.setEulerAngles(0, (-Math.atan2(dz, dx) * 180) / Math.PI + 90, 0);
    }
    return distance;
  };

  return {
    add(entity: Entity, preset: BehaviorPreset): Actor {
      const bounds = worldBoundsY(entity);
      const actor: Actor = {
        entity, preset,
        home: entity.getPosition().clone(),
        headOffset: Number.isFinite(bounds.maxY) ? bounds.maxY - entity.getPosition().y : 2,
        phase: actors.length * 1.7, // deterministic desync between same-preset actors
      };
      attachOverlays(actor);
      syncOverlays(actor);
      actors.push(actor);
      return actor;
    },

    remove(entity: Entity): void {
      const index = actors.findIndex((a) => a.entity === entity);
      if (index < 0) return;
      const actor = actors[index]!;
      actor.overlay?.destroy();
      actor.light?.destroy();
      actor.trail?.destroy();
      actors.splice(index, 1);
    },

    /** Rebuild the shared sound network from all placed zhalm nodes. */
    startPlay(): void {
      playing = true;
      const nodes = actors
        .filter((a) => a.preset === 'zhalm-node')
        .map((a) => {
          const p = a.entity.getPosition();
          return { id: a.nodeId!, x: p.x, z: p.z };
        });
      network = createSoundNetwork(nodes, {
        linkRange: getTunable('zhalm.linkRange'),
        pulseSpeed: getTunable('zhalm.pulseSpeed'),
        suspicionThreshold: 0.5,
        alertThreshold: 1.6,
        decayPerSecond: getTunable('zhalm.alertDecay'),
        energyDecayPerSecond: 0.8,
      });
    },

    stopPlay(): void {
      playing = false;
      network = null;
      for (const actor of actors) {
        actor.entity.setPosition(actor.home);
        actor.trail?.clear();
        if (actor.preset === 'mugosh-guardian') setHorn(actor, 'calm');
        syncOverlays(actor);
      }
    },

    noiseAt(x: number, z: number, radius: number): void {
      network?.noiseAt(x, z, radius);
    },

    level: () => network?.level() ?? 'calm',
    playing: () => playing,
    actorCount: () => actors.length,

    update(dt: number): void {
      if (!playing) return;
      network?.update(dt);
      const player = getPlayerPosition();

      for (const actor of actors) {
        actor.phase += dt;
        const p = actor.entity.getPosition();

        if (actor.preset === 'mugosh-guardian') {
          const distance = player ? Math.hypot(player.x - p.x, player.z - p.z) : Infinity;
          const state = distance < 6 ? 'hostile' : distance < 12 ? 'wary' : 'calm';
          setHorn(actor, state);
          if (state === 'hostile' && player) {
            moveToward(actor.entity, player, 2.2, dt);
          } else {
            moveToward(actor.entity, {
              x: actor.home.x + Math.cos(actor.phase * 0.2) * 3,
              z: actor.home.z + Math.sin(actor.phase * 0.2) * 3,
            }, 1.0, dt);
          }
        }

        if (actor.preset === 'flammenwolf-hostile') {
          const distance = player ? Math.hypot(player.x - p.x, player.z - p.z) : Infinity;
          const homeDistance = Math.hypot(actor.home.x - p.x, actor.home.z - p.z);
          if (player && distance < 10 && homeDistance < 16) {
            moveToward(actor.entity, player, 5.5, dt);
            if (distance < 1.2) onCaught();
          } else {
            moveToward(actor.entity, {
              x: actor.home.x + Math.cos(actor.phase * 0.35) * 4,
              z: actor.home.z + Math.sin(actor.phase * 0.35) * 4,
            }, 1.6, dt);
          }
          actor.trail?.push(new Vec3(p.x, p.y + 0.2, p.z));
        }

        if (actor.preset === 'veras-gentle') {
          const drift = actor.phase * 0.4;
          actor.entity.setPosition(
            actor.home.x + Math.cos(drift) * 2,
            actor.home.y + 1.2 + Math.sin(actor.phase * 1.3) * 0.25,
            actor.home.z + Math.sin(drift) * 2,
          );
          const distance = player ? Math.hypot(player.x - p.x, player.z - p.z) : Infinity;
          if (actor.light?.light) actor.light.light.intensity = distance < 4 ? 2.4 : 1.1;
          actor.trail?.push(actor.entity.getPosition().clone());
        }

        if (actor.preset === 'zhalm-node' && network && actor.nodeId) {
          const energy = network.nodeEnergy(actor.nodeId);
          const render = actor.overlay?.render;
          const material = render?.meshInstances[0]?.material as { emissiveIntensity: number; update(): void } | undefined;
          if (material) {
            const target = NODE_BASE + energy * (NODE_PEAK - NODE_BASE);
            if (Math.abs(material.emissiveIntensity - target) > 0.05) {
              material.emissiveIntensity = target;
              material.update();
            }
          }
        }

        if (actor.preset === 'zhalm-guardian' && network) {
          const alertLevel = network.level();
          let target: { x: number; z: number } | null = null;
          let speed = 0;
          if (alertLevel === 'calm') {
            target = { x: actor.home.x + Math.cos(actor.phase * 0.25) * 3, z: actor.home.z + Math.sin(actor.phase * 0.25) * 3 };
            speed = 1.2;
          } else if (alertLevel === 'suspicious') {
            target = network.lastNoise();
            speed = getTunable('zhalm.investigateSpeed');
          } else if (player) {
            const toPlayer = Math.hypot(player.x - p.x, player.z - p.z);
            target = toPlayer < 22 ? { x: player.x, z: player.z } : network.lastNoise();
            speed = getTunable('zhalm.chaseSpeed');
          }
          if (target) moveToward(actor.entity, target, speed, dt);
          if (player && Math.hypot(player.x - p.x, player.z - p.z) < getTunable('zhalm.catchDistance')) onCaught();
        }

        syncOverlays(actor);
      }
    },

    destroy(): void {
      for (const actor of [...actors]) this.remove(actor.entity);
      network = null;
      playing = false;
    },
  };
}

export type BehaviorSystem = ReturnType<typeof createBehaviorSystem>;
