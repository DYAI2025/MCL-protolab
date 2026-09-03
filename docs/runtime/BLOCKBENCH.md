# Blockbench pipeline

Two complementary ways to make blocky assets for this lab. Both end in the same place: a GLB served from `public/assets/generated/`, registered in `assets/registry/assets.json` with provenance, loaded via `src/runtime/assets/glb-loader.ts`.

## Path 1 — repo-native spec pipeline (fully autonomous, works headless)

The primary pipeline. A model is a JSON cube list in `assets/blockmodels/<name>.json`:

```json
{
  "name": "my-creature",
  "design_source": "MLOA:<pageId>#<section> — one-line brief this model implements",
  "cubes": [
    { "from": [-0.5, 0, -0.5], "to": [0.5, 1, 0.5], "color": [0.3, 0.25, 0.2] }
  ]
}
```

Units are meters, Y-up, origin at the feet. Then:

```bash
npm run generate:assets
```

writes, per spec:

- `public/assets/generated/<name>.glb` — deterministic glTF 2.0 binary (one primitive+material per distinct color). **Byte-identical output for identical input** — CI regenerates and `git diff --exit-code`s the results, so a committed GLB provably matches its committed spec.
- `assets/blockmodels/bbmodel/<name>.bbmodel` — the same geometry as a Blockbench "free"-format project, so any model stays hand-editable in Blockbench (geometry only; colors live in the GLB materials).

Register the GLB in `assets/registry/assets.json` (path `/assets/generated/<name>.glb`, provenance naming the spec and the Confluence design source, a fallback id), then show it: the `blockmodel-gallery-v1` experiment (`/?experiment=blockmodel-gallery-v1`) is the side-by-side design-comparison surface — add the asset id to its `SHOWN` list.

Builder internals: `scripts/blockmodel/glb.mjs` (unit-tested in `glb.test.ts` — header, primitive grouping, vertex counts, bounds, determinism).

## Path 2 — live Blockbench via MCP (interactive, needs the desktop app)

Verified to exist: [jasonjgardner/blockbench-mcp-plugin](https://github.com/jasonjgardner/blockbench-mcp-plugin) runs an MCP server **inside** Blockbench, exposing model/element/texture manipulation to MCP clients.

Setup (one-time, by a human):

1. Install [Blockbench](https://www.blockbench.net/) (desktop).
2. In Blockbench: **File → Plugins → Load Plugin from URL** → `https://jasonjgardner.github.io/blockbench-mcp-plugin/mcp.js`
3. Check **Settings → General → MCP Server Port / Endpoint** — default endpoint `http://localhost:3000/bb-mcp`.

This repo's `.mcp.json` already registers that endpoint as the project-scoped MCP server `blockbench`. When Blockbench is running with the plugin, a new Claude Code session in this repo can drive it directly (create cubes, edit elements, export). When Blockbench is closed, the server is simply unreachable — harmless.

Status: the plugin's existence, install URL and default endpoint are verified against its repository (2026-08-30). The connection itself has **not** been exercised yet — it requires the desktop app running (`not_run`, per repo discipline).

Suggested division of labor: Path 1 for generation, determinism and CI; Path 2 for hand-tuning a generated `.bbmodel` (or live AI-assisted sculpting) — re-export to GLB from Blockbench, or port edits back into the spec to keep CI determinism.

Sources: [GitHub — blockbench-mcp-plugin](https://github.com/jasonjgardner/blockbench-mcp-plugin) · [Playbooks MCP page](https://playbooks.com/mcp/jasonjgardner/blockbench-mcp-plugin) · [LobeHub listing](https://lobehub.com/mcp/jasonjgardner-blockbench-mcp-plugin)
