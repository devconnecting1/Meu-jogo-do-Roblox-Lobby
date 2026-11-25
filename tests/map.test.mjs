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
  PLANS,
  SEED,
  terrainAt,
  heightAt,
  surfaceAt,
} from '../src/map.js';

const { parts, landmarks } = buildMap();
const world = createWorld(SEED);
const count = (fn) => parts.filter(fn).length;

/** Todas as células da planta (o piso do prédio) têm a superfície esperada e estão no nível do chão. */
function flatPad(p, kinds) {
  const cells = world.footprint(p);
  if (cells.length < 12) return `planta com só ${cells.length} células`;
  for (const [x, z] of cells) {
    if (terrainAt(x, z) !== T.GROUND || heightAt(x, z) !== DIM.land) return `(${x}, ${z}) fora do chão plano`;
    if (!kinds.includes(surfaceAt(x, z))) return `(${x}, ${z}) com superfície ${surfaceAt(x, z)}`;
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

test('estátua de Luvitlua no estrado: boneco R6 oficial, pedestal e nome em letras de pixel', () => {
  const st = parts.filter((p) => p.model.startsWith('Lobby/Estátua de Luvitlua'));
  assert.ok(st.length >= 60, `estátua com só ${st.length} peças`);
  const letters = new Set(st.filter((p) => p.name.startsWith('Letra ')).map((p) => p.name.slice(6)));
  for (const ch of 'LUVITA') assert.ok(letters.has(ch), `placa sem a letra ${ch}`);
  const topY = Math.max(...st.map((p) => p.position[1] + p.size[1] / 2));
  assert.ok(topY >= DIM.land + 25, `estátua baixa (${topY})`);
  for (const p of st) {
    for (const i of [0, 2])
      assert.ok(Math.abs(p.position[i]) + p.size[i] / 2 <= 7.5 + 1e-6, `${p.name} fora do estrado`);
  }
  // proporções do R6 oficial: tronco 2×2×1, braços e pernas 1×2×1 (vinco de 0,02), mesma altura
  const r6 = st.filter((p) => p.model.endsWith('/Boneco R6'));
  const one = (name) => {
    const p = r6.find((x) => x.name === name);
    assert.ok(p, `boneco sem ${name}`);
    return p.size;
  };
  const [tw, th, td] = one('Tronco');
  assert.ok(Math.abs(tw - th) < 1e-6 && Math.abs(tw - 2 * td) < 1e-6, 'tronco fora do 2×2×1');
  for (const n of ['Braço Esquerdo', 'Braço Direito', 'Perna Esquerda', 'Perna Direita']) {
    const [w, h, d] = one(n);
    assert.ok(Math.abs(h - th) < 1e-6, `${n} com altura diferente do tronco`);
    assert.ok(Math.abs(w - tw / 2) <= tw * 0.02 && Math.abs(d - td) <= td * 0.05, `${n} fora do 1×2×1`);
  }
  assert.ok(r6.filter((p) => p.name === 'Cabeça').length >= 1, 'boneco sem cabeça');
  assert.ok(
    r6.every((p) => p.color.join() === r6[0].color.join()),
    'estátua em mais de uma cor',
  );
  // só o corpo do R6: nada de armadura, roupa, arma ou item (pedido do dono do jogo)
  const body = new Set(['Cabeça', 'Tronco', 'Braço Esquerdo', 'Braço Direito', 'Perna Esquerda', 'Perna Direita']);
  const extra = r6.filter((p) => !body.has(p.name)).map((p) => p.name);
  assert.deepEqual(extra, [], `boneco com peças além do corpo R6: ${extra.join(', ')}`);
  const sub = new Set(st.map((p) => p.model.split('/').slice(2).join('/')));
  for (const m of sub) assert.ok(['Pedestal', 'Pedestal/Nome', 'Boneco R6'].includes(m), `estátua com ${m}`);
  assert.ok(
    st.every((p) => !p.light && p.material !== 'Neon'),
    'estátua com brilho ou luz',
  );
});

test('8 áreas de construção em volta da praça, planas e ligadas ao Lobby', () => {
  assert.equal(PADS.length, DIM.pads);
  for (const p of PADS) {
    const bad = flatPad(p, ['area']);
    assert.equal(bad, null, `${p.name}: ${bad}`);
  }
  assert.ok(world.padsConnected.every(Boolean), 'área sem estrada até o Lobby');
});

test('cada área segue a planta do seu prédio: formatos variados, não só quadrados', () => {
  const shops = new Set(PADS.map((p) => p.plan));
  assert.equal(shops.size, PADS.length, 'cada área em volta da praça é de um prédio diferente');
  for (const p of PADS) assert.equal(PLANS[p.plan].group, 'loja', `${p.name}: planta de castelo na praça`);
  const castles = new Set(PLOTS.map((p) => p.plan));
  assert.ok(castles.size >= 6, `só ${castles.size} plantas de castelo diferentes`);
  for (const p of PLOTS) assert.equal(PLANS[p.plan].group, 'castelo', `${p.name}: planta de loja num lote`);
  // formatos de verdade: áreas (número de células) e contornos diferentes
  const sizes = new Set([...PADS, ...PLOTS].map((p) => world.footprint(p).length));
  assert.ok(sizes.size >= 10, `só ${sizes.size} tamanhos de planta`);
  const square = [...PADS, ...PLOTS].filter((p) => world.footprint(p).length === (p.size / DIM.cell) ** 2).length;
  assert.ok(square <= 3, `${square} plantas são quadrados cheios`);
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
