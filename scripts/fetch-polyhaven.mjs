/**
 * Downloads CC0 models from Poly Haven and packs each into one optimized GLB
 * under public/assets/env/. Usage:
 *   node scripts/fetch-polyhaven.mjs <asset_id> [<asset_id> ...]
 * Requires @gltf-transform/cli on PATH (pinned global install).
 * Poly Haven content is CC0 (https://polyhaven.com/license) — record the
 * asset URL in the registry `source` field anyway.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const RESOLUTION = '1k';
const OUT_DIR = 'public/assets/env';

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('usage: node scripts/fetch-polyhaven.mjs <asset_id> ...');
  process.exit(2);
}

mkdirSync(OUT_DIR, { recursive: true });

for (const id of ids) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  const variant = files.gltf?.[RESOLUTION];
  if (!variant?.gltf) {
    console.error(`SKIP ${id}: no ${RESOLUTION} gltf variant`);
    continue;
  }
  const workDir = join('/tmp', `ph-${id}`);
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(join(workDir, 'textures'), { recursive: true });

  const save = async (url, relPath) => {
    const buffer = Buffer.from(await (await fetch(url)).arrayBuffer());
    writeFileSync(join(workDir, relPath), buffer);
  };
  const gltfName = `${id}.gltf`;
  await save(variant.gltf.url, gltfName);
  for (const [relPath, meta] of Object.entries(variant.gltf.include ?? {})) {
    await save(meta.url, relPath);
  }

  const packed = join(workDir, `${id}-packed.glb`);
  const simplified = join(workDir, `${id}-simplified.glb`);
  const out = join(OUT_DIR, `${id}.glb`);
  execFileSync('gltf-transform', ['copy', join(workDir, gltfName), packed], { stdio: 'pipe' });
  execFileSync('gltf-transform', ['simplify', packed, simplified, '--ratio', '0.5', '--error', '0.001'], { stdio: 'pipe' });
  execFileSync('gltf-transform', ['webp', simplified, out], { stdio: 'pipe' });
  console.log(`fetched: ${id} -> ${out}`);
}
