// Prisão abandonada: luz de terror que ainda deixa ver, estragos que fazem sentido,
// nada aberto para fora e salas novas no túnel de acesso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrison, WRECKED_CELLS, CLOSED_CELLS } from '../src/prison.js';

const { parts } = buildPrison();

test('luz de terror: parte das lâmpadas queimada e algumas piscando, mas nenhuma sala no escuro total', () => {
  const lamps = parts.filter((p) => ['Tubo', 'Painel'].includes(p.name));
  const dead = lamps.filter((p) => p.material === 'Plastic');
  const ratio = dead.length / lamps.length;
  assert.ok(ratio >= 0.15 && ratio <= 0.45, `${(ratio * 100).toFixed(0)}% das lâmpadas queimadas (15% a 45%)`);
  for (const p of dead) assert.equal(p.light, null, `${p.model}/${p.name}: lâmpada queimada não ilumina`);
  const flicker = parts.filter((p) => p.light?.flicker);
  assert.ok(flicker.length >= 6 && flicker.length <= 16, `${flicker.length} luzes piscando (6 a 16)`);
  // cada sala fechada continua com pelo menos uma luz acesa (mesmo que piscando)
  const rooms = new Set(parts.filter((p) => p.name === 'Painel').map((p) => p.model));
  for (const m of rooms) {
    if (/^Celas\//.test(m)) continue; // celas: 1 em cada 3 apagada, de propósito
    if (/^Iluminação\//.test(m)) continue; // grupos de luminárias de salas grandes
    assert.ok(
      parts.some((p) => p.model === m && p.light),
      `${m} ficou sem nenhuma luz acesa`,
    );
  }
});

test('estragos com sentido: colunas rachadas, rombo numa parede interna e entulho no chão', () => {
  assert.equal(parts.filter((p) => p.name === 'Núcleo Exposto').length, 2, 'duas colunas rachadas');
  const chunks = parts.filter((p) => p.name === 'Pedaço de Parede');
  assert.ok(chunks.length >= 5, 'rombo com bordas irregulares');
  for (const p of chunks) assert.ok(!p.model.startsWith('Envoltória'), 'o rombo não pode abrir a envoltória');
  assert.ok(parts.filter((p) => p.name === 'Entulho').length >= 40, 'entulho espalhado');
  for (const p of parts.filter((x) => x.name === 'Entulho' || x.name === 'Mancha' || x.name === 'Poça')) {
    assert.equal(p.canCollide, false, `${p.model}/${p.name}: decoração de abandono não colide`);
  }
});

test('destruição de verdade: coluna desabada com o topo partido e o fuste caído no chão', () => {
  assert.equal(parts.filter((p) => p.name === 'Toco da Coluna').length, 1, 'toco da coluna desabada');
  assert.equal(parts.filter((p) => p.name === 'Coluna Partida (topo)').length, 1, 'topo partido preso na viga');
  const fallen = parts.filter((p) => p.name === 'Coluna Caída');
  assert.ok(fallen.length >= 3, 'fuste caído em pedaços');
  for (const p of fallen) assert.ok(p.position[1] - p.size[1] / 2 <= 0.001, `${p.name} está no chão`);
});

test('celas destruídas e celas trancadas', () => {
  const cellOf = (n) => `Celas/Cela ${String(n).padStart(2, '0')}`;
  for (const n of WRECKED_CELLS) {
    const names = parts.filter((p) => p.model === cellOf(n)).map((p) => p.name);
    assert.ok(names.includes('Caco de Vidro'), `cela ${n}: janela estilhaçada`);
    const door = parts.find((p) => p.model === cellOf(n) && p.name === 'Porta Topo');
    assert.ok(door.size[1] < 0.5, `cela ${n}: porta arrancada, deitada no chão`);
  }
  assert.ok(WRECKED_CELLS.length >= 3 && CLOSED_CELLS.length >= 3);
  for (const n of CLOSED_CELLS) {
    const bars = parts.filter((p) => p.model === cellOf(n) && p.name === 'Porta Barra');
    assert.ok(bars.length >= 4 && bars.every((p) => p.canCollide), `cela ${n}: grade fechada com colisão`);
    assert.ok(
      parts.some((p) => p.model === cellOf(n) && p.name === 'Cadeado'),
      `cela ${n}: trancada com cadeado`,
    );
  }
});

test('salas novas do túnel: triagem, revista, casa de máquinas e solitária, com porta e luz', () => {
  for (const n of ['Triagem', 'Revista', 'Casa de Máquinas', 'Solitária']) {
    const room = parts.filter((p) => p.model === `Túnel/${n}`);
    assert.ok(room.length > 3, `falta a sala ${n}`);
    assert.ok(
      room.some((p) => p.light),
      `${n} sem luz`,
    );
  }
  const doors = parts.filter((p) => p.model === 'Túnel/Envoltória' && p.name === 'Batente Topo');
  assert.equal(doors.length, 4, 'uma porta para cada sala lateral das eclusas');
});

test('a destruição conta uma história: rebelião, desabamento, fuga e anos de abandono', () => {
  const has = (model, name) => parts.some((p) => p.model === model && p.name === name);
  // rebelião
  assert.ok(has('Ruínas/Barricada', 'Mesa Virada'), 'barricada no hall');
  assert.ok(has('Ruínas/Incêndio', 'Fuligem no Teto'), 'sala dos guardas incendiada');
  assert.ok(has('Ruínas/Controle', 'Monitor Quebrado'), 'sala de controle invadida');
  // desabamento: telhado caído com pedaços no chão e trepadeiras entrando pelo rombo
  assert.ok(parts.filter((p) => p.name === 'Laje Caída').length >= 2, 'lajes caídas no átrio');
  assert.ok(has('Estrutura/Teto', 'Viga Partida'), 'viga partida na borda do rombo');
  assert.ok(parts.filter((p) => p.name === 'Trepadeira').length >= 6, 'trepadeiras pendendo do rombo');
  // fuga: corda de lençóis do chão até o rombo e túnel cavado numa cela
  const rope = parts.filter((p) => p.model === 'Ruínas/Fuga' && p.name === 'Lençol Amarrado');
  const top = Math.max(...rope.map((p) => p.position[1] + p.size[1] / 2));
  assert.ok(rope.length >= 20 && top >= 44 - 1e-6, 'corda de lençóis chega ao teto');
  assert.ok(has('Ruínas/Cela 17', 'Buraco Cavado'), 'túnel cavado na cela 17');
  // terremoto
  assert.ok(parts.filter((p) => p.name === 'Rachadura').length >= 8, 'rachadura no piso do átrio');
});
