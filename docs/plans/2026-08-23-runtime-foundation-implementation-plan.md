# Prototype Runtime Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Take `DYAI2025/MCL-protolab` from a documents-only concept repo to `runtime_verified` — a locally playable third-person PlayCanvas prototype runtime with an experiment harness, a wired asset registry, and a creature/FX gallery, every gate actually executed.

**Architecture:** Vite + TypeScript-strict browser app. `src/runtime/` talks to the PlayCanvas engine directly (no engine-abstraction layer); `src/core/` holds engine-agnostic pure logic (events, tunables, experiment registry, asset registry, debug state); `experiments/` holds isolated scenes that consume runtime + core. Import boundaries are machine-enforced by dependency-cruiser, not prose. Physics is Ammo.js loaded through `pc.WasmModule` from `public/ammo/`.

**Tech Stack:** playcanvas 2.21.4 (MIT) · vite 8.2.2 · typescript 6.0.3 · vitest 4.1.11 · @playwright/test 1.62.1 · eslint 10.9.0 + typescript-eslint 8.67.0 · dependency-cruiser 18.2.0 · Node 24.19.0

**Binding rule sources:** `AGENTS.md`, `docs/architecture/ADR-0002-prototype-lab.md`, `docs/plans/2026-08-23-runtime-foundation-design.md`, `docs/plans/2026-08-23-runtime-foundation-mission.md`, and (once PR #1 lands) `docs/plans/2026-08-23-runtime-foundation-audit-addendum.md`. Where the addendum is more specific, it wins.

---

## How this plan is ordered, and why

Effectiveness here is not "do the tasks in architecture-diagram order". It is: **kill the two things that can kill the project, before building anything on top of them.**

1. **Risk-first walking skeleton (Phase 1).** The design doc names Ammo/wasm-under-Vite as the top integration risk. The second silent killer is headless WebGL in Playwright. Both are proven in Phase 1 with a screenshot on disk, before a single line of harness code exists. If Phase 1 fails, the Babylon fallback decision happens on day one, not after two weeks of harness work is thrown away.
2. **Scaffold, don't hand-assemble.** `npm create playcanvas@latest -- -f engine` with the physics feature ships the three ammo binaries byte-identical to engine `v2.21.4`, plus a `LICENSE` (zlib) and a `SOURCE.md` recording upstream commit and SHA-256 hashes. That single step satisfies the repo's mandatory asset-provenance rule for the physics binaries. Hand-copying from GitHub creates an unsourced-binary problem you then have to document by hand.
3. **TDD where it pays, smoke where it doesn't.** Pure logic (event emitter, tunables, experiment registry, reset state, asset/concept registries, schema validation) is TDD'd with Vitest. Engine integration (does the capsule fall, does the camera follow) is proven by Playwright smoke + the manual gate. Writing unit tests against PlayCanvas entities buys nothing and costs a lot.
4. **Gates wired at Task 2, before there is anything to gate.** A gate added at the end is a gate that has never failed and therefore proves nothing.
5. **Boundaries enforced mechanically.** Mission §5 asks for architecture rules "per Test/Lint prüfbar". dependency-cruiser gives an exit code; prose in `AGENTS.md` does not.
6. **Phase 4 is parallelizable.** Once the FX kit (Task 13) exists, the four creature profiles (Task 15) are four independent units of work.

### Task map

| Phase | Tasks | Output |
|---|---|---|
| 0 — Prep | 0 | branch, governance decision, Node pinned |
| 1 — Walking skeleton (**risk gate**) | 1–3, 2b, 2c | app boots, physics runs, all gates green + no blind spots, screenshot committed |
| 2 — Core logic (TDD) | 4–7 | events, tunables, experiment registry, asset registry |
| 3 — Runtime integration | 8–11 | third-person player+camera, playground, inspector, reset |
| 4 — Creature FX gallery | 12–15 | concept loader, FX kit, gallery, 4 creature states |
| 5 — Gates & delivery | 16–20 | smoke, docs, fresh-clone, manual gate, draft PR |

### Known traps, pre-collected

Every one of these was verified against `playcanvas@2.21.4` source or the current official docs on 2026-08-23. They are the difference between a two-day and a two-week Phase 1–4.

- **Ammo must be a global before `app.start()`.** `AppBase.start()` → `onLibrariesLoaded()` → `RigidBodyComponentSystem.onLibraryLoaded()` does `if (!this._world && typeof Ammo !== 'undefined') { …setPhysicsWorld… } else if (!this._world) { this.app.systems.off('update', this.onUpdate, this); }`. If Ammo is late, the physics update handler is **permanently unbound with no retry and no error**. Always `await WasmModule.getInstance('Ammo', …)` *before* `createGraphicsDevice`.
- **`playcanvas` npm ships no ammo binaries.** The 2.21.4 tarball has zero `.wasm` files. Sources: engine repo `examples/assets/wasm/ammo/` or `create-playcanvas`'s physics feature. The npm package `ammo.js` (0.0.10, 2016) is asm.js-only and NOT usable.
- **Serve ammo from `public/`, root-absolute.** `WasmModule` injects the glue via a classic `<script src>` tag and hands Emscripten `locateFile: () => config.wasmUrl`. Vite's `?url` / `?init` wasm handling actively breaks this (inlining a `.wasm` under `assetsInlineLimit` in a production build kills it).
- **Playwright `webServer.url` must be `http://localhost:…`, not `127.0.0.1`.** Measured: with `127.0.0.1` the run times out after 120 s while Vite is demonstrably serving.
- **PlayCanvas resolves the `development` export condition in `vite dev`** → the debug build, with extra asserts and console output. A smoke test that asserts "zero console errors" should run against `vite preview` (production build), or filter known-benign debug lines. Decide this in Task 3, not at the end.
- **`erasableSyntaxOnly: true` bans enums, namespaces and parameter properties.** Measured: `export enum MovementState {...}` → `error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.` Use string-literal unions instead (`'idle' | 'walk' | 'jog'`), which is what Task 10's `InspectorSnapshot` already does.
- **`typescript` is pinned to 6.0.3, not 7.x** — `typescript-eslint@8.67.0` declares peer `>=4.8.4 <6.1.0`. TS 7 breaks lint.
- **Node 22.23.1 (what is currently on this machine) is below the engine template's `engines.node >= 22.23.2`.** Use the pinned 24.19.0 via `nvm`.
- **`particlesystem.rate` is an interval in seconds, not particles per second.** Smaller = more particles.
- **Bloom has no `enabled` and no `threshold` in 2.21.4.** `CameraFrame.bloom` is exactly `{ intensity, blurLevel }`; the engine's enable check is literally `options.bloomEnabled = bloom.intensity > 0`. It also **requires an HDR render format** — with `PIXELFORMAT_RGBA8` bloom silently self-disables. Any tutorial showing `bloom.enabled = true` is writing a dead property.
- **`app.scene.fog` is an object with no setter.** Mutate `app.scene.fog.type = FOG_EXP2` etc. Fog type constants are strings (`'none'|'linear'|'exp'|'exp2'`). The flat `scene.fogColor`/`fogDensity` props still exist but log deprecation warnings.
- **There is no trail renderer and no `pc.Decal`.** Trails: `WideLine` + `WideLineRenderer` with `widthUnits = LINEWIDTH_WORLD` ("camera-facing ribbons in world units") — but **alpha is ignored**, so fade by driving RGB toward black or per-point width to 0. Decals: pooled dynamic `pc.Mesh` quads, per the engine's own `mesh-decals` example.
- **`ThirdPersonController` throws `'ThirdPersonController: Camera entity is required.'`** if the `camera` attribute is unset, and the camera **must be a top-level entity**, not a child of the character. It auto-adds a capsule collision `{radius: 0.5, height: 2}` and a dynamic rigidbody `{mass: 100, angularFactor: Vec3.ZERO}` if absent.
- **`rigidbody.linearVelocity` silently no-ops on static and kinematic bodies** (guarded by `_type === BODYTYPE_DYNAMIC`). Kinematic bodies are moved by setting the *entity* transform.
- **`collision.height` is total tip-to-tip**, not half-height.
- **Lights shine down their negative Y axis; `lookAt` orients negative Z.** An unrotated light points straight down. To aim a light at a target: `light.lookAt(p); light.rotateLocal(90, 0, 0);`
- **`entity.addComponent(type, data)` is typed `(type: string, data?: object) => Component | null`.** Component option names get **zero** compile-time checking — a typo fails silently at runtime. Treat option names as verified-by-execution, not by `tsc`.
- **Always call `material.update()`** after changing material properties, and **`cameraFrame.update()`** after changing any CameraFrame property.

---

## Task 0: Repository prep and the PR #1 decision

**Files:**
- No file edits — git state only.

**Step 1: Sync the clone and confirm you are on the right repo**

```bash
cd ~/Projects/MCL-protolab
git remote -v
git fetch origin
git status --short
git log --oneline -3
```

Expected: remote is `https://github.com/DYAI2025/MCL-protolab.git`, clean tree, `5c2bf56` on top. **If the remote is anything else, STOP with BLOCKER** (mission §14: target repo must be `DYAI2025/MCL-protolab`).

**Step 2: Resolve the PR #1 governance decision**

PR #1 (`audit/prototype-foundation-hardening`, MERGEABLE/CLEAN, authored by DYAI2025) is docs + schemas only — no code. It carries three things this plan depends on:

- `AGENTS.md` rule 3 rewritten to state the Prototype Runtime Exception is **granted** (on `master` it still says runtime selection is forbidden — a direct contradiction with the mission an executing agent will hit);
- `docs/plans/2026-08-23-runtime-foundation-audit-addendum.md`, which makes the creature/FX gallery a **hard `runtime_verified` requirement** (Phase 4 of this plan);
- `schemas/creature-concept.schema.json` + `concepts/creatures/{mugosh,flammenwolf,veras,zhalm}.json`, which are the **inputs** to Task 12–15.

Two valid routes — **this needs Ben's call, it is not the executing agent's to make**:

- **Route A (recommended): merge PR #1 into `master` first**, then branch from `master`. Cleanest history; the feature branch never carries someone else's docs changes.
  ```bash
  gh pr merge 1 --repo DYAI2025/MCL-protolab --squash   # ONLY with explicit authorization from Ben
  git checkout master && git pull --ff-only
  ```
- **Route B: branch off PR #1's head** and let both land together.
  ```bash
  git checkout -b feat/prototype-runtime-foundation origin/audit/prototype-foundation-hardening
  ```

Do **not** self-merge without that authorization (mission §12).

**Step 3: Create the working branch**

```bash
git checkout -b feat/prototype-runtime-foundation    # from master, after Route A
git branch --show-current
```
Expected output: `feat/prototype-runtime-foundation`

**Step 4: Pin and activate Node**

```bash
node --version
```
If this prints anything below `v24.19.0`, install and use the pin (the engine template declares `engines.node >= 22.23.2`; the machine currently has 22.23.1, which is *below* it):

```bash
source ~/.nvm/nvm.sh
nvm install 24.19.0
nvm use 24.19.0
node --version   # expect v24.19.0
```

**Step 5: Commit the branch point marker (nothing to commit yet)**

No commit. Task 0 produces git state only. Record in your decision notes: `Evidence: origin=DYAI2025/MCL-protolab, HEAD=<sha>. Decision: Route A|B. Reason: <Ben's instruction>. Validation: git branch --show-current.`

---

## Task 1: Scaffold the Vite + PlayCanvas + Ammo baseline

Generate with the official scaffolder into a scratch directory, then transplant only what is needed. This is what gives you provenance-documented ammo binaries for free.

**Files:**
- Create: `package.json`, `index.html`, `src/main.ts`, `src/style.css`, `src/vite-env.d.ts`, `.nvmrc`, `.npmrc`, `.gitignore`
- Create: `public/ammo/ammo.js`, `public/ammo/ammo.wasm.js`, `public/ammo/ammo.wasm.wasm`, `public/ammo/LICENSE`, `public/ammo/SOURCE.md`

**Step 1: Generate the reference project in a scratch dir**

```bash
cd /tmp && rm -rf pc-scaffold
npm create playcanvas@latest pc-scaffold -- -f engine -s third-person-controller
ls -la /tmp/pc-scaffold /tmp/pc-scaffold/public/ammo
```
Expected: a project tree with `public/ammo/` containing `ammo.js`, `ammo.wasm.js`, `ammo.wasm.wasm`, `LICENSE`, `SOURCE.md`.

If the scaffolder is interactive or the starter name differs, list what it offers and pick the `engine` format with the physics feature; the requirement is the `public/ammo/` payload, not the exact starter.

**Step 2: Verify the ammo binaries against the published upstream hashes**

```bash
cd /tmp/pc-scaffold/public/ammo && shasum -a 256 ammo.js ammo.wasm.js ammo.wasm.wasm
```
Expected exactly (engine `v2.21.4`, commit `e287e0c67f3c20c689a52b7c53d2b7fedbe887da`):
```
ef166d1315bc4a6441a8de341ecdf6ac4e7d69055caec65c523ed1a4e8e19b15  ammo.js
5645b5a0c4f03be9d9d1ae604ffacd5e5e525310cfd1d0ed27474cdd1f34aab0  ammo.wasm.js
a61b504d4a6ce6bb93bd843e0f61edb8115e7317f1b3462247031a83ddb25d09  ammo.wasm.wasm
```
**If a hash differs, STOP and report the actual value** — do not adjust the check to fit (mission §13). A mismatch means the scaffolder shipped a different engine version; re-derive the expected hashes from that version's `SOURCE.md` before proceeding.

**Step 3: Transplant into the repo**

```bash
cd ~/Projects/MCL-protolab
mkdir -p public/ammo src
cp /tmp/pc-scaffold/public/ammo/* public/ammo/
cp /tmp/pc-scaffold/index.html .
cp /tmp/pc-scaffold/src/style.css src/ 2>/dev/null || true
cp /tmp/pc-scaffold/src/vite-env.d.ts src/ 2>/dev/null || true
ls public/ammo && cat public/ammo/SOURCE.md
```

**Step 4: Write `package.json`**

Exact version set — this combination was installed together and passed every gate on 2026-08-23.

```json
{
  "name": "mcl-protolab",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24.19.0" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json",
    "lint": "eslint .",
    "boundaries": "depcruise --config .dependency-cruiser.cjs --output-type err src experiments",
    "test": "vitest run",
    "e2e": "playwright test"
  },
  "dependencies": {
    "playcanvas": "2.21.4"
  },
  "devDependencies": {
    "@playwright/test": "1.62.1",
    "@types/node": "26.2.0",
    "ajv": "8.20.0",
    "dependency-cruiser": "18.2.0",
    "eslint": "10.9.0",
    "eslint-import-resolver-typescript": "4.4.5",
    "eslint-plugin-boundaries": "7.2.0",
    "typescript": "6.0.3",
    "typescript-eslint": "8.67.0",
    "vite": "8.2.2",
    "vitest": "4.1.11"
  }
}
```

**Step 5: Write `.nvmrc` and `.npmrc`**

`.nvmrc`:
```
24.19.0
```

`.npmrc` — npm does NOT enforce `engines` without this; `EBADENGINE` is otherwise only a warning, and Task 18's fresh-clone gate is exactly where a wrong Node must fail at `npm install` rather than three commands later:
```
engine-strict=true
```

**Step 6: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MCL Protolab</title>
  </head>
  <body>
    <canvas id="application-canvas"></canvas>
    <div id="inspector"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**Step 6b: Write `src/style.css`**

The scaffolder ships `src/starter.css`, not `style.css`, and roughly half of it is demo chrome (`.hud`, `.panel`, `.crosshair`, `.swatch`) for a starter overlay this repo does not have. Author the reset instead — and position the two elements explicitly, or the inspector Task 10 builds is laid out **below the fold and clipped**: with the canvas as a normal block filling the viewport, `#inspector` starts at `y = viewportHeight` and `body { overflow: hidden }` hides it.

```css
* { box-sizing: border-box; }
html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
body { background: #11151c; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; }
canvas { display: block; }

#application-canvas { position: fixed; inset: 0; }
#inspector { position: fixed; top: 0; left: 0; z-index: 1; pointer-events: none; }
#inspector * { pointer-events: auto; }
```

The `pointer-events` pair is load-bearing: the overlay must not swallow the mouse-look input the canvas needs for the third-person camera, while its own sliders and reset button stay clickable. Verify by measuring the rendered rects (`getBoundingClientRect`), not by reading the CSS — `#inspector` must report `y: 0`.

**Step 7: Write `src/vite-env.d.ts`**

Required — the shipped ESM helper scripts have no `.d.ts`, so these imports do not typecheck without ambient declarations.

```typescript
/// <reference types="vite/client" />

declare module 'playcanvas/scripts/esm/third-person-controller.mjs' {
  import { Script } from 'playcanvas';
  export class ThirdPersonController extends Script {
    static scriptName: string;
  }
  export function damp(damping: number, dt: number): number;
}

declare module 'playcanvas/scripts/esm/camera-controls.mjs' {
  import { Script } from 'playcanvas';
  export class CameraControls extends Script {
    static scriptName: string;
  }
  export function damp(damping: number, dt: number): number;
}
```

Both `.mjs` files export exactly two symbols each — the class and `damp`. Verified against `playcanvas@2.21.4` source: `third-person-controller.mjs:100` `static scriptName = 'thirdPersonController'`, `camera-controls.mjs:150` `static scriptName = 'cameraControls'`, `damp = (damping, dt) => 1 - Math.pow(damping, dt * 1000)`. The package's `exports` map exposes `"./scripts/*"` with no `types` condition, so these ambient declarations are required, not redundant.

**Step 8: Extend `.gitignore`**

```
node_modules/
dist/
artifacts/test-results/
playwright-report/
test-results/
*.tsbuildinfo
*.local
.DS_Store
```

Note the deliberate asymmetry: `artifacts/test-results/` is ignored, but `artifacts/screens/*.png` is **committed** — those screenshots are the runtime evidence Tasks 3/16/19 require. `test-results/` is Playwright's default `outputDir` (Task 2 redirects it, but a stray `npx playwright test` without that config writes there). `*.local` covers Vite's `.env.local` convention, which `AGENTS.md` rule 8 makes a real concern.

**Step 9: Install**

```bash
cd ~/Projects/MCL-protolab && npm install
```
Expected: completes without `EBADENGINE`. Record the exact output in the final report.

**Step 10: Commit**

```bash
git add package.json package-lock.json .nvmrc .npmrc .gitignore index.html public/ammo src/main.ts src/style.css src/vite-env.d.ts
git commit -m "chore: scaffold Vite + PlayCanvas 2.21.4 baseline with provenance-documented Ammo binaries"
```

---

## Task 2: Wire every quality gate before there is anything to gate

**Files:**
- Create: `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.dependency-cruiser.cjs`, `playwright.config.ts`
- Create: `src/core/version.ts`, `src/core/version.test.ts`, `e2e/smoke.spec.ts`

**Step 1: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "esnext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "skipLibCheck": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src", "experiments", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

**Step 2: Write `vite.config.ts`**

The triple-slash reference is **required** for the `test` key to typecheck when `defineConfig` comes from `vite`.

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    // Vitest 4's default exclude is only node_modules/.git, so e2e/*.spec.ts
    // WOULD be collected and would try to run Playwright under Vitest.
    include: ['src/**/*.test.ts', 'experiments/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    environment: 'node',
  },
});
```

**Step 3: Write `eslint.config.js`**

```javascript
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'artifacts/**', 'public/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: { boundaries },
    settings: {
      // REQUIRED for extensionless imports. Measured 2026-08-23, 2x2 matrix:
      //   with resolver    + './x'    -> fires    | with resolver    + './x.ts' -> fires
      //   WITHOUT resolver + './x'    -> SILENT PASS | WITHOUT resolver + './x.ts' -> fires
      // `.ts`-extension imports resolve literally and need no resolver; extensionless
      // ones silently pass without it. Keep this line.
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/elements': [
        { type: 'runtime', pattern: 'src/runtime/**' },
        { type: 'core', pattern: 'src/core/**' },
        { type: 'shell', pattern: 'src/shell/**' },
        { type: 'experiment', pattern: 'experiments/*/**' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            { from: { element: { type: 'runtime' } }, allow: { to: { element: { types: { anyOf: ['runtime', 'core'] } } } } },
            { from: { element: { type: 'core' } }, allow: { to: { element: { type: 'core' } } } },
            { from: { element: { type: 'shell' } }, allow: { to: { element: { types: { anyOf: ['runtime', 'core', 'experiment'] } } } } },
            { from: { element: { type: 'experiment' } }, allow: { to: { element: { types: { anyOf: ['runtime', 'core', 'experiment'] } } } } },
          ],
        },
      ],
    },
  },
);
```

**Step 4: Write `.dependency-cruiser.cjs`**

This is the CI-checkable version of mission §5's architecture rules. Exit code equals the number of error-severity violations.

```javascript
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'runtime-not-to-experiments',
      severity: 'error',
      comment: 'src/runtime is engine integration only; it must never import experiment code.',
      from: { path: '^src/runtime/' },
      to: { path: '^experiments/' },
    },
    {
      name: 'core-not-to-experiments',
      severity: 'error',
      comment: 'src/core must not know about any concrete experiment.',
      from: { path: '^src/core/' },
      to: { path: '^experiments/' },
    },
    {
      name: 'core-not-to-runtime',
      severity: 'error',
      comment: 'src/core is engine-agnostic pure logic; it must not import src/runtime.',
      from: { path: '^src/core/' },
      to: { path: '^src/runtime/' },
    },
    {
      name: 'core-not-to-playcanvas',
      severity: 'error',
      comment: 'Only src/runtime may know the engine. Keeps core unit-testable without a browser.',
      from: { path: '^src/core/' },
      to: { path: 'node_modules/playcanvas' },
    },
    {
      name: 'shell-is-the-only-composition-root',
      severity: 'error',
      comment: 'Only src/shell may wire experiments to the runtime. Keeps the composition root single and findable.',
      from: { path: '^src/(runtime|core)/' },
      to: { path: '^src/shell/' },
    },
    {
      name: 'no-mc-legends-dependency',
      severity: 'error',
      comment: 'ADR-0002: the lab must never depend on the production web repo.',
      from: { path: '^(src|experiments)/' },
      to: { path: 'MC_legends' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    // doNotFollow keeps node_modules modules in the graph as leaves without
    // traversing into them. Do NOT add `exclude: node_modules` here: exclude
    // strips those modules from the graph entirely, which silently kills the
    // core-not-to-playcanvas rule (measured 2026-08-23 — with `exclude` set,
    // a file importing playcanvas reported `✔ no dependency violations`).
    doNotFollow: { path: 'node_modules' },
  },
};
```

**Step 5: Write `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './artifacts/test-results',
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    // MUST be localhost. With 127.0.0.1 the run times out after 120s
    // even though Vite is serving correctly.
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
```

**Step 6: Write the failing gate-canary test**

`src/core/version.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { RUNTIME_FOUNDATION_VERSION } from './version.ts';

