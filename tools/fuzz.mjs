#!/usr/bin/env node
// Fuzz de mapas: gera muitas sementes e confere as invariantes de cada uma.
// Roda no GitHub Actions (.github/workflows/fuzz.yml), dividido em fatias. Veja docs/FUZZ.md.
//
// Uso: node tools/fuzz.mjs --from <n> --count <n> --full-every <k> --out <pasta>
//   --from        primeira semente (inteiro >= 1)
//   --count       quantas sementes seguidas testar
//   --full-every  monta as Parts (camada cara) nas sementes com seed % k === 0 (0 = nunca)
//   --out         pasta onde grava fuzz-<from>.json
//
// Sai com código 1 se alguma semente falhar.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createWorld } from '../src/map.js';
import { layoutProblems, fullProblems, problemType } from '../src/invariants.js';

/** Linhas de problema guardadas por semente no JSON (o resto só entra na contagem por tipo). */
const KEEP_LINES = 12;
/** Falhas com detalhe completo no JSON; as seguintes guardam só os tipos (memória limitada). */
const KEEP_DETAILED = 1000;
/** Falhas mostradas no log (o resto fica no JSON e no resumo). */
const LOG_FAILURES = 50;

const { values } = parseArgs({
  options: {
    from: { type: 'string', default: '1' },
    count: { type: 'string', default: '1000' },
    'full-every': { type: 'string', default: '0' },
    out: { type: 'string', default: 'out/fuzz' },
  },
});

const int = (name, min) => {
  const v = Number(values[name]);
  if (!Number.isInteger(v) || v < min) {
    console.error(`--${name} precisa ser um inteiro >= ${min} (recebido: ${values[name]})`);
    process.exit(2);
  }
  return v;
};
const from = int('from', 1);
const count = int('count', 1);
const fullEvery = int('full-every', 0);
const outDir = resolve(values.out);

const failures = [];
const warnings = {};
const timings = { layoutMs: 0, fullMs: 0, buildMs: 0, slowestLayout: null, slowestFull: null };
let checked = 0;
let full = 0;

function errorLine(e) {
  const lines = String(e?.stack ?? e).split('\n');
  return `exceção: ${lines.slice(0, 4).join(' | ')}`;
}

function fail(seed, layer, problems) {
  const types = [...new Set(problems.map(problemType))];
  const detailed = failures.length < KEEP_DETAILED;
  const kept = detailed ? problems.slice(0, KEEP_LINES) : [];
  failures.push({ seed, layer, total: problems.length, types, problems: kept });
  if (failures.length <= LOG_FAILURES) {
    console.log(`✖ semente ${seed} (${layer}): ${problems.length} problema(s)`);
    for (const l of problems.slice(0, 5)) console.log(`    ${l}`);
  } else if (failures.length === LOG_FAILURES + 1) {
    console.log(`… mais falhas omitidas do log (veja o JSON e o resumo)`);
  }
}

function warn(seed, line) {
  const w = (warnings[problemType(line)] ??= { count: 0, seeds: [], example: line });
  w.count++;
  if (w.seeds.length < 20) w.seeds.push(seed);
}

const slowest = (key, seed, ms) => {
  if (!timings[key] || ms > timings[key].ms) timings[key] = { seed, ms: Math.round(ms) };
};

const start = performance.now();
console.log(`Fuzz: sementes ${from} a ${from + count - 1} · Parts a cada ${fullEvery || '—'} sementes`);

for (let seed = from; seed < from + count; seed++) {
  // camada barata: mundo + invariantes de layout
  let w = null;
  const t0 = performance.now();
  try {
    w = createWorld(seed);
    const problems = layoutProblems(w);
    if (problems.length) fail(seed, 'layout', problems);
  } catch (e) {
    fail(seed, 'layout', [errorLine(e)]);
  }
  const layoutMs = performance.now() - t0;
  timings.layoutMs += layoutMs;
  slowest('slowestLayout', seed, layoutMs);
  checked++;

  // camada cara: Parts completas numa amostra de sementes
  if (w && fullEvery > 0 && seed % fullEvery === 0) {
    const t1 = performance.now();
    try {
      const built = w.buildMap();
      timings.buildMs += performance.now() - t1;
      const found = [];
      const problems = fullProblems(w, built, found);
      for (const l of found) warn(seed, l);
      if (problems.length) fail(seed, 'completa', problems);
    } catch (e) {
      fail(seed, 'completa', [errorLine(e)]);
    }
    const fullMs = performance.now() - t1;
    timings.fullMs += fullMs;
    slowest('slowestFull', seed, fullMs);
    full++;
    console.log(`  semente ${seed}: construção completa em ${(fullMs / 1000).toFixed(1)} s`);
  }
  // nada de guardar mundos: `w` e as Parts saem de escopo a cada volta (memória estável)

  if (checked % 1000 === 0 || checked === count) {
    const s = (performance.now() - start) / 1000;
    const rate = (checked / s).toFixed(1);
    const fails = `${failures.length} falha(s)`;
    console.log(`${checked}/${count} sementes · ${fails} · ${s.toFixed(1)} s · ${rate} sementes/s`);
  }
}

timings.layoutMs = Math.round(timings.layoutMs);
timings.fullMs = Math.round(timings.fullMs);
timings.buildMs = Math.round(timings.buildMs);
timings.totalMs = Math.round(performance.now() - start);

mkdirSync(outDir, { recursive: true });
const file = join(outDir, `fuzz-${from}.json`);
const result = { from, count, fullEvery, checked, full, failures, warnings, timings };
writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
console.log(`Resultado em ${file}`);

if (failures.length) {
  const seeds = failures.slice(0, 30).map((f) => f.seed);
  const more = failures.length > 30 ? '…' : '';
  console.error(`::error::${failures.length} semente(s) com falha: ${seeds.join(', ')}${more}`);
  process.exit(1);
}
console.log(`✔ ${checked} sementes sem falha (${full} com construção completa)`);
