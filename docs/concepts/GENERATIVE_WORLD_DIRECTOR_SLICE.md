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
- The core imports only its own modules, the contract schemas and `ajv`, and uses no network, clock or randomness APIs — `dependency-guard.test.ts` enforces this (canary-tested: a planted SDK import and a clock call both fail it).

Fixtures (validated by `npm run validate:contracts`):

- `states/zhalm-forest-initial.json` — the Zhalm world: player, guardian, sensors `n0`–`n6` (cluster a) and `b0`–`b2` (cluster b), the grove heart, three locations and the three declared reaction flags, all `false`.
- `world-events/zhalm-noise-emitted.json`, `zhalm-sensor-triggered.json`, `zhalm-network-alert.json` — the observed chain `NOISE_EMITTED → SENSOR_TRIGGERED → NETWORK_ALERT`.
- `states/example-world-state.json` now declares `zhalm-network-alert-active`, so the MCL-81 example `ReplayRef` chain replays.
