import type { CanonProjection, JsonObject, WorldEvent, WorldState } from './contracts.ts';
import { cloneJson, deepFreeze } from './json.ts';

/**
 * Director Port (Confluence 64815106 §4.4, 69697537 D8/D9).
 *
 * A provider sees a DirectorContext — never the WorldState itself — and
 * answers with raw output that the orchestrator validates. No SDK, no
 * network: concrete providers (a fake today, a real model behind MCL-88)
 * implement DirectorProvider.
 */

export const DIRECTOR_CONTRACT_VERSION = 'mcl-80-director-contract-v1';

export interface DirectorScope {
  readonly experiment_id: string;
  /** Canon facts the director may see. Everything else stays out of the context. */
  readonly canon_fact_keys: readonly string[];
  /** Observed event types relevant to this experiment's director. */
  readonly event_types: readonly string[];
}

export interface DirectorContext {
  readonly run_id: string;
  readonly contract_version: string;
  readonly experiment_id: string;
  readonly canon: {
    readonly projection_id: string;
    readonly version: string;
    readonly facts: JsonObject;
    readonly constraints: JsonObject;
    readonly open_points: readonly string[];
  };
  readonly state: {
    readonly state_id: string;
    readonly revision: number;
    readonly world_flags: JsonObject;
    readonly entity_refs: readonly string[];
    readonly location_refs: readonly string[];
  };
  readonly events: readonly WorldEvent[];
}

export interface ProviderTrace {
  readonly provider_id: string;
  readonly model_or_fixture: string;
  readonly prompt_or_contract_version: string;
  readonly run_id: string;
}

export interface DirectorProvider {
  readonly provider_id: string;
  readonly model_or_fixture: string;
  /** Raw, untrusted output. Only the orchestrator decides what leaves the boundary. */
  propose(context: DirectorContext, signal: AbortSignal): Promise<unknown>;
}

export interface DirectorContextInput {
  readonly run_id: string;
  readonly canon: CanonProjection;
  readonly state: WorldState;
  readonly events: readonly WorldEvent[];
  readonly scope: DirectorScope;
}

/** Minimal context: scoped canon facts, flags and reference ids, scoped events. */
export function buildDirectorContext(input: DirectorContextInput): DirectorContext {
  const facts: JsonObject = {};
  for (const key of [...input.scope.canon_fact_keys].sort()) {
    const fact = input.canon.facts[key];
    if (fact !== undefined) facts[key] = cloneJson(fact);
  }
  return deepFreeze({
    run_id: input.run_id,
    contract_version: DIRECTOR_CONTRACT_VERSION,
    experiment_id: input.scope.experiment_id,
    canon: {
      projection_id: input.canon.projection_id,
      version: input.canon.version,
      facts,
      constraints: cloneJson(input.canon.constraints),
      open_points: [...input.canon.open_points],
    },
    state: {
      state_id: input.state.state_id,
      revision: input.state.revision,
      world_flags: cloneJson(input.state.world_flags),
      entity_refs: Object.keys(input.state.entities).sort(),
      location_refs: Object.keys(input.state.locations).sort(),
    },
    events: input.events.filter((event) => input.scope.event_types.includes(event.event_type)).map((event) => cloneJson(event)),
  });
}
