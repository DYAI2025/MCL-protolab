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
| Browser smoke | `npm run e2e` | `4 passed (31.4s)` — boot+physics, movement delta, reset-to-spawn, gallery (4 concept ids + one deterministic FX state each) | PASS |
| CI (full chain on Linux) | push to GitHub | `gates` workflow: success on every push since introduction | PASS |
| Fresh-clone gate | plan Task 18 sequence | not yet executed | not_run |
| Manual runtime gate (mission §8, 9 points + gallery) | by hand | not yet executed | not_run |

## Red-before-green evidence

- **typecheck**: canary `const broken: number = 'x'` in `e2e/smoke.spec.ts` → `TS2322`, exit 2 (Task 2b) — the gate previously missed it, which is why `e2e` entered `tsconfig.include`.
- **boundaries**: canary `src/core/canary.ts → src/shell/target.ts` → `error shell-is-the-only-composition-root`, exit 1.
- **validate:contracts**: canary `"kind": "not-a-valid-kind"` in `assets/registry/assets.json` → `INVALID … must be equal to one of the allowed values`, exit 1.
- **unit**: every TDD module was run red (module-not-found) before implementation.
- **e2e**: seen red on missing Chromium binary, on synthetic-keyboard movement (led to the documented `stepForward` hook) and on the gallery 30 s timeout (led to the documented 90 s budget).

## Evidence artifacts

- `artifacts/screens/playground.png` — playground with player, crates, landmarks, inspector.
- `artifacts/screens/creature-gallery.png` — all four concepts with FX states active (mugosh `hostile`, flammenwolf `prowling` + burn trail, veras `drifting`, zhalm `pulse`).
- `docs/architecture/DECISION-2026-08-29-playcanvas-risk-gate.md` — walking-skeleton go/no-go outcome.