describe('runtime foundation', () => {
  it('exposes a version marker so the unit gate has something real to run', () => {
    expect(RUNTIME_FOUNDATION_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
```

**Step 7: Run it and watch it fail**

```bash
npm test
```
Expected: FAIL — `Failed to resolve import "./version.ts"`.

**Step 8: Write the minimal implementation**

`src/core/version.ts`:

```typescript
export const RUNTIME_FOUNDATION_VERSION = '0.1.0';
```

**Step 9: Run the whole gate chain**

```bash
npx playwright install chromium
npm run typecheck && npm run lint && npm run boundaries && npm test && npm run build
```
Expected: every command exits 0. `npm run boundaries` prints `✔ no dependency violations found`.

**Step 10: Prove EVERY boundary rule actually bites**

A gate that has never failed proves nothing — and one of these rules shipped dead. Canary each of the five rules in turn, confirming `EXIT=1` and the expected message, then delete the canary and confirm `EXIT=0`. Measured 2026-08-23, all five now fire:

```
1 runtime-not-to-experiments   EXIT=1  src/runtime/canary.ts → experiments/_canary/logic.ts
2 core-not-to-experiments      EXIT=1  src/core/canary.ts → experiments/_canary/logic.ts
3 core-not-to-runtime          EXIT=1  src/core/canary.ts → src/runtime/target.ts
4 core-not-to-playcanvas       EXIT=1  src/core/canary.ts → node_modules/playcanvas/build/playcanvas.js
5 no-mc-legends-dependency     EXIT=1  src/core/canary.ts → ../vendor-probe/MC_legends/api.ts
clean tree                     EXIT=0  ✔ no dependency violations found
```

Example for rule 1:
```bash
mkdir -p experiments/_canary && echo 'export const x = 1;' > experiments/_canary/logic.ts
mkdir -p src/runtime && printf "import { x } from '../../experiments/_canary/logic.ts';\nexport const y = x;\n" > src/runtime/canary.ts
npm run boundaries; echo "EXIT=$?"
```
Expected: prints `error runtime-not-to-experiments: src/runtime/canary.ts → experiments/_canary/logic.ts` and `EXIT=1`.

Rule 4 is the one that was dead. Diagnose a suspicious `✔` with `--output-type json` and check whether the module's `dependencies` array is empty — an empty array means the edge was excluded from the graph, not that the import is absent.

Then remove the canary and confirm it goes green again:

```bash
rm -rf experiments/_canary src/runtime/canary.ts
npm run boundaries; echo "EXIT=$?"   # expect: ✔ no dependency violations found / EXIT=0
```

**Step 11: Commit**

```bash
git add tsconfig.json vite.config.ts eslint.config.js .dependency-cruiser.cjs playwright.config.ts src/core/version.ts src/core/version.test.ts
git commit -m "chore: wire typecheck, lint, import-boundary, unit and build gates"
```

---

## Task 2b: Close the static-gate blind spots

Task 2's gates are real but two areas sit outside all of them. Both were measured on `489eb6f`. If Task 2 was already executed with the older config, this task applies the corrections to the existing branch; a fresh run gets them from Task 2 directly and can skip to Step 3.

**Files:**
- Modify: `tsconfig.json` — add `e2e` and `playwright.config.ts` to `include`
- Modify: `.dependency-cruiser.cjs` — add the `shell-is-the-only-composition-root` rule

**Step 1: Prove the blind spot before fixing it**

```bash
printf "\nconst broken: number = 'definitely not a number';\nvoid broken;\n" >> e2e/smoke.spec.ts
npm run typecheck; echo "EXIT=$?"
npm run lint; echo "EXIT=$?"
```
Measured on `489eb6f`: **both exit 0**. A blatant type error in the smoke spec is invisible to every static gate. ESLint sees the file, but `tseslint.configs.recommended` is the non-type-checked preset, so assignment errors are `tsc`'s job — and `tsconfig.include` never listed `e2e`.

This matters more here than in a normal repo: Tasks 3, 16 and 19 make the e2e specs the **primary runtime evidence** for `runtime_verified`. Playwright transpiles TypeScript regardless of type errors, so a type-broken evidence test still runs and can silently assert less than intended.

**Step 2: Widen the include and prove the gate now bites**

```json
"include": ["src", "experiments", "e2e", "vite.config.ts", "playwright.config.ts"]
```

```bash
npm run typecheck; echo "EXIT=$?"
```
Expected with the canary still in place: `EXIT=2` and `e2e/smoke.spec.ts(15,7): error TS2322: Type 'string' is not assignable to type 'number'.`

Then remove the canary and confirm `EXIT=0`. Verified 2026-08-24: `lint`, `test`, `build` and `e2e` are unaffected — Playwright and Vitest types coexist in one program without conflict.

**Step 3: Give `src/shell/` a dependency-cruiser rule**

`eslint.config.js` declares a `shell` element, but `.dependency-cruiser.cjs` has **zero** rules mentioning it. Task 11 creates `src/shell/bootstrap.ts` as the composition root that imports runtime, core *and* experiments.

That asymmetry is the risk: this plan already measured ESLint boundaries **silently passing** on extensionless imports without the resolver, while dependency-cruiser caught every case. Shell would be policed only by the mechanism with the known blind spot.

Add to `forbidden`:

```javascript
{
  name: 'shell-is-the-only-composition-root',
  severity: 'error',
  comment: 'Only src/shell may wire experiments to the runtime. Keeps the composition root single and findable.',
  from: { path: '^src/(runtime|core)/' },
  to: { path: '^src/shell/' },
},
```

**Step 4: Canary the new rule**

Per the standing rule — a gate that has never failed is `not_run`, not `passed`:

```bash
mkdir -p src/shell && echo 'export const s = 1;' > src/shell/target.ts
printf "import { s } from '../shell/target.ts';\nexport const y = s;\n" > src/core/canary.ts
npm run boundaries; echo "EXIT=$?"
```
Expected: `error shell-is-the-only-composition-root: src/core/canary.ts → src/shell/target.ts` and `EXIT=1`. Remove the canary, confirm `EXIT=0`.

**Step 5: Run the full chain and commit**

```bash
npm run typecheck && npm run lint && npm run boundaries && npm test && npm run build && npm run e2e
git add tsconfig.json .dependency-cruiser.cjs
git commit -m "fix: typecheck e2e specs and guard the shell composition root"
```

---

## Task 2c: CI workflow — or a documented decision not to have one

Every gate in this repo is currently manual. `.github/workflows/` does not exist, so a reviewer looking at the draft PR sees **no automated signal at all**, and nothing runs the chain except a human remembering to.

On a branch whose central discipline is *"a gate that has never failed proves nothing"*, leaving the gates unrun-by-default is the same class of problem one level up.

**This is a genuine either/or — decide it explicitly, do not drift into it.**

**Option A — add CI (recommended).** A workflow running the existing chain on push and PR. No new gates, no new dependencies; it runs exactly what a developer runs.

**Files:** Create `.github/workflows/gates.yml`

```yaml
name: gates
on:
  push:
    branches: ['**']
  pull_request:

jobs:
  gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run boundaries
      - run: npm test
      - run: npm run build
      - run: npm run e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: runtime-evidence
          path: |
            artifacts/screens/
            artifacts/test-results/
```

Two things to verify rather than assume, because both were flagged as unknowns during research:

1. **Headless WebGL on a Linux runner.** All Playwright/WebGL measurements for this plan were taken on macOS arm64. SwiftShader behaviour on `ubuntu-latest` was **not** verified. Run the probe there before trusting the `e2e` step; if WebGL is unavailable, the honest move is to split `e2e` into a separate non-blocking job rather than weaken the assertion.
2. **The blocked postinstall.** `npm install` blocks a postinstall for `unrs-resolver`, a transitive dependency of `eslint-import-resolver-typescript` — which the boundaries lint rule *requires*. On macOS arm64 the prebuilt optional binding loads anyway. A CI platform without a prebuilt binding may need `npm ci --foreground-scripts` or an explicit approval step. If the boundaries rule silently reports nothing in CI, suspect this first.

**Option B — no CI, stated deliberately.** Acceptable for a disposable lab where Task 18's fresh-clone gate is the real check. If chosen, record it in `docs/architecture/ADR-0003-runtime-foundation.md` as a decision with its consequence: *every gate result in this repo is a human-attested claim, and the PR carries no independent signal.*

**Do not leave this undecided.** An absent workflow that nobody chose reads identically to one that was forgotten.

---

## Task 3: Walking skeleton — boot PlayCanvas with working Ammo physics

**This is the go/no-go gate for the whole PlayCanvas-first decision.** Nothing else in this plan is worth starting until a dynamic rigidbody visibly falls.

**Files:**
- Create: `src/runtime/boot.ts`
- Modify: `src/main.ts`
- Create: `e2e/smoke.spec.ts`

**Step 1: Write `src/runtime/boot.ts`**

Ordering is load-bearing: `setConfig` → `await getInstance` → `createGraphicsDevice` → `new AppBase` → `init` → `start`.

```typescript
import {
  AppBase,
  AppOptions,
  CameraComponentSystem,
  CollisionComponentSystem,
  Color,
  ContainerHandler,
  FILLMODE_FILL_WINDOW,
  LightComponentSystem,
  ParticleSystemComponentSystem,
  RESOLUTION_AUTO,
  RenderComponentSystem,
  RigidBodyComponentSystem,
  ScriptComponentSystem,
  TextureHandler,
  WasmModule,
  createGraphicsDevice,
} from 'playcanvas';

/**
 * Boots the prototype runtime.
 *
 * Ammo MUST be a defined global before app.start(): AppBase.start() calls
 * RigidBodyComponentSystem.onLibraryLoaded(), which permanently unbinds the
 * physics update handler if `typeof Ammo === 'undefined'` at that moment.
 * There is no retry and no error — physics is just silently dead.
 */
export async function bootRuntime(canvas: HTMLCanvasElement): Promise<AppBase> {
  WasmModule.setConfig('Ammo', {
    glueUrl: '/ammo/ammo.wasm.js',
    wasmUrl: '/ammo/ammo.wasm.wasm',
    fallbackUrl: '/ammo/ammo.js',
  });
  await new Promise<void>((resolve) => {
    WasmModule.getInstance('Ammo', () => resolve());
  });

  const device = await createGraphicsDevice(canvas);
  device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

  const options = new AppOptions();
  options.graphicsDevice = device;
  options.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem,
    CollisionComponentSystem,
    RigidBodyComponentSystem,
    ParticleSystemComponentSystem,
  ];
  options.resourceHandlers = [TextureHandler, ContainerHandler];

  const app = new AppBase(canvas);
  app.init(options);
  app.start();

  app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(RESOLUTION_AUTO);
  app.scene.ambientLight = new Color(0.28, 0.32, 0.38);

  // Resize is not automatic.
  const resize = () => app.resizeCanvas();
  window.addEventListener('resize', resize);
  app.on('destroy', () => window.removeEventListener('resize', resize));

  return app;
}
```

**Step 2: Write a throwaway scene in `src/main.ts`**

Ground + one dynamic box. Nothing else. `__protolab` is the test hook the smoke spec reads.

```typescript
import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import { bootRuntime } from './runtime/boot.ts';
import './style.css';

const canvas = document.getElementById('application-canvas') as HTMLCanvasElement;
const app = await bootRuntime(canvas);

const groundMaterial = new StandardMaterial();
groundMaterial.diffuse = new Color(0.2, 0.4, 0.18);
groundMaterial.update();

const ground = new Entity('ground');
ground.setLocalScale(20, 0.2, 20);
ground.setPosition(0, -0.1, 0);
ground.addComponent('render', { type: 'box', material: groundMaterial });
ground.addComponent('collision', { type: 'box', halfExtents: new Vec3(10, 0.1, 10) });
ground.addComponent('rigidbody', { type: 'static' });
app.root.addChild(ground);

const crate = new Entity('crate');
crate.setPosition(0, 6, 0);
crate.addComponent('render', { type: 'box' });
crate.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.5, 0.5, 0.5) });
crate.addComponent('rigidbody', { type: 'dynamic', mass: 10 });
app.root.addChild(crate);

const camera = new Entity('camera');
camera.addComponent('camera', { clearColor: new Color(0.48, 0.72, 0.9) });
camera.setPosition(0, 4, 10);
camera.lookAt(0, 1, 0);
app.root.addChild(camera);

const light = new Entity('light');
light.addComponent('light', { type: 'directional', intensity: 2.5, castShadows: true, shadowBias: 0.2, normalOffsetBias: 0.05 });
light.setEulerAngles(45, 30, 0);
app.root.addChild(light);

// Test hook — read by the Playwright smoke spec. Not game logic.
(window as unknown as Record<string, unknown>).__protolab = {
  cratePosition: () => crate.getPosition().clone(),
  physicsAlive: () => app.systems.rigidbody?.gravity.y ?? 0,
};
```

**Step 3: Write the failing smoke test**

`e2e/smoke.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

test('runtime boots and physics simulates', async ({ page }, testInfo) => {
  const errors: string[] = [];
  // Attach BEFORE goto, or early boot errors are missed.
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(`pageerror: ${err.message}`); });

  await page.goto('/');
  await page.waitForFunction(() => '__protolab' in window, undefined, { timeout: 15_000 });

  const start = await page.evaluate(() => (window as never as Record<string, any>).__protolab.cratePosition().y);
  await page.waitForTimeout(1000);
  const end = await page.evaluate(() => (window as never as Record<string, any>).__protolab.cratePosition().y);

  // Physics is either alive or permanently dead — there is no in-between.
  expect(start - end, `crate did not fall: start=${start} end=${end}`).toBeGreaterThan(0.5);

  await page.screenshot({ path: 'artifacts/screens/skeleton.png' });
  await page.screenshot({ path: testInfo.outputPath('skeleton.png') });

  expect(errors, errors.join('\n')).toEqual([]);
});
```

**Step 4: Run it and watch it fail (or pass)**

```bash
npm run e2e
```
This is the risk gate. Three outcomes:
- **PASS** → PlayCanvas-first is confirmed. Continue.
- **FAIL, crate did not fall** → Ammo did not load before `start()`. Check the Network tab for `/ammo/ammo.wasm.js` and `/ammo/ammo.wasm.wasm` (404 means the files are not in `public/ammo/`). Do NOT continue with a dead physics system.
- **FAIL, console errors from the PlayCanvas debug build** → expected: `vite dev` resolves the `development` export condition. Decide now, and document the decision: either (a) point `webServer.command` at `npm run build && npm run preview` so the smoke runs the production bundle, or (b) filter the known-benign debug lines with an explicit allowlist. Option (a) is preferred — it tests what actually ships.

**Step 5: Run it manually and look at it**

```bash
npm run dev
```
Open `http://localhost:5173`. Confirm with your own eyes: blue sky, green ground, a box that falls and lands. Save a screenshot. **Mission §8 does not accept a green test as a substitute for this.**

