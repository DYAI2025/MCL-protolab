import { describe, expect, it } from 'vitest';
import { createSoundNetwork } from './network.ts';

// A small line of three nodes, 10 units apart: n0 —10— n1 —10— n2.
const NODES = [
  { id: 'n0', x: 0, z: 0 },
  { id: 'n1', x: 10, z: 0 },
  { id: 'n2', x: 20, z: 0 },
];

const OPTS = {
  linkRange: 14,       // n0<->n1 and n1<->n2 linked; n0<->n2 (20) not
  pulseSpeed: 10,      // a 10-unit hop arrives after 1s
  suspicionThreshold: 0.5,
  alertThreshold: 1.6,
  decayPerSecond: 0.12,
  energyDecayPerSecond: 0.8,
};

describe('createSoundNetwork', () => {
  it('starts calm with zero stimulation and cold nodes', () => {
    const net = createSoundNetwork(NODES, OPTS);
    expect(net.level()).toBe('calm');
    expect(net.stimulation()).toBe(0);
    expect(net.nodeEnergy('n0')).toBe(0);
  });

  it('noise inside a node radius heats that node and records the noise position', () => {
    const net = createSoundNetwork(NODES, OPTS);
    net.noiseAt(2, 0, 5); // 2 units from n0, radius 5 → heard
    expect(net.nodeEnergy('n0')).toBeGreaterThan(0.5);
    expect(net.nodeEnergy('n1')).toBe(0); // 8 units away, radius 5 → not directly heard
    expect(net.lastNoise()).toEqual({ x: 2, z: 0 });
  });

  it('noise outside every radius does nothing', () => {
    const net = createSoundNetwork(NODES, OPTS);
    net.noiseAt(50, 50, 5);
    expect(net.stimulation()).toBe(0);
    expect(net.lastNoise()).toBeNull();
  });

  it('a pulse travels to the linked neighbour at pulseSpeed and reports the hop', () => {
    const net = createSoundNetwork(NODES, OPTS);
    net.noiseAt(0, 0, 5); // hits n0 exactly
    expect(net.nodeEnergy('n1')).toBe(0);
    const early = net.update(0.5); // pulse mid-flight
    expect(early).toEqual([]);
    const arrivals = net.update(0.6); // 1.1s total > 1s hop time
    expect(arrivals.some((a) => a.from === 'n0' && a.to === 'n1')).toBe(true);
    expect(net.nodeEnergy('n1')).toBeGreaterThan(0.3);
  });

  it('pulses do not jump gaps beyond linkRange', () => {
    const net = createSoundNetwork(NODES, { ...OPTS, linkRange: 8 });
    net.noiseAt(0, 0, 5);
    net.update(5); // ample time
    expect(net.nodeEnergy('n1')).toBe(0);
    expect(net.nodeEnergy('n2')).toBe(0);
  });

  it('propagation terminates on a cyclic network instead of ringing forever', () => {
    const triangle = [
      { id: 'a', x: 0, z: 0 },
      { id: 'b', x: 8, z: 0 },
      { id: 'c', x: 4, z: 6 },
    ];
    const net = createSoundNetwork(triangle, { ...OPTS, linkRange: 12 });
    net.noiseAt(0, 0, 4);
    let hops = 0;
    for (let t = 0; t < 30; t++) hops += net.update(0.5).length;
    expect(hops).toBeLessThan(12); // finite cascade, not an endless echo
  });

  it('repeated noise escalates calm -> suspicious -> alerted', () => {
    const net = createSoundNetwork(NODES, OPTS);
    net.noiseAt(0, 0, 6);
    expect(net.level()).toBe('suspicious');
    net.noiseAt(0, 0, 6);
    net.noiseAt(0, 0, 6);
    expect(net.level()).toBe('alerted');
  });

  it('stimulation decays back to calm over quiet time', () => {
    const net = createSoundNetwork(NODES, OPTS);
    net.noiseAt(0, 0, 6);
    expect(net.level()).not.toBe('calm');
    for (let t = 0; t < 60; t++) net.update(0.5); // 30 quiet seconds
    expect(net.level()).toBe('calm');
    expect(net.nodeEnergy('n0')).toBe(0);
  });

  it('reset restores the initial state completely', () => {
    const net = createSoundNetwork(NODES, OPTS);
    net.noiseAt(0, 0, 6);
    net.update(2);
    net.reset();
    expect(net.level()).toBe('calm');
    expect(net.stimulation()).toBe(0);
    expect(net.lastNoise()).toBeNull();
    expect(net.nodeEnergy('n0')).toBe(0);
    expect(net.update(5)).toEqual([]); // no ghost pulses survive reset
  });
});
