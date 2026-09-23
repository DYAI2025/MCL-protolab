import { describe, expect, it } from 'vitest';
import zhalmWorldState from '../../../states/zhalm-forest-initial.json';
import networkAlert from '../../../world-events/zhalm-network-alert.json';
import noiseEmitted from '../../../world-events/zhalm-noise-emitted.json';
import type { CanonProjection } from './contracts.ts';
import type { DirectorContext, DirectorProvider } from './director-context.ts';
import { createDirectorSession } from './director-session.ts';
import { createFakeProvider } from './fake-provider.ts';
import { canonicalJson } from './json.ts';
import { REDACTION_MARKER, type PolicyScope } from './policy-gate.ts';

const canon: CanonProjection = {
  projection_id: 'session-test-canon',
  source_refs: ['MLOA:32735234#Zhalm-Druhen'],
  version: '1',
  generated_at: '2026-09-23T00:00:00Z',
  facts: { 'zhalm-sensor-network': { statement: 'sourced', design_status: 'CONFLICT' } },
  constraints: {},
  open_points: ['MCL-6: Druhen-Regelsystem offen'],
};

const policyScope: PolicyScope = {
  experiment_id: 'zhalm-forest-v1',
  allowed_kinds: ['world_reaction'],
  flag_prefixes: ['zhalm.'],
  intent_catalog: [
    { intent: 'activate_second_sensor_cluster', operations: [{ op: 'SET_WORLD_FLAG', flag_ref: 'zhalm.cluster-b.active', value: true }] },
    { intent: 'network_retreat_regroup', operations: [{ op: 'SET_WORLD_FLAG', flag_ref: 'zhalm.network.regrouping', value: true }] },
    { intent: 'set_mood', operations: [{ op: 'SET_WORLD_FLAG', flag_ref: 'zhalm.mood', value: true }] },
  ],
};

const proposal = (id: string, intent: string, flag: string | null, extra: Record<string, unknown> = {}) => ({
  proposal_id: id,
  kind: 'world_reaction',
  summary: `Proposal ${id}.`,
  rationale: 'Derived from the network alert.',
  required_facts: ['zhalm-sensor-network'],
  state_preconditions: flag ? [{ flag_ref: flag, equals: false }] : [],
  transition_intent: [intent],
  source_refs: ['MLOA:32735234#Zhalm-Druhen'],
  design_status: 'TENTATIVE',
  confidence: null,
  provider_trace: {},
  ...extra,
});

const standardSet = [
  proposal('cluster-b', 'activate_second_sensor_cluster', 'zhalm.cluster-b.active'),
  proposal('regroup', 'network_retreat_regroup', 'zhalm.network.regrouping'),
  proposal('druhen-rule', 'network_retreat_regroup', 'zhalm.network.regrouping', { required_facts: ['druhen-protection-rules'] }),
];

const directorScope = { experiment_id: 'zhalm-forest-v1', canon_fact_keys: ['zhalm-sensor-network'], event_types: ['NOISE_EMITTED', 'NETWORK_ALERT'] };

const makeSession = (provider: DirectorProvider = createFakeProvider({ fixture_id: 'session-test-v1', proposal_sets: { NETWORK_ALERT: standardSet } }), initial: unknown = zhalmWorldState) =>
  createDirectorSession({ initial_state: initial, canon, director_scope: directorScope, policy_scope: policyScope, provider });

/** A provider whose answers are released by the test, to create in-flight runs deterministically. */
const deferredProvider = (proposals: readonly Record<string, unknown>[]) => {
  const waiting: Array<{ runId: string; release: () => void }> = [];
  const provider: DirectorProvider = {
    provider_id: 'deferred',
    model_or_fixture: 'deferred-v1',
    propose: (context: DirectorContext) => new Promise((resolve) => {
      waiting.push({
        runId: context.run_id,
        release: () => resolve(proposals.map((item) => ({ ...item, proposal_id: `${context.run_id}:${String(item['proposal_id'])}` }))),
      });
    }),
  };
  const release = (runId: string) => {
    const index = waiting.findIndex((entry) => entry.runId === runId);
    waiting.splice(index, 1)[0]?.release();
  };
  return { provider, release };
};

const observeChain = (session: ReturnType<typeof makeSession>, suffix = '') => {
  expect(session.observe({ ...noiseEmitted, event_id: `noise${suffix}` }).ok).toBe(true);
  expect(session.observe({ ...networkAlert, event_id: `alert${suffix}` }).ok).toBe(true);
  return [`noise${suffix}`, `alert${suffix}`];
};

