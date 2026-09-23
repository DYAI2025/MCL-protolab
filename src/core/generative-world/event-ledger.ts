import type { DirectorProposal, DirectorRun, StateTransition, WorldEvent, WorldState } from './contracts.ts';
import { cloneJson, deepFreeze } from './json.ts';
import type { GateResult } from './policy-gate.ts';
import type { StateDiffEntry, TransitionRejectionReason } from './transition-engine.ts';
import { validateContract } from './validation.ts';

/**
 * Append-only Event & Evidence Ledger (Confluence 64815106 §4.3, 69697537 D7).
 *
 * Observed gameplay events and derived (director) proposals are separate
 * entry kinds, so a proposal can never be mistaken for something that
 * happened. Entries are deep-frozen copies; the API offers appends and reads
 * only.
 */

export const OBSERVED_EVIDENCE_CLASS = 'observed_gameplay';

export type LedgerEntry =
  | { readonly seq: number; readonly kind: 'OBSERVED_EVENT'; readonly event: WorldEvent }
  | { readonly seq: number; readonly kind: 'DERIVED_PROPOSAL'; readonly run_id: string; readonly proposal: DirectorProposal }
  | {
    readonly seq: number;
    readonly kind: 'TRANSITION_APPLIED';
    readonly transition: StateTransition;
    readonly diff: readonly StateDiffEntry[];
    readonly from_revision: number;
    readonly to_revision: number;
  }
  | {
    readonly seq: number;
    readonly kind: 'TRANSITION_REJECTED';
    readonly transition_id: string | null;
    readonly reason: TransitionRejectionReason;
    readonly detail: string;
  }
  | { readonly seq: number; readonly kind: 'RESET'; readonly to_revision: number }
  | { readonly seq: number; readonly kind: 'RUN_STATUS'; readonly run: DirectorRun }
  | { readonly seq: number; readonly kind: 'GATE_RESULT'; readonly run_id: string; readonly gate: GateResult }
  | {
    readonly seq: number;
    readonly kind: 'SELECTION';
    readonly run_id: string;
    readonly proposal_id: string;
    readonly selection_ref: string;
    readonly outcome: 'accepted' | 'refused';
    readonly reason: string | null;
  };

export type SelectionRecord = Omit<Extract<LedgerEntry, { kind: 'SELECTION' }>, 'seq' | 'kind'>;

export type LedgerRejectionReason =
  | 'SCHEMA_INVALID'
  | 'NOT_OBSERVED'
  | 'UNKNOWN_ACTOR'
  | 'UNKNOWN_LOCATION'
  | 'DUPLICATE_EVENT_ID'
  | 'DUPLICATE_PROPOSAL_ID';

export type AppendResult = { ok: true; seq: number } | { ok: false; reason: LedgerRejectionReason; detail: string };

type WithoutSeq<T> = T extends unknown ? Omit<T, 'seq'> : never;
type EntryBody = WithoutSeq<LedgerEntry>;

