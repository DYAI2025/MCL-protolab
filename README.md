# MCL Prototype Lab - Concept Foundation

Status: concept foundation committed; **Prototype Runtime Exception granted 2026-08-23** — the runtime build is specified in `docs/plans/2026-08-23-runtime-foundation-mission.md` (design: `docs/plans/2026-08-23-runtime-foundation-design.md`) and not yet executed. Nothing in this repository changes DYAI2025/MC_legends.

## Purpose

This repository concept is a disposable learning lab for MC Legends gameplay ideas. It is not the alpha/beta foundation and must not silently evolve into the production game architecture.

Primary loop:

idea -> experiment spec -> agent implementation -> localhost play -> tune -> reset -> compare -> keep/discard learning

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
