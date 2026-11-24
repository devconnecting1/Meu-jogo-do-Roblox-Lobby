// Invariantes do mapa para o fuzz de sementes (tools/fuzz.mjs) e para tests/invariants.test.mjs.
// Funções puras, sem I/O: recebem um mundo de createWorld(seed) e devolvem problemas legíveis.
//
// Cada problema é uma linha "tipo: detalhe". O tipo vem antes do primeiro ": " e serve para
// agrupar as falhas no resumo do CI (tools/ci/fuzz-summary.mjs).
//
// Duas camadas:
//   * layoutProblems(w): barata (sem Parts). Lotes, estradas, ilha, Lobby e água.
//   * fullProblems(w, built): cara (com as Parts de w.buildMap()). Apoio, z-fighting, passagens,
//     limites, spawn, manual de montagem, orçamento e marcos do mapa.

import { findFloating, findZFighting, findClearanceViolations, findOutside } from './checks.js';
import { buildManual } from './manual.js';

/** Máximo de linhas guardadas por verificação (o resto vira "… +N problemas"). */
export const MAX_PER_CHECK = 20;

/** Limite de Parts por mapa no fuzz. */
export const FUZZ_PART_BUDGET = 10000;

/** Marcos que todo mapa precisa ter (lista não vazia ou contagem maior que zero). */
const REQUIRED_LANDMARKS = ['villages', 'farms', 'mines', 'docks', 'mountains', 'hills', 'trails'];

/** Marcos desejáveis: se faltarem, só geram aviso (mapa apertado pode não ter espaço). */
const OPTIONAL_LANDMARKS = ['towers', 'camps'];

const LANDMARK_NAMES = {
  villages: 'vilas',
  farms: 'campos de trigo',
  mines: 'jazidas',
  docks: 'cais',
  mountains: 'montanhas',
  hills: 'colinas',
  trails: 'trilhas',
  towers: 'torres de vigia',
  camps: 'acampamentos',
};

const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const pt = (x, z) => `(${fmt(x)}, ${fmt(z)})`;
const legName = ([a, b]) => `trecho ${pt(a[0], a[1])} → ${pt(b[0], b[1])}`;

/** Tipo de um problema (texto antes do primeiro ": "). */
export function problemType(line) {
  const i = line.indexOf(': ');
  return i < 0 ? line : line.slice(0, i);
}

/** Junta as linhas de uma verificação com o tipo na frente, cortando em MAX_PER_CHECK. */
function collect(out, type, lines) {
  for (const l of lines.slice(0, MAX_PER_CHECK)) out.push(`${type}: ${l}`);
  const extra = lines.length - MAX_PER_CHECK;
  if (extra > 0) out.push(`${type}: … +${extra} problemas`);
}

