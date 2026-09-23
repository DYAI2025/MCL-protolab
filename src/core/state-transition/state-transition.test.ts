import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const schema = JSON.parse(readFileSync('schemas/state-transition.schema.json', 'utf8'));
const validate = ajv.compile(schema);

const minimalValidStateTransition = {
  transition_id: 'transition-zhalm-001',
  source_state_ref: 'glade-initial-state',
  proposal_ref: 'proposal-zhalm-001',
  operations: [
    {
      op: 'SET_WORLD_FLAG',
      flag_ref: 'zhalm-network-alert-active',
      value: true,
    },
  ],
  source_refs: ['MLOA:64815106'],
  revision: 1,
};

const allowedSetWorldFlag = {
  op: 'SET_WORLD_FLAG',
  flag_ref: 'zhalm-network-alert-active',
  value: true,
};

describe('StateTransition schema', () => {
  it('validates a minimal valid StateTransition fixture', () => {
    expect(validate(minimalValidStateTransition)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('validates after JSON serialize → parse round-trip', () => {
    const serialized = JSON.stringify(minimalValidStateTransition);
    const parsed = JSON.parse(serialized);
    expect(validate(parsed)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('validates the allowlisted SET_WORLD_FLAG operation', () => {
    const transition = {
      ...minimalValidStateTransition,
      operations: [{ ...allowedSetWorldFlag }],
    };
    expect(validate(transition)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('accepts empty source_refs structurally', () => {
    const withEmptySources = { ...minimalValidStateTransition, source_refs: [] };
    expect(validate(withEmptySources)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('rejects StateTransition missing transition_id', () => {
    const { transition_id: _omitted, ...withoutId } = minimalValidStateTransition;
    void _omitted;
    const valid = validate(withoutId);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'transition_id',
    )).toBe(true);
  });

  it('rejects StateTransition missing source_state_ref', () => {
    const { source_state_ref: _omitted, ...withoutRef } = minimalValidStateTransition;
    void _omitted;
    const valid = validate(withoutRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'source_state_ref',
    )).toBe(true);
  });

  it('rejects StateTransition missing proposal_ref', () => {
    const { proposal_ref: _omitted, ...withoutRef } = minimalValidStateTransition;
    void _omitted;
    const valid = validate(withoutRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'proposal_ref',
    )).toBe(true);
  });

  it('rejects StateTransition missing operations', () => {
    const { operations: _omitted, ...withoutOps } = minimalValidStateTransition;
    void _omitted;
    const valid = validate(withoutOps);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'operations',
    )).toBe(true);
  });

  it('rejects StateTransition missing source_refs', () => {
    const { source_refs: _omitted, ...withoutRefs } = minimalValidStateTransition;
    void _omitted;
    const valid = validate(withoutRefs);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'source_refs',
    )).toBe(true);
  });

  it('rejects StateTransition missing revision', () => {
    const { revision: _omitted, ...withoutRevision } = minimalValidStateTransition;
    void _omitted;
    const valid = validate(withoutRevision);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'revision',
    )).toBe(true);
  });

  it('rejects empty operations array', () => {
    const withNoOps = { ...minimalValidStateTransition, operations: [] };
    const valid = validate(withNoOps);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'minItems')).toBe(true);
  });

  it('rejects non-array operations', () => {
    const withObjectOps = { ...minimalValidStateTransition, operations: {} };
    const valid = validate(withObjectOps);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'array',
    )).toBe(true);
  });

  it('rejects StateTransition with unexpected top-level property', () => {
    const withUnexpected = {
      ...minimalValidStateTransition,
      unexpected_prop: 'should not be here',
    };
    const valid = validate(withUnexpected);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });

  it('rejects unknown operation DELETE_WORLD_STATE', () => {
    const withUnknownOp = {
      ...minimalValidStateTransition,
      operations: [{ op: 'DELETE_WORLD_STATE', flag_ref: 'x', value: true }],
    };
    const valid = validate(withUnknownOp);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'const' && e.instancePath === '/operations/0/op',
    )).toBe(true);
  });

  it('rejects generic arbitrary operation SET_ANYTHING', () => {
    const withGenericOp = {
      ...minimalValidStateTransition,
      operations: [{ op: 'SET_ANYTHING', flag_ref: 'x', value: true }],
    };
    const valid = validate(withGenericOp);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
  });

  it('rejects operation object with no op discriminator', () => {
    const withMissingOp = {
      ...minimalValidStateTransition,
      operations: [{ flag_ref: 'x', value: true }],
    };
    const valid = validate(withMissingOp);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
  });

  it('rejects operation missing flag_ref', () => {
    const withMissingFlagRef = {
      ...minimalValidStateTransition,
      operations: [{ op: 'SET_WORLD_FLAG', value: true }],
    };
    const valid = validate(withMissingFlagRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'flag_ref',
    )).toBe(true);
  });

  it('rejects operation with empty flag_ref', () => {
    const withEmptyFlagRef = {
      ...minimalValidStateTransition,
      operations: [{ op: 'SET_WORLD_FLAG', flag_ref: '', value: true }],
    };
    const valid = validate(withEmptyFlagRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'minLength')).toBe(true);
  });

  it('rejects operation missing value', () => {
    const withMissingValue = {
      ...minimalValidStateTransition,
      operations: [{ op: 'SET_WORLD_FLAG', flag_ref: 'x' }],
    };
    const valid = validate(withMissingValue);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'value',
    )).toBe(true);
  });

  it('rejects operation with object value instead of boolean', () => {
    const withObjectValue = {
      ...minimalValidStateTransition,
      operations: [{ op: 'SET_WORLD_FLAG', flag_ref: 'x', value: { arbitrary: 'payload' } }],
    };
    const valid = validate(withObjectValue);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'boolean',
    )).toBe(true);
  });

  it('rejects operation with unexpected new_state field', () => {
    const withExtraField = {
      ...minimalValidStateTransition,
      operations: [{ op: 'SET_WORLD_FLAG', flag_ref: 'x', value: true, new_state: {} }],
    };
    const valid = validate(withExtraField);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });

  it.each([
    'world_state',
    'new_world_state',
    'new_state',
    'target_state',
    'state_after',
    'replacement_state',
  ])('rejects StateTransition with top-level %s', (field) => {
    const withReplacement = { ...minimalValidStateTransition, [field]: {} };
    const valid = validate(withReplacement);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });

  it('rejects revision 0', () => {
    const withZeroRevision = { ...minimalValidStateTransition, revision: 0 };
    const valid = validate(withZeroRevision);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'minimum')).toBe(true);
  });

  it('rejects source_refs containing a number', () => {
    const withNumberSource = { ...minimalValidStateTransition, source_refs: [42] };
    const valid = validate(withNumberSource);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });
});
