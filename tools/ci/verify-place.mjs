#!/usr/bin/env node
// Confere o lugar gerado pelo Rojo (versão XML) antes de publicar — roda no GitHub Actions.
// Uso: node tools/ci/verify-place.mjs build/reino.rbxlx

import { readFileSync } from 'node:fs';
import { buildMap } from '../../src/map.js';
import { VARIANT_SEEDS } from '../../src/variants.js';
import { MATERIAL_ENUM } from '../../src/materials.js';

const xml = readFileSync(process.argv[2], 'utf8');
const maps = [buildMap().parts, ...VARIANT_SEEDS.map((seed) => buildMap(seed).parts)];
const parts = maps.flat();
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
if (spawns !== maps.length) problems.push(`SpawnLocations no lugar: ${spawns}, esperado ${maps.length} (um por mapa)`);
// único script: o sorteio da variante do mapa (servidor, sem gameplay)
const scripts = count(/<Item class="Script"/g);
if (scripts !== 1) problems.push(`Scripts no lugar: ${scripts}, esperado 1 (EscolherMapa)`);
if (!/<string name="Name">EscolherMapa<\/string>/.test(xml)) problems.push('Faltando o script EscolherMapa');
const variants = VARIANT_SEEDS.filter((s) => xml.includes(`<string name="Name">Semente ${s}</string>`));
if (variants.length !== VARIANT_SEEDS.length)
  problems.push(`Variantes no ServerStorage: ${variants.length}/${VARIANT_SEEDS.length}`);
if (!/<token name="Technology">4<\/token>/.test(xml)) problems.push('Lighting.Technology não está em Future (4)');
for (const c of ['ColorCorrectionEffect', 'BloomEffect']) {
  if (!xml.includes(`<Item class="${c}"`)) problems.push(`Faltando ${c} no Lighting`);
}
const materials = new Set([...xml.matchAll(/<token name="Material">(\d+)<\/token>/g)].map((m) => m[1]));
const known = new Set(Object.values(MATERIAL_ENUM).map(String));
for (const m of materials) if (!known.has(m)) problems.push(`Material inesperado: ${m}`);

if (problems.length) {
  console.error('✖ Lugar inválido:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(
  `✔ Lugar ok: ${placeParts} Parts, ${lights} luzes, materiais ${[...materials].join('/')}, Lighting Future.`,
);