/** Pontos do eixo de um trecho reto, a cada `step` studs (mesma amostragem do gerador). */
function legSamples([a, b], step = 2) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(len / step));
  const out = [];
  for (let k = 0; k <= n; k++) {
    out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Camada barata: sem Parts
// ---------------------------------------------------------------------------

function plotChecks(w, out) {
  const { DIM, T, PLAZA, PLOTS, LAKE } = w;
  const h = DIM.plotSize / 2;

  // quantidade e nomes
  const count = [];
  if (PLOTS.length !== DIM.plots) count.push(`${PLOTS.length} lotes, esperado ${DIM.plots}`);
  collect(out, 'lotes (quantidade)', count);
  const seen = new Map();
  for (const p of PLOTS) seen.set(p.name, (seen.get(p.name) ?? 0) + 1);
  const dup = [];
  for (const [name, n] of seen) if (n > 1) dup.push(`"${name}" aparece ${n} vezes`);
  collect(out, 'lotes (nomes repetidos)', dup);

  // espaçamento entre lotes
  const close = [];
  for (let i = 0; i < PLOTS.length; i++) {
    for (let j = i + 1; j < PLOTS.length; j++) {
      const [a, b] = [PLOTS[i], PLOTS[j]];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d >= DIM.minPlotSpacing) continue;
      close.push(`${a.name} e ${b.name} a ${d.toFixed(1)} studs (mín. ${DIM.minPlotSpacing})`);
    }
  }
  collect(out, 'lotes (perto demais)', close);

  // fundação inteira sobre a grama, com 2 studs de folga em volta
  const wet = [];
  const m = h + 2;
  for (const p of PLOTS) {
    let bad = null;
    for (let x = p.x - m; x <= p.x + m && !bad; x += 2) {
      for (let z = p.z - m; z <= p.z + m && !bad; z += 2) {
        const t = w.terrainAt(x, z);
        if (t !== T.GRASS) bad = `${p.name} em ${pt(p.x, p.z)}: ${pt(x, z)} é terreno ${t}, não grama`;
      }
    }
    if (bad) wet.push(bad);
  }
  collect(out, 'lotes (fora da grama)', wet);

  // longe do Lobby, do lago e do rio
  const near = [];
  for (const p of PLOTS) {
    const dl = Math.hypot(p.x - PLAZA.x, p.z - PLAZA.z);
    const dk = Math.hypot(p.x - LAKE.x, p.z - LAKE.z);
    const dr = w.distToRiver(p.x, p.z);
    if (dl < 110) near.push(`${p.name} a ${dl.toFixed(1)} studs do Lobby (mín. 110)`);
    if (dk < 110) near.push(`${p.name} a ${dk.toFixed(1)} studs do lago (mín. 110)`);
    if (dr < 52) near.push(`${p.name} a ${dr.toFixed(1)} studs do rio (mín. 52)`);
  }
  collect(out, 'lotes (perto do Lobby ou da água)', near);

  // todos ligados ao Lobby por estrada
  const conn = w.plotsConnected ?? [];
  const lost = [];
  if (conn.length !== PLOTS.length) lost.push(`plotsConnected tem ${conn.length} itens para ${PLOTS.length} lotes`);
  PLOTS.forEach((p, k) => {
    if (conn[k] !== true) lost.push(`${p.name} em ${pt(p.x, p.z)} sem estrada até o Lobby`);
  });
  collect(out, 'lotes (sem estrada)', lost);

  // espalhados por pelo menos 3 dos 4 quadrantes
  const quads = new Set(PLOTS.map((p) => `${Math.sign(p.x - PLAZA.x)},${Math.sign(p.z - PLAZA.z)}`));
  const filled = ['1,1', '1,-1', '-1,1', '-1,-1'].filter((q) => quads.has(q));
  const spread = [];
  if (filled.length < 3) spread.push(`lotes em só ${filled.length} quadrante(s): ${filled.join(' ') || 'nenhum'}`);
  collect(out, 'lotes (quadrantes)', spread);
}

function roadChecks(w, out) {
  const { DIM, T, PLAZA, PLOTS } = w;
  const legs = w.ROAD_LEGS ?? [];
  const h = DIM.plotSize / 2;
  const inside = (p, x, z, pad) => Math.abs(x - p.x) < h + pad && Math.abs(z - p.z) < h + pad;
  const inLobby = ([x, z]) => Math.abs(x - PLAZA.x) < PLAZA.guard && Math.abs(z - PLAZA.z) < PLAZA.guard;

  const shape = [];
  const lobby = [];
  const terrain = [];
  const crossing = [];
  for (const l of legs) {
    const [a, b] = l;
    if (a[0] !== b[0] && a[1] !== b[1]) shape.push(`${legName(l)} não é reto (diagonal)`);
    else if (a[0] === b[0] && a[1] === b[1]) shape.push(`${legName(l)} tem comprimento zero`);

    const pts = legSamples(l);
    const hit = pts.find(inLobby);
    if (hit) lobby.push(`${legName(l)} entra no Lobby em ${pt(hit[0], hit[1])}`);

    const wet = pts.find(([x, z]) => ![T.GRASS, T.RIVER].includes(w.terrainAt(x, z)));
    if (wet) terrain.push(`${legName(l)} passa por terreno ${w.terrainAt(...wet)} em ${pt(wet[0], wet[1])}`);

    // o trecho que começa ou termina dentro de um lote é a estrada chegando ao centro dele
    for (const p of PLOTS) {
      if (l.some(([x, z]) => inside(p, x, z, 1e-6))) continue;
      const q = pts.find(([x, z]) => inside(p, x, z, 0));
      if (q) crossing.push(`${legName(l)} atravessa ${p.name} em ${pt(q[0], q[1])}`);
    }
  }
  collect(out, 'estradas (trecho torto ou vazio)', shape);
  collect(out, 'estradas (dentro do Lobby)', lobby);
  collect(out, 'estradas (fora da grama)', terrain);
  collect(out, 'estradas (atravessam lote)', crossing);
}

