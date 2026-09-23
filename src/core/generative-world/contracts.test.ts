import { describe, expect, it } from 'vitest';
import type {
  BranchNode,
  CanonProjection,
  DirectorProposal,
  DirectorRun,
  ReplayRef,
  StateTransition,
  StateTransitionOperation,
  WorldEvent,
  WorldState,
} from './contracts.ts';

const zhalmCanonProjection = {
  projection_id: 'mcl-director-canon-v1',
  source_refs: ['MLOA:20250626', 'MLOA:64815106'],
  version: '1',
  generated_at: '2026-09-19T00:00:00Z',
  facts: {},
  constraints: {},
  open_points: [],
} satisfies CanonProjection;

const zhalmWorldState = {
  state_id: 'glade-initial-state',
  entities: {},
  locations: {},
  factions: {},
  relationships: {},
  quests: {},
  inventory: {},
  world_flags: {},
  calendar: {},
  active_events: [],
  source_refs: ['MLOA:64815106'],
  revision: 1,
} satisfies WorldState;

const zhalmWorldEvent = {
  event_id: 'zhalm-network-alert-001',
  event_type: 'NETWORK_ALERT',
  timestamp: '2026-09-19T00:00:00Z',
  actor_refs: [],
  location_ref: 'zhalm-forest',
  payload: {},
  source_refs: ['MLOA:64815106'],
  evidence_class: 'observed_gameplay',
} satisfies WorldEvent;

const zhalmDirectorRun = {
  run_id: 'zhalm-director-run-001',
  canon_projection_ref: 'mcl-director-canon-v1',
  world_state_ref: 'glade-initial-state',
  event_refs: ['zhalm-network-alert-001'],
  status: 'CREATED',
  source_refs: ['MLOA:64815106'],
  revision: 1,
} satisfies DirectorRun;

const zhalmDirectorProposal = {
  proposal_id: 'proposal-zhalm-001',
  kind: 'world_event',
  summary: 'A second Zhalm sensor cluster becomes active.',
  rationale: 'Derived from the triggered sound-network event.',
  required_facts: ['zhalm-network-exists'],
  state_preconditions: [],
  transition_intent: [],
  source_refs: ['MLOA:64815106'],
  design_status: 'TENTATIVE',
  confidence: null,
  provider_trace: {},
} satisfies DirectorProposal;

const zhalmStateTransition = {
  transition_id: 'transition-zhalm-001',
  source_state_ref: 'glade-initial-state',
  proposal_ref: 'proposal-zhalm-001',
  operations: [{ op: 'SET_WORLD_FLAG', flag_ref: 'zhalm-network-alert-active', value: true }],
  source_refs: ['MLOA:64815106'],
  revision: 1,
} satisfies StateTransition;

const zhalmBranchNode = {
  branch_id: 'branch-zhalm-001',
  parent_state_ref: 'glade-initial-state',
  event_ref: 'zhalm-network-alert-001',
  proposal_ref: 'proposal-zhalm-001',
  selection_ref: 'selection-zhalm-001',
  transition_ref: 'transition-zhalm-001',
  source_refs: ['MLOA:64815106'],
  revision: 1,
} satisfies BranchNode;

const zhalmReplayRef = {
  replay_id: 'replay-zhalm-001',
  start_state_ref: 'glade-initial-state',
  transition_refs: ['transition-zhalm-001'],
  source_refs: ['MLOA:64815106'],
  revision: 1,
} satisfies ReplayRef;

const zhalmContracts = {
  branchNode: zhalmBranchNode,
  canonProjection: zhalmCanonProjection,
  directorProposal: zhalmDirectorProposal,
  directorRun: zhalmDirectorRun,
  replayRef: zhalmReplayRef,
  stateTransition: zhalmStateTransition,
  worldEvent: zhalmWorldEvent,
  worldState: zhalmWorldState,
};

describe('Generative World TypeScript contracts', () => {
  it('models all eight valid Zhalm contract examples', () => {
    expect(Object.keys(zhalmContracts).sort()).toEqual([
      'branchNode',
      'canonProjection',
      'directorProposal',
      'directorRun',
      'replayRef',
      'stateTransition',
      'worldEvent',
      'worldState',
    ]);
  });

  it('keeps the current StateTransition vocabulary and reference fields narrow', () => {
    const unknownOperation: StateTransitionOperation = {
      // @ts-expect-error StateTransition currently permits SET_WORLD_FLAG only.
      op: 'REPLACE_WORLD_STATE',
      flag_ref: 'zhalm-network-alert-active',
      value: true,
    };
    const embeddedProposalBranch: BranchNode = {
      ...zhalmBranchNode,
      // @ts-expect-error BranchNode proposal_ref is a token, never an embedded proposal.
      proposal_ref: zhalmDirectorProposal,
    };
    const emptyCanonSources: CanonProjection = {
      ...zhalmCanonProjection,
      // @ts-expect-error CanonProjection source_refs has the schema's minItems: 1 shape.
      source_refs: [],
    };

    void unknownOperation;
    void embeddedProposalBranch;
    void emptyCanonSources;
    expect(zhalmReplayRef.transition_refs).toEqual(['transition-zhalm-001']);
  });
});
