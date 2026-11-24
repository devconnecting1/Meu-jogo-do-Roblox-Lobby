// Regras de estilo: Part clássico, sem textura/UI/NPC, cores neutras, orçamento de Parts e luzes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrison } from '../src/prison.js';
import { saturation } from '../src/palette.js';
import { stats } from '../src/builder.js';

const { parts } = buildPrison();
const ALLOWED_KEYS = [
  'model',
  'name',
  'position',
  'size',
  'color',
  'transparency',
  'canCollide',
  'rotation',
  'light',
  'className',
  'shape',
  'material',
  'studs',
  'surface',
  'group',
];

test('somente Part clássico (Block; Cylinder só girado como tampo) e SpawnLocation', () => {
  for (const p of parts) {
    assert.ok(['Part', 'SpawnLocation'].includes(p.className), `${p.name}: classe ${p.className}`);
    assert.ok(['Block', 'Cylinder'].includes(p.shape), `${p.name}: shape ${p.shape}`);
    if (p.rotation && p.shape !== 'Cylinder') {
      // ruínas (entulho, placas caídas) podem girar, mas só em torno de Y: continuam deitadas no piso
      assert.ok(p.model.includes('Ruínas'), `${p.model}/${p.name}: só cilindros e ruínas podem ser girados`);
      assert.ok(p.rotation[0] % 90 === 0 && p.rotation[2] % 90 === 0, `${p.name}: ruína girada fora de Y`);
      assert.equal(p.canCollide, false, `${p.name}: ruína girada não pode colidir`);
    }
  }
});

test('materiais: Plastic em tudo, Neon apenas em lâmpadas sem colisão', () => {
  for (const p of parts) {
    assert.ok(['Plastic', 'Neon'].includes(p.material), `${p.name}: material ${p.material}`);
    if (p.material === 'Neon') assert.equal(p.canCollide, false, `${p.name}: Neon não deve colidir`);
    if (p.light) assert.equal(p.material, 'Neon', `${p.name}: luz precisa estar numa peça Neon`);
  }
});

test('sem textura, decal, UI, NPC ou script: só os campos conhecidos de Part', () => {
  for (const p of parts) {
    for (const k of Object.keys(p)) assert.ok(ALLOWED_KEYS.includes(k), `${p.name}: campo inesperado "${k}"`);
    assert.ok(!/npc|dummy|humanoid|gui|decal|texture|script/i.test(`${p.model}/${p.name}`), `${p.model}/${p.name}`);
  }
});

test('cores neutras (saturação HSV <= 0.3)', () => {
  for (const p of parts) {
    assert.ok(saturation(p.color) <= 0.3, `${p.model}/${p.name}: cor saturada ${p.color}`);
    if (p.light) assert.ok(saturation(p.light.color) <= 0.3, `${p.name}: luz saturada`);
  }
});

test('relevo clássico (Inlet/Weld/Universal) só em peças opacas de Plastic', () => {
  for (const p of parts.filter((x) => x.surface)) {
    assert.ok(['Inlet', 'Weld', 'Universal'].includes(p.surface), `${p.name}: superfície ${p.surface}`);
    assert.equal(p.material, 'Plastic', `${p.name}: relevo em ${p.material}`);
    assert.equal(p.transparency, 0, `${p.name}: relevo em peça transparente`);
  }
});

test('superfícies grandes não estouram: paredes, pisos e colunas em tons médios', async () => {
  const { C } = await import('../src/palette.js');
  for (const k of ['wall', 'cellWall', 'column', 'floor', 'floorAtrium', 'floorCorridor', 'cellFloor', 'tunnel']) {
    assert.ok(Math.max(...C[k]) <= 215, `C.${k} = ${C[k]} (claro demais: estoura com gráficos baixos)`);
  }
});

test('studs só em superfícies pisáveis baixas', () => {
  for (const p of parts.filter((x) => x.studs)) {
    assert.ok(p.size[1] <= 1, `${p.name}: studs numa peça alta (${p.size[1]})`);
  }
});

test('valores numéricos válidos e transparência controlada', () => {
  for (const p of parts) {
    for (const v of [...p.position, ...p.size]) assert.ok(Number.isFinite(v), `${p.name}: número inválido`);
    for (const v of p.size) assert.ok(v >= 0.04 && v <= 2048, `${p.name}: tamanho ${v}`);
    assert.ok(p.transparency >= 0 && p.transparency <= 0.8, `${p.name}: transparência ${p.transparency}`);
    for (const c of p.color) assert.ok(Number.isInteger(c) && c >= 0 && c <= 255, `${p.name}: cor ${p.color}`);
  }
});

test('orçamento: até 5000 Parts e 120 luzes', () => {
  const s = stats(parts);
  assert.ok(s.total <= 5000, `${s.total} Parts`);
  assert.ok(s.lights <= 120, `${s.lights} luzes`);
});

test('determinístico: duas montagens geram exatamente o mesmo mapa', () => {
  assert.deepEqual(buildPrison(), buildPrison());
});
