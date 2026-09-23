import type { NodeSpec } from '../../src/core/sound-network/network.ts';

/** Sensor positions form two flankable routes between spawn and the heart. */
export const NODE_SPECS: readonly NodeSpec[] = [
  { id: 'n0', x: -8, z: 12 },
  { id: 'n1', x: 8, z: 8 },
  { id: 'n2', x: -14, z: -2 },
  { id: 'n3', x: 0, z: 0 },
  { id: 'n4', x: 14, z: -4 },
  { id: 'n5', x: -8, z: -16 },
  { id: 'n6', x: 9, z: -18 },
];

/**
 * Cluster b on the entry route. Dormant until the director's "second sensor
 * cluster" reaction is selected (MCL-85); then it listens like cluster a.
 */
export const CLUSTER_B_SPECS: readonly NodeSpec[] = [
  { id: 'b0', x: -6, z: 21 },
  { id: 'b1', x: 6, z: 19 },
  { id: 'b2', x: 0, z: 16 },
];
