# Validation record

Local run 2026-08-29 (macOS arm64, Node 24.19.0, branch `feat/prototype-runtime-foundation`). The same chain runs on every push in CI (`.github/workflows/gates.yml`, ubuntu-latest); CI runs for `8b90220` and `238757f` concluded `success` (run IDs 33272639768/33272639759 and 33272726957/33272725407).

An unexecuted gate is `not_run`, never `passed`. Every gate below was also seen **red at least once** before being trusted green (canary or real failure) — see notes.

| Gate | Command | Raw result | Status |
|---|---|---|---|
| Types | `npm run typecheck` | `tsc -p tsconfig.json` — no output, exit 0 | PASS |
| Lint | `npm run lint` | `eslint .` — no output, exit 0 | PASS |
| Import boundaries | `npm run boundaries` | `✔ no dependency violations found (46 modules, 90 dependencies cruised)` | PASS |
| Contracts | `npm run validate:contracts` | `9/9 documents valid` | PASS |
| Unit | `npm test` | `Tests  32 passed (32)` | PASS |
| Build | `npm run build` | production build succeeds; advisory chunk-size warning (engine bundle, 331 kB gzip) | PASS |
| Browser smoke | `npm run e2e` | boot+physics, movement delta, reset-to-spawn, FX gallery, blockmodel gallery (11 registry loads), world editor (place / save-load roundtrip / play-mode network escalation) — all passing; latest run recorded in CI | PASS |
| CI (full chain on Linux) | push to GitHub | `gates` workflow: success on every push since introduction | PASS |
| Fresh-clone gate | plan Task 18 sequence (clone → `nvm use` → `npm install` → all gates → `npx playwright install chromium` → `npm run e2e` → `npm run dev`) | executed 2026-08-29 in a separate directory: all gates green, e2e `4 passed (22.1s)`, dev server `HTTP 200` for `/` and `/ammo/ammo.wasm.js` | PASS |
| Manual runtime gate (mission §8, 9 points + gallery) | by hand (Ben) | not yet executed — a green test suite does not substitute | not_run |
| VPS production build | `npm run build` | production build succeeded locally on 2026-08-30; engine bundle retains the existing chunk-size advisory | PASS |
| VPS preview persistence | `npm run e2e:preview` | build passed; local Playwright Chromium download timed out, so the browser assertion has not executed here | not_run |
| VPS container package | `./scripts/smoke-deployment.sh` | Docker is unavailable in the current executor; the dedicated CI job is the executable gate | not_run |
| VPS HTTPS/browser smoke | runbook external verification | executor has no reachable/authorized VPS or Coolify path | blocked |

## Red-before-green evidence

- **typecheck**: canary `const broken: number = 'x'` in `e2e/smoke.spec.ts` → `TS2322`, exit 2 (Task 2b) — the gate previously missed it, which is why `e2e` entered `tsconfig.include`.
- **boundaries**: canary `src/core/canary.ts → src/shell/target.ts` → `error shell-is-the-only-composition-root`, exit 1.
- **validate:contracts**: canary `"kind": "not-a-valid-kind"` in `assets/registry/assets.json` → `INVALID … must be equal to one of the allowed values`, exit 1.
- **unit**: every TDD module was run red (module-not-found) before implementation.
- **e2e**: seen red on missing Chromium binary, on synthetic-keyboard movement (led to the documented `stepForward` hook) and on the gallery 30 s timeout (led to the documented 90 s budget).
- **e2e:preview**: initially red because the preview Playwright configuration did not exist; after implementation the local run reached the browser launch and stopped on the missing Chromium binary. CI installs Chromium before executing the preserved gate.
- **deployment container**: the smoke gate exits 127 locally when Docker is unavailable instead of reporting a false pass. GitHub Actions runs the same script on a Docker-capable runner.

## Evidence artifacts

- `artifacts/screens/playground.png` — playground with player, crates, landmarks, inspector.
- `artifacts/screens/creature-gallery.png` — all four concepts with FX states active (mugosh `hostile`, flammenwolf `prowling` + burn trail, veras `drifting`, zhalm `pulse`).
- `docs/architecture/DECISION-2026-08-29-playcanvas-risk-gate.md` — walking-skeleton go/no-go outcome.
- `docs/plans/2026-08-30-world-editor-vps-test-instance.md` — requirements, plan-fidelity review and deployment blocker.
- `docs/architecture/ADR-0004-private-vps-test-instance.md` — bounded static-hosting decision.
- `docs/runtime/VPS_TEST_INSTANCE.md` — deployment, external verification and rollback runbook.
