# Agent Instructions - MCL Prototype Lab

1. Read `docs/architecture/ADR-0002-prototype-lab.md` before changing architecture.
2. This repository is a disposable prototype lab, not the production game repository.
3. The Prototype Runtime Exception was granted on 2026-08-23 for this lab only. A selected runtime remains disposable and must never be described as the production-engine or MCL-1 decision.
4. Do not modify DYAI2025/MC_legends as part of prototype work unless separately authorized.
5. Keep new logic experiment-local by default. Promote a mechanic to shared code only after at least two experiments demonstrate the same reusable contract.
6. Every experiment must validate against `schemas/experiment.schema.json` and declare `design_status` plus `source_refs`.
7. Every external or generated asset must be registered with source, license, provenance, status and version before use. Named creature concepts additionally validate against `schemas/creature-concept.schema.json`.
8. No real child names, private submissions, credentials, access codes or service secrets in fixtures, screenshots, logs or assets.
9. No backend, database, cloud service or deployment unless a separate architecture decision justifies it.
10. An unexecuted validation gate is `not_run`, never `passed`.

The active runtime mission is `docs/plans/2026-08-23-runtime-foundation-mission.md` **plus** `docs/plans/2026-08-23-runtime-foundation-audit-addendum.md`. The addendum hardens visual/creature requirements and takes precedence where it is more specific. Older planning JSON/ADR-0002 records are historical evidence when they still say the runtime exception is missing.

The runtime exists (PlayCanvas 2.21.4 — `docs/architecture/ADR-0003-runtime-foundation.md`). Verified setup/dev/gate commands: `docs/runtime/SETUP.md`. Gate results: `docs/runtime/VALIDATION.md`. Import-boundary rules are machine-enforced (`npm run boundaries`, `npm run lint`) — rules a linter or test can enforce live there, not in this file.
