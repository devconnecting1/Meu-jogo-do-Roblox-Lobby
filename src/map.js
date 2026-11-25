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
// depois), estradas de pedra ligando tudo, pontes de madeira, montanhas e colinas, florestas
// verdes e de outono, pedras, campos de trigo, jazidas, pedreiras e cais na praia.
//
// Tudo sai de uma semente fixa: a mesma semente gera sempre o mesmo mapa.
// Unidades: studs. Eixos do Roblox (Y para cima). Medidas em DIM.

import { makeBuilder } from './builder.js';
import { C } from './palette.js';
import { fountainStatue, FOUNTAIN_HALF } from './props/statue.js';
import { shop, bench, planter, archGate, lampPost } from './props/lobby.js';
import { plantTree, bush, flowerPatch } from './props/trees.js';
import { building, footprint } from './props/buildings.js';

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
  islandRadius: 600, // raio de referência da silhueta (cada semente deforma: elipse, lóbulos, baías)
  plots: 30, // lotes de castelo
  players: 20, // lotes de jogadores reais
  bots: 10, // lotes de bots
  plotSize: 32, // fundação 32×32
  plotSpacing: 120, // distância desejada entre centros de lotes
  minPlotSpacing: 84, // nunca mais perto que isso
  plazaHalf: 44, // Lobby: plataforma elevada de 88×88 no centro do mapa, com mercado
  lobbyRise: 6, // a plataforma fica 6 studs acima da grama (6 degraus de 1 stud)
  lobbyRun: 1.25, // profundidade de cada degrau das escadarias
  road: 8, // largura das estradas
  maxBridge: 50, // ponte mais longa (studs sobre a água)
  maxParts: 32000, // orçamento de Parts por mapa (testado em todas as sementes)
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

// ---------------------------------------------------------------------------
// Terreno: grade de células (mar, grama, areia, rio, lago)
// ---------------------------------------------------------------------------
export const T = Object.freeze({ SEA: 0, GRASS: 1, SAND: 2, RIVER: 3, LAKE: 4 });

/**
 * Cria um mundo a partir de uma semente. A mesma semente gera sempre o mesmo mapa; sementes
 * diferentes geram ilhas, lagos, rios, lotes, estradas e decoração diferentes (um por servidor).
 */
