// Fonte com a estátua R6 erguendo o logo clássico (src/props/statue.js): a peça sozinha,
// sobre um chão plano, precisa obedecer às mesmas regras físicas e de estilo do mapa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBuilder, aabb } from '../src/builder.js';
import { findFloating, findZFighting } from '../src/checks.js';
import { C } from '../src/palette.js';
import { materialFor } from '../src/materials.js';
import { fountainStatue, FOUNTAIN_HALF } from '../src/props/statue.js';

const EPS = 1e-6;
const PALETTE = new Set(Object.values(C).map((c) => c.join(',')));
const BANNED = /gui|npc|dummy|humanoid|decal|texture|script/i;
const report = (problems, max = 40) =>
  problems.length
    ? `\n${problems.slice(0, max).join('\n')}${problems.length > max ? `\n… +${problems.length - max}` : ''}`
    : '';
const label = (p) => `${p.model}/${p.name} @ [${p.position.join(', ')}]`;

/** Monta a fonte sobre um chão de 60 × 60 com topo em y; devolve as Parts e só as da fonte. */
function build(cx, y, cz) {
  const b = makeBuilder();
  b.span('Chão', 'Chão', [cx - 30, y - 2, cz - 30], [cx + 30, y, cz + 30], C.grass);
  fountainStatue(b, 'Fonte', cx, y, cz);
  return { parts: b.parts, prop: b.parts.filter((p) => p.name !== 'Chão'), cx, y, cz };
}

// origem e um ponto qualquer do mapa (confere que tudo é relativo a cx, y, cz)
const CASES = [build(0, 0, 0), build(37.5, 6, -24)];

for (const { parts, prop, cx, y, cz } of CASES) {
  const where = `em (${cx}, ${y}, ${cz})`;

  test(`fonte ${where}: nada flutua (cadeia de contato até o Chão)`, () => {
    const p = findFloating(parts, 'Chão');
    assert.equal(p.length, 0, report(p));
  });

  test(`fonte ${where}: sem z-fighting entre faces visíveis`, () => {
    const p = findZFighting(parts);
    assert.equal(p.length, 0, report(p));
  });

  test(`fonte ${where}: tudo dentro do quadrado de ±FOUNTAIN_HALF e abaixo de 40 studs`, () => {
    assert.ok(FOUNTAIN_HALF <= 14, `FOUNTAIN_HALF = ${FOUNTAIN_HALF}`);
    const out = [];
    for (const p of prop) {
      const { min, max } = aabb(p);
      const inside =
        min[0] >= cx - FOUNTAIN_HALF - EPS &&
        max[0] <= cx + FOUNTAIN_HALF + EPS &&
        min[2] >= cz - FOUNTAIN_HALF - EPS &&
        max[2] <= cz + FOUNTAIN_HALF + EPS &&
        min[1] >= y - 0.1 - EPS &&
        max[1] <= y + 40 + EPS;
      if (!inside) out.push(`Fora: ${label(p)}`);
    }
    assert.equal(out.length, 0, report(out));
  });

  test(`fonte ${where}: peças no chão afundam exatamente 0,1`, () => {
    const low = prop.filter((p) => aabb(p).min[1] < y + EPS);
    assert.ok(low.length > 0, 'nenhuma peça encosta no chão');
    for (const p of low) assert.ok(Math.abs(aabb(p).min[1] - (y - 0.1)) < 1e-3, `${label(p)}: base fora de y - 0,1`);
  });
}

const { prop, y } = CASES[0];

test('fonte: só cores da paleta C', () => {
  for (const p of prop) assert.ok(PALETTE.has(p.color.join(',')), `${label(p)}: cor fora da paleta ${p.color}`);
});

test('fonte: peça inclinada (giro em X ou Z) nunca colide', () => {
  for (const p of prop) {
    if (!p.rotation) continue;
    const tilted = p.rotation[0] !== 0 || p.rotation[2] !== 0;
    if (tilted) assert.equal(p.canCollide, false, `${label(p)}: inclinada e com colisão`);
  }
});

test('fonte: medidas >= 0,04, Plastic, nada de Neon e transparência <= 0,8', () => {
  for (const p of prop) {
    for (const v of p.size) assert.ok(v >= 0.04, `${label(p)}: tamanho ${v}`);
    assert.equal(p.material, materialFor(p.color), `${label(p)}: material ${p.material}`);
    assert.ok(p.transparency >= 0 && p.transparency <= 0.8, `${label(p)}: transparência ${p.transparency}`);
    assert.equal(p.light, null, `${label(p)}: luz inesperada`);
  }
});

