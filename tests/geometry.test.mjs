// Regras físicas da construção: tudo apoiado, sem z-fighting, passagens livres,
// guarda-corpo contínuo, escada confortável e ambiente fechado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrison,
  clearanceZones,
  fallEdges,
  ENVELOPE,
  INTERIOR,
  ANNEX,
  ANNEX_INTERIOR,
  TUNNEL,
  LEVELS,
} from '../src/prison.js';
import { findFloating, findZFighting, findClearanceViolations, findEdgeGaps, findOutside } from '../src/checks.js';

const { parts } = buildPrison();
const report = (problems, max = 40) =>
  problems.length
    ? `\n${problems.slice(0, max).join('\n')}${problems.length > max ? `\n… +${problems.length - max}` : ''}`
    : '';

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

const inAnnex = (p) => p.model.startsWith('Túnel');

test('tudo fica dentro da envoltória (prédio + túnel); o interior não vaza para fora', () => {
  const outside = [
    ...findOutside(
      parts.filter((p) => !inAnnex(p)),
      ENVELOPE,
    ),
    ...findOutside(parts.filter(inAnnex), ANNEX),
  ];
  assert.equal(outside.length, 0, report(outside));
  const inner = [
    ...findOutside(
      parts.filter((p) => p.model !== 'Envoltória' && !inAnnex(p)),
      INTERIOR,
    ),
    ...findOutside(
      parts.filter((p) => inAnnex(p) && p.model !== 'Túnel/Envoltória'),
      ANNEX_INTERIOR,
    ),
  ];
  assert.equal(inner.length, 0, report(inner));
});

test('ambiente fechado: piso, teto e 4 paredes opacos; o único vão é o portal do túnel', () => {
  const shell = parts.filter((p) => p.model === 'Envoltória');
  assert.deepEqual(
    shell.map((p) => p.name).sort(),
    [
      'Laje Teto',
      'Laje Térreo',
      'Parede Leste',
      'Parede Norte',
      'Parede Oeste N',
      'Parede Oeste S',
      'Parede Oeste Verga',
      'Parede Sul',
    ].sort(),
  );
  for (const p of [...shell, ...parts.filter((x) => x.model === 'Túnel/Envoltória')]) {
    assert.equal(p.transparency, 0, `${p.name} precisa ser opaca`);
    assert.equal(p.canCollide, true, `${p.name} precisa colidir`);
  }
  const span = (p, i) => [p.position[i] - p.size[i] / 2, p.position[i] + p.size[i] / 2];
  const byName = Object.fromEntries(shell.map((p) => [p.name, p]));
  for (const n of ['Laje Térreo', 'Laje Teto']) {
    assert.deepEqual(span(byName[n], 0), [ENVELOPE.min[0], ENVELOPE.max[0]], `${n} cobre X`);
    assert.deepEqual(span(byName[n], 2), [ENVELOPE.min[2], ENVELOPE.max[2]], `${n} cobre Z`);
  }
  for (const n of ['Parede Sul', 'Parede Norte', 'Parede Leste', 'Parede Oeste S', 'Parede Oeste N']) {
    assert.deepEqual(span(byName[n], 1), [0, LEVELS.ROOF], `${n} vai do piso ao teto`);
  }
  // o vão da parede oeste é exatamente o portal do túnel
  assert.equal(span(byName['Parede Oeste S'], 2)[1], TUNNEL.portal[0]);
  assert.equal(span(byName['Parede Oeste N'], 2)[0], TUNNEL.portal[1]);
  assert.deepEqual(span(byName['Parede Oeste Verga'], 1), [TUNNEL.portalTop, LEVELS.ROOF]);
  assert.deepEqual(span(byName['Parede Oeste Verga'], 2), TUNNEL.portal);
});

test('túnel fechado: fundo opaco e o portão B (o mesmo do A) fechado no meio do vão', () => {
  const tunnel = parts.filter((p) => p.model === 'Túnel/Envoltória');
  const span = (p, i) => [p.position[i] - p.size[i] / 2, p.position[i] + p.size[i] / 2];
  const back = tunnel.find((p) => p.name === 'Parede do Fundo');
  assert.ok(back, 'falta a parede do fundo do túnel');
  assert.equal(span(back, 0)[0], ANNEX.min[0], 'o fundo fecha o anexo');
  const gate = (m) => parts.filter((p) => p.model === m && /^Folha /.test(p.name));
  const a = gate('Túnel/Portão A (aberto)');
  const bGate = gate('Túnel/Portão B (fechado)');
  assert.equal(a.length, 2, 'portão A com duas folhas');
  assert.equal(bGate.length, 2, 'portão B com duas folhas');
  // mesmo portão: folhas do mesmo tamanho
  assert.deepEqual(a.map((p) => p.size).sort(), bGate.map((p) => p.size).sort());
  // B fechado: as folhas se encontram em z = 0 e cobrem todo o vão
  const zs = bGate.map((p) => span(p, 2)).sort((p, q) => p[0] - q[0]);
  assert.equal(zs[0][1], zs[1][0], 'as folhas do portão B se encontram no meio');
  assert.ok(zs[0][0] <= TUNNEL.portal[0] && zs[1][1] >= TUNNEL.portal[1], 'portão B cobre o vão');
  // A aberto: nenhuma folha dentro do vão
  for (const p of a) {
    const [z0, z1] = span(p, 2);
    assert.ok(z1 <= TUNNEL.portal[0] || z0 >= TUNNEL.portal[1], `${p.name} do portão A invade o vão`);
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
