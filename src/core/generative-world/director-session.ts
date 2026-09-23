import type { CanonProjection, DirectorProposal, DirectorRunStatus, StateTransition, WorldState } from './contracts.ts';
import type { DirectorProvider, DirectorScope } from './director-context.ts';
import { runDirector, type BoundaryRejection } from './director-orchestrator.ts';
import type { AppendResult } from './event-ledger.ts';
import { cloneJson, deepFreeze } from './json.ts';
import { compileTransition, evaluateProposal, type GateResult, type PolicyScope } from './policy-gate.ts';
import type { StateDiffEntry } from './transition-engine.ts';
import { validateContract } from './validation.ts';
import { createWorldSession } from './world-session.ts';

/**
 * Director Session (MCL-85): observed events → director run → policy gate →
 * human selection → StateTransition. The only path from a proposal to the
 * world is select(), which requires an accepted gate result on an unchanged
 * world (69697537 D3/D6). `world` stays reachable for replay and tests; the
 * director path never bypasses the gate.
 */

export interface DirectorSessionConfig {
  readonly initial_state: unknown;
  readonly canon: CanonProjection;
  readonly director_scope: DirectorScope;
  readonly policy_scope: PolicyScope;
  readonly provider: DirectorProvider;
}

export interface ProposalView {
  readonly proposal: DirectorProposal;
  readonly gate: GateResult;
}

export interface RunView {
  readonly run_id: string;
  readonly status: DirectorRunStatus;
  readonly stop_reason: 'completed' | 'aborted' | null;
  readonly error: string | null;
  readonly revision_at_start: number;
  readonly event_ids: readonly string[];
  readonly proposals: readonly ProposalView[];
  readonly boundary_rejections: readonly BoundaryRejection[];
  readonly resolved: boolean;
  readonly selected_proposal_id: string | null;
}

export type SelectionRefusal =
  | 'NO_ACTIVE_RUN'
  | 'UNKNOWN_PROPOSAL'
  | 'PROPOSAL_REJECTED'
  | 'RUN_ALREADY_RESOLVED'
  | 'STALE_RUN'
  | 'TRANSITION_REJECTED';

export type SelectionResult =
  | { ok: true; proposal_id: string; transition: StateTransition; diff: readonly StateDiffEntry[]; state: WorldState }
  | { ok: false; reason: SelectionRefusal; detail: string };

type MutableRun = { -readonly [K in keyof RunView]: RunView[K] };

export function createDirectorSession(config: DirectorSessionConfig) {
  const canonValid = validateContract('CanonProjection', config.canon);
  if (!canonValid.ok) throw new Error(`createDirectorSession: invalid CanonProjection — ${canonValid.errors.join('; ')}`);

  const world = createWorldSession(config.initial_state);
  let runCounter = 0;
  let active: MutableRun | null = null;

  const refuse = (run: MutableRun, proposalId: string, reason: SelectionRefusal, detail: string): SelectionResult => {
    world.ledger.appendSelection({
      run_id: run.run_id,
      proposal_id: proposalId,
      selection_ref: `${run.run_id}:selection`,
      outcome: 'refused',
      reason,
    });
    return { ok: false, reason, detail };
  };

  return {
    world,
    ledger: world.ledger,

    state(): WorldState {
      return world.state();
    },

    observe(event: unknown): AppendResult {
      return world.observe(event);
    },

    activeRun(): RunView | null {
      return active ? deepFreeze(cloneJson(active)) : null;
    },

    async startRun(eventIds: readonly string[], signal?: AbortSignal): Promise<RunView> {
      const observed = world.ledger.observed();
      const events = eventIds.map((id) => {
        const event = observed.find((candidate) => candidate.event_id === id);
        if (!event) throw new Error(`startRun: event "${id}" was not observed`);
        return event;
      });
      runCounter += 1;
      const stateAtStart = world.state();
      const runId = `${stateAtStart.state_id}-run-${runCounter}`;
      const outcome = await runDirector({
        run_id: runId,
        canon: config.canon,
        state: stateAtStart,
        events,
        scope: config.director_scope,
        provider: config.provider,
        ...(signal ? { signal } : {}),
      });
      for (const doc of outcome.history) world.ledger.appendRunStatus(doc);
      const proposals: ProposalView[] = outcome.proposals.map((proposal) => {
        world.ledger.appendDerived(runId, proposal);
        const gate = evaluateProposal(proposal, { canon: config.canon, state: stateAtStart, scope: config.policy_scope });
        world.ledger.appendGateResult(runId, gate);
        return { proposal, gate };
      });
      active = {
        run_id: runId,
        status: outcome.status,
        stop_reason: outcome.stop_reason,
        error: outcome.error,
        revision_at_start: stateAtStart.revision,
        event_ids: [...eventIds],
        proposals,
        boundary_rejections: outcome.boundary_rejections,
        resolved: false,
        selected_proposal_id: null,
      };
      return deepFreeze(cloneJson(active));
    },

    select(proposalId: string): SelectionResult {
      const run = active;
      if (!run) return { ok: false, reason: 'NO_ACTIVE_RUN', detail: 'there is no director run to select from' };
      const view = run.proposals.find((candidate) => candidate.proposal.proposal_id === proposalId);
      if (!view) return refuse(run, proposalId, 'UNKNOWN_PROPOSAL', `${proposalId} is not a proposal of ${run.run_id}`);
      if (run.resolved) return refuse(run, proposalId, 'RUN_ALREADY_RESOLVED', `${run.run_id} already applied ${run.selected_proposal_id ?? 'a proposal'}`);
      if (view.gate.status !== 'accepted') {
        return refuse(run, proposalId, 'PROPOSAL_REJECTED', `policy gate rejected ${proposalId}: ${view.gate.reasons.join(', ')}`);
      }
      const current = world.state();
      if (current.revision !== run.revision_at_start) {
        return refuse(run, proposalId, 'STALE_RUN', `${run.run_id} was prepared on revision ${run.revision_at_start}, the world is at ${current.revision}`);
      }
      const compiled = compileTransition(view.gate, view.proposal, current, `${run.run_id}:transition`);
      if (!compiled.ok) return refuse(run, proposalId, 'PROPOSAL_REJECTED', compiled.detail);

      world.ledger.appendSelection({
        run_id: run.run_id,
        proposal_id: proposalId,
        selection_ref: `${run.run_id}:selection`,
        outcome: 'accepted',
        reason: null,
      });
      const applied = world.apply(compiled.transition);
      if (!applied.ok) return { ok: false, reason: 'TRANSITION_REJECTED', detail: `${applied.reason}: ${applied.detail}` };
      run.resolved = true;
      run.selected_proposal_id = proposalId;
      return { ok: true, proposal_id: proposalId, transition: compiled.transition, diff: applied.diff, state: applied.state };
    },

    reset(): WorldState {
      active = null;
      return world.reset();
    },
  };
}

export type DirectorSession = ReturnType<typeof createDirectorSession>;
