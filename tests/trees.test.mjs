// Árvores variadas (src/props/trees.js): cada tipo se apoia no chão, não tem z-fighting,
// só o tronco colide, cabe no orçamento de peças, na altura máxima e no raio declarado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBuilder, aabb } from '../src/builder.js';
import { findFloating, findZFighting } from '../src/checks.js';
import { C } from '../src/palette.js';
import { materialFor } from '../src/materials.js';
import { TREE_KINDS, TREE_RADIUS, plantTree, bush, flowerPatch } from '../src/props/trees.js';

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

const PALETTE = new Set(Object.values(C).map((c) => c.join(',')));
const FORBIDDEN = /npc|dummy|humanoid|gui|decal|texture|script/i;
const SEEDS = Array.from({ length: 30 }, (_, i) => 1000 + i * 7919);
const report = (problems, max = 20) => (problems.length ? `\n${problems.slice(0, max).join('\n')}` : '');
const label = (p) => `${p.model}/${p.name} @ [${p.position.join(', ')}]`;

/** Chão de grama com topo em `top`, uma árvore em (0, top, 0), um arbusto e um canteiro. */
function plantOne(kind, seed, top = 0) {
  const b = makeBuilder();
  b.span('Chão', 'Chão', [-40, top - 2, -40], [40, top, 40], C.grass);
  const rand = mulberry32(seed);
  plantTree(b, 'Teste', kind, 0, top, 0, rand);
  bush(b, 'Teste/Arbusto', 16, top, 6, rand);
  flowerPatch(b, 'Teste/Flores', -16, top, -6, rand);
  return b.parts;
}
const treeParts = (parts) => parts.filter((p) => p.model === 'Teste');
const tilted = (p) => p.rotation && (p.rotation[0] !== 0 || p.rotation[2] !== 0);

test('cada tipo de árvore se apoia no chão e não tem z-fighting', () => {
  for (const kind of TREE_KINDS) {
    for (const seed of SEEDS) {
      const parts = plantOne(kind, seed);
      const floating = findFloating(parts, 'Chão');
      assert.equal(floating.length, 0, `${kind} (semente ${seed}):${report(floating)}`);
      const zf = findZFighting(parts);
      assert.equal(zf.length, 0, `${kind} (semente ${seed}):${report(zf)}`);
    }
  }
});

test('um só Tronco por árvore: vertical, sem rotação, com colisão, largura >= 1,2 e base no chão', () => {
  for (const top of [0, 3.6]) {
    for (const kind of TREE_KINDS) {
      for (const seed of SEEDS) {
        const tree = treeParts(plantOne(kind, seed, top));
        const trunks = tree.filter((p) => p.name === 'Tronco');
        assert.equal(trunks.length, 1, `${kind}: ${trunks.length} peças "Tronco"`);
        const [t] = trunks;
        assert.equal(t.rotation, null, `${kind}: tronco girado`);
        assert.equal(t.canCollide, true, `${kind}: tronco sem colisão`);
        assert.ok(t.size[0] >= 1.2 && t.size[2] >= 1.2, `${kind}: tronco fino demais ${t.size}`);
        const bottom = t.position[1] - t.size[1] / 2;
        assert.ok(Math.abs(bottom - top) < 0.002, `${kind}: base do tronco em ${bottom}, chão em ${top}`);
        for (const p of tree.filter((x) => x.name === 'Tronco do Coqueiro')) {
          assert.ok(p.size[0] >= 1.2 && p.size[2] >= 1.2, `${kind}: gomo fino demais ${p.size}`);
        }
      }
    }
  }
});

test('só o Tronco colide; decoração é girada e o que é inclinado nunca colide', () => {
  for (const kind of TREE_KINDS) {
    for (const seed of SEEDS) {
      for (const p of plantOne(kind, seed).filter((x) => x.model !== 'Chão')) {
        if (p.canCollide) assert.equal(p.name, 'Tronco', `${label(p)} colide`);
        if (tilted(p)) assert.equal(p.canCollide, false, `${label(p)} inclinada com colisão`);
        if (!p.name.startsWith('Tronco')) assert.ok(p.rotation, `${label(p)} sem rotação (entraria no z-fighting)`);
      }
    }
  }
});