**Step 6: Run the full gate chain**

```bash
npm run typecheck && npm run lint && npm run boundaries && npm test && npm run build && npm run e2e
```

**Step 7: Commit**

```bash
git add src/runtime/boot.ts src/main.ts e2e/smoke.spec.ts artifacts/screens/skeleton.png
git commit -m "feat: boot PlayCanvas engine with Ammo physics and prove it with a browser smoke test"
```

**Step 8: Record the risk-gate outcome**

Write a one-paragraph decision note: `Evidence: <smoke output verbatim>. Decision: PlayCanvas-first CONFIRMED | BLOCKED. Reason: … . Validation: npm run e2e exit 0.` If BLOCKED, stop the plan here and escalate the Babylon.js fallback per mission §3.3 — do not improvise a workaround.

---

## Task 4: Typed event emitter (TDD)

Engine-agnostic. Lives in `src/core/`, so it is unit-testable with no browser.

**Files:**
- Create: `src/core/events/emitter.ts`, `src/core/events/emitter.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createEmitter } from './emitter.ts';

type TestEvents = {
  PLAYER_MOVED: { x: number; y: number; z: number };
  EXPERIMENT_RESET: { id: string };
};

describe('createEmitter', () => {
  it('delivers a payload to a subscriber', () => {
    const bus = createEmitter<TestEvents>();
    const spy = vi.fn();
    bus.on('PLAYER_MOVED', spy);
    bus.emit('PLAYER_MOVED', { x: 1, y: 2, z: 3 });
    expect(spy).toHaveBeenCalledExactlyOnceWith({ x: 1, y: 2, z: 3 });
  });

  it('stops delivering after unsubscribe', () => {
    const bus = createEmitter<TestEvents>();
    const spy = vi.fn();
    const off = bus.on('EXPERIMENT_RESET', spy);
    off();
    bus.emit('EXPERIMENT_RESET', { id: 'playground' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('isolates listeners of different events', () => {
    const bus = createEmitter<TestEvents>();
    const moved = vi.fn();
    bus.on('PLAYER_MOVED', moved);
    bus.emit('EXPERIMENT_RESET', { id: 'playground' });
    expect(moved).not.toHaveBeenCalled();
  });

  it('clear() removes every listener', () => {
    const bus = createEmitter<TestEvents>();
    const spy = vi.fn();
    bus.on('PLAYER_MOVED', spy);
    bus.clear();
    bus.emit('PLAYER_MOVED', { x: 0, y: 0, z: 0 });
    expect(spy).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run it and verify it fails**

```bash
npx vitest run src/core/events/emitter.test.ts
```
Expected: FAIL — cannot resolve `./emitter.ts`.

**Step 3: Write the minimal implementation**

```typescript
export type Listener<T> = (payload: T) => void;
export type Unsubscribe = () => void;

