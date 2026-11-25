// Peças do Lobby (src/props/lobby.js): lojas, banco de praça, vaso, arco e lampião.
// Cada peça, sozinha sobre um chão plano (e virada para os 4 lados, quando tem frente), precisa
// ficar de pé, sem z-fighting, na paleta, dentro do terreno declarado e sem nada inclinado com colisão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBuilder, aabb } from '../src/builder.js';
import { findFloating, findZFighting, intersects } from '../src/checks.js';
import { C } from '../src/palette.js';
import { materialFor } from '../src/materials.js';
import { FACES } from '../src/props/buildings.js';
import { SHOPS, shop, shopFootprint, bench, planter, archGate, lampPost } from '../src/props/lobby.js';

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
const SEEDS = [1, 2, 3, 5, 8, 13];
const BUDGET = 160; // peças por loja
const MAX_H = { padaria: 18, ferreiro: 18, armazem: 16, taverna: 21 };
const PALETTE = new Set(Object.values(C).map((c) => c.join(',')));
const BANNED = /gui|npc|dummy|humanoid|decal|texture|script/i;
const label = (p) => `${p.model}/${p.name} @ [${p.position.join(', ')}]`;
const tilted = (p) => p.rotation && (p.rotation[0] % 360 !== 0 || p.rotation[2] % 360 !== 0);

/** Chão de grama de 80 × 80 com topo em y e a peça em cima (build recebe o construtor). */
function montar(build, [x, y, z] = [0, 0, 0]) {
  const b = makeBuilder();
  b.span('Chão', 'Chão', [x - 40, y - 2, z - 40], [x + 40, y, z + 40], C.grass);
  const own = build(b);
  return { all: b.parts, own };
}

/** Problemas comuns a toda peça: apoio, z-fighting, paleta, estilo, colisão e altura. */
function comuns(tag, all, own, y, maxH) {
  const out = [];
  if (own.length === 0) out.push(`${tag} nenhuma peça`);
  for (const m of findFloating(all, 'Chão')) out.push(`${tag} ${m}`);
  for (const m of findZFighting(all)) out.push(`${tag} ${m}`);
  for (const p of own) {
    const { min, max } = aabb(p);
    if (!PALETTE.has(p.color.join(','))) out.push(`${tag} cor fora da paleta: ${label(p)}`);
    if (BANNED.test(`${p.model}/${p.name}`)) out.push(`${tag} nome proibido: ${label(p)}`);
    if (p.material !== materialFor(p.color)) out.push(`${tag} material ${p.material} (nada de Neon): ${label(p)}`);
    if (p.light) out.push(`${tag} luz numa peça do Lobby: ${label(p)}`);
    if (!(p.transparency >= 0 && p.transparency <= 0.8)) out.push(`${tag} transparência: ${label(p)}`);
    if (p.size.some((s) => !(s >= 0.04))) out.push(`${tag} tamanho ${p.size}: ${label(p)}`);
    if (tilted(p) && p.canCollide) out.push(`${tag} inclinada com colisão: ${label(p)}`);
    if (min[1] < y - 0.1 - EPS) out.push(`${tag} enterrada mais de 0,1: ${label(p)}`);
    if (max[1] > y + maxH + EPS) out.push(`${tag} mais alta que ${maxH}: ${label(p)}`);
    if (p.name.startsWith('Água') && (p.canCollide || p.studs || p.transparency !== 0.25))
      out.push(`${tag} água com colisão, studs ou opaca: ${label(p)}`);
  }
  return out;
}

/** Todos os problemas de uma loja montada em `origin`, com etiqueta legível. */
function problemasLoja(kind, face, seed, origin = [0, 0, 0]) {
  const [x, y, z] = origin;
  const { all, own } = montar((b) => shop(b, 'Teste', kind, x, y, z, face, mulberry32(seed)), origin);
  const tag = `[${kind} ${face} semente ${seed}]`;
  const out = comuns(tag, all, own, y, MAX_H[kind]);
  if (own.length > BUDGET) out.push(`${tag} ${own.length} peças (máximo ${BUDGET})`);
  const { w, d } = shopFootprint(kind, face);
  for (const p of own) {
    const { min, max } = aabb(p);
    if (min[0] < x - w / 2 - EPS || max[0] > x + w / 2 + EPS || min[2] < z - d / 2 - EPS || max[2] > z + d / 2 + EPS)
      out.push(`${tag} fora do terreno ${w}×${d}: ${label(p)}`);
  }
  return out;
}

