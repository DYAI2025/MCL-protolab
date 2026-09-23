# Generative World Director — deterministic slice (MCL-82 … MCL-85)

Status: implementation record for Jira sprint "MCL Protolab S1 – Director" (ID 777, Epic MCL-80).
Target architecture: Confluence MLOA 64815106. Sprint architecture and decisions D1–D13: Confluence MLOA 69697537.
Contracts: [`GENERATIVE_WORLD_CONTRACT_FOUNDATION.md`](./GENERATIVE_WORLD_CONTRACT_FOUNDATION.md) (MCL-81).

Nothing here is canon. Director output is a proposal (`DERIVED`), never a design decision; the Human Value Gate is MCL-91.

## Deterministic core (MCL-82)

All modules live engine-free in `src/core/generative-world/` (D1).

| Module | Responsibility |
| --- | --- |
| `json.ts` | canonical JSON (sorted keys, throws on non-JSON values), deep clone, deep freeze |
| `validation.ts` | AJV validators compiled from `schemas/*.schema.json`; the same code runs in Node and in the browser (D2) |
| `event-ledger.ts` | append-only Event & Evidence Ledger; observed events and derived proposals are separate entry kinds (D7) |
| `transition-engine.ts` | the only way a `WorldState` changes: allowlisted operations, before/after diff, revision increment, replay |
| `world-session.ts` | one experiment's world: initial and current state, applied transitions, apply, reset, replay, ledger |

Rules the tests enforce:

- `SET_WORLD_FLAG` is the only operation, and only on a flag the state declares with a boolean value (D4). Anything else is rejected with `UNKNOWN_FLAG`, `FLAG_NOT_BOOLEAN`, `OPERATION_NOT_ALLOWED` or `TRANSITION_INVALID`.
- `source_state_ref` must equal the state's `state_id` (`STATE_REF_MISMATCH` otherwise, D6). The engine increments `revision`; the ledger's `TRANSITION_APPLIED` entry carries `from_revision`, `to_revision`, the transition and its diff.
- A rejected transition never changes the state; the session records it as `TRANSITION_REJECTED`.
- The input state is never mutated; results are deep-frozen.
- Replay of the applied transitions from the initial state reproduces the current state byte for byte (canonical JSON); reset returns a byte-identical copy of the initial state and appends a `RESET` entry.
- An observed event needs `evidence_class: "observed_gameplay"`, known `actor_refs` and `location_ref`, and a unique `event_id`.
- Validators run with `strictNumbers`, so NaN and ±Infinity never pass as contract numbers. Input that is schema-valid but not representable as JSON (an `undefined` or NaN inside an open object) is refused as `SCHEMA_INVALID` before its id is registered; `canonicalJson` throws on sparse arrays and non-plain objects instead of losing data.
- The core imports only its own modules, the contract schemas and `ajv`, and uses no network, clock, randomness or dynamic loading APIs — `dependency-guard.test.ts` enforces this (canary-tested with an SDK import, a clock call, `crypto.randomUUID()`, a dynamic `import ()`, a bare `Date()` and `new  Date ()`).

Fixtures (validated by `npm run validate:contracts`):

- `states/zhalm-forest-initial.json` — the Zhalm world: player, guardian, sensors `n0`–`n6` (cluster a) and `b0`–`b2` (cluster b), the grove heart, three locations and the three declared reaction flags, all `false`.
- `world-events/zhalm-noise-emitted.json`, `zhalm-sensor-triggered.json`, `zhalm-network-alert.json` — the observed chain `NOISE_EMITTED → SENSOR_TRIGGERED → NETWORK_ALERT`.
- `states/example-world-state.json` now declares `zhalm-network-alert-active`, so the MCL-81 example `ReplayRef` chain replays.

## Director port (MCL-83)

| Module | Responsibility |
| --- | --- |
| `director-context.ts` | `DirectorProvider` port, `DirectorScope`, `buildDirectorContext`, `DIRECTOR_CONTRACT_VERSION` |
| `fake-provider.ts` | deterministic FakeProvider: proposal sets per event type, run-namespaced proposal ids; can simulate failure, malformed output and a pending provider |
| `director-orchestrator.ts` | `runDirector`: lifecycle, abort, failure handling, provider-boundary validation |

Rules the tests enforce:

