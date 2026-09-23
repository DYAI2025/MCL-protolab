import type { JsonObject, WorldEvent } from '../../../src/core/generative-world/contracts.ts';
import type { NodeSpec } from '../../../src/core/sound-network/network.ts';

/**
 * Bridge from the Zhalm sound network to observed WorldEvents (MCL-85).
 * Pure: ids are a per-session sequence, timestamps come from an injected clock.
 */

const ZHALM_SOURCE = 'MLOA:32735234#Zhalm-Druhen';
const FOREST = 'zhalm-forest';

export const sensorEntityRef = (nodeId: string): string => `zhalm-sensor-${nodeId}`;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The hearing rule of createSoundNetwork().noiseAt: a node hears noise within the radius. */
export function heardSensors(nodes: readonly NodeSpec[], x: number, z: number, radius: number): string[] {
  return nodes.filter((node) => Math.hypot(node.x - x, node.z - z) <= radius).map((node) => node.id);
}

export function createZhalmEventFactory(clock: () => string) {
  let sequence = 0;

  const observed = (eventType: string, actorRefs: string[], payload: JsonObject): WorldEvent => {
    sequence += 1;
    return {
      event_id: `zhalm-evt-${sequence}`,
      event_type: eventType,
      timestamp: clock(),
      actor_refs: actorRefs,
      location_ref: FOREST,
      payload,
      source_refs: [ZHALM_SOURCE],
      evidence_class: 'observed_gameplay',
    };
  };

  return {
    noiseEmitted(x: number, z: number, radius: number, heardNodeIds: readonly string[]): WorldEvent {
      return observed('NOISE_EMITTED', ['player'], {
        x: round2(x),
        z: round2(z),
        radius: round2(radius),
        heard_by: heardNodeIds.map(sensorEntityRef),
      });
    },

    sensorTriggered(nodeId: string, causeEventId: string): WorldEvent {
      return observed('SENSOR_TRIGGERED', [sensorEntityRef(nodeId)], { cause_event_ref: causeEventId });
    },

    networkAlert(level: string, origin: { x: number; z: number }, triggeredNodeIds: readonly string[]): WorldEvent {
      return observed('NETWORK_ALERT', triggeredNodeIds.map(sensorEntityRef), {
        level,
        origin: { x: round2(origin.x), z: round2(origin.z) },
      });
    },
  };
}

export type ZhalmEventFactory = ReturnType<typeof createZhalmEventFactory>;
