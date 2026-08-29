# MCL Prototype Lab

Status: **runtime built** (PlayCanvas 2.21.4 + Vite + Ammo physics, 2026-08-29) on `feat/prototype-runtime-foundation` — third-person playground, experiment harness, debug inspector, creature FX gallery, full gate chain in CI. Decision record: `docs/architecture/ADR-0003-runtime-foundation.md`; verified commands: `docs/runtime/SETUP.md`; gate results: `docs/runtime/VALIDATION.md`. The Prototype Runtime Exception (2026-08-23) covers this lab only. Nothing in this repository changes DYAI2025/MC_legends.

## Quick start

```bash
nvm use && npm install && npx playwright install chromium
npm run dev   # http://localhost:5173  (?experiment=creature-fx-gallery for the gallery)
```

## Purpose

This repository concept is a disposable learning lab for MC Legends gameplay ideas. It is not the alpha/beta foundation and must not silently evolve into the production game architecture.

Primary loop:

idea -> experiment spec -> agent implementation -> localhost play -> tune -> reset -> compare -> keep/discard learning

Adding your own gameplay experiment: `docs/runtime/EXTENDING.md`.

## Experiments

- `playground` — neutral third-person movement/physics/reset playground (default).
- `creature-fx-gallery` — four concept placeholders (Mugosh, Flammenwolf, Veras, Zhalm) with switchable FX states and per-layer toggles, driven by `concepts/creatures/*.json`.

## Current architecture decision

Use a separate repository (this one, `DYAI2025/MCL-protolab`; older concept records call it `mcl-prototype-lab`) with:

- experiment contracts and an experiment template;
- a versioned asset registry with provenance and fallback metadata;
- concise agent instructions;
- validation and architecture records;
- a deliberately empty `runtime-adapters/` slot.

The runtime adapter was blocked until MCL-1 resolution or an explicit governance exception. That exception was granted on 2026-08-23 (disposable, non-canonical prototype runtime only — see mission §1); the adapter itself is built on `feat/prototype-runtime-foundation` per the mission.

## First playable target after the gate clears

Current user preference is third-person. The first suggested experiment is a small forest encounter around the Druhen/Zhalm sound-network hypothesis, but that experiment remains design-status aware and does not create canon.

## Non-goals

No backend, database, cloud, multiplayer, persistent world, auth, production deployment, final engine, final art, or public release pipeline.
