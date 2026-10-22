// Build step: writes dist/<name>.schema.json for editor autocomplete on catalog YAML.
// Runs after `tsc -p tsconfig.build.json` and imports the compiled package, so the schema package
// source itself stays free of fs access.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsonSchemas } from '../dist/index.js';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
mkdirSync(dist, { recursive: true });
for (const [name, schema] of Object.entries(jsonSchemas())) {
  writeFileSync(join(dist, `${name}.schema.json`), `${JSON.stringify(schema, null, 2)}\n`);
  console.log(`wrote dist/${name}.schema.json`);
}
