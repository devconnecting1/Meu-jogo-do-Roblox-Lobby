#!/usr/bin/env node
// Confere o lugar gerado pelo Rojo (versão XML) antes de publicar — roda no GitHub Actions.
// Uso: node tools/ci/verify-place.mjs build/reino.rbxlx

import { readFileSync } from 'node:fs';
import { buildMap } from '../../src/map.js';

const xml = readFileSync(process.argv[2], 'utf8');
const { parts } = buildMap();
const count = (re) => (xml.match(re) || []).length;
const problems = [];

const placeParts = count(/<Item class="(Part|SpawnLocation)"/g);
if (placeParts !== parts.length) problems.push(`Parts no lugar: ${placeParts}, esperado ${parts.length}`);

const lights = count(/<Item class="(PointLight|SurfaceLight)"/g);
const expectedLights = parts.filter((p) => p.light).length;
if (lights !== expectedLights) problems.push(`Luzes no lugar: ${lights}, esperado ${expectedLights}`);

for (const banned of [
  'Decal',
  'Texture',
  'SurfaceGui',
  'BillboardGui',
  'ScreenGui',
  'Script',
  'LocalScript',
  'ModuleScript',
  'Humanoid',
  'MeshPart',
  'UnionOperation',
  'Sky',
]) {
  if (xml.includes(`<Item class="${banned}"`)) problems.push(`Instância proibida no lugar: ${banned}`);
}
if (!/<Item class="Atmosphere"/.test(xml)) problems.push('Faltando Atmosphere (neblina leve) no Lighting');
const spawns = count(/<Item class="SpawnLocation"/g);
if (spawns !== 1) problems.push(`SpawnLocations no lugar: ${spawns}, esperado 1 (praça)`);
if (!/<token name="Technology">4<\/token>/.test(xml)) problems.push('Lighting.Technology não está em Future (4)');
for (const c of ['ColorCorrectionEffect', 'BloomEffect']) {
  if (!xml.includes(`<Item class="${c}"`)) problems.push(`Faltando ${c} no Lighting`);
}
const materials = new Set([...xml.matchAll(/<token name="Material">(\d+)<\/token>/g)].map((m) => m[1]));
for (const m of materials) if (!['256', '288'].includes(m)) problems.push(`Material inesperado: ${m}`);

if (problems.length) {
  console.error('✖ Lugar inválido:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(
  `✔ Lugar ok: ${placeParts} Parts, ${lights} luzes, materiais ${[...materials].join('/')}, Lighting Future.`,
);
