# Generative World Contract Foundation (MCL-81, Cycle 7)

Status: repository evidence only. This document does not change Jira state,
declare merge readiness, or authorize implementation of MCL-82.

## Authority and TypeScript parity

The JSON Schemas under `schemas/` remain the authoritative runtime-validation
boundaries. `src/core/generative-world/contracts.ts` is a TypeScript mirror for
authoring and static checking; it does not replace AJV validation or introduce
runtime behavior.

| Contract | Schema | TypeScript representation | Schema-specific constraint retained |
| --- | --- | --- | --- |
| CanonProjection | `schemas/canon-projection.schema.json` | `CanonProjection` | non-empty `source_refs`; object facts/constraints; string `open_points` |
| WorldState | `schemas/world-state.schema.json` | `WorldState` | required object collections, event array, source refs and revision |
| WorldEvent | `schemas/world-event.schema.json` | `WorldEvent` | actor-reference array, location token, object payload and evidence class |
| DirectorRun | `schemas/director-run.schema.json` | `DirectorRun` | `CREATED | PREPARING | RUNNING | STOPPED | FAILED` status |
| DirectorProposal | `schemas/director-proposal.schema.json` | `DirectorProposal` | optional nullable `confidence`; token-only transition intent |
| StateTransition | `schemas/state-transition.schema.json` | `StateTransition` | non-empty operations; `SET_WORLD_FLAG` is the complete current vocabulary |
| BranchNode | `schemas/branch-node.schema.json` | `BranchNode` | state/event/proposal/selection/transition fields are string reference tokens |
| ReplayRef | `schemas/replay-ref.schema.json` | `ReplayRef` | start-state token plus ordered transition-reference array |

`JsonObject` and `JsonValue` occur only where a schema intentionally permits
an unconstrained JSON object or array item. They do not add fields, metadata,
operations, or a future mutation registry. Schema-level `minLength`,
`minimum`, `additionalProperties` and every runtime shape check continue to be
enforced by AJV.

## Zhalm source-reference closeout

The tracked Zhalm concept and experiment already cite the existing MCL sources
`MLOA:32735234#Zhalm-Druhen` and `MLOA:20250626`. The MCL-81 example chain
uses the approved target source `MLOA:64815106`; its CanonProjection also
retains `MLOA:20250626`. This gives every MCL-81 Zhalm example a traceable MCL
source reference without adding lore or changing game design.

| Evidence | Source references |
| --- | --- |
| `concepts/creatures/zhalm.json`, `experiments/zhalm-forest-v1/experiment.json` | `MLOA:32735234#Zhalm-Druhen`, `MLOA:20250626` |
| `projections/example-canon-projection.json` | `MLOA:20250626`, `MLOA:64815106` |
| `states/`, `world-events/`, `director-runs/`, `proposals/`, `transitions/`, `branches/`, `replays/` example chain | `MLOA:64815106` |

## Infinite World donor and license disposition

MCL-81 reuses architecture **semantics** associated with the Infinite World
donor: separating canon projection, world state, events, director inputs and
proposals, explicit constrained transitions, and reference-only branch/replay
records.

It does **not** copy or adapt Infinite World source code. Inspection of the
complete MCL-81 diff from `482fd9b0484ef312067f7e3743ee80295a60a9e0` through
this Cycle-7 evidence finds hand-authored JSON Schemas, fixtures, tests,
TypeScript type declarations and documentation only; it contains no donor
source file, vendored dependency, donor import or adapted implementation.

Therefore, for the actual MCL-81 implementation, semantic architecture reuse
does not itself trigger an Apache-2.0 attribution or NOTICE obligation. This
is scoped to MCL-81 and does not make a global claim about existing
dependencies, future donor-code reuse, or other repository materials.

## AC evidence map

The work item supplies eight MCL-81 contract obligations; this table indexes
them as AC1–AC8 in that supplied order. It is a repository evidence map, not a
substitute for Jira acceptance-criteria text.

| AC | Artifact | Executable verification | Evidence state | Unresolved item |
| --- | --- | --- | --- | --- |
| AC1 — CanonProjection | schema, fixture, `CanonProjection` | focused AJV test; `npm run validate:contracts`; type-contract test | repository evidence present | Jira wording was unavailable from gbrain lookup |
| AC2 — WorldState | schema, fixture, `WorldState` | focused AJV test; contract validation; type-contract test | repository evidence present | Jira wording was unavailable from gbrain lookup |
| AC3 — WorldEvent | schema, fixture, `WorldEvent` | focused AJV test; contract validation; type-contract test | repository evidence present | Jira wording was unavailable from gbrain lookup |
| AC4 — DirectorRun | schema, fixture, `DirectorRun` | focused AJV test; contract validation; type-contract test | repository evidence present | Jira wording was unavailable from gbrain lookup |
| AC5 — DirectorProposal | schema, fixture, `DirectorProposal` | focused AJV negative tests; contract validation; type-contract test | repository evidence present | Jira wording was unavailable from gbrain lookup |
| AC6 — StateTransition | schema, fixture, `StateTransition` | focused AJV tests for `const`, arbitrary replacement and smuggling; type-contract test | repository evidence present | Jira wording was unavailable from gbrain lookup |
| AC7 — BranchNode | schema, fixture, `BranchNode` | focused AJV reference-only/smuggling tests; contract validation; type-contract test | repository evidence present | Jira wording was unavailable from gbrain lookup |
| AC8 — ReplayRef | schema, fixture, `ReplayRef` | focused AJV ordering/reference-only tests; contract validation; type-contract test | repository evidence present | Jira wording was unavailable from gbrain lookup |

The final visual increment gate remains required evidence for the completed
Cycle-7 commit even though these files do not modify runtime behavior.
