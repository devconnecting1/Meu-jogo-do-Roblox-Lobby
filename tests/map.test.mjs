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

test('o Lobby fica na grama, com a estátua e um único spawn sobre o piso', () => {
  for (let x = -PLAZA.reach; x <= PLAZA.reach; x += 4) {
    for (let z = -PLAZA.reach; z <= PLAZA.reach; z += 4) assert.equal(terrainAt(x, z), T.GRASS, `praça (${x}, ${z})`);
  }
  const spawns = parts.filter((p) => p.className === 'SpawnLocation');
  assert.equal(spawns.length, 1);
  const s = spawns[0];
  assert.ok(Math.abs(s.position[1] - s.size[1] / 2 - PLAZA.top) < 1e-6, 'spawn apoiado no piso do Lobby');
  assert.ok(Math.hypot(s.position[0], s.position[2]) < DIM.plazaHalf, 'spawn dentro do Lobby');
  const fonte = parts.filter((p) => p.model.startsWith('Lobby/Fonte'));
  assert.ok(
    fonte.some((p) => p.name === 'Logo'),
    'a estátua não ergue o logo do Roblox',
  );
  assert.ok(
    fonte.some((p) => p.name.startsWith('Água') && !p.canCollide),
    'fonte sem água',
  );
  assert.ok(count((p) => p.model === 'Lobby' && p.name === 'Estandarte') >= 4, 'Lobby sem estandartes');
});

