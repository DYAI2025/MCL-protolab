# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

The **disposable gameplay-prototyping lab** for MC Legends / Legends of Avaloria (`DYAI2025/MCL-protolab`): PlayCanvas 2.21.4 + Ammo physics + Vite, one browser *experiment* per gameplay hypothesis — play on localhost, tune live, keep or discard the learning. PRs #1–#9 are merged to `master` (runtime foundation, two audits, MCL-70 VPS test slice; #5–#9 the generative-world director slice MCL-81 … MCL-85); new work runs on per-ticket branches (`feat/mcl-<n>-<slug>`). Gate-by-gate status — including what is still `not_run` (manual runtime gate, mission §8, needs Ben) or blocked (VPS DNS/TLS) — lives in `docs/runtime/VALIDATION.md`; `docs/architecture/VALIDATION.md` is only the historical planning-run record.

Binding rule sources: `AGENTS.md` and `docs/architecture/ADR-0002-prototype-lab.md` — read both before changing anything architectural. Runtime decision: ADR-0003; static test deployment: ADR-0004; `docs/architecture/SOURCE_MAP.md` maps claims to evidence (MC_legends commit, Confluence MLOA pages, Jira). Where `docs/plans/2026-08-23-runtime-foundation-audit-addendum.md` is more specific than the mission/design, it wins. The implementation plan's **"Known traps, pre-collected"** section (`docs/plans/2026-08-23-runtime-foundation-implementation-plan.md`) lists measured PlayCanvas 2.21.4 / Ammo / Vite / Playwright pitfalls — read it before touching engine code.

## Commands

