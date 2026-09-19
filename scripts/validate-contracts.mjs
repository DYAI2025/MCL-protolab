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

// Every world layout, template included.
if (existsSync('worlds')) {
  for (const f of readdirSync('worlds').filter((f) => f.endsWith('.json'))) {
    pairs.push(['schemas/world-layout.schema.json', join('worlds', f)]);
  }
}

// Every creature concept profile, if the addendum's schema is present.
if (existsSync('schemas/creature-concept.schema.json') && existsSync('concepts/creatures')) {
  for (const f of readdirSync('concepts/creatures').filter((f) => f.endsWith('.json'))) {
    pairs.push(['schemas/creature-concept.schema.json', join('concepts/creatures', f)]);
  }
}

// Every world state document, if the world-state schema is present.
if (existsSync('schemas/world-state.schema.json') && existsSync('states')) {
  for (const f of readdirSync('states').filter((f) => f.endsWith('.json'))) {
    pairs.push(['schemas/world-state.schema.json', join('states', f)]);
  }
}

// Every canon projection document, if the canon-projection schema is present.
if (existsSync('schemas/canon-projection.schema.json') && existsSync('projections')) {
  for (const f of readdirSync('projections').filter((f) => f.endsWith('.json'))) {
    pairs.push(['schemas/canon-projection.schema.json', join('projections', f)]);
  }
}

// Every world event document, if the world-event schema is present.
if (existsSync('schemas/world-event.schema.json') && existsSync('world-events')) {
  for (const f of readdirSync('world-events').filter((f) => f.endsWith('.json'))) {
    pairs.push(['schemas/world-event.schema.json', join('world-events', f)]);
  }
}

// Every director run document, if the director-run schema is present.
if (existsSync('schemas/director-run.schema.json') && existsSync('director-runs')) {
  for (const f of readdirSync('director-runs').filter((f) => f.endsWith('.json'))) {
    pairs.push(['schemas/director-run.schema.json', join('director-runs', f)]);
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
