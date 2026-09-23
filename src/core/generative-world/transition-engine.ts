import type { JsonValue, StateTransition, StateTransitionOperation, WorldState } from './contracts.ts';
import { cloneJson, deepFreeze } from './json.ts';
import { validateContract } from './validation.ts';

/**
 * Deterministic Transition Engine (Confluence 64815106 §4.7, 69697537 D4/D6).
 *
 * The only way a WorldState changes. Every operation needs an allowlisted
 * handler; the input state is never mutated; a rejection leaves no trace in
 * the returned state. Pure functions — replay needs no provider.
 */

export const ALLOWED_OPERATIONS = ['SET_WORLD_FLAG'] as const;

export type TransitionRejectionReason =
  | 'STATE_INVALID'
  | 'TRANSITION_INVALID'
  | 'STATE_REF_MISMATCH'
  | 'OPERATION_NOT_ALLOWED'
  | 'UNKNOWN_FLAG'
  | 'FLAG_NOT_BOOLEAN';

export interface StateDiffEntry {
  path: string[];
  before: JsonValue;
  after: JsonValue;
}

export type TransitionResult =
  | { ok: true; state: WorldState; diff: StateDiffEntry[] }
  | { ok: false; reason: TransitionRejectionReason; detail: string };

export type OperationResult =
  | { ok: true; diff: StateDiffEntry[] }
  | { ok: false; reason: TransitionRejectionReason; detail: string };

export type ReplayResult =
  | { ok: true; state: WorldState; diffs: StateDiffEntry[][] }
  | { ok: false; index: number; reason: TransitionRejectionReason; detail: string };

type OperationHandler = (draft: WorldState, operation: StateTransitionOperation) => OperationResult;

const HANDLERS: Record<(typeof ALLOWED_OPERATIONS)[number], OperationHandler> = {
  SET_WORLD_FLAG: (draft, operation) => {
    if (!Object.hasOwn(draft.world_flags, operation.flag_ref)) {
      return { ok: false, reason: 'UNKNOWN_FLAG', detail: `flag "${operation.flag_ref}" is not declared in ${draft.state_id}` };
    }
    const before = draft.world_flags[operation.flag_ref];
    if (typeof before !== 'boolean') {
      return { ok: false, reason: 'FLAG_NOT_BOOLEAN', detail: `flag "${operation.flag_ref}" holds a non-boolean value` };
    }
    draft.world_flags[operation.flag_ref] = operation.value;
    return {
      ok: true,
      diff: before === operation.value ? [] : [{ path: ['world_flags', operation.flag_ref], before, after: operation.value }],
    };
  },
};

/** Applies one operation to a mutable draft. Unknown operations are refused. */
export function applyOperation(draft: WorldState, operation: StateTransitionOperation): OperationResult {
  const op = String((operation as { op?: unknown }).op);
  const handler = Object.hasOwn(HANDLERS, op) ? HANDLERS[op as keyof typeof HANDLERS] : undefined;
  if (!handler) return { ok: false, reason: 'OPERATION_NOT_ALLOWED', detail: `operation "${op}" is not in the allowlist` };
  return handler(draft, operation);
}

export function applyTransition(state: WorldState, transition: unknown): TransitionResult {
  const stateValid = validateContract('WorldState', state);
  if (!stateValid.ok) return { ok: false, reason: 'STATE_INVALID', detail: stateValid.errors.join('; ') };
  const transitionValid = validateContract('StateTransition', transition);
  if (!transitionValid.ok) return { ok: false, reason: 'TRANSITION_INVALID', detail: transitionValid.errors.join('; ') };

  const accepted = transition as StateTransition;
  if (accepted.source_state_ref !== state.state_id) {
    return {
      ok: false,
      reason: 'STATE_REF_MISMATCH',
      detail: `transition ${accepted.transition_id} targets "${accepted.source_state_ref}", not "${state.state_id}"`,
    };
  }

  const draft = cloneJson(state);
  const diff: StateDiffEntry[] = [];
  for (const operation of accepted.operations) {
    const result = applyOperation(draft, operation);
    if (!result.ok) return result;
    diff.push(...result.diff);
  }
  const fromRevision = draft.revision;
  draft.revision = fromRevision + 1;
  diff.push({ path: ['revision'], before: fromRevision, after: draft.revision });
  return { ok: true, state: deepFreeze(draft), diff: deepFreeze(diff) };
}

/** Applies transitions in order from a start state; stops at the first rejection. */
export function replayTransitions(initial: WorldState, transitions: readonly unknown[]): ReplayResult {
  let current = deepFreeze(cloneJson(initial));
  const diffs: StateDiffEntry[][] = [];
  for (const [index, transition] of transitions.entries()) {
    const result = applyTransition(current, transition);
    if (!result.ok) return { ok: false, index, reason: result.reason, detail: result.detail };
    current = result.state;
    diffs.push(result.diff);
  }
  return { ok: true, state: current, diffs };
}