function islandChecks(w, out) {
  const { DIM, T, PLAZA } = w;

  // ilha cercada de mar: a borda da grade é mar
  const shore = [];
  for (let t = -DIM.half + 1; t < DIM.half; t += 16) {
    for (const [x, z] of [
      [t, -DIM.half + 1],
      [t, DIM.half - 1],
      [-DIM.half + 1, t],
      [DIM.half - 1, t],
    ]) {
      if (w.terrainAt(x, z) !== T.SEA) shore.push(`borda ${pt(x, z)} não é mar`);
    }
  }
  collect(out, 'ilha (borda sem mar)', shore);

  // o quadrado do Lobby é todo grama
  const lobby = [];
  for (let dx = -PLAZA.reach; dx <= PLAZA.reach; dx += 4) {
    for (let dz = -PLAZA.reach; dz <= PLAZA.reach; dz += 4) {
      const [x, z] = [PLAZA.x + dx, PLAZA.z + dz];
      const t = w.terrainAt(x, z);
      if (t !== T.GRASS) lobby.push(`${pt(x, z)} é terreno ${t}, não grama`);
    }
  }
  collect(out, 'Lobby (fora da grama)', lobby);

  // lago e rio existem (alguma célula de cada)
  const found = new Set();
  for (let x = -DIM.half + DIM.cell / 2; x < DIM.half; x += DIM.cell) {
    for (let z = -DIM.half + DIM.cell / 2; z < DIM.half; z += DIM.cell) found.add(w.terrainAt(x, z));
  }
  const water = [];
  if (!found.has(T.LAKE)) water.push('nenhuma célula de lago');
  if (!found.has(T.RIVER)) water.push('nenhuma célula de rio');
  collect(out, 'água (lago ou rio faltando)', water);
}

/** Problemas de layout de um mundo (lotes, estradas, ilha, Lobby e água). Lista vazia = tudo certo. */
export function layoutProblems(w) {
  const out = [];
  plotChecks(w, out);
  roadChecks(w, out);
  islandChecks(w, out);
  return out;
}

// ---------------------------------------------------------------------------
// Camada cara: com as Parts
// ---------------------------------------------------------------------------

const landmarkSize = (v) => (Array.isArray(v) ? v.length : typeof v === 'number' ? v : 0);

/**
 * Problemas da construção completa (`built = w.buildMap()`). Lista vazia = tudo certo.
 * Marcos opcionais faltando (torres de vigia, acampamentos) vão para `warnings`, quando passado.
 */
export function fullProblems(w, built, warnings = []) {
  const { parts } = built;
  const landmarks = built.landmarks ?? {};
  const out = [];

  collect(out, 'apoio', findFloating(parts, 'Mar'));
  collect(out, 'z-fighting', findZFighting(parts));
  collect(out, 'passagens', findClearanceViolations(parts, w.clearanceZones()));
  collect(out, 'limites', findOutside(parts, w.ENVELOPE));

  const spawns = parts.filter((p) => p.className === 'SpawnLocation').length;
  collect(out, 'spawn', spawns === 1 ? [] : [`${spawns} SpawnLocation, esperado 1`]);

  collect(out, 'manual de montagem', buildManual(parts).problems);

  const budget = [];
  if (parts.length > FUZZ_PART_BUDGET) budget.push(`${parts.length} Parts (máx. ${FUZZ_PART_BUDGET})`);
  collect(out, 'orçamento', budget);

  const missing = REQUIRED_LANDMARKS.filter((k) => landmarkSize(landmarks[k]) === 0);
  collect(
    out,
    'marcos',
    missing.map((k) => `nenhum(a) ${LANDMARK_NAMES[k]} (${k})`),
  );
  for (const k of OPTIONAL_LANDMARKS) {
    if (landmarkSize(landmarks[k]) === 0) warnings.push(`marcos opcionais: nenhum(a) ${LANDMARK_NAMES[k]} (${k})`);
  }

  return out;
}
