// Zoneamento: cada função da prisão tem sua sala; o bloco de celas fica livre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrison, LEVELS } from '../src/prison.js';

const { parts } = buildPrison();
const inside = (p, [x0, x1], [z0, z1]) =>
  p.position[0] > x0 && p.position[0] < x1 && p.position[2] > z0 && p.position[2] < z1;

test('salas próprias: refeitório, almoxarifado, enfermaria, guardas e rouparia', () => {
  for (const m of [
    'Ala Oeste/Refeitório',
    'Ala Oeste/Almoxarifado',
    'Ala Oeste/Enfermaria',
    'Salas/Sala dos Guardas',
    'Salas/Rouparia',
  ]) {
    assert.ok(
      parts.some((p) => p.model === m),
      `falta a sala ${m}`,
    );
  }
});

test('refeitório e caixas ficam na ala oeste, fora do bloco de celas', () => {
  const [w0, w1] = LEVELS.WING;
  for (const p of parts.filter((x) => ['Mesa Tampo', 'Balcão de Servir'].includes(x.name))) {
    assert.ok(inside(p, [w0, w1], [6, LEVELS.IN_Z]), `${p.model}/${p.name} fora do refeitório`);
  }
  for (const p of parts.filter((x) => x.name === 'Caixa')) {
    assert.ok(p.position[0] < w1 || p.position[0] > LEVELS.STAIR_X1, `${p.model}: caixa no bloco de celas`);
  }
});

test('átrio do bloco de celas sem móveis (só colunas, escada e luminárias)', () => {
  const blocked = parts.filter(
    (p) =>
      p.canCollide &&
      inside(p, [-LEVELS.ROW, LEVELS.STAIR_X0 - 2], [-LEVELS.EDGE + 2, LEVELS.EDGE - 2]) &&
      !/^(Pisos|Estrutura|Galerias|Escada)/.test(p.model),
  );
  assert.equal(blocked.length, 0, blocked.map((p) => `${p.model}/${p.name}`).join('\n'));
});