Node is pinned to **24.19.0** (`.nvmrc`, `engines`, `.npmrc engine-strict=true`); `npm ci` fails on older Node. nvm is a shell function that non-interactive shells (Claude Code's Bash tool) don't load, so a bare `node` there can be an older install — run `source ~/.nvm/nvm.sh && nvm use >/dev/null && <command>` in one call.

```bash
npm ci && npx playwright install chromium   # browser once per machine / Playwright bump
npm run dev                # Vite on :5173 — /?experiment=<id>, default playground; R resets
npm run typecheck          # tsc over src, experiments, e2e, vite.config.ts, playwright.config.ts (NOT scripts/)
npm run lint               # eslint . incl. eslint-plugin-boundaries
npm run boundaries         # dependency-cruiser over src + experiments
npm run validate:contracts # ajv: every schema vs its documents (table below)
npm test                   # vitest (node env): *.test.ts under src/, experiments/, scripts/
npm run build              # tsc + vite build; the engine chunk-size warning is expected
npm run e2e                # Playwright, starts (or reuses) a dev server on :5173; all specs but production-deployment
npm run e2e:preview        # build, then production-deployment.spec.ts against vite preview on :4173
npm run generate:assets    # blockmodel specs → GLB + .bbmodel (byte-deterministic)
./scripts/smoke-deployment.sh  # Docker image smoke; needs a running Docker daemon
```

Single unit test: `npx vitest run src/core/events/emitter.test.ts`. Single e2e spec: `npx playwright test e2e/smoke.spec.ts`. Verified 2026-09-23 on Node 24.19.0: every command above except `npm ci` / `playwright install` (already installed) and the Docker smoke (daemon was down). Reference: `docs/runtime/SETUP.md`.

CI (`.github/workflows/gates.yml`, every push and PR): `npm ci` → `generate:assets` + `git diff --exit-code -- public/assets/generated assets/blockmodels/bbmodel` → `npx playwright install --with-deps chromium` → typecheck → lint → boundaries → validate:contracts → test → build → e2e → e2e:preview; screenshots and test results upload as the `runtime-evidence` artifact even when a step fails. A second job, `deployment-container`, runs the Docker smoke only after `gates` passes.

E2E traps:
- Specs overwrite the **tracked** evidence PNGs in `artifacts/screens/`. After a local run, `git restore artifacts/screens` unless you are deliberately refreshing evidence.
- Locally `reuseExistingServer` is on — whatever already listens on :5173 (including another checkout's dev server) is what gets tested.
- `webServer.url` must be `http://localhost:…`, never `127.0.0.1` (measured: 120 s timeout). CI uses one worker (SwiftShader WebGL); the 90–180 s spec budgets are deliberate.

## Architecture

Boot path: `index.html` → `src/main.ts` → `src/shell/bootstrap.ts` → `bootRuntime()` → `registry.load(?experiment=<id>)`.

- `src/shell/bootstrap.ts` — the **only composition root** (the only file that imports experiments). Creates the central tunables spec (each key becomes an inspector slider; experiment keys such as `zhalm.*` live here too, mirrored in that experiment's `experiment.json`), the typed event bus and the third-person player rig; registers every experiment, binds `R` to reset, mounts the inspector and exposes the `window.__protolab` test hook.
- `src/core/` — engine-agnostic pure logic, TDD'd with Vitest: event emitter, tunables, experiment registry (destroy-before-init; reset emits `EXPERIMENT_RESET`), asset registry with fallback chains, creature concepts, inspector state, the promoted `sound-network/`, and the generative-world director pipeline with its contract tests (see *Generative World Director* below). `ExperimentContext.scene` is `unknown` here on purpose.
- `src/runtime/` — the only code that may import PlayCanvas: `boot.ts` (Ammo loaded via `pc.WasmModule` **before** `app.start()`, otherwise physics is silently dead), `scene-context.ts` (`{ app, movePlayerTo }` — experiments cast `ctx.scene` to it), `player/third-person.ts`, `assets/glb-loader.ts` (registry entry → entity; `primitive:<type>` or GLB, following `fallback_asset_id` on load failure), `fx/`, `debug/inspector.ts`. Explicitly **not** a universal engine-abstraction layer.
- `experiments/<id>/` — `experiment.json` (auto-validated) + `index.ts` exporting `create…Experiment(): Experiment` with `init` / `reset` / `destroy`, scene built under one root entity. Current: `playground` (default), `creature-fx-gallery`, `zhalm-forest-v1`, `blockmodel-gallery-v1`, `world-editor-v1`. To add one, follow `docs/runtime/EXTENDING.md` (contract → implement → register in bootstrap → assets via registry → e2e → gates).
- E2E drives scenes through window hooks (`__protolab`, `__gallery`, `__zhalm`, `__blockgallery`, `__editor`) because synthetic key events never reach the controller without pointer lock. Engine integration is proven by Playwright plus the manual gate, not by unit tests.
- `public/ammo/` — Ammo.js binaries with provenance (`SOURCE.md`, zlib `LICENSE`), served root-absolute, never through Vite's wasm handling.

Import boundaries are enforced by config, not prose — twice:
- `.dependency-cruiser.cjs`: core ↛ runtime / playcanvas / experiments / shell; runtime ↛ experiments / shell; nothing ↛ `MC_legends`. Use `doNotFollow` for node_modules — **never `exclude`**, which silently kills `core-not-to-playcanvas` (measured 2026-08-23).
- `eslint.config.js` (boundaries plugin; silently passes without the TypeScript import resolver): core → core; runtime → runtime, core; shell and experiments → runtime, core, experiment.

`tsconfig.json`: `erasableSyntaxOnly` (no enums / namespaces / parameter properties — use string-literal unions), `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.

## Contracts — JSON Schema is authoritative

Every schema in `schemas/` uses `additionalProperties: false`; extending a contract means editing schema and contract doc together. `scripts/validate-contracts.mjs` maps each schema to its document directory — a new contract type needs its own block there (it is not auto-discovered).

| Contract | Schema(s) in `schemas/` | Documents | Doc |
|---|---|---|---|
| Experiment | `experiment` | `experiments/*/experiment.json`, `_template` | `docs/experiments/EXPERIMENT_CONTRACT.md` |
| Asset registry | `asset-registry` | `assets/registry/assets.json` (live), `assets.example.json` (reference) | `docs/assets/ASSET_REGISTRY_CONTRACT.md` |
| Creature concept | `creature-concept` | `concepts/creatures/*.json` | `docs/concepts/CREATURE_CONCEPT_CONTRACT.md` |
| World layout | `world-layout` | `worlds/*.json` | `docs/runtime/WORLD_EDITOR.md` |
| Generative world (MCL-81) | `canon-projection`, `world-state`, `world-event`, `director-run`, `director-proposal`, `state-transition`, `branch-node`, `replay-ref` | the MCL-81 example chain across `projections/`, `states/`, `world-events/`, `director-runs/`, `proposals/`, `transitions/`, `branches/`, `replays/`, plus the Zhalm slice fixtures (`*/zhalm-*.json`) | `docs/concepts/GENERATIVE_WORLD_*.md` |

## Generative World Director (MCL-80)

MCL-81 … MCL-85 are on `master`: an engine-free pipeline in `src/core/generative-world/`, one module per stage — `contracts.ts` (TypeScript **mirror** of the schemas, no semantics) → `validation.ts` (AJV 2020 over the same schemas at runtime with `strictNumbers`, which is why `ajv` is a runtime dependency) → `event-ledger.ts` (append-only; `observed_gameplay` evidence vs. derived proposals) → `transition-engine.ts` (pure; `SET_WORLD_FLAG` on declared boolean flags is the whole op vocabulary) → `world-session.ts` (state, reset, provider-free replay) → `director-context.ts` / `fake-provider.ts` / `director-orchestrator.ts` (provider port, deterministic FakeProvider, run lifecycle CREATED → PREPARING → RUNNING → STOPPED | FAILED) → `policy-gate.ts` (every rule evaluated; `GATE_REASON_CODES` is the complete list; privacy findings are stored redacted) → `director-session.ts`, whose `select()` is the only path from a proposal to the world: accepted gate result, unchanged world fingerprint (else `STALE_RUN`), engine dry run, then apply.

- `dependency-guard.test.ts` limits that folder to its own modules, the schemas and `ajv/dist/2020.js`, and bans network, clock, randomness and dynamic-loading APIs — inject clocks, compare via `canonicalJson` (`json.ts`).
- Zhalm wiring stays experiment-local in `experiments/zhalm-forest-v1/director/` (event bridge, intent catalog, panel). `transition_intent` values are opaque tokens; only an experiment's intent catalog maps them to operations. Browser proof: `e2e/zhalm-director.spec.ts` through the `__zhalm.director` hook.
- Each contract keeps a focused AJV test in `src/core/<contract>/` that reads its schema cwd-relative (run vitest from the repo root). `BranchNode` / `ReplayRef` hold reference tokens only, never embedded state or payloads.
- Not built: branch/replay comparison (MCL-86), Consequence Lab UI (MCL-87), a real AI provider (MCL-88, which needs MCL-103's `source_refs` check first). The human value gate MCL-91 decides whether that work happens. Architecture: Confluence MLOA 69697537 (parent 64815106); semantics: `docs/concepts/GENERATIVE_WORLD_DIRECTOR_SLICE.md`.
- Infinite World is a semantics donor only, no code; reusing donor code would need its own Apache-2.0 attribution/NOTICE check.

## Assets

- Register every asset in `assets/registry/assets.json` (source, license, provenance, status `placeholder | candidate | approved_for_prototype`, version, `fallback_asset_id`) **before** use; code references `asset_id`, never file paths. No third-party franchise iconography.
- Graybox: JSON cube specs `assets/blockmodels/*.json` → `npm run generate:assets` → `public/assets/generated/*.glb` + `assets/blockmodels/bbmodel/*.bbmodel`. CI diffs the output, so edit the spec and regenerate — never hand-edit the GLB (`docs/runtime/BLOCKBENCH.md`).
- CC0 environment models: `scripts/fetch-polyhaven.mjs <asset_id>…` → `public/assets/env/`. V2 hero candidates (image→3D via Tripo or `scripts/image-to-3d/trellis.py`) → `public/assets/v2/`, registered as `candidate` until Ben approves them in-game.
- `.mcp.json` registers a Blockbench MCP at `http://localhost:3000/bb-mcp`; it only answers while the Blockbench desktop app runs with the plugin — ECONNREFUSED otherwise is normal.

**Art direction is V2 — semi-realistic standalone fantasy RPG** (Confluence MLOA:22544386; the V1 Minecraft/voxel language is SUPERSEDED). Anchors: `concepts/art-direction/`; lab rules: `docs/assets/ART_DIRECTION.md`. Blocky generated models are graybox standins only — never present them as the target look.

## Governance and hard constraints

- **Prototype Runtime Exception** (Ben, 2026-08-23): the lab may use a disposable runtime. It does NOT decide the production engine, NOT MCL-1 (product format, still open), NOT Minecraft vs. standalone. Never present PlayCanvas as a product decision.
- **Do not modify `DYAI2025/MC_legends`** unless separately authorized; it is never a dependency. The lab must not silently evolve into the production game architecture.
- Branch off `origin/master` (local `master` may lag), PR against `master`, no force-push; merge only under the merge approval below. Commits are conventional, scoped by the Jira key when there is one (`feat(MCL-81): …`). Stacked story branches: fix a defect on the lowest branch that has it and merge upward, never rebase; once each PR meets the merge criteria, merge bottom-up with merge commits and retarget the next PR (`gh pr edit <n> --base master`).
- **Merge approval** (Ben, 2026-09-30, standing): merge a PR without asking once every criterion holds on its exact head SHA — not a draft and scoped to its ticket; every check green in both the push and the PR run (`gates`, `deployment-container`, Sourcery; an infra-only failure counts after a green rerun, a check that did not run is a gap to report); `MERGEABLE` / `CLEAN`; every review finding fixed or explicitly dispositioned. Merge with `gh pr merge <n> --merge --match-head-commit <sha>`, then confirm the `master` tree equals the reviewed head and master CI is green. Short of that, report the gap instead of merging. Product and design decisions (e.g. MCL-91, scope, architecture) stay with Ben. This is the explicit authorization that the plans' "no self-merge without authorization" rule (mission §12) asks for.
- **Experiment is the unit of change.** Logic stays experiment-local until ≥2 independent experiments need the same behavior contract (precedents: `src/core/sound-network/`, `src/runtime/assets/fit.ts`). Duplication between experiments is correct, not a smell.
- **Prototype outcome is evidence, not canon.** Experiments carry `design_status` (STATED | TENTATIVE | AMBIGUOUS | CONFLICT) and `source_refs` (`MLOA:<pageId>[#section]` for Confluence, `MCL-<n>` for Jira); a result never updates Confluence canon by itself.
- No backend, database, cloud service, multiplayer or auth without a separate ADR. The only deployment is ADR-0004's static non-root Caddy container (`:8080`, `/healthz`; runbook `docs/runtime/VPS_TEST_INSTANCE.md`): saves stay in browser `localStorage` plus JSON export, no secret goes into Vite env or the image, and `https://mcl-test.poersch.online` is not "live" until the runbook's HTTPS/browser checks pass.
- No real child names, private submissions, credentials or secrets in fixtures, screenshots, logs or assets.
- **An unexecuted validation gate is `not_run`, never `passed`.** Make a new gate fail once (canary) before trusting it green; record results in `docs/runtime/VALIDATION.md`.

## Context

- User preference is third-person. `zhalm-forest-v1` is the first playable: a forest encounter testing the Druhen/Zhalm sound-network hypothesis (sound → root trigger → network alert → investigate/chase), and the V2 look-pass testbed.
- `world-editor-v1` builds worlds in-runtime: place/move registry assets, EDIT (fly cam) ↔ PLAY (`Tab`) with live behavior presets incl. the shared sound network; autosave in `localStorage`, JSON export/import, committed layouts in `worlds/*.json` (bundled via `import.meta.glob`). See `docs/runtime/WORLD_EDITOR.md`.
