/**
 * Pure sound-network logic for the Zhalm/Druhen sensor colony. No engine
 * imports — unit-tested without a browser. The scene layer feeds it player
 * noise and renders node energy / pulse hops / alert level.
 */

export interface NodeSpec { id: string; x: number; z: number }

export type AlertLevel = 'calm' | 'suspicious' | 'alerted';

export interface NetworkOptions {
  /** Nodes closer than this are linked; pulses travel only along links. */
  linkRange: number;
  /** World units per second a pulse travels between nodes. */
  pulseSpeed: number;
  suspicionThreshold: number;
  alertThreshold: number;
  /** Stimulation lost per quiet second. */
  decayPerSecond: number;
  /** Node visual energy lost per second. */
  energyDecayPerSecond: number;
}

export interface PulseHop { from: string; to: string }

interface Pulse { from: string; to: string; arriveAt: number; energy: number }

const HOP_ATTENUATION = 0.6;
const HOP_FLOOR = 0.2; // pulses below this die — guarantees cascades terminate on cycles

export function createSoundNetwork(nodes: readonly NodeSpec[], opts: NetworkOptions) {
  const energy = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const neighbours = new Map<string, string[]>();
  for (const a of nodes) {
    const links: string[] = [];
    for (const b of nodes) {
      if (a.id === b.id) continue;
      if (Math.hypot(a.x - b.x, a.z - b.z) <= opts.linkRange) links.push(b.id);
    }
    neighbours.set(a.id, links);
  }

  let now = 0;
  let stimulation = 0;
  let last: { x: number; z: number } | null = null;
  let pulses: Pulse[] = [];

  const schedule = (fromId: string, pulseEnergy: number, excludeId?: string): void => {
    if (pulseEnergy < HOP_FLOOR) return;
    const from = byId.get(fromId);
    if (!from) return;
    for (const toId of neighbours.get(fromId) ?? []) {
      if (toId === excludeId) continue;
      const to = byId.get(toId);
      if (!to) continue;
      const travel = Math.hypot(from.x - to.x, from.z - to.z) / opts.pulseSpeed;
      pulses.push({ from: fromId, to: toId, arriveAt: now + travel, energy: pulseEnergy });
    }
  };

  return {
    noiseAt(x: number, z: number, radius: number): void {
      let heard = false;
      for (const node of nodes) {
        const distance = Math.hypot(node.x - x, node.z - z);
        if (distance > radius) continue;
        heard = true;
        const closeness = 1 - distance / radius; // 1 at the node, 0 at the edge
        energy.set(node.id, Math.max(energy.get(node.id) ?? 0, 1 - (1 - closeness) * 0.5));
        stimulation += closeness;
        schedule(node.id, (energy.get(node.id) ?? 0) * HOP_ATTENUATION);
      }
      if (heard) last = { x, z };
    },

    update(dt: number): PulseHop[] {
      now += dt;
      stimulation = Math.max(0, stimulation - opts.decayPerSecond * dt);
      for (const [id, value] of energy) {
        energy.set(id, Math.max(0, value - opts.energyDecayPerSecond * dt));
      }
      const arrived = pulses.filter((p) => p.arriveAt <= now);
      pulses = pulses.filter((p) => p.arriveAt > now);
      const hops: PulseHop[] = [];
      for (const pulse of arrived) {
        energy.set(pulse.to, Math.max(energy.get(pulse.to) ?? 0, pulse.energy));
        hops.push({ from: pulse.from, to: pulse.to });
        schedule(pulse.to, pulse.energy * HOP_ATTENUATION, pulse.from);
      }
      return hops;
    },

    level(): AlertLevel {
      if (stimulation >= opts.alertThreshold) return 'alerted';
      if (stimulation >= opts.suspicionThreshold) return 'suspicious';
      return 'calm';
    },

    stimulation: () => stimulation,
    lastNoise: () => (last ? { ...last } : null),
    nodeEnergy: (id: string) => energy.get(id) ?? 0,

    reset(): void {
      stimulation = 0;
      last = null;
      pulses = [];
      for (const id of energy.keys()) energy.set(id, 0);
    },
  };
}

export type SoundNetwork = ReturnType<typeof createSoundNetwork>;
