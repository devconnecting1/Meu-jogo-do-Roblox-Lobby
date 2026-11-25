// Construções da vila (src/props/buildings.js): cada tipo, virado para os 4 lados e com várias
// sementes, precisa ficar de pé, sem z-fighting, dentro do terreno declarado e do orçamento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBuilder, aabb } from '../src/builder.js';
import { findFloating, findZFighting } from '../src/checks.js';
import { C } from '../src/palette.js';
import { BUILDINGS, FACES, building, footprint } from '../src/props/buildings.js';

/** Sorteio determinístico (mesmo algoritmo do mapa), só para os testes. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EPS = 0.01;
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];
const BUDGET = { casa: 40, celeiro: 45, moinho: 30, poco: 20, torre: 35, feno: 12, tenda: 25 };
const MAX_H = { casa: 22, celeiro: 24, moinho: 36, poco: 12, torre: 30, feno: 8, tenda: 10 };
const DOOR = { casa: 'Porta', celeiro: 'Folha da Porta', moinho: 'Porta', tenda: 'Entrada' };
const PALETTE = new Set(Object.values(C).map((c) => c.join(',')));
const BANNED = /npc|dummy|humanoid|gui|decal|texture|script/i;
const label = (p) => `${p.model}/${p.name} @ [${p.position.join(', ')}]`;
const tilted = (p) => p.rotation && (p.rotation[0] % 360 !== 0 || p.rotation[2] % 360 !== 0);

/** Chão de grama com topo em y e a construção em cima. */
function montar(kind, face, seed, [x, y, z] = [0, 0, 0]) {
  const b = makeBuilder();
  b.span('Chão', 'Chão', [x - 40, y - 2, z - 40], [x + 40, y, z + 40], C.grass);
  const own = building(b, 'Teste', kind, x, y, z, face, mulberry32(seed));
  return { all: b.parts, own };
}

/** Todos os problemas de uma montagem, com etiqueta legível. */
function problemas(kind, face, seed, origin = [0, 0, 0]) {
  const [x, y, z] = origin;
  const { all, own } = montar(kind, face, seed, origin);
  const tag = `[${kind} ${face} semente ${seed}]`;
  const out = [];
  const { w, d } = footprint(kind, face);
  if (own.length === 0) out.push(`${tag} nenhuma peça`);
  if (own.length > BUDGET[kind]) out.push(`${tag} ${own.length} peças (máximo ${BUDGET[kind]})`);
  for (const m of findFloating(all, 'Chão')) out.push(`${tag} ${m}`);
  for (const m of findZFighting(all)) out.push(`${tag} ${m}`);
  for (const p of own) {
    const { min, max } = aabb(p);
    if (!PALETTE.has(p.color.join(','))) out.push(`${tag} cor fora da paleta: ${label(p)}`);
    if (BANNED.test(`${p.model}/${p.name}`)) out.push(`${tag} nome proibido: ${label(p)}`);
    if (p.material !== 'Plastic') out.push(`${tag} material ${p.material}: ${label(p)}`);
    if (p.light) out.push(`${tag} luz numa construção: ${label(p)}`);
    if (!(p.transparency >= 0 && p.transparency <= 0.8)) out.push(`${tag} transparência: ${label(p)}`);
    if (p.size.some((s) => !(s >= 0.04))) out.push(`${tag} tamanho ${p.size}: ${label(p)}`);
    if (tilted(p) && p.canCollide) out.push(`${tag} inclinada com colisão: ${label(p)}`);
    if (min[0] < x - w / 2 - EPS || max[0] > x + w / 2 + EPS || min[2] < z - d / 2 - EPS || max[2] > z + d / 2 + EPS)
      out.push(`${tag} fora do terreno ${w}×${d}: ${label(p)}`);
    if (min[1] < y - 0.1 - EPS) out.push(`${tag} enterrada mais de 0,1: ${label(p)}`);
    if (max[1] > y + MAX_H[kind] + EPS) out.push(`${tag} mais alta que ${MAX_H[kind]}: ${label(p)}`);
  }
  return out;
}

test('terreno declarado: até 26×26 e leste/oeste giram largura e profundidade', () => {
  for (const [kind, { w, d }] of Object.entries(BUILDINGS)) {
    assert.ok(w > 0 && d > 0 && w <= 26 && d <= 26, `${kind}: ${w}×${d}`);
    assert.deepEqual(footprint(kind, 'n'), { w, d });
    assert.deepEqual(footprint(kind, 's'), { w, d });
    assert.deepEqual(footprint(kind, 'e'), { w: d, d: w });
    assert.deepEqual(footprint(kind, 'w'), { w: d, d: w });
  }
});

for (const kind of Object.keys(BUILDINGS)) {
  test(`${kind}: de pé, sem z-fighting, no terreno, na paleta e no orçamento (4 lados)`, () => {
    const out = [];
    for (const face of FACES) for (const seed of SEEDS) out.push(...problemas(kind, face, seed));
    assert.deepEqual(out, []);
  });
}

test('fora da origem e sobre chão alto continua tudo certo', () => {
  const out = [];
  for (const kind of Object.keys(BUILDINGS)) {
    for (const face of FACES) out.push(...problemas(kind, face, 7, [137, 4, -83]));
  }
  assert.deepEqual(out, []);
});

test('a porta fica no lado pedido', () => {
  const dir = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  for (const [kind, name] of Object.entries(DOOR)) {
    for (const face of FACES) {
      const { own } = montar(kind, face, 1);
      const doors = own.filter((p) => p.name === name);
      assert.ok(doors.length > 0, `${kind}: sem "${name}"`);
      for (const p of doors) {
        const [dx, dz] = dir[face];
        const ahead = p.position[0] * dx + p.position[2] * dz;
        const side = Math.abs(p.position[0] * dz - p.position[2] * dx);
        assert.ok(ahead > 0 && ahead > side, `${kind} ${face}: ${label(p)}`);
      }
    }
  }
});

test('determinístico: a mesma semente monta exatamente a mesma construção', () => {
  for (const kind of Object.keys(BUILDINGS)) {
    for (const face of FACES) assert.deepEqual(montar(kind, face, 42).own, montar(kind, face, 42).own);
  }
});

test('tipo ou lado desconhecido é recusado', () => {
  const b = makeBuilder();
  assert.throws(() => building(b, 'Teste', 'castelo', 0, 0, 0, 's', mulberry32(1)));
  assert.throws(() => building(b, 'Teste', 'casa', 0, 0, 0, 'x', mulberry32(1)));
  assert.throws(() => footprint('castelo', 's'));
});
