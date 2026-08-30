# VPS test instance runbook

This runbook packages and operates the static `world-editor-v1` prototype. It does not create a backend or production service.

## Current status

| Layer | Status | Evidence |
|---|---|---|
| Repository package | implemented | `Dockerfile`, `deploy/Caddyfile`, deployment smoke script |
| Production build | PASS locally | `npm run build`, 2026-08-30 |
| Preview browser persistence | not_run locally | Playwright browser download timed out; CI is the executable Linux gate |
| Container smoke | not_run locally | Docker is unavailable in the current executor; CI owns this gate |
| VPS/DNS/TLS/live URL | blocked | no authorized, reachable VPS/Coolify control path in the current executor |

The intended URL is `https://mcl-test.poersch.online`. It is a plan value, not a verified live endpoint, until the external checks below pass.

## Runtime contract

- Image input: one exact reviewed Git commit.
- Container port: `8080`.
- Health path: `/healthz` returning `200` and `ok`.
- Editor path: `/?experiment=world-editor-v1`.
- TLS and optional authentication: reverse proxy/platform, outside the browser bundle.
- Runtime secrets: none required by the static application.
- Persistence: browser `localStorage`, scoped to the exact origin and browser profile.

## Build and local smoke

```bash
npm ci
npm run e2e:preview
./scripts/smoke-deployment.sh
```

The smoke script builds the image, binds it only to loopback, verifies health, the editor query, Ammo WASM, a representative GLB, 404 behavior and the non-root runtime user, then removes its own temporary container.

## VPS/Coolify configuration

1. Select the exact Git commit from the deployment PR; do not deploy a moving, unrecorded working tree.
2. Build with the repository `Dockerfile` and expose container port `8080`.
3. Configure the platform health check as `GET /healthz`.
4. Bind one stable HTTPS hostname, planned as `mcl-test.poersch.online`.
5. Configure private access at the reverse-proxy/platform boundary if required. Never place credentials in Vite variables, GitHub, image layers or Confluence.
6. Deploy and record the Git commit and immutable image identifier supplied by the platform.
7. Run the external verification below before announcing the URL.

The reverse proxy should preserve query strings and forward `/`, `/assets/`, `/ammo/` and `/healthz` unchanged. Do not configure an HTML fallback for missing asset paths; the image intentionally returns 404 for missing files.

## External verification

Replace the value only if the operator selected another stable hostname.

```bash
test_url='https://mcl-test.poersch.online'
curl --fail --show-error --silent "${test_url}/healthz"
curl --fail --show-error --silent "${test_url}/?experiment=world-editor-v1" >/dev/null
curl --fail --show-error --silent "${test_url}/ammo/ammo.wasm.wasm" >/dev/null
curl --fail --show-error --silent "${test_url}/assets/env/root_cluster_01.glb" >/dev/null
```

Then use a browser at the final HTTPS URL:

1. Open `/?experiment=world-editor-v1` and place one uniquely recognizable object.
2. Reload the page and confirm the object returns.
3. Close and reopen the tab in the same browser profile and confirm it returns again.
4. Export the layout JSON and validate that it can be imported into a clean session.
5. Verify unauthenticated access is rejected if private access was configured.

Record each outcome as `PASS`, `FAIL`, `blocked` or `not_run`. A DNS response, container health result or CI check does not substitute for the final HTTPS/browser smoke.

## Persistence and backup boundary

Autosave uses `mcl-protolab.world-editor.autosave` in browser `localStorage`. A container restart or redeploy does not clear it when the origin stays identical. Clearing site data, switching browser/profile, private browsing, storage eviction or changing scheme/hostname/port can remove access to it.

Export meaningful work to JSON before upgrades or origin changes. Import the JSON after a change. Only reviewed files committed to `worlds/` are repository-backed; browser autosave is non-canonical prototype data.

## Rollback

1. Identify the previously recorded healthy Git revision/image.
2. Redeploy that exact image without changing the public origin.
3. Verify `/healthz`, the editor query and representative assets.
4. Confirm the browser autosave remains visible and export it.
5. Record the failed and restored image identifiers plus smoke outcomes.

If the public origin must change, export layouts before the change. Rollback cannot move `localStorage` between origins.

## Failure handling

- `healthz` fails: inspect container start/health logs and roll back the image; do not alter user browser storage.
- HTML loads but WASM/GLB fails: verify the proxy path and content response, then run the container smoke against the image.
- autosave appears empty: first confirm exact scheme/hostname/port and browser profile; do not conclude data loss from a different origin.
- authentication leaks into frontend assets: remove the deployment, rotate the exposed credential and move access control to the platform boundary.
