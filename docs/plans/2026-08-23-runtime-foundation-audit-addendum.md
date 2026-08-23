# Audit Addendum — Prototype Runtime Foundation

Date: 2026-08-23
Applies to: `docs/plans/2026-08-23-runtime-foundation-mission.md`

This addendum is part of the active runtime mission. It does not replace the mission; where this document is more specific, it takes precedence.

## 1. Historical planning records

Older concept/planning records may still contain the historical repository name `DYAI2025/mcl-prototype-lab` or the status `ADAPTER_MISSING / BLOCKED`. Those records are provenance from the pre-exception planning run. The Prototype Runtime Exception was explicitly granted on 2026-08-23 for this disposable lab. MCL-1 remains open and the lab runtime must never be represented as the production-engine decision.

## 2. PlayCanvas-first evidence update

Current official `playcanvas/create-playcanvas` source inspection confirms:

- an `engine` format using the PlayCanvas Engine API directly;
- Vite/TypeScript-oriented scaffolding metadata;
- a `third-person-controller` game starter;
- physics as a declared feature of that starter;
- the official starter imports `ThirdPersonController` from `playcanvas/scripts/esm/third-person-controller.mjs` and operates on rigidbody state.

This supports the existing PlayCanvas-first decision. It does **not** prove exact package versions, Ammo/WASM bundling, browser behavior or local commands. The implementation run must still pin and execute those facts before claiming build/test/runtime status.

## 3. Visual baseline is a hard prototype requirement

The foundation must be visually useful enough to judge early creature/effect direction, not only movement correctness. Implement an isolated `creature-fx-gallery` experiment or equivalent gallery mode driven by `concepts/creatures/*.json`.

Minimum runtime capabilities needed for that gallery:

- representative lighting and shadows;
- materials and emissive controls;
- transparent materials;
- particles;
- trail/ribbon or equivalent effect;
- local lights;
- simple decal/ground-mark capability where practical;
- fog/atmosphere hook;
- restrained HDR/bloom or comparable post effect where supported by the verified runtime path.

All visual effects must be tunable and reducible/disableable so readability and performance can be compared.

## 4. First four creature concepts

### Mugosh

Represent a powerful non-colossal quadruped silhouette and make the magical horn state visually switchable:

`blue neutral -> brighter/white allied -> deep red hostile`

The relationship/danger state must be readable before final AI or combat exists.

### Flammenwolf

Represent the working scale direction of about 1.5x the player, with:

- visible fire/glow in open mouth/body;
- ember/fire motion;
- movement burn trail;
- optional simple scorch/decal if economical.

No final fire simulation, damage system or pack AI is required.

### Veras

Represent a small floating soul form with:

- core roughly player-head-sized;
- translucent white/green material;
- internal luminous particles;
- soft luminous trail;
- gentle local light/bloom.

The result should read as benevolent/ethereal, not as a generic opaque glowing ball.

### Zhalm / Druhen branch

Represent:

- a large plant/root placeholder plus smaller sensor/root nodes;
- a visible black-violet network pulse across multiple nodes;
- a crystallization material preview.

Do not resolve the Zhalm/Druhen naming or rule conflict in code.

## 5. Architecture boundary

Creature profiles are **data/concept contracts**, not an inheritance hierarchy. Do not introduce `BaseCreature`, universal combat, universal abilities, universal AI or a generic creature framework merely to support these four profiles.

Primitive geometry is acceptable initially. Later GLB assets must be replaceable through stable asset IDs without rewriting the concept contract.

## 6. Additional validation gates

In addition to the existing mission gates:

- schema validation must include `schemas/creature-concept.schema.json` and all `concepts/creatures/*.json`;
- browser/runtime smoke must load all four concept IDs without fatal errors;
- at least one deterministic FX state per creature profile must be activatable in smoke or test hooks;
- manual runtime evidence must show the creature/FX gallery and visually compare emissive, particles/trails and lighting/post-effect behavior;
- save at least one gallery screenshot in addition to the neutral playground screenshot.

Do not claim `runtime_verified` without this visual gallery gate.
