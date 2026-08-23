# Architecture Audit — Runtime Foundation Plan

Date: 2026-08-23
Audited snapshot: `DYAI2025/MCL-protolab@5c2bf5630e12e0f5232ec498aaa184ef1a66cf8e`

## Verdict

The foundation direction is **plausible and worth continuing**, but the audited snapshot was not yet implementation-ready without clarification because older architecture records still stated `ADAPTER_MISSING/BLOCKED` while the newer mission granted the Prototype Runtime Exception. The plan also under-specified visual evaluation even though the first named PvE concepts depend heavily on emissive, particles, trails, transparency, lighting and atmosphere.

## Findings

### A-001 — Governance drift
Severity: Important

Older C4/runtime-adapter/planning records described runtime selection as blocked. Newer README/CLAUDE/design/mission state that the exception is granted. This can route a coding agent into contradictory behavior.

Remediation on this branch: active agent guidance, runtime-adapter status and C4 are aligned with the granted exception. Historical planning JSON remains provenance and must not silently be treated as the current blocker state.

### A-002 — PlayCanvas-first is technically plausible
Severity: Informational

Current official `playcanvas/create-playcanvas` source inspection exposes an Engine format, Vite/TypeScript-oriented scaffolding, a third-person-controller game starter and physics as a starter feature. The official controller uses PlayCanvas rigidbody state.

This strengthens the PlayCanvas-first path, but does not prove the exact engine/package version, Ammo/WASM bundling, browser behavior or local commands. Those remain implementation-run evidence requirements.

### A-003 — Visual baseline was too weak
Severity: Important

Confluence `32735234` makes visual effects part of the first creature concepts: Mugosh relationship horn glow; Flammenwolf mouth/body fire and burn trail; Veras transparency/internal particles/trail; Zhalm black-violet network pulse/crystallization. A movement-only grey playground cannot validate these concepts.

Remediation on this branch: add a source-linked Creature Concept Contract, four initial profiles, and an isolated Creature/FX Gallery requirement without creating a universal creature framework.

### A-004 — Modular basis is sound if abstraction discipline is kept
Severity: Positive

The existing rules — experiment first, stable asset IDs, no runtime dependency on `MC_legends`, deterministic reset and explicit experiment contracts — are a clean basis for disposable prototypes. The main architecture risk is premature extraction into shared mechanics or generic creature/engine frameworks.

## Validation performed

On the supplied repository ZIP matching the audited snapshot:

- all JSON files parsed successfully;
- `experiments/_template/experiment.json` validated against its Draft 2020-12 schema;
- `assets/registry/assets.example.json` validated against its Draft 2020-12 schema;
- the four newly proposed creature profiles were validated locally against `schemas/creature-concept.schema.json` before commit;
- no application runtime code existed in the audited snapshot, therefore build, browser, physics and runtime claims remain `not_run`.

## Recommendation

Proceed with runtime implementation on a dedicated feature branch after this hardening branch is reviewed. Do not claim `buildable`, `tested` or `runtime_verified` until the implementation mission actually executes the required install/lint/typecheck/unit/build/browser/manual/fresh-clone gates, including the Creature/FX Gallery gate.