test('fonte: nomes sem gui, npc, dummy, humanoid, decal, texture ou script', () => {
  for (const p of prop) assert.ok(!BANNED.test(`${p.model}/${p.name}`), `${p.model}/${p.name}`);
});

test('fonte: tem água sem colisão e transparente, e a mureta colide', () => {
  const water = prop.filter((p) => p.name.startsWith('Água'));
  assert.ok(water.length >= 1, 'sem água');
  for (const p of water) {
    assert.equal(p.canCollide, false, `${label(p)}: água com colisão`);
    assert.equal(p.transparency, 0.25, `${label(p)}: transparência da água`);
    assert.deepEqual(p.color, C.water, `${label(p)}: cor da água`);
  }
  const walls = prop.filter((p) => p.name === 'Mureta');
  assert.ok(walls.length >= 4, 'mureta incompleta');
  for (const p of walls) assert.equal(p.canCollide, true, `${label(p)}: mureta sem colisão`);
  for (const p of prop.filter((q) => q.name === 'Borda'))
    assert.ok(aabb(p).max[1] <= y + 2.5 + EPS, `${label(p)}: borda acima de 2,5 (tapa a vista)`);
});

test('fonte bem feita: tanque octogonal, borda larga para sentar, taça de cima com água e 8 filetes caindo', () => {
  const named = (n) => prop.filter((p) => p.name === n);
  // octógono = cruz de 2 caixas + 4 cantos girados 45° em Y (só em Y: podem colidir)
  const walls = named('Mureta');
  assert.equal(walls.length, 8, 'mureta octogonal (4 lados retos + 4 cantos)');
  assert.equal(walls.filter((p) => p.rotation && p.rotation[1] !== 0).length, 4, 'cantos da mureta girados');
  const rim = named('Borda');
  assert.equal(rim.length, 8, 'borda octogonal');
  for (const p of rim.filter((q) => !q.rotation)) {
    const thin = Math.min(p.size[0], p.size[2]);
    assert.ok(thin >= 1.5, `${label(p)}: borda estreita demais para sentar (${thin})`);
  }
  // duas águas: tanque de baixo e taça de cima, a de cima mais alta
  const low = named('Água da Fonte');
  const high = named('Água da Taça');
  assert.ok(low.length > 0 && high.length > 0, 'falta água no tanque ou na taça');
  const top = (list) => Math.max(...list.map((p) => aabb(p).max[1]));
  assert.ok(top(high) > top(low) + 2, 'a taça de cima não está acima do tanque');
  // filetes: 8, finos, saindo da altura da taça e entrando na água de baixo
  const jets = named('Água da Bica');
  assert.equal(jets.length, 8, 'a fonte tem 8 filetes de água');
  assert.equal(named('Bica').length, 8, 'a fonte tem 8 bicas');
  for (const p of jets) {
    const bb = aabb(p);
    assert.ok(Math.max(p.size[0], p.size[2]) <= 0.5, `${label(p)}: filete grosso demais`);
    assert.ok(bb.min[1] < top(low) && bb.min[1] > y + 0.8, `${label(p)}: filete não termina na água do tanque`);
    assert.ok(bb.max[1] > top(low) + 2, `${label(p)}: filete não sai da taça`);
  }
});

test('fonte: estátua R6 com braço levantado segurando o logo (4 barras giradas, sem colisão)', () => {
  const R6 = ['Perna Esquerda', 'Perna Direita', 'Tronco da Estátua', 'Braço Esquerdo', 'Braço Levantado'];
  for (const name of [...R6, 'Cabeça da Estátua'])
    assert.ok(
      prop.some((p) => p.name === name),
      `falta ${name}`,
    );
  const logo = prop.filter((p) => p.name === 'Logo');
  assert.equal(logo.length, 4, 'o logo tem 4 barras');
  for (const p of logo) {
    assert.equal(p.canCollide, false, `${label(p)}: logo com colisão`);
    assert.ok(p.rotation && p.rotation[2] !== 0, `${label(p)}: logo sem inclinação`);
  }
  // a mão (topo do braço levantado) encosta na caixa envolvente de alguma barra do logo
  const arm = aabb(prop.find((p) => p.name === 'Braço Levantado'));
  const touches = (a, b) => [0, 1, 2].every((i) => a.min[i] <= b.max[i] + 0.01 && b.min[i] <= a.max[i] + 0.01);
  assert.ok(
    logo.some((p) => touches(arm, aabb(p))),
    'o logo não encosta na mão',
  );
  // o braço levantado é uma caixa vertical acima do ombro (sem giro) e mais alto que o tronco
  const torso = aabb(prop.find((p) => p.name === 'Tronco da Estátua'));
  assert.ok(arm.max[1] > torso.max[1], 'braço levantado não passa do ombro');
});
