// Invariantes do mapa para o fuzz de sementes (tools/fuzz.mjs) e para tests/invariants.test.mjs.
// Funções puras, sem I/O: recebem um mundo de createWorld(seed) e devolvem problemas legíveis.
//
// Cada problema é uma linha "tipo: detalhe". O tipo vem antes do primeiro ": " e serve para
// agrupar as falhas no resumo do CI (tools/ci/fuzz-summary.mjs).
//
// Duas camadas:
//   * layoutProblems(w): barata (sem Parts). Lotes, áreas, estradas, vale, Lobby e relevo.
//   * fullProblems(w, built): cara (com as Parts de w.buildMap()). Apoio, z-fighting, passagens,
//     limites, spawn, manual de montagem, orçamento e marcos do mapa.

import { findFloating, findZFighting, findClearanceViolations, findOutside } from './checks.js';
import { buildManual } from './manual.js';

/** Máximo de linhas guardadas por verificação (o resto vira "… +N problemas"). */
export const MAX_PER_CHECK = 20;

/** Limite de Parts por mapa no fuzz. */
export const FUZZ_PART_BUDGET = 32000; // igual a DIM.maxParts (o mundo informa o seu)

/** Marcos que todo mapa precisa ter (lista não vazia ou contagem maior que zero). */
const REQUIRED_LANDMARKS = ['plots', 'pads', 'ponds', 'roads', 'terraces'];

/** Marcos desejáveis: se faltarem, só geram aviso (mapa apertado pode não ter espaço). */
const OPTIONAL_LANDMARKS = [];

const LANDMARK_NAMES = {
  plots: 'lotes',
  pads: 'áreas de construção',
  ponds: 'lagoas',
  roads: 'estradas',
  terraces: 'terraços',
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

/** Células da planta de um lote/área que não são chão plano com a superfície esperada. */
function padIssue(w, p, kinds) {
  const { DIM, T } = w;
  const cells = w.footprint ? w.footprint(p) : [];
  if (cells.length < 12) return `planta com só ${cells.length} células`;
  for (const [x, z] of cells) {
    if (w.terrainAt(x, z) !== T.GROUND || w.heightAt(x, z) !== DIM.land) return `${pt(x, z)} fora do chão plano`;
    if (!kinds.includes(w.surfaceAt(x, z))) return `${pt(x, z)} com superfície ${w.surfaceAt(x, z)}`;
  }
  return null;
}

function plotChecks(w, out) {
  const { DIM, PLAZA, PLOTS, PADS } = w;

  const count = [];
  if (PLOTS.length !== DIM.plots) count.push(`${PLOTS.length} lotes, esperado ${DIM.plots}`);
  if (PADS.length !== DIM.pads) count.push(`${PADS.length} áreas de construção, esperado ${DIM.pads}`);
  collect(out, 'lotes (quantidade)', count);
  const seen = new Map();
  for (const p of PLOTS) seen.set(p.name, (seen.get(p.name) ?? 0) + 1);
  const dup = [];
  for (const [name, n] of seen) if (n > 1) dup.push(`"${name}" aparece ${n} vezes`);
  collect(out, 'lotes (nomes repetidos)', dup);

  const close = [];
  for (let i = 0; i < PLOTS.length; i++) {
    for (let j = i + 1; j < PLOTS.length; j++) {
      const [a, b] = [PLOTS[i], PLOTS[j]];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < DIM.minPlotSpacing)
        close.push(`${a.name} e ${b.name} a ${d.toFixed(1)} studs (mín. ${DIM.minPlotSpacing})`);
    }
  }
  collect(out, 'lotes (perto demais)', close);

  const flat = [];
  for (const p of PLOTS) {
    const bad = padIssue(w, p, ['lote']);
    if (bad) flat.push(`${p.name} em ${pt(p.x, p.z)}: ${bad}`);
  }
  for (const p of PADS) {
    const bad = padIssue(w, p, ['area']);
    if (bad) flat.push(`${p.name} em ${pt(p.x, p.z)}: ${bad}`);
  }
  collect(out, 'lotes (piso torto ou fora do chão)', flat);

  const lost = [];
  const conn = w.plotsConnected ?? [];
  PLOTS.forEach((p, k) => {
    if (conn[k] !== true) lost.push(`${p.name} em ${pt(p.x, p.z)} sem estrada até o Lobby`);
  });
  (w.padsConnected ?? []).forEach((ok, k) => {
    if (ok !== true) lost.push(`${PADS[k].name} sem estrada até o Lobby`);
  });
  collect(out, 'lotes (sem estrada)', lost);

  const side = (v) => (v >= 0 ? 1 : -1); // um lote exatamente no eixo conta no lado positivo
  const quads = new Set(PLOTS.map((p) => `${side(p.x - PLAZA.x)},${side(p.z - PLAZA.z)}`));
  const filled = ['1,1', '1,-1', '-1,1', '-1,-1'].filter((q) => quads.has(q));
  const spread = [];
  if (filled.length < 3) spread.push(`lotes em só ${filled.length} quadrante(s): ${filled.join(' ') || 'nenhum'}`);
  collect(out, 'lotes (quadrantes)', spread);
}

function roadChecks(w, out) {
  const { T } = w;
  const shape = [];
  const terrain = [];
  for (const l of w.ROAD_LEGS ?? []) {
    const [a, b] = l;
    if (a[0] !== b[0] && a[1] !== b[1]) shape.push(`${legName(l)} não é reto (diagonal)`);
    const bad = legSamples(l).find(([x, z]) => w.terrainAt(x, z) !== T.GROUND);
    if (bad) terrain.push(`${legName(l)} passa por terreno ${w.terrainAt(...bad)} em ${pt(bad[0], bad[1])}`);
  }
  collect(out, 'estradas (trecho torto)', shape);
  collect(out, 'estradas (fora do chão)', terrain);
}

function valleyChecks(w, out) {
  const { DIM, T, PLAZA } = w;
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
  collect(out, 'planalto (borda sem mar)', shore);

  const lobby = [];
  for (let dx = -PLAZA.reach; dx <= PLAZA.reach; dx += 4) {
    for (let dz = -PLAZA.reach; dz <= PLAZA.reach; dz += 4) {
      if (Math.hypot(dx, dz) > PLAZA.reach) continue;
      if (w.terrainAt(PLAZA.x + dx, PLAZA.z + dz) !== T.GROUND) lobby.push(`${pt(dx, dz)} não é chão`);
    }
  }
  collect(out, 'Lobby (fora do chão)', lobby);

  const found = new Set();
  for (let x = -DIM.half + DIM.cell / 2; x < DIM.half; x += DIM.cell) {
    for (let z = -DIM.half + DIM.cell / 2; z < DIM.half; z += DIM.cell) found.add(w.terrainAt(x, z));
  }
  const relief = [];
  if (!found.has(T.CLIFF)) relief.push('nenhuma célula de penhasco');
  if (!found.has(T.WATER) && !(w.PONDS ?? []).length) relief.push('nenhuma lagoa');
  collect(out, 'relevo (penhasco ou lagoa faltando)', relief);
}

/** Problemas de layout de um mundo (lotes, áreas, estradas, vale, Lobby e relevo). Lista vazia = tudo certo. */
export function layoutProblems(w) {
  const out = [];
  plotChecks(w, out);
  roadChecks(w, out);
  valleyChecks(w, out);
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
  const max = w.DIM.maxParts ?? FUZZ_PART_BUDGET;
  if (parts.length > max) budget.push(`${parts.length} Parts (máx. ${max})`);
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
