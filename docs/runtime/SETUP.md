# Runtime setup

Every command below was actually run on 2026-08-29 (macOS arm64) and, except `npm run dev`, also runs in CI (`.github/workflows/gates.yml`) on ubuntu-latest.

## Pinned tools

| Tool | Version | Pin |
|---|---|---|
| Node | 24.19.0 | `.nvmrc`, `engines` + `.npmrc engine-strict=true` |
| playcanvas | 2.21.4 | exact in `package.json` |
| vite | 8.2.2 | exact |
| typescript | 6.0.3 | exact (typescript-eslint peer range excludes TS 7) |
| vitest | 4.1.11 | exact |
| @playwright/test | 1.62.1 | exact |
| eslint / typescript-eslint | 10.9.0 / 8.67.0 | exact |
| dependency-cruiser | 18.2.0 | exact |
| ajv | 8.20.0 | exact |

Physics: Ammo.js wasm binaries live in `public/ammo/` with provenance (`SOURCE.md`, zlib `LICENSE`). They are served root-absolute and loaded via `pc.WasmModule` **before** `app.start()` — never through Vite's wasm handling.

## Install

```bash
nvm use              # 24.19.0 — engine-strict blocks npm on older Node
npm install          # npm ci in CI
npx playwright install chromium   # once per machine, and after Playwright upgrades
```

## Develop

```bash
npm run dev          # Vite dev server on http://localhost:5173
                     # /?experiment=playground (default) | /?experiment=creature-fx-gallery
npm run preview      # serve the production build (after npm run build)
```

In the app: WASD moves, click acquires pointer lock for the orbit camera, Space jumps, Shift sprints, `R` (or the inspector button) resets the active experiment. The inspector overlay shows live position/speed/fps and one slider per tunable; the gallery adds per-layer FX toggles.

## Gates

```bash
npm run typecheck            # tsc across src, experiments, e2e, configs
npm run lint                 # eslint (includes boundaries plugin)
npm run boundaries           # dependency-cruiser import rules
npm run validate:contracts   # ajv: schemas vs experiment/asset/creature documents
npm test                     # vitest unit suite (src/core)
npm run build                # tsc + vite production build
npm run e2e                  # Playwright smoke (starts its own dev server on :5173)
```

Run a single unit test: `npx vitest run src/core/events/emitter.test.ts`.
Run a single e2e spec: `npx playwright test e2e/gallery.spec.ts`.

Smoke evidence lands in `artifacts/screens/` (`playground.png`, `creature-gallery.png`); Playwright traces for failures in `artifacts/test-results/`.
