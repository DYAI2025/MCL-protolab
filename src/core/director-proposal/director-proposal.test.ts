import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const schema = JSON.parse(readFileSync('schemas/director-proposal.schema.json', 'utf8'));
const validate = ajv.compile(schema);

const minimalValidDirectorProposal = {
  proposal_id: 'proposal-zhalm-001',
  kind: 'world_event',
  summary: 'A second Zhalm sensor cluster becomes active.',
  rationale: 'Derived from the triggered sound-network event.',
  required_facts: ['zhalm-network-exists'],
  state_preconditions: [],
  transition_intent: [],
  source_refs: ['MLOA:64815106'],
  design_status: 'TENTATIVE',
  confidence: null,
  provider_trace: {},
};

describe('DirectorProposal schema', () => {
  it('validates a minimal valid DirectorProposal fixture', () => {
    expect(validate(minimalValidDirectorProposal)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('validates after JSON serialize → parse round-trip', () => {
    const serialized = JSON.stringify(minimalValidDirectorProposal);
    const parsed = JSON.parse(serialized);
    expect(validate(parsed)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('accepts confidence omitted', () => {
    const withoutConfidence = {
      proposal_id: minimalValidDirectorProposal.proposal_id,
      kind: minimalValidDirectorProposal.kind,
      summary: minimalValidDirectorProposal.summary,
      rationale: minimalValidDirectorProposal.rationale,
      required_facts: minimalValidDirectorProposal.required_facts,
      state_preconditions: minimalValidDirectorProposal.state_preconditions,
      transition_intent: minimalValidDirectorProposal.transition_intent,
      source_refs: minimalValidDirectorProposal.source_refs,
      design_status: minimalValidDirectorProposal.design_status,
      provider_trace: minimalValidDirectorProposal.provider_trace,
    };
    expect(validate(withoutConfidence)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('accepts confidence null', () => {
    const withNullConfidence = { ...minimalValidDirectorProposal, confidence: null };
    expect(validate(withNullConfidence)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('accepts numeric confidence', () => {
    const withNumericConfidence = { ...minimalValidDirectorProposal, confidence: 0.8 };
    expect(validate(withNumericConfidence)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('accepts empty source_refs structurally', () => {
    const withEmptySources = { ...minimalValidDirectorProposal, source_refs: [] };
    expect(validate(withEmptySources)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('accepts empty state_preconditions', () => {
    const withEmptyPreconditions = { ...minimalValidDirectorProposal, state_preconditions: [] };
    expect(validate(withEmptyPreconditions)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('accepts empty transition_intent', () => {
    const withEmptyIntent = { ...minimalValidDirectorProposal, transition_intent: [] };
    expect(validate(withEmptyIntent)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('rejects DirectorProposal missing proposal_id', () => {
    const withoutProposalId = {
      kind: minimalValidDirectorProposal.kind,
      summary: minimalValidDirectorProposal.summary,
      rationale: minimalValidDirectorProposal.rationale,
      required_facts: minimalValidDirectorProposal.required_facts,
      state_preconditions: minimalValidDirectorProposal.state_preconditions,
      transition_intent: minimalValidDirectorProposal.transition_intent,
      source_refs: minimalValidDirectorProposal.source_refs,
      design_status: minimalValidDirectorProposal.design_status,
      confidence: minimalValidDirectorProposal.confidence,
      provider_trace: minimalValidDirectorProposal.provider_trace,
    };
    const valid = validate(withoutProposalId);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'proposal_id',
    )).toBe(true);
  });

  it('rejects DirectorProposal missing kind', () => {
    const withoutKind = {
      proposal_id: minimalValidDirectorProposal.proposal_id,
      summary: minimalValidDirectorProposal.summary,
      rationale: minimalValidDirectorProposal.rationale,
      required_facts: minimalValidDirectorProposal.required_facts,
      state_preconditions: minimalValidDirectorProposal.state_preconditions,
      transition_intent: minimalValidDirectorProposal.transition_intent,
      source_refs: minimalValidDirectorProposal.source_refs,
      design_status: minimalValidDirectorProposal.design_status,
      confidence: minimalValidDirectorProposal.confidence,
      provider_trace: minimalValidDirectorProposal.provider_trace,
    };
    const valid = validate(withoutKind);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'kind',
    )).toBe(true);
  });

  it('rejects DirectorProposal missing summary', () => {
    const withoutSummary = {
      proposal_id: minimalValidDirectorProposal.proposal_id,
      kind: minimalValidDirectorProposal.kind,
      rationale: minimalValidDirectorProposal.rationale,
      required_facts: minimalValidDirectorProposal.required_facts,
      state_preconditions: minimalValidDirectorProposal.state_preconditions,
      transition_intent: minimalValidDirectorProposal.transition_intent,
      source_refs: minimalValidDirectorProposal.source_refs,
      design_status: minimalValidDirectorProposal.design_status,
      confidence: minimalValidDirectorProposal.confidence,
      provider_trace: minimalValidDirectorProposal.provider_trace,
    };
    const valid = validate(withoutSummary);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'summary',
    )).toBe(true);
  });

  it('rejects DirectorProposal missing rationale', () => {
    const withoutRationale = {
      proposal_id: minimalValidDirectorProposal.proposal_id,
      kind: minimalValidDirectorProposal.kind,
      summary: minimalValidDirectorProposal.summary,
      required_facts: minimalValidDirectorProposal.required_facts,
      state_preconditions: minimalValidDirectorProposal.state_preconditions,
      transition_intent: minimalValidDirectorProposal.transition_intent,
      source_refs: minimalValidDirectorProposal.source_refs,
      design_status: minimalValidDirectorProposal.design_status,
      confidence: minimalValidDirectorProposal.confidence,
      provider_trace: minimalValidDirectorProposal.provider_trace,
    };
    const valid = validate(withoutRationale);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'rationale',
    )).toBe(true);
  });

  it('rejects DirectorProposal missing required_facts', () => {
    const withoutRequiredFacts = {
      proposal_id: minimalValidDirectorProposal.proposal_id,
      kind: minimalValidDirectorProposal.kind,
      summary: minimalValidDirectorProposal.summary,
      rationale: minimalValidDirectorProposal.rationale,
      state_preconditions: minimalValidDirectorProposal.state_preconditions,
      transition_intent: minimalValidDirectorProposal.transition_intent,
      source_refs: minimalValidDirectorProposal.source_refs,
      design_status: minimalValidDirectorProposal.design_status,
      confidence: minimalValidDirectorProposal.confidence,
      provider_trace: minimalValidDirectorProposal.provider_trace,
    };
    const valid = validate(withoutRequiredFacts);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'required_facts',
    )).toBe(true);
  });

  it('rejects DirectorProposal missing state_preconditions', () => {
    const withoutPreconditions = {
      proposal_id: minimalValidDirectorProposal.proposal_id,
      kind: minimalValidDirectorProposal.kind,
      summary: minimalValidDirectorProposal.summary,
      rationale: minimalValidDirectorProposal.rationale,
      required_facts: minimalValidDirectorProposal.required_facts,
      transition_intent: minimalValidDirectorProposal.transition_intent,
      source_refs: minimalValidDirectorProposal.source_refs,
      design_status: minimalValidDirectorProposal.design_status,
      confidence: minimalValidDirectorProposal.confidence,
      provider_trace: minimalValidDirectorProposal.provider_trace,
    };
    const valid = validate(withoutPreconditions);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'state_preconditions',
    )).toBe(true);
  });

  it('rejects DirectorProposal missing transition_intent', () => {
    const withoutIntent = {
      proposal_id: minimalValidDirectorProposal.proposal_id,
      kind: minimalValidDirectorProposal.kind,
      summary: minimalValidDirectorProposal.summary,
      rationale: minimalValidDirectorProposal.rationale,
      required_facts: minimalValidDirectorProposal.required_facts,
      state_preconditions: minimalValidDirectorProposal.state_preconditions,
      source_refs: minimalValidDirectorProposal.source_refs,
      design_status: minimalValidDirectorProposal.design_status,
      confidence: minimalValidDirectorProposal.confidence,
      provider_trace: minimalValidDirectorProposal.provider_trace,
    };
    const valid = validate(withoutIntent);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'transition_intent',
    )).toBe(true);
  });

  it('rejects DirectorProposal missing source_refs', () => {
    const withoutSourceRefs = {
      proposal_id: minimalValidDirectorProposal.proposal_id,
      kind: minimalValidDirectorProposal.kind,
      summary: minimalValidDirectorProposal.summary,
      rationale: minimalValidDirectorProposal.rationale,
      required_facts: minimalValidDirectorProposal.required_facts,
      state_preconditions: minimalValidDirectorProposal.state_preconditions,
      transition_intent: minimalValidDirectorProposal.transition_intent,
      design_status: minimalValidDirectorProposal.design_status,
      confidence: minimalValidDirectorProposal.confidence,
      provider_trace: minimalValidDirectorProposal.provider_trace,
    };
    const valid = validate(withoutSourceRefs);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'source_refs',
    )).toBe(true);
  });

  it('rejects DirectorProposal missing design_status', () => {
    const withoutDesignStatus = {
      proposal_id: minimalValidDirectorProposal.proposal_id,
      kind: minimalValidDirectorProposal.kind,
      summary: minimalValidDirectorProposal.summary,
      rationale: minimalValidDirectorProposal.rationale,
      required_facts: minimalValidDirectorProposal.required_facts,
      state_preconditions: minimalValidDirectorProposal.state_preconditions,
      transition_intent: minimalValidDirectorProposal.transition_intent,
      source_refs: minimalValidDirectorProposal.source_refs,
      confidence: minimalValidDirectorProposal.confidence,
      provider_trace: minimalValidDirectorProposal.provider_trace,
    };
    const valid = validate(withoutDesignStatus);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'design_status',
    )).toBe(true);
  });

  it('rejects DirectorProposal missing provider_trace', () => {
    const withoutProviderTrace = {
      proposal_id: minimalValidDirectorProposal.proposal_id,
      kind: minimalValidDirectorProposal.kind,
      summary: minimalValidDirectorProposal.summary,
      rationale: minimalValidDirectorProposal.rationale,
      required_facts: minimalValidDirectorProposal.required_facts,
      state_preconditions: minimalValidDirectorProposal.state_preconditions,
      transition_intent: minimalValidDirectorProposal.transition_intent,
      source_refs: minimalValidDirectorProposal.source_refs,
      design_status: minimalValidDirectorProposal.design_status,
      confidence: minimalValidDirectorProposal.confidence,
    };
    const valid = validate(withoutProviderTrace);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'provider_trace',
    )).toBe(true);
  });

  it('rejects required_facts containing a number', () => {
    const withNumberFact = { ...minimalValidDirectorProposal, required_facts: [42] };
    const valid = validate(withNumberFact);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });

  it('rejects source_refs containing a number', () => {
    const withNumberSource = { ...minimalValidDirectorProposal, source_refs: [42] };
    const valid = validate(withNumberSource);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });

  it('rejects provider_trace as array', () => {
    const withArrayTrace = { ...minimalValidDirectorProposal, provider_trace: [] };
    const valid = validate(withArrayTrace);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'object',
    )).toBe(true);
  });

  it('rejects confidence as string', () => {
    const withStringConfidence = { ...minimalValidDirectorProposal, confidence: 'high' };
    const valid = validate(withStringConfidence);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'type')).toBe(true);
  });

  it('rejects DirectorProposal with unexpected top-level property', () => {
    const withUnexpected = {
      ...minimalValidDirectorProposal,
      unexpected_prop: 'should not be here',
    };
    const valid = validate(withUnexpected);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });

  it('rejects DirectorProposal with top-level world_state', () => {
    const withWorldState = {
      ...minimalValidDirectorProposal,
      world_state: {},
    };
    const valid = validate(withWorldState);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });

  it('rejects DirectorProposal with top-level new_world_state', () => {
    const withNewWorldState = {
      ...minimalValidDirectorProposal,
      new_world_state: {},
    };
    const valid = validate(withNewWorldState);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });

  it('rejects DirectorProposal with top-level new_state', () => {
    const withNewState = {
      ...minimalValidDirectorProposal,
      new_state: {},
    };
    const valid = validate(withNewState);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });
});
