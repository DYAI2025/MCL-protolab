import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const schema = JSON.parse(readFileSync('schemas/world-event.schema.json', 'utf8'));
const validate = ajv.compile(schema);

const minimalValidWorldEvent = {
  event_id: 'zhalm-network-alert-001',
  event_type: 'NETWORK_ALERT',
  timestamp: '2026-09-19T00:00:00Z',
  actor_refs: [],
  location_ref: 'zhalm-forest',
  payload: {},
  source_refs: ['MLOA:64815106'],
  evidence_class: 'observed_gameplay',
};

describe('WorldEvent schema', () => {
  it('validates a minimal valid WorldEvent fixture', () => {
    expect(validate(minimalValidWorldEvent)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('validates after JSON serialize → parse round-trip', () => {
    const serialized = JSON.stringify(minimalValidWorldEvent);
    const parsed = JSON.parse(serialized);
    expect(validate(parsed)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('rejects WorldEvent missing event_id', () => {
    const withoutEventId = {
      event_type: minimalValidWorldEvent.event_type,
      timestamp: minimalValidWorldEvent.timestamp,
      actor_refs: minimalValidWorldEvent.actor_refs,
      location_ref: minimalValidWorldEvent.location_ref,
      payload: minimalValidWorldEvent.payload,
      source_refs: minimalValidWorldEvent.source_refs,
      evidence_class: minimalValidWorldEvent.evidence_class,
    };
    const valid = validate(withoutEventId);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'event_id',
    )).toBe(true);
  });

  it('rejects WorldEvent missing event_type', () => {
    const withoutEventType = {
      event_id: minimalValidWorldEvent.event_id,
      timestamp: minimalValidWorldEvent.timestamp,
      actor_refs: minimalValidWorldEvent.actor_refs,
      location_ref: minimalValidWorldEvent.location_ref,
      payload: minimalValidWorldEvent.payload,
      source_refs: minimalValidWorldEvent.source_refs,
      evidence_class: minimalValidWorldEvent.evidence_class,
    };
    const valid = validate(withoutEventType);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'event_type',
    )).toBe(true);
  });

  it('rejects WorldEvent missing timestamp', () => {
    const withoutTimestamp = {
      event_id: minimalValidWorldEvent.event_id,
      event_type: minimalValidWorldEvent.event_type,
      actor_refs: minimalValidWorldEvent.actor_refs,
      location_ref: minimalValidWorldEvent.location_ref,
      payload: minimalValidWorldEvent.payload,
      source_refs: minimalValidWorldEvent.source_refs,
      evidence_class: minimalValidWorldEvent.evidence_class,
    };
    const valid = validate(withoutTimestamp);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'timestamp',
    )).toBe(true);
  });

  it('rejects WorldEvent missing actor_refs', () => {
    const withoutActorRefs = {
      event_id: minimalValidWorldEvent.event_id,
      event_type: minimalValidWorldEvent.event_type,
      timestamp: minimalValidWorldEvent.timestamp,
      location_ref: minimalValidWorldEvent.location_ref,
      payload: minimalValidWorldEvent.payload,
      source_refs: minimalValidWorldEvent.source_refs,
      evidence_class: minimalValidWorldEvent.evidence_class,
    };
    const valid = validate(withoutActorRefs);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'actor_refs',
    )).toBe(true);
  });

  it('rejects WorldEvent missing location_ref', () => {
    const withoutLocationRef = {
      event_id: minimalValidWorldEvent.event_id,
      event_type: minimalValidWorldEvent.event_type,
      timestamp: minimalValidWorldEvent.timestamp,
      actor_refs: minimalValidWorldEvent.actor_refs,
      payload: minimalValidWorldEvent.payload,
      source_refs: minimalValidWorldEvent.source_refs,
      evidence_class: minimalValidWorldEvent.evidence_class,
    };
    const valid = validate(withoutLocationRef);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'location_ref',
    )).toBe(true);
  });

  it('rejects WorldEvent missing payload', () => {
    const withoutPayload = {
      event_id: minimalValidWorldEvent.event_id,
      event_type: minimalValidWorldEvent.event_type,
      timestamp: minimalValidWorldEvent.timestamp,
      actor_refs: minimalValidWorldEvent.actor_refs,
      location_ref: minimalValidWorldEvent.location_ref,
      source_refs: minimalValidWorldEvent.source_refs,
      evidence_class: minimalValidWorldEvent.evidence_class,
    };
    const valid = validate(withoutPayload);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'payload',
    )).toBe(true);
  });

  it('rejects WorldEvent missing source_refs', () => {
    const withoutSourceRefs = {
      event_id: minimalValidWorldEvent.event_id,
      event_type: minimalValidWorldEvent.event_type,
      timestamp: minimalValidWorldEvent.timestamp,
      actor_refs: minimalValidWorldEvent.actor_refs,
      location_ref: minimalValidWorldEvent.location_ref,
      payload: minimalValidWorldEvent.payload,
      evidence_class: minimalValidWorldEvent.evidence_class,
    };
    const valid = validate(withoutSourceRefs);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'source_refs',
    )).toBe(true);
  });

  it('rejects WorldEvent missing evidence_class', () => {
    const withoutEvidenceClass = {
      event_id: minimalValidWorldEvent.event_id,
      event_type: minimalValidWorldEvent.event_type,
      timestamp: minimalValidWorldEvent.timestamp,
      actor_refs: minimalValidWorldEvent.actor_refs,
      location_ref: minimalValidWorldEvent.location_ref,
      payload: minimalValidWorldEvent.payload,
      source_refs: minimalValidWorldEvent.source_refs,
    };
    const valid = validate(withoutEvidenceClass);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'evidence_class',
    )).toBe(true);
  });

  it('rejects WorldEvent with actor_refs containing a number', () => {
    const withNumberActor = { ...minimalValidWorldEvent, actor_refs: [42] };
    const valid = validate(withNumberActor);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });

  it('rejects WorldEvent with payload as array', () => {
    const withPayloadArray = { ...minimalValidWorldEvent, payload: [] };
    const valid = validate(withPayloadArray);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'object',
    )).toBe(true);
  });

  it('rejects WorldEvent with source_refs containing a number', () => {
    const withNumberSource = { ...minimalValidWorldEvent, source_refs: [42] };
    const valid = validate(withNumberSource);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });

  it('rejects WorldEvent with evidence_class as non-string', () => {
    const withNonStringEvidence = { ...minimalValidWorldEvent, evidence_class: 123 };
    const valid = validate(withNonStringEvidence);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'type' && e.params?.type === 'string',
    )).toBe(true);
  });

  it('rejects WorldEvent with unexpected top-level property', () => {
    const withUnexpected = {
      ...minimalValidWorldEvent,
      unexpected_prop: 'should not be here',
    };
    const valid = validate(withUnexpected);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });

  it('accepts actor_refs as empty array', () => {
    const emptyActorRefs = { ...minimalValidWorldEvent, actor_refs: [] };
    expect(validate(emptyActorRefs)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('accepts source_refs as empty array', () => {
    const emptySourceRefs = { ...minimalValidWorldEvent, source_refs: [] };
    expect(validate(emptySourceRefs)).toBe(true);
    expect(validate.errors).toBeNull();
  });
});
