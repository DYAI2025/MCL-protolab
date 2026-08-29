# Risk-gate outcome: PlayCanvas + Ammo walking skeleton (plan Task 3)

**Date:** 2026-08-29
**Gate:** Implementation-plan Task 3, Step 4 — the go/no-go gate for the PlayCanvas-first decision.

**Evidence (smoke output verbatim):**

```
Running 1 test using 1 worker

  ✓  1 [chromium] › e2e/smoke.spec.ts:8:1 › runtime boots and physics simulates (3.6s)

  1 passed (4.9s)
```

The spec asserts a dynamic rigidbody falls > 0.5 world units within 1 s (`start=6 → end` after settling), zero console errors, zero page errors, and writes `artifacts/screens/skeleton.png` (blue sky, green ground, crate landed on the ground plane with shadow — visually confirmed against the Task 3 Step 5 description).

**Decision: PlayCanvas-first CONFIRMED.**

**Reason:** Ammo loads via `pc.WasmModule` from `public/ammo/` before `app.start()`; physics simulates in headless Chromium under the Playwright harness with no console noise, even against the `vite dev` debug build (the anticipated debug-console-noise failure mode did not materialize; no allowlist or preview-server switch was needed). The full gate chain (`typecheck`, `lint`, `boundaries`, `test`, `build`, `e2e`) exits 0 on commit `bf57c87`.

**Validation:** `npm run e2e` exit 0.

**Scope reminder:** This confirms the *disposable lab runtime* only (Prototype Runtime Exception, mission §1). It is not a production-engine or MCL-1 decision.