test('estradas ligam todos os lotes ao Lobby (malha contínua de estrada, ponte e escadaria)', () => {
  const net = parts.filter(
    (p) =>
      p.model === 'Estradas' ||
      (p.model.startsWith('Pontes/') && p.name === 'Tabuleiro') ||
      (p.model.startsWith('Lotes/') && p.name === 'Fundação') ||
      ['Base do Lobby', 'Piso do Lobby', 'Degrau do Lobby'].includes(p.name),
  );
  const bx = net.map(aabb);
  const parent = net.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const touch = (a, b) => [0, 1, 2].every((k) => a.min[k] <= b.max[k] + 0.01 && b.min[k] <= a.max[k] + 0.01);
  for (let i = 0; i < net.length; i++) {
    for (let j = i + 1; j < net.length; j++) if (touch(bx[i], bx[j])) parent[find(i)] = find(j);
  }
  const plaza = find(net.findIndex((p) => p.name === 'Piso do Lobby'));
  const lost = net.filter((p, i) => p.name === 'Fundação' && find(i) !== plaza).map((p) => p.model);
  assert.deepEqual(lost, [], `lotes sem estrada até o Lobby: ${lost.join(', ')}`);
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

test('natureza variada: vários tipos de árvore, coqueiros na praia, montanhas altas e colinas', () => {
  const trunks = (m) => count((p) => p.name === 'Tronco' && p.model === `Vegetação/${m}`);
  const kinds = [
    'Carvalhos',
    'Pinheiros',
    'Bétulas',
    'Cerejeiras',
    'Árvores Redondas',
    'Bosque de Outono',
    'Coqueiros',
  ];
  for (const k of kinds) assert.ok(trunks(k) >= 5, `só ${trunks(k)} árvores em ${k}`);
  assert.ok(count((p) => p.name === 'Tronco' && p.model.startsWith('Vegetação/')) >= 350, 'poucas árvores');
  assert.ok(landmarks.mountains.length >= 6, `só ${landmarks.mountains.length} montanhas`);
  assert.ok(Math.max(...landmarks.mountains.map((m) => m[2])) >= 50, 'montanhas baixas demais');
  assert.ok(landmarks.hills.length >= 4, `só ${landmarks.hills.length} colinas`);
  // montanhas naturais: cada uma tem vários blocos por camada, nunca uma caixa só
  for (const m of new Set(parts.filter((p) => p.model.startsWith('Relevo/Montanha')).map((p) => p.model))) {
    assert.ok(count((p) => p.model === m && p.name === 'Rocha') >= 8, `${m} parece uma caixa`);
  }
  assert.ok(count((p) => p.model === 'Relevo/Pedras') >= 60, 'poucas pedras soltas');
  assert.ok(count((p) => p.model === 'Vegetação/Flores') >= 30, 'poucas flores');
});

test('vida no reino: vilas com casas, campos, jazidas, torres de vigia, acampamentos e cais', () => {
  assert.ok(landmarks.villages.length >= 2, `só ${landmarks.villages.length} vilas`);
  for (const [, , n] of landmarks.villages) assert.ok(n >= 4, `vila com só ${n} construções`);
  assert.ok(count((p) => p.model.startsWith('Vila/') && p.model.includes('/Casa')) > 0, 'vilas sem casas');
  // vila como cidade: rua de pedra, praça com poço, largo e casas com calçada até a rua
  landmarks.villages.forEach((_, i) => {
    const V = `Vila/Vila ${i + 1}`;
    const inV = (p) => p.model.startsWith(`${V}/`);
    for (const n of ['Rua da Vila', 'Praça da Vila', 'Largo da Vila']) {
      assert.ok(parts.some((p) => inV(p) && p.name === n), `${V} sem "${n}"`);
    }
    assert.ok(count((p) => inV(p) && p.name === 'Calçada') >= 3, `${V}: casas sem calçada até a rua`);
    assert.ok(count((p) => inV(p) && p.name === 'Cerca') >= 3, `${V}: quintais sem cerca`);
  });
  assert.ok(landmarks.groundCover >= 900, `pouco mato e pedrinhas no chão (${landmarks.groundCover})`);
  assert.ok(landmarks.outcrops.length >= 8, `só ${landmarks.outcrops.length} afloramentos de rocha`);
  assert.ok(landmarks.farms.length >= 4, `só ${landmarks.farms.length} campos de trigo`);
  const mines = (k) => landmarks.mines.filter((m) => m[2] === k).length;
  assert.ok(mines('ouro') >= 2 && mines('pedra') >= 2, `jazidas: ${mines('ouro')} de ouro, ${mines('pedra')} de pedra`);
  assert.ok(landmarks.towers.length >= 2, `só ${landmarks.towers.length} torres de vigia`);
  assert.ok(landmarks.camps.length >= 1, 'nenhum acampamento');
  assert.ok(landmarks.docks.length >= 1, 'nenhum cais na praia');
});

test('trilhas ligam cada lugar à malha de estradas (nada solto no meio do mato)', () => {
  const net = parts.filter(
    (p) =>
      p.model === 'Estradas' ||
      p.model === 'Trilhas' ||
      (p.model.startsWith('Pontes/') && p.name === 'Tabuleiro') ||
      ['Base do Lobby', 'Piso do Lobby', 'Degrau do Lobby'].includes(p.name),
  );
  const bx = net.map(aabb);
  const parent = net.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const touch = (a, b) => [0, 1, 2].every((k) => a.min[k] <= b.max[k] + 0.01 && b.min[k] <= a.max[k] + 0.01);
  for (let i = 0; i < net.length; i++) {
    for (let j = i + 1; j < net.length; j++) if (touch(bx[i], bx[j])) parent[find(i)] = find(j);
  }
  const lobby = find(net.findIndex((p) => p.name === 'Piso do Lobby'));
  const loose = net.filter((p, i) => p.model === 'Trilhas' && find(i) !== lobby);
  assert.deepEqual(
    loose.map((p) => p.position.join(',')),
    [],
    'trilhas soltas',
  );
  const places = ['villages', 'farms', 'mines', 'towers', 'camps'].reduce((n, k) => n + landmarks[k].length, 0);
  assert.equal(landmarks.trails, places, 'cada vila, campo, jazida, torre e acampamento tem a sua trilha');
});

test('estradas não atravessam outros lotes', () => {
  for (const p of parts.filter((x) => x.model === 'Estradas')) {
    const { min, max } = aabb(p);
    const crossed = PLOTS.filter((q) => {
      const h = DIM.plotSize / 2;
      // a estrada entra no próprio lote (até o centro); atravessar um lote de ponta a ponta é proibido
      return min[0] < q.x - h && max[0] > q.x + h && min[2] < q.z + h && max[2] > q.z - h;
    }).concat(
      PLOTS.filter((q) => {
        const h = DIM.plotSize / 2;
        return min[2] < q.z - h && max[2] > q.z + h && min[0] < q.x + h && max[0] > q.x - h;
      }),
    );
    assert.deepEqual(
      crossed.map((q) => q.name),
      [],
      `Estrada @ [${p.position}] atravessa lote`,
    );
  }
});

test('Lobby elevado: 4 escadarias de degraus de 1 stud até o piso, com mureta na borda', () => {
  const top = (p) => p.position[1] + p.size[1] / 2;
  for (const side of ['Leste', 'Oeste', 'Sul', 'Norte']) {
    const m = `Lobby/Escadaria ${side}`;
    const steps = parts.filter((p) => p.model === m && p.name === 'Degrau do Lobby').sort((a, b) => top(a) - top(b));
    assert.equal(steps.length, DIM.lobbyRise, `${m}: ${steps.length} degraus`);
    let prev = DIM.land;
    for (const s of steps) {
      assert.ok(top(s) - prev <= 1 + 1e-9, `${m}: degrau sobe ${(top(s) - prev).toFixed(2)} studs`);
      prev = top(s);
    }
    assert.equal(prev, PLAZA.top, `${m}: a escada não chega ao piso do Lobby`);
    assert.equal(parts.filter((p) => p.model === m && p.name === 'Corrimão').length, 2, `${m}: sem corrimão`);
  }
  assert.ok(count((p) => p.name === 'Mureta') >= 8, 'mureta na borda do Lobby');
});

test('Lobby vivo como nas referências: mercado com toldos, caixotes, canteiros e colunas antigas', () => {
  const models = (prefix) => new Set(parts.filter((p) => p.model.startsWith(prefix)).map((p) => p.model)).size;
  assert.equal(models('Lobby/Barraca '), 4, 'mercado com 4 barracas');
  assert.ok(models('Lobby/Caixotes ') >= 4, 'caixotes do mercado');
  assert.ok(models('Lobby/Canteiro ') >= 4, 'canteiros de flores');
  assert.ok(models('Lobby/Coluna Antiga ') >= 6, 'colunas antigas');
  for (let n = 1; n <= 4; n++) {
    const names = new Set(parts.filter((p) => p.model === `Lobby/Barraca ${n}`).map((p) => p.name));
    for (const k of ['Balcão', 'Tampo do Balcão', 'Poste da Barraca', 'Toldo', 'Franja']) {
      assert.ok(names.has(k), `Barraca ${n} sem "${k}"`);
    }
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
