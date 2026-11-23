// Regras físicas da construção: tudo apoiado, sem z-fighting, passagens livres,
// guarda-corpo contínuo, escada confortável e ambiente fechado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrison, clearanceZones, fallEdges, ENVELOPE, INTERIOR, LEVELS } from '../src/prison.js';
import { findFloating, findZFighting, findClearanceViolations, findEdgeGaps, findOutside } from '../src/checks.js';

const { parts } = buildPrison();
const report = (problems, max = 40) =>
  problems.length ? `\n${problems.slice(0, max).join('\n')}${problems.length > max ? `\n… +${problems.length - max}` : ''}` : '';

test('nada flutua: toda Part está apoiada/encaixada na estrutura', () => {
  const p = findFloating(parts);
  assert.equal(p.length, 0, report(p));
});

test('sem z-fighting entre faces visíveis', () => {
  const p = findZFighting(parts);
  assert.equal(p.length, 0, report(p));
});

test('passagens do jogador livres de colisão (corredores, portas, escada, ponte, spawn)', () => {
  const p = findClearanceViolations(parts, clearanceZones());
  assert.equal(p.length, 0, report(p));
});

test('bordas do 2º andar têm guarda-corpo contínuo (sem buracos para cair)', () => {
  const p = findEdgeGaps(parts, fallEdges());
  assert.equal(p.length, 0, report(p));
});

test('tudo fica dentro da envoltória; o interior não vaza para fora', () => {
  const outside = findOutside(parts, ENVELOPE);
  assert.equal(outside.length, 0, report(outside));
  const inner = findOutside(parts.filter((p) => p.model !== 'Envoltória'), INTERIOR);
  assert.equal(inner.length, 0, report(inner));
});

test('ambiente fechado: piso, teto e 4 paredes opacos cobrindo tudo', () => {
  const shell = parts.filter((p) => p.model === 'Envoltória');
  assert.equal(shell.length, 6, 'esperado: laje, teto e 4 paredes');
  for (const p of shell) {
    assert.equal(p.transparency, 0, `${p.name} precisa ser opaca`);
    assert.equal(p.canCollide, true, `${p.name} precisa colidir`);
  }
  const span = (p, i) => [p.position[i] - p.size[i] / 2, p.position[i] + p.size[i] / 2];
  const byName = Object.fromEntries(shell.map((p) => [p.name, p]));
  for (const n of ['Laje Térreo', 'Laje Teto']) {
    assert.deepEqual(span(byName[n], 0), [ENVELOPE.min[0], ENVELOPE.max[0]], `${n} cobre X`);
    assert.deepEqual(span(byName[n], 2), [ENVELOPE.min[2], ENVELOPE.max[2]], `${n} cobre Z`);
  }
  for (const n of ['Parede Sul', 'Parede Norte', 'Parede Leste', 'Parede Oeste']) {
    assert.deepEqual(span(byName[n], 1), [0, LEVELS.ROOF], `${n} vai do piso ao teto`);
  }
});

test('escada: degraus de até 1 stud, chegando exatamente ao 2º andar', () => {
  const steps = parts
    .filter((p) => /^Degrau \d+$/.test(p.name))
    .sort((a, b) => Number(a.name.split(' ')[1]) - Number(b.name.split(' ')[1]));
  assert.ok(steps.length > 0);
  let prev = 0;
  for (const s of steps) {
    const top = s.position[1] + s.size[1] / 2;
    assert.ok(top - prev <= 1 + 1e-9, `${s.name} sobe ${top - prev} studs`);
    prev = top;
  }
  assert.equal(prev, LEVELS.F2);
});

test('exatamente um SpawnLocation, sobre o piso', () => {
  const spawns = parts.filter((p) => p.className === 'SpawnLocation');
  assert.equal(spawns.length, 1);
  assert.equal(spawns[0].position[1] - spawns[0].size[1] / 2, 0);
});

test('32 celas, cada uma com cama, vaso, pia, janela e porta', () => {
  const cells = new Set(parts.filter((p) => /^Celas\/Cela \d\d$/.test(p.model)).map((p) => p.model));
  assert.equal(cells.size, 32);
  for (const c of cells) {
    const names = new Set(parts.filter((p) => p.model === c).map((p) => p.name));
    for (const n of ['Cama Base', 'Vaso Base', 'Pia Cuba', 'Vidro Janela', 'Batente E', 'Porta Topo', 'Painel']) {
      assert.ok(names.has(n), `${c} sem "${n}"`);
    }
  }
});