export function createEventLedger() {
  const entries: LedgerEntry[] = [];
  const eventIds = new Set<string>();
  const proposalIds = new Set<string>();

  const push = (body: EntryBody): number => {
    const seq = entries.length + 1;
    entries.push(deepFreeze({ seq, ...cloneJson(body) } as LedgerEntry));
    return seq;
  };

  /** Copies caller input before any id is registered; a lossy value is refused, not thrown. */
  const representable = <T>(value: T): { ok: true; copy: T } | { ok: false; detail: string } => {
    try {
      return { ok: true, copy: cloneJson(value) };
    } catch (error) {
      return { ok: false, detail: `not representable as JSON: ${error instanceof Error ? error.message : String(error)}` };
    }
  };

  return {
    appendObserved(event: unknown, state: WorldState): AppendResult {
      const valid = validateContract('WorldEvent', event);
      if (!valid.ok) return { ok: false, reason: 'SCHEMA_INVALID', detail: valid.errors.join('; ') };
      const observed = event as WorldEvent;
      if (observed.evidence_class !== OBSERVED_EVIDENCE_CLASS) {
        return { ok: false, reason: 'NOT_OBSERVED', detail: `evidence_class "${observed.evidence_class}" is not "${OBSERVED_EVIDENCE_CLASS}"` };
      }
      const unknownActor = observed.actor_refs.find((ref) => !Object.hasOwn(state.entities, ref));
      if (unknownActor !== undefined) {
        return { ok: false, reason: 'UNKNOWN_ACTOR', detail: `actor_ref "${unknownActor}" is not an entity of ${state.state_id}` };
      }
      if (!Object.hasOwn(state.locations, observed.location_ref)) {
        return { ok: false, reason: 'UNKNOWN_LOCATION', detail: `location_ref "${observed.location_ref}" is not a location of ${state.state_id}` };
      }
      if (eventIds.has(observed.event_id)) {
        return { ok: false, reason: 'DUPLICATE_EVENT_ID', detail: `event_id "${observed.event_id}" is already recorded` };
      }
      const copy = representable(observed);
      if (!copy.ok) return { ok: false, reason: 'SCHEMA_INVALID', detail: copy.detail };
      eventIds.add(observed.event_id);
      return { ok: true, seq: push({ kind: 'OBSERVED_EVENT', event: copy.copy }) };
    },

    appendDerived(runId: string, proposal: unknown): AppendResult {
      const valid = validateContract('DirectorProposal', proposal);
      if (!valid.ok) return { ok: false, reason: 'SCHEMA_INVALID', detail: valid.errors.join('; ') };
      const derived = proposal as DirectorProposal;
      if (proposalIds.has(derived.proposal_id)) {
        return { ok: false, reason: 'DUPLICATE_PROPOSAL_ID', detail: `proposal_id "${derived.proposal_id}" is already recorded` };
      }
      const copy = representable(derived);
      if (!copy.ok) return { ok: false, reason: 'SCHEMA_INVALID', detail: copy.detail };
      proposalIds.add(derived.proposal_id);
      return { ok: true, seq: push({ kind: 'DERIVED_PROPOSAL', run_id: runId, proposal: copy.copy }) };
    },

    appendTransitionApplied(transition: StateTransition, diff: readonly StateDiffEntry[], fromRevision: number, toRevision: number): number {
      return push({ kind: 'TRANSITION_APPLIED', transition, diff, from_revision: fromRevision, to_revision: toRevision });
    },

    appendTransitionRejected(transitionId: string | null, reason: TransitionRejectionReason, detail: string): number {
      return push({ kind: 'TRANSITION_REJECTED', transition_id: transitionId, reason, detail });
    },

    appendReset(toRevision: number): number {
      return push({ kind: 'RESET', to_revision: toRevision });
    },

    appendRunStatus(run: unknown): AppendResult {
      const valid = validateContract('DirectorRun', run);
      if (!valid.ok) return { ok: false, reason: 'SCHEMA_INVALID', detail: valid.errors.join('; ') };
      return { ok: true, seq: push({ kind: 'RUN_STATUS', run: run as DirectorRun }) };
    },

    appendGateResult(runId: string, gate: GateResult): number {
      return push({ kind: 'GATE_RESULT', run_id: runId, gate });
    },

    appendSelection(selection: SelectionRecord): number {
      return push({ kind: 'SELECTION', ...selection });
    },

    entries(): readonly LedgerEntry[] {
      return Object.freeze([...entries]);
    },

    observed(): WorldEvent[] {
      return entries.flatMap((entry) => (entry.kind === 'OBSERVED_EVENT' ? [entry.event] : []));
    },

    derived(): Array<{ run_id: string; proposal: DirectorProposal }> {
      return entries.flatMap((entry) => (entry.kind === 'DERIVED_PROPOSAL' ? [{ run_id: entry.run_id, proposal: entry.proposal }] : []));
    },

    size(): number {
      return entries.length;
    },
  };
}

export type EventLedger = ReturnType<typeof createEventLedger>;
