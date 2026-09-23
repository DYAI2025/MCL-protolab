import type { StateTransition, WorldState } from './contracts.ts';
import { createEventLedger, type AppendResult } from './event-ledger.ts';
import { cloneJson, deepFreeze } from './json.ts';
import { applyTransition, replayTransitions, type ReplayResult, type TransitionResult } from './transition-engine.ts';
import { validateContract } from './validation.ts';

/**
 * One experiment's world: the initial state, the current state, the list of
 * applied transitions and the append-only ledger that evidences all of it.
 * Reset returns to the initial state; replay rebuilds the current state from
 * the initial state and the applied transitions without any provider.
 */
export function createWorldSession(initialState: unknown) {
  const valid = validateContract('WorldState', initialState);
  if (!valid.ok) throw new Error(`createWorldSession: invalid initial WorldState — ${valid.errors.join('; ')}`);

  const initial: WorldState = deepFreeze(cloneJson(initialState as WorldState));
  let current: WorldState = initial;
  let applied: StateTransition[] = [];
  const ledger = createEventLedger();

  const transitionIdOf = (transition: unknown): string | null => {
    const id = (transition as { transition_id?: unknown } | null)?.transition_id;
    return typeof id === 'string' ? id : null;
  };

  return {
    ledger,

    state(): WorldState {
      return current;
    },

    initialState(): WorldState {
      return initial;
    },

    observe(event: unknown): AppendResult {
      return ledger.appendObserved(event, current);
    },

    apply(transition: unknown): TransitionResult {
      const result = applyTransition(current, transition);
      if (result.ok) {
        const recorded = deepFreeze(cloneJson(transition as StateTransition));
        ledger.appendTransitionApplied(recorded, result.diff, current.revision, result.state.revision);
        applied = [...applied, recorded];
        current = result.state;
      } else {
        ledger.appendTransitionRejected(transitionIdOf(transition), result.reason, result.detail);
      }
      return result;
    },

    reset(): WorldState {
      current = initial;
      applied = [];
      ledger.appendReset(initial.revision);
      return current;
    },

    replay(): ReplayResult {
      return replayTransitions(initial, applied);
    },

    appliedTransitions(): StateTransition[] {
      return [...applied];
    },
  };
}

export type WorldSession = ReturnType<typeof createWorldSession>;
