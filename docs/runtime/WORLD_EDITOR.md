# World editor (`world-editor-v1`)

Build, save and playtest V2 world layouts inside the runtime — no code changes needed.

```bash
npm run dev   # → http://localhost:5173/?experiment=world-editor-v1
```

## Modes

- **EDIT** (start): free orbit/fly camera (official `CameraControls` — left-drag orbit, right-drag/WASD fly, wheel zoom). The status line in the WORLD EDITOR panel always shows mode, object count, alert level and selection.
- **PLAY** (`Tab` or the Play/Edit button): drops the third-person player at the world spawn; all placed behaviors run — including the sound network formed by placed zhalm nodes. `Tab` again returns to EDIT and resets creatures to their placement homes.

## Editing

| Action | How |
|---|---|
| Place | choose an asset (and optional behavior) in the palette, click on empty ground |
| Select | click near a placed object (blue ring marks it) |
| Move | drag the selected object |
| Rotate / scale | `Q`/`E` · `+`/`-` |
| Duplicate / delete | `D` · `Backspace` |
| Grid snap (1 m) | `G` (on by default) |

## Saving worlds

- **Autosave**: every change goes to browser localStorage and is restored on reload.
- **Export/Import**: JSON download / file picker — the file validates against `schemas/world-layout.schema.json` (`npm run validate:contracts` covers every file in `worlds/`).
- **Repo worlds**: drop an exported file into `worlds/` and commit — it appears in the "load repo world" dropdown (bundled at build time). `worlds/first-glade.json` is the demo encounter.

## Behaviors

Prototype simplification (documented): Mugosh horn states react to player *distance* as a proxy for the future relationship system (MCL-7).

| Preset | What it does |
|---|---|
| `mugosh-guardian` | wanders its home; horn overlay blau → weiß → rot by player distance; red = slow pursuit |
| `flammenwolf-hostile` | patrols; chases within 10 m (catch = respawn); ember particles + burn trail |
| `veras-gentle` | hovers and drifts; silky trail; glows brighter when approached; never hostile |
| `zhalm-node` | joins the shared sound network; orb glow follows network energy |
| `zhalm-guardian` | investigates last noise when suspicious, chases when alerted (catch = respawn) |

All placed zhalm nodes form ONE network per play session, using the `zhalm.*` inspector tunables (linkRange/pulseSpeed/decay apply on the next play start). No skeletons yet: creatures glide/turn rather than walk — rigged animation is a later round (Tripo auto-rig).

## Free environment assets

`scripts/fetch-polyhaven.mjs <asset_id> ...` downloads CC0 models from [Poly Haven](https://polyhaven.com/), packs them into single optimized GLBs under `public/assets/env/` (1k textures, 50 % simplify, webp) — then add a registry entry (license `CC0`, source URL) and they appear in the palette. Seven curated assets ship already (rocks, stumps, roots, a statue, a fort ruin).

[Quaternius](https://quaternius.com/) CC0 packs (stylized — deliberate style break, Ben's call) are a manual download: grab a pack, copy the GLBs into `public/assets/env/`, run them through `gltf-transform` if large, register them. [poly.pizza](https://poly.pizza/) mirrors most packs with per-model GLB downloads.

## Test hook

`window.__editor`: `place(assetId,x,z,behavior?)` · `count()` · `serialize()` · `load(layout)` · `setMode('edit'|'play')` · `mode()` · `level()` · `noiseAt(x,z,r)` · `caught()` · `clear()` — used by `e2e/world-editor.spec.ts`.
