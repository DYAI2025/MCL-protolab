# World Editor VPS Test Instance Implementation Plan

Plan path: `docs/plans/2026-08-30-world-editor-vps-test-instance.md`
Status: blocked
Owner/Executor: mixed (Codex repository implementation; authorized VPS operator for live deployment)
Last updated: 2026-08-30

<!-- GOAL_START -->
Goal: Private, persistent VPS test URL for `world-editor-v1`

Ziel. Package the existing PlayCanvas/Vite prototype as a restart-safe static container that can be reached through one stable HTTPS origin. Preserve the editor's existing browser-local autosave across reloads and redeploys on that origin, while keeping exported/accepted world layouts versioned through the repository rather than introducing a backend.

Scope. Branch from the exact current `feat/prototype-runtime-foundation` head. Add deployment packaging, a production-preview/browser persistence check, a container smoke gate, an explicit prototype-only ADR, runtime/runbook documentation, CI coverage, and a Confluence child page. The planned external origin is `https://mcl-test.poersch.online`, subject to DNS/VPS verification.

Bedingungen (hart).
- No API, database, shared save service, product deployment, or production-engine decision.
- No credentials, access codes, DNS tokens, or private media in GitHub, logs, screenshots, or Confluence.
- `world-editor-v1` remains a disposable experiment; autosave remains browser-local and non-canonical.
- Deployment is not `passed` until the exact image/revision is smoke-tested through the real HTTPS URL.

Akzeptanzkriterien.
- The production build is served by a non-root static container and returns HTTP 200 on `/healthz` and `/?experiment=world-editor-v1`.
- A same-origin browser reload restores the editor autosave and yields the same serialized layout.
- CI builds and smoke-tests the container and runs all existing repository gates on the exact PR head.
- GitHub contains an ADR, plan, runbook, rollback instructions, and no secrets.
- Confluence contains a verified child page under page `32604163` with scope, state, URL status, persistence boundary, operation, and evidence links.
- The final URL remains labeled `not_run` until an HTTPS smoke is observed from an authorized runtime path.

Explizit out-of-scope.
- Shared multi-device or multi-user server-side world persistence.
- Login/account management inside the prototype application.
- Automatic promotion of editor output into canon or accepted game design.
- Changes to `DYAI2025/MC_legends`, product hosting, multiplayer, or final engine architecture.

Done-Definition. Repository PR is green at an exact head, Confluence readback matches the documented decision, and the external URL has a recorded HTTPS/runtime smoke; until the final condition is met the result is `DEPLOYMENT BLOCKED`, not Done.

Reference-Doc: `docs/runtime/VPS_TEST_INSTANCE.md`
<!-- GOAL_END -->

## Evidence and source boundary

- Provided evidence: user reports the local editor at `http://localhost:5173/?experiment=world-editor-v1` and explicitly requests planning, critical validation, implementation, GitHub, and Confluence documentation.
- Inspected evidence: PR #3 head `9da84c0f52626e878988c2264b1db3e9577a1a82`; `AGENTS.md`; ADR-0002/0003; `package.json`; `vite.config.ts`; `playwright.config.ts`; `experiments/world-editor-v1/index.ts`; `e2e/world-editor.spec.ts`; `docs/runtime/WORLD_EDITOR.md`; Confluence page `32604163` and its empty descendant list.
- Current behavior: autosave uses `localStorage` key `mcl-protolab.world-editor.autosave`; repo worlds are bundled at build time; no backend exists.
- Not inspected/unavailable: live VPS filesystem, Coolify project configuration, DNS control plane, TLS termination, and public URL response.

## Assumptions, missing information, open questions, blockers

### ASSUMPTION

- `https://mcl-test.poersch.online` is the intended stable origin. The repository will not hard-code it, so the runtime operator can choose another stable HTTPS hostname without rebuilding.
- Coolify or another reverse proxy terminates HTTPS and forwards to container port `8080`.
- The test instance is private/unlisted at first; access control belongs at the reverse-proxy/platform boundary, not inside the prototype.

