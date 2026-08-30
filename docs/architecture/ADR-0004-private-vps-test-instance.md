# ADR-0004 - Private VPS test instance for `world-editor-v1`

- Status: Accepted for prototype-only deployment; live rollout pending
- Date: 2026-08-30
- Decision scope: disposable MCL Protolab test runtime
- Production hosting architecture: NOT DECIDED

## Context

`world-editor-v1` currently runs through the local Vite development server. The editor already saves every change to browser `localStorage`, restores it on reload and supports JSON export/import. A stable browser URL is useful for remote review, but a public development server is not an operationally safe or reproducible deployment.

ADR-0002 prohibits backend and production operations in the initial lab. ADR-0003 permits PlayCanvas only as a time-boxed prototype runtime. This decision therefore needs a narrow exception: deploy the compiled static prototype without adding application services or treating it as production architecture.

## Decision

Package the Vite production build in a pinned, non-root Caddy container on port `8080`.

- The image contains static files only. It has no API, database or shared save service.
- A reverse proxy or VPS platform owns the stable hostname, HTTPS and optional access control.
- The planned hostname is `https://mcl-test.poersch.online`; it is an operator setting and is not compiled into the application.
- `/healthz` is the container health endpoint.
- Browser autosave remains in `localStorage` under `mcl-protolab.world-editor.autosave`.
- JSON export/import is the portable backup and handoff mechanism. Accepted layouts continue to enter `worlds/` through Git review.
- The image and runbook are prototype-only. They do not decide the production game engine, backend or hosting platform.

## Why a stable origin matters

Web storage is scoped to the browser profile and origin (scheme, hostname and port). Reloads and redeploys at the same HTTPS origin preserve the existing autosave. Changing the hostname, protocol or port creates a different storage boundary; operators must export important layouts before such a change.

## Alternatives considered

### Keep local-only Vite sessions

Lowest operational cost, but no persistent review URL and no independent deployment evidence.

### Expose the Vite development server

Rejected. It is a development process, lacks the bounded runtime image and health contract, and is not the artifact CI verifies for release.

### Add server-side world persistence now

Rejected for this scope. It would require identity, authorization, storage, backup and data-lifecycle decisions that are neither needed for one-browser testing nor authorized by the prototype contract.

## Consequences

- Reviewers get one restart-safe static test endpoint after the VPS operator completes the rollout.
- Autosave is durable only for the same browser profile and origin. It is not a shared or guaranteed backup.
- The prototype can be rolled back by redeploying a previously recorded image/revision; worlds in browser storage are not part of the image.
- TLS and access-control evidence must come from the runtime platform. A green repository CI run alone cannot mark the deployment live.
- Any future shared save, login, product SLA or dependency on `MC_legends` requires a new ADR and threat/data review.

## Review triggers

- More than one user or device must edit the same layout.
- Browser data loss becomes unacceptable.
- The hostname/origin must change.
- The lab requires a backend, secrets in the browser bundle, or product data.
- The test instance is proposed as a production game service.
