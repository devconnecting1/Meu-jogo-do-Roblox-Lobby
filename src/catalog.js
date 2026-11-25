// Catálogo de peças: cada peça reaproveitável (estátua, árvores, arbustos, flores e construções)
// montada sozinha sobre um chão de studs, para revisar acabamento, escala e colisão.
// Dados puros (sem DOM). Usado por tests/catalog.test.mjs, viewer/catalog.js (visualizador)
// e tools/catalog-shots.mjs (capturas do CI).
//
// Peça nova em src/props/ = entrada nova aqui. O teste do catálogo falha se alguma função
// exportada pelos módulos de src/props/ (ou algum tipo de árvore/construção) ficar de fora.

import { makeBuilder, aabb, round } from './builder.js';
import { C } from './palette.js';
import { fountainStatue } from './props/statue.js';
import { TREE_KINDS, plantTree, bush, flowerPatch } from './props/trees.js';
import { BUILDINGS, building } from './props/buildings.js';

/** Grupos do catálogo, na ordem em que aparecem no visualizador. */
export const GROUPS = Object.freeze(['Estátua', 'Árvores', 'Construções', 'Mapa']);

/** Arranjo da grade: colunas, célula mínima, folga em volta da peça e meia largura mínima do chão. */
export const CATALOG_LAYOUT = Object.freeze({ cols: 6, minCell: 60, margin: 4, minHalf: 12, padDepth: 2 });

const TREE_TITLES = Object.freeze({
  carvalho: 'Carvalho',
  pinheiro: 'Pinheiro',
  betula: 'Bétula',
  cerejeira: 'Cerejeira',
  redonda: 'Árvore redonda',
  seca: 'Árvore seca',
  coqueiro: 'Coqueiro',
  outono: 'Árvore de outono',
});

const BUILDING_TITLES = Object.freeze({
  casa: 'Casa',
  celeiro: 'Celeiro',
  moinho: 'Moinho',
  poco: 'Poço',
  torre: 'Torre de vigia',
  feno: 'Monte de feno',
  tenda: 'Tenda',
});

/**
 * Entrada do catálogo. `prop` é o nome da função exportada em src/props/ que a peça usa e
 * `kind` o tipo passado a ela (árvore ou construção), ou null.
 * `build(b, x, y, z, rand)` monta a peça com a base em (x, y, z).
 */
function entry(id, title, group, prop, kind, make) {
  const model = `Catálogo/${id}`;
  return Object.freeze({
    id,
    title,
    group,
    prop,
    kind,
    build: (b, x, y, z, rand) => make(b, model, x, y, z, rand),
  });
}

export const CATALOG = Object.freeze([
  entry('fonte', 'Fonte com a estátua clássica', 'Estátua', 'fountainStatue', null, (b, m, x, y, z) =>
    fountainStatue(b, m, x, y, z),
  ),
  ...TREE_KINDS.map((k) =>
    entry(`arvore-${k}`, TREE_TITLES[k] ?? `Árvore (${k})`, 'Árvores', 'plantTree', k, (b, m, x, y, z, rand) =>
      plantTree(b, m, k, x, y, z, rand),
    ),
  ),
  entry('arbusto', 'Arbusto', 'Árvores', 'bush', null, bush),
  entry('canteiro', 'Canteiro de flores', 'Árvores', 'flowerPatch', null, flowerPatch),
  ...Object.keys(BUILDINGS).map((k) =>
    entry(
      `construcao-${k}`,
      BUILDING_TITLES[k] ?? `Construção (${k})`,
      'Construções',
      'building',
      k,
      (b, m, x, y, z, rand) => building(b, m, k, x, y, z, 's', rand),
    ),
  ),
]);

/** Sorteio determinístico (o mesmo algoritmo do mapa). */
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

/** Semente fixa de cada entrada, tirada do id (FNV-1a): incluir uma peça nova não muda as outras. */
export function seedOf(id) {
  let h = 0x811c9dc5;
  for (const ch of id) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mesmo construtor do mapa (classicBuilder em src/map.js): studs em tudo, menos na água. */
function classicBuilder() {
  const b = makeBuilder();
  const box = b.box;
  b.box = (model, name, center, size, color, opts = {}) =>
    box(model, name, center, size, color, { studs: true, ...opts });
  return b;
}

/** Caixa envolvente de uma lista de Parts. */
function extent(parts) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const bb = aabb(p);
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], bb.min[i]);
      max[i] = Math.max(max[i], bb.max[i]);
    }
  }
  return { min, max };
}

/**
 * Monta o catálogo inteiro: cada entrada no seu chão de studs (`Chão`, C.plaza, topo em y = 0),
 * numa grade com folga. Devolve { parts, cell, entries }, onde cada entrada traz
 * { id, title, group, prop, kind, origin, pad (índice do Chão em parts), range ([início, fim) das
 * Parts da peça), padSize, center, size, parts, collidable, collidableParts }.
 */
export function buildCatalog() {
  const L = CATALOG_LAYOUT;
  // 1ª passada: mede cada peça montada na origem (mesma semente da montagem de verdade)
  const halves = CATALOG.map((e) => {
    const t = classicBuilder();
    e.build(t, 0, 0, 0, mulberry32(seedOf(e.id)));
    if (t.parts.length === 0) return L.minHalf;
    const { min, max } = extent(t.parts);
    return Math.max(L.minHalf, Math.ceil(Math.max(-min[0], max[0], -min[2], max[2]) + L.margin));
  });
  const cell = Math.max(L.minCell, 2 * Math.max(...halves) + 2 * L.margin);
  const rows = Math.ceil(CATALOG.length / L.cols);

  // 2ª passada: cada peça no centro da sua célula, sobre o seu chão
  const b = classicBuilder();
  const entries = CATALOG.map((e, i) => {
    const x = ((i % L.cols) - (L.cols - 1) / 2) * cell;
    const z = (Math.floor(i / L.cols) - (rows - 1) / 2) * cell;
    const half = halves[i];
    const pad = b.parts.length;
    b.span(`Catálogo/${e.id}`, 'Chão', [x - half, -L.padDepth, z - half], [x + half, 0, z + half], C.plaza);
    const start = b.parts.length;
    e.build(b, x, 0, z, mulberry32(seedOf(e.id)));
    const own = b.parts.slice(start);
    const { min, max } = own.length ? extent(own) : { min: [x, 0, z], max: [x, 0, z] };
    const solid = own.filter((p) => p.canCollide);
    return {
      id: e.id,
      title: e.title,
      group: e.group,
      prop: e.prop,
      kind: e.kind,
      origin: [x, 0, z],
      pad,
      range: [start, b.parts.length],
      padSize: [2 * half, 2 * half],
      center: [0, 1, 2].map((k) => round((min[k] + max[k]) / 2)),
      size: [0, 1, 2].map((k) => round(max[k] - min[k])),
      parts: own.length,
      collidable: solid.length,
      collidableParts: [...new Set(solid.map((p) => p.name))].sort(),
    };
  });
  return { parts: b.parts, cell, entries };
}