- The provider never sees the `WorldState`. The context carries only the canon facts the scope names, constraints, open points, the world flags, sorted entity and location ids, and events of the scoped types. Factions, relationships, quests, inventory, calendar and entity details stay out.
- Lifecycle `CREATED → PREPARING → RUNNING → STOPPED | FAILED`; every step is recorded as a schema-valid `DirectorRun` document with an incrementing `revision`.
- Abort before or during the run ends in `STOPPED` with `stop_reason: "aborted"` and no proposals. A provider error, invalid canon/state/event input, or output that is not an array ends in `FAILED`. The world state is never touched — the orchestrator only reads.
- The orchestrator stamps `provider_trace` (`provider_id`, `model_or_fixture`, `prompt_or_contract_version`, `run_id`), overwriting whatever the provider claimed (D9).
- Only schema-valid proposals with unique ids leave the boundary; everything else is reported in `boundary_rejections` with its index and errors.
- Identical inputs give byte-identical outcomes.

Donor note: the lifecycle follows the Infinite World run-state-machine *pattern* (Confluence 64815106 §2, §11). No donor code was copied.

## Proposal Policy Gate (MCL-84)

`policy-gate.ts` — `evaluateProposal` and `compileTransition`.

Every rule is evaluated in a fixed order and written to the audit trace (`checks`, one entry per rule, outcome `passed | failed | skipped`). A proposal is `accepted` only when no rule failed. For a schema-invalid proposal the structural rules are `skipped` rather than guessed.

