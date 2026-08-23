# MCL Prototype Lab - Concept Foundation

Status: PLAN / concept only. No runtime engine is selected and nothing in this package changes DYAI2025/MC_legends.

## Purpose

This repository concept is a disposable learning lab for MC Legends gameplay ideas. It is not the alpha/beta foundation and must not silently evolve into the production game architecture.

Primary loop:

idea -> experiment spec -> agent implementation -> localhost play -> tune -> reset -> compare -> keep/discard learning

## Current architecture decision

Use a separate repository (`DYAI2025/mcl-prototype-lab`) with:

- experiment contracts and an experiment template;
- a versioned asset registry with provenance and fallback metadata;
- concise agent instructions;
- validation and architecture records;
- a deliberately empty `runtime-adapters/` slot.

The runtime adapter is blocked until MCL-1 is resolved or project governance explicitly permits a disposable, non-canonical prototype runtime.

## First playable target after the gate clears

Current user preference is third-person. The first suggested experiment is a small forest encounter around the Druhen/Zhalm sound-network hypothesis, but that experiment remains design-status aware and does not create canon.

## Non-goals

No backend, database, cloud, multiplayer, persistent world, auth, production deployment, final engine, final art, or public release pipeline.
