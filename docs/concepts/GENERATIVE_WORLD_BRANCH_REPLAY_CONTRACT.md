# Generative World Branch / Replay Contracts (MCL-81, Cycle 6)

Purpose: give later deterministic branch/replay work (MCL-82, MCL-86) a versioned,
machine-validatable reference foundation without embedding World State or
free-form provider state in the branch/replay layer.

## BranchNode

A BranchNode is **not** a runtime branch, a fork implementation, or a decision
history. It is a reference-only ledger entry: one stable identity plus opaque
references to the parent state, triggering event, proposal, selection token and
transition that produced the branch.

Each branch node must validate against `schemas/branch-node.schema.json` and
declare `branch_id`, `parent_state_ref`, `event_ref`, `proposal_ref`,
`selection_ref`, `transition_ref`, `source_refs` and `revision`.

Reference fields are tokens only. A BranchNode must never embed a WorldState,
event/proposal/transition payloads, replacement state or provider context.

## ReplayRef

A ReplayRef is **not** replay execution. It is the structured deterministic
input for later replay: a starting WorldState reference plus an ORDERED array
of StateTransition references.

Each replay ref must validate against `schemas/replay-ref.schema.json` and
declare `replay_id`, `start_state_ref`, `transition_refs`, `source_refs` and
`revision`.

`transition_refs` holds reference tokens only and preserves array order. An
empty sequence is valid as an identity replay from the starting state.

## Non-goals

Forking, ancestry graphs, cycle validation, branch selection behavior, branch
diffs, replay execution, Transition Engine changes, Event Ledger changes, new
StateTransition operations and donor-code reuse are explicitly out of scope and
belong to later work.
