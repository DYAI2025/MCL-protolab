import { describe, expect, it } from 'vitest';
import zhalmWorldState from '../../../states/zhalm-forest-initial.json';
import networkAlert from '../../../world-events/zhalm-network-alert.json';
import noiseEmitted from '../../../world-events/zhalm-noise-emitted.json';
import type { CanonProjection, StateTransition } from './contracts.ts';
import { createDirectorSession } from './director-session.ts';
import { createFakeProvider } from './fake-provider.ts';
import { canonicalJson } from './json.ts';
import type { PolicyScope } from './policy-gate.ts';

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
  ],
};

const proposal = (id: string, intent: string, flag: string, extra: Record<string, unknown> = {}) => ({
  proposal_id: id,
  kind: 'world_reaction',
  summary: `Proposal ${id}.`,
  rationale: 'Derived from the network alert.',
  required_facts: ['zhalm-sensor-network'],
  state_preconditions: [{ flag_ref: flag, equals: false }],
  transition_intent: [intent],
  source_refs: ['MLOA:32735234#Zhalm-Druhen'],
  design_status: 'TENTATIVE',
  confidence: null,
  provider_trace: {},
  ...extra,
});

const makeSession = () => createDirectorSession({
  initial_state: zhalmWorldState,
  canon,
  director_scope: { experiment_id: 'zhalm-forest-v1', canon_fact_keys: ['zhalm-sensor-network'], event_types: ['NOISE_EMITTED', 'NETWORK_ALERT'] },
  policy_scope: policyScope,
  provider: createFakeProvider({
    fixture_id: 'session-test-v1',
    proposal_sets: {
      NETWORK_ALERT: [
        proposal('cluster-b', 'activate_second_sensor_cluster', 'zhalm.cluster-b.active'),
        proposal('regroup', 'network_retreat_regroup', 'zhalm.network.regrouping'),
        proposal('druhen-rule', 'network_retreat_regroup', 'zhalm.network.regrouping', { required_facts: ['druhen-protection-rules'] }),
      ],
    },
  }),
});

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

  it('refuses a selection when the world changed after the run started (STALE_RUN)', async () => {
    const session = makeSession();
    await session.startRun(observeChain(session));
    const outside: StateTransition = {
      transition_id: 'outside-change',
      source_state_ref: 'zhalm-forest-v1',
      proposal_ref: 'manual',
      operations: [{ op: 'SET_WORLD_FLAG', flag_ref: 'zhalm.guardian.investigating', value: true }],
      source_refs: ['MLOA:64815106'],
      revision: 1,
    };
    expect(session.world.apply(outside).ok).toBe(true);
    expect(session.select('zhalm-forest-v1-run-1:regroup')).toMatchObject({ ok: false, reason: 'STALE_RUN' });
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