export interface Emitter<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Unsubscribe;
  emit<K extends keyof Events>(event: K, payload: Events[K]): void;
  clear(): void;
}

export function createEmitter<Events extends Record<string, unknown>>(): Emitter<Events> {
  const listeners = new Map<keyof Events, Set<Listener<never>>>();

  return {
    on(event, listener) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener as Listener<never>);
      return () => { set?.delete(listener as Listener<never>); };
    },
    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      for (const listener of [...set]) (listener as Listener<Events[typeof event]>)(payload);
    },
    clear() { listeners.clear(); },
  };
}
```

**Step 4: Run the test to verify it passes**

```bash
npx vitest run src/core/events/emitter.test.ts
```
Expected: 4 passed.

**Step 5: Define the initial event map — only events with a real consumer**

`src/core/events/protolab-events.ts`. Mission §5: no event taxonomy on spec. The consumer for both is the debug inspector (Task 10).

```typescript
export type ProtolabEvents = {
  PLAYER_MOVED: { x: number; y: number; z: number; speed: number };
  EXPERIMENT_RESET: { id: string };
};
```

**Step 6: Commit**

```bash
git add src/core/events
git commit -m "feat(core): typed event emitter with the two events that have a real consumer"
```

---

## Task 5: Tunables store (TDD)

Live-editable, never persisted (mission §6 H).

**Files:**
- Create: `src/core/config/tunables.ts`, `src/core/config/tunables.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createTunables } from './tunables.ts';

const defaults = {
  'player.walkSpeed': { value: 5, min: 0, max: 20, step: 0.1 },
  'player.sprintSpeed': { value: 8, min: 0, max: 30, step: 0.1 },
  'player.jumpForce': { value: 600, min: 0, max: 2000, step: 10 },
  'camera.distance': { value: 5, min: 1.5, max: 15, step: 0.1 },
  'camera.sensitivity': { value: 0.15, min: 0.01, max: 1, step: 0.01 },
} as const;

describe('createTunables', () => {
  it('returns the declared default', () => {
    expect(createTunables(defaults).get('player.walkSpeed')).toBe(5);
  });

  it('sets a new value', () => {
    const t = createTunables(defaults);
    t.set('player.walkSpeed', 9);
    expect(t.get('player.walkSpeed')).toBe(9);
  });

  it('clamps to the declared range instead of throwing', () => {
    const t = createTunables(defaults);
    t.set('camera.distance', 999);
    expect(t.get('camera.distance')).toBe(15);
    t.set('camera.distance', -4);
    expect(t.get('camera.distance')).toBe(1.5);
  });

  it('notifies subscribers on change', () => {
    const t = createTunables(defaults);
    const spy = vi.fn();
    t.subscribe(spy);
    t.set('player.jumpForce', 700);
    expect(spy).toHaveBeenCalledExactlyOnceWith('player.jumpForce', 700);
  });

  it('reset() restores every default', () => {
    const t = createTunables(defaults);
    t.set('player.walkSpeed', 12);
    t.set('camera.distance', 9);
    t.reset();
    expect(t.get('player.walkSpeed')).toBe(5);
    expect(t.get('camera.distance')).toBe(5);
  });

  it('exposes descriptors so the inspector can build sliders without hardcoding ranges', () => {
    const d = createTunables(defaults).descriptors();
    expect(d.map((x) => x.key)).toContain('camera.sensitivity');
    expect(d.find((x) => x.key === 'camera.sensitivity')?.max).toBe(1);
  });
});
```

**Step 2: Run and verify failure**

```bash
npx vitest run src/core/config/tunables.test.ts
```

**Step 3: Implement**

```typescript
export interface TunableSpec { value: number; min: number; max: number; step: number }
export interface TunableDescriptor extends TunableSpec { key: string }
export type TunableListener<K extends string> = (key: K, value: number) => void;

export function createTunables<Specs extends Record<string, TunableSpec>>(specs: Specs) {
  type Key = Extract<keyof Specs, string>;
  const values = new Map<Key, number>();
  const listeners = new Set<TunableListener<Key>>();
  const keys = Object.keys(specs) as Key[];

  const clamp = (key: Key, raw: number) => {
    const spec = specs[key] as TunableSpec;
    return Math.min(spec.max, Math.max(spec.min, raw));
  };

  for (const key of keys) values.set(key, (specs[key] as TunableSpec).value);

  return {
    get(key: Key): number { return values.get(key) ?? (specs[key] as TunableSpec).value; },
    set(key: Key, raw: number): void {
      const next = clamp(key, raw);
      values.set(key, next);
      for (const listener of [...listeners]) listener(key, next);
    },
    subscribe(listener: TunableListener<Key>): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    reset(): void { for (const key of keys) values.set(key, (specs[key] as TunableSpec).value); },
    descriptors(): TunableDescriptor[] {
      return keys.map((key) => ({ key, ...(specs[key] as TunableSpec), value: values.get(key) ?? (specs[key] as TunableSpec).value }));
    },
  };
}
```

**Step 4: Verify it passes**

```bash
npx vitest run src/core/config/tunables.test.ts   # expect 6 passed
```

**Step 5: Commit**

```bash
git add src/core/config
git commit -m "feat(core): clamped, subscribable tunables store with inspector descriptors"
```

---

## Task 6: Experiment registry, loader and reset lifecycle (TDD)

The `{ id, init(ctx), reset(ctx), destroy(ctx), tunables }` interface from mission §5. Pure logic — the context is injected, so this tests without a browser.

**Files:**
- Create: `src/core/experiments/types.ts`, `src/core/experiments/registry.ts`, `src/core/experiments/registry.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createExperimentRegistry } from './registry.ts';
import type { Experiment, ExperimentContext } from './types.ts';

