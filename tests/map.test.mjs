// Regras do reino: 30 lotes de castelo espalhados, todos ligados à praça por estradas,
// e decoração variada (florestas, outono, planaltos, rio com pontes, recursos e cais).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMap, PLOTS, PLAZA, DIM, T, terrainAt, LAKE, distToRiver, MAP_INFO } from '../src/map.js';
import { aabb } from '../src/builder.js';

const { parts, landmarks } = buildMap();
const count = (fn) => parts.filter(fn).length;

test('30 lotes de castelo: 20 de jogadores + 10 de bots, com nomes únicos', () => {
  assert.equal(DIM.players + DIM.bots, DIM.plots);
  assert.equal(PLOTS.length, DIM.plots);
  const names = PLOTS.map((p) => p.name);
  assert.equal(new Set(names).size, names.length, 'nomes repetidos');
  for (const p of PLOTS) {
    const own = parts.filter((x) => x.model === `Lotes/${p.name}`);
    assert.equal(own.filter((x) => x.name === 'Fundação').length, 1, `${p.name} sem fundação`);
    assert.equal(own.filter((x) => x.name === 'Bandeira').length, 1, `${p.name} sem bandeira`);
  }
});

test('lotes espalhados pelo mapa, longe uns dos outros, da praça e da água', () => {
  for (let i = 0; i < PLOTS.length; i++) {
    const a = PLOTS[i];
    assert.ok(Math.hypot(a.x - PLAZA.x, a.z - PLAZA.z) >= 110, `${a.name} colado na praça`);
    assert.ok(Math.hypot(a.x - LAKE.x, a.z - LAKE.z) >= 110, `${a.name} colado no lago`);
    assert.ok(distToRiver(a.x, a.z) >= 52, `${a.name} colado no rio`);
    for (let j = i + 1; j < PLOTS.length; j++) {
      const b = PLOTS[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(d >= DIM.minPlotSpacing, `${a.name} e ${b.name} a ${d.toFixed(1)} studs`);
    }
  }
  // espalhados: há lotes nos quatro quadrantes da ilha
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    assert.ok(
      PLOTS.some((p) => Math.sign(p.x) === sx && Math.sign(p.z) === sz),
      `nenhum lote no quadrante ${sx},${sz}`,
    );
  }
});

test('cada fundação fica inteira sobre a grama (com folga em volta)', () => {
  const m = DIM.plotSize / 2 + 2;
  for (const p of PLOTS) {
    for (let x = p.x - m; x <= p.x + m; x += 2) {
      for (let z = p.z - m; z <= p.z + m; z += 2) {
        assert.equal(terrainAt(x, z), T.GRASS, `${p.name}: (${x}, ${z}) não é grama`);
      }
    }
  }
});

test('a praça fica na grama, com a estátua e um único spawn sobre o piso', () => {
  for (let x = -PLAZA.reach; x <= PLAZA.reach; x += 4) {
    for (let z = -PLAZA.reach; z <= PLAZA.reach; z += 4) assert.equal(terrainAt(x, z), T.GRASS, `praça (${x}, ${z})`);
  }
  const spawns = parts.filter((p) => p.className === 'SpawnLocation');
  assert.equal(spawns.length, 1);
  const s = spawns[0];
  assert.ok(Math.abs(s.position[1] - s.size[1] / 2 - PLAZA.top) < 1e-6, 'spawn apoiado no piso da praça');
  assert.ok(Math.hypot(s.position[0], s.position[2]) < DIM.plazaHalf, 'spawn dentro da praça');
  for (const n of ['Pedestal', 'Estátua', 'Coroa', 'Espada', 'Escudo', 'Estandarte']) {
    assert.ok(count((p) => p.model === 'Praça do Reino' && p.name === n) > 0, `praça sem "${n}"`);
  }
});

test('estradas ligam todos os lotes à praça (malha contínua de estrada e ponte)', () => {
  const net = parts.filter(
    (p) =>
      p.model === 'Estradas' ||
      (p.model.startsWith('Pontes/') && p.name === 'Tabuleiro') ||
      (p.model.startsWith('Lotes/') && p.name === 'Fundação') ||
      p.name === 'Piso da Praça',
  );
  const bx = net.map(aabb);
  const parent = net.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const touch = (a, b) => [0, 1, 2].every((k) => a.min[k] <= b.max[k] + 0.01 && b.min[k] <= a.max[k] + 0.01);
  for (let i = 0; i < net.length; i++) {
    for (let j = i + 1; j < net.length; j++) if (touch(bx[i], bx[j])) parent[find(i)] = find(j);
  }
  const plaza = find(net.findIndex((p) => p.name === 'Piso da Praça'));
  const lost = net.filter((p, i) => p.name === 'Fundação' && find(i) !== plaza).map((p) => p.model);
  assert.deepEqual(lost, [], `lotes sem estrada até a praça: ${lost.join(', ')}`);
});

