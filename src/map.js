// O Vale: mapa base em estilo voxel pixelado (blocos lisos, bordas "em escada" de 4 studs), descrito
// como dados puros. O mesmo arquivo gera o lugar do Roblox e o visualizador.
//
// O que existe (mapa fixo, sempre igual):
//   * um vale plano no meio de um planalto, cercado em boa parte por penhascos de rocha em blocos
//     (degraus de 6 studs, com musgo no topo); no resto, o planalto termina numa borda sobre o mar;
//   * o Lobby: praça central de pedra clara com faixas escuras em padrão pixelado, estrado com a
//     estátua de Luvitlua, postes de luz e o spawn;
//   * 8 lojas grandes em volta da praça, em tamanho real (planta em escala DIM.buildScale), com
//     interior mobiliado e iluminação (só lojas: sem castelos nem igreja);
//   * estradas de terra com borda serrilhada ligando a praça a todas as lojas;
//   * terraços de grama (degraus de 2 studs) e lagoas, longe das lojas.
//
// Regras (testadas em tests/): nada flutua, nada de z-fighting, áreas planas e livres, todas as
// lojas ligadas à praça, estilo liso (SmoothPlastic, sem studs) e cores só da paleta.

import { makeBuilder } from './builder.js';
import { C } from './palette.js';
import { buildShop } from './props/lojas.js';
import { buildStatue } from './props/estatua.js';