const shopParts = (kind, face = 's', seed = 1) =>
  montar((b) => shop(b, 'Teste', kind, 0, 0, 0, face, mulberry32(seed))).own;
const names = (parts) => new Set(parts.map((p) => p.name));

test('terreno das lojas: até 22×22 e leste/oeste giram largura e profundidade', () => {
  for (const [kind, { w, d }] of Object.entries(SHOPS)) {
    assert.ok(w > 0 && d > 0 && w <= 22 && d <= 22, `${kind}: ${w}×${d}`);
    assert.deepEqual(shopFootprint(kind, 'n'), { w, d });
    assert.deepEqual(shopFootprint(kind, 's'), { w, d });
    assert.deepEqual(shopFootprint(kind, 'e'), { w: d, d: w });
    assert.deepEqual(shopFootprint(kind, 'w'), { w: d, d: w });
  }
});

for (const kind of Object.keys(SHOPS)) {
  test(`loja ${kind}: de pé, sem z-fighting, no terreno, na paleta e no orçamento (4 lados)`, () => {
    const out = [];
    for (const face of FACES) for (const seed of SEEDS) out.push(...problemasLoja(kind, face, seed));
    assert.deepEqual(out, []);
  });
}

test('lojas fora da origem e sobre chão alto continuam certas', () => {
  const out = [];
  for (const kind of Object.keys(SHOPS)) {
    for (const face of FACES) out.push(...problemasLoja(kind, face, 7, [137, 6, -83]));
  }
  assert.deepEqual(out, []);
});

test('loja de verdade: base, paredes, vitrine com balcão, porta, placa pendurada, toldo listrado e telhado', () => {
  const required = [
    'Base de Pedra',
    'Parede',
    'Fundo da Vitrine',
    'Prateleira',
    'Balcão',
    'Caixilho',
    'Porta',
    'Batente',
    'Verga',
    'Degrau',
    'Suporte da Placa',
    'Placa',
    'Emblema',
    'Toldo',
    'Franja',
    'Telhado',
    'Cumeeira',
  ];
  for (const kind of Object.keys(SHOPS)) {
    const own = shopParts(kind);
    const has = names(own);
    for (const n of required) assert.ok(has.has(n), `${kind}: sem "${n}"`);
    // placa e toldo não colidem; o toldo é listrado (pano + uma cor)
    for (const p of own.filter((q) => ['Placa', 'Suporte da Placa', 'Corrente', 'Toldo', 'Franja'].includes(q.name)))
      assert.equal(p.canCollide, false, `${kind}: ${label(p)} colide`);
    const stripes = new Set(own.filter((p) => p.name === 'Toldo').map((p) => p.color.join(',')));
    assert.ok(stripes.size >= 2 && stripes.has(C.cloth.join(',')), `${kind}: toldo sem listras de pano`);
    // telhado sólido em degraus: nenhuma peça de telhado girada
    for (const p of own.filter((q) => q.name === 'Telhado')) assert.equal(p.rotation, null, `${kind}: ${label(p)}`);
  }
});

test('chaminé na padaria e no ferreiro, acima do telhado', () => {
  for (const kind of ['padaria', 'ferreiro']) {
    const own = shopParts(kind);
    const chimney = own.filter((p) => p.name === 'Chaminé');
    assert.equal(chimney.length, 1, `${kind}: sem chaminé`);
    const roofTop = Math.max(...own.filter((p) => p.name === 'Telhado').map((p) => aabb(p).max[1]));
    assert.ok(aabb(chimney[0]).max[1] > roofTop + 1, `${kind}: a chaminé não passa do telhado`);
  }
});