### MISSING

- Exact Coolify application identity and current VPS deployment directory.
- Confirmed DNS record and TLS certificate for the planned hostname.
- Final choice of reverse-proxy access control mechanism.

### OPEN QUESTION

- Whether basic authentication is configured in Coolify/Traefik or another already-operated access gateway. This does not change the static application image.

### BLOCKER

- The current executor cannot resolve or SSH to `srv1308064.hstgr.cloud` and has no VPS/Coolify connector. Live deployment, DNS mutation, and runtime smoke cannot be truthfully completed from this environment.

## Requirements

| ID | Type | Statement | Source | Verification |
|---|---|---|---|---|
| REQ-F-001 | functional | Serve the built prototype from a restart-safe static container on port `8080`. | user-provided + evidence | Docker CI smoke returns 200. |
| REQ-F-002 | functional | Preserve `/?experiment=world-editor-v1` behavior in the production build. | user-provided | Production-preview Playwright test and external smoke. |
| REQ-D-001 | data | Preserve autosave across same-origin reload without adding server persistence. | evidence + user intent | Given an autosaved layout, when the page reloads on the same origin, then serialized layout and object count match. |
| REQ-A-001 | architecture | Use static hosting only; no API, DB, shared save service, or dependency on `MC_legends`. | repository contract | Diff review and boundary checks. |
| REQ-S-001 | security | Run the content process as non-root and commit no secrets. | derived | Container metadata/smoke and secret review. |
| REQ-S-002 | security | Keep access control/TLS outside the browser bundle. | ASSUMPTION | Runbook and platform configuration review. |
| REQ-NF-001 | reliability | Expose `/healthz` and configure an image health check. | derived | Container smoke observes healthy status and 200 response. |
| REQ-O-001 | operations | Pin deployment to an exact Git revision/image and document rollback. | project governance | PR/runbook review and live deployment record. |
| REQ-DOC-001 | documentation | Record architecture, operation, persistence semantics, status, and evidence in GitHub and Confluence. | user-provided | GitHub and Confluence readback. |

## Architecture and file boundaries

### Current architecture facts

- Vite 8 produces a static `dist/` build.
- PlayCanvas/Ammo assets are served from the same origin.
- The editor restores local autosave during initialization and supports JSON export/import.
- No runtime server or persistence API is required for the requested browser-session persistence.

### Target architecture constraints

- Multi-stage image: pinned Node build stage, minimal static server runtime stage.
- Runtime listens on unprivileged port `8080` as a non-root user.
- Reverse proxy owns DNS, TLS, and optional authentication.
- Hashed assets may be cached; `index.html` must revalidate so redeploys become visible.
- Missing files must remain 404s rather than being silently replaced by HTML.

### Files and modules

- Create: `Dockerfile`, `.dockerignore`, `deploy/Caddyfile`, `scripts/smoke-deployment.sh`.
- Create: `playwright.preview.config.ts`, `e2e/production-deployment.spec.ts`.
- Create: `docs/architecture/ADR-0004-private-vps-test-instance.md`, `docs/runtime/VPS_TEST_INSTANCE.md`.
- Modify: `package.json`, `.github/workflows/gates.yml`, `docs/runtime/VALIDATION.md`, `docs/runtime/WORLD_EDITOR.md`.

### Prohibited changes

- No application authentication, storage API, DB schema, or persistence abstraction.
- No writes to `DYAI2025/MC_legends`.
- No credentials or environment-specific secret values.
- No merge, Jira Done, or production claim from repository green alone.

## Implementation phases

### Phase 1: Discovery and test baseline

- Pin exact source head and verify a clean isolated branch.
- Add a browser test for same-origin reload persistence and run it against production preview.
- Record Docker/VPS capability gaps as `not_run`, never inferred.

