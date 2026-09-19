import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const schema = JSON.parse(readFileSync('schemas/canon-projection.schema.json', 'utf8'));
const validate = ajv.compile(schema);

const minimalValidCanonProjection = {
  projection_id: 'mcl-director-canon-v1',
  source_refs: ['MLOA:20250626', 'MLOA:64815106'],
  version: '1',
  generated_at: '2026-09-19T00:00:00Z',
  facts: {},
  constraints: {},
  open_points: [],
};

describe('CanonProjection schema', () => {
  it('validates a minimal valid CanonProjection fixture', () => {
    expect(validate(minimalValidCanonProjection)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('validates after JSON serialize → parse round-trip', () => {
    const serialized = JSON.stringify(minimalValidCanonProjection);
    const parsed = JSON.parse(serialized);
    expect(validate(parsed)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('rejects CanonProjection missing projection_id', () => {
    const withoutProjectionId = {
      source_refs: minimalValidCanonProjection.source_refs,
      version: minimalValidCanonProjection.version,
      generated_at: minimalValidCanonProjection.generated_at,
      facts: minimalValidCanonProjection.facts,
      constraints: minimalValidCanonProjection.constraints,
      open_points: minimalValidCanonProjection.open_points,
    };
    const valid = validate(withoutProjectionId);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'projection_id',
    )).toBe(true);
  });

  it('rejects CanonProjection missing source_refs', () => {
    const withoutSourceRefs = {
      projection_id: minimalValidCanonProjection.projection_id,
      version: minimalValidCanonProjection.version,
      generated_at: minimalValidCanonProjection.generated_at,
      facts: minimalValidCanonProjection.facts,
      constraints: minimalValidCanonProjection.constraints,
      open_points: minimalValidCanonProjection.open_points,
    };
    const valid = validate(withoutSourceRefs);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'source_refs',
    )).toBe(true);
  });

  it('rejects CanonProjection missing version', () => {
    const withoutVersion = {
      projection_id: minimalValidCanonProjection.projection_id,
      source_refs: minimalValidCanonProjection.source_refs,
      generated_at: minimalValidCanonProjection.generated_at,
      facts: minimalValidCanonProjection.facts,
      constraints: minimalValidCanonProjection.constraints,
      open_points: minimalValidCanonProjection.open_points,
    };
    const valid = validate(withoutVersion);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'version',
    )).toBe(true);
  });

  it('rejects CanonProjection missing generated_at', () => {
    const withoutGeneratedAt = {
      projection_id: minimalValidCanonProjection.projection_id,
      source_refs: minimalValidCanonProjection.source_refs,
      version: minimalValidCanonProjection.version,
      facts: minimalValidCanonProjection.facts,
      constraints: minimalValidCanonProjection.constraints,
      open_points: minimalValidCanonProjection.open_points,
    };
    const valid = validate(withoutGeneratedAt);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'generated_at',
    )).toBe(true);
  });

  it('rejects CanonProjection missing facts', () => {
    const withoutFacts = {
      projection_id: minimalValidCanonProjection.projection_id,
      source_refs: minimalValidCanonProjection.source_refs,
      version: minimalValidCanonProjection.version,
      generated_at: minimalValidCanonProjection.generated_at,
      constraints: minimalValidCanonProjection.constraints,
      open_points: minimalValidCanonProjection.open_points,
    };
    const valid = validate(withoutFacts);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'facts',
    )).toBe(true);
  });

  it('rejects CanonProjection missing constraints', () => {
    const withoutConstraints = {
      projection_id: minimalValidCanonProjection.projection_id,
      source_refs: minimalValidCanonProjection.source_refs,
      version: minimalValidCanonProjection.version,
      generated_at: minimalValidCanonProjection.generated_at,
      facts: minimalValidCanonProjection.facts,
      open_points: minimalValidCanonProjection.open_points,
    };
    const valid = validate(withoutConstraints);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'constraints',
    )).toBe(true);
  });

  it('rejects CanonProjection missing open_points', () => {
    const withoutOpenPoints = {
      projection_id: minimalValidCanonProjection.projection_id,
      source_refs: minimalValidCanonProjection.source_refs,
      version: minimalValidCanonProjection.version,
      generated_at: minimalValidCanonProjection.generated_at,
      facts: minimalValidCanonProjection.facts,
      constraints: minimalValidCanonProjection.constraints,
    };
    const valid = validate(withoutOpenPoints);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'open_points',
    )).toBe(true);
  });

  it('rejects CanonProjection with empty source_refs', () => {
    const withEmptySources = { ...minimalValidCanonProjection, source_refs: [] };
    const valid = validate(withEmptySources);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
  });

  it('rejects CanonProjection with facts as array', () => {
    const withFactsArray = { ...minimalValidCanonProjection, facts: [] };
    const valid = validate(withFactsArray);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
  });

  it('rejects CanonProjection with constraints as array', () => {
    const withConstraintsArray = { ...minimalValidCanonProjection, constraints: [] };
    const valid = validate(withConstraintsArray);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
  });

  it('rejects CanonProjection with open_points as object', () => {
    const withOpenPointsObject = { ...minimalValidCanonProjection, open_points: {} };
    const valid = validate(withOpenPointsObject);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
  });

  it('rejects CanonProjection with unexpected top-level property', () => {
    const withUnexpected = {
      ...minimalValidCanonProjection,
      unexpected_prop: 'should not be here',
    };
    const valid = validate(withUnexpected);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });
});
