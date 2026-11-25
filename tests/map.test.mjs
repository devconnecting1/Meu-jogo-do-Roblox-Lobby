// Regras do terreno do Vale: Lobby no centro, áreas de construção, 30 lotes ligados por estradas,
// penhascos, terraços e lagoas, tudo plano onde se constrói.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMap,
  DIM,
  T,
  PLAZA,
  PLOTS,
  PADS,
  PONDS,
  createWorld,
  SEED,
  terrainAt,
  heightAt,
  surfaceAt,
} from '../src/map.js';

const { parts, landmarks } = buildMap();
const world = createWorld(SEED);
const count = (fn) => parts.filter(fn).length;

/** Todas as células do retângulo têm a superfície esperada e estão no nível do chão. */
function flatPad(p, kinds) {
  const h = p.size / 2;
  for (let x = p.x - h + 1; x < p.x + h; x += 2) {
    for (let z = p.z - h + 1; z < p.z + h; z += 2) {
      if (terrainAt(x, z) !== T.GROUND || heightAt(x, z) !== DIM.land) return `(${x}, ${z}) fora do chão plano`;
      if (!kinds.includes(surfaceAt(x, z))) return `(${x}, ${z}) com superfície ${surfaceAt(x, z)}`;
    }
  }
  return null;
}

test('30 lotes (20 jogadores + 10 bots) com nomes únicos, planos, espaçados e nos 4 quadrantes', () => {
  assert.equal(PLOTS.length, DIM.plots);
  assert.equal(new Set(PLOTS.map((p) => p.name)).size, DIM.plots);
  assert.equal(PLOTS.filter((p) => p.owner === 'jogador').length, DIM.players);
  assert.equal(PLOTS.filter((p) => p.owner === 'bot').length, DIM.bots);
  for (const p of PLOTS) {
    const bad = flatPad(p, ['lote']);
    assert.equal(bad, null, `${p.name}: ${bad}`);
  }
  for (let a = 0; a < PLOTS.length; a++) {
    for (let b = a + 1; b < PLOTS.length; b++) {
      const d = Math.hypot(PLOTS[a].x - PLOTS[b].x, PLOTS[a].z - PLOTS[b].z);
      assert.ok(d >= DIM.minPlotSpacing, `${PLOTS[a].name} e ${PLOTS[b].name} a ${d.toFixed(1)} studs`);
    }
  }
  const quad = new Set(PLOTS.map((p) => `${p.x >= 0 ? 'L' : 'O'}${p.z >= 0 ? 'S' : 'N'}`)); // x = 0 conta no leste
  assert.equal(quad.size, 4, `lotes só em ${quad.size} quadrantes`);
});

test('Lobby no centro: praça de pedra com faixas, estrado e spawn sobre a praça', () => {
  assert.equal(surfaceAt(0, 30) === 'pedra' || surfaceAt(0, 30) === 'pedraEscura', true, 'praça de pedra no centro');
  assert.equal(heightAt(0, 0), DIM.land + 1, 'estrado no meio da praça');
  assert.ok(count((p) => p.name === 'Faixa da Praça') >= 10, 'praça sem as faixas escuras');
  const spawns = parts.filter((p) => p.className === 'SpawnLocation');
  assert.equal(spawns.length, 1, 'um único spawn');
  const s = spawns[0];
  assert.ok(Math.abs(s.position[1] - s.size[1] / 2 - PLAZA.top) < 1e-6, 'spawn apoiado no piso da praça');
  assert.ok(Math.hypot(s.position[0], s.position[2]) < DIM.plazaR - 8, 'spawn dentro da praça');
});

test('8 áreas de construção em volta da praça, planas e ligadas ao Lobby', () => {
  assert.equal(PADS.length, DIM.pads);
  for (const p of PADS) {
    const bad = flatPad(p, ['area']);
    assert.equal(bad, null, `${p.name}: ${bad}`);
  }
  assert.ok(world.padsConnected.every(Boolean), 'área sem estrada até o Lobby');
});

test('estradas de terra ligam o Lobby a todos os lotes (sem pular degrau nem água)', () => {
  const lost = PLOTS.filter((_, k) => !world.plotsConnected[k]).map((p) => p.name);
  assert.deepEqual(lost, [], `lotes sem estrada até o Lobby: ${lost.join(', ')}`);
  assert.ok(count((p) => p.name === 'Terra da Estrada') >= 100, 'poucas estradas');
  assert.ok(count((p) => p.name === 'Terra Batida') >= 20, 'estrada sem as manchas de terra batida');
});

test('relevo do vale: penhascos altos em blocos, terraços de grama e lagoa', () => {
  assert.ok(landmarks.cliffMax >= DIM.land + 40, `penhasco baixo demais (${landmarks.cliffMax})`);
  assert.ok(count((p) => p.name === 'Rocha') >= 200, 'penhascos feitos de poucos blocos');
  assert.ok(landmarks.terraces >= 40, `poucos terraços de grama (${landmarks.terraces} células)`);
  assert.ok(PONDS.length >= 1, 'sem lagoa');
  assert.ok(count((p) => p.name === 'Grama Escura') >= 100, 'grama sem as manchas escuras');
});

test('borda do vale variada: parte penhasco, parte planalto sobre o mar', () => {
  let cliff = 0;
  let open = 0;
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    let r = 120;
    while (r < DIM.half && terrainAt(Math.cos(a) * r, Math.sin(a) * r) === T.GROUND) r += 4;
    if (terrainAt(Math.cos(a) * r, Math.sin(a) * r) === T.CLIFF) cliff++;
    else open++;
  }
  assert.ok(cliff >= 18, `pouco penhasco na borda (${cliff}/72)`);
  assert.ok(open >= 8, `nenhuma borda aberta para o mar (${open}/72)`);
});