### Phase 2: Static deployment package

- Add multi-stage container packaging and static-server policy.
- Add health endpoint and executable container smoke.
- Make deployment smoke part of GitHub Actions where Docker is available.

### Phase 3: Full verification and critical review

- Run typecheck, lint, boundaries, contracts, unit, build, production-preview e2e, and existing e2e.
- Review caching, MIME delivery, 404 behavior, non-root execution, secrets, and rollback.

### Phase 4: Documentation and external handoff

- Commit plan, ADR, and runbook with exact statuses.
- Push isolated branch and open a PR against `feat/prototype-runtime-foundation` so deployment work cannot silently bypass the active draft.
- Create and read back the Confluence child page.
- Deploy and smoke through the real HTTPS URL only through an authorized VPS/DNS capability.

## Tasks

### TASK-001: Prove production-build editor persistence

Objective: Verify the existing autosave behavior on a production build rather than only Vite dev.
Requirement links: REQ-F-002, REQ-D-001
Files/modules:
- Create: `playwright.preview.config.ts`
- Create: `e2e/production-deployment.spec.ts`
- Modify: `package.json`

Steps:
1. Add a Playwright test that loads the editor, writes a small layout through the existing test hook, reloads, and compares serialized state.
2. Run it before the production-preview script exists and record the expected red configuration/script failure.
3. Add the smallest preview configuration and npm script.
4. Run the focused test, then the existing e2e suite.

Acceptance criteria:
- Same-origin reload restores an identical serialized layout.
- Test runs against `vite preview`, not `vite dev`.

Validation:
- Command: `npm run e2e:preview`
- Expected result: exit 0 with the production-deployment spec passing.

Rollback note: remove the preview config/spec/script; application behavior remains unchanged.

### TASK-002: Package and smoke the static container

Objective: Produce a non-root, health-checked image that serves the production build.
Requirement links: REQ-F-001, REQ-A-001, REQ-S-001, REQ-NF-001
Files/modules:
- Create: `Dockerfile`, `.dockerignore`, `deploy/Caddyfile`, `scripts/smoke-deployment.sh`
- Modify: `.github/workflows/gates.yml`

Steps:
1. Add the smoke script first; observe its red result while `Dockerfile` is absent or Docker is unavailable.
2. Add the multi-stage image and static-server configuration.
3. Validate build, health, root/query response, required wasm asset, 404 behavior, and non-root process in CI.
4. Preserve the container smoke as a separate CI job so a static deployment failure is visible.

Acceptance criteria:
- Container reports healthy and serves required endpoints/assets.
- A missing path returns 404.
- Runtime process is non-root.

Validation:
- Command: `./scripts/smoke-deployment.sh`
- Expected result: exit 0 where Docker is available; local status may remain `not_run` if Docker is unavailable, with CI as the executable gate.

Rollback note: stop/remove the new container and redeploy the prior exact image; static data is disposable and browser autosave is unaffected when origin remains stable.

### TASK-003: Record the bounded architecture decision and runbook

Objective: Justify the deployment exception without turning the lab into a production service.
Requirement links: REQ-A-001, REQ-O-001, REQ-DOC-001
Files/modules:
- Create: `docs/architecture/ADR-0004-private-vps-test-instance.md`, `docs/runtime/VPS_TEST_INSTANCE.md`
- Modify: `docs/runtime/VALIDATION.md`, `docs/runtime/WORLD_EDITOR.md`

Steps:
1. Document context, decision, alternatives, consequences, prototype-only boundary, and review triggers.
2. Document build/deploy/health/rollback, stable-origin semantics, backup/export, and failure handling.
3. Mark unexecuted live URL and TLS checks `not_run`.

Acceptance criteria:
- Documentation never presents the test instance as production, canon, shared persistence, or already deployed.

