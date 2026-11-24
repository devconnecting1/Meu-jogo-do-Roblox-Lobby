// Prisão abandonada: luz de terror que ainda deixa ver, estragos que fazem sentido,
// nada aberto para fora e salas novas no túnel de acesso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrison } from '../src/prison.js';

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
