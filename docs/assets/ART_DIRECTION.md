# Art direction in the lab — V2 (semi-realistic fantasy RPG)

Authority: Confluence **MLOA:22544386** ("14 – Visual Asset System"). V2 = standalone third-person fantasy RPG, semi-realistic to realistic; V1 voxel/Minecraft language is SUPERSEDED. Binding visual anchors: the four sheets in `concepts/art-direction/`.

## What this means for the lab's asset tiers

| Tier | What | Status under V2 |
|---|---|---|
| **Graybox / layout standins** | engine primitives + `assets/blockmodels/` spec→GLB pipeline | KEPT — for spatial layout, mechanics prototyping, scale checks. Explicitly NOT the target look; blocky reads are graybox, not style. |
| **Hero creatures & props** | textured, organic GLB models derived from the V2 anchor sheets | TARGET — produced via image→3D generation (service selection in progress) or hand modeling, then registered with provenance and reviewed per the Visual-Candidate pipeline (proposal → Ben review → freigegebene Referenz). |
| **Look/rendering** | the part of "realism" the engine owns | ACTIVE NOW — cinematic lighting, `FOG_EXP2` atmosphere, ACES tone mapping + restrained HDR bloom (`src/runtime/fx/post.ts`), night palettes. `zhalm-forest-v1` is the look-pass testbed. |

## Runtime honesty

The anchor sheets are painterly concept art. A browser prototype will not match them frame-for-frame; the lab target is that **silhouette, palette, materials, light and FX direction** unmistakably belong to the same world (Confluence Erfolgskriterium). Concept art, confirmed design and runtime asset stay distinguishable — a generated 3D model derived from a sheet enters the registry as `status: candidate`, never as auto-approved.

## Import path for generated/hand-made V2 models

1. Produce a textured GLB (image→3D service from an anchor sheet, Blockbench/Blender hand work, or a licensed CC0 base).
2. Drop it under `public/assets/v2/` and register it in `assets/registry/assets.json` — `status: candidate`, provenance naming the source image, tool, prompt/recipe and license.
3. Add its id to the gallery experiment's `SHOWN` list → side-by-side against the graybox variant and the reference capsule.
4. Ben reviews in-game → `status: approved_for_prototype` or discard.

## Open items

- Image→3D service choice (Meshy / Tripo / open-source local) — research running; needs Ben's account/API-key decision before autonomous generation is possible.
- Model-sheets (Vorder-/Seiten-/Rückansicht) per creature would materially improve image→3D output — listed in MLOA:22544386 as next design artifacts.
