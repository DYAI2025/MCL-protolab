# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

The **disposable gameplay-prototyping lab** for MC Legends / Legends of Avaloria (`DYAI2025/MCL-protolab`). Current state: concept foundation (contracts, JSON schemas, architecture records) plus an approved design and mission for building the prototype runtime — see `docs/plans/2026-08-23-runtime-foundation-design.md` and `docs/plans/2026-08-23-runtime-foundation-mission.md`. Until the mission is executed there is no application code, no build, and no test suite.

Read `AGENTS.md` and `docs/architecture/ADR-0002-prototype-lab.md` before changing anything architectural — they are the binding rule sources for this repo.

## Governance status

- **Prototype Runtime Exception granted** (Ben, 2026-08-23, mission §1): this lab may use a concrete disposable game runtime. That decision does NOT decide the production engine, NOT MCL-1, NOT Minecraft vs. standalone, and may be discarded entirely.
- Jira MCL-1 (product format) remains **open**. Never declare the lab's runtime choice a product decision.
- Runtime work happens on `feat/prototype-runtime-foundation` per the mission — draft PR against `master`, no self-merge, no force-pushes.
- **Do not modify `DYAI2025/MC_legends`** as part of prototype work unless separately authorized; it is never a runtime dependency. This lab must not silently evolve into the production game architecture.

## Hard constraints (from AGENTS.md / ADR-0002)

- **Experiment is the unit of change.** New gameplay logic stays experiment-local by default; a mechanic is promoted to shared code only after ≥2 independent experiments need the same behavior contract.
- **Prototype outcome is evidence, not canon.** Experiments carry `design_status` (STATED | TENTATIVE | AMBIGUOUS | CONFLICT) and `source_refs` (Confluence MLOA / Jira MCL keys); a successful experiment never updates Confluence canon by itself.
- **Asset provenance is mandatory.** Every asset is registered with source, license, provenance, status, version, and a fallback before use. Gameplay code references stable `asset_id`s, never file paths. No third-party franchise iconography.
- No backend, database, cloud service, multiplayer, auth, or deployment without a separate architecture decision.
- No real child names, private submissions, credentials, or secrets in fixtures, screenshots, logs, or assets.
- **An unexecuted validation gate is `not_run`, never `passed`.**

## Validation (until the runtime exists)

The only executable check is JSON Schema (draft 2020-12) validation against `schemas/`. Verified working command:

```bash
uv run --with jsonschema python3 - <<'EOF'
import json, jsonschema
from pathlib import Path
pairs = [
    ('schemas/experiment.schema.json', 'experiments/_template/experiment.json'),
    ('schemas/asset-registry.schema.json', 'assets/registry/assets.example.json'),
]
for schema_p, doc_p in pairs:
    jsonschema.validate(json.loads(Path(doc_p).read_text()),
                        json.loads(Path(schema_p).read_text()),
                        cls=jsonschema.Draft202012Validator)
    print(f'valid: {doc_p}')
EOF
```

Every new experiment (copied from `experiments/_template/experiment.json`) must validate against `experiment.schema.json`; every asset-registry file against `asset-registry.schema.json`. Both schemas use `additionalProperties: false` — extending a contract means editing schema and contract doc together. Once the runtime mission is executed, this section gets replaced by the verified install/dev/test/build/smoke commands from `docs/runtime/SETUP.md`.

## Structure that matters

- `docs/experiments/EXPERIMENT_CONTRACT.md` + `schemas/experiment.schema.json` — what an experiment is (falsifiable hypothesis, tunables, success signals, kill criteria, reset strategy).
- `docs/assets/ASSET_REGISTRY_CONTRACT.md` + `schemas/asset-registry.schema.json` — asset identity/provenance rules; `assets/registry/assets.example.json` is the reference instance.
- `docs/architecture/` — ADR-0002, C4-lite diagrams, decision records, machine-readable planning records; `SOURCE_MAP.md` maps claims to evidence (MC_legends commit, Confluence MLOA pages, Jira MCL-1); `planning-run/` holds the original planning-run outputs.
- `docs/plans/` — approved runtime-foundation design + executable mission (the authoritative next step).
- `runtime-adapters/` — documents the adapter decision; exactly **one** adapter owning only the integration surface (boot/scene, input + third-person camera, physics hooks, asset loading, audio/fx, debug hooks, reset/smoke lifecycle) — explicitly not a universal engine-abstraction layer.

## Context

First playable target after the foundation: `zhalm-forest-v1` — a third-person forest encounter testing the Druhen/Zhalm sound-network hypothesis (sound → root trigger → network alert → investigate/chase). User preference is third-person.