test('cores da paleta, medidas >= 0,04 e nomes permitidos', () => {
  for (const kind of TREE_KINDS) {
    for (const seed of SEEDS) {
      for (const p of plantOne(kind, seed)) {
        assert.ok(PALETTE.has(p.color.join(',')), `${label(p)}: cor fora da paleta ${p.color}`);
        for (const v of [...p.position, ...p.size]) assert.ok(Number.isFinite(v), `${label(p)}: número inválido`);
        for (const v of p.size) assert.ok(v >= 0.04, `${label(p)}: tamanho ${v}`);
        assert.ok(!FORBIDDEN.test(`${p.model}/${p.name}`), `${label(p)}: nome proibido`);
        assert.equal(p.material, materialFor(p.color), `${label(p)}: material ${p.material}`);
        assert.equal(p.transparency, 0, `${label(p)}: transparente`);
        if (p.rotation) assert.equal(p.rotation[0], 0, `${label(p)}: giro em X (use Y e Z)`);
      }
    }
  }
});

test('até 30 studs de altura e copa dentro de TREE_RADIUS', () => {
  for (const kind of TREE_KINDS) {
    assert.ok(TREE_RADIUS[kind] > 0, `${kind} sem raio em TREE_RADIUS`);
    for (const top of [0, 3.6]) {
      for (const seed of SEEDS) {
        for (const p of treeParts(plantOne(kind, seed, top))) {
          const { min, max } = aabb(p);
          assert.ok(max[1] <= top + 30 + 1e-6, `${label(p)}: topo em ${max[1].toFixed(2)}`);
          assert.ok(min[1] >= top - 0.1, `${label(p)}: enterrada até ${min[1].toFixed(2)}`);
          const reach = Math.max(-min[0], max[0], -min[2], max[2]);
          assert.ok(reach <= TREE_RADIUS[kind] + 1e-6, `${label(p)}: copa a ${reach.toFixed(2)} do eixo`);
        }
      }
    }
  }
});

test('orçamento: até 12 peças por árvore (média até ~8), arbusto até 3 e canteiro até 8', () => {
  let total = 0;
  let trees = 0;
  for (const kind of TREE_KINDS) {
    for (const seed of SEEDS) {
      const parts = plantOne(kind, seed);
      const n = treeParts(parts).length;
      assert.ok(n <= 12, `${kind} (semente ${seed}): ${n} peças`);
      total += n;
      trees++;
      const bushParts = parts.filter((p) => p.model === 'Teste/Arbusto');
      assert.ok(bushParts.length >= 1 && bushParts.length <= 3, `arbusto com ${bushParts.length} peças`);
      const flowers = parts.filter((p) => p.model === 'Teste/Flores');
      assert.ok(flowers.length >= 6 && flowers.length <= 8, `canteiro com ${flowers.length} peças`);
    }
  }
  assert.ok(total / trees <= 8.5, `média de ${(total / trees).toFixed(2)} peças por árvore`);
});

test('arbustos e flores: sem colisão, caule verde-escuro e flores coloridas', () => {
  const blooms = new Set([C.flowerRed, C.flowerYellow, C.blossom, C.cloth].map((c) => c.join(',')));
  for (const seed of SEEDS) {
    const parts = plantOne('carvalho', seed);
    for (const p of parts.filter((x) => x.model === 'Teste/Arbusto' || x.model === 'Teste/Flores')) {
      assert.equal(p.canCollide, false, `${label(p)} colide`);
      if (p.name === 'Caule') assert.deepEqual(p.color, C.leafDark, `${label(p)}: caule fora do tom`);
      if (p.name === 'Flor') assert.ok(blooms.has(p.color.join(',')), `${label(p)}: flor sem cor de flor`);
    }
    const flowers = parts.filter((p) => p.model === 'Teste/Flores');
    assert.equal(flowers.filter((p) => p.name === 'Caule').length, flowers.filter((p) => p.name === 'Flor').length);
  }
});