const ctx = {} as ExperimentContext;

function fakeExperiment(id: string): Experiment & { calls: string[] } {
  const calls: string[] = [];
  return {
    id, calls,
    init: () => { calls.push('init'); },
    reset: () => { calls.push('reset'); },
    destroy: () => { calls.push('destroy'); },
    tunables: {},
  };
}

describe('createExperimentRegistry', () => {
  it('registers and lists ids', () => {
    const r = createExperimentRegistry();
    r.register(fakeExperiment('playground'));
    r.register(fakeExperiment('creature-fx-gallery'));
    expect(r.ids()).toEqual(['playground', 'creature-fx-gallery']);
  });

  it('rejects a duplicate id loudly', () => {
    const r = createExperimentRegistry();
    r.register(fakeExperiment('playground'));
    expect(() => r.register(fakeExperiment('playground'))).toThrow(/already registered/i);
  });

  it('throws a listing error for an unknown id instead of failing silently', () => {
    const r = createExperimentRegistry();
    r.register(fakeExperiment('playground'));
    expect(() => r.load('nope', ctx)).toThrow(/nope.*playground/s);
  });

  it('init()s on load', () => {
    const r = createExperimentRegistry();
    const e = fakeExperiment('playground');
    r.register(e);
    r.load('playground', ctx);
    expect(e.calls).toEqual(['init']);
    expect(r.activeId()).toBe('playground');
  });

  it('destroys the previous experiment before initialising the next', () => {
    const r = createExperimentRegistry();
    const a = fakeExperiment('a');
    const b = fakeExperiment('b');
    r.register(a); r.register(b);
    r.load('a', ctx);
    r.load('b', ctx);
    expect(a.calls).toEqual(['init', 'destroy']);
    expect(b.calls).toEqual(['init']);
  });

  it('reset() calls the active experiment reset, not init', () => {
    const r = createExperimentRegistry();
    const e = fakeExperiment('playground');
    r.register(e);
    r.load('playground', ctx);
    r.reset(ctx);
    expect(e.calls).toEqual(['init', 'reset']);
  });

  it('reset() with nothing loaded is a no-op, not a crash', () => {
    expect(() => createExperimentRegistry().reset(ctx)).not.toThrow();
  });

  it('emits EXPERIMENT_RESET through the injected emitter', () => {
    const emit = vi.fn();
    const r = createExperimentRegistry({ emit });
    r.register(fakeExperiment('playground'));
    r.load('playground', ctx);
    r.reset(ctx);
    expect(emit).toHaveBeenCalledWith('EXPERIMENT_RESET', { id: 'playground' });
  });
});
```

**Step 2: Run and verify failure**

```bash
npx vitest run src/core/experiments/registry.test.ts
```

**Step 3: Write `src/core/experiments/types.ts`**

`ExperimentContext` is deliberately opaque to `src/core/` — it is populated by `src/runtime/`, which keeps core free of any PlayCanvas import (enforced by the `core-not-to-playcanvas` rule).

```typescript
export interface ExperimentContext {
  /** Populated by src/runtime. Opaque here on purpose: src/core must not import the engine. */
  readonly scene: unknown;
  readonly tunables: { get(key: string): number };
}

export interface Experiment {
  readonly id: string;
  init(ctx: ExperimentContext): void;
  reset(ctx: ExperimentContext): void;
  destroy(ctx: ExperimentContext): void;
  readonly tunables: Record<string, number>;
}
```

**Step 4: Write `src/core/experiments/registry.ts`**

```typescript
import type { Experiment, ExperimentContext } from './types.ts';

interface EmitterLike { emit(event: 'EXPERIMENT_RESET', payload: { id: string }): void }

export function createExperimentRegistry(emitter?: EmitterLike) {
  const experiments = new Map<string, Experiment>();
  let active: Experiment | null = null;

  return {
    register(experiment: Experiment): void {
      if (experiments.has(experiment.id)) {
        throw new Error(`Experiment "${experiment.id}" is already registered.`);
      }
      experiments.set(experiment.id, experiment);
    },
    ids(): string[] { return [...experiments.keys()]; },
    activeId(): string | null { return active?.id ?? null; },
    load(id: string, ctx: ExperimentContext): void {
      const next = experiments.get(id);
      if (!next) {
        throw new Error(`Unknown experiment "${id}". Registered: ${[...experiments.keys()].join(', ') || '(none)'}`);
      }
      active?.destroy(ctx);
      active = next;
      next.init(ctx);
    },
    reset(ctx: ExperimentContext): void {
      if (!active) return;
      active.reset(ctx);
      emitter?.emit('EXPERIMENT_RESET', { id: active.id });
    },
  };
}
```

**Step 5: Verify it passes**

```bash
npx vitest run src/core/experiments/registry.test.ts   # expect 8 passed
```

**Step 6: Commit**

```bash
git add src/core/experiments
git commit -m "feat(core): experiment registry with explicit destroy-before-init and reset lifecycle"
```

---

## Task 7: Asset registry wired to the existing schema (TDD)

The repo already ships `schemas/asset-registry.schema.json`. This task makes gameplay code resolve stable `asset_id`s and adds a validation gate that runs in CI, not by hand.

**Files:**
- Create: `src/core/assets/asset-registry.ts`, `src/core/assets/asset-registry.test.ts`
- Create: `scripts/validate-contracts.mjs`
- Create: `assets/registry/assets.json`
- Modify: `package.json` — add the `validate:contracts` script (Step 5b)

**Step 1: Write the failing test**

```typescript
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createAssetRegistry } from './asset-registry.ts';

const registry = JSON.parse(readFileSync('assets/registry/assets.json', 'utf8'));

describe('createAssetRegistry', () => {
  it('resolves a registered id to its entry', () => {
    const r = createAssetRegistry(registry.assets);
    expect(r.resolve('character.hero.placeholder').kind).toBe('character');
  });

  it('falls back through fallback_asset_id when an entry is missing', () => {
    const r = createAssetRegistry([
      { asset_id: 'a', kind: 'prop', path: 'x', format: 'primitive', status: 'placeholder', version: '0.1.0', source: 's', license: 'l', provenance: 'p', fallback_asset_id: 'b' },
      { asset_id: 'b', kind: 'prop', path: 'y', format: 'primitive', status: 'placeholder', version: '0.1.0', source: 's', license: 'l', provenance: 'p', fallback_asset_id: null },
    ]);
    expect(r.resolveOrFallback('a').asset_id).toBe('a');
    expect(r.resolveOrFallback('missing', 'a').asset_id).toBe('a');
  });

  it('throws with the known-ids list rather than returning undefined', () => {
    const r = createAssetRegistry(registry.assets);
    expect(() => r.resolve('nope')).toThrow(/nope/);
  });

  it('detects a fallback cycle instead of hanging', () => {
    const r = createAssetRegistry([
      { asset_id: 'a', kind: 'prop', path: 'x', format: 'primitive', status: 'placeholder', version: '0.1.0', source: 's', license: 'l', provenance: 'p', fallback_asset_id: 'b' },
      { asset_id: 'b', kind: 'prop', path: 'y', format: 'primitive', status: 'placeholder', version: '0.1.0', source: 's', license: 'l', provenance: 'p', fallback_asset_id: 'a' },
    ]);
    expect(() => r.resolveOrFallback('missing', 'a')).not.toThrow();
  });

  it('every registry entry declares a resolvable fallback or null', () => {
    const ids = new Set(registry.assets.map((a: { asset_id: string }) => a.asset_id));
    for (const a of registry.assets) {
      if (a.fallback_asset_id !== null) expect(ids.has(a.fallback_asset_id)).toBe(true);
    }
  });
});
```

**Step 2: Run and verify failure**

```bash
npx vitest run src/core/assets/asset-registry.test.ts
```

**Step 3: Write `assets/registry/assets.json`**

Primitives are registry entries with status `placeholder`, per mission §6 I. Extend the existing `assets.example.json` set — do not replace it.

```json
{
  "assets": [
    {
      "asset_id": "character.hero.placeholder",
      "kind": "character",
      "path": "primitive:capsule",
      "format": "primitive",
      "status": "placeholder",
      "version": "0.1.0",
      "source": "engine primitive",
      "license": "project-owned",
      "provenance": "PlayCanvas render primitive; not final art",
      "fallback_asset_id": null
    },
    {
      "asset_id": "environment.test.ground",
      "kind": "environment",
      "path": "primitive:box",
      "format": "primitive",
      "status": "placeholder",
      "version": "0.1.0",
      "source": "engine primitive",
      "license": "project-owned",
      "provenance": "PlayCanvas render primitive; not final art",
      "fallback_asset_id": null
    },
    {
      "asset_id": "environment.test.crate",
      "kind": "prop",
      "path": "primitive:box",
      "format": "primitive",
      "status": "placeholder",
      "version": "0.1.0",
      "source": "engine primitive",
      "license": "project-owned",
      "provenance": "PlayCanvas render primitive; not final art",
      "fallback_asset_id": "environment.test.ground"
    }
  ]
}
```

**Step 4: Implement `src/core/assets/asset-registry.ts`**

```typescript
export interface AssetEntry {
  asset_id: string;
  kind: string;
  path: string;
  format: string;
  status: 'placeholder' | 'candidate' | 'approved_for_prototype';
  version: string;
  source: string;
  license: string;
  provenance: string;
  fallback_asset_id: string | null;
}

export function createAssetRegistry(entries: readonly AssetEntry[]) {
  const byId = new Map(entries.map((e) => [e.asset_id, e]));

  function resolve(id: string): AssetEntry {
    const entry = byId.get(id);
    if (!entry) throw new Error(`Unknown asset_id "${id}". Known: ${[...byId.keys()].join(', ')}`);
    return entry;
  }

  function resolveOrFallback(id: string, fallbackId?: string): AssetEntry {
    const seen = new Set<string>();
    let current: string | undefined = byId.has(id) ? id : fallbackId;
    while (current && !seen.has(current)) {
      seen.add(current);
      const entry = byId.get(current);
      if (entry) return entry;
      current = undefined;
    }
    throw new Error(`Unresolvable asset "${id}" (fallback "${fallbackId ?? 'none'}").`);
  }

  return { resolve, resolveOrFallback, ids: () => [...byId.keys()] };
}
```

**Step 5: Write `scripts/validate-contracts.mjs`**

Replaces the ad-hoc `uv run --with jsonschema` invocation with a repo-native gate. Extend the `PAIRS` list when a new contract lands.

```javascript
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

const pairs = [
  ['schemas/experiment.schema.json', 'experiments/_template/experiment.json'],
  ['schemas/asset-registry.schema.json', 'assets/registry/assets.example.json'],
  ['schemas/asset-registry.schema.json', 'assets/registry/assets.json'],
];

// Every creature concept profile, if the addendum's schema is present.
if (existsSync('schemas/creature-concept.schema.json') && existsSync('concepts/creatures')) {
  for (const f of readdirSync('concepts/creatures').filter((f) => f.endsWith('.json'))) {
    pairs.push(['schemas/creature-concept.schema.json', join('concepts/creatures', f)]);
  }
}

