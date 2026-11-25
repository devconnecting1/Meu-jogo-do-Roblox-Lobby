#!/usr/bin/env node
// Junta os resultados das fatias do fuzz (fuzz-*.json de tools/fuzz.mjs) num resumo em markdown.
// Roda no GitHub Actions (.github/workflows/fuzz.yml, job "summary"). Veja docs/FUZZ.md.
//
// Uso: node tools/ci/fuzz-summary.mjs <pasta-com-os-json> [saida.md]
// Env opcionais: EXPECTED_TOTAL e FIRST_SEED (para apontar fatias que não entregaram resultado).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const dir = process.argv[2] ?? 'out/fuzz-results';
const outFile = process.argv[3] ?? 'fuzz-summary.md';
const EXAMPLES = 50;

const typeOf = (line) => {
  const i = line.indexOf(': ');
  return i < 0 ? line : line.slice(0, i);
};
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 300);
const num = (n) => n.toLocaleString('pt-BR');

// --- leitura -----------------------------------------------------------------
const files = [];
if (existsSync(dir)) {
  for (const f of readdirSync(dir, { recursive: true })) {
    if (/^fuzz-\d+\.json$/.test(basename(String(f)))) files.push(join(dir, String(f)));
  }
}
const shards = [];
const broken = [];
for (const f of files) {
  try {
    shards.push(JSON.parse(readFileSync(f, 'utf8')));
  } catch (e) {
    broken.push(`${f}: ${e.message}`);
  }
}
shards.sort((a, b) => a.from - b.from);

// --- totais ------------------------------------------------------------------
let checked = 0;
let full = 0;
let layoutMs = 0;
let fullMs = 0;
let totalMs = 0;
const failures = [];
const warnings = new Map();
for (const s of shards) {
  checked += s.checked ?? 0;
  full += s.full ?? 0;
  layoutMs += s.timings?.layoutMs ?? 0;
  fullMs += s.timings?.fullMs ?? 0;
  totalMs = Math.max(totalMs, s.timings?.totalMs ?? 0);
  failures.push(...(s.failures ?? []));
  for (const [type, w] of Object.entries(s.warnings ?? {})) {
    const acc = warnings.get(type) ?? { count: 0, seeds: [], example: w.example };
    acc.count += w.count;
    acc.seeds.push(...w.seeds);
    warnings.set(type, acc);
  }
}
failures.sort((a, b) => a.seed - b.seed);

// faixas que nenhuma fatia cobriu (fatia cancelada, com tempo esgotado ou sem artefato)
const expected = Number(process.env.EXPECTED_TOTAL || 0);
const first = Number(process.env.FIRST_SEED || 1);
const gaps = [];
if (expected > 0) {
  let next = first;
  for (const s of shards) {
    if (s.from > next) gaps.push([next, s.from - 1]);
    next = Math.max(next, s.from + (s.checked ?? 0));
  }
  if (next <= first + expected - 1) gaps.push([next, first + expected - 1]);
}
const missing = gaps.reduce((n, [a, b]) => n + b - a + 1, 0);

// --- falhas agrupadas por tipo -------------------------------------------------
const byType = new Map();
for (const f of failures) {
  const types = f.types?.length ? f.types : [...new Set((f.problems ?? []).map(typeOf))];
  for (const t of types) {
    if (!byType.has(t)) byType.set(t, []);
    const example = (f.problems ?? []).find((l) => typeOf(l) === t) ?? '(detalhe omitido)';
    byType.get(t).push({ seed: f.seed, layer: f.layer, example });
  }
}
const groups = [...byType].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

// --- markdown ------------------------------------------------------------------
const ok = failures.length === 0 && missing === 0 && broken.length === 0 && shards.length > 0;
const rate = layoutMs > 0 ? (checked / (layoutMs / 1000)).toFixed(1) : '—';
const wallRate = totalMs > 0 ? ((checked / totalMs) * 1000).toFixed(0) : '—';
const avgFull = full > 0 ? (fullMs / full / 1000).toFixed(1) : '—';
const lines = [
  `## ${ok ? '✅' : '❌'} Fuzz de mapas — ${num(checked)} sementes`,
  '',
  '| | |',
  '|---|---|',
  `| Sementes testadas (camada barata) | ${num(checked)}${expected ? ` de ${num(expected)}` : ''} |`,
  `| Construções completas (Parts) | ${num(full)} |`,
  `| Fatias com resultado | ${shards.length} |`,
  `| Sementes com falha | ${num(new Set(failures.map((f) => f.seed)).size)} |`,
  `| Vazão por job (camada barata) | ${rate} sementes/s |`,
  `| Vazão total (todas as fatias em paralelo) | ${wallRate} sementes/s |`,
  `| Tempo médio de uma construção completa | ${avgFull} s |`,
  `| Fatia mais lenta | ${(totalMs / 1000).toFixed(0)} s |`,
  '',
];

if (!shards.length) {
  lines.push('Nenhum resultado encontrado: as fatias não rodaram ou não publicaram o artefato.', '');
}
if (broken.length) lines.push('### Resultados ilegíveis', '', ...broken.map((b) => `- ${b}`), '');
if (gaps.length) {
  lines.push(`### Sementes sem resultado (${num(missing)})`, '');
  lines.push('Fatia cancelada, com tempo esgotado ou sem artefato. Rode de novo só essa faixa.', '');
  for (const [a, b] of gaps.slice(0, 50)) lines.push(`- ${num(a)} a ${num(b)}`);
  lines.push('');
}

if (groups.length) {
  lines.push('### Falhas por tipo', '');
  lines.push('| Tipo | Sementes | Primeiras sementes |', '|---|---|---|');
  for (const [t, list] of groups) {
    const seeds = list.slice(0, 10).map((x) => x.seed);
    lines.push(`| ${cell(t)} | ${list.length} | ${seeds.join(', ')}${list.length > 10 ? '…' : ''} |`);
  }
  lines.push('');
  for (const [t, list] of groups) {
    lines.push(`<details><summary><b>${cell(t)}</b>: ${list.length} semente(s)</summary>`, '');
    lines.push('| Semente | Camada | Exemplo |', '|---|---|---|');
    for (const x of list.slice(0, EXAMPLES)) lines.push(`| ${x.seed} | ${x.layer} | ${cell(x.example)} |`);
    if (list.length > EXAMPLES) lines.push(`| … | | +${list.length - EXAMPLES} sementes |`);
    lines.push('', '</details>', '');
  }
  lines.push(
    'Para reproduzir: Actions → **Fuzz de mapas** → Run workflow com `first` = semente, `total` = 1,',
    '`shards` = 1 e `full_every` = 1. Corrija o gerador (`src/map.js`), nunca pule a semente.',
    '',
  );
}

if (warnings.size) {
  lines.push('### Avisos (não derrubam o fuzz)', '');
  lines.push('| Aviso | Sementes | Exemplos |', '|---|---|---|');
  for (const [t, w] of [...warnings].sort((a, b) => b[1].count - a[1].count)) {
    lines.push(`| ${cell(t)} | ${w.count} | ${w.seeds.slice(0, 10).join(', ')} |`);
  }
  lines.push('');
}

const md = lines.join('\n');
writeFileSync(outFile, md + '\n');
console.log(md);
