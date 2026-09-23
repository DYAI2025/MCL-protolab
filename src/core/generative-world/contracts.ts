/**
 * TypeScript mirrors of the MCL-81 JSON Schema contracts.
 *
 * JSON Schema remains the authoritative runtime-validation boundary. These
 * types intentionally do not add semantics beyond the schemas.
 */

export type JsonPrimitive = boolean | null | number | string;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonValue = JsonObject | JsonPrimitive | JsonValue[];

export type NonEmptyArray<T> = [T, ...T[]];

export type DirectorRunStatus =
  | 'CREATED'
  | 'PREPARING'
  | 'RUNNING'
  | 'STOPPED'
  | 'FAILED';

export interface CanonProjection {
  projection_id: string;
  source_refs: NonEmptyArray<string>;
  version: string;
  generated_at: string;
  facts: JsonObject;
  constraints: JsonObject;
  open_points: string[];
}

export interface WorldState {
  state_id: string;
  entities: JsonObject;
  locations: JsonObject;
  factions: JsonObject;
  relationships: JsonObject;
  quests: JsonObject;
  inventory: JsonObject;
  world_flags: JsonObject;
  calendar: JsonObject;
  active_events: JsonValue[];
  source_refs: string[];
  revision: number;
}

export interface WorldEvent {
  event_id: string;
  event_type: string;
  timestamp: string;
  actor_refs: string[];
  location_ref: string;
  payload: JsonObject;
  source_refs: string[];
  evidence_class: string;
}

export interface DirectorRun {
  run_id: string;
  canon_projection_ref: string;
  world_state_ref: string;
  event_refs: string[];
  status: DirectorRunStatus;
  source_refs: string[];
  revision: number;
}

export interface DirectorProposal {
  proposal_id: string;
  kind: string;
  summary: string;
  rationale: string;
  required_facts: string[];
  state_preconditions: JsonValue[];
  transition_intent: string[];
  source_refs: string[];
  design_status: string;
  confidence?: number | null;
  provider_trace: JsonObject;
}

export interface SetWorldFlagOperation {
  op: 'SET_WORLD_FLAG';
  flag_ref: string;
  value: boolean;
}

/** The current StateTransition discriminator vocabulary contains this one operation only. */
export type StateTransitionOperation = SetWorldFlagOperation;

export interface StateTransition {
  transition_id: string;
  source_state_ref: string;
  proposal_ref: string;
  operations: NonEmptyArray<StateTransitionOperation>;
  source_refs: string[];
  revision: number;
}

export interface BranchNode {
  branch_id: string;
  parent_state_ref: string;
  event_ref: string;
  proposal_ref: string;
  selection_ref: string;
  transition_ref: string;
  source_refs: string[];
  revision: number;
}

export interface ReplayRef {
  replay_id: string;
  start_state_ref: string;
  transition_refs: string[];
  source_refs: string[];
  revision: number;
}