let failed = 0;
for (const [schemaPath, docPath] of pairs) {
  const validate = ajv.compile(read(schemaPath));
  if (validate(read(docPath))) {
    console.log(`valid: ${docPath}`);
  } else {
    failed += 1;
    console.error(`INVALID: ${docPath}`);
    for (const err of validate.errors ?? []) console.error(`  ${err.instancePath || '/'} ${err.message}`);
  }
}
console.log(`${pairs.length - failed}/${pairs.length} documents valid`);
process.exit(failed === 0 ? 0 : 1);
```

**Step 5b: Register the npm script — not before now**

Only now does `package.json` gain the entry, because only now does its target exist. Add to `scripts`:

```json
"validate:contracts": "node scripts/validate-contracts.mjs"
```

Registering it earlier advertises a command that exits 1 with `MODULE_NOT_FOUND` — a knowingly dead gate, and exactly the kind of "green by assertion" surface this plan exists to prevent. Verify the script is absent from `package.json` in every task before this one.

**Step 6: Run both**

```bash
npx vitest run src/core/assets/asset-registry.test.ts
npm run validate:contracts; echo "EXIT=$?"
```
Expected: 5 unit tests passed; validator prints one `valid:` line per document and `EXIT=0`.

**Step 7: Commit**

```bash
git add src/core/assets scripts/validate-contracts.mjs assets/registry/assets.json package.json
git commit -m "feat(core): asset registry resolver with fallback chain and a repo-native schema gate"
```

---

## Task 8: Third-person player and camera

Use the official `ThirdPersonController` — it is shipped in the npm package, it is 968 lines of solved problems (ground raycast, camera wall-avoidance, pointer lock, gamepad), and mission §11 forbids building a final movement system.

**Files:**
- Create: `src/runtime/player/third-person.ts`
- Modify: `src/main.ts`

**Step 1: Write `src/runtime/player/third-person.ts`**

```typescript
import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { AppBase } from 'playcanvas';
import { ThirdPersonController } from 'playcanvas/scripts/esm/third-person-controller.mjs';

export interface PlayerRig { player: Entity; camera: Entity; controller: unknown }

/**
 * ThirdPersonController requirements, verified against the v2.21.4 source:
 *  - the `camera` attribute is REQUIRED; initialize() throws without it;
 *  - the camera MUST be a top-level entity, not a child of the character;
 *  - it auto-adds a capsule collision {radius: 0.5, height: 2} and a dynamic
 *    rigidbody {mass: 100, angularFactor: Vec3.ZERO} if they are absent.
 */
export function createPlayerRig(app: AppBase, spawn: Vec3, tunables: { get(key: string): number }): PlayerRig {
  const camera = new Entity('camera');
  camera.addComponent('camera', { clearColor: new Color(0.48, 0.72, 0.9), farClip: 500 });
  app.root.addChild(camera); // top-level, NOT parented to the player

  const bodyMaterial = new StandardMaterial();
  bodyMaterial.diffuse = new Color(0.85, 0.78, 0.6);
  bodyMaterial.update();

  const player = new Entity('player');
  player.setPosition(spawn);
  player.addComponent('collision', { type: 'capsule', radius: 0.5, height: 2 });
  player.addComponent('rigidbody', {
    type: 'dynamic', mass: 100, linearDamping: 0, angularDamping: 0,
    angularFactor: Vec3.ZERO, friction: 0.5, restitution: 0,
  });

  // Visible placeholder capsule as a child, so the controller can turn the model
  // independently of the physics body.
  const model = new Entity('player-model');
  model.addComponent('render', { type: 'capsule', material: bodyMaterial });
  player.addChild(model);
  app.root.addChild(player);

  player.addComponent('script');
  const controller = player.script?.create(ThirdPersonController, {
    properties: {
      camera,
      characterModel: model,
      speedGround: tunables.get('player.walkSpeed') * 10,
      sprintMult: tunables.get('player.sprintSpeed') / Math.max(tunables.get('player.walkSpeed'), 0.001),
      jumpForce: tunables.get('player.jumpForce'),
      cameraDistance: tunables.get('camera.distance'),
      lookSens: tunables.get('camera.sensitivity'),
      // Action-adventure framing, not shooter over-the-shoulder (mission §6 C).
      initialPitch: 20, pitchMin: -30, pitchMax: 75, cameraHeight: 1.4,
    },
  });

  return { player, camera, controller };
}
```

**Step 2: Wire live tunables**

Subscribe to the tunables store and push changes onto the controller instance so the inspector sliders take effect without a reload:

```typescript
tunables.subscribe((key, value) => {
  const c = controller as Record<string, number>;
  if (key === 'player.walkSpeed') c.speedGround = value * 10;
  if (key === 'player.jumpForce') c.jumpForce = value;
  if (key === 'camera.distance') c.cameraDistance = value;
  if (key === 'camera.sensitivity') c.lookSens = value;
});
```

**Step 3: Verify it moves — manually first**

```bash
npm run dev
```
WASD moves, mouse orbits (click to acquire pointer lock), Space jumps, Shift sprints. The camera must not clip through the ground.

**Step 4: Extend the smoke test with a movement-delta assertion**

Add to `e2e/smoke.spec.ts`. Synthetic keyboard input into a pointer-locked canvas is unreliable, so drive it through the same test hook the mission explicitly permits (§7) — and keep the manual gate as the real proof.

```typescript
test('synthetic movement produces a position delta', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => '__protolab' in window);
  const before = await page.evaluate(() => (window as never as Record<string, any>).__protolab.playerPosition());
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => (window as never as Record<string, any>).__protolab.playerPosition());
  const delta = Math.hypot(after.x - before.x, after.z - before.z);
  expect(delta, `player did not move: ${JSON.stringify({ before, after })}`).toBeGreaterThan(0.5);
});
```

If keyboard events do not reach the controller, expose `__protolab.stepForward(seconds)` on the window that drives the controller's input state directly, and use that instead. Document which of the two you used.

**Step 5: Run the gates**

```bash
npm run typecheck && npm run lint && npm run boundaries && npm run e2e
```

**Step 6: Commit**

```bash
git add src/runtime/player src/main.ts e2e/smoke.spec.ts
git commit -m "feat(runtime): third-person player rig with the official ESM controller and live tunables"
```

---

## Task 9: Playground experiment

Mission §6 D: ground, several obstacles, a ramp/height change, at least one dynamic rigidbody, lighting, orientation landmarks. Primitives only — explicitly not an Avaloria world.

**Files:**
- Create: `experiments/playground/experiment.json`, `experiments/playground/index.ts`

**Step 1: Write `experiments/playground/experiment.json`**

Copy from `experiments/_template/experiment.json` and fill it in. It must validate against `schemas/experiment.schema.json` (`additionalProperties: false`, so no extra keys).

```json
{
  "id": "playground",
  "title": "Neutral runtime playground",
  "hypothesis": "A neutral primitive playground is sufficient to verify movement, camera, collision, gravity and reset without any Avaloria content.",
  "design_status": "TENTATIVE",
  "source_refs": ["MLOA:32604163#Stufe-4-Playground"],
  "runtime_adapter": "playcanvas-2.21.4",
  "mechanics": ["movement", "camera", "collision", "reset"],
  "assets": ["character.hero.placeholder", "environment.test.ground", "environment.test.crate"],
  "tunables": {
    "player.walkSpeed": 5,
    "player.sprintSpeed": 8,
    "player.jumpForce": 600,
    "camera.distance": 5,
    "camera.sensitivity": 0.15
  },
  "success_signals": [
    "Player walks, sprints and jumps over the ramp without falling through the ground.",
    "A dynamic crate reacts visibly when the player pushes it.",
    "Reset returns the player and every crate to the spawn state."
  ],
  "kill_criteria": [
    "Movement or camera is unusable enough that gameplay observations cannot be made.",
    "Physics stepping is not running (a dynamic body never falls)."
  ],
  "reset_strategy": "Teleport the player to spawn, zero its velocity, and rebuild every dynamic prop at its initial transform. No backend state involved."
}
```

**Step 2: Validate it before writing any code**

```bash
npm run validate:contracts
```
Expected: includes `valid: experiments/playground/experiment.json` once you add that pair to `scripts/validate-contracts.mjs` (add a glob over `experiments/*/experiment.json`).

**Step 3: Write `experiments/playground/index.ts`**

Implements the `Experiment` interface. Records the initial transform of every dynamic prop at `init` so `reset` is deterministic.

```typescript
import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { Experiment, ExperimentContext } from '../../src/core/experiments/types.ts';
import type { SceneContext } from '../../src/runtime/scene-context.ts';

interface Restorable { entity: Entity; position: Vec3; }

const material = (r: number, g: number, b: number) => {
  const m = new StandardMaterial();
  m.diffuse = new Color(r, g, b);
  m.update();
  return m;
};

export function createPlaygroundExperiment(): Experiment {
  let root: Entity | null = null;
  let restorables: Restorable[] = [];
  const SPAWN = new Vec3(0, 1.2, 0);

  return {
    id: 'playground',
    tunables: { 'player.walkSpeed': 5, 'player.sprintSpeed': 8, 'player.jumpForce': 600, 'camera.distance': 5, 'camera.sensitivity': 0.15 },

    init(ctx: ExperimentContext) {
      const scene = ctx.scene as SceneContext;
      root = new Entity('playground');
      scene.app.root.addChild(root);
      restorables = [];

      const ground = new Entity('ground');
      ground.setLocalScale(40, 0.4, 40);
      ground.setPosition(0, -0.2, 0);
      ground.addComponent('render', { type: 'box', material: material(0.22, 0.38, 0.2) });
      ground.addComponent('collision', { type: 'box', halfExtents: new Vec3(20, 0.2, 20) });
      ground.addComponent('rigidbody', { type: 'static' });
      root.addChild(ground);

      // Ramp — a rotated static box, so the ground check has a real slope to handle.
      const ramp = new Entity('ramp');
      ramp.setLocalScale(6, 0.4, 10);
      ramp.setPosition(9, 1.2, -4);
      ramp.setEulerAngles(-14, 0, 0);
      ramp.addComponent('render', { type: 'box', material: material(0.45, 0.42, 0.38) });
      ramp.addComponent('collision', { type: 'box', halfExtents: new Vec3(3, 0.2, 5) });
      ramp.addComponent('rigidbody', { type: 'static' });
      root.addChild(ramp);

      // Static obstacles.
      for (const [x, z, h] of [[-6, -6, 2], [-9, 3, 3], [5, 7, 1.5], [12, 5, 4]] as const) {
        const block = new Entity(`obstacle-${x}-${z}`);
        block.setLocalScale(2, h, 2);
        block.setPosition(x, h / 2, z);
        block.addComponent('render', { type: 'box', material: material(0.5, 0.45, 0.4) });
        block.addComponent('collision', { type: 'box', halfExtents: new Vec3(1, h / 2, 1) });
        block.addComponent('rigidbody', { type: 'static' });
        root.addChild(block);
      }

      // Orientation landmarks: coloured pillars at the cardinal directions.
      const marks: Array<[number, number, [number, number, number]]> = [
        [0, -18, [0.8, 0.2, 0.2]], [0, 18, [0.2, 0.4, 0.8]],
        [-18, 0, [0.85, 0.75, 0.2]], [18, 0, [0.2, 0.7, 0.4]],
      ];
      for (const [x, z, rgb] of marks) {
        const pillar = new Entity(`landmark-${x}-${z}`);
        pillar.setLocalScale(1, 8, 1);
        pillar.setPosition(x, 4, z);
        pillar.addComponent('render', { type: 'cylinder', material: material(...rgb) });
        root.addChild(pillar);
      }

      // Dynamic props — proof that physics is stepping.
      for (const [x, z] of [[2, -3], [3.2, -3.6], [2.6, -4.4]] as const) {
        const crate = new Entity(`crate-${x}-${z}`);
        const position = new Vec3(x, 3, z);
        crate.setPosition(position);
        crate.addComponent('render', { type: 'box', material: material(0.65, 0.5, 0.3) });
        crate.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.5, 0.5, 0.5) });
        crate.addComponent('rigidbody', { type: 'dynamic', mass: 8, friction: 0.6, restitution: 0.1 });
        root.addChild(crate);
        restorables.push({ entity: crate, position: position.clone() });
      }

      const key = new Entity('key-light');
      key.addComponent('light', { type: 'directional', intensity: 2.4, castShadows: true, shadowDistance: 60, shadowBias: 0.2, normalOffsetBias: 0.05 });
      key.setEulerAngles(48, 34, 0);
      root.addChild(key);

      scene.movePlayerTo(SPAWN);
    },

    reset(ctx: ExperimentContext) {
      const scene = ctx.scene as SceneContext;
      for (const { entity, position } of restorables) {
        entity.rigidbody?.teleport(position);
        // linearVelocity/angularVelocity silently no-op on non-dynamic bodies —
        // these are dynamic, so this is the correct way to stop them dead.
        if (entity.rigidbody) {
          entity.rigidbody.linearVelocity = Vec3.ZERO;
          entity.rigidbody.angularVelocity = Vec3.ZERO;
        }
      }
      scene.movePlayerTo(SPAWN);
    },

    destroy() {
      root?.destroy();
      root = null;
      restorables = [];
    },
  };
}
```

**Step 4: Play it**

```bash
npm run dev
```
Walk the ramp. Push a crate. Confirm the landmarks make orientation obvious.

**Step 5: Run the gates and commit**

```bash
npm run typecheck && npm run lint && npm run boundaries && npm test && npm run validate:contracts
git add experiments/playground
git commit -m "feat(experiments): neutral playground with ramp, obstacles, landmarks and dynamic props"
```

---

## Task 10: Debug inspector

Mission §6 F, first-class. DOM overlay, not game UI.

**Files:**
- Create: `src/core/debug/inspector-state.ts`, `src/core/debug/inspector-state.test.ts`
- Create: `src/runtime/debug/inspector.ts`

**Step 1: TDD the formatting logic in core (no DOM)**

`src/core/debug/inspector-state.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { formatInspector } from './inspector-state.ts';

describe('formatInspector', () => {
  it('rounds position to 2 decimals so the overlay does not jitter', () => {
    const out = formatInspector({ experimentId: 'playground', position: { x: 1.23456, y: 0.5, z: -3.9999 }, speed: 4.567, movementState: 'jog', fps: 59.6 });
    expect(out.position).toBe('1.23, 0.50, -4.00');
  });

  it('renders fps as an integer', () => {
    expect(formatInspector({ experimentId: 'x', position: { x: 0, y: 0, z: 0 }, speed: 0, movementState: 'idle', fps: 59.6 }).fps).toBe('60');
  });

  it('shows a placeholder when no experiment is loaded', () => {
    expect(formatInspector({ experimentId: null, position: { x: 0, y: 0, z: 0 }, speed: 0, movementState: 'idle', fps: 0 }).experimentId).toBe('(none)');
  });
});
```

**Step 2: Run, verify failure, implement**

```typescript
export interface InspectorSnapshot {
  experimentId: string | null;
  position: { x: number; y: number; z: number };
  speed: number;
  movementState: 'idle' | 'walk' | 'jog';
  fps: number;
}

export function formatInspector(s: InspectorSnapshot) {
  const f = (n: number) => n.toFixed(2);
  return {
    experimentId: s.experimentId ?? '(none)',
    position: `${f(s.position.x)}, ${f(s.position.y)}, ${f(s.position.z)}`,
    speed: f(s.speed),
    movementState: s.movementState,
    fps: String(Math.round(s.fps)),
  };
}
```

**Step 3: Build the DOM overlay in `src/runtime/debug/inspector.ts`**

Three sections (EXPERIMENT with a reset button, PLAYER, RUNTIME) plus one `<input type="range">` per tunable descriptor, wired to `tunables.set`. Update it on the app's `update` event, throttled to ~10 Hz so slider drags stay responsive. **Do not** rebuild the slider list every frame — `_setComplexProperty` on particle systems triggers a full emitter rebuild, and the same "cheap to read, expensive to write" rule applies here.

**Step 4: Verify visually, run gates, commit**

```bash
npm run dev            # confirm live values and working sliders
npm run typecheck && npm run lint && npm run boundaries && npm test
git add src/core/debug src/runtime/debug
git commit -m "feat: debug inspector overlay with live tunable sliders and reset control"
```

---

## Task 11: Reset and replay wired end to end

**Files:**
- Modify: `src/shell/bootstrap.ts` (create if absent), `src/runtime/scene-context.ts`

**Step 0: Confirm the shell boundary rule is in place**

`src/shell/` is created here for the first time. Task 2b added `shell-is-the-only-composition-root` to `.dependency-cruiser.cjs`; confirm it exists before writing shell code, so the composition root is policed by dependency-cruiser and not only by ESLint boundaries (which was measured silently passing on extensionless imports).

```bash
grep -c 'shell-is-the-only-composition-root' .dependency-cruiser.cjs   # expect 1
npm run boundaries; echo "EXIT=$?"                                      # expect 0
```

**Step 1: Wire the reset path**

Reset button and the `R` key both call `registry.reset(ctx)`, which calls the active experiment's `reset` and emits `EXPERIMENT_RESET`. Player reset must zero the rigidbody velocities and `teleport()` — setting the transform alone on a dynamic body leaves momentum intact.

**Step 2: Add a reset assertion to the smoke test**

```typescript
test('reset restores the spawn state', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => '__protolab' in window);
  await page.evaluate(() => (window as never as Record<string, any>).__protolab.teleportPlayer(9, 1, 9));
  await page.evaluate(() => (window as never as Record<string, any>).__protolab.reset());
  await page.waitForTimeout(300);
  const p = await page.evaluate(() => (window as never as Record<string, any>).__protolab.playerPosition());
  expect(Math.hypot(p.x, p.z)).toBeLessThan(0.5);
});
```

**Step 3: Run and commit**

```bash
npm run e2e
git add src/shell src/runtime/scene-context.ts e2e/smoke.spec.ts
git commit -m "feat: deterministic experiment reset via keyboard and inspector"
```

---

## Task 12: Creature concept loader (TDD)

Inputs come from PR #1: `schemas/creature-concept.schema.json` and `concepts/creatures/{mugosh,flammenwolf,veras,zhalm}.json`. If PR #1 was not merged (Task 0 Route A skipped), **stop and resolve that first** — do not re-author the profiles.

**Files:**
- Create: `src/core/concepts/creature-concepts.ts`, `src/core/concepts/creature-concepts.test.ts`

**Step 1: Write the failing test**

```typescript
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createConceptRegistry } from './creature-concepts.ts';

const profiles = readdirSync('concepts/creatures')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join('concepts/creatures', f), 'utf8')));

describe('creature concepts', () => {
  it('ships exactly the four addendum profiles', () => {
    expect(profiles.map((p) => p.id).sort()).toEqual(['flammenwolf', 'mugosh', 'veras', 'zhalm']);
  });

  it('resolves a profile by id', () => {
    expect(createConceptRegistry(profiles).get('mugosh').display_name).toBe('Mugosh');
  });

  it('every profile declares at least one source ref and one non-goal', () => {
    for (const p of profiles) {
      expect(p.source_refs.length, p.id).toBeGreaterThan(0);
      expect(p.non_goals.length, p.id).toBeGreaterThan(0);
    }
  });

  it('exposes the visual layers the gallery must be able to render', () => {
    const layers = new Set(profiles.flatMap((p) => p.visual_layers));
    for (const required of ['geometry', 'material', 'emissive', 'light']) expect(layers.has(required)).toBe(true);
  });

  it('preserves the Zhalm naming CONFLICT rather than resolving it in code', () => {
    expect(profiles.find((p) => p.id === 'zhalm')?.design_status).toBe('CONFLICT');
  });
});
```

**Step 2: Run, verify failure, implement a typed loader mirroring the schema**

**Step 3: Confirm the contract validator covers the profiles**

```bash
npm run validate:contracts
```
Expected: four additional `valid: concepts/creatures/*.json` lines (the script from Task 7 globs them automatically once the schema exists).

**Step 4: Commit**

```bash
git add src/core/concepts
git commit -m "feat(core): typed creature-concept registry over the addendum profiles"
```

---

## Task 13: FX kit

The reusable visual primitives the gallery needs. This is `src/runtime/fx/` — engine-facing, no unit tests, proven by the gallery and the manual gate.

**Files:**
- Create: `src/runtime/fx/emissive.ts`, `src/runtime/fx/particles.ts`, `src/runtime/fx/trail.ts`, `src/runtime/fx/atmosphere.ts`, `src/runtime/fx/post.ts`

**Step 1: `emissive.ts` — emissive and transparency**

```typescript
import { BLEND_ADDITIVEALPHA, BLEND_NORMAL, Color, StandardMaterial } from 'playcanvas';

/** emissiveIntensity is the HDR lever — values above 1 are what actually bloom. */
export function emissiveMaterial(color: Color, intensity: number): StandardMaterial {
  const m = new StandardMaterial();
  m.diffuse = Color.BLACK;
  m.emissive = color;
  m.emissiveIntensity = intensity;
  m.update();
  return m;
}