test('vitrine aberta: o balcão sai pela janela e nada tapa o vão acima da mercadoria', () => {
  for (const kind of Object.keys(SHOPS)) {
    const own = shopParts(kind, 's');
    const counter = aabb(own.find((p) => p.name === 'Balcão'));
    const wallFront = Math.max(...own.filter((p) => p.name === 'Parede').map((p) => aabb(p).max[2]));
    assert.ok(counter.max[2] > wallFront + 0.3, `${kind}: o balcão não sai pela janela`);
    // vão livre entre a mercadoria do balcão e a prateleira, do fundo do nicho até a fachada
    const gap = {
      min: [counter.min[0] + 0.1, counter.max[1] + 1, counter.min[2] + 0.1],
      max: [counter.max[0] - 0.1, 4.95, wallFront - 0.1],
    };
    const blocking = own.filter((p) => intersects(gap, aabb(p)));
    assert.deepEqual(blocking.map(label), [], `${kind}: vitrine tapada`);
  }
});

test('cada loja tem a sua cara: paredes e telhados de cores diferentes e enfeites próprios na calçada', () => {
  const PROPS = {
    padaria: ['Caixote de Pães', 'Pão', 'Saco de Farinha'],
    ferreiro: ['Bigorna', 'Forja', 'Tina', 'Telhado do Alpendre'],
    armazem: ['Barril', 'Caixote', 'Portinhola do Sótão'],
    taverna: ['Mesa', 'Banco', 'Barril', 'Andar de Cima'],
  };
  const looks = new Set();
  for (const [kind, list] of Object.entries(PROPS)) {
    const own = shopParts(kind);
    const has = names(own);
    for (const n of list) assert.ok(has.has(n), `${kind}: sem "${n}"`);
    const wall = own.find((p) => p.name === 'Parede').color.join(',');
    const roof = own.find((p) => p.name === 'Telhado').color.join(',');
    looks.add(wall);
    looks.add(roof);
  }
  assert.equal(looks.size, 2 * Object.keys(PROPS).length, 'duas lojas com a mesma parede ou o mesmo telhado');
});

test('a porta da loja fica no lado pedido', () => {
  const dir = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  for (const kind of Object.keys(SHOPS)) {
    for (const face of FACES) {
      const doors = shopParts(kind, face).filter((p) => p.name === 'Porta');
      assert.equal(doors.length, 1, `${kind}: ${doors.length} portas`);
      const [dx, dz] = dir[face];
      const ahead = doors[0].position[0] * dx + doors[0].position[2] * dz;
      assert.ok(ahead > 2, `${kind} ${face}: ${label(doors[0])}`);
    }
  }
});

test('banco de praça: de pé nos 4 lados, sentável (assento a ~1,7) e com encosto atrás', () => {
  const out = [];
  for (const face of FACES) {
    for (const seed of SEEDS) {
      const { all, own } = montar((b) => bench(b, 'Banco', 0, 0, 0, face, mulberry32(seed)));
      out.push(...comuns(`[banco ${face} ${seed}]`, all, own, 0, 4));
      const seat = own.filter((p) => p.name === 'Ripa do Assento');
      if (seat.length !== 3) out.push(`[banco ${face}] ${seat.length} ripas no assento`);
      for (const p of seat) if (Math.abs(aabb(p).max[1] - 1.7) > EPS) out.push(`[banco ${face}] assento fora de 1,7`);
      if (!own.some((p) => p.name === 'Ripa do Encosto')) out.push(`[banco ${face}] sem encosto`);
      for (const p of own) {
        const { min, max } = aabb(p);
        if (Math.max(-min[0], max[0], -min[2], max[2]) > 2.2 + EPS)
          out.push(`[banco ${face}] fora de 4,4: ${label(p)}`);
      }
    }
  }
  assert.deepEqual(out, []);
});

test('vaso com árvore: de pé, a copa não colide e tudo cabe no quadrado de 4,4', () => {
  const out = [];
  for (const seed of [...SEEDS, 21, 34, 55, 89]) {
    for (const origin of [
      [0, 0, 0],
      [-23, 6, 41],
    ]) {
      const [x, y, z] = origin;
      const { all, own } = montar((b) => planter(b, 'Vaso', x, y, z, mulberry32(seed)), origin);
      out.push(...comuns(`[vaso ${seed}]`, all, own, y, 9));
      for (const p of own) {
        const { min, max } = aabb(p);
        if (Math.max(x - min[0], max[0] - x, z - min[2], max[2] - z) > 2.2 + EPS)
          out.push(`[vaso ${seed}] fora de 4,4: ${label(p)}`);
        if (p.name === 'Copa' && p.canCollide) out.push(`[vaso ${seed}] copa com colisão: ${label(p)}`);
      }
      for (const n of ['Vaso', 'Terra do Vaso', 'Tronco', 'Copa'])
        if (!own.some((p) => p.name === n)) out.push(`[vaso ${seed}] sem ${n}`);
    }
  }
  assert.deepEqual(out, []);
});