| Rule | Reason codes |
| --- | --- |
| `schema` | `SCHEMA_INVALID` |
| `privacy` | `PRIVACY_OR_SECRET_FIELD` — secret- or PII-like keys (api_key, token, password, authorization, email, child_name …) or values anywhere in the proposal: bearer tokens (case-sensitive, a real token required, so prose such as "the bearer of the root-song" stays legal), JWTs, `sk-…`, GitHub, AWS, Google and Slack tokens, PEM/PGP private-key blocks, `data:audio|image|video` URIs and e-mail addresses including IDN. The proposal is rejected, never accepted in sanitised form (D12). |
| `kind` | `KIND_NOT_ALLOWED` |
| `source_refs` | `SOURCE_REFS_MISSING` |
| `required_facts` | `REQUIRED_FACT_MISSING` — every required fact must be a key of the canon projection's `facts` |
| `canon_promotion` | `CANON_PROMOTION_FORBIDDEN` (`design_status: STATED`), `DESIGN_STATUS_INVALID` (anything but TENTATIVE, AMBIGUOUS, CONFLICT) (D11) |
| `intents` | `UNKNOWN_INTENT`, `NOT_ACTIONABLE` — `transition_intent` tokens are opaque; only the experiment's intent catalog compiles them into operations (D3) |
| `scope` | `SCOPE_VIOLATION` (flag outside the experiment's prefixes), `UNKNOWN_FLAG` |
| `preconditions` | `PRECONDITION_UNSUPPORTED`, `PRECONDITION_FAILED`, `UNKNOWN_FLAG`, `UNKNOWN_ENTITY`, `UNKNOWN_LOCATION` — exactly the shapes `{flag_ref, equals}`, `{entity_ref}`, `{location_ref}` (D5) |

`redactPrivacyFindings` returns a copy with every finding replaced by a marker; the session stores and shows only that copy, so blocked content is never persisted or displayed. Blank source refs count as missing. `GATE_REASON_CODES` is the runtime list of all codes.

`compileTransition` is the only bridge from a proposal to the transition engine: it refuses a rejected gate result (`GATE_NOT_ACCEPTED`) and a result that belongs to another proposal (`GATE_PROPOSAL_MISMATCH`). The compiled transition targets the state's `state_id`, references the proposal and carries its `source_refs`.

Negative fixtures run through the FakeProvider and the orchestrator (`policy-gate-fixtures.test.ts`): hallucinated fact, unknown entity, unknown location, canon promotion, private-media payload, unknown intent and scope violation are each rejected with their reason code; the canon projection is a checked-in fixture, so no test needs a live Confluence read.

## Zhalm vertical slice (MCL-85)

`director-session.ts` joins the pieces: `createDirectorSession({ initial_state, canon, director_scope, policy_scope, provider })`.

- `observe(event)` appends observed events. `startRun(eventIds, signal?)` runs the orchestrator on those events, gates every proposal against the state the run started on, and records `RUN_STATUS`, `DERIVED_PROPOSAL` and `GATE_RESULT` entries.
- `select(proposalId)` is the only path from a proposal to the world: accepted gate result → `compileTransition` → dry run on the pure engine → `SELECTION` (accepted) → `TRANSITION_APPLIED`. It refuses `NO_ACTIVE_RUN`, `UNKNOWN_PROPOSAL`, `PROPOSAL_REJECTED`, `RUN_ALREADY_RESOLVED`, `STALE_RUN` (the world differs from the one the run was prepared on — compared by canonical fingerprint, D6) and `TRANSITION_REJECTED` (the engine would refuse what the gate accepted) without touching the state; refusals inside a run are recorded as `SELECTION` with outcome `refused`. Every attempt gets its own `selection_ref`.
- A run that completes after a reset or after a later-started run is `superseded` and never becomes active.
- A privacy-rejected proposal is stored and shown only in redacted form; a proposal whose id is already in the ledger is not offered and is reported in `boundary_rejections`.
- The session exposes read-only views (`ledger.entries/observed/derived/size`, `state`, `replay`) — no world handle and no ledger writes.
- `reset()` restores the initial world and clears the active run.

Experiment-local parts (`experiments/zhalm-forest-v1/`, D1):

| File | Responsibility |
| --- | --- |
| `layout.ts` | sensor layout: cluster a (`n0`–`n6`) and the dormant cluster b (`b0`–`b2`) on the entry route |
| `director/zhalm-events.ts` | sound network → observed WorldEvents; same hearing rule as the network; once per frame, every listening sensor whose energy crossed 0.5 from below — raised by the noise itself or by a travelling network pulse — emits `SENSOR_TRIGGERED` |
| `director/zhalm-director.ts` | canon projection, intent catalog, scopes and the FakeProvider fixture `zhalm-reactions-v1` |
| `director/director-panel.ts` | technical harness panel: run, proposals with gate verdicts, applied diff |
| `index.ts` | wiring: player noise and the test hook share one bridge; entering `alerted` records `NETWORK_ALERT` and starts a run; world flags drive the reactions |

Fixtures: `projections/zhalm-forest-canon.json` holds only statements from the Zhalm concept profile (`MLOA:32735234#Zhalm-Druhen`, `MLOA:20250626`) with their `CONFLICT` status; unresolved design (MCL-6 Druhen rules, naming conflict, final scale and AI) is listed under `open_points`. `proposals/zhalm-*.json` hold three `TENTATIVE` reactions and one demonstration that depends on the open Druhen rules and is rejected with `REQUIRED_FACT_MISSING`.

| World flag | Intent | Runtime reaction |
| --- | --- | --- |
| `zhalm.guardian.investigating` | `guardian_investigates_noise` | the guardian walks to the run's alarm origin and circles it; amber core |
| `zhalm.cluster-b.active` | `activate_second_sensor_cluster` | cluster b appears and listens through a second sound network; the alert level is the higher of both |
| `zhalm.network.regrouping` | `network_retreat_regroup` | cluster a pulses dimmed and in sync; the guardian falls back in front of the grove heart; deep-violet core |

Behaviour notes:

- A new `NETWORK_ALERT` starts a run unless a completed run still offers an accepted, unresolved proposal (`awaitingChoice`); failed, aborted or exhausted runs do not block the director. Later runs are gated against the changed world, so an already applied reaction fails its own precondition (`PRECONDITION_FAILED`).
- Catch or win restarts the player's attempt but keeps the world flags; the experiment reset (`R`) rebuilds scene, session and ledger and aborts a pending run.
- Test hook `window.__zhalm.director`: `flags`, `revision`, `observedTypes`, `ledgerKinds`, `runStatus`, `proposals`, `select`, `guardianMode`, `clusterBActive`. `__zhalm.noiseAt` uses the same bridge as player movement.

Not in this slice: branch/replay comparison (MCL-86), the Consequence Lab UI including keyboard selection (MCL-87), a real provider (MCL-88). The Human Play/Design Review is MCL-91 — the e2e suite proves the path, not the design value.
