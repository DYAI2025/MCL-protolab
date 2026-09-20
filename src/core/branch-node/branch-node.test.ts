import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const schema = JSON.parse(readFileSync('schemas/branch-node.schema.json', 'utf8'));
const validate = ajv.compile(schema);

const minimalValidBranchNode = {
  branch_id: 'branch-zhalm-001',
  parent_state_ref: 'glade-initial-state',
  event_ref: 'zhalm-network-alert-001',
  proposal_ref: 'proposal-zhalm-001',
  selection_ref: 'selection-zhalm-001',
  transition_ref: 'transition-zhalm-001',
  source_refs: ['MLOA:64815106'],
  revision: 1,
};

describe('BranchNode schema', () => {
  it('validates a minimal valid BranchNode fixture', () => {
    expect(validate(minimalValidBranchNode)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('validates after JSON serialize → parse round-trip', () => {
    const serialized = JSON.stringify(minimalValidBranchNode);
    const parsed = JSON.parse(serialized);
    expect(validate(parsed)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('accepts empty source_refs structurally', () => {
    const withEmptySources = { ...minimalValidBranchNode, source_refs: [] };
    expect(validate(withEmptySources)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('rejects BranchNode missing branch_id', () => {
    const { branch_id: _omitted, ...withoutId } = minimalValidBranchNode;
    void _omitted;
    const valid = validate(withoutId);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'branch_id',
    )).toBe(true);
  });

  it('rejects BranchNode missing parent_state_ref', () => {
    const { parent_state_ref: _omitted, ...withoutRef } = minimalValidBranchNode;
    void _omitted;
    const valid = validate(withoutRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'parent_state_ref',
    )).toBe(true);
  });

  it('rejects BranchNode missing event_ref', () => {
    const { event_ref: _omitted, ...withoutRef } = minimalValidBranchNode;
    void _omitted;
    const valid = validate(withoutRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'event_ref',
    )).toBe(true);
  });

  it('rejects BranchNode missing proposal_ref', () => {
    const { proposal_ref: _omitted, ...withoutRef } = minimalValidBranchNode;
    void _omitted;
    const valid = validate(withoutRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'proposal_ref',
    )).toBe(true);
  });

  it('rejects BranchNode missing selection_ref', () => {
    const { selection_ref: _omitted, ...withoutRef } = minimalValidBranchNode;
    void _omitted;
    const valid = validate(withoutRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'selection_ref',
    )).toBe(true);
  });

  it('rejects BranchNode missing transition_ref', () => {
    const { transition_ref: _omitted, ...withoutRef } = minimalValidBranchNode;
    void _omitted;
    const valid = validate(withoutRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'transition_ref',
    )).toBe(true);
  });

  it('rejects BranchNode missing source_refs', () => {
    const { source_refs: _omitted, ...withoutRefs } = minimalValidBranchNode;
    void _omitted;
    const valid = validate(withoutRefs);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'source_refs',
    )).toBe(true);
  });

  it('rejects BranchNode missing revision', () => {
    const { revision: _omitted, ...withoutRevision } = minimalValidBranchNode;
    void _omitted;
    const valid = validate(withoutRevision);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'revision',
    )).toBe(true);
  });

  it('rejects full WorldState object where parent_state_ref is required', () => {
    const withEmbeddedState = {
      ...minimalValidBranchNode,
      parent_state_ref: {
        state_id: 'glade-initial-state',
        entities: {},
        world_flags: {},
      },
    };
    const valid = validate(withEmbeddedState);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });

  it('rejects embedded DirectorProposal object instead of proposal_ref', () => {
    const withEmbeddedProposal = {
      ...minimalValidBranchNode,
      proposal_ref: { proposal_id: 'proposal-zhalm-001', kind: 'world_event' },
    };
    const valid = validate(withEmbeddedProposal);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });

  it('rejects embedded StateTransition object instead of transition_ref', () => {
    const withEmbeddedTransition = {
      ...minimalValidBranchNode,
      transition_ref: { transition_id: 'transition-zhalm-001', operations: [] },
    };
    const valid = validate(withEmbeddedTransition);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });

  it('rejects BranchNode with unexpected top-level property', () => {
    const withUnexpected = {
      ...minimalValidBranchNode,
      unexpected_prop: 'should not be here',
    };
    const valid = validate(withUnexpected);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });

  it.each([
    'world_state',
    'result_state_ref',
    'ancestry',
    'diff',
    'provider_trace',
  ])('rejects BranchNode with out-of-scope top-level %s', (field) => {
    const withExtra = { ...minimalValidBranchNode, [field]: {} };
    const valid = validate(withExtra);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });

  it('rejects empty branch_id', () => {
    const withEmptyId = { ...minimalValidBranchNode, branch_id: '' };
    const valid = validate(withEmptyId);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'minLength')).toBe(true);
  });

  it('rejects revision 0', () => {
    const withZeroRevision = { ...minimalValidBranchNode, revision: 0 };
    const valid = validate(withZeroRevision);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'minimum')).toBe(true);
  });

  it('rejects source_refs containing a number', () => {
    const withNumberSource = { ...minimalValidBranchNode, source_refs: [42] };
    const valid = validate(withNumberSource);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });
});
