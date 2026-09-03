# ADR-0003: Prototype runtime foundation on PlayCanvas 2.21.4

Status: accepted (2026-08-29)
Scope: MCL-protolab only — see "Prototype-only boundary".

## Decision

The disposable prototyping lab uses **playcanvas@2.21.4** (MIT) as its concrete runtime, embedded in a Vite 8 + TypeScript-strict browser app, with Ammo.js (wasm, zlib-licensed binaries under `public/ammo/` with recorded provenance) loaded through `pc.WasmModule` for physics. The integration surface lives in `src/runtime/`; engine-agnostic logic lives in `src/core/`; `src/shell/bootstrap.ts` is the single composition root; experiments live under `experiments/` and are the unit of change. All of this is machine-enforced by dependency-cruiser and ESLint boundaries, not prose.

## Alternatives examined

- **Babylon.js — the documented fallback.** Equivalent npm/Vite fit and license. PlayCanvas won on the shipped, attribute-complete `ThirdPersonController` (968 lines of solved ground-raycast/camera/input problems — mission §11 forbids building a final movement system) and its entity-component model mapping directly onto the experiment contract. Babylon remains the named fallback if the review triggers fire; the walking-skeleton risk gate was designed so that switching before Phase 2 would have cost one day, not weeks.
- **Godot / Unity — dismissed briefly** (mission §3.4: no separate research round): editor-centric workflows with no npm/Vite loop, weak agent-iteration ergonomics, and no browser-native Playwright smoke path. The lab's core loop (idea → agent implementation → localhost play → reset → compare) depends on the toolchain being scriptable end to end.

## Why the risk gate came first

Ammo-under-Vite and headless WebGL in Playwright were the two silent killers. Both were proven on day one (Task 3): a dynamic rigidbody visibly falls in a headless browser smoke, screenshot on disk, before any harness code existed. Outcome recorded in `DECISION-2026-08-29-playcanvas-risk-gate.md`: **PlayCanvas-first CONFIRMED**. The same smoke later ran green on `ubuntu-latest` CI, resolving the SwiftShader-on-Linux unknown by measurement.

## Prototype-only boundary

The Prototype Runtime Exception (Ben, 2026-08-23, mission §1) covers **this lab only**:

- This ADR does **not** decide the production engine.
- It does **not** decide Jira MCL-1 (Minecraft-Mod vs. Standalone) — MCL-1 remains open.
- The runtime, the adapter and every experiment may be discarded entirely.
- `DYAI2025/MC_legends` is never a dependency and is not modified from here.

## Consequences

- Gameplay hypotheses become playable and falsifiable on localhost with `npm run dev`; every gate is executable (`typecheck`, `lint`, `boundaries`, `validate:contracts`, `test`, `build`, `e2e`) and runs in CI on every push.
- Engine knowledge concentrates in `src/runtime/` + `experiments/`; `src/core/` stays unit-testable without a browser (enforced: `core-not-to-playcanvas`).
- The team accepts PlayCanvas-specific idioms (script attributes without compile-time checking, `material.update()` discipline, wasm-before-`app.start()` ordering) as prototype-only knowledge that does not transfer as a product decision.

## Risks

- **Debug-vs-production export conditions:** `vite dev` serves the engine's debug build; the production bundle is what ships. The smoke currently runs against dev and stays error-free; if debug-only console noise ever appears, the smoke moves to `vite preview` rather than filtering.
- **SwiftShader performance:** headless frames are slow (gallery spec runs with a raised timeout). Assertions are state-based, not frame-time-based, so this is a latency cost, not a correctness cost.
- **Single-maintainer attestation:** gates are re-run by CI, but manual-gate evidence (mission §8) is human-attested screenshots.

## Review triggers

- Localhost iteration time with PlayCanvas becomes **measurably too slow** (design-doc trigger) — the adapter is up for review.
- A mechanic needs capabilities the engine cannot express without fighting it (e.g. large-world streaming, server authority).
- MCL-1 is decided in a direction that makes browser prototyping unrepresentative.
- The Babylon fallback becomes cheaper than the next month of PlayCanvas friction.
