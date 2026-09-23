import { describe, expect, it } from 'vitest';
import zhalmWorldState from '../../../states/zhalm-forest-initial.json';
import networkAlert from '../../../world-events/zhalm-network-alert.json';
import noiseEmitted from '../../../world-events/zhalm-noise-emitted.json';
import type { CanonProjection, WorldEvent, WorldState } from './contracts.ts';
import { buildDirectorContext, DIRECTOR_CONTRACT_VERSION } from './director-context.ts';
import { canonicalJson } from './json.ts';

const canon: CanonProjection = {
  projection_id: 'test-canon',
  source_refs: ['MLOA:64815106'],
  version: '1',
  generated_at: '2026-09-23T00:00:00Z',
  facts: {
    'zhalm-sensor-network': { statement: 'needed', design_status: 'TENTATIVE' },
    'unrelated-dragon-fact': { statement: 'not needed' },
  },
  constraints: { 'no-canon-promotion': true },
  open_points: ['MCL-6: Druhen-Regelsystem offen'],
};

const state: WorldState = {
  ...(zhalmWorldState as WorldState),
  inventory: { 'private-note': 'must never reach a provider' },
};

const scope = {
  experiment_id: 'zhalm-forest-v1',
  canon_fact_keys: ['zhalm-sensor-network'],
  event_types: ['NETWORK_ALERT'],
};

describe('buildDirectorContext', () => {
  const context = buildDirectorContext({
    run_id: 'run-1',
    canon,
    state,
    events: [noiseEmitted as WorldEvent, networkAlert as WorldEvent],
    scope,
  });

  it('passes only the canon facts the scope names', () => {
    expect(Object.keys(context.canon.facts)).toEqual(['zhalm-sensor-network']);
    expect(context.canon.constraints).toEqual(canon.constraints);
    expect(context.canon.open_points).toEqual(canon.open_points);
  });

  it('passes flags and reference ids of the state, never entity details or other collections', () => {
    expect(Object.keys(context.state).sort()).toEqual(['entity_refs', 'location_refs', 'revision', 'state_id', 'world_flags']);
    expect(context.state.entity_refs).toContain('zhalm-guardian');
    expect(context.state.location_refs).toEqual(['zhalm-forest', 'zhalm-forest.den', 'zhalm-forest.heart']);
    expect(canonicalJson(context)).not.toMatch(/private-note|home_location_ref|unrelated-dragon-fact/);
  });

  it('passes only events of the scoped types', () => {
    expect(context.events.map((event) => event.event_type)).toEqual(['NETWORK_ALERT']);
  });

  it('carries the run id and the contract version', () => {
    expect(context.run_id).toBe('run-1');
    expect(context.contract_version).toBe(DIRECTOR_CONTRACT_VERSION);
  });

  it('is deterministic for identical input', () => {
    const again = buildDirectorContext({ run_id: 'run-1', canon, state, events: [noiseEmitted as WorldEvent, networkAlert as WorldEvent], scope });
    expect(canonicalJson(again)).toBe(canonicalJson(context));
  });
});
