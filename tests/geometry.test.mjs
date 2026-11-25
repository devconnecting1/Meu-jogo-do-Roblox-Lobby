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

test('áreas de construção, lotes e spawn livres de colisão', () => {
  const p = findClearanceViolations(parts, clearanceZones());
  assert.equal(p.length, 0, report(p));
});

test('tudo dentro dos limites do mapa', () => {
  const p = findOutside(parts, ENVELOPE);
  assert.equal(p.length, 0, report(p));
});

test('planalto cercado de mar: a borda da grade é mar e o terreno não passa de ±half', () => {
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
  for (const p of parts.filter((x) => x.name !== 'Mar')) {
    for (const i of [0, 2]) {
      assert.ok(Math.abs(p.position[i]) + p.size[i] / 2 <= DIM.half, `${p.name} @ ${p.position} passa da grade`);
    }
  }
});

test('alturas do terreno: chão no topo certo, água abaixo do chão e sem colisão', () => {
  const top = (p) => p.position[1] + p.size[1] / 2;
  const names = new Set(parts.map((p) => p.name));
  for (const n of ['Chão', 'Grama', 'Grama Escura', 'Terra da Estrada', 'Pedra da Praça', 'Lote', 'Rocha', 'Musgo']) {
    assert.ok(names.has(n), `falta "${n}" no terreno`);
  }
  for (const p of parts.filter((x) => ['Terra da Estrada', 'Terra Batida', 'Lote', 'Borda do Lote'].includes(x.name))) {
    assert.equal(top(p), DIM.land, `${p.name} @ ${p.position} fora do nível do chão`);
  }
  for (const p of parts.filter((x) => x.name.startsWith('Água'))) {
    assert.ok(top(p) < DIM.land, 'água abaixo do chão');
    assert.equal(p.canCollide, false, 'água não colide (o jogador entra nela)');
  }
});
