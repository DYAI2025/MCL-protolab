import type { CanonProjection, DirectorProposal, DirectorRun, DirectorRunStatus, WorldEvent, WorldState } from './contracts.ts';
import {
  buildDirectorContext,
  DIRECTOR_CONTRACT_VERSION,
  type DirectorContext,
  type DirectorProvider,
  type DirectorScope,
  type ProviderTrace,
} from './director-context.ts';
import { cloneJson, deepFreeze } from './json.ts';
import { validateContract } from './validation.ts';

/**
 * DirectorOrchestrator (MCL-83): one director run with the lifecycle
 * CREATED → PREPARING → RUNNING → STOPPED | FAILED. The orchestrator only
 * reads the world; it never changes a WorldState. It stamps the provider
 * trace and lets only schema-valid proposals leave the provider boundary.
 */

export interface DirectorRunInput {
  readonly run_id: string;
  readonly canon: CanonProjection;
  readonly state: WorldState;
  readonly events: readonly WorldEvent[];
  readonly scope: DirectorScope;
  readonly provider: DirectorProvider;
  readonly signal?: AbortSignal;
}

export interface BoundaryRejection {
  readonly index: number;
  readonly errors: readonly string[];
}

export interface DirectorRunOutcome {
  readonly run: DirectorRun;
  readonly history: readonly DirectorRun[];
  readonly status: DirectorRunStatus;
  readonly stop_reason: 'completed' | 'aborted' | null;
  readonly proposals: readonly DirectorProposal[];
  readonly boundary_rejections: readonly BoundaryRejection[];
  readonly error: string | null;
  readonly context: DirectorContext | null;
}

const ABORTED = Symbol('director-run-aborted');

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** A promise that rejects on abort, plus a dispose() that removes its listener again. */
const abortionOf = (signal: AbortSignal): { promise: Promise<never>; dispose: () => void } => {
  const holder: { listener: (() => void) | null } = { listener: null };
  const promise = new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(ABORTED);
      return;
    }
    holder.listener = () => reject(ABORTED);
    signal.addEventListener('abort', holder.listener, { once: true });
  });
  return {
    promise,
    dispose: () => {
      if (holder.listener) signal.removeEventListener('abort', holder.listener);
      holder.listener = null;
    },
  };
};

export async function runDirector(input: DirectorRunInput): Promise<DirectorRunOutcome> {
  const signal = input.signal ?? new AbortController().signal;
  const history: DirectorRun[] = [];
  let last: DirectorRun | null = null;

  // Structurally broken input must still produce schema-valid run documents
  // and end in FAILED — reading refs defensively keeps record() from throwing.
  const canonRef = typeof input.canon?.projection_id === 'string' && input.canon.projection_id !== '' ? input.canon.projection_id : 'invalid-canon-projection';
  const stateRef = typeof input.state?.state_id === 'string' && input.state.state_id !== '' ? input.state.state_id : 'invalid-world-state';
  const eventRefs = Array.isArray(input.events)
    ? input.events.map((event) => (typeof event?.event_id === 'string' && event.event_id !== '' ? event.event_id : 'invalid-event'))
    : [];
  const sourceRefs = Array.isArray(input.canon?.source_refs) ? input.canon.source_refs.filter((ref) => typeof ref === 'string') : [];

  const record = (status: DirectorRunStatus): DirectorRun => {
    last = {
      run_id: input.run_id,
      canon_projection_ref: canonRef,
      world_state_ref: stateRef,
      event_refs: [...eventRefs],
      status,
      source_refs: [...sourceRefs],
      revision: history.length + 1,
    };
    history.push(last);
    return last;
  };

  const finish = (
    run: DirectorRun,
    rest: Omit<DirectorRunOutcome, 'run' | 'history' | 'status'>,
  ): DirectorRunOutcome => deepFreeze(cloneJson({ run, history, status: run.status, ...rest }));

  const stopped = (context: DirectorContext | null): DirectorRunOutcome =>
    finish(record('STOPPED'), { stop_reason: 'aborted', proposals: [], boundary_rejections: [], error: null, context });

  const failed = (error: string, context: DirectorContext | null): DirectorRunOutcome =>
    finish(record('FAILED'), { stop_reason: null, proposals: [], boundary_rejections: [], error, context });

  record('CREATED');
  if (signal.aborted) return stopped(null);

  record('PREPARING');
  const canonValid = validateContract('CanonProjection', input.canon);
  if (!canonValid.ok) return failed(`CanonProjection invalid: ${canonValid.errors.join('; ')}`, null);
  const stateValid = validateContract('WorldState', input.state);
  if (!stateValid.ok) return failed(`WorldState invalid: ${stateValid.errors.join('; ')}`, null);
  if (!Array.isArray(input.events)) return failed('WorldEvent list invalid: events must be an array', null);
  for (const event of input.events) {
    const eventValid = validateContract('WorldEvent', event);
    if (!eventValid.ok) return failed(`WorldEvent invalid: ${eventValid.errors.join('; ')}`, null);
  }
  const context = buildDirectorContext(input);
  if (signal.aborted) return stopped(context);

  record('RUNNING');
  let raw: unknown;
  const abortion = abortionOf(signal);
  try {
    raw = await Promise.race([input.provider.propose(context, signal), abortion.promise]);
  } catch (error) {
    if (error === ABORTED || signal.aborted) return stopped(context);
    return failed(`PROVIDER_ERROR: ${messageOf(error)}`, context);
  } finally {
    abortion.dispose();
  }
  if (signal.aborted) return stopped(context);
  if (!Array.isArray(raw)) return failed('PROVIDER_OUTPUT_NOT_A_LIST: the provider must answer with an array of proposals', context);

  const trace: ProviderTrace = {
    provider_id: input.provider.provider_id,
    model_or_fixture: input.provider.model_or_fixture,
    prompt_or_contract_version: DIRECTOR_CONTRACT_VERSION,
    run_id: input.run_id,
  };
  const proposals: DirectorProposal[] = [];
  const boundaryRejections: BoundaryRejection[] = [];
  const seen = new Set<string>();

  raw.forEach((item: unknown, index: number) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      boundaryRejections.push({ index, errors: ['proposal must be a JSON object'] });
      return;
    }
    let candidate: Record<string, unknown>;
    try {
      candidate = { ...cloneJson(item as Record<string, unknown>), provider_trace: { ...trace } };
    } catch (error) {
      boundaryRejections.push({ index, errors: [`proposal is not representable as JSON: ${messageOf(error)}`] });
      return;
    }
    const valid = validateContract('DirectorProposal', candidate);
    if (!valid.ok) {
      boundaryRejections.push({ index, errors: valid.errors });
      return;
    }
    const proposal = candidate as unknown as DirectorProposal;
    if (seen.has(proposal.proposal_id)) {
      boundaryRejections.push({ index, errors: [`duplicate proposal_id ${proposal.proposal_id}`] });
      return;
    }
    seen.add(proposal.proposal_id);
    proposals.push(proposal);
  });

  return finish(record('STOPPED'), {
    stop_reason: 'completed',
    proposals,
    boundary_rejections: boundaryRejections,
    error: null,
    context,
  });
}