/**
 * opacity alone does nothing — blendType must leave BLEND_NONE, and
 * semi-transparent surfaces almost always want depthWrite = false.
 */
export function translucentMaterial(color: Color, opacity: number, additive = false): StandardMaterial {
  const m = new StandardMaterial();
  m.diffuse = color;
  m.opacity = opacity;
  m.blendType = additive ? BLEND_ADDITIVEALPHA : BLEND_NORMAL;
  m.depthWrite = false;
  m.update();
  return m;
}
```

**Step 2: `particles.ts` — particle helper**

```typescript
import { Curve, CurveSet, EMITTERSHAPE_SPHERE, Entity, Vec3 } from 'playcanvas';

export interface ParticleSpec {
  numParticles: number;
  lifetime: number;
  /** Seconds BETWEEN births, not particles per second. Smaller = more particles. */
  rate: number;
  rate2?: number;
  emitterRadius: number;
  colorCurve: number[][];
  alphaCurve: number[];
  scaleCurve: number[];
  velocity: Vec3;
}

export function addParticles(parent: Entity, name: string, spec: ParticleSpec): Entity {
  const e = new Entity(name);
  e.addComponent('particlesystem', {
    numParticles: spec.numParticles,
    lifetime: spec.lifetime,
    rate: spec.rate,
    rate2: spec.rate2 ?? spec.rate,
    emitterShape: EMITTERSHAPE_SPHERE,
    emitterRadius: spec.emitterRadius,
    colorGraph: new CurveSet(spec.colorCurve),
    alphaGraph: new Curve(spec.alphaCurve),
    scaleGraph: new Curve(spec.scaleCurve),
    localVelocityGraph: new CurveSet([[0, spec.velocity.x], [0, spec.velocity.y], [0, spec.velocity.z]]),
    autoPlay: true,
    loop: true,
  });
  parent.addChild(e);
  return e;
}
```
Curves take **flat** arrays of alternating time/value pairs: `new Curve([0, 0, 0.5, 1, 1, 0])`.

**Step 3: `trail.ts` — trail via WideLine**

There is no trail renderer in 2.21.4. `WideLine` + `WideLineRenderer` with `widthUnits = LINEWIDTH_WORLD` gives camera-facing world-unit ribbons in one draw call. **Alpha is ignored** — fade by driving RGB toward black or per-point width to 0. Keep a separate renderer instance for frequently-updated trails, because any change dirties the whole renderer.

**Step 4: `atmosphere.ts` — fog**

```typescript
import { FOG_EXP2, Color } from 'playcanvas';
import type { AppBase } from 'playcanvas';

