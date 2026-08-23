# ADR-0002 - Separate disposable Prototype Lab with a blocked runtime adapter

- Status: Conditional
- Date: 2026-08-23
- Decision scope: gameplay/asset prototyping only
- Production game engine: NOT DECIDED

## Context

The active `DYAI2025/MC_legends` repository is a production-oriented Next.js web foundation with PostgreSQL, CI and VPS deployment work. Its root TypeScript configuration includes all TypeScript files recursively. Confluence explicitly states that the web boilerplate does not decide the game technology. Jira MCL-1 remains open and current repository instructions prohibit engine selection before that gate is resolved.

The user needs a repeatable local playground where agents can implement short gameplay experiments, swap assets, tune mechanics and discard failed ideas without building an alpha/beta architecture.

## Decision

Create the prototype foundation as a separate repository concept: `DYAI2025/mcl-prototype-lab`.

The initial foundation contains contracts, schemas, experiment metadata, asset registry rules, agent instructions and an empty runtime-adapter slot. It does not select PlayCanvas, Babylon, Godot, Unity, Fabric, NeoForge or another runtime.

## Architecture principles

1. Experiment is the unit of change.
2. Experiment-specific logic stays local by default.
3. Shared mechanics are earned by repeated reuse, not predicted upfront.
4. Asset identity is stable; concrete files are replaceable through the registry.
5. Prototype outcome is evidence, not canon.
6. No backend or production operations in the initial lab.
7. Runtime integration is a thin adapter decision after the governance gate, not a universal engine abstraction layer.

## Why not a subfolder of MC_legends?

The current root TypeScript and CI scopes are web-wide. Embedding experimental runtime code would require changing production tooling merely to keep prototype code isolated. That increases blast radius and weakens the disposable nature of the lab.

## Strongest counterargument

A single repository is easier to discover and can prevent documentation drift. This becomes decisive if the project explicitly accepts changing root tooling and CI to create a genuinely isolated workspace without slowing the web delivery path.

## Review triggers

- MCL-1 is resolved.
- A prototype-runtime exception is explicitly approved.
- Two experiments require the same mechanic contract.
- Prototype work starts depending on the web backend or persistent services.
- The lab is proposed as the future production game foundation.
