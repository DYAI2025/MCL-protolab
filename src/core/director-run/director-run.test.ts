import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const schema = JSON.parse(readFileSync('schemas/director-run.schema.json', 'utf8'));
const validate = ajv.compile(schema);

const minimalValidDirectorRun = {
  run_id: 'zhalm-director-run-001',
  canon_projection_ref: 'mcl-director-canon-v1',
  world_state_ref: 'glade-initial-state',
  event_refs: ['zhalm-network-alert-001'],
  status: 'CREATED',
  source_refs: ['MLOA:64815106'],
  revision: 1,
};

const authorizedStatuses = ['CREATED', 'PREPARING', 'RUNNING', 'STOPPED', 'FAILED'];

describe('DirectorRun schema', () => {
  it('validates a minimal valid DirectorRun fixture', () => {
    expect(validate(minimalValidDirectorRun)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('validates after JSON serialize → parse round-trip', () => {
    const serialized = JSON.stringify(minimalValidDirectorRun);
    const parsed = JSON.parse(serialized);
    expect(validate(parsed)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  for (const status of authorizedStatuses) {
    it(`accepts status "${status}"`, () => {
      const run = { ...minimalValidDirectorRun, status };
      expect(validate(run)).toBe(true);
      expect(validate.errors).toBeNull();
    });
  }

  it('rejects DirectorRun missing run_id', () => {
    const withoutRunId = {
      canon_projection_ref: minimalValidDirectorRun.canon_projection_ref,
      world_state_ref: minimalValidDirectorRun.world_state_ref,
      event_refs: minimalValidDirectorRun.event_refs,
      status: minimalValidDirectorRun.status,
      source_refs: minimalValidDirectorRun.source_refs,
      revision: minimalValidDirectorRun.revision,
    };
    const valid = validate(withoutRunId);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'run_id',
    )).toBe(true);
  });

  it('rejects DirectorRun missing canon_projection_ref', () => {
    const withoutCanonRef = {
      run_id: minimalValidDirectorRun.run_id,
      world_state_ref: minimalValidDirectorRun.world_state_ref,
      event_refs: minimalValidDirectorRun.event_refs,
      status: minimalValidDirectorRun.status,
      source_refs: minimalValidDirectorRun.source_refs,
      revision: minimalValidDirectorRun.revision,
    };
    const valid = validate(withoutCanonRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'canon_projection_ref',
    )).toBe(true);
  });

  it('rejects DirectorRun missing world_state_ref', () => {
    const withoutWorldStateRef = {
      run_id: minimalValidDirectorRun.run_id,
      canon_projection_ref: minimalValidDirectorRun.canon_projection_ref,
      event_refs: minimalValidDirectorRun.event_refs,
      status: minimalValidDirectorRun.status,
      source_refs: minimalValidDirectorRun.source_refs,
      revision: minimalValidDirectorRun.revision,
    };
    const valid = validate(withoutWorldStateRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'world_state_ref',
    )).toBe(true);
  });

  it('rejects DirectorRun missing event_refs', () => {
    const withoutEventRefs = {
      run_id: minimalValidDirectorRun.run_id,
      canon_projection_ref: minimalValidDirectorRun.canon_projection_ref,
      world_state_ref: minimalValidDirectorRun.world_state_ref,
      status: minimalValidDirectorRun.status,
      source_refs: minimalValidDirectorRun.source_refs,
      revision: minimalValidDirectorRun.revision,
    };
    const valid = validate(withoutEventRefs);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'event_refs',
    )).toBe(true);
  });

  it('rejects DirectorRun missing status', () => {
    const withoutStatus = {
      run_id: minimalValidDirectorRun.run_id,
      canon_projection_ref: minimalValidDirectorRun.canon_projection_ref,
      world_state_ref: minimalValidDirectorRun.world_state_ref,
      event_refs: minimalValidDirectorRun.event_refs,
      source_refs: minimalValidDirectorRun.source_refs,
      revision: minimalValidDirectorRun.revision,
    };
    const valid = validate(withoutStatus);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'status',
    )).toBe(true);
  });

  it('rejects DirectorRun missing source_refs', () => {
    const withoutSourceRefs = {
      run_id: minimalValidDirectorRun.run_id,
      canon_projection_ref: minimalValidDirectorRun.canon_projection_ref,
      world_state_ref: minimalValidDirectorRun.world_state_ref,
      event_refs: minimalValidDirectorRun.event_refs,
      status: minimalValidDirectorRun.status,
      revision: minimalValidDirectorRun.revision,
    };
    const valid = validate(withoutSourceRefs);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'source_refs',
    )).toBe(true);
  });

  it('rejects DirectorRun missing revision', () => {
    const withoutRevision = {
      run_id: minimalValidDirectorRun.run_id,
      canon_projection_ref: minimalValidDirectorRun.canon_projection_ref,
      world_state_ref: minimalValidDirectorRun.world_state_ref,
      event_refs: minimalValidDirectorRun.event_refs,
      status: minimalValidDirectorRun.status,
      source_refs: minimalValidDirectorRun.source_refs,
    };
    const valid = validate(withoutRevision);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'revision',
    )).toBe(true);
  });

  it('rejects unknown status with enum error', () => {
    const withUnknownStatus = { ...minimalValidDirectorRun, status: 'UNKNOWN' };
    const valid = validate(withUnknownStatus);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'enum')).toBe(true);
  });

  it('rejects revision 0 with minimum error', () => {
    const withRevisionZero = { ...minimalValidDirectorRun, revision: 0 };
    const valid = validate(withRevisionZero);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'minimum')).toBe(true);
  });

  it('rejects event_refs containing a non-string', () => {
    const withNumberEventRef = { ...minimalValidDirectorRun, event_refs: [42] };
    const valid = validate(withNumberEventRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });

  it('rejects source_refs containing a non-string', () => {
    const withNumberSourceRef = { ...minimalValidDirectorRun, source_refs: [42] };
    const valid = validate(withNumberSourceRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });

  it('rejects DirectorRun with unexpected top-level property', () => {
    const withUnexpected = {
      ...minimalValidDirectorRun,
      unexpected_prop: 'should not be here',
    };
    const valid = validate(withUnexpected);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });
});
