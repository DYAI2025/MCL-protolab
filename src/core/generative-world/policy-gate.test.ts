import { describe, expect, it } from 'vitest';
import zhalmWorldState from '../../../states/zhalm-forest-initial.json';
import type { CanonProjection, DirectorProposal, WorldState } from './contracts.ts';
import { canonicalJson } from './json.ts';
import {
  compileTransition,
  evaluateProposal,
  GATE_REASON_CODES,
  POLICY_GATE_VERSION,
  REDACTION_MARKER,
  redactPrivacyFindings,
  type GateReasonCode,
  type PolicyScope,
} from './policy-gate.ts';
import { applyTransition } from './transition-engine.ts';
import { validateContract } from './validation.ts';

const state = zhalmWorldState as WorldState;

const canon: CanonProjection = {
  projection_id: 'test-canon',
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
    { intent: 'escape_scope', operations: [{ op: 'SET_WORLD_FLAG', flag_ref: 'playground.lights', value: true }] },
    { intent: 'undeclared_flag', operations: [{ op: 'SET_WORLD_FLAG', flag_ref: 'zhalm.druhen.awakened', value: true }] },
  ],
};

const valid: DirectorProposal = {
  proposal_id: 'run-1:cluster-b',
  kind: 'world_reaction',
  summary: 'A second sensor cluster becomes active.',
  rationale: 'Derived from the triggered sound-network event.',
  required_facts: ['zhalm-sensor-network'],
  state_preconditions: [
    { flag_ref: 'zhalm.cluster-b.active', equals: false },
    { entity_ref: 'zhalm-guardian' },
    { location_ref: 'zhalm-forest' },
  ],
  transition_intent: ['activate_second_sensor_cluster'],
  source_refs: ['MLOA:32735234#Zhalm-Druhen'],
  design_status: 'TENTATIVE',
  confidence: null,
  provider_trace: {},
};

const gate = (proposal: unknown) => evaluateProposal(proposal, { canon, state, scope });