describe('director session', () => {
  it('runs the director on observed events and gates every proposal', async () => {
    const session = makeSession();
    const run = await session.startRun(observeChain(session));
    expect(run.status).toBe('STOPPED');
    expect(run.run_id).toBe('zhalm-forest-v1-run-1');
    expect(run.superseded).toBe(false);
    expect(run.proposals.map((view) => [view.proposal.proposal_id, view.gate.status])).toEqual([
      ['zhalm-forest-v1-run-1:cluster-b', 'accepted'],
      ['zhalm-forest-v1-run-1:regroup', 'accepted'],
      ['zhalm-forest-v1-run-1:druhen-rule', 'rejected'],
    ]);
    expect(run.proposals[2]?.gate.reasons).toEqual(['REQUIRED_FACT_MISSING']);
  });

  it('records run status, derived proposals and gate results in the ledger', async () => {
    const session = makeSession();
    await session.startRun(observeChain(session));
    const kinds = session.ledger.entries().map((entry) => entry.kind);
    expect(kinds.filter((kind) => kind === 'OBSERVED_EVENT')).toHaveLength(2);
    expect(kinds.filter((kind) => kind === 'RUN_STATUS')).toHaveLength(4);
    expect(kinds.filter((kind) => kind === 'DERIVED_PROPOSAL')).toHaveLength(3);
    expect(kinds.filter((kind) => kind === 'GATE_RESULT')).toHaveLength(3);
  });

  it('applies an accepted proposal through the gate and the transition engine', async () => {
    const session = makeSession();
    await session.startRun(observeChain(session));
    const result = session.select('zhalm-forest-v1-run-1:cluster-b');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transition.proposal_ref).toBe('zhalm-forest-v1-run-1:cluster-b');
    expect(result.diff).toContainEqual({ path: ['world_flags', 'zhalm.cluster-b.active'], before: false, after: true });
    expect(session.state().world_flags['zhalm.cluster-b.active']).toBe(true);
    expect(session.state().revision).toBe(2);
    expect(session.ledger.entries().slice(-2).map((entry) => entry.kind)).toEqual(['SELECTION', 'TRANSITION_APPLIED']);
    expect(session.activeRun()?.selected_proposal_id).toBe('zhalm-forest-v1-run-1:cluster-b');
  });

  it('refuses a rejected proposal and leaves the world unchanged', async () => {
    const session = makeSession();
    await session.startRun(observeChain(session));
    const before = canonicalJson(session.state());
    expect(session.select('zhalm-forest-v1-run-1:druhen-rule')).toMatchObject({ ok: false, reason: 'PROPOSAL_REJECTED' });
    expect(canonicalJson(session.state())).toBe(before);
    expect(session.ledger.entries().at(-1)).toMatchObject({ kind: 'SELECTION', outcome: 'refused', reason: 'PROPOSAL_REJECTED' });
  });

  it('refuses selection without a run, of an unknown proposal and a second selection in the same run', async () => {
    const session = makeSession();
    expect(session.select('anything')).toMatchObject({ ok: false, reason: 'NO_ACTIVE_RUN' });
    await session.startRun(observeChain(session));
    expect(session.select('zhalm-forest-v1-run-1:invented')).toMatchObject({ ok: false, reason: 'UNKNOWN_PROPOSAL' });
    expect(session.select('zhalm-forest-v1-run-1:cluster-b').ok).toBe(true);
    expect(session.select('zhalm-forest-v1-run-1:regroup')).toMatchObject({ ok: false, reason: 'RUN_ALREADY_RESOLVED' });
  });

  it('gives every selection attempt its own selection_ref', async () => {
    const session = makeSession();
    await session.startRun(observeChain(session));
    session.select('zhalm-forest-v1-run-1:druhen-rule');
    session.select('zhalm-forest-v1-run-1:cluster-b');
    const refs = session.ledger.entries().flatMap((entry) => (entry.kind === 'SELECTION' ? [entry.selection_ref] : []));
    expect(refs).toHaveLength(2);
    expect(new Set(refs).size).toBe(2);
    expect(session.activeRun()?.selection_ref).toBe(refs[1]);
  });

  it('gates a later run against the changed world: an already applied reaction fails its precondition', async () => {
    const session = makeSession();
    await session.startRun(observeChain(session));
    session.select('zhalm-forest-v1-run-1:cluster-b');
    const second = await session.startRun(observeChain(session, '-2'));
    const clusterB = second.proposals.find((view) => view.proposal.proposal_id === 'zhalm-forest-v1-run-2:cluster-b');
    expect(clusterB?.gate.status).toBe('rejected');
    expect(clusterB?.gate.reasons).toContain('PRECONDITION_FAILED');
  });

  it('refuses to start a run on events it has not observed', async () => {
    const session = makeSession();
    await expect(session.startRun(['never-observed'])).rejects.toThrow(/not observed/);
  });

  it('reset restores the initial world and clears the active run', async () => {
    const session = makeSession();
    await session.startRun(observeChain(session));
    session.select('zhalm-forest-v1-run-1:regroup');
    session.reset();
    expect(canonicalJson(session.state())).toBe(canonicalJson(zhalmWorldState));
    expect(session.activeRun()).toBeNull();
  });
});

