import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const ajv = new Ajv2020({ allErrors: true, strict: false });
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

const pairs = [
  ['schemas/experiment.schema.json', 'experiments/_template/experiment.json'],
  ['schemas/asset-registry.schema.json', 'assets/registry/assets.example.json'],
  ['schemas/asset-registry.schema.json', 'assets/registry/assets.json'],
];

// Every real experiment document (the _template pair is listed explicitly above).
for (const dir of readdirSync('experiments').filter((d) => !d.startsWith('_'))) {
  const doc = join('experiments', dir, 'experiment.json');
  if (existsSync(doc)) pairs.push(['schemas/experiment.schema.json', doc]);
}

// Every creature concept profile, if the addendum's schema is present.
if (existsSync('schemas/creature-concept.schema.json') && existsSync('concepts/creatures')) {
  for (const f of readdirSync('concepts/creatures').filter((f) => f.endsWith('.json'))) {
    pairs.push(['schemas/creature-concept.schema.json', join('concepts/creatures', f)]);
  }
}

let failed = 0;
for (const [schemaPath, docPath] of pairs) {
  const validate = ajv.compile(read(schemaPath));
  if (validate(read(docPath))) {
    console.log(`valid: ${docPath}`);
  } else {
    failed += 1;
    console.error(`INVALID: ${docPath}`);
    for (const err of validate.errors ?? []) console.error(`  ${err.instancePath || '/'} ${err.message}`);
  }
}
console.log(`${pairs.length - failed}/${pairs.length} documents valid`);
process.exit(failed === 0 ? 0 : 1);