test('arco de pedra: de pé, verga acima de 9 e passagem livre (nada com colisão abaixo de 8)', () => {
  const out = [];
  for (const axis of ['x', 'z']) {
    for (const width of [10, 12]) {
      for (const origin of [
        [0, 0, 0],
        [55, 6, -12],
      ]) {
        const [x, y, z] = origin;
        const tag = `[arco ${axis} ${width} em ${origin}]`;
        const { all, own } = montar((b) => archGate(b, 'Arco', x, y, z, axis, width), origin);
        out.push(...comuns(tag, all, own, y, 14));
        const lintel = own.filter((p) => p.name === 'Verga do Arco');
        if (lintel.length !== 1) out.push(`${tag} ${lintel.length} vergas`);
        else if (aabb(lintel[0]).min[1] < y + 9 - EPS) out.push(`${tag} verga abaixo de 9`);
        const h = width / 2;
        const zone =
          axis === 'x'
            ? { min: [x - 4, y, z - h], max: [x + 4, y + 8, z + h] }
            : { min: [x - h, y, z - 4], max: [x + h, y + 8, z + 4] };
        for (const p of own)
          if (p.canCollide && intersects(zone, aabb(p))) out.push(`${tag} bloqueia a passagem: ${label(p)}`);
        if (own.filter((p) => p.name === 'Pilar do Arco' && p.canCollide).length !== 2)
          out.push(`${tag} sem 2 pilares`);
      }
    }
  }
  assert.deepEqual(out, []);
});

test('lampião: poste de ferro com lanterna de vidro claro (Plastic, sem luz)', () => {
  for (const origin of [
    [0, 0, 0],
    [12, 6, 30],
  ]) {
    const [x, y, z] = origin;
    const { all, own } = montar((b) => lampPost(b, 'Lampião', x, y, z), origin);
    assert.deepEqual(comuns('[lampião]', all, own, y, 10), []);
    const glass = own.filter((p) => p.name === 'Vidro da Lanterna');
    assert.equal(glass.length, 1, 'sem vidro');
    assert.deepEqual(glass[0].color, C.cloth, 'vidro fora de C.cloth');
    assert.deepEqual(own.find((p) => p.name === 'Haste do Lampião').color, C.iron, 'haste não é de ferro');
  }
});

test('determinístico: a mesma semente monta exatamente a mesma peça', () => {
  for (const kind of Object.keys(SHOPS)) {
    for (const face of FACES) assert.deepEqual(shopParts(kind, face, 42), shopParts(kind, face, 42));
  }
  const twice = (f) => [f(), f()];
  const [a, b] = twice(() => montar((bb) => planter(bb, 'Vaso', 0, 0, 0, mulberry32(9))).own);
  assert.deepEqual(a, b);
  const [c, d] = twice(() => montar((bb) => bench(bb, 'Banco', 0, 0, 0, 'e', mulberry32(9))).own);
  assert.deepEqual(c, d);
});

test('tipo, lado ou eixo desconhecido é recusado', () => {
  const b = makeBuilder();
  assert.throws(() => shop(b, 'Teste', 'castelo', 0, 0, 0, 's', mulberry32(1)));
  assert.throws(() => shop(b, 'Teste', 'padaria', 0, 0, 0, 'x', mulberry32(1)));
  assert.throws(() => shopFootprint('castelo', 's'));
  assert.throws(() => bench(b, 'Banco', 0, 0, 0, 'x', mulberry32(1)));
  assert.throws(() => archGate(b, 'Arco', 0, 0, 0, 'y', 10));
});

test('nada de Math.random nas peças do Lobby', () => {
  const original = Math.random;
  Math.random = () => {
    throw new Error('Math.random usado em src/props/lobby.js');
  };
  try {
    for (const kind of Object.keys(SHOPS)) shopParts(kind, 'e', 3);
    montar((b) => planter(b, 'Vaso', 0, 0, 0, mulberry32(3)));
    montar((b) => bench(b, 'Banco', 0, 0, 0, 'n', mulberry32(3)));
  } finally {
    Math.random = original;
  }
});
