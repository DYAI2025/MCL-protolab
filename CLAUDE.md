# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

The **disposable gameplay-prototyping lab** for MC Legends / Legends of Avaloria (`DYAI2025/MCL-protolab`). Current state: the runtime **is built** on `feat/prototype-runtime-foundation` (draft PR #3) — PlayCanvas 2.21.4 + Ammo physics, third-person playground, experiment registry with reset lifecycle, debug inspector with live tunables, creature FX gallery (mugosh/flammenwolf/veras/zhalm with deterministic FX states), 4-test Playwright smoke, full gate chain green locally and in CI. The PlayCanvas-first risk gate is CONFIRMED (`docs/architecture/DECISION-2026-08-29-playcanvas-risk-gate.md`); ADR-0003 records the runtime decision. Remaining plan work: fresh-clone gate (Task 18), manual runtime gate (Task 19, needs Ben), delivery report (Task 20).

Read `AGENTS.md` and `docs/architecture/ADR-0002-prototype-lab.md` before changing anything architectural — they are the binding rule sources. The executable work plan is `docs/plans/2026-08-23-runtime-foundation-implementation-plan.md`; where `docs/plans/2026-08-23-runtime-foundation-audit-addendum.md` is more specific, it wins. The plan's **"Known traps, pre-collected"** section lists verified PlayCanvas 2.21.4 / Ammo / Vite / Playwright pitfalls — read it before touching engine code; every item there was measured, not assumed.

## Commands (all verified working)

Node is pinned to **24.19.0** (`.nvmrc`, `engines` + `engine-strict=true`). The system Node may be older — `nvm use` first or npm install fails.

```bash
nvm use                    # 24.19.0 — required
npm ci                     # install (plus: npx playwright install chromium, once)
npm run dev                # Vite dev server; ?experiment=creature-fx-gallery for the gallery
npm run typecheck          # tsc across src, experiments, e2e, configs
npm run lint               # eslint . (includes boundaries plugin)
npm run boundaries         # dependency-cruiser import-boundary gate
npm run validate:contracts # ajv schema gate over experiment/asset/creature docs
npm test                   # vitest run (unit, src/core)
npm run build              # tsc + vite build
npm run e2e                # Playwright smoke (starts its own Vite on :5173)
```

Run a single unit test: `npx vitest run src/core/events/emitter.test.ts`. Single e2e spec: `npx playwright test e2e/gallery.spec.ts`. Contract validation: `npm run validate:contracts` (ajv over all schemas vs experiment/asset/creature documents — extend `scripts/validate-contracts.mjs` when a new contract lands). Full verified command reference: `docs/runtime/SETUP.md`.

## Architecture

- `src/core/` — engine-agnostic pure logic (events, tunables, experiment/asset registries, debug state). TDD'd with Vitest; must stay unit-testable without a browser.
- `src/runtime/` — the only code allowed to import PlayCanvas; owns the integration surface (boot/scene, input + third-person camera, physics hooks, asset loading, audio/fx, debug hooks, reset/smoke lifecycle). Explicitly **not** a universal engine-abstraction layer.
- `experiments/` — isolated scenes consuming core + runtime; each validates against `schemas/experiment.schema.json`.
- `public/ammo/` — Ammo.js physics binaries with provenance (`SOURCE.md`, zlib `LICENSE`). Served root-absolute; must be loaded via `pc.WasmModule` **before** `app.start()` (see plan traps).
- Import boundaries are machine-enforced by `.dependency-cruiser.cjs` (`npm run boundaries`), not prose: core→runtime, core→playcanvas, core/runtime→experiments, and any MC_legends dependency are all `error`. In that config, use `doNotFollow` for node_modules — **never `exclude`**, which silently kills the core-not-to-playcanvas rule (measured 2026-08-23).
- `tsconfig.json` uses `erasableSyntaxOnly` — no enums/namespaces/parameter properties; use string-literal unions.
- Engine integration is proven by Playwright smoke + manual gate, not unit tests. Playwright `webServer.url` must be `http://localhost:…`, never `127.0.0.1` (measured: 120 s timeout).

## Governance status

- **Prototype Runtime Exception granted** (Ben, 2026-08-23, mission §1): this lab may use a concrete disposable game runtime. That decision does NOT decide the production engine, NOT MCL-1, NOT Minecraft vs. standalone, and may be discarded entirely.
- Jira MCL-1 (product format) remains **open**. Never declare the lab's runtime choice (PlayCanvas) a product decision.
- Runtime work happens on `feat/prototype-runtime-foundation` — draft PR against `master`, no self-merge, no force-pushes.
- **Do not modify `DYAI2025/MC_legends`** as part of prototype work unless separately authorized; it is never a runtime dependency. This lab must not silently evolve into the production game architecture.

## Hard constraints (from AGENTS.md / ADR-0002)

- **Experiment is the unit of change.** New gameplay logic stays experiment-local by default; a mechanic is promoted to shared code only after ≥2 independent experiments need the same behavior contract.
- **Prototype outcome is evidence, not canon.** Experiments carry `design_status` (STATED | TENTATIVE | AMBIGUOUS | CONFLICT) and `source_refs` (Confluence MLOA / Jira MCL keys); a successful experiment never updates Confluence canon by itself.
- **Asset provenance is mandatory.** Every asset is registered with source, license, provenance, status, version, and a fallback before use. Gameplay code references stable `asset_id`s, never file paths. No third-party franchise iconography.
- No backend, database, cloud service, multiplayer, auth, or deployment without a separate architecture decision.
- No real child names, private submissions, credentials, or secrets in fixtures, screenshots, logs, or assets.
- **An unexecuted validation gate is `not_run`, never `passed`.** Gates were wired before there was anything to gate, deliberately — keep it that way for new gates (see a new gate fail once before trusting it green).

## Contracts and docs that matter

- `docs/experiments/EXPERIMENT_CONTRACT.md` + `schemas/experiment.schema.json` — what an experiment is (falsifiable hypothesis, tunables, success signals, kill criteria, reset strategy).
- `docs/assets/ASSET_REGISTRY_CONTRACT.md` + `schemas/asset-registry.schema.json` — asset identity/provenance rules; `assets/registry/assets.example.json` is the reference instance. Named creature concepts additionally validate against `schemas/creature-concept.schema.json`.
- All schemas use `additionalProperties: false` — extending a contract means editing schema and contract doc together.
- `docs/architecture/` — ADR-0002, C4-lite diagrams, decision records; `SOURCE_MAP.md` maps claims to evidence (MC_legends commit, Confluence MLOA pages, Jira MCL-1).
- `docs/plans/` — design, mission, implementation plan, audit addendum (precedence: addendum > mission/design where more specific).

## Context

First playable target after the foundation: `zhalm-forest-v1` — a third-person forest encounter testing the Druhen/Zhalm sound-network hypothesis (sound → root trigger → network alert → investigate/chase). User preference is third-person.