describe('director session — in-flight runs (review finding B1)', () => {
  it('a run that completes after reset is superseded and never becomes active', async () => {
    const deferred = deferredProvider(standardSet);
    const session = makeSession(deferred.provider);
    const pending = session.startRun(observeChain(session));
    session.reset();
    deferred.release('zhalm-forest-v1-run-1');
    const run = await pending;
    expect(run.superseded).toBe(true);
    expect(session.activeRun()).toBeNull();
    expect(session.select('zhalm-forest-v1-run-1:cluster-b')).toMatchObject({ ok: false, reason: 'NO_ACTIVE_RUN' });
  });

  it('with overlapping runs only the latest started run becomes active', async () => {
    const deferred = deferredProvider(standardSet);
    const session = makeSession(deferred.provider);
    const first = session.startRun(observeChain(session, '-a'));
    const second = session.startRun(observeChain(session, '-b'));
    deferred.release('zhalm-forest-v1-run-2');
    expect((await second).superseded).toBe(false);
    deferred.release('zhalm-forest-v1-run-1');
    expect((await first).superseded).toBe(true);
    expect(session.activeRun()?.run_id).toBe('zhalm-forest-v1-run-2');
  });

  it('refuses a proposal prepared on a world that changed while the run was in flight (STALE_RUN)', async () => {
    const deferred = deferredProvider(standardSet);
    const session = makeSession(deferred.provider);
    const first = session.startRun(observeChain(session, '-1'));
    deferred.release('zhalm-forest-v1-run-1');
    await first;
    const second = session.startRun(observeChain(session, '-2'));
    expect(session.select('zhalm-forest-v1-run-1:cluster-b').ok).toBe(true);
    deferred.release('zhalm-forest-v1-run-2');
    await second;
    const before = canonicalJson(session.state());
    expect(session.select('zhalm-forest-v1-run-2:regroup')).toMatchObject({ ok: false, reason: 'STALE_RUN' });
    expect(canonicalJson(session.state())).toBe(before);
  });
});

describe('director session — evidence integrity (review findings B2, B3, B6, B12)', () => {
  it('stores and shows a privacy-rejected proposal only in redacted form', async () => {
    const leaking = proposal('leak', 'activate_second_sensor_cluster', 'zhalm.cluster-b.active', { summary: 'Contact parent@example.org now.' });
    const session = makeSession(createFakeProvider({ fixture_id: 'leak-v1', proposal_sets: { NETWORK_ALERT: [leaking] } }));
    const run = await session.startRun(observeChain(session));
    expect(run.proposals[0]?.gate.reasons).toContain('PRIVACY_OR_SECRET_FIELD');
    expect(run.proposals[0]?.proposal.summary).toBe(REDACTION_MARKER);
    expect(canonicalJson(session.ledger.entries())).not.toMatch(/parent@example\.org/);
    expect(canonicalJson(session.activeRun())).not.toMatch(/parent@example\.org/);
  });

  it('does not offer a proposal whose id is already in the ledger, and reports it', async () => {
    const fixedIds: DirectorProvider = {
      provider_id: 'fixed-ids',
      model_or_fixture: 'fixed-ids-v1',
      propose: async () => [proposal('same-id', 'activate_second_sensor_cluster', 'zhalm.cluster-b.active')],
    };
    const session = makeSession(fixedIds);
    expect((await session.startRun(observeChain(session, '-1'))).proposals).toHaveLength(1);
    const second = await session.startRun(observeChain(session, '-2'));
    expect(second.proposals).toEqual([]);
    expect(second.boundary_rejections).toEqual([{ index: 0, errors: ['DUPLICATE_PROPOSAL_ID: proposal_id "same-id" is already recorded'] }]);
  });

  it('refuses an accepted proposal the engine would reject, without recording an accepted selection', async () => {
    const odd = { ...zhalmWorldState, world_flags: { ...zhalmWorldState.world_flags, 'zhalm.mood': 'restless' } };
    const session = makeSession(
      createFakeProvider({ fixture_id: 'mood-v1', proposal_sets: { NETWORK_ALERT: [proposal('mood', 'set_mood', null)] } }),
      odd,
    );
    const run = await session.startRun(observeChain(session));
    expect(run.proposals[0]?.gate.status).toBe('accepted');
    const before = canonicalJson(session.state());
    expect(session.select('zhalm-forest-v1-run-1:mood')).toMatchObject({ ok: false, reason: 'TRANSITION_REJECTED' });
    expect(canonicalJson(session.state())).toBe(before);
    const selections = session.ledger.entries().filter((entry) => entry.kind === 'SELECTION');
    expect(selections).toEqual([expect.objectContaining({ outcome: 'refused', reason: 'TRANSITION_REJECTED' })]);
    expect(session.activeRun()?.resolved).toBe(false);
  });

  it('exposes no write access to the world or the ledger', () => {
    const session = makeSession();
    expect(Object.keys(session)).not.toContain('world');
    expect(Object.keys(session.ledger).sort()).toEqual(['derived', 'entries', 'observed', 'size']);
  });
});
