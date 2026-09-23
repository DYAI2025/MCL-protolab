import { describe, expect, it } from 'vitest';
import exampleProposal from '../../../proposals/example-director-proposal.json';
import zhalmWorldState from '../../../states/zhalm-forest-initial.json';
import networkAlert from '../../../world-events/zhalm-network-alert.json';
import type { CanonProjection, WorldEvent, WorldState } from './contracts.ts';
import { buildDirectorContext } from './director-context.ts';
import { createFakeProvider } from './fake-provider.ts';
import { canonicalJson } from './json.ts';

const canon: CanonProjection = {
  projection_id: 'test-canon',
  source_refs: ['MLOA:64815106'],
  version: '1',
  generated_at: '2026-09-23T00:00:00Z',
  facts: {},
  constraints: {},
  open_points: [],
};

const contextFor = (runId: string, events: WorldEvent[]) => buildDirectorContext({
  run_id: runId,
  canon,
  state: zhalmWorldState as WorldState,
  events,
  scope: { experiment_id: 'zhalm-forest-v1', canon_fact_keys: [], event_types: ['NETWORK_ALERT', 'NOISE_EMITTED'] },
});

const second = { ...exampleProposal, proposal_id: 'second', summary: 'Second option.' };
const fixture = { fixture_id: 'zhalm-test-fixture-v1', proposal_sets: { NETWORK_ALERT: [exampleProposal, second] } };

describe('FakeProvider', () => {
  it('returns the same proposals for the same fixture and context', async () => {
    const provider = createFakeProvider(fixture);
    const signal = new AbortController().signal;
    const first = await provider.propose(contextFor('run-1', [networkAlert as WorldEvent]), signal);
    const again = await createFakeProvider(fixture).propose(contextFor('run-1', [networkAlert as WorldEvent]), signal);
    expect(canonicalJson(first)).toBe(canonicalJson(again));
  });

  it('namespaces proposal ids with the run id so runs never collide', async () => {
    const provider = createFakeProvider(fixture);
    const output = await provider.propose(contextFor('run-7', [networkAlert as WorldEvent]), new AbortController().signal);
    expect((output as Array<{ proposal_id: string }>).map((proposal) => proposal.proposal_id))
      .toEqual(['run-7:proposal-zhalm-001', 'run-7:second']);
  });

  it('answers the latest event type and returns nothing for an unknown one', async () => {
    const provider = createFakeProvider(fixture);
    const noiseOnly = { ...networkAlert, event_id: 'n-1', event_type: 'NOISE_EMITTED' } as WorldEvent;
    expect(await provider.propose(contextFor('run-2', [noiseOnly]), new AbortController().signal)).toEqual([]);
  });

  it('identifies itself with a provider id and the fixture id', () => {
    const provider = createFakeProvider(fixture);
    expect(provider.provider_id).toBe('fake-director');
    expect(provider.model_or_fixture).toBe('zhalm-test-fixture-v1');
  });

  it('can simulate a provider failure', async () => {
    const provider = createFakeProvider({ ...fixture, fail_with: 'fake outage' });
    await expect(provider.propose(contextFor('run-3', [networkAlert as WorldEvent]), new AbortController().signal)).rejects.toThrow('fake outage');
  });

  it('can return a raw response to simulate malformed output', async () => {
    const provider = createFakeProvider({ ...fixture, raw_response: 'not a proposal list' });
    expect(await provider.propose(contextFor('run-4', [networkAlert as WorldEvent]), new AbortController().signal)).toBe('not a proposal list');
  });

  it('can hold its answer until the run is aborted', async () => {
    const provider = createFakeProvider({ ...fixture, hold_until_aborted: true });
    const controller = new AbortController();
    const pending = provider.propose(contextFor('run-5', [networkAlert as WorldEvent]), controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow(/aborted/);
  });
});
