import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBbmodel, buildGlb } from './glb.mjs';

const SPEC_DIR = 'assets/blockmodels';
const GLB_DIR = 'public/assets/generated';
const BBMODEL_DIR = 'assets/blockmodels/bbmodel';

mkdirSync(GLB_DIR, { recursive: true });
mkdirSync(BBMODEL_DIR, { recursive: true });

const specs = readdirSync(SPEC_DIR).filter((f) => f.endsWith('.json'));
if (specs.length === 0) {
  console.error(`no specs found in ${SPEC_DIR}`);
  process.exit(1);
}

for (const file of specs) {
  const spec = JSON.parse(readFileSync(join(SPEC_DIR, file), 'utf8'));
  const stem = file.replace(/\.json$/, '');
  const glb = buildGlb(spec);
  writeFileSync(join(GLB_DIR, `${stem}.glb`), glb);
  writeFileSync(join(BBMODEL_DIR, `${stem}.bbmodel`), `${JSON.stringify(buildBbmodel(spec), null, 2)}\n`);
  console.log(`built: ${stem} (${spec.cubes.length} cubes, ${glb.byteLength} bytes)`);
}
console.log(`${specs.length} models built`);
