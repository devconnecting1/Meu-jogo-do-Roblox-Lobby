// Regras do Vale: Lobby no centro, 8 lojas grandes ligadas por estradas,
// penhascos, terraços e lagoas, tudo plano onde se constrói.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMap,
  DIM,
  T,
  PLAZA,
  PADS,
  PONDS,
  createWorld,
  PLANS,
  SEED,
  terrainAt,
  heightAt,
  surfaceAt,
  inPlan,
} from '../src/map.js';
import { SHOPS } from '../src/props/lojas.js';
import { SKIPPED } from '../src/props/oficina.js';

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

test('cada loja segue a planta do seu prédio: formatos e tamanhos diferentes, sem igreja nem castelo', () => {
  const shops = new Set(PADS.map((p) => p.plan));
  assert.equal(shops.size, PADS.length, 'cada área em volta da praça é de um prédio diferente');
  for (const p of PADS) assert.equal(PLANS[p.plan].group, 'loja', `${p.name}: só lojas no mapa`);
  assert.ok(!Object.keys(PLANS).includes('capela'), 'sem igreja (pedido do dono)');
  assert.ok(Object.values(PLANS).every((q) => q.group === 'loja'), 'sem plantas de castelo');
  // tamanho real: cada loja ocupa a área inteira de 48×48, com formato e área próprios
  const sizes = new Set(PADS.map((p) => world.footprint(p).length));
  assert.equal(sizes.size, PADS.length, `lojas com áreas repetidas (${[...sizes].join(', ')} células)`);
  for (const p of PADS) assert.ok(world.footprint(p).length >= 60, `${p.name}: loja pequena demais`);
  const square = PADS.filter((p) => world.footprint(p).length === (p.size / DIM.cell) ** 2).length;
  assert.equal(square, 0, `${square} plantas são quadrados cheios`);
});

test('estradas de terra ligam o Lobby a todas as lojas (sem pular degrau nem água)', () => {
  assert.ok(world.padsConnected.every(Boolean), 'loja sem estrada até o Lobby');
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

const under = (root) => parts.filter((p) => p.model === root || p.model.startsWith(`${root}/`));

/** Toda peça da loja fica na planta da área (placas e lanternas da fachada saem no máximo 2 studs). */
function outsidePlan(p, list) {
  return list
    .filter((q) => {
      const [x0, z0, x1, z1] = [
        q.position[0] - q.size[0] / 2 + 0.01,
        q.position[2] - q.size[2] / 2 + 0.01,
        q.position[0] + q.size[0] / 2 - 0.01,
        q.position[2] + q.size[2] / 2 - 0.01,
      ];
      return [
        [x0, z0],
        [x0, z1],
        [x1, z0],
        [x1, z1],
      ].some(([x, z]) => !inPlan(p, x, z, 2.1));
    })
    .map((q) => `${q.model}/${q.name}`);
}

test('construções com interior: todo móvel coube no lugar (nada pulado)', () => {
  assert.deepEqual(
    [...new Set(SKIPPED)],
    [],
    `móveis fora do piso livre ou na passagem: ${[...new Set(SKIPPED)].join(', ')}`,
  );
});

test('8 lojas grandes: paredes, porta, janelas, telhado, luz por dentro e na fachada e interior mobiliado', () => {
  for (const p of PADS) {
    const root = `Construções/${SHOPS[p.plan].model}`;
    const ps = under(root);
    const names = new Set(ps.map((q) => q.name));
    for (const n of ['Piso', 'Parede', 'Base da Parede', 'Janela', 'Telhado', 'Lanterna da Fachada'])
      assert.ok(names.has(n), `${root} sem ${n}`);
    const lights = ps.filter((q) => q.light);
    assert.equal(lights.length, 3, `${root}: 1 luz por dentro e 2 na fachada (tem ${lights.length})`);
    const inside = ps.filter((q) => q.model.includes('/Interior/')).length;
    assert.ok(inside >= 20, `${root}: interior com só ${inside} peças`);
    assert.deepEqual(outsidePlan(p, ps), [], `${root}: peças fora da planta`);
    // tamanho real: pé-direito de pelo menos 12 studs (o boneco R6 tem 5)
    const wallTop = Math.max(...ps.filter((q) => q.name === 'Parede').map((q) => q.position[1] + q.size[1] / 2));
    assert.ok(wallTop - DIM.land >= 12, `${root}: paredes baixas (${wallTop - DIM.land})`);
  }
});

test('noite no Lobby: postes de luz acesos na praça', () => {
  const lamps = parts.filter((q) => q.name === 'Lanterna do Poste');
  assert.ok(lamps.length >= 8, `só ${lamps.length} postes de luz na praça`);
  assert.ok(lamps.every((q) => q.light && q.canCollide === false), 'poste sem luz ou lanterna com colisão');
});
