import { describe, expect, it } from 'vitest';
import zhalmWorldState from '../../../states/zhalm-forest-initial.json';
import networkAlert from '../../../world-events/zhalm-network-alert.json';
import type { CanonProjection, WorldEvent, WorldState } from './contracts.ts';
import { runDirector } from './director-orchestrator.ts';
import { createFakeProvider } from './fake-provider.ts';
import { evaluateProposal, type GateReasonCode, type PolicyScope } from './policy-gate.ts';

// MCL-84 AC7/AC8: the gate is fully testable through the FakeProvider and the
// orchestrator, with a checked-in canon projection — no live Confluence read.

const state = zhalmWorldState as WorldState;

const canon: CanonProjection = {
  projection_id: 'zhalm-test-canon',
  source_refs: ['MLOA:32735234#Zhalm-Druhen'],
  version: '1',
  generated_at: '2026-09-23T00:00:00Z',
  facts: { 'zhalm-sensor-network': { statement: 'sourced', design_status: 'CONFLICT' } },
  constraints: {},
  open_points: ['MCL-6: Druhen-Regelsystem offen'],
};

const scope: PolicyScope = {
  experiment_id: 'zhalm-forest-v1',
  allowed_kinds: ['world_reaction'],
  flag_prefixes: ['zhalm.'],
  intent_catalog: [
    { intent: 'activate_second_sensor_cluster', operations: [{ op: 'SET_WORLD_FLAG', flag_ref: 'zhalm.cluster-b.active', value: true }] },
    { intent: 'dim_playground_lights', operations: [{ op: 'SET_WORLD_FLAG', flag_ref: 'playground.lights', value: false }] },
  ],
};

const base = {
  kind: 'world_reaction',
  summary: 'Reaction proposal.',
  rationale: 'Derived from the network alert.',
  required_facts: ['zhalm-sensor-network'],
  state_preconditions: [{ flag_ref: 'zhalm.cluster-b.active', equals: false }],
  transition_intent: ['activate_second_sensor_cluster'],
  source_refs: ['MLOA:32735234#Zhalm-Druhen'],
  design_status: 'TENTATIVE',
  confidence: null,
  provider_trace: {},
};

const negativeFixtures: Array<{ proposal_id: string; expected: GateReasonCode; overrides: Record<string, unknown> }> = [
  { proposal_id: 'hallucinated-fact', expected: 'REQUIRED_FACT_MISSING', overrides: { required_facts: ['druhen-king-exists'] } },
  { proposal_id: 'unknown-entity', expected: 'UNKNOWN_ENTITY', overrides: { state_preconditions: [{ entity_ref: 'druhen-king' }] } },
  { proposal_id: 'unknown-location', expected: 'UNKNOWN_LOCATION', overrides: { state_preconditions: [{ location_ref: 'crystal-cave' }] } },
  { proposal_id: 'canon-conflict', expected: 'CANON_PROMOTION_FORBIDDEN', overrides: { design_status: 'STATED' } },
  { proposal_id: 'privacy-payload', expected: 'PRIVACY_OR_SECRET_FIELD', overrides: { rationale: 'Based on data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ' } },
  { proposal_id: 'unknown-intent', expected: 'UNKNOWN_INTENT', overrides: { transition_intent: ['rewrite_world_state'] } },
  { proposal_id: 'scope-violation', expected: 'SCOPE_VIOLATION', overrides: { transition_intent: ['dim_playground_lights'] } },
];

describe('policy gate over FakeProvider output', () => {
  it('accepts the valid proposal and rejects every negative fixture with its reason code', async () => {
    const provider = createFakeProvider({
      fixture_id: 'zhalm-gate-negative-v1',
      proposal_sets: {
        NETWORK_ALERT: [
          { ...base, proposal_id: 'valid' },
          ...negativeFixtures.map((fixture) => ({ ...base, ...fixture.overrides, proposal_id: fixture.proposal_id })),
        ],
      },
    });
    const outcome = await runDirector({
      run_id: 'run-9',
      canon,
      state,
      events: [networkAlert as WorldEvent],
      scope: { experiment_id: 'zhalm-forest-v1', canon_fact_keys: ['zhalm-sensor-network'], event_types: ['NETWORK_ALERT'] },
      provider,
    });
    expect(outcome.status).toBe('STOPPED');
    expect(outcome.proposals).toHaveLength(1 + negativeFixtures.length);

    const verdicts = new Map(outcome.proposals.map((proposal) => [proposal.proposal_id, evaluateProposal(proposal, { canon, state, scope })]));
    expect(verdicts.get('run-9:valid')?.status).toBe('accepted');
    for (const fixture of negativeFixtures) {
      const verdict = verdicts.get(`run-9:${fixture.proposal_id}`);
      expect(verdict?.status, fixture.proposal_id).toBe('rejected');
      expect(verdict?.reasons, fixture.proposal_id).toContain(fixture.expected);
    }
  });
});
