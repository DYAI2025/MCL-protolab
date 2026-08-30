# Extending the lab — building your game ideas with this kit

This repo is a **gameplay development kit** for MC Legends prototypes: you add one experiment per gameplay hypothesis, play it on localhost, tune it live, and keep or discard the learning. The experiment is the unit of change (AGENTS.md rule 5) — you never modify the engine integration to try an idea.

## Add a new experiment in five steps

Using the first planned target `zhalm-forest-v1` as the example.

**1. Contract first.** Copy the template and fill it in:

```bash
mkdir experiments/zhalm-forest-v1
cp experiments/_template/experiment.json experiments/zhalm-forest-v1/experiment.json
# edit: id, hypothesis (falsifiable!), design_status, source_refs (MLOA/MCL keys),
#       tunables, success_signals, kill_criteria, reset_strategy
npm run validate:contracts   # must print: valid: experiments/zhalm-forest-v1/experiment.json
```

The validator picks up every `experiments/*/experiment.json` automatically.

**2. Implement the `Experiment` interface** in `experiments/zhalm-forest-v1/index.ts`:

```typescript
import type { Experiment, ExperimentContext } from '../../src/core/experiments/types.ts';
import type { SceneContext } from '../../src/runtime/scene-context.ts';

export function createZhalmForestExperiment(): Experiment {
  return {
    id: 'zhalm-forest-v1',
    tunables: { /* mirror experiment.json */ },
    init(ctx: ExperimentContext) {
      const scene = ctx.scene as SceneContext;   // { app, movePlayerTo }
      // build your scene under ONE root entity added to scene.app.root
    },
    reset(ctx) { /* deterministic: teleport + zero velocities + restore transforms */ },
    destroy(ctx) { /* destroy the root entity — leave nothing behind */ },
  };
}
```

Pattern to copy: `experiments/playground/index.ts` (restorables list for reset) and `experiments/creature-fx-gallery/index.ts` (global fog/post teardown, DOM controls, update loop, test hooks).

**3. Register it** in `src/shell/bootstrap.ts` (the only file allowed to wire experiments):

```typescript
registry.register(createZhalmForestExperiment());
```

Open it with `npm run dev` → `http://localhost:5173/?experiment=zhalm-forest-v1`.

**4. Assets go through the registry.** Every non-primitive asset gets an entry in `assets/registry/assets.json` (source, license, provenance, fallback) BEFORE use; code references `asset_id`, never file paths. Primitives are `"format": "primitive"` entries — see the existing ones.

**5. Prove it.** Add a spec under `e2e/` if the hypothesis has a machine-checkable signal (drive the scene through a `window.__<experiment>` hook — synthetic keyboard does not reach the pointer-locked controller, see `e2e/smoke.spec.ts`). Then run the full chain:

```bash
npm run typecheck && npm run lint && npm run boundaries && npm run validate:contracts && npm test && npm run build && npm run e2e
```

## What the kit gives you

| Need | Use |
|---|---|
| Third-person player + camera | already in the shell — your experiment just calls `scene.movePlayerTo(spawn)` |
| Live-tunable numbers | declare in bootstrap's `createTunables` spec → slider appears in the inspector automatically |
| Events | `src/core/events/` typed emitter — add an event only when something consumes it |
| Glow / fire / ghosts | `src/runtime/fx/emissive.ts` (emissive + translucent materials) |
| Particles | `src/runtime/fx/particles.ts` — `rate` is seconds BETWEEN births |
| Movement trails | `src/runtime/fx/trail.ts` — alpha ignored, fades via RGB + width |
| Fog / mood | `src/runtime/fx/atmosphere.ts` — clear it in `destroy()` |
| Bloom | `src/runtime/fx/post.ts` — needs HDR formats, intensity 0.01–0.035 |
| Creature placeholders | copy a builder from `experiments/creature-fx-gallery/creatures/` — deliberately no shared base class |

## Rules the tools enforce for you

- `src/core/` may not import the engine or `src/runtime/` (unit-testable without a browser).
- Nothing but `src/shell/` composes experiments into the runtime.
- `src/runtime/` and `src/core/` never import experiment code.
- Violations fail `npm run boundaries` / `npm run lint` — locally and in CI.

## 3D assets

**Art direction is V2 — semi-realistic fantasy RPG** (Confluence MLOA:22544386; anchors in `concepts/art-direction/`; lab rules in `docs/assets/ART_DIRECTION.md`). Blocky generated models (spec → GLB + Blockbench-editable `.bbmodel`, `docs/runtime/BLOCKBENCH.md`) are **graybox standins**, not the target look. Hero creatures come from the V2 import path in ART_DIRECTION.md. Compare designs side by side in `/?experiment=blockmodel-gallery-v1`.

## Building worlds

`/?experiment=world-editor-v1` places registry assets in a world, saves layouts as schema-validated JSON (`worlds/`, `schemas/world-layout.schema.json`) and playtests them with live creature behaviors — see `docs/runtime/WORLD_EDITOR.md`.

## Promotion rule

Logic stays experiment-local until **two independent experiments** need the same behavior contract — only then does it move into `src/core/` (with tests) or `src/runtime/`. Duplication between experiments is correct, not a smell.

## Keep/kill discipline

An experiment's outcome is evidence, not canon: judge it against its own `success_signals` / `kill_criteria`, record the learning, then keep tuning or delete the directory. Deleting a failed experiment is a successful use of this kit.
