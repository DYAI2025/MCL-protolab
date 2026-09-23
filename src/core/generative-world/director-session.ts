import type { CanonProjection, DirectorProposal, DirectorRunStatus, StateTransition, WorldState } from './contracts.ts';
import type { DirectorProvider, DirectorScope } from './director-context.ts';
import { runDirector, type BoundaryRejection } from './director-orchestrator.ts';
import type { AppendResult } from './event-ledger.ts';
import { canonicalJson, cloneJson, deepFreeze } from './json.ts';
import { compileTransition, evaluateProposal, redactPrivacyFindings, type GateResult, type PolicyScope } from './policy-gate.ts';
import { applyTransition, type ReplayResult, type StateDiffEntry } from './transition-engine.ts';
import { validateContract } from './validation.ts';
import { createWorldSession } from './world-session.ts';

/**
 * Director Session (MCL-85): observed events → director run → policy gate →
 * human selection → StateTransition. select() is the only path from a
 * proposal to the world: it needs an accepted gate result on the exact world
 * the run was prepared on (69697537 D3/D6). The session exposes no write
 * access to the world or the ledger.
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
  readonly selection_ref: string | null;
  /** True when a reset or a later-started run made this run obsolete before it completed; it never becomes active. */
  readonly superseded: boolean;
}

export type SelectionRefusal =
  | 'NO_ACTIVE_RUN'
  | 'UNKNOWN_PROPOSAL'
  | 'PROPOSAL_REJECTED'
  | 'RUN_ALREADY_RESOLVED'
  | 'STALE_RUN'
  | 'TRANSITION_REJECTED';

export type SelectionResult =
  | { ok: true; proposal_id: string; selection_ref: string; transition: StateTransition; diff: readonly StateDiffEntry[]; state: WorldState }
  | { ok: false; reason: SelectionRefusal; detail: string };

type ActiveRun = { -readonly [K in keyof RunView]: RunView[K] } & {
  /** Canonical JSON of the world the run was prepared on. */
  fingerprint: string;
  attempts: number;
};

const toView = (run: ActiveRun): RunView => deepFreeze(cloneJson({
  run_id: run.run_id,
  status: run.status,
  stop_reason: run.stop_reason,
  error: run.error,
  revision_at_start: run.revision_at_start,
  event_ids: run.event_ids,
  proposals: run.proposals,
  boundary_rejections: run.boundary_rejections,
  resolved: run.resolved,
  selected_proposal_id: run.selected_proposal_id,
  selection_ref: run.selection_ref,
  superseded: run.superseded,
}));

