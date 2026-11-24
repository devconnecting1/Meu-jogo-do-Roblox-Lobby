// Reino — mapa base de um jogo de estratégia (estilo Lords Mobile) feito só de Part clássico.
//
// Fonte única da verdade (dados puros, sem Roblox, sem DOM). Consumido por:
//   * viewer/main.js (Three.js) — visualização e capturas do CI;
//   * src/rojo.js + tools/build-place.mjs — modelo Rojo -> .rbxl publicado no Roblox;
//   * src/manual.js — manual de montagem;
//   * tests/*.test.mjs — regras (apoio, z-fighting, passagens, lotes, estradas, estilo).
//
// O mapa é uma ilha cercada de mar, com lago e rio, praça central com a estátua do rei,
// 30 lotes de castelo (20 jogadores + 10 bots: quem fica em qual lote é sorteado pelo jogo
// depois), estradas de pedra ligando tudo, pontes de madeira, planaltos de rocha, florestas
// verdes e de outono, pedras, campos de trigo, jazidas, pedreiras e cais na praia.
//
// Tudo sai de uma semente fixa: a mesma semente gera sempre o mesmo mapa.
// Unidades: studs. Eixos do Roblox (Y para cima). Medidas em DIM.

import { makeBuilder } from './builder.js';
import { C } from './palette.js';

export const DIM = Object.freeze({
  half: 600, // a ilha cabe em x,z ∈ [-600, 600]
  seaHalf: 800, // o mar vai até ±800 (horizonte)
  cell: 16, // grade do terreno
  land: 4, // topo da grama
  beach: 3, // topo da areia (praia um degrau abaixo)
  water: 2.6, // superfície do rio e do lago
  cap: 0.6, // espessura da camada de grama/areia
  bottom: -5, // fundo dos blocos de terra (dentro do mar)
  seaBottom: -6,
  islandRadius: 570,
  plots: 30, // lotes de castelo
  players: 20, // lotes de jogadores reais
  bots: 10, // lotes de bots
  plotSize: 32, // fundação 32×32
  plotSpacing: 120, // distância desejada entre centros de lotes
  minPlotSpacing: 84, // nunca mais perto que isso
  plazaHalf: 44, // praça octogonal (quadrado 88 + quadrado girado 45°), com mercado
  road: 8, // largura das estradas
  maxBridge: 50, // ponte mais longa (studs sobre a água)
});

export const SEED = 20260114;

// ---------------------------------------------------------------------------
// Ruído e sorteio determinísticos
// ---------------------------------------------------------------------------
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

function hash2(i, j, salt) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(salt, 1274126177) + SEED) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruído de valor suave em [0, 1]. */
function noise(x, z, scale, salt = 0) {
  const fx = x / scale;
  const fz = z / scale;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(fx - i);
  const v = s(fz - j);
  const a = hash2(i, j, salt);
  const b = hash2(i + 1, j, salt);
  const c = hash2(i, j + 1, salt);
  const d = hash2(i + 1, j + 1, salt);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------------------------------------------------------------------------
// Terreno: grade de células (mar, grama, areia, rio, lago)
// ---------------------------------------------------------------------------
export const T = Object.freeze({ SEA: 0, GRASS: 1, SAND: 2, RIVER: 3, LAKE: 4 });

export const LAKE = Object.freeze({ x: -170, z: 150, r: 52 });
export const RIVER = Object.freeze([
  [-170, 150],
  [-215, 215],
  [-280, 275],
  [-350, 300],
  [-430, 350],
  [-520, 400],
  [-640, 460],
]);
const RIVER_HALF = 13;

const N = (2 * DIM.half) / DIM.cell; // 75 células por lado
const cellCenter = (i) => -DIM.half + DIM.cell * (i + 0.5);

function distToSegment(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
export function distToRiver(x, z) {
  let d = Infinity;
  for (let k = 0; k < RIVER.length - 1; k++) d = Math.min(d, distToSegment(x, z, RIVER[k], RIVER[k + 1]));
  return d;
}

function rawType(x, z) {
  const r = Math.hypot(x, z);
  const n = 0.6 * noise(x, z, 170, 1) + 0.4 * noise(x, z, 60, 2);
  const edge = Math.min(DIM.half - 24, DIM.islandRadius * (0.74 + 0.34 * n));
  if (r >= edge) return T.SEA;
  const lakeEdge = LAKE.r * (0.85 + 0.3 * noise(x, z, 40, 3));
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < lakeEdge) return T.LAKE;
  if (distToRiver(x, z) < RIVER_HALF) return T.RIVER;
  return T.GRASS;
}

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
];

const GRID = (() => {
  const g = [];
  for (let j = 0; j < N; j++) {
    g.push([]);
    for (let i = 0; i < N; i++) g[j].push(rawType(cellCenter(i), cellCenter(j)));
  }
  // praia: grama vizinha do mar aberto vira areia (rio e lago não fazem praia)
  const sand = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (g[j][i] !== T.GRASS) continue;
      if (NEIGHBORS.some(([di, dj]) => (g[j + dj]?.[i + di] ?? T.SEA) === T.SEA)) sand.push([i, j]);
    }
  }
  for (const [i, j] of sand) g[j][i] = T.SAND;
  return g;
})();

/** Tipo do terreno no ponto (x, z): T.SEA, T.GRASS, T.SAND, T.RIVER ou T.LAKE. */
export function terrainAt(x, z) {
  const i = Math.floor((x + DIM.half) / DIM.cell);
  const j = Math.floor((z + DIM.half) / DIM.cell);
  if (i < 0 || j < 0 || i >= N || j >= N) return T.SEA;
  return GRID[j][i];
}