describe('ProposalPolicyGate', () => {
  it('accepts a proposal that passes every rule and compiles its intents into allowed operations', () => {
    const result = gate(valid);
    expect(result.status).toBe('accepted');
    expect(result.reasons).toEqual([]);
    expect(result.gate_version).toBe(POLICY_GATE_VERSION);
    expect(result.operations).toEqual([{ op: 'SET_WORLD_FLAG', flag_ref: 'zhalm.cluster-b.active', value: true }]);
    expect(result.checks.every((check) => check.outcome === 'passed')).toBe(true);
  });

  const cases: Array<[GateReasonCode, unknown]> = [
    ['SCHEMA_INVALID', { ...valid, new_state: { world_flags: {} } }],
    ['KIND_NOT_ALLOWED', { ...valid, kind: 'lore_rewrite' }],
    ['SOURCE_REFS_MISSING', { ...valid, source_refs: [] }],
    ['REQUIRED_FACT_MISSING', { ...valid, required_facts: ['druhen-protection-rules'] }],
    ['CANON_PROMOTION_FORBIDDEN', { ...valid, design_status: 'STATED' }],
    ['DESIGN_STATUS_INVALID', { ...valid, design_status: 'CANON' }],
    ['NOT_ACTIONABLE', { ...valid, transition_intent: [] }],
    ['UNKNOWN_INTENT', { ...valid, transition_intent: ['summon_druhen_king'] }],
    ['UNKNOWN_FLAG', { ...valid, transition_intent: ['undeclared_flag'] }],
    ['SCOPE_VIOLATION', { ...valid, transition_intent: ['escape_scope'] }],
    ['PRECONDITION_UNSUPPORTED', { ...valid, state_preconditions: [{ when: 'night' }] }],
    ['PRECONDITION_FAILED', { ...valid, state_preconditions: [{ flag_ref: 'zhalm.cluster-b.active', equals: true }] }],
    ['UNKNOWN_ENTITY', { ...valid, state_preconditions: [{ entity_ref: 'druhen-king' }] }],
    ['UNKNOWN_LOCATION', { ...valid, state_preconditions: [{ location_ref: 'zhalm-forest.cave' }] }],
    ['PRIVACY_OR_SECRET_FIELD', { ...valid, rationale: 'Attached: data:audio/wav;base64,UklGRiQAAABXQVZF' }],
  ];

  it.each(cases)('rejects with %s', (code, proposal) => {
    const result = gate(proposal);
    expect(result.status).toBe('rejected');
    expect(result.reasons).toContain(code);
    expect(result.operations).toEqual([]);
  });

  it('covers exactly the reason codes the gate declares', () => {
    expect(new Set(cases.map(([code]) => code))).toEqual(new Set(GATE_REASON_CODES));
  });

  it('treats blank source refs as missing', () => {
    expect(gate({ ...valid, source_refs: ['', '  '] }).reasons).toContain('SOURCE_REFS_MISSING');
  });

  it('blocks secret-like keys and values anywhere in the proposal', () => {
    expect(gate({ ...valid, provider_trace: { api_key: 'x' } }).reasons).toContain('PRIVACY_OR_SECRET_FIELD');
    expect(gate({ ...valid, summary: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.e30.x' }).reasons).toContain('PRIVACY_OR_SECRET_FIELD');
    expect(gate({ ...valid, summary: 'Contact parent@example.org' }).reasons).toContain('PRIVACY_OR_SECRET_FIELD');
    expect(gate({ ...valid, rationale: '-----BEGIN RSA PRIVATE KEY-----' }).reasons).toContain('PRIVACY_OR_SECRET_FIELD');
  });

  it.each([
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
    'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz',
    'AKIAIOSFODNN7EXAMPLE',
    'AIzaSyA-1234567890abcdefghijklmnopqrstuv',
    'xoxb-1234567890-abcdefghij',
    '-----BEGIN PGP PRIVATE KEY BLOCK-----',
    'kontakt@müller-familie.de',
  ])('blocks the token or address %s', (secret) => {
    expect(gate({ ...valid, rationale: `See ${secret} for details.` }).reasons).toContain('PRIVACY_OR_SECRET_FIELD');
  });

  it.each([
    'The bearer of the root-song walks the grove.',
    'A torch-bearer walks past the sensors.',
    'Bearer bonds are not part of this world.',
  ])('does not flag ordinary prose: %s', (prose) => {
    expect(gate({ ...valid, summary: prose }).status).toBe('accepted');
  });

  it('redacts privacy findings for storage and display while the verdict stays rejected', () => {
    const leaking = { ...valid, summary: 'Contact parent@example.org', provider_trace: { api_key: 'sk-live-abcdefghijklmnopqrstuv' } };
    expect(gate(leaking).status).toBe('rejected');
    const redacted = redactPrivacyFindings(leaking);
    expect(redacted.summary).toBe(REDACTION_MARKER);
    expect(redacted.provider_trace).toEqual({ api_key: REDACTION_MARKER });
    expect(canonicalJson(redacted)).not.toMatch(/parent@example\.org|sk-live/);
    expect(validateContract('DirectorProposal', redacted)).toEqual({ ok: true });
    expect(redactPrivacyFindings(valid)).toEqual(valid);
  });

  it('keeps an auditable trace: every rule once, in order, with its outcome', () => {
    const result = gate({ ...valid, required_facts: ['druhen-protection-rules'] });
    expect(result.checks.map((check) => check.rule)).toEqual([
      'schema', 'privacy', 'kind', 'source_refs', 'required_facts', 'canon_promotion', 'intents', 'scope', 'preconditions',
    ]);
    const failed = result.checks.filter((check) => check.outcome === 'failed');
    expect(failed.map((check) => check.rule)).toEqual(['required_facts']);
    expect(failed[0]?.detail).toMatch(/druhen-protection-rules/);
  });

  it('skips structural rules for a schema-invalid proposal instead of guessing', () => {
    const result = gate({ summary: 'free text' });
    expect(result.reasons).toEqual(['SCHEMA_INVALID']);
    expect(result.proposal_id).toBeNull();
    expect(result.checks.filter((check) => check.outcome === 'skipped').map((check) => check.rule))
      .toEqual(['kind', 'source_refs', 'required_facts', 'canon_promotion', 'intents', 'scope', 'preconditions']);
  });

  it('never throws on arbitrary input', () => {
    for (const garbage of [null, 'NETWORK_ALERT', 42, [], { proposal_id: 7 }]) {
      expect(gate(garbage).status).toBe('rejected');
    }
  });

  it('is deterministic', () => {
    expect(canonicalJson(gate(valid))).toBe(canonicalJson(gate(valid)));
  });
});

describe('compileTransition', () => {
  it('turns an accepted gate result into a valid, applicable StateTransition', () => {
    const result = compileTransition(gate(valid), valid, state, 'transition-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validateContract('StateTransition', result.transition)).toEqual({ ok: true });
    expect(result.transition).toMatchObject({ source_state_ref: 'zhalm-forest-v1', proposal_ref: 'run-1:cluster-b' });
    const applied = applyTransition(state, result.transition);
    expect(applied.ok && applied.state.world_flags['zhalm.cluster-b.active']).toBe(true);
  });

  it('refuses a rejected gate result, so no proposal can reach the engine without acceptance', () => {
    const rejectedProposal = { ...valid, design_status: 'STATED' };
    expect(compileTransition(gate(rejectedProposal), rejectedProposal, state, 'transition-2')).toMatchObject({ ok: false, reason: 'GATE_NOT_ACCEPTED' });
  });

  it('refuses a gate result that belongs to another proposal', () => {
    const other = { ...valid, proposal_id: 'run-1:other' };
    expect(compileTransition(gate(valid), other, state, 'transition-3')).toMatchObject({ ok: false, reason: 'GATE_PROPOSAL_MISMATCH' });
  });
});
