# Validation record

Local run 2026-08-29 (macOS arm64, Node 24.19.0, branch `feat/prototype-runtime-foundation`). The same chain runs on every push in CI (`.github/workflows/gates.yml`, ubuntu-latest); CI runs for `8b90220` and `238757f` concluded `success` (run IDs 33272639768/33272639759 and 33272726957/33272725407). The deployment slice at runtime-source commit `011caef22686b3396ca84d24d6dd82724f26402a` concluded `success` in run `33316998826`, and its exact image was subsequently checked on the real VPS.

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
| VPS production build | `npm run build` | production build succeeded in CI run `33316998826` and in the observed VPS image build; engine bundle retains the existing chunk-size advisory | PASS |
| VPS preview persistence | `npm run e2e:preview` plus live browser flow | CI passed; a real browser reached the VPS through a temporary SSH tunnel and preserved an identical serialized layout across reload and tab reopen, then export/import restored it in a clean context | PASS |
| VPS container package | `./scripts/smoke-deployment.sh` plus runtime readback | dedicated CI job passed; real VPS container served health/editor/WASM/GLB, returned 404 for a missing path, ran as UID 10001 and recovered healthy after restart | PASS |
| VPS loopback runtime | runbook loopback verification | exact runtime-source image `mcl-protolab-test:011caef` observed healthy at `127.0.0.1:3012`; temporary SSH tunnel removed after browser verification | PASS |
| VPS HTTPS/browser smoke | runbook external verification | planned hostname has no A/AAAA record; TLS and reverse-proxy access control are `not_run` | blocked |

## Red-before-green evidence

- **typecheck**: canary `const broken: number = 'x'` in `e2e/smoke.spec.ts` → `TS2322`, exit 2 (Task 2b) — the gate previously missed it, which is why `e2e` entered `tsconfig.include`.
- **boundaries**: canary `src/core/canary.ts → src/shell/target.ts` → `error shell-is-the-only-composition-root`, exit 1.
- **validate:contracts**: canary `"kind": "not-a-valid-kind"` in `assets/registry/assets.json` → `INVALID … must be equal to one of the allowed values`, exit 1.
- **unit**: every TDD module was run red (module-not-found) before implementation.
- **e2e**: seen red on missing Chromium binary, on synthetic-keyboard movement (led to the documented `stepForward` hook) and on the gallery 30 s timeout (led to the documented 90 s budget).
- **e2e:preview**: initially red because the preview Playwright configuration did not exist; after implementation the local run reached the browser launch and stopped on the missing Chromium binary. CI installs Chromium before executing the preserved gate.
- **deployment container**: the smoke gate exits 127 locally when Docker is unavailable instead of reporting a false pass. Its first Docker-capable CI run failed with `unable to find user caddy`, proving the non-root start assertion caught an invalid image assumption; the runtime now creates an explicit unprivileged `mcl` user. The next run exposed a readiness race between HTTP startup and Docker's first scheduled health probe; the smoke now waits for and diagnoses both states independently.

## Generative World Director slice — MCL-81 … MCL-85

Sprint "MCL Protolab S1 – Director" (Jira 777). Local run 2026-09-23 (macOS arm64, Node 24.19.0) on `feat/mcl-85-zhalm-director-slice@029c951`, the implementation head after the review round. It is stacked on MCL-84 `d15eed5`, MCL-83 `fe567e2`, MCL-82 `e53906b` and MCL-81 `4a6066d`; the story branches carry the review fixes and are merged upward without force-push. CI evidence for each story head: the `gates` and `deployment-container` checks of PRs #5–#9.

| Gate | Command | Raw result | Status |
|---|---|---|---|
| Types | `npm run typecheck` | exit 0 | PASS |
| Lint | `npm run lint` | exit 0, 0 warnings | PASS |
| Import boundaries | `npm run boundaries` | `✔ no dependency violations found (118 modules, 323 dependencies cruised)` | PASS |
| Contracts | `npm run validate:contracts` | `31/31 documents valid` | PASS |
| Unit + integration | `npm test` | `Tests  348 passed (348)`, 31 files | PASS |
| Build | `npm run build` | exit 0; bundle 1,649.55 kB (gzip 435.58 kB) — +50.4 kB gzip against 1,483.67 kB / 385.18 kB before the director (AJV at runtime + slice) | PASS |
| Asset determinism | `npm run generate:assets` + `git diff --exit-code` | empty diff | PASS |
| Browser smoke | `npm run e2e` | `9 passed (3.0m)` — the seven existing specs plus two director specs | PASS |
| Preview | `npm run e2e:preview` | `1 passed` | PASS |
| Fresh clone | clone of the pre-review head `6390c7f` from GitHub → `npm ci` → typecheck, lint, boundaries, contracts, test, build | all exit 0, 320/320 tests — repeated on the final head in CI | PASS |
| Human Play/Design Review | MCL-91, by hand | not executed — no automated test substitutes | not_run |

Red before green: every new unit/integration test file was first run red (module missing). The director e2e first failed on the missing hook (`2 failed`, TimeoutError). The core dependency guard was canaried with a planted `openai` import and a clock call, and after the review with `crypto.randomUUID()`, a dynamic `import ()`, a bare `Date()` and `new  Date ()` — each turned it red.

Review round: an independent read-only review of the whole sprint diff found no blocker and 15 findings (three latent majors). Every finding was reproduced before it was fixed, test-first, on the owning story branch: B1 reset/overlapping runs and fingerprint-based STALE_RUN, B2 redacted storage and display of privacy-rejected proposals, B3 checked ledger appends, B4 failed or exhausted runs no longer silence the director, B5 pulse-driven SENSOR_TRIGGERED, B6 dry run before an accepted selection, B7 one selection_ref per attempt, B8 strictNumbers and non-representable input refused instead of thrown or silently lost, B9 token/address patterns without prose false positives, B10 wider dependency guard, B11 blank source refs, B12 read-only session views, B13 abort-listener cleanup, B14 FAILED for broken input, B15 reason-code coverage from the source and a polling regroup e2e. Deferred with a ticket: checking source refs against the canon projection (belongs to the real provider boundary, MCL-88).

## Evidence artifacts

- `artifacts/screens/playground.png` — playground with player, crates, landmarks, inspector.
- `artifacts/screens/zhalm-director.png` — director slice after a human choice: 3/4 proposals accepted, the Druhen demonstration blocked, applied diff `zhalm.cluster-b.active false → true · revision 1 → 2`, cluster b visible on the entry route.
- `artifacts/screens/creature-gallery.png` — all four concepts with FX states active (mugosh `hostile`, flammenwolf `prowling` + burn trail, veras `drifting`, zhalm `pulse`).
- `docs/architecture/DECISION-2026-08-29-playcanvas-risk-gate.md` — walking-skeleton go/no-go outcome.
- `docs/plans/2026-08-30-world-editor-vps-test-instance.md` — requirements, plan-fidelity review and deployment blocker.
- `docs/architecture/ADR-0004-private-vps-test-instance.md` — bounded static-hosting decision.
- `docs/runtime/VPS_TEST_INSTANCE.md` — deployment, external verification and rollback runbook.
- Jira `MCL-70` and Confluence page `42467332` — tracked-exception scope, exact runtime readback, browser-live evidence and remaining HTTPS blocker.