/** scene.fog has NO setter — mutate the FogParams object it returns. */
export function setFog(app: AppBase, color: Color, density: number): void {
  app.scene.fog.type = FOG_EXP2;
  app.scene.fog.color = color;
  app.scene.fog.density = density;
}
```

**Step 5: `post.ts` — restrained bloom**

```typescript
import { CameraFrame, PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F, TONEMAP_ACES2 } from 'playcanvas';
import type { AppBase, CameraComponent } from 'playcanvas';

/**
 * Bloom in 2.21.4 has NO `enabled` and NO `threshold`: the engine's own check is
 * `options.bloomEnabled = bloom.intensity > 0`. It also REQUIRES an HDR render
 * format — with PIXELFORMAT_RGBA8 it silently self-disables. Engine examples use
 * 0.01–0.035 for restrained bloom.
 */
export function createPostChain(app: AppBase, camera: CameraComponent, bloomIntensity = 0.02): CameraFrame {
  const frame = new CameraFrame(app, camera);
  frame.rendering.renderFormats = [PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F];
  frame.rendering.toneMapping = TONEMAP_ACES2;
  frame.rendering.samples = 4;
  frame.bloom.intensity = bloomIntensity;
  frame.bloom.blurLevel = 16;
  frame.update(); // mandatory after ANY property change
  return frame;
}
```

**Step 6: Verify each piece renders, then commit**

```bash
npm run dev   # temporarily attach each helper to the playground and look at it
npm run typecheck && npm run lint && npm run boundaries
git add src/runtime/fx
git commit -m "feat(runtime): FX kit — emissive, transparency, particles, WideLine trails, fog, restrained bloom"
```

---

## Task 14: Creature FX gallery experiment

Addendum §3: an isolated gallery mode driven by `concepts/creatures/*.json`. A design instrument, not game UI — and explicitly **not** a creature framework (addendum §5: no `BaseCreature`, no universal AI, no ability system).

**Files:**
- Create: `experiments/creature-fx-gallery/experiment.json`, `experiments/creature-fx-gallery/index.ts`

**Step 1: Write and validate the experiment contract**

`source_refs` must include `MLOA:32735234` (the bestiary page). `design_status`: `TENTATIVE`.

**Step 2: Build the gallery scene**

Four pedestals in a row, each holding one profile's placeholder, all at player-relative scale so silhouette and scale can be judged. Include a reference capsule at player height next to each. All FX layers must be individually toggleable from the inspector (addendum §3: "reducible/disableable so readability and performance can be compared").

**Step 3: Expose deterministic FX state hooks**

Addendum §6 requires at least one deterministic FX state per profile activatable from a test hook:

```typescript
(window as unknown as Record<string, unknown>).__gallery = {
  ids: () => ['mugosh', 'flammenwolf', 'veras', 'zhalm'],
  setState: (id: string, state: string) => { /* … */ },
  states: (id: string) => { /* … */ },
};
```

**Step 4: Verify, gate, commit**

```bash
npm run validate:contracts && npm run typecheck && npm run lint && npm run boundaries && npm run dev
git add experiments/creature-fx-gallery
git commit -m "feat(experiments): creature FX gallery driven by concept profiles"
```

---

## Task 15: The four creature FX states

Four independent units — parallelizable across subagents. Each is: build the placeholder from primitives, wire its FX layers, expose its states, look at it, commit.

| Profile | Required read (addendum §4 + MLOA 32735234) | FX layers |
|---|---|---|
| **Mugosh** | Powerful quadruped, clearly stronger than the player but **not** a colossus. Horn state switchable `blue neutral → brighter/white allied → deep red hostile`, legible before any AI exists. | emissive horn + local light + restrained bloom |
| **Flammenwolf** | ~1.5× player scale. Fire visible in open mouth/body, ember motion, burn trail while moving, optional short-lived scorch decal. | emissive + particles + WideLine trail + pooled decal mesh + local light |
| **Veras** | Core ≈ player-head-sized, glow may read larger than the core. Translucent white/green, internal luminous particles, soft luminous trail, gentle local light/bloom. Must read benevolent/ethereal, **not** a generic opaque glowing ball. | translucent material (depthWrite false) + inner particles + trail + omni light |
| **Zhalm** | Large plant/root placeholder plus smaller sensor/root nodes. Visible **black-violet pulse travelling across multiple nodes**. Crystallization material preview. Do **not** resolve the Druhen/Zhalm naming conflict in code. | emissive pulse propagating node→node + particles + fog + crystallization material swap |

For each: implement, run `npm run dev`, look at it against the readability goal in its profile's `fx_profile.readability_goal`, then commit as `feat(gallery): <id> concept placeholder and FX states`.

**Guard rail to re-read before each one:** these are four separate scene builders sharing the FX kit. The moment you find yourself writing a shared `Creature` base class, an ability registry, or a state machine that all four inherit, stop — that is exactly what addendum §5 forbids. Duplication across four profiles is correct here.

---

## Task 16: Complete the smoke suite

**Files:** Modify `e2e/smoke.spec.ts`; create `e2e/gallery.spec.ts`

Mission §7 + addendum §6 require the browser smoke to prove:

- app starts, runtime initialises, canvas/scene exists;
- playground loads, no fatal startup errors;
- synthetic movement produces a measurable position delta;
- a dynamic body falls (physics is stepping);
- reset restores spawn state;
- **all four concept ids load without fatal errors**;
- **at least one deterministic FX state per profile is activatable**;
- screenshots saved as artifacts: at least one playground and **one gallery**.

```bash
npm run e2e
```
Report the raw output verbatim. Save `artifacts/screens/playground.png` and `artifacts/screens/creature-gallery.png`.

```bash
git add e2e artifacts/screens
git commit -m "test: browser smoke covering boot, movement, physics, reset and the creature gallery"
```

---

## Task 17: Documentation

**Files:**
- Create: `docs/architecture/ADR-0003-runtime-foundation.md`, `docs/runtime/SETUP.md`, `docs/runtime/VALIDATION.md`
- Modify: `README.md`, `AGENTS.md`, `CLAUDE.md`

**ADR-0003** must record: chosen runtime **and exact version** (`playcanvas@2.21.4`), the alternatives actually examined and why they lost (Babylon.js as documented fallback; Godot/Unity dismissed briefly as editor-centric with no npm/Vite loop and weak agent-iteration/browser-smoke automation — per mission §3.4, no separate research round), the **prototype-only boundary** (exception granted 2026-08-23; does not decide MCL-1, the production engine, or Minecraft vs. standalone; may be discarded entirely), consequences, risks, and review triggers — including the design doc's extra trigger: *if localhost iteration time with PlayCanvas becomes measurably too slow, the adapter is up for review.*

**`docs/runtime/SETUP.md`**: pinned tool versions, install, dev, build, test, e2e, boundaries, contract-validation commands — **only commands you actually ran**.

**`docs/runtime/VALIDATION.md`**: one row per gate with the exact command, the raw result, and `PASS` / `FAIL` / `not_run`. `not_run` is never `passed`.

**`AGENTS.md`**: keep it short. Rules that a linter or test can enforce belong in the linter or the test, not in prose (mission §10).

```bash
git add docs README.md AGENTS.md CLAUDE.md
git commit -m "docs: ADR-0003, verified setup and validation records"
```

---

## Task 18: Fresh-clone gate

Mission §9. The single most commonly faked gate — actually do it, in a separate directory.

```bash
cd /tmp && rm -rf fresh-clone
git clone --branch feat/prototype-runtime-foundation ~/Projects/MCL-protolab fresh-clone
cd fresh-clone
source ~/.nvm/nvm.sh && nvm use
npm install
npm run typecheck && npm run lint && npm run boundaries && npm run validate:contracts && npm test && npm run build
npx playwright install chromium && npm run e2e
npm run dev
```
Every command exactly as written in `docs/runtime/SETUP.md`. If a step needed something the doc does not mention, **the doc is wrong** — fix the doc, then re-run the whole sequence from a clean clone. Report the raw output verbatim.

---

## Task 19: Manual runtime gate

Mission §8. Nine points, executed by hand, with screenshots. A green test suite does not substitute for any of them.

1. Runtime starts locally.
2. Playground is visible.
3. Player is visible.
4. Movement works (WASD, sprint, jump).
5. Camera follows, orbits, and does not clip through geometry.
6. Collision and gravity work — including pushing a dynamic crate.
7. Reset restores the initial state.
8. Inspector shows live data and the sliders change behaviour.
9. Production build runs (`npm run build && npm run preview`).

Plus the addendum §6 gallery gate: the creature/FX gallery is visible, and emissive, particles/trails and lighting/post-effect behaviour can be visually compared. Save `artifacts/screens/manual-playground.png` and `artifacts/screens/manual-gallery.png`.

```bash
git add artifacts/screens
git commit -m "docs: manual runtime evidence screenshots"
```

---

## Task 20: Deliver

**Step 1: Push and open a draft PR**

```bash
git push -u origin feat/prototype-runtime-foundation
gh pr create --repo DYAI2025/MCL-protolab --draft --base master \
  --title "feat: prototype runtime foundation (PlayCanvas 2.21.4)" \
  --body-file docs/runtime/VALIDATION.md
```
No self-merge without explicit authorization (mission §12).

**Step 2: Re-read the remote state**

```bash
gh pr view --repo DYAI2025/MCL-protolab --json number,state,mergeable,headRefName
git log --oneline origin/feat/prototype-runtime-foundation -5
```

**Step 3: Write the final report — exactly the mission §17 sections**

`Runtime Decision` · `Architecture` · `Implementation` · `Commands Executed` (each: command, result, PASS/FAIL/NOT_RUN) · `Runtime Evidence` (really started? player moved? camera/collision/reset checked? screenshot?) · `Validation` · `Git` · `Remaining Risks` · **`Final Status`**: exactly one of `BLOCKED` / `GENERATED` / `STRUCTURALLY_VALID` / `BUILDABLE` / `TESTED` / `RUNTIME_VERIFIED`, plus a one-sentence justification.

Raw output verbatim. If a value differs from what this plan predicted, report the actual value — do not adjust the check to fit.

---

## Definition of Done

Mission §16, unchanged. **Not** done if: only the engine was chosen · only a generator ran · only architecture files exist · the build is green but nothing is playable · the player cannot be controlled · it only runs in a cloud editor · tests were not actually executed.

**Foundation:** runtime chosen + ADR-0003 ▢ · exception documented ▢ · reproducible install ▢ · pins + lockfile ▢ · README current ▢
**Runtime:** starts locally ▢ · playground loads ▢ · player visible ▢ · movement ▢ · camera ▢ · collision/gravity ▢ · reset ▢ · inspector ▢ · tunables ▢
**Architecture:** experiment registry ▢ · template ▢ · asset registry wired ▢ · playground isolated ▢ · no backend dependency ▢ · no universal abstraction ▢
**Quality:** lint ▢ · typecheck ▢ · boundaries ▢ · unit ▢ · build ▢ · smoke ▢ · manual runtime test ▢ · fresh-clone gate ▢
**Gallery (addendum §6):** creature schema + all four profiles validate ▢ · smoke loads all four ids ▢ · one deterministic FX state per profile ▢ · manual visual comparison ▢ · gallery screenshot ▢

**Primary success condition:** a fresh coding agent can open the repo and be handed "build experiment `zhalm-forest-v1`" without reinventing anything — third-person control, camera, input, physics, asset loading, experiment loading, debugging, tunables and reset all already work.
