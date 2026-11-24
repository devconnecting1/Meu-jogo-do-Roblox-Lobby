// Regras físicas do mapa: tudo apoiado, sem z-fighting, passagens livres e tudo dentro dos limites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMap, clearanceZones, ENVELOPE, DIM, T, terrainAt } from '../src/map.js';
import { findFloating, findZFighting, findClearanceViolations, findOutside } from '../src/checks.js';

const { parts } = buildMap();
const report = (problems, max = 40) =>
  problems.length
    ? `\n${problems.slice(0, max).join('\n')}${problems.length > max ? `\n… +${problems.length - max}` : ''}`
    : '';

test('nada flutua: toda Part está apoiada (cadeia de contato até o Mar)', () => {
  const p = findFloating(parts, 'Mar');
  assert.equal(p.length, 0, report(p));
});

test('sem z-fighting entre faces visíveis', () => {
  const p = findZFighting(parts);
  assert.equal(p.length, 0, report(p));
});

test('passagens livres de colisão (área dos castelos, estradas, pontes e spawn)', () => {
  const p = findClearanceViolations(parts, clearanceZones());
  assert.equal(p.length, 0, report(p));
});

test('tudo dentro dos limites do mapa', () => {
  const p = findOutside(parts, ENVELOPE);
  assert.equal(p.length, 0, report(p));
});

test('ilha cercada de mar: a borda da grade é mar e o terreno não passa de ±half', () => {
  for (let t = -DIM.half + 1; t < DIM.half; t += DIM.cell) {
    for (const [x, z] of [
      [t, -DIM.half + 1],
      [t, DIM.half - 1],
      [-DIM.half + 1, t],
      [DIM.half - 1, t],
    ]) {
      assert.equal(terrainAt(x, z), T.SEA, `borda (${x}, ${z}) não é mar`);
    }
  }
  for (const p of parts.filter((x) => x.model === 'Terreno')) {
    for (const i of [0, 2]) {
      assert.ok(Math.abs(p.position[i]) + p.size[i] / 2 <= DIM.half, `${p.name} @ ${p.position} passa da ilha`);
    }
  }
});

test('praia, rio e lago existem e o terreno tem as alturas certas', () => {
  const names = new Set(parts.filter((p) => p.model === 'Terreno').map((p) => p.name));
  for (const n of ['Terra', 'Grama', 'Barranco', 'Areia', 'Água do Rio', 'Água do Lago']) {
    assert.ok(names.has(n), `falta "${n}" no terreno`);
  }
  const top = (p) => p.position[1] + p.size[1] / 2;
  for (const p of parts.filter((x) => x.name === 'Grama')) assert.equal(top(p), DIM.land);
  for (const p of parts.filter((x) => x.name === 'Areia')) assert.equal(top(p), DIM.beach);
  for (const p of parts.filter((x) => x.name.startsWith('Água'))) {
    assert.equal(top(p), DIM.water);
    assert.equal(p.canCollide, false, 'água não colide (o jogador entra nela)');
  }
});