export function createWorld(seed = SEED) {
  const nz = (x, z, scale, salt = 0) => noise(x, z, scale, salt, seed);

  // lago e rio: na semente padrão ficam onde sempre estiveram; nas outras, sorteados
  // (o lago longe do Lobby e o rio sempre andando para fora, até passar da costa)
  const { LAKE, RIVER } = lakeAndRiver(seed);
  const RIVER_HALF = 13;

  const N = (2 * DIM.half) / DIM.cell; // 75 células por lado
  const cellCenter = (i) => -DIM.half + DIM.cell * (i + 0.5);

  function distToSegment(px, pz, [ax, az], [bx, bz]) {
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
  }
  function distToRiver(x, z) {
    let d = Infinity;
    for (let k = 0; k < RIVER.length - 1; k++) d = Math.min(d, distToSegment(x, z, RIVER[k], RIVER[k + 1]));
    return d;
  }

  // --- Silhueta da ilha, sorteada por semente: elipse girada (mais redonda ou mais comprida),
  // lóbulos (harmônicos), 1 a 3 baías fundas, 0 a 2 penínsulas e costa recortada por ruído
  // deformado. Cada servidor tem uma ilha com outro formato; o raio fica entre ISLAND_MIN
  // (sempre sobra espaço para o Lobby, o lago e os 30 lotes) e a borda da grade.
  const shapeRand = mulberry32(seed ^ 0x15a7);
  const ISLAND_MIN = 380;
  const ISLAND_MAX = DIM.half - 24;
  const shapeTilt = shapeRand() * Math.PI;
  const shapeAspect = 0.8 + shapeRand() * 0.2; // eixo menor / eixo maior
  const lobes = [2, 3, 4, 5].map((k) => [k, shapeRand() * (k === 2 ? 0.07 : 0.045), shapeRand() * Math.PI * 2]);
  const notches = [];
  const nBays = 1 + Math.floor(shapeRand() * 3);
  for (let k = 0; k < nBays; k++) {
    notches.push([shapeRand() * Math.PI * 2, -(0.1 + shapeRand() * 0.1), 0.16 + shapeRand() * 0.2]);
  }
  const nCapes = Math.floor(shapeRand() * 3);
  for (let k = 0; k < nCapes; k++) {
    notches.push([shapeRand() * Math.PI * 2, 0.08 + shapeRand() * 0.08, 0.12 + shapeRand() * 0.12]);
  }
  function coastRadius(x, z) {
    const phi = Math.atan2(z, x);
    const c = Math.cos(phi - shapeTilt);
    const s = Math.sin(phi - shapeTilt) / shapeAspect;
    let f = 1 / Math.sqrt(c * c + s * s); // elipse
    for (const [k, amp, ph] of lobes) f += amp * Math.cos(k * phi + ph);
    for (const [a, depth, width] of notches) {
      const d = Math.atan2(Math.sin(phi - a), Math.cos(phi - a)) / width;
      f += depth * Math.exp(-d * d);
    }
    // ruído com o domínio deformado: a costa ganha enseadas e pontas irregulares
    const wx = x + (nz(x, z, 230, 7) - 0.5) * 140;
    const wz = z + (nz(x, z, 230, 8) - 0.5) * 140;
    const n = 0.6 * nz(wx, wz, 170, 1) + 0.4 * nz(wx, wz, 60, 2);
    return Math.max(ISLAND_MIN, Math.min(ISLAND_MAX, DIM.islandRadius * f * (0.8 + 0.3 * n)));
  }

  function rawType(x, z) {
    const r = Math.hypot(x, z);
    if (r >= coastRadius(x, z)) return T.SEA;
    const lakeEdge = LAKE.r * (0.85 + 0.3 * nz(x, z, 40, 3));
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

  // --- Biomas: cada semente gira as regiões, então cada servidor tem uma ilha diferente ---
  const brand = mulberry32(seed ^ 0xb10e);
  const DESERT_ANG = brand() * Math.PI * 2; // setor seco (areia firme, coqueiros, rocha avermelhada)
  const FOREST_ANG = DESERT_ANG + Math.PI * (0.75 + brand() * 0.5); // floresta escura do outro lado
  const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  /** 'deserto' | 'floresta' | 'campo' no ponto (x, z). */
  function biomeAt(x, z) {
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    const wob = (nz(x, z, 90, 21) - 0.5) * 0.6;
    if (r > 220 && angDiff(a, DESERT_ANG) < 0.62 + wob) return 'deserto';
    if (r > 170 && r < 470 && angDiff(a, FOREST_ANG) < 0.5 + wob) return 'floresta';
    return 'campo';
  }
  const cliffAt = (x, z) => nz(x, z, 140, 25) > 0.56;

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
    // falésias: em parte da costa a grama vai até a beira (sem praia) e o barranco fica claro
    for (const [i, j] of sand) if (!cliffAt(cellCenter(i), cellCenter(j))) g[j][i] = T.SAND;
    return g;
  })();

  /** Célula de grama encostada no mar (vira falésia clara). */
  const coastal = (i, j) => NEIGHBORS.some(([di, dj]) => (GRID[j + dj]?.[i + di] ?? T.SEA) === T.SEA);

  /** Tipo do terreno no ponto (x, z): T.SEA, T.GRASS, T.SAND, T.RIVER ou T.LAKE. */
  function terrainAt(x, z) {
    const i = Math.floor((x + DIM.half) / DIM.cell);
    const j = Math.floor((z + DIM.half) / DIM.cell);
    if (i < 0 || j < 0 || i >= N || j >= N) return T.SEA;
    return GRID[j][i];
  }

  /** Todos os pontos de um retângulo (amostrados a cada `step`, bordas incluídas) são grama? */
  function allGrass(x0, x1, z0, z1, step = 4) {
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
  // O Lobby é a praça central: plataforma elevada com escadarias de madeira nas 4 saídas.
  const PLAZA_REACH = DIM.plazaHalf * Math.SQRT2; // ~62: raio que cobre a plataforma
  const LOBBY_GUARD = DIM.plazaHalf + DIM.lobbyRise * DIM.lobbyRun; // plataforma + escadarias
  const PLAZA = Object.freeze({
    x: 0,
    z: 0,
    top: DIM.land + DIM.lobbyRise,
    reach: PLAZA_REACH,
    guard: LOBBY_GUARD,
    // pé de cada escadaria: as estradas começam aqui
    gates: Object.freeze([
      [LOBBY_GUARD + 4, 0],
      [-(LOBBY_GUARD + 4), 0],
      [0, LOBBY_GUARD + 4],
      [0, -(LOBBY_GUARD + 4)],
    ]),
  });

  // ---------------------------------------------------------------------------
  // Lotes de castelo
  // ---------------------------------------------------------------------------
  function pickPlots(banned) {
    const rand = mulberry32(seed ^ 0x51a7);
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
  // Estradas: a malha cresce a partir do Lobby. Cada lote (do mais perto ao mais longe)
  // liga no ponto mais próximo da malha que já existe (forma cruzamentos em "T"), com
  // trechos retos. Estrada nunca passa por cima de outro lote nem corre colada em outra.
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
  const section = (x, z, horiz, half = ROAD_HALF) =>
    horiz
      ? [
          [x, z],
          [x, z - half],
          [x, z + half],
        ]
      : [
          [x, z],
          [x - half, z],
          [x + half, z],
        ];

  /**
   * Um trecho reto é válido se passa só por grama ou por rio (ponte de até DIM.maxBridge),
   * fora do Lobby e fora dos lotes (menos o próprio). Devolve null ou os studs sobre a água.
   */
  function legWater(a, b, ctx) {
    const horiz = a[1] === b[1];
    let run = 0;
    let total = 0;
    for (const [x, z] of samples(a, b, 2)) {
      let wet = false;
      for (const [px, pz] of section(x, z, horiz, ctx.half)) {
        const t = terrainAt(px, pz);
        if (t === T.RIVER && ctx.bridges) wet = true;
        else if (t !== T.GRASS) return null;
        if (Math.abs(px) < LOBBY_GUARD && Math.abs(pz) < LOBBY_GUARD) return null; // nunca por dentro do Lobby
        for (const r of ctx.avoid) {
          if (r !== ctx.own && px > r.x0 && px < r.x1 && pz > r.z0 && pz < r.z1) return null;
        }
      }
      run = wet ? run + 2 : 0;
      total += wet ? 2 : 0;
      if (run > DIM.maxBridge) return null;
    }
    return total;
  }

  /** Esquina ou cruzamento: precisa ficar na grama (nada de curva em cima de ponte). */
  const cornerOk = ([x, z], half = ROAD_HALF) => allGrass(x - half, x + half, z - half, z + half, 2);

  const legAxis = ([a, b]) => (a[1] === b[1] ? 'x' : 'z');
  const legAt = (l) => (legAxis(l) === 'x' ? l[0][1] : l[0][0]);
  const legSpan = (l) => {
    const i = legAxis(l) === 'x' ? 0 : 1;
    return [Math.min(l[0][i], l[1][i]), Math.max(l[0][i], l[1][i])];
  };

  /** Trecho novo correndo colado (ou por cima) de um trecho existente paralelo? */
  function hugs(leg, legs, gap) {
    const ax = legAxis(leg);
    const [s0, s1] = legSpan(leg);
    return legs.some((o) => {
      if (legAxis(o) !== ax || Math.abs(legAt(o) - legAt(leg)) >= gap) return false;
      const [o0, o1] = legSpan(o);
      return Math.min(s1, o1) - Math.max(s0, o0) > 2;
    });
  }

  /** Valida um caminho (lista de pontos): devolve {legs, water} ou null. */
  function checkRoute(points, ctx, network) {
    const pts = points.filter((p, k) => k === 0 || p[0] !== points[k - 1][0] || p[1] !== points[k - 1][1]);
    if (pts.length < 2) return null;
    const legs = [];
    let water = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const leg = [pts[k], pts[k + 1]];
      if (leg[0][0] !== leg[1][0] && leg[0][1] !== leg[1][1]) return null; // só trechos retos
      const w = legWater(leg[0], leg[1], ctx);
      if (w === null || hugs(leg, network, ctx.gap)) return null;
      water += w;
      legs.push(leg);
    }
    for (let k = 1; k < pts.length; k++) if (!cornerOk(pts[k], ctx.half)) return null;
    return { legs, water };
  }

  /** Pontos da malha onde dá para ligar: saídas do Lobby, pontas e o ponto mais próximo de cada trecho. */
  function attachPoints(A, network, gates) {
    const pts = gates.map((g) => [...g]);
    for (const l of network) {
      const [s0, s1] = legSpan(l);
      if (legAxis(l) === 'x') pts.push([Math.round(Math.min(Math.max(A[0], s0), s1)), legAt(l)]);
      else pts.push([legAt(l), Math.round(Math.min(Math.max(A[1], s0), s1))]);
      pts.push([...l[0]], [...l[1]]);
    }
    const d = (p) => Math.abs(p[0] - A[0]) + Math.abs(p[1] - A[1]);
    return pts.sort((p, q) => d(p) - d(q) || p[0] - q[0] || p[1] - q[1]).slice(0, 24);
  }

  /** Liga o ponto A à malha (caminho mais curto que passa nas regras). */
  function connect(A, network, gates, ctx) {
    for (const T of attachPoints(A, network, gates)) {
      const mx = Math.round((A[0] + T[0]) / 2);
      const mz = Math.round((A[1] + T[1]) / 2);
      for (const opt of [
        [A, [T[0], A[1]], T],
        [A, [A[0], T[1]], T],
        [A, [mx, A[1]], [mx, T[1]], T],
        [A, [A[0], mz], [T[0], mz], T],
      ]) {
        const r = checkRoute(opt, ctx, network);
        if (r) return r;
      }
    }
    return null;
  }

  const plotRect = (p, pad = 0) => {
    const h = DIM.plotSize / 2 + pad;
    return { x0: p.x - h, x1: p.x + h, z0: p.z - h, z1: p.z + h };
  };

  function planRoads(plots) {
    const gates = PLAZA.gates;
    const rects = plots.map((p) => plotRect(p, 3));
    const order = plots
      .map((_, k) => k)
      .sort((a, b) => Math.hypot(plots[a].x, plots[a].z) - Math.hypot(plots[b].x, plots[b].z));
    const legs = [];
    const connected = plots.map(() => false);
    let crossings = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (const k of order) {
        if (connected[k]) continue;
        const ctx = { half: ROAD_HALF, bridges: true, avoid: rects, own: rects[k], gap: 16 };
        const r = connect([plots[k].x, plots[k].z], legs, gates, ctx);
        if (!r) continue;
        legs.push(...r.legs);
        connected[k] = true;
        if (r.water > 0) crossings++;
      }
    }
    // pontes dão vida ao mapa: se nenhum lote precisou cruzar o rio, liga um vizinho do outro lado
    for (let a = 0; a < plots.length && crossings === 0; a++) {
      for (let b = 0; b < plots.length && crossings === 0; b++) {
        if (a === b || Math.hypot(plots[a].x - plots[b].x, plots[a].z - plots[b].z) > 260) continue;
        const ctx = { half: ROAD_HALF, bridges: true, avoid: rects, own: rects[a], gap: 16 };
        const A = [plots[a].x, plots[a].z];
        const B = [plots[b].x, plots[b].z];
        const r = [
          [A, [B[0], A[1]], B],
          [A, [A[0], B[1]], B],
        ]
          .map((o) => checkRoute(o, { ...ctx, avoid: rects.filter((_, i) => i !== b) }, legs))
          .find((x) => x && x.water > 0);
        if (!r) continue;
        legs.push(...r.legs);
        crossings++;
      }
    }
    return { legs, connected };
  }

  /** Escolhe os lotes e as estradas; um lote que não dá para ligar à praça é trocado de lugar. */
  function planKingdom() {
    let banned = [];
    for (let round = 0; ; round++) {
      const plots = pickPlots(banned);
      const { legs, connected } = planRoads(plots);
      const lost = plots.filter((_, k) => !connected[k]);
      if (!lost.length || round >= 10) return { plots, legs, connected };
      banned = banned.concat(lost);
    }
  }

  const KINGDOM = planKingdom();

  /** Os 30 lotes. O jogo sorteia depois quais ficam com os 20 jogadores e quais com os 10 bots. */
  const PLOTS = Object.freeze(
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

  /** Trechos da malha de estradas (para ligar trilhas e para o visualizador). */
  const ROAD_LEGS = Object.freeze(KINGDOM.legs.map((l) => Object.freeze(l.map((p) => Object.freeze([...p])))));
  const ROAD_PIECES = KINGDOM.legs.flatMap(splitLeg);
  const rectOf = (p) =>
    p.axis === 'x'
      ? { x0: p.t0, x1: p.t1, z0: p.at - ROAD_HALF, z1: p.at + ROAD_HALF }
      : { x0: p.at - ROAD_HALF, x1: p.at + ROAD_HALF, z0: p.t0, z1: p.t1 };
  const ROAD_RECTS = ROAD_PIECES.map(rectOf);

  const distToRect = (x, z, r) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
  const distToRoads = (x, z) => ROAD_RECTS.reduce((d, r) => Math.min(d, distToRect(x, z, r)), Infinity);
  const rectsApart = (a, b, gap) =>
    a.x1 + gap <= b.x0 || b.x1 + gap <= a.x0 || a.z1 + gap <= b.z0 || b.z1 + gap <= a.z0;

  // ---------------------------------------------------------------------------
  // Zonas livres e limites (usados nos testes)
  // ---------------------------------------------------------------------------

  /** Zonas que precisam ficar livres de colisão: em cima dos lotes, das estradas e do spawn. */
  function clearanceZones() {
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
    const r = DIM.plazaHalf - 1;
    const f = FOUNTAIN_HALF + 1; // os caminhos começam na borda da fonte
    zones.push({ name: 'Caminho Leste do Lobby', min: [f, y0, -4], max: [r, y1, 4] });
    zones.push({ name: 'Caminho Oeste do Lobby', min: [-r, y0, -4], max: [-f, y1, 4] });
    zones.push({ name: 'Caminho Sul do Lobby', min: [-4, y0, f], max: [4, y1, r] });
    zones.push({ name: 'Caminho Norte do Lobby', min: [-4, y0, -r], max: [4, y1, -f] });
    return zones;
  }

  const ENVELOPE = Object.freeze({
    min: [-DIM.seaHalf, DIM.seaBottom, -DIM.seaHalf],
    max: [DIM.seaHalf, 160, DIM.seaHalf],
  });

  // ---------------------------------------------------------------------------
  // Peças compostas
  // ---------------------------------------------------------------------------
  const deco = { canCollide: false };

  /**
   * Montanha natural (mapa de alturas em colunas): encostas irregulares, cristas e picos
   * secundários, em vez de caixas empilhadas. Devolve pontos de encosta de grama (para
   * pinheiros) e a altura do pico.
   */
  function mountain(b, model, cx, cz, R, H, rand, snowy, rocky = false, dry = false) {
    // Relevo natural em "voxels": um mapa de alturas (pico principal + picos secundários +
    // ruído de cristas) virado em colunas, com degraus de 1,5 stud. Cor pela altura: encosta de
    // grama com lateral de terra embaixo, rocha listrada no meio e neve no topo das altas.
    const cell = R >= 34 ? 6 : R >= 16 ? 5 : 3;
    const stepH = 1.5;
    const salt = 31 + Math.floor(rand() * 1000);
    const peaks = [[cx, cz, 1]];
    const extra = R >= 30 ? 1 + Math.floor(rand() * 2) : R >= 16 ? Math.floor(rand() * 2) : 0;
    for (let k = 0; k < extra; k++) {
      const a = rand() * Math.PI * 2;
      const d = R * (0.3 + rand() * 0.3);
      peaks.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d, 0.5 + rand() * 0.35]);
    }
    const heightAt = (x, z) => {
      let h = 0;
      for (const [px, pz, w] of peaks) {
        const d = Math.hypot(x - px, z - pz) / R;
        // meio cone, meio domo: ombros largos em vez de agulha (o pico continua em w)
        if (d < 1) h = Math.max(h, w * (0.5 * Math.pow(1 - d, 1.1) + 0.5 * (1 - d * d)));
      }
      const fade = Math.max(0, 1 - Math.hypot(x - cx, z - cz) / R);
      const ridges = nz(x, z, R * 0.45, salt) * 0.55 + nz(x, z, R * 0.18, salt + 1) * 0.3;
      return Math.min(1.25, h * (0.7 + ridges)) * H * Math.min(1, fade * 3);
    };
    const n = Math.ceil((2 * R) / cell);
    // grade deslocada 0,25: as laterais das colunas nunca caem num inteiro (junta das faixas do
    // terreno a cada 16 studs, bordas de campos e estradas)
    const gx0 = Math.round(cx - (n * cell) / 2) + 0.25;
    const gz0 = Math.round(cz - (n * cell) / 2) + 0.25;
    const grid = [];
    for (let j = 0; j < n; j++) {
      grid.push([]);
      for (let i = 0; i < n; i++) {
        const h = Math.round(heightAt(gx0 + (i + 0.5) * cell, gz0 + (j + 0.5) * cell) / stepH) * stepH;
        grid[j].push(h >= stepH ? h : 0);
      }
    }
    const band = (h) => (snowy && h > H * 0.72 ? 'neve' : rocky || h > H * 0.42 ? 'rocha' : 'grama');
    const rockA = dry ? C.rockDesert : C.rock;
    const rockB = dry ? C.rock : C.rockDark;
    const look = (h) => {
      const bd = band(h);
      const strata = Math.floor(h / 6) % 2 ? rockB : rockA;
      if (bd === 'neve') return { body: strata, top: C.snow, cap: 'Neve' };
      if (bd === 'rocha') return { body: strata, top: strata, cap: 'Topo' };
      return { body: dry ? C.rockDesert : C.soil, top: dry ? C.desertSand : C.grass, cap: 'Topo' };
    };
    let peakY = DIM.land;
    const spots = [];
    for (let j = 0; j < n; j++) {
      const z0 = gz0 + j * cell;
      let i = 0;
      while (i < n) {
        const h = grid[j][i];
        let k = i;
        while (k + 1 < n && grid[j][k + 1] === h && band(grid[j][k + 1]) === band(h)) k++;
        if (h > 0) {
          const x0 = gx0 + i * cell;
          const x1 = gx0 + (k + 1) * cell;
          const top = DIM.land + h;
          const L = look(h);
          b.span(model, 'Rocha', [x0, DIM.land - 0.1, z0], [x1, top - 0.8, z0 + cell], L.body);
          b.span(model, L.cap, [x0, top - 0.8, z0], [x1, top, z0 + cell], L.top);
          peakY = Math.max(peakY, top);
          // pinheiros nas encostas de grama (no meio de uma coluna)
          if (band(h) === 'grama' && !dry && h >= 3) {
            for (let c = i; c <= k; c++) {
              if (rand() < 0.22) spots.push([gx0 + (c + 0.5) * cell, top, z0 + cell / 2]);
            }
          }
        }
        i = k + 1;
      }
    }
    return { spots, peak: peakY };
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
  function buildMap() {
    const b = classicBuilder();
    const rand = mulberry32(seed);
    const { land, beach, cap, bottom } = DIM;
    const landmarks = { bridges: [], farms: [], mines: [], docks: [], villages: [], towers: [], camps: [], groves: {} };

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
        const style = (ii) => {
          if (GRID[j][ii] !== T.GRASS) return String(GRID[j][ii]);
          const dry = biomeAt(cellCenter(ii), cellCenter(j)) === 'deserto';
          return `g${dry ? 'd' : 'v'}${coastal(ii, j) ? 'c' : 'i'}`;
        };
        const st = style(i);
        let k = i;
        while (k + 1 < N && GRID[j][k + 1] === t && style(k + 1) === st) k++;
        const x0 = -DIM.half + i * DIM.cell;
        const x1 = -DIM.half + (k + 1) * DIM.cell;
        if (t === T.GRASS || t === T.SAND) {
          const top = t === T.GRASS ? land : beach;
          const cliff = st.endsWith('c');
          const bodyName = t === T.GRASS ? (cliff ? 'Falésia' : 'Terra') : 'Barranco';
          b.span('Terreno', bodyName, [x0, bottom, z0], [x1, top - cap, z1], cliff ? C.cliff : C.dirt);
          const dry = st.startsWith('gd');
          const capName = t === T.GRASS ? (dry ? 'Areia do Deserto' : 'Grama') : 'Areia';
          const capColor = t === T.GRASS ? (dry ? C.desertSand : C.grass) : C.sand;
          b.span('Terreno', capName, [x0, top - cap, z0], [x1, top, z1], capColor);
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

    // --- Lobby: plataforma elevada no centro, como nas referências ------------
    const PR = 'Lobby';
    const ph = DIM.plazaHalf;
    const pt = PLAZA.top;
    b.span(PR, 'Base do Lobby', [-ph, land - 0.1, -ph], [ph, pt - 0.5, ph], C.plazaDark);
    b.span(PR, 'Piso do Lobby', [-ph, pt - 0.5, -ph], [ph, pt, ph], C.plaza);
    // mureta na borda (a plataforma tem 6 studs de queda), aberta nas 4 escadarias
    const wall = (x0, z0, x1, z1) => b.span(`${PR}/Mureta`, 'Mureta', [x0, pt, z0], [x1, pt + 1.5, z1], C.statue);
    for (const s of [-1, 1]) {
      wall(-ph, s * (ph - 1), -5, s * ph);
      wall(5, s * (ph - 1), ph, s * ph);
      wall(s * (ph - 1), -(ph - 1), s * ph, -5);
      wall(s * (ph - 1), 5, s * ph, ph - 1);
    }
    // escadarias de madeira nas 4 saídas: 6 degraus de 1 stud, com postes e corrimão inclinado
    const rise = (pt - land) / DIM.lobbyRise;
    const run = DIM.lobbyRun;
    const len = DIM.lobbyRise * run;
    const slope = Math.round(((Math.atan(rise / run) * 180) / Math.PI) * 100) / 100;
    const railY = (t) => pt + 3 - (t / run) * rise; // altura do corrimão a t studs da borda
    for (const [sx, sz, side] of [
      [1, 0, 'Leste'],
      [-1, 0, 'Oeste'],
      [0, 1, 'Sul'],
      [0, -1, 'Norte'],
    ]) {
      const M = `${PR}/Escadaria ${side}`;
      // t: distância para fora a partir da borda da plataforma; w: lateral
      const at = (t, w) => (sx ? [sx * (ph + t), w] : [w, sz * (ph + t)]);
      const put = (t0, t1, w0, w1, y0, y1, nm, col) => {
        const [ax, az] = at(t0, w0);
        const [cx, cz] = at(t1, w1);
        b.span(M, nm, [ax, y0, az], [cx, y1, cz], col);
      };
      for (let k = 1; k <= DIM.lobbyRise; k++) {
        const t0 = (DIM.lobbyRise - k) * run;
        put(t0, t0 + run, -5, 5, land - 0.12, land + k * rise, 'Degrau do Lobby', C.wood);
      }
      for (const w of [-5.6, 5.6]) {
        for (const t of [0.6, len / 2, len - 0.6])
          put(t - 0.3, t + 0.3, w - 0.3, w + 0.3, land - 0.1, railY(t), 'Poste', C.woodDark);
        const [mx, mz] = at(len / 2, w);
        const L = Math.hypot(len - 1.2, railY(0.6) - railY(len - 0.6)) + 0.6;
        b.box(M, 'Corrimão', [mx, railY(len / 2), mz], sx ? [L, 0.4, 0.4] : [0.4, 0.4, L], C.wood, {
          ...deco,
          rotation: sx ? [0, 0, -sx * slope] : [sz * slope, 0, 0],
        });
      }
    }
    b.box(PR, 'Mosaico', [0, pt + 0.05, 0], [30, 0.1, 30], C.plazaDark);
    b.box(PR, 'Mosaico', [0, pt + 0.05, 0], [30, 0.1, 30], C.plazaDark, { ...deco, rotation: [0, 45, 0] });
    // fonte com a estátua do boneco clássico (R6) erguendo o logo do Roblox, sobre o mosaico
    fountainStatue(b, `${PR}/Fonte`, 0, pt + 0.1, 0);
    // Lobby como praça de cidade: uma loja de verdade em cada canto (girando em volta da fonte,
    // cada uma de frente para um caminho), arcos de pedra no alto das escadarias, lampiões nas
    // bordas dos caminhos, bancos virados para eles, vasos com árvore, caixotes ao lado das lojas,
    // colunas antigas e o spawn sobre um mosaico próprio. Sorteio separado (lrand) para não
    // mudar o resto do mapa.
    const lrand = mulberry32(seed ^ 0x10bb);
    // estandartes nos cantos da praça
    for (const [x, z] of [
      [41.5, 41.5],
      [-41.5, 41.5],
      [41.5, -41.5],
      [-41.5, -41.5],
    ]) {
      b.box(PR, 'Mastro', [x, pt + 7, z], [0.6, 14, 0.6], C.woodDark);
      b.span(PR, 'Estandarte', [x + 0.3, pt + 7.5, z - 1.6], [x + 0.5, pt + 13, z + 1.6], C.banner, deco);
    }
    // quadrante (sx, sz): loja no canto, porta virada para o caminho seguinte (catavento)
    const LOJAS = [
      [1, 1, 'padaria', 'w'],
      [-1, 1, 'taverna', 'n'],
      [-1, -1, 'ferreiro', 'e'],
      [1, -1, 'armazem', 's'],
    ];
    LOJAS.forEach(([sx, sz, kind, face], n) => {
      shop(b, `${PR}/Loja ${n + 1}`, kind, sx * 30, pt, sz * 30, face, lrand);
      // caixotes encostados na lateral da loja (um em cima, meio torto)
      const C1 = `${PR}/Caixotes ${n + 1}`;
      const alongX = face === 'w' || face === 'e';
      const [cx, cz] = alongX ? [sx * 24, sz * 16.5] : [sx * 16.5, sz * 24];
      const a = alongX ? [cx - 2.4, cz - 1.2] : [cx - 1.2, cz - 2.4];
      const c = alongX ? [cx + 2.4, cz + 1.2] : [cx + 1.2, cz + 2.4];
      b.span(C1, 'Caixote', [a[0], pt, a[1]], alongX ? [cx, pt + 2.4, c[1]] : [c[0], pt + 2.4, cz], C.crate);
      b.span(C1, 'Caixote', alongX ? [cx, pt, a[1]] : [a[0], pt, cz], [c[0], pt + 2.4, c[1]], C.crate);
      b.box(C1, 'Caixote', [cx, pt + 3.4, cz], [2, 2, 2], C.wood, { rotation: [0, 20, 0] });
    });
    // canteiros: vasos com árvore nas diagonais, entre a fonte e as lojas
    [
      [16, 16],
      [-16, 16],
      [-16, -16],
      [16, -16],
    ].forEach(([x, z], n) => planter(b, `${PR}/Canteiro ${n + 1}`, x, pt, z, lrand));
    // bancos de praça virados para os caminhos
    let nb = 0;
    for (const s of [-1, 1]) {
      for (const k of [-1, 1]) {
        bench(b, `${PR}/Banco ${++nb}`, s * 8, pt, k * 30, s > 0 ? 'w' : 'e', lrand);
        bench(b, `${PR}/Banco ${++nb}`, k * 30, pt, s * 8, s > 0 ? 'n' : 's', lrand);
      }
    }
    // lampiões nas duas bordas de cada caminho
    let nl = 0;
    for (const s of [-1, 1]) {
      for (const t of [17, 35]) {
        for (const k of [-1, 1]) {
          lampPost(b, `${PR}/Lampião ${++nl}`, s * 5.5, pt, k * t);
          lampPost(b, `${PR}/Lampião ${++nl}`, k * t, pt, s * 5.5);
        }
      }
    }
    // arcos de pedra no alto das 4 escadarias
    archGate(b, `${PR}/Arco Leste`, 40, pt, 0, 'x', 10);
    archGate(b, `${PR}/Arco Oeste`, -40, pt, 0, 'x', 10);
    archGate(b, `${PR}/Arco Sul`, 0, pt, 40, 'z', 10);
    archGate(b, `${PR}/Arco Norte`, 0, pt, -40, 'z', 10);
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
        // o pedaço que caiu está no chão, ao lado (sem colisão), para fora do caminho
        const [px, pz] = Math.abs(x) > Math.abs(z) ? [x - Math.sign(x) * 4.5, z] : [x, z - Math.sign(z) * 4.5];
        b.box(M, 'Pedaço da Coluna', [px, pt + 1, pz], [2.6, 3.4, 2.6], C.statue, { ...deco, rotation: [0, 30, 80] });
      }
    });
    // spawn sobre um mosaico em estrela (como o da fonte), no caminho sul
    b.box(`${PR}/Spawn`, 'Mosaico do Spawn', [0, pt + 0.05, 24], [12, 0.1, 12], C.plazaDark);
    b.box(`${PR}/Spawn`, 'Mosaico do Spawn', [0, pt + 0.05, 24], [12, 0.1, 12], C.plazaDark, {
      ...deco,
      rotation: [0, 45, 0],
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
      // a fundação passa 0,05 do meio-fio: a borda nunca cai em coordenada inteira, onde ficam as
      // bordas das estradas (evita z-fighting quando uma estrada corre colada no lote)
      const fh = half + 0.05;
      b.span(L, 'Fundação', [p.x - fh, land - 0.1, p.z - fh], [p.x + fh, land + 0.6, p.z + fh], C.plotStone, {
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

    // --- Relevo: montanhas altas (algumas com neve) e colinas, em terraços irregulares ---
    const blocked = []; // retângulos já ocupados (montanhas, vilas, campos, jazidas, cais)
    const free = (r, gap) => blocked.every((o) => rectsApart(r, o, gap));
    const awayFromPlots = (x, z, d) => PLOTS.every((p) => Math.hypot(p.x - x, p.z - z) >= half + d);
    const awayFromRoads = (r, gap) => ROAD_RECTS.every((o) => rectsApart(r, o, gap));
    const clearOfPlots = (r, gap) => PLOTS.every((p) => rectsApart(r, plotRect(p), gap));
    // --- Vilas: poço no meio, casas viradas para ele, celeiro, feno e moinho -----
    // trilhas de terra (4 studs) ligando cada lugar ao ponto mais próximo da malha de estradas
    const trailLegs = [];
    const trailRects = [];
    const plotAvoid = PLOTS.map((p) => plotRect(p, 3));
    landmarks.trails = 0;
    const addTrail = (x, z, own) => {
      const ctx = { half: 2, bridges: false, avoid: [...plotAvoid, ...blocked, own], own, gap: 8 };
      const r = connect([x, z], [...KINGDOM.legs, ...trailLegs], [], ctx);
      if (!r) return false;
      landmarks.trails++;
      for (const [a, c] of r.legs) drawLeg(a, c);
      return true;
    };
    function drawLeg(a, c) {
      {
        trailLegs.push([a, c]);
        const q = {
          // meia-largura 2,05: a borda da trilha nunca cai no mesmo plano da borda de um campo
          // ou construção (coordenadas inteiras ou meias), o que daria z-fighting lateral
          x0: Math.min(a[0], c[0]) - 2.05,
          x1: Math.max(a[0], c[0]) + 2.05,
          z0: Math.min(a[1], c[1]) - 2.05,
          z1: Math.max(a[1], c[1]) + 2.05,
        };
        trailRects.push(q);
        b.span('Trilhas', 'Trilha', [q.x0, land - 0.03, q.z0], [q.x1, land + 0.2, q.z1], C.path);
      }
    }
    const canPlace = (kind, x, z, face, onTrail = false) => {
      const fp = footprint(kind, face);
      const r = { x0: x - fp.w / 2, x1: x + fp.w / 2, z0: z - fp.d / 2, z1: z + fp.d / 2 };
      const ok =
        allGrass(r.x0 - 2, r.x1 + 2, r.z0 - 2, r.z1 + 2, 2) &&
        awayFromRoads(r, 4) &&
        clearOfPlots(r, 10) &&
        Math.max(Math.abs(x), Math.abs(z)) > LOBBY_GUARD + 30 &&
        (onTrail || trailRects.every((t) => rectsApart(r, t, 1))) &&
        free(r, 3);
      return ok ? r : null;
    };
    const placeBuilding = (model, kind, x, z, face, onTrail = false) => {
      const r = canPlace(kind, x, z, face, onTrail);
      if (!r) return null;
      // 0,25 fora da grade: nenhuma parede ou lona cai na junta das faixas do terreno (múltiplos de 8)
      building(b, model, kind, x + 0.25, land, z + 0.25, face, rand);
      blocked.push(r);
      return r;
    };
    // Vila como cidade de verdade: rua de pedra atravessando a vila, praça com o poço no meio,
    // casas dos dois lados viradas para a rua (cada uma com calçada até a porta), quintal
    // cercado com jardim atrás, e celeiro, feno e moinho na saída da vila. Uma ponta da rua
    // liga na malha de estradas por trilha.
    const VL = 50; // meia-extensão da rua
    for (let attempt = 0; attempt < 12000 && landmarks.villages.length < 4; attempt++) {
      const x = Math.round((rand() * 2 - 1) * 430);
      const z = Math.round((rand() * 2 - 1) * 430);
      const alongX = rand() < 0.5;
      // (t, w) = (ao longo da rua, atravessado); world() converte para (x, z)
      const world = (t, w) => (alongX ? [x + t, z + w] : [x + w, z + t]);
      const rectTW = (t0, t1, w0, w1) => {
        const [ax, az] = world(t0, w0);
        const [cx, cz] = world(t1, w1);
        return { x0: Math.min(ax, cx), x1: Math.max(ax, cx), z0: Math.min(az, cz), z1: Math.max(az, cz) };
      };
      const area = rectTW(-VL - 30, VL + 30, -36, 80);
      const ok =
        Math.hypot(x, z) > 170 &&
        allGrass(area.x0, area.x1, area.z0, area.z1, 4) &&
        clearOfPlots(area, 12) &&
        awayFromRoads(area, 0) &&
        distToRoads(x, z) < 160 &&
        free(area, 8) &&
        landmarks.villages.every(([vx, vz]) => Math.hypot(vx - x, vz - z) > 220);
      if (!ok) continue;
      // a ponta da rua mais perto da estrada recebe a trilha; o resto da vila vem depois
      const ends = [world(VL, 0), world(-VL, 0)].sort((p, q) => distToRoads(...p) - distToRoads(...q));
      if (!canPlace('poco', x, z, 's', true) || !ends.some(([ex, ez]) => addTrail(ex, ez, area))) continue;
      const V = `Vila/Vila ${landmarks.villages.length + 1}`;
      const street = rectTW(-VL, VL, -3, 3);
      b.span(
        `${V}/Rua`,
        'Rua da Vila',
        [street.x0, land - 0.04, street.z0],
        [street.x1, land + 0.24, street.z1],
        C.plazaDark,
      );
      const square = rectTW(-9, 9, -9, 9);
      b.span(
        `${V}/Praça`,
        'Praça da Vila',
        [square.x0, land - 0.05, square.z0],
        [square.x1, land + 0.27, square.z1],
        C.plaza,
      );
      trailLegs.push([world(-VL, 0), world(VL, 0)]); // outras trilhas podem ligar na rua
      trailRects.push(street, square);
      placeBuilding(`${V}/Poço`, 'poco', x, z, 's', true);
      let count = 1;
      // casas dos dois lados da rua, porta virada para ela
      const doorFace = (s) => (alongX ? (s > 0 ? 'n' : 's') : s > 0 ? 'w' : 'e');
      let n = 0;
      for (const t of [-38, -16, 16, 38]) {
        for (const s of [-1, 1]) {
          n++;
          const kind = 'casa';
          const fp = footprint(kind, doorFace(s));
          const depth = alongX ? fp.d : fp.w; // medida atravessada à rua
          const width = alongX ? fp.w : fp.d;
          const w = s * (5 + depth / 2);
          const [hx, hz] = world(t, w);
          if (!placeBuilding(`${V}/Casa ${n}`, kind, hx, hz, doorFace(s))) continue;
          count++;
          // calçada da porta até a rua
          const walk = rectTW(t - 1, t + 1, s > 0 ? 3 : -5, s > 0 ? 5 : -3);
          b.span(`${V}/Casa ${n}`, 'Calçada', [walk.x0, land - 0.02, walk.z0], [walk.x1, land + 0.22, walk.z1], C.path);
          // quintal cercado atrás da casa, com jardim
          const back = s * (5 + depth);
          const fence = s * (5 + depth + 5);
          const half = width / 2;
          const Q = `${V}/Quintal ${n}`;
          for (const tt of [t - half, t, t + half]) {
            const post = rectTW(tt - 0.2, tt + 0.2, fence - 0.2, fence + 0.2);
            b.span(Q, 'Estaca da Cerca', [post.x0, land - 0.1, post.z0], [post.x1, land + 2, post.z1], C.wood, deco);
          }
          const rail = rectTW(t - half, t + half, fence - 0.1, fence + 0.1);
          b.span(Q, 'Cerca', [rail.x0, land + 1.2, rail.z0], [rail.x1, land + 1.5, rail.z1], C.wood, deco);
          for (const tt of [t - half + 0.1, t + half - 0.1]) {
            const side = rectTW(tt - 0.1, tt + 0.1, Math.min(back, fence), Math.max(back, fence));
            b.span(Q, 'Cerca', [side.x0, land + 1.2, side.z0], [side.x1, land + 1.5, side.z1], C.wood, deco);
          }
          const yard = rectTW(t - half, t + half, Math.min(back, fence), Math.max(back, fence));
          const [gx, gz] = world(t - half / 2, (back + fence) / 2);
          flowerPatch(b, `${Q}/Jardim`, gx, land, gz, rand);
          if (rand() < 0.6) {
            const [tx, tz] = world(t + half / 2, (back + fence) / 2);
            plantTree(b, 'Vegetação/Árvores do Quintal', rand() < 0.5 ? 'cerejeira' : 'carvalho', tx, land, tz, rand);
          }
          blocked.push(yard);
        }
      }
      // rua lateral saindo da praça até um largo, com casas em volta (como os pátios de uma vila real)
      const side = rectTW(-3, 3, 9, 52);
      b.span(`${V}/Rua`, 'Rua da Vila', [side.x0, land - 0.04, side.z0], [side.x1, land + 0.24, side.z1], C.plazaDark);
      const court = rectTW(-8, 8, 46, 62);
      b.span(
        `${V}/Largo`,
        'Largo da Vila',
        [court.x0, land - 0.05, court.z0],
        [court.x1, land + 0.27, court.z1],
        C.plaza,
      );
      trailLegs.push([world(0, 9), world(0, 54)]);
      trailRects.push(side, court);
      const towardT = (dir) => (alongX ? (dir > 0 ? 'e' : 'w') : dir > 0 ? 's' : 'n');
      const towardMinusW = alongX ? 'n' : 'w';
      for (const [t, w, face] of [
        [-16, 54, towardT(1)],
        [16, 54, towardT(-1)],
        [0, 70, towardMinusW],
      ]) {
        n++;
        const [hx, hz] = world(t, w);
        if (placeBuilding(`${V}/Casa ${n}`, 'casa', hx, hz, face)) count++;
      }
      // saída da vila: celeiro, feno e moinho fora do eixo da rua (a trilha passa livre)
      for (const [t, w, kind, name] of [
        [VL + 16, 18, 'celeiro', 'Celeiro'],
        [VL + 14, -16, 'feno', 'Feno'],
        [-VL - 14, 18, 'moinho', 'Moinho'],
        [-VL - 12, -16, 'feno', 'Feno 2'],
      ]) {
        const [bx, bz] = world(t, w);
        const face = alongX ? (w > 0 ? 'n' : 's') : w > 0 ? 'w' : 'e';
        if (placeBuilding(`${V}/${name}`, kind, bx, bz, face)) count++;
      }
      landmarks.villages.push([x, z, count]);
    }

    // --- Regiões de fazenda: grade de campos cercados (trigo, repolho, abóbora, milho) com
    // corredores de terra entre eles, espantalho, e sede (casa, celeiro, feno) na beira ---
    landmarks.farmDistricts = [];
    const CROPS = [
      ['Trigo', C.wheat, 1.4],
      ['Repolho', C.leafLight, 0.9],
      ['Abóbora', C.autumn, 1],
      ['Milho', C.leafLight, 2.8],
    ];
    const field = (F, r, crop) => {
      const [name, color, h] = crop;
      // 0,15 para dentro: a borda da terra arada nunca cai num inteiro (junta das faixas do terreno)
      b.span(
        F,
        'Terra Arada',
        [r.x0 + 0.15, land - 0.08, r.z0 + 0.15],
        [r.x1 - 0.15, land + 0.22, r.z1 - 0.15],
        C.soil,
      );
      for (let k = 0; k < 5; k++) {
        const zz = r.z0 + 2.4 + k * 4.3;
        b.span(F, name, [r.x0 + 1, land + 0.22, zz], [r.x1 - 1, land + 0.22 + h, zz + 1.4], color, deco);
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
    };
    for (let attempt = 0; attempt < 8000 && landmarks.farmDistricts.length < 3; attempt++) {
      const cx = Math.round((rand() * 2 - 1) * 420);
      const cz = Math.round((rand() * 2 - 1) * 420);
      const area = { x0: cx - 58, x1: cx + 58, z0: cz - 28, z1: cz + 54 };
      const ok =
        Math.hypot(cx, cz) > 190 &&
        biomeAt(cx, cz) === 'campo' &&
        allGrass(area.x0, area.x1, area.z0, area.z1, 4) &&
        clearOfPlots(area, 12) &&
        awayFromRoads(area, 0) &&
        trailRects.every((t) => rectsApart(area, t, 2)) &&
        distToRoads(cx, cz) < 200 &&
        free(area, 8) &&
        landmarks.villages.every(([vx, vz]) => Math.hypot(vx - cx, vz - cz) > 160);
      if (!ok) continue;
      // o corredor principal (z = cz) liga numa ponta na malha de estradas
      const ends = [
        [cx + 54, cz],
        [cx - 54, cz],
      ].sort((p, q) => distToRoads(...p) - distToRoads(...q));
      if (!ends.some(([ex, ez]) => addTrail(ex, ez, area))) continue;
      const Fz = `Fazendas/Fazenda ${landmarks.farmDistricts.length + 1}`;
      drawLeg([cx - 54, cz], [cx + 54, cz]); // corredor entre as duas fileiras de campos
      drawLeg([cx - 18, cz - 25], [cx - 18, cz + 30]); // corredores entre as colunas
      drawLeg([cx + 18, cz - 25], [cx + 18, cz + 25]);
      drawLeg([cx - 48, cz + 30], [cx + 48, cz + 30]); // frente da sede
      let n = 0;
      for (const fx of [-36, 0, 36]) {
        for (const fz of [-14, 14]) {
          const r = { x0: cx + fx - 15, x1: cx + fx + 15, z0: cz + fz - 11, z1: cz + fz + 11 };
          const crop = CROPS[Math.floor(rand() * CROPS.length)];
          field(`${Fz}/Campo ${++n}`, r, crop);
          blocked.push(r);
        }
      }
      // espantalho no campo do meio
      const E = `${Fz}/Espantalho`;
      const ex = cx + 4;
      const ez = cz + 14;
      b.span(
        E,
        'Poste do Espantalho',
        [ex - 0.2, land + 0.22, ez - 0.2],
        [ex + 0.2, land + 6, ez + 0.2],
        C.woodDark,
        deco,
      );
      b.span(
        E,
        'Braços do Espantalho',
        [ex - 2, land + 4.2, ez - 0.15],
        [ex + 2, land + 4.5, ez + 0.15],
        C.woodDark,
        deco,
      );
      b.span(
        E,
        'Roupa do Espantalho',
        [ex - 0.8, land + 2.8, ez - 0.4],
        [ex + 0.8, land + 4.2, ez + 0.4],
        C.banner,
        deco,
      );
      b.span(E, 'Cabeça do Espantalho', [ex - 0.5, land + 6, ez - 0.5], [ex + 0.5, land + 7, ez + 0.5], C.hay, deco);
      b.span(
        E,
        'Chapéu do Espantalho',
        [ex - 0.9, land + 7, ez - 0.9],
        [ex + 0.9, land + 7.3, ez + 0.9],
        C.roofThatch,
        deco,
      );
      // sede da fazenda, de frente para os campos
      let count = 0;
      for (const [dx, dz, kind, name] of [
        [-32, 41, 'casa', 'Casa da Fazenda'],
        [2, 43, 'celeiro', 'Celeiro'],
        [34, 39, 'feno', 'Feno'],
      ]) {
        if (placeBuilding(`${Fz}/${name}`, kind, cx + dx, cz + dz, 'n', true)) count++;
      }
      landmarks.farmDistricts.push([cx, cz, n, count]);
      landmarks.farms.push([cx, cz]);
    }

    const mountainSpots = [];
    landmarks.mountains = [];
    landmarks.hills = [];
    landmarks.outcrops = [];
    const relief = [
      { list: landmarks.mountains, want: 9, R: [36, 58], H: [40, 78], name: 'Montanha' },
      { list: landmarks.hills, want: 16, R: [18, 30], H: [12, 22], name: 'Colina' },
      { list: landmarks.outcrops, want: 14, R: [8, 13], H: [5, 9], name: 'Afloramento' },
    ];
    for (const kind of relief) {
      for (let attempt = 0; attempt < 9000 && kind.list.length < kind.want; attempt++) {
        const x = Math.round((rand() * 2 - 1) * 500);
        const z = Math.round((rand() * 2 - 1) * 500);
        // mapa apertado (ilha comprida, baías fundas): depois de muitas tentativas o relevo
        // aceita ser um pouco menor, em vez de faltar montanha
        const shrink = attempt < 4000 ? 1 : attempt < 6500 ? 0.85 : 0.72;
        const R = Math.round((kind.R[0] + rand() * (kind.R[1] - kind.R[0])) * shrink);
        const H = Math.round(kind.H[0] + rand() * (kind.H[1] - kind.H[0]));
        const r = { x0: x - R, x1: x + R, z0: z - R, z1: z + R };
        const ok =
          Math.hypot(x, z) > 150 + R &&
          allGrass(r.x0 - 4, r.x1 + 4, r.z0 - 4, r.z1 + 4) &&
          clearOfPlots(r, 20) &&
          awayFromRoads(r, 10) &&
          trailRects.every((t) => rectsApart(r, t, 6)) &&
          free(r, 14);
        if (!ok) continue;
        const M = `Relevo/${kind.name} ${String(kind.list.length + 1).padStart(2, '0')}`;
        const dry = biomeAt(x, z) === 'deserto';
        const m = mountain(
          b,
          M,
          x,
          z,
          R,
          H,
          rand,
          !dry && kind.name === 'Montanha' && H >= 55,
          kind.name === 'Afloramento',
          dry,
        );
        blocked.push(r);
        mountainSpots.push(...m.spots);
        kind.list.push([x, z, m.peak, R]);
      }
    }

    // --- Recursos: campos de trigo (perto das vilas), jazidas de ouro e pedreiras ---
    for (let attempt = 0; attempt < 6000 && landmarks.farms.length < 8; attempt++) {
      const v = landmarks.villages[attempt % Math.max(1, landmarks.villages.length)];
      const near = v && attempt < 3000;
      const x = Math.round(near ? v[0] + (rand() * 2 - 1) * 90 : (rand() * 2 - 1) * 440);
      const z = Math.round(near ? v[1] + (rand() * 2 - 1) * 90 : (rand() * 2 - 1) * 440);
      const r = { x0: x - 15, x1: x + 15, z0: z - 11, z1: z + 11 };
      const ok =
        Math.hypot(x, z) > PLAZA_REACH + 36 &&
        allGrass(r.x0 - 4, r.x1 + 4, r.z0 - 4, r.z1 + 4) &&
        awayFromPlots(x, z, 30) &&
        awayFromRoads(r, 4) &&
        free(r, 8);
      if (!ok) continue;
      if (!addTrail(x, z, r)) continue; // campo sem caminho até a estrada não faz sentido
      blocked.push(r);
      const F = `Recursos/Campo de Trigo ${landmarks.farms.length + 1}`;
      landmarks.farms.push([x, z]);
      b.span(
        F,
        'Terra Arada',
        [r.x0 + 0.15, land - 0.08, r.z0 + 0.15],
        [r.x1 - 0.15, land + 0.22, r.z1 - 0.15],
        C.soil,
      );
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
      if (!addTrail(x, z, r)) continue;
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

    // --- Torres de vigia perto das estradas e acampamentos nas clareiras ---------
    for (let attempt = 0; attempt < 4000 && landmarks.towers.length < 5; attempt++) {
      const x = Math.round((rand() * 2 - 1) * 500);
      const z = Math.round((rand() * 2 - 1) * 500);
      const d = distToRoads(x, z);
      if (d < 14 || d > 24 || Math.hypot(x, z) < 160) continue;
      if (landmarks.towers.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 200)) continue;
      const r = canPlace('torre', x, z, 's');
      if (!r || !addTrail(x, z, r)) continue;
      placeBuilding(`Torres de Vigia/Torre ${landmarks.towers.length + 1}`, 'torre', x, z, 's', true);
      landmarks.towers.push([x, z]);
    }
    for (let attempt = 0; attempt < 4000 && landmarks.camps.length < 3; attempt++) {
      const x = Math.round((rand() * 2 - 1) * 480);
      const z = Math.round((rand() * 2 - 1) * 480);
      if (nz(x, z, 120, 7) < 0.55 || Math.hypot(x, z) < 160 || distToRoads(x, z) < 20) continue;
      const r = canPlace('tenda', x, z, 's');
      if (!r || !addTrail(x, z, r)) continue;
      placeBuilding(`Acampamentos/Acampamento ${landmarks.camps.length + 1}`, 'tenda', x, z, 's', true);
      landmarks.camps.push([x, z]);
    }

    // --- Trilhas de terra: cada lugar (vila, campo, jazida, torre, acampamento) liga na estrada ---
    const distToTrails = (x, z) => trailRects.reduce((d, r) => Math.min(d, distToRect(x, z, r)), Infinity);

    // --- Vegetação: biomas de árvores, coqueiros na praia, pinheiros nas montanhas ---
    const KIND_MODEL = {
      carvalho: 'Carvalhos',
      pinheiro: 'Pinheiros',
      betula: 'Bétulas',
      cerejeira: 'Cerejeiras',
      redonda: 'Árvores Redondas',
      seca: 'Árvores Secas',
      coqueiro: 'Coqueiros',
      outono: 'Bosque de Outono',
    };
    const plant = (kind, x, y, z) => plantTree(b, `Vegetação/${KIND_MODEL[kind]}`, kind, x, y, z, rand);
    const forestKind = (x, z) => {
      const n = nz(x, z, 90, 9);
      if (n > 0.62) return 'outono';
      if (n < 0.32) return 'pinheiro';
      if (n < 0.42) return 'betula';
      if (n < 0.47) return 'redonda';
      return 'carvalho';
    };
    const meadowKind = () => {
      const t = rand();
      return t < 0.35 ? 'carvalho' : t < 0.6 ? 'redonda' : t < 0.78 ? 'cerejeira' : t < 0.9 ? 'betula' : 'seca';
    };
    const groundFree = (x, z, r) =>
      allGrass(x - r, x + r, z - r, z + r, 3) &&
      Math.hypot(x, z) > PLAZA_REACH + 12 &&
      awayFromPlots(x, z, 10) &&
      distToRoads(x, z) > 7 &&
      distToTrails(x, z) > 5 &&
      free({ x0: x, x1: x, z0: z, z1: z }, 4);
    // primeiro os candidatos (grade com sorteio); se passar do limite, pega um a cada k
    const spots = [];
    const step = 15;
    for (let gx = -540; gx <= 540; gx += step) {
      for (let gz = -540; gz <= 540; gz += step) {
        const x = Math.round((gx + (rand() - 0.5) * step * 0.8) * 10) / 10;
        const z = Math.round((gz + (rand() - 0.5) * step * 0.8) * 10) / 10;
        // floresta densa nas manchas de ruído e num anel em volta de cada vila; campo aberto
        // também tem árvores (bosquetes), para não sobrar grama vazia
        const ring = landmarks.villages.some(([vx, vz]) => {
          const d = Math.hypot(x - vx, z - vz);
          return d > 95 && d < 165;
        });
        const biome = biomeAt(x, z);
        const forest = nz(x, z, 120, 7) > 0.6 || ring || biome === 'floresta';
        const grove = nz(x, z, 45, 11) > 0.62;
        let want;
        let kind;
        if (biome === 'deserto') {
          // região seca: coqueiros e árvores secas espaçados, alguns oásis mais verdes
          want = grove ? rand() < 0.45 : rand() < 0.07;
          const t = rand();
          kind = t < 0.5 ? 'coqueiro' : t < 0.8 ? 'seca' : 'redonda';
        } else if (biome === 'floresta') {
          // floresta escura: pinheiros fechados
          want = rand() < 0.92;
          kind = rand() < 0.8 ? 'pinheiro' : 'redonda';
        } else {
          want = forest ? rand() < 0.85 : grove ? rand() < 0.5 : rand() < 0.12;
          kind = forest ? forestKind(x, z) : meadowKind();
        }
        if (!want || !groundFree(x, z, 3)) continue;
        spots.push([x, z, kind]);
      }
    }
    const MAX_TREES = 1300;
    const chosen =
      spots.length > MAX_TREES ? spots.filter((_, k) => (k * MAX_TREES) % spots.length < MAX_TREES) : spots;
    for (const [x, z, kind] of chosen) {
      plant(kind, x, land, z);
      blocked.push({ x0: x - 1.5, x1: x + 1.5, z0: z - 1.5, z1: z + 1.5 });
    }
    landmarks.groves.green = densest(
      chosen.filter((s) => s[2] === 'carvalho' || s[2] === 'pinheiro'),
      45,
    );
    landmarks.groves.autumn = densest(
      chosen.filter((s) => s[2] === 'outono'),
      45,
    );
    // pinheiros nos terraços de grama das montanhas e colinas
    for (const [x, y, z] of mountainSpots) plant('pinheiro', x, y, z);
    // coqueiros na praia
    let palms = 0;
    for (let attempt = 0; attempt < 6000 && palms < 45; attempt++) {
      const x = Math.round((rand() * 2 - 1) * 580 * 10) / 10;
      const z = Math.round((rand() * 2 - 1) * 580 * 10) / 10;
      let sand = true;
      for (const [dx, dz] of [
        [0, 0],
        [-3, -3],
        [3, 3],
        [-3, 3],
        [3, -3],
      ])
        if (terrainAt(x + dx, z + dz) !== T.SAND) sand = false;
      if (!sand || !free({ x0: x, x1: x, z0: z, z1: z }, 6)) continue;
      blocked.push({ x0: x - 3, x1: x + 3, z0: z - 3, z1: z + 3 });
      plant('coqueiro', x, beach, z);
      palms++;
    }
    landmarks.palms = palms;
    // arbustos e canteiros de flores silvestres pelos campos
    let bushes = 0;
    let flowers = 0;
    for (let attempt = 0; attempt < 24000 && (bushes < 420 || flowers < 180); attempt++) {
      const x = Math.round((rand() * 2 - 1) * 540 * 10) / 10;
      const z = Math.round((rand() * 2 - 1) * 540 * 10) / 10;
      if (!groundFree(x, z, 3)) continue;
      blocked.push({ x0: x - 2, x1: x + 2, z0: z - 2, z1: z + 2 });
      if (bushes < 420 && (flowers >= 180 || rand() < 0.65)) {
        bush(b, 'Vegetação/Arbustos', x, land, z, rand);
        bushes++;
      } else {
        flowerPatch(b, 'Vegetação/Flores', x, land, z, rand);
        flowers++;
      }
    }
    // pedras soltas pelo campo
    let rockN = 0;
    for (let attempt = 0; attempt < 8000 && rockN < 110; attempt++) {
      const x = (rand() * 2 - 1) * 540;
      const z = (rand() * 2 - 1) * 540;
      if (!groundFree(x, z, 6) || distToRoads(x, z) <= 10) continue;
      rockN++;
      const rockColor = biomeAt(x, z) === 'deserto' ? C.rockDesert : C.rock;
      rocks(b, 'Relevo/Pedras', x, land, z, rand, 2 + Math.floor(rand() * 3), 1, rockColor);
    }

    // mato e pedrinhas pelo chão (1 a 2 peças cada, sem colisão): o campo nunca fica liso
    let tufts = 0;
    let pebbles = 0;
    for (let attempt = 0; attempt < 60000 && (tufts < 1800 || pebbles < 400); attempt++) {
      const x = Math.round((rand() * 2 - 1) * 560 * 10) / 10;
      const z = Math.round((rand() * 2 - 1) * 560 * 10) / 10;
      if (terrainAt(x, z) !== T.GRASS || !allGrass(x - 1.5, x + 1.5, z - 1.5, z + 1.5, 1.5)) continue;
      if (Math.hypot(x, z) < PLAZA_REACH + 8 || !awayFromPlots(x, z, 3)) continue;
      if (distToRoads(x, z) < 5 || distToTrails(x, z) < 3 || !free({ x0: x, x1: x, z0: z, z1: z }, 1.5)) continue;
      const rot = Math.round(rand() * 90);
      if (tufts < 1800 && (pebbles >= 400 || rand() < 0.8)) {
        const h = 1 + rand() * 1.4;
        const dryHere = biomeAt(x, z) === 'deserto';
        const col = dryHere ? C.hay : rand() < 0.5 ? C.grassDark : C.leafDark;
        b.box('Vegetação/Mato', 'Mato', [x, land - 0.05 + h / 2, z], [0.5, h, 1.6], col, {
          ...deco,
          rotation: [0, rot, 0],
        });
        b.box('Vegetação/Mato', 'Mato', [x, land - 0.05 + h * 0.4, z], [1.6, h * 0.8, 0.5], dryHere ? C.hay : C.bush, {
          ...deco,
          rotation: [0, rot + 30, 0],
        });
        tufts++;
      } else {
        const sz = 0.8 + rand() * 1.2;
        b.box(
          'Relevo/Pedrinhas',
          'Pedrinha',
          [x, land + sz * 0.25, z],
          [sz, sz * 0.7, sz * 0.9],
          biomeAt(x, z) === 'deserto' ? C.rockDesert : rand() < 0.5 ? C.rock : C.stoneOre,
          {
            ...deco,
            rotation: [Math.round((rand() - 0.5) * 20), rot, Math.round((rand() - 0.5) * 20)],
          },
        );
        pebbles++;
      }
    }
    landmarks.groundCover = tufts + pebbles;

    // juncos na beira do lago e do rio (touceiras altas, sem colisão): a água ganha margem viva
    const nearWater = (x, z) =>
      [
        [6, 0],
        [-6, 0],
        [0, 6],
        [0, -6],
      ].some(([dx, dz]) => [T.RIVER, T.LAKE].includes(terrainAt(x + dx, z + dz)));
    let reeds = 0;
    for (let attempt = 0; attempt < 40000 && reeds < 160; attempt++) {
      const x = Math.round((rand() * 2 - 1) * 580 * 10) / 10;
      const z = Math.round((rand() * 2 - 1) * 580 * 10) / 10;
      if (terrainAt(x, z) !== T.GRASS || !nearWater(x, z)) continue;
      if (distToRoads(x, z) < 9 || !awayFromPlots(x, z, 6) || !free({ x0: x, x1: x, z0: z, z1: z }, 1.5)) continue;
      blocked.push({ x0: x - 1, x1: x + 1, z0: z - 1, z1: z + 1 });
      for (let k = 0; k < 3; k++) {
        const h = 3 + rand() * 2.5;
        const ox = (rand() - 0.5) * 1.6;
        const oz = (rand() - 0.5) * 1.6;
        const tilt = [Math.round((rand() - 0.5) * 16), Math.round(rand() * 90), Math.round((rand() - 0.5) * 16)];
        const col = k === 2 ? C.hay : rand() < 0.5 ? C.leafLight : C.palmLeaf;
        b.box('Vegetação/Juncos', 'Junco', [x + ox, land - 0.05 + h / 2, z + oz], [0.3, h, 0.3], col, {
          ...deco,
          rotation: tilt,
        });
      }
      reeds++;
    }
    landmarks.reeds = reeds;

    // samambaias no chão das florestas (3 folhas inclinadas, sem colisão)
    let ferns = 0;
    for (let attempt = 0; attempt < 40000 && ferns < 320; attempt++) {
      const x = Math.round((rand() * 2 - 1) * 560 * 10) / 10;
      const z = Math.round((rand() * 2 - 1) * 560 * 10) / 10;
      const shady = biomeAt(x, z) === 'floresta' || nz(x, z, 70, 9) < 0.42;
      if (!shady || biomeAt(x, z) === 'deserto') continue;
      if (terrainAt(x, z) !== T.GRASS || Math.hypot(x, z) < PLAZA_REACH + 10) continue;
      if (distToRoads(x, z) < 6 || distToTrails(x, z) < 3 || !awayFromPlots(x, z, 4)) continue;
      if (!free({ x0: x, x1: x, z0: z, z1: z }, 1.2)) continue;
      blocked.push({ x0: x - 1, x1: x + 1, z0: z - 1, z1: z + 1 });
      const yaw = Math.round(rand() * 120);
      const col = rand() < 0.5 ? C.leafDark : C.pine;
      for (let k = 0; k < 3; k++) {
        const a = ((yaw + k * 120) * Math.PI) / 180;
        b.box(
          'Vegetação/Samambaias',
          'Samambaia',
          [x + Math.cos(a) * 0.9, land + 0.55, z - Math.sin(a) * 0.9],
          [2.4, 0.2, 0.7],
          col,
          { ...deco, rotation: [0, yaw + k * 120, 24] },
        );
      }
      ferns++;
    }
    landmarks.ferns = ferns;

    return { parts: b.parts, landmarks };
  }

  const MAP_INFO = Object.freeze({
    plots: PLOTS.length,
    roads: ROAD_PIECES.filter((p) => p.kind === 'road').length,
    bridges: ROAD_PIECES.filter((p) => p.kind === 'bridge').length,
  });
  return {
    seed,
    DIM,
    T,
    LAKE,
    RIVER,
    PLAZA,
    PLOTS,
    ROAD_LEGS,
    ENVELOPE,
    MAP_INFO,
    plotsConnected: Object.freeze([...KINGDOM.connected]),
    terrainAt,
    allGrass,
    distToRiver,
    clearanceZones,
    connect,
    buildMap,
  };
}

function lakeAndRiver(seed) {
  if (seed === SEED) {
    const LAKE = Object.freeze({ x: -170, z: 150, r: 52 });
    const RIVER = Object.freeze([
      [-170, 150],
      [-215, 215],
      [-280, 275],
      [-350, 300],
      [-430, 350],
      [-520, 400],
      [-640, 460],
    ]);
    return { LAKE, RIVER };
  }
  const rand = mulberry32(seed ^ 0x1a4e);
  const ang = rand() * Math.PI * 2;
  const dist = 180 + rand() * 90;
  const LAKE = Object.freeze({
    x: Math.round(Math.cos(ang) * dist),
    z: Math.round(Math.sin(ang) * dist),
    r: Math.round(40 + rand() * 16),
  });
  const river = [[LAKE.x, LAKE.z]];
  let a = ang;
  let [x, z] = [LAKE.x, LAKE.z];
  while (Math.hypot(x, z) < 660) {
    a = ang + (rand() - 0.5) * 1.0; // até ±29° da direção para fora: o rio nunca volta para o Lobby
    x = Math.round(x + Math.cos(a) * 85);
    z = Math.round(z + Math.sin(a) * 85);
    river.push([x, z]);
  }
  return { LAKE, RIVER: Object.freeze(river) };
}

const WORLD = createWorld(SEED);

/** O mundo padrão (semente SEED): é o que vai para o lugar principal e para as capturas. */
export const { LAKE, RIVER, PLAZA, PLOTS, ROAD_LEGS, ENVELOPE, MAP_INFO } = WORLD;
export const { terrainAt, allGrass, distToRiver, clearanceZones, connect } = WORLD;

/** Monta as Parts do mundo da semente dada (padrão: SEED). */
export function buildMap(seed = SEED) {
  return seed === SEED ? WORLD.buildMap() : createWorld(seed).buildMap();
}
