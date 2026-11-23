// "Nada apertado": medidas mínimas na escala da prisão de referência.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIM, LEVELS, clearanceZones } from '../src/prison.js';

const MIN = {
  cellW: 14, // cela com 14 de largura
  cellD: 16, // e 16 de profundidade
  cellH: 16, // pé-direito por andar
  corridor: 10, // corredor/galeria diante das celas
  voidWidth: 44, // vão central de pé-direito duplo
  roofClear: 25, // do 2º andar ao teto
  stairWidth: 12,
  bridgeWidth: 8,
  doorWidth: 2.8, // vão livre medido na zona da porta
};

test('celas e corredores com folga (escala da referência)', () => {
  assert.ok(DIM.cellW >= MIN.cellW, `cela com ${DIM.cellW} de largura`);
  assert.ok(DIM.cellD >= MIN.cellD, `cela com ${DIM.cellD} de profundidade`);
  assert.ok(DIM.cellH >= MIN.cellH, `pé-direito ${DIM.cellH}`);
  assert.ok(DIM.corridor >= MIN.corridor, `corredor com ${DIM.corridor}`);
});

test('átrio amplo e alto', () => {
  assert.ok(DIM.voidHalf * 2 >= MIN.voidWidth, `vão central com ${DIM.voidHalf * 2}`);
  assert.ok(LEVELS.ROOF - LEVELS.F2 >= MIN.roofClear, `${LEVELS.ROOF - LEVELS.F2} do 2º andar ao teto`);
});

test('escada e ponte largas', () => {
  assert.ok(DIM.stairHalf * 2 >= MIN.stairWidth, `escada com ${DIM.stairHalf * 2}`);
  assert.ok(DIM.bridgeHalf * 2 >= MIN.bridgeWidth, `ponte com ${DIM.bridgeHalf * 2}`);
});

test('portas das celas com vão livre confortável', () => {
  for (const z of clearanceZones().filter((x) => x.name.startsWith('Porta da cela'))) {
    const w = z.max[0] - z.min[0];
    const h = z.max[1] - z.min[1];
    assert.ok(w >= MIN.doorWidth, `${z.name}: ${w} de largura`);
    assert.ok(h >= 8.5, `${z.name}: ${h} de altura`);
  }
});

test('corredores e galerias livres com pelo menos 7 studs de largura útil', () => {
  for (const z of clearanceZones().filter((x) => /^(Corredor|Galeria)/.test(x.name))) {
    const w = z.max[2] - z.min[2];
    assert.ok(w >= 7, `${z.name}: ${w}`);
  }
});
