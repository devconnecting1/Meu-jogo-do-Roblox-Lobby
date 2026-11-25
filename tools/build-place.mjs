#!/usr/bin/env node
// Gera build/Reino.model.json (mapa principal) e build/Mapas/Semente N.model.json (variantes
// sorteadas por servidor). Em seguida o CI roda:
//   rojo build default.project.json -o build/reino.rbxl
// Roda no GitHub Actions (job "build"); não é necessário rodar localmente.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMap } from '../src/map.js';
import { VARIANT_SEEDS, variantName } from '../src/variants.js';
import { toRojoModel } from '../src/rojo.js';
import { stats } from '../src/builder.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const write = (file, parts) => {
  const out = resolve(root, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(toRojoModel(parts), null, 1));
  const s = stats(parts);
  console.log(`✔ ${file} — ${s.total} Parts, ${s.lights} luzes`);
  return s.total;
};

let total = write('build/Reino.model.json', buildMap().parts);
for (const seed of VARIANT_SEEDS) total += write(`build/Mapas/${variantName(seed)}.model.json`, buildMap(seed).parts);
console.log(`✔ ${VARIANT_SEEDS.length + 1} mapas, ${total} Parts no lugar`);