export const DIM = Object.freeze({
  half: 400, // a grade do terreno cobre x,z ∈ [-400, 400]
  seaHalf: 760, // o mar vai até ±760
  cell: 4, // "pixel" do terreno (lado de cada célula)
  land: 4, // topo do chão do vale
  bottom: -5, // fundo dos blocos de terra (dentro do mar)
  seaBottom: -6,
  cap: 1, // espessura da camada de superfície (grama, terra, pedra)
  valley: 300, // raio de referência do vale (cada semente deforma)
  valleyMin: 250,
  valleyMax: 330,
  cliffBand: 52, // largura da faixa de penhascos fora do vale
  plazaR: 46, // Lobby: praça de pedra
  daisR: 10, // estrado no centro da praça (estátua de Luvitlua)
  ringRoad: [52, 62], // anel de terra em volta da praça
  pads: 8, // lojas em volta da praça
  padSize: 48, // múltiplo de 8: o piso cobre células inteiras da grade de 4
  padRing: 124, // centro das lojas (longe do anel de terra da praça)
  buildScale: 2, // as plantas de PLANS são desenhadas em 24×24 e montadas no dobro (tamanho real)
  buildScaleY: 1.5, // alturas das construções: porta de 9, pé-direito de 12 ou mais
  road: 10, // largura das estradas
  maxParts: 32000,
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

function hash2(i, j, salt, seed) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(salt, 1274126177) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruído de valor suave em [0, 1]. */
function noise(x, z, scale, salt, seed) {
  const fx = x / scale;
  const fz = z / scale;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(fx - i);
  const v = s(fz - j);
  const a = hash2(i, j, salt, seed);
  const b = hash2(i + 1, j, salt, seed);
  const c = hash2(i, j + 1, salt, seed);
  const d = hash2(i + 1, j + 1, salt, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Tipo de cada célula. */
export const T = Object.freeze({ SEA: 0, GROUND: 1, WATER: 2, CLIFF: 3 });

/** Superfície de cada célula do chão: cor, nome da peça e modelo (fase do manual). */
const SURF = Object.freeze({
  grama: { color: C.pxGrass, name: 'Grama', model: 'Terreno' },
  gramaEscura: { color: C.pxGrassDark, name: 'Grama Escura', model: 'Terreno' },
  terra: { color: C.pxDirt, name: 'Terra da Estrada', model: 'Estradas' },
  terraEscura: { color: C.pxDirtDark, name: 'Terra Batida', model: 'Estradas' },
  pedra: { color: C.pxStone, name: 'Pedra da Praça', model: 'Lobby' },
  pedraEscura: { color: C.pxStoneDark, name: 'Faixa da Praça', model: 'Lobby' },
  area: { color: C.pxPad, name: 'Área de Construção', model: 'Áreas' },
  areaBorda: { color: C.pxPadEdge, name: 'Borda da Área', model: 'Áreas' },
  lote: { color: C.pxPad, name: 'Lote', model: 'Lotes' },
  loteBorda: { color: C.pxPadEdge, name: 'Borda do Lote', model: 'Lotes' },
  ponte: { color: C.pxStoneDark, name: 'Passagem de Pedra', model: 'Estradas' },
});

/** Superfícies por onde o caminho liga o Lobby às áreas e aos lotes. */
const PATH_SURF = new Set([
  'terra',
  'terraEscura',
  'pedra',
  'pedraEscura',
  'ponte',
  'lote',
  'loteBorda',
  'area',
  'areaBorda',
]);
/** Superfícies que as estradas nunca repintam. */
const KEEP_SURF = new Set(['pedra', 'pedraEscura', 'lote', 'loteBorda', 'area', 'areaBorda']);

/**
 * Plantas das lojas: cada área tem o formato do prédio que vai receber, como as construções reais
 * (nada de quadrado igual para tudo). Coordenadas locais de desenho (cabem em 24×24, montadas em
 * escala DIM.buildScale), com a frente (porta, alpendre, escadaria) para +z; partes são retângulos
 * [x0, z0, x1, z1] e círculos { c: [x, z], r }; `door` é o ponto [u, v] da borda da planta onde fica a
 * porta principal (a estrada chega ali). Só lojas: sem castelos nem igreja (pedido do dono).
 */
export const PLANS = Object.freeze({
  taverna: {
    name: 'Taverna',
    group: 'loja',
    door: [6, 0],
    parts: [
      [-12, -12, 12, 0],
      [-12, 0, 0, 12],
    ],
  }, // salão + ala em L
  ferraria: {
    name: 'Ferraria',
    group: 'loja',
    door: [-4, 8],
    parts: [
      [-12, -8, 4, 8],
      [4, -4, 12, 4],
    ],
  }, // oficina + forja
  mercado: {
    name: 'Mercado Coberto',
    group: 'loja',
    door: [0, 12],
    parts: [
      [-12, -8, 12, 4],
      [-4, 4, 4, 12],
    ],
  }, // salão + alpendre
  padaria: {
    name: 'Padaria',
    group: 'loja',
    door: [0, 8],
    parts: [
      [-10, -10, 10, 4],
      [-6, 4, 6, 8],
    ],
  }, // forno + balcão com vitrine
  torreMago: { name: 'Torre do Mago', group: 'loja', door: [0, 12], parts: [{ c: [0, 0], r: 12 }] }, // loja de magia redonda
  estabulo: {
    name: 'Estábulo',
    group: 'loja',
    door: [0, 12],
    parts: [
      [-12, 4, 12, 12],
      [-12, -10, -4, 4],
      [4, -10, 12, 4],
    ],
  }, // U: frente com a porta e alas das baias em volta do picadeiro (aberto para trás)
  banco: {
    name: 'Banco',
    group: 'loja',
    door: [0, 8],
    parts: [
      [-8, -12, 8, 4],
      [-4, 4, 4, 8],
    ],
  }, // salão + escadaria
  guilda: {
    name: 'Salão da Guilda',
    group: 'loja',
    door: [0, 12],
    parts: [
      [-12, -4, 12, 4],
      [-8, -8, 8, 8],
      [-4, -12, 4, 12],
    ],
  }, // octógono
});
const SHOP_PLANS = Object.keys(PLANS).filter((k) => PLANS[k].group === 'loja');

/** Gira (x, z) em passos de 90° (k = 0..3): a frente +z vai para +z, −x, −z e +x. */
const rot90 = (x, z, k) =>
  [
    [x, z],
    [-z, x],
    [-x, -z],
    [z, -x],
  ][k & 3];

/** O ponto (x, z) do mundo está na planta da construção p (com folga `m` em volta)? */
export function inPlan(p, x, z, m = 0) {
  const S = DIM.buildScale;
  const [wx, wz] = rot90(x - p.x, z - p.z, 4 - p.rot);
  const [lx, lz] = [wx / S, wz / S];
  m /= S;
  return PLANS[p.plan].parts.some((q) =>
    Array.isArray(q)
      ? lx > q[0] - m && lx < q[2] + m && lz > q[1] - m && lz < q[3] + m
      : Math.hypot(lx - q.c[0], lz - q.c[1]) < q.r + m,
  );
}

/** Retângulos do mundo que cobrem a planta (círculos viram o quadrado inscrito). */
export function planRects(p) {
  return PLANS[p.plan].parts.map((q) => {
    const [x0, z0, x1, z1] = Array.isArray(q)
      ? q
      : [q.c[0] - q.r * 0.7, q.c[1] - q.r * 0.7, q.c[0] + q.r * 0.7, q.c[1] + q.r * 0.7];
    const S = DIM.buildScale;
    const [ax, az] = rot90(x0 * S, z0 * S, p.rot);
    const [bx, bz] = rot90(x1 * S, z1 * S, p.rot);
    return [p.x + Math.min(ax, bx), p.z + Math.min(az, bz), p.x + Math.max(ax, bx), p.z + Math.max(az, bz)];
  });
}

/** Ponto local (u, v) de desenho da planta da construção p no mundo (u = lado, v = frente/fundo). */
export function planPoint(p, u, v) {
  const [dx, dz] = rot90(u * DIM.buildScale, v * DIM.buildScale, p.rot);
  return [p.x + dx, p.z + dz];
}

/** Ponto do mundo logo na frente da porta principal (1 célula para fora da planta): a estrada chega ali. */
export function doorPoint(p) {
  const [u, v] = PLANS[p.plan].door;
  const [dx, dz] = rot90(u * DIM.buildScale, v * DIM.buildScale + 2, p.rot);
  return [p.x + dx, p.z + dz];
}

/** Giro que vira a frente (+z) da construção em (x, z) para o centro do vale (o Lobby). */
const faceCenter = (x, z) => (Math.abs(x) > Math.abs(z) ? (x > 0 ? 1 : 3) : z > 0 ? 2 : 0);

/**
 * Cria um mundo a partir de uma semente. A mesma semente gera sempre o mesmo vale; sementes
 * diferentes geram vales, lotes, estradas, terraços e lagoas diferentes (um por servidor).
 */
export function createWorld(seed = SEED) {
  const nz = (x, z, scale, salt = 0) => noise(x, z, scale, salt, seed);
  const rand = mulberry32(seed ^ 0x7a11);
  const N = (2 * DIM.half) / DIM.cell; // 180 células por lado
  const cellCenter = (i) => -DIM.half + DIM.cell * (i + 0.5);
  const cellOf = (v) => Math.floor((v + DIM.half) / DIM.cell);
  const inGrid = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
  const { land } = DIM;

  // --- Silhueta do vale: elipse girada, lóbulos e borda com ruído deformado ---
  const tilt = rand() * Math.PI;
  const aspect = 0.82 + rand() * 0.18;
  const lobes = [2, 3, 5].map((k) => [k, rand() * (k === 2 ? 0.06 : 0.04), rand() * Math.PI * 2]);
  function valleyR(x, z) {
    const phi = Math.atan2(z, x);
    const c = Math.cos(phi - tilt);
    const s = Math.sin(phi - tilt) / aspect;
    let f = 1 / Math.sqrt(c * c + s * s);
    for (const [k, amp, ph] of lobes) f += amp * Math.cos(k * phi + ph);
    const wx = x + (nz(x, z, 160, 7) - 0.5) * 90;
    const wz = z + (nz(x, z, 160, 8) - 0.5) * 90;
    const n = nz(wx, wz, 70, 1);
    return Math.max(DIM.valleyMin, Math.min(DIM.valleyMax, DIM.valley * f * (0.94 + 0.12 * n)));
  }
  // Setores com penhasco (no resto, o planalto acaba numa borda sobre o mar)
  const cliffPhase = rand() * Math.PI * 2;
  const cliffAt = (x, z) => {
    const phi = Math.atan2(z, x);
    return 0.5 + 0.35 * Math.sin(phi * 2 + cliffPhase) + (nz(x, z, 120, 11) - 0.5) * 0.5 > 0.42;
  };

  // --- Grade: tipo, altura (topo) e superfície de cada célula ---
  const type = [];
  const top = [];
  const surf = [];
  for (let j = 0; j < N; j++) {
    type.push(new Array(N).fill(T.SEA));
    top.push(new Array(N).fill(0));
    surf.push(new Array(N).fill(null));
  }
  const cliffTop = (x, z, r, R) => {
    // sobe rápido nos primeiros studs e forma massas em degraus de 6 (como rocha empilhada)
    const t = Math.min(1, (r - R) / 26);
    const h = 10 + t * (24 + 46 * nz(x, z, 46, 12)) + (nz(x, z, 18, 13) - 0.5) * 10;
    return land + Math.max(6, Math.round(h / 6) * 6);
  };
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = cellCenter(i);
      const z = cellCenter(j);
      const r = Math.hypot(x, z);
      const R = valleyR(x, z);
      if (r < R) {
        type[j][i] = T.GROUND;
        top[j][i] = land;
        surf[j][i] = 'grama';
      } else if (cliffAt(x, z) && r < R + DIM.cliffBand - (1 - nz(x, z, 30, 14)) * 14) {
        type[j][i] = T.CLIFF;
        top[j][i] = cliffTop(x, z, r, R);
      }
    }
  }
  const cellIs = (x, z, t) => {
    const i = cellOf(x);
    const j = cellOf(z);
    return inGrid(i, j) && type[j][i] === t;
  };
  /** Todos os pontos de um retângulo (a cada `step`, bordas incluídas) são chão do vale? */
  function allGround(x0, x1, z0, z1, step = DIM.cell) {
    for (let x = x0; x < x1 + step; x += step) {
      for (let z = z0; z < z1 + step; z += step) {
        if (!cellIs(Math.min(x, x1), Math.min(z, z1), T.GROUND)) return false;
      }
    }
    return true;
  }

  // --- Praça central (Lobby) ---
  const PLAZA = Object.freeze({
    x: 0,
    z: 0,
    top: land,
    r: DIM.plazaR,
    reach: DIM.ringRoad[1],
    spawn: Object.freeze([0, land, 24]),
  });

  // --- Lagoas: 1 ou 2, longe do Lobby ---
  const PONDS = [];
  const wantPonds = 1 + (seed % 2);
  for (let attempt = 0; attempt < 400 && PONDS.length < wantPonds; attempt++) {
    const a = rand() * Math.PI * 2;
    const d = 205 + rand() * 45; // longe das lojas em volta da praça
    const x = Math.round(Math.cos(a) * d);
    const z = Math.round(Math.sin(a) * d);
    const r = 16 + Math.round(rand() * 12);
    if (!allGround(x - r - 16, x + r + 16, z - r - 16, z + r + 16)) continue;
    if (PONDS.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 60)) continue;
    PONDS.push(Object.freeze({ x, z, r }));
  }
  const inPond = (x, z) => PONDS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r * (0.85 + 0.3 * nz(x, z, 14, 15)));

  // --- Áreas de construção em volta da praça (lojas futuras), entre as 4 saídas ---
  // cada servidor sorteia a ordem dos prédios em volta da praça
  const shopOrder = [...SHOP_PLANS];
  for (let k = shopOrder.length - 1; k > 0; k--) {
    const r = Math.floor(rand() * (k + 1));
    [shopOrder[k], shopOrder[r]] = [shopOrder[r], shopOrder[k]];
  }
  const PADS = [];
  for (let k = 0; k < DIM.pads; k++) {
    const a = (k / DIM.pads) * Math.PI * 2 + Math.PI / DIM.pads;
    const x = Math.round((Math.cos(a) * DIM.padRing) / DIM.cell) * DIM.cell;
    const z = Math.round((Math.sin(a) * DIM.padRing) / DIM.cell) * DIM.cell;
    const plan = shopOrder[k % shopOrder.length];
    const name = `Área ${k + 1}: ${PLANS[plan].name}`;
    PADS.push(Object.freeze({ name, x, z, size: DIM.padSize, plan, rot: faceCenter(x, z) }));
  }

  // sem lotes de castelo (pedido do dono): o vale só tem as lojas em volta da praça
  const PLOTS = [];

  // --- Pinta a grade: praça, anel, áreas, lotes e lagoas ---
  const paint = (x0, x1, z0, z1, fn) => {
    for (let j = Math.max(0, cellOf(z0)); j <= Math.min(N - 1, cellOf(z1 - 0.01)); j++) {
      for (let i = Math.max(0, cellOf(x0)); i <= Math.min(N - 1, cellOf(x1 - 0.01)); i++) {
        if (type[j][i] === T.GROUND) fn(i, j, cellCenter(i), cellCenter(j));
      }
    }
  };
  // praça: pedra clara com faixas escuras pixeladas (dois anéis e um losango) e estrado no meio
  const ringOuter = DIM.ringRoad[1];
  paint(-ringOuter - 4, ringOuter + 4, -ringOuter - 4, ringOuter + 4, (i, j, x, z) => {
    const r = Math.hypot(x, z);
    const jag = (nz(x, z, 6, 16) - 0.5) * 3;
    if (r < DIM.plazaR + jag) {
      const diamond = Math.abs(Math.abs(x) + Math.abs(z) - 30) < 2.5;
      const ring = Math.abs(r - (DIM.plazaR - 6)) < 2.2 || Math.abs(r - 18) < 2;
      surf[j][i] = diamond || ring ? 'pedraEscura' : 'pedra';
      if (r < DIM.daisR) top[j][i] = land + 1;
    } else if (r < ringOuter + jag) {
      surf[j][i] = hash2(i, j, 17, seed) < 0.18 ? 'terraEscura' : 'terra';
    }
  });
  // áreas de construção e lotes: piso de terra clara com borda de pedra
  // cada área segue a planta do seu prédio: piso de terra clara e uma borda de pedra de 1 célula
  const padCells = (list, base, edge) => {
    for (const p of list) {
      const h = p.size / 2 + 2 * DIM.cell;
      paint(p.x - h, p.x + h, p.z - h, p.z + h, (i, j, x, z) => {
        if (inPlan(p, x, z)) surf[j][i] = base;
        else if (inPlan(p, x, z, DIM.cell)) surf[j][i] = edge;
      });
    }
  };
  padCells(PADS, 'area', 'areaBorda');
  padCells(PLOTS, 'lote', 'loteBorda');
  for (const p of PONDS) {
    paint(p.x - p.r * 1.2, p.x + p.r * 1.2, p.z - p.r * 1.2, p.z + p.r * 1.2, (i, j, x, z) => {
      if (!inPond(x, z)) return;
      type[j][i] = T.WATER;
      surf[j][i] = null;
    });
  }

  // --- Estradas: 4 saídas retas da praça e cada área/lote ligado ao ponto mais perto da malha ---
  const ROADS = []; // trechos retos [[x0, z0], [x1, z1]]
  const halfW = DIM.road / 2;
  // a estrada nunca atravessa uma construção: nem as outras (com folga de 8) nem a própria (sai da porta)
  const blockedBy = (x, z, own) =>
    PLOTS.some((p) => inPlan(p, x, z, p === own ? 0 : 8)) || PADS.some((p) => inPlan(p, x, z, p === own ? 0 : 8));
  const legOk = ([ax, az], [bx, bz], own) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1) return true;
    for (let t = 0; t <= len; t += 2) {
      const x = ax + ((bx - ax) * t) / len;
      const z = az + ((bz - az) * t) / len;
      if (!cellIs(x, z, T.GROUND) && !cellIs(x, z, T.WATER)) return false;
      if (blockedBy(x, z, own)) return false;
    }
    return true;
  };
  const drawLeg = ([ax, az], [bx, bz]) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1) return;
    ROADS.push([
      [ax, az],
      [bx, bz],
    ]);
    const alongX = Math.abs(bx - ax) >= Math.abs(bz - az);
    for (let t = -halfW; t <= len + halfW; t += 2) {
      const cx = ax + ((bx - ax) * t) / len;
      const cz = az + ((bz - az) * t) / len;
      for (let w = -halfW - 2; w <= halfW + 2; w += 2) {
        const x = alongX ? cx : cx + w;
        const z = alongX ? cz + w : cz;
        const jag = (nz(x, z, 8, 18) - 0.5) * 4; // borda serrilhada (pixelada)
        if (Math.abs(w) > halfW + jag) continue;
        const i = cellOf(x);
        const j = cellOf(z);
        if (!inGrid(i, j)) continue;
        if (type[j][i] === T.WATER) {
          type[j][i] = T.GROUND; // passagem de pedra sobre a lagoa
          top[j][i] = land;
          surf[j][i] = 'ponte';
          continue;
        }
        if (type[j][i] !== T.GROUND || KEEP_SURF.has(surf[j][i]) || surf[j][i] === 'ponte') continue;
        surf[j][i] = hash2(i, j, 19, seed) < 0.16 ? 'terraEscura' : 'terra';
      }
    }
  };
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    let d = ringOuter;
    while (d < DIM.valleyMax && cellIs(dx * (d + 24), dz * (d + 24), T.GROUND)) d += 4;
    const ok = legOk([dx * ringOuter, dz * ringOuter], [dx * d, dz * d], null);
    if (d > ringOuter + 8 && ok) drawLeg([dx * (ringOuter - 6), dz * (ringOuter - 6)], [dx * d, dz * d]);
  }
  /** Pontos da malha (anel ou estradas já desenhadas), do mais perto ao mais longe de (x, z). */
  const netPoints = (x, z) => {
    const pts = [];
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      pts.push([Math.cos(a) * 57, Math.sin(a) * 57]);
    }
    for (const [[ax, az], [bx, bz]] of ROADS) {
      const len = Math.hypot(bx - ax, bz - az);
      for (let t = 0; t <= len; t += 4) pts.push([ax + ((bx - ax) * t) / len, az + ((bz - az) * t) / len]);
    }
    return pts
      .map(([px, pz]) => [Math.round(px / 2) * 2, Math.round(pz / 2) * 2])
      .sort((p, q) => Math.hypot(p[0] - x, p[1] - z) - Math.hypot(q[0] - x, q[1] - z));
  };
  /** Tenta um caminho de trechos retos; se todos os trechos servem, desenha e devolve true. */
  const tryPath = (pts, own) => {
    for (let k = 0; k + 1 < pts.length; k++) if (!legOk(pts[k], pts[k + 1], own)) return false;
    for (let k = 0; k + 1 < pts.length; k++) drawLeg(pts[k], pts[k + 1]);
    return true;
  };
  /**
   * Liga (x, z) à malha: primeiro um "L" (dois trechos retos) até um dos pontos mais perto, nas duas
   * ordens; se nenhum servir, um "Z" (três trechos) que desvia dos outros lotes por um corredor.
   */
  const connect = (x, z, own) => {
    const targets = netPoints(x, z).slice(0, 80);
    for (const [nx, nzz] of targets) {
      for (const corner of [
        [x, nzz],
        [nx, z],
      ]) {
        if (tryPath([[x, z], corner, [nx, nzz]], own)) return true;
      }
    }
    for (const [nx, nzz] of targets.slice(0, 30)) {
      for (let f = 0.2; f < 0.85; f += 0.15) {
        const mx = Math.round((x + (nx - x) * f) / 2) * 2;
        const mz = Math.round((z + (nzz - z) * f) / 2) * 2;
        const zx = [
          [x, z],
          [mx, z],
          [mx, nzz],
          [nx, nzz],
        ];
        const zz = [
          [x, z],
          [x, mz],
          [nx, mz],
          [nx, nzz],
        ];
        if (tryPath(zx, own) || tryPath(zz, own)) return true;
      }
    }
    return gridRoute(x, z, own);
  };
  /**
   * Último recurso: busca em largura na grade (células de chão ou lagoa, fora da folga dos outros
   * lotes e áreas) até a estrada mais perto; o caminho vira trechos retos nas curvas.
   */
  function gridRoute(x, z, own) {
    const start = [cellOf(x), cellOf(z)];
    const prev = new Int32Array(N * N).fill(-1);
    const idx = (i, j) => j * N + i;
    prev[idx(...start)] = idx(...start);
    const queue = [start];
    let goal = null;
    for (let q = 0; q < queue.length && !goal; q++) {
      const [i, j] = queue[q];
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ii = i + di;
        const jj = j + dj;
        if (!inGrid(ii, jj) || prev[idx(ii, jj)] >= 0) continue;
        if (type[jj][ii] !== T.GROUND && type[jj][ii] !== T.WATER) continue;
        if (blockedBy(cellCenter(ii), cellCenter(jj), own)) continue;
        prev[idx(ii, jj)] = idx(i, j);
        const s = surf[jj][ii];
        if (s === 'terra' || s === 'terraEscura' || s === 'ponte') {
          goal = [ii, jj];
          break;
        }
        queue.push([ii, jj]);
      }
    }
    if (!goal) return false;
    const cells = [goal];
    while (idx(...cells[0]) !== idx(...start)) {
      const p = prev[idx(...cells[0])];
      cells.unshift([p % N, Math.floor(p / N)]);
    }
    const pts = cells.map(([i, j]) => [cellCenter(i), cellCenter(j)]);
    const turns = [pts[0]];
    for (let k = 1; k + 1 < pts.length; k++) {
      const [a, b, c] = [pts[k - 1], pts[k], pts[k + 1]];
      if ((b[0] - a[0]) * (c[1] - b[1]) !== (b[1] - a[1]) * (c[0] - b[0])) turns.push(b);
    }
    turns.push(pts.at(-1));
    for (let k = 0; k + 1 < turns.length; k++) drawLeg(turns[k], turns[k + 1]);
    return true;
  }
  const padsLinked = PADS.map((p) => connect(...doorPoint(p), p));
  const plotsLinked = PLOTS.map((p) => connect(...doorPoint(p), p));

  // --- Manchas de grama escura e terraços de grama (degraus de 2 studs), longe das áreas planas ---
  const flatNear = (i, j, rad) => {
    for (let dj = -rad; dj <= rad; dj++) {
      for (let di = -rad; di <= rad; di++) {
        const ii = i + di;
        const jj = j + dj;
        if (!inGrid(ii, jj) || type[jj][ii] !== T.GROUND) return true;
        const s = surf[jj][ii];
        if (s !== 'grama' && s !== 'gramaEscura') return true;
      }
    }
    return false;
  };
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (type[j][i] !== T.GROUND || surf[j][i] !== 'grama') continue;
      // manchas em blocos de 8 studs, como os quadrados escuros da grama pixelada
      if (hash2(Math.floor(i / 2), Math.floor(j / 2), 20, seed) < 0.12) surf[j][i] = 'gramaEscura';
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (type[j][i] !== T.GROUND || top[j][i] !== land) continue;
      const s = surf[j][i];
      if (s !== 'grama' && s !== 'gramaEscura') continue;
      const n = nz(cellCenter(i), cellCenter(j), 52, 21);
      if (n > 0.64 && !flatNear(i, j, 3)) top[j][i] = land + (n > 0.76 && !flatNear(i, j, 5) ? 4 : 2);
    }
  }

  // --- Ligação ao Lobby pela malha (busca em largura nas células de caminho, todas no nível do chão) ---
  const walk = (i, j) => inGrid(i, j) && type[j][i] === T.GROUND && top[j][i] === land && PATH_SURF.has(surf[j][i]);
  const seen = new Uint8Array(N * N);
  {
    const start = [cellOf(0), cellOf(DIM.plazaR - 12)];
    const queue = [start];
    seen[start[1] * N + start[0]] = 1;
    while (queue.length) {
      const [i, j] = queue.pop();
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ii = i + di;
        const jj = j + dj;
        if (!walk(ii, jj) || seen[jj * N + ii]) continue;
        seen[jj * N + ii] = 1;
        queue.push([ii, jj]);
      }
    }
  }
  const reached = (p) => seen[cellOf(p.z) * N + cellOf(p.x)] === 1;
  const plotsConnected = PLOTS.map((p, k) => plotsLinked[k] && reached(p));
  const padsConnected = PADS.map((p, k) => padsLinked[k] && reached(p));

  /** Centros das células do piso de uma área ou lote (dentro da planta). */
  function footprint(p) {
    const out = [];
    const h = p.size / 2 + DIM.cell;
    for (let j = cellOf(p.z - h); j <= cellOf(p.z + h); j++) {
      for (let i = cellOf(p.x - h); i <= cellOf(p.x + h); i++) {
        if (inGrid(i, j) && inPlan(p, cellCenter(i), cellCenter(j))) out.push([cellCenter(i), cellCenter(j)]);
      }
    }
    return out;
  }

  /** Tipo do terreno no ponto (x, z). */
  function terrainAt(x, z) {
    const i = cellOf(x);
    const j = cellOf(z);
    return inGrid(i, j) ? type[j][i] : T.SEA;
  }
  /** Topo do terreno no ponto (x, z) (0 no mar). */
  function heightAt(x, z) {
    const i = cellOf(x);
    const j = cellOf(z);
    return inGrid(i, j) ? top[j][i] : 0;
  }
  /** Superfície do chão no ponto (x, z), ou null. */
  function surfaceAt(x, z) {
    const i = cellOf(x);
    const j = cellOf(z);
    return inGrid(i, j) ? surf[j][i] : null;
  }

  /** Zonas que nenhuma peça com colisão pode invadir: pisos das áreas e dos lotes, saída sul e spawn. */
  /** Monta as construções num construtor descartável só para colher as zonas de passagem. */
  let cachedZones = null;
  function buildingZones() {
    if (!cachedZones) {
      const scratch = makeBuilder();
      cachedZones = [...PADS.flatMap((p) => buildShop(scratch, p, land))];
    }
    return cachedZones;
  }

  function clearanceZones() {
    const zones = [];
    const box = (name, x0, x1, z0, z1, y0, h) => zones.push({ name, min: [x0, y0, z0], max: [x1, land + h, z1] });
    // portas, corredores e salões das construções (cada prédio declara as suas passagens)
    zones.push(...buildingZones());
    // acima do piso de spawn (1 stud de altura): o jogador nasce e sai andando para o sul
    box('Caminho do Spawn', -4, 4, DIM.daisR + 1, DIM.ringRoad[0], land + 1.05, 10);
    box('Spawn', -3.5, 3.5, 20.5, 27.5, land + 1.05, 8);
    return zones;
  }

  const ENVELOPE = Object.freeze({
    min: [-DIM.seaHalf, DIM.seaBottom, -DIM.seaHalf],
    max: [DIM.seaHalf, 120, DIM.seaHalf],
  });

  // ---------------------------------------------------------------------------
  // Parts
  // ---------------------------------------------------------------------------
  function buildMap() {
    const b = makeBuilder();
    const { bottom, cap } = DIM;
    b.span('Mar', 'Mar', [-DIM.seaHalf, DIM.seaBottom, -DIM.seaHalf], [DIM.seaHalf, 0, DIM.seaHalf], C.sea);
    const cliffColor = (i, j) => {
      const n = hash2(i, Math.floor(j / 3), 22, seed);
      return n < 0.16 ? C.pxMoss : n < 0.55 ? C.pxCliff : n < 0.85 ? C.pxCliffDark : C.pxCliffLight;
    };
    let cliffMax = land;
    for (let j = 0; j < N; j++) {
      const z0 = -DIM.half + j * DIM.cell;
      const z1 = z0 + DIM.cell;
      // corpos: células seguidas com o mesmo tipo, topo e cor viram um bloco só
      const bodyKey = (ii) => {
        const t = type[j][ii];
        if (t === T.SEA) return null;
        if (t === T.CLIFF) return `c|${top[j][ii]}|${cliffColor(ii, j).join(',')}`;
        if (t === T.WATER) return 'w';
        const s = surf[j][ii];
        return `g|${top[j][ii]}|${s === 'pedra' || s === 'pedraEscura' ? 's' : 'd'}`;
      };
      let i = 0;
      while (i < N) {
        const k0 = bodyKey(i);
        if (k0 === null) {
          i++;
          continue;
        }
        let k = i;
        while (k + 1 < N && bodyKey(k + 1) === k0) k++;
        const x0 = -DIM.half + i * DIM.cell;
        const x1 = -DIM.half + (k + 1) * DIM.cell;
        const h = top[j][i];
        if (k0.startsWith('c')) {
          cliffMax = Math.max(cliffMax, h);
          b.span('Penhascos', 'Rocha', [x0, bottom, z0], [x1, h - 1.5, z1], cliffColor(i, j));
        } else if (k0 === 'w') {
          b.span('Água', 'Leito', [x0, bottom, z0], [x1, 1, z1], C.pxDirtDark);
          b.span('Água', 'Água da Lagoa', [x0, 1, z0], [x1, 3.2, z1], C.pxWater, {
            canCollide: false,
            transparency: 0.25,
          });
        } else {
          const stone = k0.endsWith('s');
          const color = stone ? C.pxStoneDark : C.pxSoil;
          b.span('Terreno', stone ? 'Base da Praça' : 'Chão', [x0, bottom, z0], [x1, h - cap, z1], color);
        }
        i = k + 1;
      }
      // camadas de superfície: musgo no topo dos penhascos; grama, terra, pedra e pisos no chão
      const capKey = (ii) => {
        const t = type[j][ii];
        if (t === T.CLIFF) return `c|${top[j][ii]}`;
        if (t === T.GROUND) return `g|${top[j][ii]}|${surf[j][ii]}`;
        return null;
      };
      i = 0;
      while (i < N) {
        const k0 = capKey(i);
        if (k0 === null) {
          i++;
          continue;
        }
        let k = i;
        while (k + 1 < N && capKey(k + 1) === k0) k++;
        const x0 = -DIM.half + i * DIM.cell;
        const x1 = -DIM.half + (k + 1) * DIM.cell;
        const h = top[j][i];
        if (k0.startsWith('c')) {
          b.span('Penhascos', 'Musgo', [x0, h - 1.5, z0], [x1, h, z1], C.pxMoss);
        } else {
          const s = SURF[surf[j][i]];
          b.span(s.model, s.name, [x0, h - cap, z0], [x1, h, z1], s.color);
        }
        i = k + 1;
      }
    }
    // spawn no lado sul da praça
    const [sx, sy, sz] = PLAZA.spawn;
    b.box('Lobby', 'SpawnLocation', [sx, sy + 0.5, sz], [8, 1, 8], C.pxStoneDark, { className: 'SpawnLocation' });
    // estátua de Luvitlua (o perfil do dono do jogo) no estrado do meio da praça, de frente para o spawn
    buildStatue(b, 0, land + 1, 0);
    // construções com interior: os 8 prédios do Lobby e os 30 castelos, cada um na sua planta
    for (const p of PADS) buildShop(b, p, land);
    // postes de luz na praça (a noite do Lobby), entre as saídas e longe do caminho do spawn
    for (let k = 0; k < 8; k++) {
      const a = ((k + 0.5) * Math.PI) / 4;
      const x = Math.round(Math.cos(a) * 40) + 0.3;
      const z = Math.round(Math.sin(a) * 40) + 0.3;
      const M = 'Lobby/Postes de Luz';
      b.span(M, 'Base do Poste', [x - 0.7, land, z - 0.7], [x + 0.7, land + 0.8, z + 0.7], C.pxStoneWallDark);
      b.span(M, 'Poste', [x - 0.25, land + 0.8, z - 0.25], [x + 0.25, land + 9, z + 0.25], C.pxIron);
      b.span(M, 'Lanterna do Poste', [x - 0.6, land + 9, z - 0.6], [x + 0.6, land + 10.2, z + 0.6], C.pxWindowLit, {
        material: 'Neon',
        canCollide: false,
        light: { type: 'Point', range: 30, brightness: 1.6, color: [255, 206, 140] },
      });
      b.span(M, 'Chapéu do Poste', [x - 0.8, land + 10.2, z - 0.8], [x + 0.8, land + 10.6, z + 0.8], C.pxIron);
    }

    let terraces = 0;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) if (type[j][i] === T.GROUND && top[j][i] > land + 1) terraces++;
    const landmarks = {
      plots: PLOTS.length,
      pads: PADS.length,
      ponds: PONDS.map((p) => [p.x, p.z, p.r]),
      cliffMax,
      roads: ROADS.length,
      terraces,
    };
    return { parts: b.parts, landmarks };
  }

  const MAP_INFO = Object.freeze({ plots: PLOTS.length, pads: PADS.length, roads: ROADS.length, ponds: PONDS.length });
  return {
    seed,
    DIM,
    T,
    PLAZA,
    PLOTS: Object.freeze(PLOTS),
    PADS: Object.freeze(PADS),
    PONDS: Object.freeze(PONDS),
    ROAD_LEGS: Object.freeze(ROADS),
    ENVELOPE,
    MAP_INFO,
    plotsConnected,
    padsConnected,
    valleyR,
    footprint,
    terrainAt,
    heightAt,
    surfaceAt,
    allGround,
    clearanceZones,
    buildMap,
  };
}

const WORLD = createWorld(SEED);

/** O mundo padrão (semente SEED): é o que vai para o lugar principal e para as capturas. */
export const { PLAZA, PLOTS, PADS, PONDS, ROAD_LEGS, ENVELOPE, MAP_INFO } = WORLD;
export const { terrainAt, heightAt, surfaceAt, clearanceZones } = WORLD;

/** Monta as Parts do mundo da semente dada (padrão: SEED). */
export function buildMap(seed = SEED) {
  return seed === SEED ? WORLD.buildMap() : createWorld(seed).buildMap();
}
