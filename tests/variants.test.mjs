// Variantes por servidor: cada semente de src/variants.js passa pelas mesmas regras do mapa principal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, SEED } from '../src/map.js';
import { VARIANT_SEEDS } from '../src/variants.js';
import { findFloating, findZFighting, findClearanceViolations, findOutside } from '../src/checks.js';
import { buildManual } from '../src/manual.js';
import { stats } from '../src/builder.js';

const report = (p, max = 25) =>
  p.length ? `\n${p.slice(0, max).join('\n')}${p.length > max ? `\n… +${p.length - max}` : ''}` : '';

test('as variantes são diferentes do mapa principal e entre si', () => {
  assert.ok(!VARIANT_SEEDS.includes(SEED), 'a semente principal não é variante');
  assert.equal(new Set(VARIANT_SEEDS).size, VARIANT_SEEDS.length);
  const sig = (w) => w.PLOTS.map((p) => `${p.x},${p.z}`).join(';');
  const sigs = [SEED, ...VARIANT_SEEDS].map((s) => sig(createWorld(s)));
  assert.equal(new Set(sigs).size, sigs.length, 'duas sementes geraram os mesmos lotes');
});

for (const seed of VARIANT_SEEDS) {
  test(`variante ${seed}: 30 lotes ligados, nada flutua, sem z-fighting, passagens livres e montagem possível`, () => {
    const w = createWorld(seed);
    assert.equal(w.PLOTS.length, w.DIM.plots, `semente ${seed}: ${w.PLOTS.length} lotes`);
    assert.ok(w.plotsConnected.every(Boolean), `semente ${seed}: lote sem estrada até o Lobby`);
    const { parts } = w.buildMap();
    const problems = [
      ...findFloating(parts, 'Mar'),
      ...findZFighting(parts),
      ...findClearanceViolations(parts, w.clearanceZones()),
      ...findOutside(parts, w.ENVELOPE),
      ...buildManual(parts).problems,
    ];
    assert.equal(problems.length, 0, `semente ${seed}:${report(problems)}`);
    assert.equal(parts.filter((p) => p.className === 'SpawnLocation').length, 1, `semente ${seed}: spawn`);
    assert.ok(stats(parts).total <= w.DIM.maxParts, `semente ${seed}: ${stats(parts).total} Parts`);
  });
}
