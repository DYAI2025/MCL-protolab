import { describe, expect, it } from 'vitest';
import exampleProposal from '../../../proposals/example-director-proposal.json';
import zhalmWorldState from '../../../states/zhalm-forest-initial.json';
import networkAlert from '../../../world-events/zhalm-network-alert.json';
import type { CanonProjection, WorldEvent, WorldState } from './contracts.ts';
import type { DirectorProvider } from './director-context.ts';
import { DIRECTOR_CONTRACT_VERSION } from './director-context.ts';
import { runDirector } from './director-orchestrator.ts';
import { createFakeProvider } from './fake-provider.ts';
import { canonicalJson, cloneJson, deepFreeze } from './json.ts';
import { validateContract } from './validation.ts';

const canon: CanonProjection = {
  projection_id: 'test-canon',
  source_refs: ['MLOA:64815106'],
  version: '1',
  generated_at: '2026-09-23T00:00:00Z',
  facts: {},
  constraints: {},
  open_points: [],
};

const state = deepFreeze(cloneJson(zhalmWorldState as WorldState));
const alert = networkAlert as WorldEvent;
const scope = { experiment_id: 'zhalm-forest-v1', canon_fact_keys: [], event_types: ['NETWORK_ALERT'] };
const second = { ...exampleProposal, proposal_id: 'second', summary: 'Second option.' };
const fixture = { fixture_id: 'zhalm-test-fixture-v1', proposal_sets: { NETWORK_ALERT: [exampleProposal, second] } };

const run = (provider: DirectorProvider, signal?: AbortSignal, runId = 'run-1') =>
  runDirector({ run_id: runId, canon, state, events: [alert], scope, provider, ...(signal ? { signal } : {}) });

describe('runDirector lifecycle', () => {
  it('walks CREATED → PREPARING → RUNNING → STOPPED and every step is a valid DirectorRun document', async () => {
    const outcome = await run(createFakeProvider(fixture));
    expect(outcome.history.map((doc) => doc.status)).toEqual(['CREATED', 'PREPARING', 'RUNNING', 'STOPPED']);
    expect(outcome.history.map((doc) => doc.revision)).toEqual([1, 2, 3, 4]);
    for (const doc of outcome.history) expect(validateContract('DirectorRun', doc)).toEqual({ ok: true });
    expect(outcome.run).toEqual(outcome.history.at(-1));
    expect(outcome.run).toMatchObject({ canon_projection_ref: 'test-canon', world_state_ref: 'zhalm-forest-v1', event_refs: [alert.event_id] });
    expect(outcome.stop_reason).toBe('completed');
    expect(outcome.proposals).toHaveLength(2);
  });

  it('stamps the provider trace itself, so a provider cannot claim another origin', async () => {
    const spoofing = { ...exampleProposal, provider_trace: { provider_id: 'some-real-llm' } };
    const outcome = await run(createFakeProvider({ fixture_id: 'spoof-v1', proposal_sets: { NETWORK_ALERT: [spoofing] } }));
    expect(outcome.proposals[0]?.provider_trace).toEqual({
      provider_id: 'fake-director',
      model_or_fixture: 'spoof-v1',
      prompt_or_contract_version: DIRECTOR_CONTRACT_VERSION,
      run_id: 'run-1',
    });
  });

  it('lets only schema-valid proposals leave the provider boundary', async () => {
    const outcome = await run(createFakeProvider({
      fixture_id: 'mixed-v1',
      proposal_sets: { NETWORK_ALERT: [exampleProposal, { summary: 'free text only' }, 'not an object', { ...exampleProposal, kind: '' }] },
    }));
    expect(outcome.status).toBe('STOPPED');
    expect(outcome.proposals.map((proposal) => proposal.proposal_id)).toEqual(['run-1:proposal-zhalm-001']);
    expect(outcome.boundary_rejections.map((rejection) => rejection.index)).toEqual([1, 2, 3]);
    for (const proposal of outcome.proposals) expect(validateContract('DirectorProposal', proposal)).toEqual({ ok: true });
  });

  it('rejects a duplicate proposal id inside one run at the boundary', async () => {
    const outcome = await run(createFakeProvider({ fixture_id: 'dupe-v1', proposal_sets: { NETWORK_ALERT: [exampleProposal, exampleProposal] } }));
    expect(outcome.proposals).toHaveLength(1);
    expect(outcome.boundary_rejections).toEqual([{ index: 1, errors: ['duplicate proposal_id run-1:proposal-zhalm-001'] }]);
  });

  it('ends in FAILED on a provider error and leaves the world state untouched', async () => {
    const before = canonicalJson(state);
    const outcome = await run(createFakeProvider({ ...fixture, fail_with: 'fake outage' }));
    expect(outcome.status).toBe('FAILED');
    expect(outcome.history.map((doc) => doc.status)).toEqual(['CREATED', 'PREPARING', 'RUNNING', 'FAILED']);
    expect(outcome.error).toMatch(/fake outage/);
    expect(outcome.proposals).toEqual([]);
    expect(canonicalJson(state)).toBe(before);
  });

  it('ends in FAILED when the provider answers with something that is not a proposal list', async () => {
    const outcome = await run(createFakeProvider({ ...fixture, raw_response: { proposals: 'nope' } }));
    expect(outcome.status).toBe('FAILED');
    expect(outcome.error).toMatch(/PROVIDER_OUTPUT_NOT_A_LIST/);
  });

  it('stops without calling the provider when aborted before the run starts', async () => {
    let calls = 0;
    const counting: DirectorProvider = {
      provider_id: 'counting',
      model_or_fixture: 'none',
      propose: async () => { calls += 1; return []; },
    };
    const controller = new AbortController();
    controller.abort();
    const outcome = await run(counting, controller.signal);
    expect(outcome.history.map((doc) => doc.status)).toEqual(['CREATED', 'STOPPED']);
    expect(outcome.stop_reason).toBe('aborted');
    expect(calls).toBe(0);
  });

  it('stops without proposals and without state change when aborted while running', async () => {
    const before = canonicalJson(state);
    const controller = new AbortController();
    const pending = run(createFakeProvider({ ...fixture, hold_until_aborted: true }), controller.signal);
    controller.abort();
    const outcome = await pending;
    expect(outcome.history.map((doc) => doc.status)).toEqual(['CREATED', 'PREPARING', 'RUNNING', 'STOPPED']);
    expect(outcome.stop_reason).toBe('aborted');
    expect(outcome.proposals).toEqual([]);
    expect(canonicalJson(state)).toBe(before);
  });

  it('fails in PREPARING when the canon projection is not a valid contract', async () => {
    const invalidCanon = { ...canon, source_refs: [] } as unknown as CanonProjection;
    const outcome = await runDirector({
      run_id: 'run-x', canon: invalidCanon, state, events: [alert], scope, provider: createFakeProvider(fixture),
    });
    expect(outcome.history.map((doc) => doc.status)).toEqual(['CREATED', 'PREPARING', 'FAILED']);
    expect(outcome.error).toMatch(/CanonProjection/);
  });

  it('is deterministic: identical inputs give identical outcomes', async () => {
    const first = await run(createFakeProvider(fixture));
    const second = await run(createFakeProvider(fixture));
    expect(canonicalJson(first)).toBe(canonicalJson(second));
  });
});