Validation:
- Command: `rg -n "not_run|prototype-only|localStorage|rollback|healthz" docs/architecture/ADR-0004-private-vps-test-instance.md docs/runtime/VPS_TEST_INSTANCE.md`
- Expected result: required boundaries are present.

Rollback note: supersede the ADR and remove the deployment package; preserve historical evidence.

### TASK-004: Verify, publish, and reconcile

Objective: Produce exact-head GitHub evidence and matching Confluence documentation.
Requirement links: REQ-O-001, REQ-DOC-001
Files/modules:
- GitHub branch/PR and Confluence child page under `32604163`.

Steps:
1. Run all local executable gates and record raw status.
2. Commit and push the isolated branch; open a stacked PR against `feat/prototype-runtime-foundation`.
3. Read back PR head and CI for that exact head; do not reuse earlier checks.
4. Create the Confluence child page and read it back.
5. If an authorized VPS path becomes available, deploy the exact image, smoke the HTTPS URL, and update status/evidence; otherwise stop at `DEPLOYMENT BLOCKED`.

Acceptance criteria:
- GitHub and Confluence content agree on exact status and evidence.
- No claim of live deployment exists without runtime observation.

Validation:
- Command: repository gates plus GitHub/Confluence readbacks; external `curl`/browser smoke when available.
- Expected result: exact-head repository green; live URL either verified or explicitly blocked.

Rollback note: close the stacked PR and remove the unpublished test deployment, or redeploy the previously recorded image revision.

## Validation strategy

### Focused tests

- `npm run e2e:preview`
- `./scripts/smoke-deployment.sh` where Docker is available

### Broader regression checks

- `npm run typecheck`
- `npm run lint`
- `npm run boundaries`
- `npm run validate:contracts`
- `npm test`
- `npm run build`
- `npm run e2e`

### Manual/runtime review checklist

- Stable HTTPS URL uses one unchanged origin.
- Access control does not expose a secret in browser assets.
- `/healthz`, root, editor query, wasm, GLB, and missing-path behavior are observed.
- Editor autosave survives reload and redeploy on the same origin.
- JSON export succeeds before risky browser/DNS changes.
- VPS reboot/restart restores the service.
- Exact deployed revision and rollback image are recorded.

## Rollback and safety

- Repository changes are isolated on a branch based on an exact feature head.
- The deployment is stateless; rollback is an image/revision switch.
- Browser autosave is origin-scoped. Preserve the hostname during rollback and export important layouts before changing DNS/origin.
- Never commit Coolify tokens, SSH keys, Basic Auth secrets, or Tripo credentials.
- A static test deployment does not authorize backend or shared persistence later.

## Execution handoff

- Start with: exact-head verification, failing production-preview test setup, then the smallest static image.
- Stop and ask if: the origin differs, the deployment would become public without access control, the VPS requires destructive replacement of another service, or secrets would enter repository/docs.
- Commit strategy: coherent deployment slice on `codex/world-editor-vps-test-instance`; no direct commit to `master`.
- Expected final artifacts: plan, ADR, runbook, container/config, browser test, Docker smoke, CI gate, PR, Confluence page, and either verified live URL evidence or an explicit blocker.

## Plausibility and truth self-check

- Goal length: visibly below 3999 characters; validated with the Writing Plans validator.
- Unsupported claims removed or labeled: yes.
- Strongest counterargument: JSON export plus localhost may already be sufficient, so permanent VPS operation adds maintenance and exposure without shared persistence; the mitigation is a private, static, disposable instance with no backend.
- Failure-mode chain: If the hostname/origin changes, browser localStorage becomes inaccessible, then the user may perceive saved worlds as lost. Mitigation: stable origin, JSON export before DNS changes, and explicit runbook warning.
- Bias risks: tool bias toward Docker/Caddy and overengineering bias toward a backend were checked; the backend was excluded and the static boundary retained.
- Final readiness: blocked for live deployment; ready-for-execution for repository, CI, GitHub, and Confluence work.
