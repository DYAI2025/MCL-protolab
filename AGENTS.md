# Agent Instructions - MCL Prototype Lab

1. Read `docs/architecture/ADR-0002-prototype-lab.md` before changing architecture.
2. This repository is a disposable prototype lab, not the production game repository.
3. Do not select or add a game engine/runtime until MCL-1 or an explicit prototype-runtime exception permits it.
4. Do not modify DYAI2025/MC_legends as part of prototype work unless separately authorized.
5. Keep new logic experiment-local by default. Promote a mechanic to shared code only after at least two experiments demonstrate the same reusable contract.
6. Every experiment must validate against `schemas/experiment.schema.json` and declare `design_status` plus `source_refs`.
7. Every external or generated asset must be registered with source, license, provenance, status and version before use.
8. No real child names, private submissions, credentials, access codes or service secrets in fixtures, screenshots, logs or assets.
9. No backend, database, cloud service or deployment unless a separate architecture decision justifies it.
10. An unexecuted validation gate is `not_run`, never `passed`.

When a runtime adapter is eventually approved, document exact setup, dev, test and smoke commands here only after they have been verified.
