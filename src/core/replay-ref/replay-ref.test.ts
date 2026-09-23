import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const schema = JSON.parse(readFileSync('schemas/replay-ref.schema.json', 'utf8'));
const validate = ajv.compile(schema);

const minimalValidReplayRef = {
  replay_id: 'replay-zhalm-001',
  start_state_ref: 'glade-initial-state',
  transition_refs: ['transition-zhalm-001'],
  source_refs: ['MLOA:64815106'],
  revision: 1,
};

describe('ReplayRef schema', () => {
  it('validates a minimal valid ReplayRef fixture', () => {
    expect(validate(minimalValidReplayRef)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('validates after JSON serialize → parse round-trip', () => {
    const serialized = JSON.stringify(minimalValidReplayRef);
    const parsed = JSON.parse(serialized);
    expect(validate(parsed)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('validates an identity replay with an empty transition sequence', () => {
    const identityReplay = { ...minimalValidReplayRef, transition_refs: [] };
    expect(validate(identityReplay)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('preserves the order of transition_refs through serialize → parse', () => {
    const ordered = {
      ...minimalValidReplayRef,
      transition_refs: ['transition-zhalm-001', 'transition-zhalm-002'],
    };
    expect(validate(ordered)).toBe(true);
    const parsed = JSON.parse(JSON.stringify(ordered));
    expect(parsed.transition_refs).toEqual(['transition-zhalm-001', 'transition-zhalm-002']);
    expect(validate(parsed)).toBe(true);
  });

  it('accepts empty source_refs structurally', () => {
    const withEmptySources = { ...minimalValidReplayRef, source_refs: [] };
    expect(validate(withEmptySources)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('rejects ReplayRef missing replay_id', () => {
    const { replay_id: _omitted, ...withoutId } = minimalValidReplayRef;
    void _omitted;
    const valid = validate(withoutId);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'replay_id',
    )).toBe(true);
  });

  it('rejects ReplayRef missing start_state_ref', () => {
    const { start_state_ref: _omitted, ...withoutRef } = minimalValidReplayRef;
    void _omitted;
    const valid = validate(withoutRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'start_state_ref',
    )).toBe(true);
  });

  it('rejects ReplayRef missing transition_refs', () => {
    const { transition_refs: _omitted, ...withoutRefs } = minimalValidReplayRef;
    void _omitted;
    const valid = validate(withoutRefs);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'transition_refs',
    )).toBe(true);
  });

  it('rejects ReplayRef missing source_refs', () => {
    const { source_refs: _omitted, ...withoutRefs } = minimalValidReplayRef;
    void _omitted;
    const valid = validate(withoutRefs);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'source_refs',
    )).toBe(true);
  });

  it('rejects ReplayRef missing revision', () => {
    const { revision: _omitted, ...withoutRevision } = minimalValidReplayRef;
    void _omitted;
    const valid = validate(withoutRevision);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'revision',
    )).toBe(true);
  });

  it('rejects non-array transition_refs', () => {
    const withObjectRefs = { ...minimalValidReplayRef, transition_refs: {} };
    const valid = validate(withObjectRefs);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'array',
    )).toBe(true);
  });

  it('rejects string transition_refs instead of an array', () => {
    const withStringRefs = { ...minimalValidReplayRef, transition_refs: 'transition-zhalm-001' };
    const valid = validate(withStringRefs);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'array',
    )).toBe(true);
  });

  it('rejects embedded StateTransition object in transition_refs', () => {
    const withEmbeddedTransition = {
      ...minimalValidReplayRef,
      transition_refs: [{ transition_id: 'transition-zhalm-001', operations: [] }],
    };
    const valid = validate(withEmbeddedTransition);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });

  it('rejects embedded WorldState object instead of start_state_ref', () => {
    const withEmbeddedState = {
      ...minimalValidReplayRef,
      start_state_ref: { state_id: 'glade-initial-state', entities: {} },
    };
    const valid = validate(withEmbeddedState);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });

  it('rejects non-string entry in transition_refs', () => {
    const withNumberEntry = { ...minimalValidReplayRef, transition_refs: [42] };
    const valid = validate(withNumberEntry);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });

  it('rejects ReplayRef with unexpected top-level property', () => {
    const withUnexpected = {
      ...minimalValidReplayRef,
      unexpected_prop: 'should not be here',
    };
    const valid = validate(withUnexpected);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });

  it('rejects empty start_state_ref', () => {
    const withEmptyRef = { ...minimalValidReplayRef, start_state_ref: '' };
    const valid = validate(withEmptyRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'minLength')).toBe(true);
  });

  it('rejects revision 0', () => {
    const withZeroRevision = { ...minimalValidReplayRef, revision: 0 };
    const valid = validate(withZeroRevision);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'minimum')).toBe(true);
  });

  it('rejects source_refs containing a number', () => {
    const withNumberSource = { ...minimalValidReplayRef, source_refs: [42] };
    const valid = validate(withNumberSource);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });
});
