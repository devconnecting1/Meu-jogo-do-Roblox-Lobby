#!/usr/bin/env node
// Gera o manual de montagem (markdown + json). Roda no GitHub Actions (job "render").
// Uso: node tools/manual.mjs <pasta-saida>

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildPrison } from '../src/prison.js';
import { buildManual, manualMarkdown } from '../src/manual.js';

const out = resolve(process.argv[2] ?? 'out/previews');
mkdirSync(out, { recursive: true });
const manual = buildManual(buildPrison().parts);
writeFileSync(join(out, 'MANUAL.md'), manualMarkdown(manual));
writeFileSync(
  join(out, 'manual.json'),
  JSON.stringify({ parts: manual.parts, steps: manual.steps.length, connections: manual.connections }, null, 2),
);
console.log(`✔ Manual: ${manual.parts} peças · ${manual.steps.length} etapas · ${manual.connections} conexões`);
if (manual.problems.length) {
  console.error(manual.problems.join('\n'));
  process.exit(1);
}