test('cada tipo tem cara própria (peças características)', () => {
  const names = (kind) => {
    const all = new Map();
    for (const seed of SEEDS) {
      const counts = new Map();
      for (const p of treeParts(plantOne(kind, seed))) counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
      all.set(seed, counts);
    }
    return all;
  };
  const range = (kind, name, lo, hi) => {
    for (const [seed, counts] of names(kind)) {
      const n = counts.get(name) ?? 0;
      assert.ok(n >= lo && n <= hi, `${kind} (semente ${seed}): ${n} × "${name}" (esperado ${lo} a ${hi})`);
    }
  };
  range('carvalho', 'Galho', 1, 1);
  range('carvalho', 'Copa', 4, 6);
  range('outono', 'Copa', 4, 6);
  range('outono', 'Folhas Caídas', 1, 1);
  range('pinheiro', 'Copa', 6, 10); // 3 a 5 camadas em estrela
  range('pinheiro', 'Ponta', 1, 1);
  range('betula', 'Faixa do Tronco', 2, 3);
  range('cerejeira', 'Flores Pendentes', 2, 3);
  range('redonda', 'Copa', 4, 5);
  range('seca', 'Galho', 2, 4);
  range('seca', 'Copa', 0, 0);
  range('coqueiro', 'Tronco do Coqueiro', 3, 4); // 4 ou 5 gomos com o Tronco
  range('coqueiro', 'Folha de Coqueiro', 5, 6);
  range('coqueiro', 'Coco', 2, 3);
  // cores: bétula clara, cerejeira rosa, outono laranja, pinheiro escuro, coqueiro de praia
  const colorOf = (kind, name) =>
    new Set(
      treeParts(plantOne(kind, 7))
        .filter((p) => p.name === name)
        .map((p) => String(p.color)),
    );
  assert.ok(colorOf('betula', 'Tronco').has(String(C.birchBark)));
  assert.ok([...colorOf('cerejeira', 'Copa')].every((c) => [String(C.blossom), String(C.blossomDark)].includes(c)));
  assert.ok([...colorOf('outono', 'Copa')].every((c) => [String(C.autumn), String(C.autumnDark)].includes(c)));
  assert.ok([...colorOf('pinheiro', 'Copa')].every((c) => [String(C.pine), String(C.pineDark)].includes(c)));
  assert.ok([...colorOf('coqueiro', 'Folha de Coqueiro')].every((c) => c === String(C.palmLeaf)));
  assert.ok(colorOf('seca', 'Tronco').has(String(C.deadWood)));
});

test('variedade: cada tipo muda de altura conforme a semente', () => {
  for (const kind of TREE_KINDS) {
    const heights = new Set(
      SEEDS.map((seed) => Math.max(...treeParts(plantOne(kind, seed)).map((p) => aabb(p).max[1])).toFixed(1)),
    );
    assert.ok(heights.size >= 5, `${kind}: só ${heights.size} alturas diferentes`);
  }
});

test('floresta densa: copas vizinhas se cruzam sem z-fighting e tudo fica apoiado', () => {
  const b = makeBuilder();
  b.span('Chão', 'Chão', [-60, -2, -60], [60, 0, 60], C.grass);
  const rand = mulberry32(20260114);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 6; j++) {
      const x = -21 + i * 6;
      const z = -15 + j * 6;
      plantTree(b, 'Floresta', TREE_KINDS[(i + j) % TREE_KINDS.length], x, 0, z, rand);
      bush(b, 'Floresta/Arbustos', x + 3, 0, z + 3, rand);
      flowerPatch(b, 'Floresta/Flores', x + 3, 0, z, rand);
    }
  }
  assert.equal(b.parts.filter((p) => p.name === 'Tronco').length, 48);
  const floating = findFloating(b.parts, 'Chão');
  assert.equal(floating.length, 0, report(floating));
  const zf = findZFighting(b.parts);
  assert.equal(zf.length, 0, report(zf));
});

test('sorteio só pelo rand() recebido: sem Math.random e mesma semente = mesma árvore', () => {
  const original = Math.random;
  Math.random = () => {
    throw new Error('Math.random usado em src/props/trees.js');
  };
  try {
    for (const kind of TREE_KINDS) assert.deepEqual(plantOne(kind, 42), plantOne(kind, 42), kind);
  } finally {
    Math.random = original;
  }
});

test('tipo de árvore desconhecido gera erro', () => {
  assert.throws(() => plantTree(makeBuilder(), 'Teste', 'baobá', 0, 0, 0, mulberry32(1)), /desconhecido/);
});
