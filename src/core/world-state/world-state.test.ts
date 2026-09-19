import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const schema = JSON.parse(readFileSync('schemas/world-state.schema.json', 'utf8'));
const validate = ajv.compile(schema);

const minimalValidWorldState = {
  state_id: 'test-state-001',
  entities: {},
  locations: {},
  factions: {},
  relationships: {},
  quests: {},
  inventory: {},
  world_flags: {},
  calendar: {},
  active_events: [],
  source_refs: [],
  revision: 1,
};

describe('WorldState schema', () => {
  it('validates a minimal valid WorldState fixture', () => {
    expect(validate(minimalValidWorldState)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('validates after JSON serialize → parse round-trip', () => {
    const serialized = JSON.stringify(minimalValidWorldState);
    const parsed = JSON.parse(serialized);
    expect(validate(parsed)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('rejects a WorldState missing state_id', () => {
    const withoutStateId = {
      entities: minimalValidWorldState.entities,
      locations: minimalValidWorldState.locations,
      factions: minimalValidWorldState.factions,
      relationships: minimalValidWorldState.relationships,
      quests: minimalValidWorldState.quests,
      inventory: minimalValidWorldState.inventory,
      world_flags: minimalValidWorldState.world_flags,
      calendar: minimalValidWorldState.calendar,
      active_events: minimalValidWorldState.active_events,
      source_refs: minimalValidWorldState.source_refs,
      revision: minimalValidWorldState.revision,
    };
    const valid = validate(withoutStateId);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'state_id',
    )).toBe(true);
  });

  it('rejects a WorldState missing revision', () => {
    const withoutRevision = {
      state_id: minimalValidWorldState.state_id,
      entities: minimalValidWorldState.entities,
      locations: minimalValidWorldState.locations,
      factions: minimalValidWorldState.factions,
      relationships: minimalValidWorldState.relationships,
      quests: minimalValidWorldState.quests,
      inventory: minimalValidWorldState.inventory,
      world_flags: minimalValidWorldState.world_flags,
      calendar: minimalValidWorldState.calendar,
      active_events: minimalValidWorldState.active_events,
      source_refs: minimalValidWorldState.source_refs,
    };
    const valid = validate(withoutRevision);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'revision',
    )).toBe(true);
  });

  it('rejects a WorldState missing source_refs', () => {
    const withoutSourceRefs = {
      state_id: minimalValidWorldState.state_id,
      entities: minimalValidWorldState.entities,
      locations: minimalValidWorldState.locations,
      factions: minimalValidWorldState.factions,
      relationships: minimalValidWorldState.relationships,
      quests: minimalValidWorldState.quests,
      inventory: minimalValidWorldState.inventory,
      world_flags: minimalValidWorldState.world_flags,
      calendar: minimalValidWorldState.calendar,
      active_events: minimalValidWorldState.active_events,
      revision: minimalValidWorldState.revision,
    };
    const valid = validate(withoutSourceRefs);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'source_refs',
    )).toBe(true);
  });

  it('rejects a WorldState with an unexpected top-level property', () => {
    const withUnexpected = {
      ...minimalValidWorldState,
      unexpected_prop: 'should not be here',
    };
    const valid = validate(withUnexpected);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });

  it('reports rejection reasons rather than throwing an unrelated error', () => {
    const incomplete = {
      state_id: minimalValidWorldState.state_id,
      entities: minimalValidWorldState.entities,
      locations: minimalValidWorldState.locations,
      factions: minimalValidWorldState.factions,
      relationships: minimalValidWorldState.relationships,
      quests: minimalValidWorldState.quests,
      inventory: minimalValidWorldState.inventory,
      world_flags: minimalValidWorldState.world_flags,
      calendar: minimalValidWorldState.calendar,
      active_events: minimalValidWorldState.active_events,
      revision: minimalValidWorldState.revision,
    };
    let caughtError: unknown = null;
    let validationRan = false;
    try {
      validationRan = true;
      const valid = validate(incomplete);
      expect(valid).toBe(false);
    } catch (e) {
      caughtError = e;
    }
    expect(validationRan).toBe(true);
    expect(caughtError).toBeNull();
    expect(validate.errors).not.toBeNull();
  });
});
