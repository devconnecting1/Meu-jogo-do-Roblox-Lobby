// Invariantes do mapa fixo do Vale (layout e construção completa), as mesmas de src/invariants.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, SEED } from '../src/map.js';
import { layoutProblems, fullProblems } from '../src/invariants.js';

/** O mapa é fixo: só a semente do Vale. */
const LAYOUT_SEEDS = [SEED];

const FULL_SEEDS = [SEED];

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
