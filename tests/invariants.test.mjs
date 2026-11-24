// Fuzz rápido de sementes (roda em todo PR, no job "test"): as regras de layout valem para
// qualquer semente, não só para a padrão. O fuzz grande (100 mil sementes) é o workflow
// separado .github/workflows/fuzz.yml (veja docs/FUZZ.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, SEED } from '../src/map.js';
import { layoutProblems, fullProblems } from '../src/invariants.js';

/** Sementes da camada barata: a padrão e 25 seguidas a partir da 1. */
const LAYOUT_SEEDS = [SEED, ...Array.from({ length: 25 }, (_, k) => k + 1)];

/** Sementes da camada cara (Parts): a padrão e mais duas. */
const FULL_SEEDS = [SEED, 7, 12345];

const report = (seed, layer, problems) =>
  `semente ${seed} (${layer}): ${problems.length} problema(s)\n${problems.join('\n')}`;

for (const seed of LAYOUT_SEEDS) {
  test(`semente ${seed}: layout válido (lotes, estradas, ilha, Lobby e água)`, () => {
    const w = createWorld(seed);
    assert.equal(w.seed, seed, `createWorld(${seed}) devolveu a semente ${w.seed}`);
    const problems = layoutProblems(w);
    assert.equal(problems.length, 0, report(seed, 'layout', problems));
  });
}

for (const seed of FULL_SEEDS) {
  test(`semente ${seed}: construção completa válida (apoio, z-fighting, passagens, manual)`, () => {
    const w = createWorld(seed);
    const built = w.buildMap();
    const problems = fullProblems(w, built);
    assert.equal(problems.length, 0, report(seed, 'completa', problems));
  });
}
