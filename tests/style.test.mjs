// Regras de estilo: Part clássico, sem textura/UI/NPC/script, cores da paleta e orçamento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMap, DIM } from '../src/map.js';
import { C, saturation } from '../src/palette.js';
import { stats } from '../src/builder.js';

const { parts } = buildMap();
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
const PALETTE = new Set(Object.values(C).map((c) => c.join(',')));

test('somente Part clássico (Block, Cylinder ou Ball) e SpawnLocation', () => {
  for (const p of parts) {
    assert.ok(['Part', 'SpawnLocation'].includes(p.className), `${p.name}: classe ${p.className}`);
    assert.ok(['Block', 'Cylinder', 'Ball'].includes(p.shape), `${p.name}: shape ${p.shape}`);
  }
});

test('materiais: SmoothPlastic em tudo (blocos lisos); Neon só em lâmpada sem colisão e com luz', () => {
  for (const p of parts) {
    assert.ok(['SmoothPlastic', 'Neon'].includes(p.material), `${p.name}: material ${p.material}`);
    if (p.material === 'Neon') {
      assert.equal(p.canCollide, false, `${p.name}: Neon não deve colidir`);
      assert.ok(p.light, `${p.model}/${p.name}: Neon sem luz é lâmpada falsa`);
    }
    if (p.light) assert.equal(p.material, 'Neon', `${p.name}: luz precisa estar numa peça Neon`);
  }
});

test('sem textura, decal, UI, NPC ou script: só os campos conhecidos de Part', () => {
  for (const p of parts) {
    for (const k of Object.keys(p)) assert.ok(ALLOWED_KEYS.includes(k), `${p.name}: campo inesperado "${k}"`);
    assert.ok(!/npc|dummy|humanoid|gui|decal|texture|script/i.test(`${p.model}/${p.name}`), `${p.model}/${p.name}`);
  }
});

test('cores neutras: toda cor vem da paleta e nenhuma é berrante (saturação HSV <= 0,55)', () => {
  for (const c of Object.values(C)) assert.ok(saturation(c) <= 0.55, `cor saturada demais na paleta: ${c}`);
  for (const p of parts)
    assert.ok(PALETTE.has(p.color.join(',')), `${p.model}/${p.name}: cor fora da paleta ${p.color}`);
});

test('estilo voxel liso: nenhuma peça com studs, inlet ou relevo nas faces', () => {
  for (const p of parts) {
    assert.equal(p.studs, false, `${p.model}/${p.name}: studs`);
    assert.equal(p.surface, null, `${p.model}/${p.name}: relevo ${p.surface}`);
  }
});

test('valores numéricos válidos e transparência controlada', () => {
  for (const p of parts) {
    for (const v of [...p.position, ...p.size]) assert.ok(Number.isFinite(v), `${p.name}: número inválido`);
    for (const v of p.size) assert.ok(v >= 0.04 && v <= 2048, `${p.model}/${p.name}: tamanho ${v}`);
    assert.ok(p.transparency >= 0 && p.transparency <= 0.8, `${p.name}: transparência ${p.transparency}`);
    for (const c of p.color) assert.ok(Number.isInteger(c) && c >= 0 && c <= 255, `${p.name}: cor ${p.color}`);
  }
});

test('orçamento: até DIM.maxParts Parts e 60 luzes', () => {
  const s = stats(parts);
  assert.ok(s.total <= DIM.maxParts, `${s.total} Parts (máx. ${DIM.maxParts})`);
  assert.ok(s.lights <= 60, `${s.lights} luzes`);
});

test('determinístico: duas montagens geram exatamente o mesmo mapa', () => {
  assert.deepEqual(buildMap(), buildMap());
});
