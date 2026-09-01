# VPS test instance runbook

This runbook packages and operates the static `world-editor-v1` prototype. It does not create a backend or production service.

## Current status

| Layer | Status | Evidence |
|---|---|---|
| Repository package | implemented | `Dockerfile`, `deploy/Caddyfile`, deployment smoke script |
| Production build | PASS | CI run `33316998826` and the image built on the VPS from runtime-source commit `011caef22686b3396ca84d24d6dd82724f26402a` |
| Preview browser persistence | PASS | CI plus browser-live verification through a temporary SSH tunnel to the real VPS, 2026-09-02 |
| Container smoke | PASS | dedicated CI job plus real VPS health, asset, 404, non-root and restart checks |
| VPS loopback runtime | PASS | healthy container bound only to `127.0.0.1:3012`, 2026-09-02 |
| Stable DNS/TLS/private URL | blocked | `mcl-test.poersch.online` has no A/AAAA record; TLS and access control remain `not_run` |

The intended URL is `https://mcl-test.poersch.online`. It is a plan value, not a verified live endpoint, until the external checks below pass.

## Verified VPS loopback deployment — 2026-09-02

The repository package was deployed on `srv1308064.hstgr.cloud` from runtime-source commit
`011caef22686b3396ca84d24d6dd82724f26402a`. This is the implementation commit used for
the observed runtime; later documentation-only commits do not retroactively change that evidence.

- Image tag: `mcl-protolab-test:011caef`
- Image ID: `sha256:ee8b7bff26e14a23502d2f9285181506e1986df2e5661a00ab3bb700ecb93431`
- Container: `mcl-protolab-test` (`c10212...`)
- Runtime: UID `10001`, restart policy `unless-stopped`, loopback-only host binding `127.0.0.1:3012`
- HTTP evidence: `/healthz` returned `ok`; the editor query, Ammo WASM and a representative GLB returned successfully; a missing path returned 404
- Restart evidence: the same container returned to `running/healthy` after an observed container restart
- Browser-live evidence: place unique sensor → autosave → reload → close/reopen tab → export valid JSON → open a clean browser context → import the JSON → identical serialized world
- Browser diagnostics: zero console errors and zero page errors during the observed flow

The browser used a temporary SSH tunnel to the loopback-bound service. The tunnel was removed after
the check. This evidence is `browser-live` for the VPS runtime, but it is not evidence for DNS, TLS,
reverse-proxy access control or the final public/private hostname.

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
