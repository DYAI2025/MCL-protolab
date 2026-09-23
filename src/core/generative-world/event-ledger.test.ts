import { describe, expect, it } from 'vitest';
import exampleProposal from '../../../proposals/example-director-proposal.json';
import zhalmWorldState from '../../../states/zhalm-forest-initial.json';
import networkAlert from '../../../world-events/zhalm-network-alert.json';
import noiseEmitted from '../../../world-events/zhalm-noise-emitted.json';
import sensorTriggered from '../../../world-events/zhalm-sensor-triggered.json';
import type { WorldState } from './contracts.ts';
import { createEventLedger } from './event-ledger.ts';

const state = zhalmWorldState as WorldState;

describe('event & evidence ledger', () => {
  it('records the Zhalm chain NOISE_EMITTED → SENSOR_TRIGGERED → NETWORK_ALERT in append order', () => {
    const ledger = createEventLedger();
    expect(ledger.appendObserved(noiseEmitted, state)).toEqual({ ok: true, seq: 1 });
    expect(ledger.appendObserved(sensorTriggered, state)).toEqual({ ok: true, seq: 2 });
    expect(ledger.appendObserved(networkAlert, state)).toEqual({ ok: true, seq: 3 });
    expect(ledger.observed().map((event) => event.event_type)).toEqual(['NOISE_EMITTED', 'SENSOR_TRIGGERED', 'NETWORK_ALERT']);
    expect(ledger.entries().map((entry) => entry.kind)).toEqual(['OBSERVED_EVENT', 'OBSERVED_EVENT', 'OBSERVED_EVENT']);
  });

  it('keeps derived proposals apart from observed gameplay events', () => {
    const ledger = createEventLedger();
    ledger.appendObserved(networkAlert, state);
    expect(ledger.appendDerived('run-1', exampleProposal)).toEqual({ ok: true, seq: 2 });
    expect(ledger.observed()).toHaveLength(1);
    expect(ledger.derived()).toEqual([{ run_id: 'run-1', proposal: exampleProposal }]);
    expect(ledger.entries()[1]?.kind).toBe('DERIVED_PROPOSAL');
  });

  it('refuses an event that does not claim observed gameplay evidence', () => {
    const ledger = createEventLedger();
    const derivedEvent = { ...noiseEmitted, event_id: 'zhalm-derived-001', evidence_class: 'derived_ai' };
    expect(ledger.appendObserved(derivedEvent, state)).toMatchObject({ ok: false, reason: 'NOT_OBSERVED' });
    expect(ledger.entries()).toHaveLength(0);
  });

  it('rejects an unknown actor reference without recording anything', () => {
    const ledger = createEventLedger();
    const ghost = { ...sensorTriggered, event_id: 'ghost-001', actor_refs: ['druhen-king'] };
    expect(ledger.appendObserved(ghost, state)).toMatchObject({ ok: false, reason: 'UNKNOWN_ACTOR' });
    expect(ledger.entries()).toHaveLength(0);
  });

  it('rejects an unknown location reference', () => {
    const ledger = createEventLedger();
    const elsewhere = { ...noiseEmitted, event_id: 'elsewhere-001', location_ref: 'zhalm-forest.cave' };
    expect(ledger.appendObserved(elsewhere, state)).toMatchObject({ ok: false, reason: 'UNKNOWN_LOCATION' });
  });

  it('rejects schema-invalid events and proposals', () => {
    const ledger = createEventLedger();
    expect(ledger.appendObserved({ event_type: 'NOISE_EMITTED' }, state)).toMatchObject({ ok: false, reason: 'SCHEMA_INVALID' });
    expect(ledger.appendDerived('run-1', { summary: 'free text' })).toMatchObject({ ok: false, reason: 'SCHEMA_INVALID' });
    expect(ledger.entries()).toHaveLength(0);
  });

  it('refuses schema-valid input that is not representable as JSON without throwing or burning the id', () => {
    const ledger = createEventLedger();
    const lossy = { ...noiseEmitted, payload: { x: Number.NaN } };
    expect(ledger.appendObserved(lossy, state)).toMatchObject({ ok: false, reason: 'SCHEMA_INVALID' });
    expect(ledger.appendObserved(noiseEmitted, state)).toEqual({ ok: true, seq: 1 });

    const lossyProposal = { ...exampleProposal, provider_trace: { note: undefined } };
    expect(ledger.appendDerived('run-1', lossyProposal)).toMatchObject({ ok: false, reason: 'SCHEMA_INVALID' });
    expect(ledger.appendDerived('run-1', exampleProposal)).toEqual({ ok: true, seq: 2 });
  });

  it('rejects a second event with the same event_id', () => {
    const ledger = createEventLedger();
    ledger.appendObserved(noiseEmitted, state);
    expect(ledger.appendObserved(noiseEmitted, state)).toMatchObject({ ok: false, reason: 'DUPLICATE_EVENT_ID' });
    expect(ledger.entries()).toHaveLength(1);
  });

  it('offers only append and read operations', () => {
    const ledger = createEventLedger();
    const writeMethods = Object.keys(ledger).filter((name) => !['entries', 'observed', 'derived', 'size'].includes(name));
    expect(writeMethods.length).toBeGreaterThan(0);
    expect(writeMethods.every((name) => name.startsWith('append'))).toBe(true);
  });

  it('returns frozen entries and stores copies, so history cannot be rewritten', () => {
    const ledger = createEventLedger();
    const input = structuredClone(noiseEmitted);
    ledger.appendObserved(input, state);
    input.payload.radius = 999;
    expect(ledger.observed()[0]?.payload).toEqual(noiseEmitted.payload);
    const entries = ledger.entries();
    expect(Object.isFrozen(entries)).toBe(true);
    expect(() => { (entries as unknown[]).push({}); }).toThrow(TypeError);
  });
});