export function createDirectorSession(config: DirectorSessionConfig) {
  const canonValid = validateContract('CanonProjection', config.canon);
  if (!canonValid.ok) throw new Error(`createDirectorSession: invalid CanonProjection — ${canonValid.errors.join('; ')}`);

  const world = createWorldSession(config.initial_state);
  let runCounter = 0;
  let latestStarted = 0;
  let epoch = 0;
  let active: ActiveRun | null = null;

  const nextSelectionRef = (run: ActiveRun): string => {
    run.attempts += 1;
    return `${run.run_id}:selection-${run.attempts}`;
  };

  const refuse = (run: ActiveRun, proposalId: string, reason: SelectionRefusal, detail: string): SelectionResult => {
    world.ledger.appendSelection({
      run_id: run.run_id,
      proposal_id: proposalId,
      selection_ref: nextSelectionRef(run),
      outcome: 'refused',
      reason,
    });
    return { ok: false, reason, detail };
  };

  return {
    ledger: {
      entries: () => world.ledger.entries(),
      observed: () => world.ledger.observed(),
      derived: () => world.ledger.derived(),
      size: () => world.ledger.size(),
    },

    state(): WorldState {
      return world.state();
    },

    replay(): ReplayResult {
      return world.replay();
    },

    observe(event: unknown): AppendResult {
      return world.observe(event);
    },

    activeRun(): RunView | null {
      return active ? toView(active) : null;
    },

    async startRun(eventIds: readonly string[], signal?: AbortSignal): Promise<RunView> {
      const observed = world.ledger.observed();
      const events = eventIds.map((id) => {
        const event = observed.find((candidate) => candidate.event_id === id);
        if (!event) throw new Error(`startRun: event "${id}" was not observed`);
        return event;
      });
      runCounter += 1;
      const runNumber = runCounter;
      latestStarted = runNumber;
      const runEpoch = epoch;
      const stateAtStart = world.state();
      const runId = `${stateAtStart.state_id}-run-${runNumber}`;

      const outcome = await runDirector({
        run_id: runId,
        canon: config.canon,
        state: stateAtStart,
        events,
        scope: config.director_scope,
        provider: config.provider,
        ...(signal ? { signal } : {}),
      });

      for (const doc of outcome.history) {
        const recorded = world.ledger.appendRunStatus(doc);
        if (!recorded.ok) throw new Error(`startRun: run status of ${runId} is not recordable — ${recorded.detail}`);
      }
      const boundaryRejections: BoundaryRejection[] = [...outcome.boundary_rejections];
      const proposals: ProposalView[] = [];
      outcome.proposals.forEach((proposal, index) => {
        const gate = evaluateProposal(proposal, { canon: config.canon, state: stateAtStart, scope: config.policy_scope });
        // Blocked content is never persisted or shown: store the redacted copy (D12).
        const leaks = gate.reasons.includes('PRIVACY_OR_SECRET_FIELD');
        const storedProposal = leaks ? redactPrivacyFindings(proposal) : proposal;
        const storedGate = leaks ? redactPrivacyFindings(gate) : gate;
        const recorded = world.ledger.appendDerived(runId, storedProposal);
        if (!recorded.ok) {
          boundaryRejections.push({ index, errors: [`${recorded.reason}: ${recorded.detail}`] });
          return;
        }
        world.ledger.appendGateResult(runId, storedGate);
        proposals.push({ proposal: storedProposal, gate: storedGate });
      });

      const run: ActiveRun = {
        run_id: runId,
        status: outcome.status,
        stop_reason: outcome.stop_reason,
        error: outcome.error,
        revision_at_start: stateAtStart.revision,
        event_ids: [...eventIds],
        proposals,
        boundary_rejections: boundaryRejections,
        resolved: false,
        selected_proposal_id: null,
        selection_ref: null,
        superseded: runEpoch !== epoch || runNumber !== latestStarted,
        fingerprint: canonicalJson(stateAtStart),
        attempts: 0,
      };
      if (!run.superseded) active = run;
      return toView(run);
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
      if (canonicalJson(current) !== run.fingerprint) {
        return refuse(run, proposalId, 'STALE_RUN', `${run.run_id} was prepared on revision ${run.revision_at_start}; the world has changed since`);
      }
      const compiled = compileTransition(view.gate, view.proposal, current, `${run.run_id}:transition`);
      if (!compiled.ok) return refuse(run, proposalId, 'PROPOSAL_REJECTED', compiled.detail);
      // The gate can accept what the engine refuses (e.g. a non-boolean flag):
      // try the pure engine first so no accepted selection is recorded in vain.
      const dryRun = applyTransition(current, compiled.transition);
      if (!dryRun.ok) return refuse(run, proposalId, 'TRANSITION_REJECTED', `${dryRun.reason}: ${dryRun.detail}`);

      const selectionRef = nextSelectionRef(run);
      world.ledger.appendSelection({ run_id: run.run_id, proposal_id: proposalId, selection_ref: selectionRef, outcome: 'accepted', reason: null });
      const applied = world.apply(compiled.transition);
      if (!applied.ok) throw new Error(`select: the engine rejected a transition its dry run accepted (${applied.reason})`);
      run.resolved = true;
      run.selected_proposal_id = proposalId;
      run.selection_ref = selectionRef;
      return { ok: true, proposal_id: proposalId, selection_ref: selectionRef, transition: compiled.transition, diff: applied.diff, state: applied.state };
    },

    reset(): WorldState {
      epoch += 1;
      active = null;
      return world.reset();
    },
  };
}

export type DirectorSession = ReturnType<typeof createDirectorSession>;