test('estradas só sobre a grama e pontes só onde há rio', () => {
  for (const p of parts.filter((x) => x.model === 'Estradas')) {
    const { min, max } = aabb(p);
    for (let x = min[0]; x <= max[0]; x += 2) {
      for (let z = min[2]; z <= max[2]; z += 2) {
        const t = terrainAt(Math.min(x, max[0] - 0.01), Math.min(z, max[2] - 0.01));
        assert.equal(t, T.GRASS, `Estrada @ [${p.position}] passa por terreno ${t} em (${x}, ${z})`);
      }
    }
  }
  assert.ok(MAP_INFO.bridges >= 1, 'nenhuma ponte sobre o rio');
  for (const p of parts.filter((x) => x.name === 'Tabuleiro')) {
    const { min, max } = aabb(p);
    let wet = false;
    for (let x = min[0]; x <= max[0]; x += 1) {
      for (let z = min[2]; z <= max[2]; z += 1) if (terrainAt(x, z) === T.RIVER) wet = true;
    }
    assert.ok(wet, `${p.model} não cruza o rio`);
  }
});

test('decoração variada: florestas, outono, planaltos, pedras, recursos e cais', () => {
  const trunks = (m) => count((p) => p.name === 'Tronco' && p.model === m);
  assert.ok(trunks('Vegetação/Floresta') >= 150, `só ${trunks('Vegetação/Floresta')} árvores verdes`);
  assert.ok(trunks('Vegetação/Bosque de Outono') >= 30, `só ${trunks('Vegetação/Bosque de Outono')} de outono`);
  assert.ok(landmarks.mesas.length >= 6, `só ${landmarks.mesas.length} planaltos`);
  assert.ok(trunks('Vegetação/Árvores do Planalto') >= landmarks.mesas.length, 'planaltos sem árvore no topo');
  assert.ok(count((p) => p.model === 'Relevo/Pedras') >= 60, 'poucas pedras soltas');
  assert.ok(landmarks.farms.length >= 3, `só ${landmarks.farms.length} campos de trigo`);
  const mines = (k) => landmarks.mines.filter((m) => m[2] === k).length;
  assert.ok(mines('ouro') >= 2 && mines('pedra') >= 2, `jazidas: ${mines('ouro')} de ouro, ${mines('pedra')} de pedra`);
  assert.ok(landmarks.docks.length >= 1, 'nenhum cais na praia');
});

test('praça viva como um lobby: mercado com toldos, caixotes, canteiros e colunas antigas', () => {
  const models = (prefix) => new Set(parts.filter((p) => p.model.startsWith(prefix)).map((p) => p.model)).size;
  assert.equal(models('Praça do Reino/Barraca '), 4, 'mercado com 4 barracas');
  assert.ok(models('Praça do Reino/Caixotes ') >= 4, 'caixotes do mercado');
  assert.ok(models('Praça do Reino/Canteiro ') >= 4, 'canteiros de flores');
  assert.ok(models('Praça do Reino/Coluna Antiga ') >= 6, 'colunas antigas');
  for (let n = 1; n <= 4; n++) {
    const names = new Set(parts.filter((p) => p.model === `Praça do Reino/Barraca ${n}`).map((p) => p.name));
    for (const k of ['Balcão', 'Tampo do Balcão', 'Poste da Barraca', 'Toldo', 'Franja']) {
      assert.ok(names.has(k), `Barraca ${n} sem "${k}"`);
    }
  }
});

test('escadarias dos planaltos: degraus de até 1 stud que chegam ao topo de grama', () => {
  const stairs = new Set(parts.filter((p) => p.name === 'Degrau').map((p) => p.model));
  assert.ok(stairs.size >= 2, `só ${stairs.size} planaltos com escada`);
  const top = (p) => p.position[1] + p.size[1] / 2;
  for (const m of stairs) {
    const steps = parts.filter((p) => p.model === m && p.name === 'Degrau').sort((a, b) => top(a) - top(b));
    let prev = DIM.land;
    for (const s of steps) {
      assert.ok(top(s) - prev <= 1.1 + 1e-9, `${m}: degrau sobe ${(top(s) - prev).toFixed(2)} studs`);
      prev = top(s);
    }
    const grass = parts.filter((p) => p.model === m && p.name === 'Topo de Grama').map(top);
    assert.ok(Math.abs(prev - Math.min(...grass)) < 1e-6, `${m}: a escada não chega ao topo`);
  }
});

test('peças inclinadas e copas não colidem; o que colide e é girado só gira em Y', () => {
  for (const p of parts.filter((x) => x.rotation)) {
    const [rx, , rz] = p.rotation;
    if (rx !== 0 || rz !== 0) assert.equal(p.canCollide, false, `${p.model}/${p.name} inclinada com colisão`);
  }
  for (const n of ['Copa', 'Galho', 'Arbusto', 'Pedra', 'Trigo', 'Bandeira', 'Estandarte']) {
    for (const p of parts.filter((x) => x.name === n)) assert.equal(p.canCollide, false, `${p.model}/${n} colide`);
  }
});
