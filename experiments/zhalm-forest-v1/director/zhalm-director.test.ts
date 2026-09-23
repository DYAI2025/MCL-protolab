import { describe, expect, it } from 'vitest';
import zhalmInitialState from '../../../states/zhalm-forest-initial.json';
import { canonicalJson } from '../../../src/core/generative-world/json.ts';
import { validateContract } from '../../../src/core/generative-world/validation.ts';
import { createSoundNetwork } from '../../../src/core/sound-network/network.ts';
import { CLUSTER_B_SPECS, NODE_SPECS } from '../layout.ts';
import { createZhalmDirector, ZHALM_FLAGS } from './zhalm-director.ts';
import { createZhalmEventFactory, heardSensors, sensorEntityRef } from './zhalm-events.ts';

const clock = () => '2026-09-23T17:00:00.000Z';
const networkOptions = {
  linkRange: 14, pulseSpeed: 10, suspicionThreshold: 0.5, alertThreshold: 1.6, decayPerSecond: 0.12, energyDecayPerSecond: 0.8,
};

const raiseAlert = async (director: ReturnType<typeof createZhalmDirector>) => {
  const events = createZhalmEventFactory(clock);
  const noise = events.noiseEmitted(0, 0, 6, ['n3']);
  const sensor = events.sensorTriggered('n3', noise.event_id);
  const alert = events.networkAlert('alerted', { x: 0, z: 0 }, ['n3']);
  for (const event of [noise, sensor, alert]) expect(director.observe(event)).toMatchObject({ ok: true });
  return director.startRun([noise.event_id, sensor.event_id, alert.event_id]);
};

describe('Zhalm event bridge', () => {
  it('hears exactly the sensors the sound network hears', () => {
    for (const [x, z, radius] of [[0, 0, 6], [-8, 12, 3], [30, 30, 5]] as const) {
      const network = createSoundNetwork(NODE_SPECS, networkOptions);
      network.noiseAt(x, z, radius);
      const heardByNetwork = NODE_SPECS.filter((node) => network.nodeEnergy(node.id) > 0).map((node) => node.id);
      expect(heardSensors(NODE_SPECS, x, z, radius)).toEqual(heardByNetwork);
    }
  });

  it('declares every sensor of both clusters as an entity of the Zhalm world', () => {
    for (const node of [...NODE_SPECS, ...CLUSTER_B_SPECS]) {
      expect(Object.hasOwn(zhalmInitialState.entities, sensorEntityRef(node.id)), node.id).toBe(true);
    }
  });

  it('creates valid observed events with sequential ids', () => {
    const events = createZhalmEventFactory(clock);
    const noise = events.noiseEmitted(0.123, -4.567, 6, ['n3']);
    const sensor = events.sensorTriggered('n3', noise.event_id);
    const alert = events.networkAlert('alerted', { x: 0, z: 0 }, ['n3']);
    for (const event of [noise, sensor, alert]) expect(validateContract('WorldEvent', event)).toEqual({ ok: true });
    expect([noise.event_id, sensor.event_id, alert.event_id]).toEqual(['zhalm-evt-1', 'zhalm-evt-2', 'zhalm-evt-3']);
    expect(noise).toMatchObject({ event_type: 'NOISE_EMITTED', actor_refs: ['player'], evidence_class: 'observed_gameplay' });
    expect(noise.payload).toEqual({ x: 0.12, z: -4.57, radius: 6, heard_by: ['zhalm-sensor-n3'] });
    expect(sensor).toMatchObject({ event_type: 'SENSOR_TRIGGERED', actor_refs: ['zhalm-sensor-n3'], payload: { cause_event_ref: 'zhalm-evt-1' } });
    expect(alert).toMatchObject({ event_type: 'NETWORK_ALERT', actor_refs: ['zhalm-sensor-n3'], payload: { level: 'alerted', origin: { x: 0, z: 0 } } });
  });
});

describe('Zhalm director vertical slice (Node)', () => {
  it('offers three accepted reactions and one gate-rejected demonstration after a network alert', async () => {
    const run = await raiseAlert(createZhalmDirector());
    expect(run.status).toBe('STOPPED');
    const verdicts = run.proposals.map((view) => [view.proposal.proposal_id.split(':')[1], view.gate.status, view.gate.reasons.join(',')]);
    expect(verdicts).toEqual([
      ['guardian-investigates', 'accepted', ''],
      ['activate-second-cluster', 'accepted', ''],
      ['retreat-regroup', 'accepted', ''],
      ['druhen-protection-demo', 'rejected', 'REQUIRED_FACT_MISSING'],
    ]);
  });

  it.each([
    ['guardian-investigates', ZHALM_FLAGS.investigating],
    ['activate-second-cluster', ZHALM_FLAGS.clusterB],
    ['retreat-regroup', ZHALM_FLAGS.regrouping],
  ])('selecting %s sets exactly its flag', async (proposal, flag) => {
    const director = createZhalmDirector();
    const run = await raiseAlert(director);
    const result = director.select(`${run.run_id}:${proposal}`);
    expect(result.ok).toBe(true);
    const flags = director.state().world_flags;
    for (const candidate of Object.values(ZHALM_FLAGS)) expect(flags[candidate], candidate).toBe(candidate === flag);
    expect(director.state().revision).toBe(2);
  });

  it('refuses the gate-rejected demonstration', async () => {
    const director = createZhalmDirector();
    const run = await raiseAlert(director);
    expect(director.select(`${run.run_id}:druhen-protection-demo`)).toMatchObject({ ok: false, reason: 'PROPOSAL_REJECTED' });
    expect(canonicalJson(director.state())).toBe(canonicalJson(zhalmInitialState));
  });

  it('records the full evidence chain in the ledger', async () => {
    const director = createZhalmDirector();
    const run = await raiseAlert(director);
    director.select(`${run.run_id}:activate-second-cluster`);
    const kinds = director.ledger.entries().map((entry) => entry.kind);
    const count = (kind: string) => kinds.filter((candidate) => candidate === kind).length;
    expect([count('OBSERVED_EVENT'), count('RUN_STATUS'), count('DERIVED_PROPOSAL'), count('GATE_RESULT'), count('SELECTION'), count('TRANSITION_APPLIED')])
      .toEqual([3, 4, 4, 4, 1, 1]);
  });

  it('reset restores the initial Zhalm world', async () => {
    const director = createZhalmDirector();
    const run = await raiseAlert(director);
    director.select(`${run.run_id}:retreat-regroup`);
    director.reset();
    expect(canonicalJson(director.state())).toBe(canonicalJson(zhalmInitialState));
  });
});