/** Todos os pontos de um retângulo (amostrados a cada `step`, bordas incluídas) são grama? */
export function allGrass(x0, x1, z0, z1, step = 4) {
  for (let x = x0; x < x1 + step; x += step) {
    for (let z = z0; z < z1 + step; z += step) {
      if (terrainAt(Math.min(x, x1), Math.min(z, z1)) !== T.GRASS) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Praça central
// ---------------------------------------------------------------------------
const PLAZA_REACH = DIM.plazaHalf * Math.SQRT2; // ~62: alcance do octógono
export const PLAZA = Object.freeze({
  x: 0,
  z: 0,
  top: DIM.land + 0.45,
  reach: PLAZA_REACH,
  // saídas da praça: as estradas começam aqui
  gates: Object.freeze([
    [PLAZA_REACH + 1, 0],
    [-(PLAZA_REACH + 1), 0],
    [0, PLAZA_REACH + 1],
    [0, -(PLAZA_REACH + 1)],
  ]),
});

// ---------------------------------------------------------------------------
// Lotes de castelo
// ---------------------------------------------------------------------------
function pickPlots(banned) {
  const rand = mulberry32(SEED ^ 0x51a7);
  const m = DIM.plotSize / 2 + 10; // fundação + folga de grama em volta
  const plots = [];
  let spacing = DIM.plotSpacing;
  let fails = 0;
  for (let attempt = 0; attempt < 80000 && plots.length < DIM.plots; attempt++) {
    const x = Math.round((rand() * 2 - 1) * 520);
    const z = Math.round((rand() * 2 - 1) * 520);
    const ok =
      Math.hypot(x, z) >= 110 &&
      Math.hypot(x - LAKE.x, z - LAKE.z) >= 110 &&
      distToRiver(x, z) >= 52 &&
      banned.every((q) => Math.hypot(q.x - x, q.z - z) >= 60) &&
      allGrass(x - m, x + m, z - m, z + m) &&
      plots.every((p) => Math.hypot(p.x - x, p.z - z) >= spacing);
    if (ok) {
      plots.push({ x, z });
      fails = 0;
    } else if (++fails > 4000 && spacing > DIM.minPlotSpacing) {
      spacing = Math.max(DIM.minPlotSpacing, spacing - 6); // mapa apertado: aproxima um pouco os lotes
      fails = 0;
    }
  }
  // numeração no sentido horário a partir do norte (-Z), para achar os lotes no mapa
  plots.sort((a, b) => Math.atan2(a.x, -a.z) - Math.atan2(b.x, -b.z));
  return plots;
}

// ---------------------------------------------------------------------------
// Estradas: árvore geradora mínima (praça + lotes) com trechos retos em "L" ou "Z"
// ---------------------------------------------------------------------------
const ROAD_HALF = DIM.road / 2;

function samples(a, b, step) {
  const out = [];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(len / step));
  for (let k = 0; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  return out;
}

/** Pontos de uma seção transversal da estrada (centro e as duas bordas). */
const section = (x, z, horiz) =>
  horiz
    ? [
        [x, z],
        [x, z - ROAD_HALF],
        [x, z + ROAD_HALF],
      ]
    : [
        [x, z],
        [x - ROAD_HALF, z],
        [x + ROAD_HALF, z],
      ];

/**
 * Um trecho reto é válido se passa só por grama ou por rio (ponte de até DIM.maxBridge),
 * longe da praça. Devolve null (inválido) ou quantos studs passam sobre a água.
 */
function legWater(a, b) {
  const horiz = a[1] === b[1];
  let run = 0;
  let total = 0;
  for (const [x, z] of samples(a, b, 2)) {
    let wet = false;
    for (const [px, pz] of section(x, z, horiz)) {
      const t = terrainAt(px, pz);
      if (t === T.RIVER) wet = true;
      else if (t !== T.GRASS) return null;
      if (Math.hypot(px - PLAZA.x, pz - PLAZA.z) < PLAZA_REACH + 0.5) return null;
    }
    run = wet ? run + 2 : 0;
    total += wet ? 2 : 0;
    if (run > DIM.maxBridge) return null;
  }
  return total;
}

/** Esquina de estrada: precisa ficar na grama (nada de curva em cima de ponte). */
const cornerOk = ([x, z]) => allGrass(x - ROAD_HALF, x + ROAD_HALF, z - ROAD_HALF, z + ROAD_HALF, 4);

/** Caminhos candidatos de A até B, só com trechos alinhados aos eixos. */
function routeOptions(A, B, gate) {
  const [ax, az] = A;
  const [bx, bz] = B;
  if (gate) {
    // saída da praça: o primeiro trecho sai reto, para fora
    const alongX = az === 0;
    const s = alongX ? Math.sign(ax) : Math.sign(az);
    const opts = [alongX ? [A, [bx, az], B] : [A, [ax, bz], B]];
    for (const k of [30, 60, 100]) {
      const o = (alongX ? ax : az) + s * k;
      opts.push(alongX ? [A, [o, az], [o, bz], B] : [A, [ax, o], [bx, o], B]);
    }
    return opts;
  }
  const mx = Math.round((ax + bx) / 2);
  const mz = Math.round((az + bz) / 2);
  return [
    [A, [bx, az], B],
    [A, [ax, bz], B],
    [A, [mx, az], [mx, bz], B],
    [A, [ax, mz], [bx, mz], B],
    [A, [mx - 40, az], [mx - 40, bz], B],
    [A, [mx + 40, az], [mx + 40, bz], B],
    [A, [ax, mz - 40], [bx, mz - 40], B],
    [A, [ax, mz + 40], [bx, mz + 40], B],
  ];
}

/** Valida um caminho: devolve {legs, water} ou null. */
function checkRoute(points) {
  const pts = points.filter((p, k) => k === 0 || p[0] !== points[k - 1][0] || p[1] !== points[k - 1][1]);
  const legs = [];
  let water = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const w = legWater(pts[k], pts[k + 1]);
    if (w === null) return null;
    water += w;
    legs.push([pts[k], pts[k + 1]]);
  }
  for (let k = 1; k < pts.length - 1; k++) if (!cornerOk(pts[k])) return null;
  return { legs, water };
}

function planRoads(plots) {
  const gates = PLAZA.gates.length;
  const nodes = [...PLAZA.gates.map(([x, z]) => ({ x, z, gate: true })), ...plots];
  const parent = nodes.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let g = 1; g < gates; g++) parent[find(g)] = find(0); // a praça liga as 4 saídas
  const edges = [];
  for (let a = 0; a < nodes.length; a++) {
    for (let b = Math.max(a + 1, gates); b < nodes.length; b++) {
      const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
      if (d <= 360 || nodes[a].gate) edges.push({ a, b, d });
    }
  }
  edges.sort((p, q) => p.d - q.d || p.a - q.a || p.b - q.b);
  const route = ({ a, b }) => {
    const A = [nodes[a].x, nodes[a].z];
    const B = [nodes[b].x, nodes[b].z];
    for (const opt of routeOptions(A, B, nodes[a].gate)) {
      const r = checkRoute(opt);
      if (r) return r;
    }
    return null;
  };
  const legs = [];
  const used = new Set();
  let crossings = 0;
  for (const e of edges) {
    if (find(e.a) === find(e.b)) continue;
    const r = route(e);
    if (!r) continue;
    legs.push(...r.legs);
    used.add(e);
    if (r.water > 0) crossings++;
    parent[find(e.a)] = find(e.b);
  }
  // pontes dão vida ao mapa: garante até 2 travessias do rio (atalhos entre lotes vizinhos)
  for (const e of edges) {
    if (crossings >= 2) break;
    if (used.has(e) || nodes[e.a].gate || e.d > 260) continue;
    const r = route(e);
    if (!r || r.water === 0) continue;
    legs.push(...r.legs);
    crossings++;
  }
  const connected = plots.map((_, k) => find(gates + k) === find(0));
  return { legs, connected };
}

/** Escolhe os lotes e as estradas; um lote que não dá para ligar à praça é trocado de lugar. */
function planKingdom() {
  let banned = [];
  for (let round = 0; ; round++) {
    const plots = pickPlots(banned);
    const { legs, connected } = planRoads(plots);
    const lost = plots.filter((_, k) => !connected[k]);
    if (!lost.length || round >= 10) return { plots, legs };
    banned = banned.concat(lost);
  }
}

const KINGDOM = planKingdom();

/** Os 30 lotes. O jogo sorteia depois quais ficam com os 20 jogadores e quais com os 10 bots. */
export const PLOTS = Object.freeze(
  KINGDOM.plots.map((p, k) =>
    Object.freeze({ id: k + 1, name: `Lote ${String(k + 1).padStart(2, '0')}`, x: p.x, z: p.z }),
  ),
);

/**
 * Divide um trecho em pedaços de estrada (sobre a grama) e pontes (sobre o rio).
 * Cada pedaço é {kind: 'road'|'bridge', axis, t0, t1, at} no eixo do trecho.
 */
function splitLeg([a, b]) {
  const horiz = a[1] === b[1];
  const axis = horiz ? 'x' : 'z';
  const at = horiz ? a[1] : a[0];
  const t0 = Math.min(horiz ? a[0] : a[1], horiz ? b[0] : b[1]) - ROAD_HALF;
  const t1 = Math.max(horiz ? a[0] : a[1], horiz ? b[0] : b[1]) + ROAD_HALF;
  const pieces = [];
  let cur = null;
  for (let t = t0; t <= t1 + 1e-9; t += 1) {
    const pts = horiz ? section(t, at, true) : section(at, t, false);
    const kind = pts.some(([x, z]) => terrainAt(x, z) === T.RIVER) ? 'bridge' : 'road';
    if (!cur || cur.kind !== kind) {
      if (cur) cur.t1 = t;
      cur = { kind, axis, at, t0: t, t1: t };
      pieces.push(cur);
    }
  }
  if (cur) cur.t1 = t1;
  return pieces.filter((p) => p.t1 - p.t0 > 0.5);
}

const ROAD_PIECES = KINGDOM.legs.flatMap(splitLeg);
const rectOf = (p) =>
  p.axis === 'x'
    ? { x0: p.t0, x1: p.t1, z0: p.at - ROAD_HALF, z1: p.at + ROAD_HALF }
    : { x0: p.at - ROAD_HALF, x1: p.at + ROAD_HALF, z0: p.t0, z1: p.t1 };
const ROAD_RECTS = ROAD_PIECES.map(rectOf);

const distToRect = (x, z, r) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
const distToRoads = (x, z) => ROAD_RECTS.reduce((d, r) => Math.min(d, distToRect(x, z, r)), Infinity);
const rectsApart = (a, b, gap) => a.x1 + gap <= b.x0 || b.x1 + gap <= a.x0 || a.z1 + gap <= b.z0 || b.z1 + gap <= a.z0;

// ---------------------------------------------------------------------------
// Zonas livres e limites (usados nos testes)
// ---------------------------------------------------------------------------

/** Zonas que precisam ficar livres de colisão: em cima dos lotes, das estradas e do spawn. */
export function clearanceZones() {
  const zones = [];
  const h = DIM.plotSize / 2 - 1.5;
  for (const p of PLOTS) {
    zones.push({
      name: `${p.name} (área do castelo)`,
      min: [p.x - h, DIM.land + 0.95, p.z - h],
      max: [p.x + h, 40, p.z + h],
    });
  }
  ROAD_PIECES.forEach((p, k) => {
    const r = rectOf(p);
    zones.push({
      name: `${p.kind === 'bridge' ? 'Ponte' : 'Estrada'} ${k + 1}`,
      min: [r.x0, DIM.land + 1, r.z0],
      max: [r.x1, DIM.land + 8, r.z1],
    });
  });
  zones.push({ name: 'Spawn', min: [-3.5, PLAZA.top + 1.05, 20.5], max: [3.5, PLAZA.top + 8, 27.5] });
  // caminhos da praça: da estátua até cada saída
  const y0 = PLAZA.top + 1.05;
  const y1 = PLAZA.top + 8;
  const r = PLAZA_REACH;
  zones.push({ name: 'Caminho Leste da Praça', min: [10, y0, -4], max: [r, y1, 4] });
  zones.push({ name: 'Caminho Oeste da Praça', min: [-r, y0, -4], max: [-10, y1, 4] });
  zones.push({ name: 'Caminho Sul da Praça', min: [-4, y0, 10], max: [4, y1, r] });
  zones.push({ name: 'Caminho Norte da Praça', min: [-4, y0, -r], max: [4, y1, -10] });
  return zones;
}

export const ENVELOPE = Object.freeze({
  min: [-DIM.seaHalf, DIM.seaBottom, -DIM.seaHalf],
  max: [DIM.seaHalf, 90, DIM.seaHalf],
});

// ---------------------------------------------------------------------------
// Peças compostas
// ---------------------------------------------------------------------------
const deco = { canCollide: false };

/** Árvore: tronco, galho e copa octogonal em camadas (dois blocos girados 45°). */
function tree(b, model, x, y, z, rand, autumn) {
  const big = rand() < 0.45;
  const H = (autumn ? 9 : 7) + rand() * 4 + (big ? 2 : 0);
  const w = (autumn ? 10 : 8) + rand() * 4 + (big ? 3 : 0);
  const rot = Math.round(rand() * 8) * 5.625;
  const light = rand() < 0.5;
  const [c1, c2] = autumn ? [C.autumn, C.autumnDark] : light ? [C.leafLight, C.leaf] : [C.leaf, C.leafDark];
  b.box(model, 'Tronco', [x, y + H / 2, z], [1.6, H, 1.6], C.trunk);
  const side = rand() < 0.5 ? -1 : 1;
  b.box(model, 'Galho', [x + side * 1.6, y + H * 0.62, z], [3.4, 0.8, 0.8], C.trunk, {
    ...deco,
    rotation: [0, rot, side * 25],
  });
  const layer = (ww, hh, yy) => {
    b.box(model, 'Copa', [x, yy, z], [ww, hh, ww], c1, { ...deco, rotation: [0, rot, 0] });
    b.box(model, 'Copa', [x, yy, z], [ww * 0.94, hh * 1.04, ww * 0.94], c2, { ...deco, rotation: [0, rot + 45, 0] });
  };
  layer(w, 2.6, y + H + 1.3);
  if (big || autumn) layer(w * 0.62, 2.2, y + H + 2.6 + 1.1);
}

/** Pedras: blocos girados e meio enterrados (sem colisão). */
function rocks(b, model, x, y, z, rand, n, scale, color) {
  for (let k = 0; k < n; k++) {
    const s = (2 + rand() * 4) * scale;
    const h = s * (0.6 + rand() * 0.5);
    const px = x + (rand() - 0.5) * s * 1.4;
    const pz = z + (rand() - 0.5) * s * 1.4;
    b.box(model, 'Pedra', [px, y + h * 0.3, pz], [s, h, s * 0.9], k % 2 ? C.rockDark : color, {
      ...deco,
      rotation: [Math.round((rand() - 0.5) * 16), Math.round(rand() * 90), Math.round((rand() - 0.5) * 16)],
    });
  }
}

/** Centro do grupo mais denso de pontos (para enquadrar florestas no visualizador). */
function densest(points, radius) {
  let best = null;
  let bestN = -1;
  for (const p of points) {
    const n = points.filter((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < radius).length;
    if (n > bestN) [best, bestN] = [p, n];
  }
  return best;
}

/**
 * Construtor no estilo clássico: toda peça tem studs no topo (e inlet embaixo, no Rojo),
 * como os lugares antigos do Roblox. Mar e água ficam lisos.
 */
function classicBuilder() {
  const b = makeBuilder();
  const box = b.box;
  b.box = (model, name, center, size, color, opts = {}) =>
    box(model, name, center, size, color, { studs: true, ...opts });
  return b;
}

// ---------------------------------------------------------------------------
// O mapa
// ---------------------------------------------------------------------------
export function buildMap() {
  const b = classicBuilder();
  const rand = mulberry32(SEED);
  const { land, beach, cap, bottom } = DIM;
  const landmarks = { bridges: [], mesas: [], farms: [], mines: [], docks: [], groves: {} };

  // --- Mar (base de tudo) ---------------------------------------------------
  b.span('Mar', 'Mar', [-DIM.seaHalf, DIM.seaBottom, -DIM.seaHalf], [DIM.seaHalf, 0, DIM.seaHalf], C.sea, {
    studs: false,
  });

  // --- Terreno: faixas de células iguais viram um bloco (corpo de terra + camada) ---
  for (let j = 0; j < N; j++) {
    const z0 = -DIM.half + j * DIM.cell;
    const z1 = z0 + DIM.cell;
    let i = 0;
    while (i < N) {
      const t = GRID[j][i];
      let k = i;
      while (k + 1 < N && GRID[j][k + 1] === t) k++;
      const x0 = -DIM.half + i * DIM.cell;
      const x1 = -DIM.half + (k + 1) * DIM.cell;
      if (t === T.GRASS || t === T.SAND) {
        const top = t === T.GRASS ? land : beach;
        b.span('Terreno', t === T.GRASS ? 'Terra' : 'Barranco', [x0, bottom, z0], [x1, top - cap, z1], C.dirt);
        const capName = t === T.GRASS ? 'Grama' : 'Areia';
        b.span('Terreno', capName, [x0, top - cap, z0], [x1, top, z1], t === T.GRASS ? C.grass : C.sand);
      } else if (t === T.RIVER || t === T.LAKE) {
        const name = t === T.LAKE ? 'Água do Lago' : 'Água do Rio';
        b.span('Terreno', name, [x0, 0, z0], [x1, DIM.water, z1], C.water, {
          ...deco,
          studs: false,
          transparency: 0.25,
        });
      }
      i = k + 1;
    }
  }

  // --- Praça do Reino -------------------------------------------------------
  const PR = 'Praça do Reino';
  const ph = DIM.plazaHalf;
  const pt = PLAZA.top;
  const floorC = [0, (land - 0.05 + pt) / 2, 0];
  const floorS = [ph * 2, pt - land + 0.05, ph * 2];
  b.box(PR, 'Piso da Praça', floorC, floorS, C.plaza, { studs: true });
  b.box(PR, 'Piso da Praça', floorC, floorS, C.plaza, { studs: true, rotation: [0, 45, 0] });
  b.box(PR, 'Mosaico', [0, pt + 0.05, 0], [30, 0.1, 30], C.plazaDark);
  b.box(PR, 'Mosaico', [0, pt + 0.05, 0], [30, 0.1, 30], C.plazaDark, { ...deco, rotation: [0, 45, 0] });
  const pd = pt + 0.1;
  b.box(PR, 'Pedestal', [0, pd + 1, 0], [14, 2, 14], C.plazaDark);
  b.box(PR, 'Pedestal', [0, pd + 1, 0], [14, 2, 14], C.plazaDark, { rotation: [0, 45, 0] });
  b.box(PR, 'Base da Estátua', [0, pd + 2.6, 0], [8, 1.2, 8], C.statue);
  // estátua do rei: pernas, armadura, cabeça com coroa, espada erguida e escudo
  const sy = pd + 3.2;
  for (const dx of [-1, 1]) b.box(PR, 'Estátua', [dx, sy + 2, 0], [1.4, 4, 1.4], C.statue);
  b.box(PR, 'Estátua', [0, sy + 6.2, 0], [4, 4.4, 2.4], C.statue);
  b.box(PR, 'Estátua', [0, sy + 9.5, 0], [2.2, 2.2, 2.2], C.statue);
  b.box(PR, 'Coroa', [0, sy + 11, 0], [2.4, 0.8, 2.4], C.gold);
  b.box(PR, 'Estátua', [2.6, sy + 8.2, 0], [1.2, 3.6, 1.2], C.statue);
  b.box(PR, 'Espada', [2.6, sy + 13.5, 0], [0.4, 7, 0.9], C.stoneOre);
  b.box(PR, 'Guarda da Espada', [2.6, sy + 10.2, 0], [0.6, 0.4, 2.6], C.gold);
  b.box(PR, 'Escudo', [-2.3, sy + 6.2, 0], [0.6, 4, 3.2], C.bannerDark);
  // estandartes nos cantos da praça
  for (const [x, z] of [
    [40, 40],
    [-40, 40],
    [40, -40],
    [-40, -40],
  ]) {
    b.box(PR, 'Mastro', [x, pt + 7, z], [0.6, 14, 0.6], C.woodDark);
    b.span(PR, 'Estandarte', [x + 0.3, pt + 7.5, z - 1.6], [x + 0.5, pt + 13, z + 1.6], C.banner, deco);
  }
  // mercado: 4 barracas com toldo listrado viradas para os caminhos da praça
  const STALLS = [
    [30, 18, C.banner],
    [-30, 18, C.awningBlue],
    [30, -18, C.awningOlive],
    [-30, -18, C.banner],
  ];
  STALLS.forEach(([cx, cz, color], n) => {
    const M = `${PR}/Barraca ${n + 1}`;
    const front = -Math.sign(cz); // a frente olha para o caminho central (z = 0)
    b.span(M, 'Balcão', [cx - 5, pt, cz - 1.5], [cx + 5, pt + 3, cz + 1.5], C.wood);
    b.span(M, 'Tampo do Balcão', [cx - 5.3, pt + 3, cz - 1.8], [cx + 5.3, pt + 3.4, cz + 1.8], C.woodDark);
    [-3, 0, 3].forEach((dx, k) => {
      const ware = [C.wheat, C.gold, C.cloth][k];
      b.span(M, 'Mercadoria', [cx + dx - 0.6, pt + 3.4, cz - 0.6], [cx + dx + 0.6, pt + 4.4, cz + 0.6], ware, deco);
    });
    for (const dx of [-4.7, 4.7]) {
      for (const dz of [-2.7, 2.7]) {
        const [x, z] = [cx + dx, cz + dz];
        b.span(M, 'Poste da Barraca', [x - 0.3, pt, z - 0.3], [x + 0.3, pt + 8, z + 0.3], C.woodDark);
      }
    }
    const fz = cz + front * 3.5;
    for (let k = 0; k < 11; k++) {
      const x0 = cx - 5.5 + k;
      b.span(M, 'Toldo', [x0, pt + 8, cz - 3.5], [x0 + 1, pt + 8.5, cz + 3.5], k % 2 ? C.cloth : color, deco);
      b.span(M, 'Franja', [x0, pt + 7.4, fz - 0.1], [x0 + 1, pt + 8, fz + 0.1], k % 2 ? color : C.cloth, deco);
    }
    // caixotes atrás da barraca (um em cima, meio torto)
    const bz = cz - front * 6;
    const C1 = `${PR}/Caixotes ${n + 1}`;
    b.span(C1, 'Caixote', [cx - 4, pt, bz - 1.2], [cx - 1.6, pt + 2.4, bz + 1.2], C.crate);
    b.span(C1, 'Caixote', [cx - 1.6, pt, bz - 1.2], [cx + 0.8, pt + 2.4, bz + 1.2], C.crate);
    b.box(C1, 'Caixote', [cx - 2.8, pt + 3.4, bz], [2, 2, 2], C.wood, { rotation: [0, 20, 0] });
  });
  // canteiros de flores entre a estátua e o mercado
  [
    [20, 20],
    [-20, 20],
    [20, -20],
    [-20, -20],
  ].forEach(([x, z], n) => {
    const M = `${PR}/Canteiro ${n + 1}`;
    b.span(M, 'Canteiro', [x - 3, pt, z - 3], [x + 3, pt + 1.2, z + 3], C.plazaDark);
    b.span(M, 'Terra do Canteiro', [x - 2.6, pt + 0.8, z - 2.6], [x + 2.6, pt + 1.3, z + 2.6], C.soil);
    [
      [-1.5, -1.5],
      [1.5, -1.5],
      [0, 0],
      [-1.5, 1.5],
      [1.5, 1.5],
    ].forEach(([dx, dz], k) => {
      const [fx, fz] = [x + dx, z + dz];
      b.span(M, 'Caule', [fx - 0.15, pt + 1.3, fz - 0.15], [fx + 0.15, pt + 2.6, fz + 0.15], C.leafDark, deco);
      const bloom = (k + n) % 2 ? C.flowerYellow : C.flowerRed;
      b.span(M, 'Flor', [fx - 0.45, pt + 2.6, fz - 0.45], [fx + 0.45, pt + 3.3, fz + 0.45], bloom, deco);
    });
  });
  // colunas antigas em volta da praça (restos do reino antigo; algumas partidas)
  [
    [40, 14],
    [40, -14],
    [-40, 14],
    [-40, -14],
    [14, 40],
    [-14, 40],
    [14, -40],
    [-14, -40],
  ].forEach(([x, z], n) => {
    const M = `${PR}/Coluna Antiga ${n + 1}`;
    const broken = n % 3 === 2;
    const h = broken ? 5 : 10;
    b.span(M, 'Base da Coluna', [x - 2, pt, z - 2], [x + 2, pt + 1, z + 2], C.statue);
    b.span(M, 'Fuste', [x - 1.3, pt + 1, z - 1.3], [x + 1.3, pt + 1 + h, z + 1.3], C.statue);
    if (!broken) {
      b.span(M, 'Capitel', [x - 2, pt + 1 + h, z - 2], [x + 2, pt + 2 + h, z + 2], C.statue);
    } else {
      // o pedaço que caiu está no chão, ao lado (sem colisão)
      const [px, pz] = Math.abs(x) > Math.abs(z) ? [x - Math.sign(x) * 4.5, z] : [x, z - Math.sign(z) * 4.5];
      b.box(M, 'Pedaço da Coluna', [px, pt + 1, pz], [2.6, 3.4, 2.6], C.statue, { ...deco, rotation: [0, 30, 80] });
    }
  });
  b.box(PR, 'SpawnLocation', [0, pt + 0.5, 24], [8, 1, 8], C.plotStone, { className: 'SpawnLocation', studs: true });

  // --- Estradas e pontes ------------------------------------------------------
  let bridgeN = 0;
  for (const p of ROAD_PIECES) {
    const r = rectOf(p);
    if (p.kind === 'road') {
      b.span('Estradas', 'Estrada', [r.x0, land, r.z0], [r.x1, land + 0.3, r.z1], C.road);
      continue;
    }
    // ponte de madeira: o tabuleiro apoia nas pontas da estrada (3 studs de cada lado)
    const name = `Pontes/Ponte ${String(++bridgeN).padStart(2, '0')}`;
    const t0 = p.t0 - 3;
    const t1 = p.t1 + 3;
    const box = (ta, tb, w0, w1) =>
      p.axis === 'x'
        ? { x0: ta, x1: tb, z0: p.at + w0, z1: p.at + w1 }
        : { x0: p.at + w0, x1: p.at + w1, z0: ta, z1: tb };
    const piece = (ta, tb, w0, w1, y0, y1, nm, col) => {
      const q = box(ta, tb, w0, w1);
      b.span(name, nm, [q.x0, y0, q.z0], [q.x1, y1, q.z1], col);
    };
    piece(t0, t1, -5, 5, land + 0.3, land + 0.8, 'Tabuleiro', C.wood);
    for (const w of [-3, 3]) piece(t0, t1, w - 0.4, w + 0.4, land - 0.4, land + 0.3, 'Viga', C.woodDark);
    const deck = box(t0, t1, -5, 5);
    landmarks.bridges.push([(deck.x0 + deck.x1) / 2, (deck.z0 + deck.z1) / 2, p.axis]);
    // guarda-corpo: postes e corrimão, interrompidos onde outra estrada cruza a ponte
    const n = Math.max(2, Math.round((t1 - t0) / 6));
    const ts = Array.from({ length: n + 1 }, (_, k) => t0 + 0.3 + ((t1 - t0 - 0.6) * k) / n);
    for (const w of [-4.7, 4.7]) {
      const clear = (q) => ROAD_RECTS.every((o) => rectsApart(q, o, 0));
      const open = ts.map((t) => clear(box(t - 0.3, t + 0.3, w - 0.3, w + 0.3)));
      ts.forEach((t, k) => {
        if (open[k]) piece(t - 0.3, t + 0.3, w - 0.3, w + 0.3, land + 0.8, land + 3.4, 'Poste', C.woodDark);
      });
      for (let k = 0; k < n; k++) {
        if (!open[k] || !open[k + 1] || !clear(box(ts[k] - 0.3, ts[k + 1] + 0.3, w - 0.2, w + 0.2))) continue;
        piece(ts[k] - 0.3, ts[k + 1] + 0.3, w - 0.2, w + 0.2, land + 3.4, land + 3.8, 'Corrimão', C.wood);
      }
    }
  }

  // --- Lotes de castelo -------------------------------------------------------
  const half = DIM.plotSize / 2;
  for (const p of PLOTS) {
    const L = `Lotes/${p.name}`;
    b.span(L, 'Fundação', [p.x - half, land - 0.1, p.z - half], [p.x + half, land + 0.6, p.z + half], C.plotStone, {
      studs: true,
    });
    const kt = land + 0.6;
    const kerb = (x0, z0, x1, z1) => b.span(L, 'Meio-fio', [x0, kt, z0], [x1, kt + 0.3, z1], C.plotKerb);
    kerb(p.x - half, p.z - half, p.x + half, p.z - half + 1);
    kerb(p.x - half, p.z + half - 1, p.x + half, p.z + half);
    kerb(p.x - half, p.z - half + 1, p.x - half + 1, p.z + half - 1);
    kerb(p.x + half - 1, p.z - half + 1, p.x + half, p.z + half - 1);
    for (const [sx, sz] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]) {
      const cx = p.x + sx * (half - 0.5);
      const cz = p.z + sz * (half - 0.5);
      b.span(L, 'Marco', [cx - 0.5, kt + 0.3, cz - 0.5], [cx + 0.5, kt + 2.8, cz + 0.5], C.plotKerb, deco);
    }
    const fx = p.x + half - 2.5;
    const fz = p.z + half - 2.5;
    b.span(L, 'Mastro', [fx - 0.25, kt, fz - 0.25], [fx + 0.25, kt + 12, fz + 0.25], C.woodDark, deco);
    b.span(L, 'Bandeira', [fx + 0.25, kt + 8.6, fz - 0.1], [fx + 4.25, kt + 11.4, fz + 0.1], C.cloth, deco);
  }

  // --- Relevo: planaltos de rocha com topo de grama ---------------------------
  const blocked = []; // retângulos já ocupados (planaltos, campos, jazidas, cais)
  const free = (r, gap) => blocked.every((o) => rectsApart(r, o, gap));
  const awayFromPlots = (x, z, d) => PLOTS.every((p) => Math.hypot(p.x - x, p.z - z) >= half + d);
  const awayFromRoads = (r, gap) => ROAD_RECTS.every((o) => rectsApart(r, o, gap));
  const mesaTops = [];
  for (let attempt = 0; attempt < 6000 && landmarks.mesas.length < 16; attempt++) {
    const x = Math.round((rand() * 2 - 1) * 500);
    const z = Math.round((rand() * 2 - 1) * 500);
    const w = 26 + Math.round(rand() * 30);
    const d = 26 + Math.round(rand() * 30);
    const r = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
    const ok =
      Math.hypot(x, z) > 90 + Math.max(w, d) &&
      allGrass(r.x0 - 6, r.x1 + 6, r.z0 - 6, r.z1 + 6) &&
      awayFromPlots(x, z, 20 + Math.hypot(w, d) / 2) &&
      awayFromRoads(r, 10) &&
      free(r, 12);
    if (!ok) continue;
    const M = `Relevo/Planalto ${String(landmarks.mesas.length + 1).padStart(2, '0')}`;
    blocked.push({ x0: r.x0 - 2, x1: r.x1 + 2, z0: r.z0 - 2, z1: r.z1 + 2 });
    b.span(M, 'Base de Rocha', [r.x0 - 1.5, land - 0.1, r.z0 - 1.5], [r.x1 + 1.5, land + 2, r.z1 + 1.5], C.rockDark);
    const top1 = land + 2 + 8 + Math.round(rand() * 10);
    b.span(M, 'Rocha', [r.x0, land + 2, r.z0], [r.x1, top1, r.z1], C.rock);
    b.span(M, 'Topo de Grama', [r.x0 - 0.4, top1, r.z0 - 0.4], [r.x1 + 0.4, top1 + 0.8, r.z1 + 0.4], C.grass);
    let top = top1 + 0.8;
    let area = [r.x0, r.x1, r.z0, r.z1];
    // escadaria de pedra no lado oeste, para o jogador subir no planalto (degraus de até 1 stud)
    const H = top - land;
    const n = Math.ceil(H);
    const zc = Math.round((r.z0 + r.z1) / 2);
    const stair = { x0: r.x0 - 0.4 - n * 1.25, x1: r.x0 - 0.4, z0: zc - 3, z1: zc + 3 };
    const plotRect = (p) => ({ x0: p.x - half, x1: p.x + half, z0: p.z - half, z1: p.z + half });
    const stairOk =
      allGrass(stair.x0 - 2, stair.x1, stair.z0 - 2, stair.z1 + 2, 2) &&
      awayFromRoads(stair, 6) &&
      PLOTS.every((p) => rectsApart(stair, plotRect(p), 8)) &&
      free(stair, 4);
    if (stairOk) {
      blocked.push({ x0: stair.x0 - 2, x1: stair.x1, z0: stair.z0 - 2, z1: stair.z1 + 2 });
      for (let k = 1; k <= n; k++) {
        let y = land + (H * k) / n;
        if (Math.abs(y - (land + 2)) < 0.05) y += 0.1; // não empatar com o topo da base de rocha
        const xa = r.x0 - 0.4 - (n - k + 1) * 1.25;
        b.span(M, 'Degrau', [xa, land - 0.12, stair.z0], [xa + 1.25, y, stair.z1], C.plazaDark);
      }
    }
    if (w >= 34 && d >= 34) {
      // segundo degrau, menor e deslocado (como os rochedos das referências)
      const w2 = Math.round(w * 0.55);
      const d2 = Math.round(d * 0.55);
      const ox = r.x0 + 3 + Math.round(rand() * (w - w2 - 6));
      const oz = r.z0 + 3 + Math.round(rand() * (d - d2 - 6));
      const h2 = 6 + Math.round(rand() * 6);
      b.span(M, 'Rocha', [ox, top, oz], [ox + w2, top + h2, oz + d2], C.rock);
      b.span(
        M,
        'Topo de Grama',
        [ox - 0.4, top + h2, oz - 0.4],
        [ox + w2 + 0.4, top + h2 + 0.8, oz + d2 + 0.4],
        C.grass,
      );
      area = [ox, ox + w2, oz, oz + d2];
      top += h2 + 0.8;
    }
    mesaTops.push({ area, top, arrival: stairOk ? [r.x0, zc] : null });
    landmarks.mesas.push([x, z, top, stairOk]);
  }

  // --- Recursos: campos de trigo, jazidas de ouro e pedreiras -----------------
  for (let attempt = 0; attempt < 4000 && landmarks.farms.length < 6; attempt++) {
    const x = Math.round((rand() * 2 - 1) * 440);
    const z = Math.round((rand() * 2 - 1) * 440);
    const r = { x0: x - 15, x1: x + 15, z0: z - 11, z1: z + 11 };
    const ok =
      Math.hypot(x, z) > PLAZA_REACH + 36 &&
      allGrass(r.x0 - 4, r.x1 + 4, r.z0 - 4, r.z1 + 4) &&
      awayFromPlots(x, z, 30) &&
      awayFromRoads(r, 4) &&
      free(r, 8);
    if (!ok) continue;
    blocked.push(r);
    const F = `Recursos/Campo de Trigo ${landmarks.farms.length + 1}`;
    landmarks.farms.push([x, z]);
    b.span(F, 'Terra Arada', [r.x0, land - 0.08, r.z0], [r.x1, land + 0.22, r.z1], C.soil);
    for (let k = 0; k < 5; k++) {
      const zz = r.z0 + 2.4 + k * 4.3;
      b.span(F, 'Trigo', [r.x0 + 1, land + 0.22, zz], [r.x1 - 1, land + 1.6, zz + 1.4], C.wheat, deco);
    }
    for (const [cx, cz] of [
      [r.x0, r.z0],
      [r.x1, r.z0],
      [r.x0, r.z1],
      [r.x1, r.z1],
    ]) {
      b.span(F, 'Estaca da Cerca', [cx - 0.3, land + 0.22, cz - 0.3], [cx + 0.3, land + 2.6, cz + 0.3], C.woodDark);
    }
    for (const cz of [r.z0, r.z1]) {
      b.span(F, 'Cerca', [r.x0 - 0.15, land + 1.9, cz - 0.15], [r.x1 + 0.15, land + 2.2, cz + 0.15], C.wood, deco);
    }
  }
  let gold = 0;
  let quarry = 0;
  for (let attempt = 0; attempt < 4000 && gold + quarry < 8; attempt++) {
    const x = Math.round((rand() * 2 - 1) * 480);
    const z = Math.round((rand() * 2 - 1) * 480);
    const r = { x0: x - 10, x1: x + 10, z0: z - 10, z1: z + 10 };
    const ok =
      Math.hypot(x, z) > 120 &&
      allGrass(x - 12, x + 12, z - 12, z + 12) &&
      awayFromPlots(x, z, 26) &&
      distToRoads(x, z) > 14 &&
      free(r, 8);
    if (!ok) continue;
    blocked.push(r);
    const isGold = gold < 4 && (quarry >= 4 || rand() < 0.5);
    const R = isGold ? `Recursos/Jazida de Ouro ${++gold}` : `Recursos/Pedreira ${++quarry}`;
    landmarks.mines.push([x, z, isGold ? 'ouro' : 'pedra']);
    rocks(b, R, x, land, z, rand, 4, 1.6, C.rockDark);
    rocks(b, R, x + 3, land, z - 2, rand, 3, 0.7, isGold ? C.gold : C.stoneOre);
  }

  // --- Costa: cais de madeira com barco ---------------------------------------
  for (let attempt = 0; attempt < 8000 && landmarks.docks.length < 3; attempt++) {
    const ang = rand() * Math.PI * 2;
    let r = 300;
    while (r < DIM.half && terrainAt(Math.cos(ang) * r, Math.sin(ang) * r) !== T.SAND) r += 2;
    const sx = Math.cos(ang) * r;
    const sz = Math.sin(ang) * r;
    if (terrainAt(sx, sz) !== T.SAND) continue;
    const alongX = Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang));
    const dir = alongX ? Math.sign(Math.cos(ang)) : Math.sign(Math.sin(ang));
    const cx = cellCenter(Math.floor((sx + DIM.half) / DIM.cell));
    const cz = cellCenter(Math.floor((sz + DIM.half) / DIM.cell));
    const at = (t, w) => (alongX ? [cx + dir * t, cz + w] : [cx + w, cz + dir * t]);
    const tb = DIM.cell / 2 + 30;
    let ok =
      PLOTS.every((p) => Math.hypot(p.x - cx, p.z - cz) >= 60) &&
      landmarks.docks.every(([x, z]) => Math.hypot(x - cx, z - cz) >= 120);
    for (let t = DIM.cell / 2 + 1; ok && t <= tb + 4; t += 2) {
      for (const w of [-4, 0, 4, 10]) if (terrainAt(...at(t, w)) !== T.SEA) ok = false;
    }
    if (!ok) continue;
    const D = `Costa/Cais ${landmarks.docks.length + 1}`;
    landmarks.docks.push([cx, cz, alongX ? 'x' : 'z', dir]);
    const piece = (t0, t1, w0, w1, y0, y1, nm, col) => {
      const [ax, az] = at(t0, w0);
      const [bx, bz] = at(t1, w1);
      b.span(D, nm, [ax, y0, az], [bx, y1, bz], col);
    };
    piece(0, tb, -3, 3, beach, beach + 0.5, 'Deque', C.wood);
    for (let t = DIM.cell / 2 + 4; t <= tb - 0.5; t += 6) {
      for (const w of [-2.6, 2.6]) piece(t - 0.35, t + 0.35, w - 0.35, w + 0.35, -3, beach, 'Estaca', C.woodDark);
    }
    // barco amarrado ao lado do cais
    const bt = DIM.cell / 2 + 12;
    piece(bt, bt + 12, 4.5, 9.5, 0, 0.8, 'Casco', C.woodDark);
    piece(bt, bt + 12, 4.5, 5.1, 0.8, 2, 'Borda do Barco', C.wood);
    piece(bt, bt + 12, 8.9, 9.5, 0.8, 2, 'Borda do Barco', C.wood);
    piece(bt + 5.5, bt + 6.5, 5.1, 8.9, 0.8, 1.4, 'Banco do Barco', C.wood);
    blocked.push({ x0: cx - 20, x1: cx + 20, z0: cz - 20, z1: cz + 20 });
  }

  // --- Vegetação: florestas verdes e de outono --------------------------------
  // Primeiro os candidatos (grade com sorteio); se passar do limite, pega um a cada k
  // para a vegetação ficar espalhada pelo mapa inteiro.
  const spots = [];
  const step = 15;
  for (let gx = -540; gx <= 540; gx += step) {
    for (let gz = -540; gz <= 540; gz += step) {
      const x = Math.round((gx + (rand() - 0.5) * step * 0.8) * 10) / 10;
      const z = Math.round((gz + (rand() - 0.5) * step * 0.8) * 10) / 10;
      const want = noise(x, z, 120, 7) > 0.6 ? rand() < 0.75 : rand() < 0.04;
      if (!want) continue;
      const ok =
        allGrass(x - 3, x + 3, z - 3, z + 3, 3) &&
        Math.hypot(x, z) > PLAZA_REACH + 12 &&
        awayFromPlots(x, z, 10) &&
        distToRoads(x, z) > 7 &&
        free({ x0: x, x1: x, z0: z, z1: z }, 4);
      if (ok) spots.push([x, z, noise(x, z, 90, 9) > 0.58]);
    }
  }
  const MAX_TREES = 460;
  const chosen = spots.length > MAX_TREES ? spots.filter((_, k) => (k * MAX_TREES) % spots.length < MAX_TREES) : spots;
  for (const [x, z, autumn] of chosen) {
    tree(b, `Vegetação/${autumn ? 'Bosque de Outono' : 'Floresta'}`, x, land, z, rand, autumn);
    if (rand() < 0.35) {
      const bx = x + (rand() < 0.5 ? -1 : 1) * (3 + rand() * 2);
      const bz = z + (rand() - 0.5) * 6;
      if (terrainAt(bx, bz) === T.GRASS && distToRoads(bx, bz) > 6 && awayFromPlots(bx, bz, 8)) {
        const s = 2 + rand() * 2;
        b.box('Vegetação/Arbustos', 'Arbusto', [bx, land - 0.05 + s * 0.4, bz], [s, s * 0.8, s], C.bush, {
          ...deco,
          rotation: [0, Math.round(rand() * 90), 0],
        });
      }
    }
  }
  landmarks.groves.green = densest(
    chosen.filter((s) => !s[2]),
    45,
  );
  landmarks.groves.autumn = densest(
    chosen.filter((s) => s[2]),
    45,
  );
  for (const { area, top, arrival } of mesaTops) {
    const [x0, x1, z0, z1] = area;
    const n = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const x = x0 + 4 + rand() * (x1 - x0 - 8);
      const z = z0 + 4 + rand() * (z1 - z0 - 8);
      if (arrival && x < arrival[0] + 8 && Math.abs(z - arrival[1]) < 6) continue; // chegada da escada livre
      tree(b, 'Vegetação/Árvores do Planalto', x, top, z, rand, rand() < 0.3);
    }
  }
  // pedras soltas pelo campo
  let rockN = 0;
  for (let attempt = 0; attempt < 5000 && rockN < 60; attempt++) {
    const x = (rand() * 2 - 1) * 540;
    const z = (rand() * 2 - 1) * 540;
    const ok =
      allGrass(x - 6, x + 6, z - 6, z + 6, 3) &&
      Math.hypot(x, z) > PLAZA_REACH + 10 &&
      awayFromPlots(x, z, 14) &&
      distToRoads(x, z) > 10 &&
      free({ x0: x, x1: x, z0: z, z1: z }, 6);
    if (!ok) continue;
    rockN++;
    rocks(b, 'Relevo/Pedras', x, land, z, rand, 2 + Math.floor(rand() * 3), 1, C.rock);
  }

  return { parts: b.parts, landmarks };
}

/** Resumo do mapa para o visualizador e o CI. */
export const MAP_INFO = Object.freeze({
  plots: PLOTS.length,
  roads: ROAD_PIECES.filter((p) => p.kind === 'road').length,
  bridges: ROAD_PIECES.filter((p) => p.kind === 'bridge').length,
});
