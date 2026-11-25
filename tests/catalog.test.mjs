// Catálogo de peças (src/catalog.js): toda peça reaproveitável de src/props/ tem a sua entrada,
// e o catálogo montado obedece às mesmas regras do mapa (apoio, z-fighting, paleta, colisão).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { aabb } from '../src/builder.js';
import { findFloating, findZFighting, intersects } from '../src/checks.js';
import { C } from '../src/palette.js';
import { CATALOG, GROUPS, buildCatalog } from '../src/catalog.js';
import { TREE_KINDS } from '../src/props/trees.js';
import { BUILDINGS } from '../src/props/buildings.js';
import { SHOPS } from '../src/props/lobby.js';

const PROPS_DIR = new URL('../src/props/', import.meta.url);
// funções exportadas que não montam peça (só ajudam a posicionar)
const HELPERS = new Set(['footprint', 'shopFootprint', 'localFrame']);
// funções que recebem um tipo: cada tipo precisa de exatamente uma entrada
const KINDS = { plantTree: TREE_KINDS, building: Object.keys(BUILDINGS), shop: Object.keys(SHOPS) };

const PALETTE = new Set(Object.values(C).map((c) => c.join(',')));
const BANNED = /npc|dummy|humanoid|gui|decal|texture|script/i;
const label = (p) => `${p.model}/${p.name} @ [${p.position.join(', ')}]`;
const report = (problems, max = 40) =>
  problems.length
    ? `\n${problems.slice(0, max).join('\n')}${problems.length > max ? `\n… +${problems.length - max}` : ''}`
    : '';
const tilted = (p) => p.rotation && (p.rotation[0] % 360 !== 0 || p.rotation[2] % 360 !== 0);

const { parts, entries } = buildCatalog();
const own = (e) => parts.slice(e.range[0], e.range[1]);
const boxOf = (e) => ({
  min: e.center.map((c, i) => c - e.size[i] / 2),
  max: e.center.map((c, i) => c + e.size[i] / 2),
});

test('catálogo cobre toda peça exportada em src/props/ (exatamente uma entrada por tipo)', async () => {
  const files = readdirSync(PROPS_DIR)
    .filter((f) => f.endsWith('.js'))
    .sort();
  assert.ok(files.length >= 3, `só ${files.length} módulos em src/props/`);
  const problems = [];
  const exported = new Set();
  for (const f of files) {
    const mod = await import(new URL(f, PROPS_DIR).href);
    for (const [name, value] of Object.entries(mod)) {
      if (typeof value !== 'function' || HELPERS.has(name)) continue;
      exported.add(name);
      const list = CATALOG.filter((e) => e.prop === name);
      const kinds = KINDS[name];
      if (kinds) {
        for (const k of kinds) {
          const n = list.filter((e) => e.kind === k).length;
          if (n !== 1) problems.push(`src/props/${f}: ${name}('${k}') tem ${n} entradas no catálogo`);
        }
        for (const e of list) if (!kinds.includes(e.kind)) problems.push(`${e.id}: tipo "${e.kind}" não existe`);
      } else if (list.length !== 1) {
        problems.push(`src/props/${f}: ${name} tem ${list.length} entradas no catálogo (esperado 1)`);
      }
    }
  }
  for (const e of CATALOG)
    if (!exported.has(e.prop)) problems.push(`${e.id}: "${e.prop}" não é exportada por src/props/`);
  assert.deepEqual(problems, []);
});

test('tipos conhecidos: estátua, 8 árvores, arbusto, canteiro, construções e peças do Lobby', () => {
  const count = (prop, kind = null) => CATALOG.filter((e) => e.prop === prop && e.kind === kind).length;
  assert.equal(count('fountainStatue'), 1, 'fonte');
  assert.equal(count('bush'), 1, 'arbusto');
  assert.equal(count('flowerPatch'), 1, 'canteiro');
  for (const k of TREE_KINDS) assert.equal(count('plantTree', k), 1, `árvore ${k}`);
  for (const k of Object.keys(BUILDINGS)) assert.equal(count('building', k), 1, `construção ${k}`);
  for (const k of Object.keys(SHOPS)) assert.equal(count('shop', k), 1, `loja ${k}`);
  for (const p of ['bench', 'planter', 'archGate', 'lampPost']) assert.equal(count(p), 1, p);
});

test('ids únicos (usados nos nomes das imagens), títulos e grupos válidos', () => {
  const ids = CATALOG.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'id repetido');
  for (const e of CATALOG) {
    assert.match(e.id, /^[a-z0-9-]+$/, `id inválido: ${e.id}`);
    assert.notEqual(e.id, 'todos', 'o id "todos" é a vista geral');
    assert.ok(e.title && e.title.length > 2, `${e.id}: sem título`);
    assert.ok(GROUPS.includes(e.group), `${e.id}: grupo ${e.group}`);
    assert.equal(typeof e.build, 'function', `${e.id}: sem build`);
  }
});

test('toda entrada monta pelo menos 1 peça e o resumo bate com as Parts', () => {
  assert.equal(entries.length, CATALOG.length);
  for (const e of entries) {
    const list = own(e);
    assert.ok(list.length >= 1, `${e.id}: nenhuma peça`);
    assert.equal(e.parts, list.length, `${e.id}: contagem de peças`);
    assert.equal(e.collidable, list.filter((p) => p.canCollide).length, `${e.id}: contagem de colisão`);
    assert.equal(parts[e.pad].name, 'Chão', `${e.id}: chão fora do lugar`);
    for (const p of list) assert.ok(p.model.startsWith(`Catálogo/${e.id}`), `${e.id}: ${label(p)} em outro modelo`);
  }
});

test('nada flutua: cada peça se apoia no seu próprio chão', () => {
  const out = [];
  for (const e of entries) {
    for (const m of findFloating([parts[e.pad], ...own(e)], 'Chão')) out.push(`[${e.id}] ${m}`);
  }
  assert.equal(out.length, 0, report(out));
});

test('sem z-fighting no catálogo inteiro', () => {
  const out = findZFighting(parts);
  assert.equal(out.length, 0, report(out));
});

test('só cores da paleta, medidas >= 0,04, nomes permitidos e studs fora da água', () => {
  const out = [];
  for (const p of parts) {
    if (!PALETTE.has(p.color.join(','))) out.push(`cor fora da paleta ${p.color}: ${label(p)}`);
    if (p.size.some((s) => !(s >= 0.04))) out.push(`tamanho ${p.size}: ${label(p)}`);
    if (BANNED.test(`${p.model}/${p.name}`)) out.push(`nome proibido: ${label(p)}`);
    if (p.studs !== (p.material === 'Plastic')) out.push(`studs = ${p.studs} em ${p.material}: ${label(p)}`);
  }
  assert.equal(out.length, 0, report(out));
});

test('peça inclinada (giro em X ou Z) nunca colide', () => {
  const out = parts.filter((p) => tilted(p) && p.canCollide).map((p) => `inclinada com colisão: ${label(p)}`);
  assert.equal(out.length, 0, report(out));
});

test('as peças e os chãos não se sobrepõem, e cada peça cabe no seu chão', () => {
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    const pa = aabb(parts[a.pad]);
    const ba = boxOf(a);
    if (ba.min[0] < pa.min[0] || ba.max[0] > pa.max[0] || ba.min[2] < pa.min[2] || ba.max[2] > pa.max[2])
      out.push(`${a.id} passa da borda do chão`);
    for (let j = i + 1; j < entries.length; j++) {
      const c = entries[j];
      if (intersects(ba, boxOf(c))) out.push(`${a.id} × ${c.id}: peças sobrepostas`);
      if (intersects(pa, aabb(parts[c.pad]))) out.push(`${a.id} × ${c.id}: chãos sobrepostos`);
    }
  }
  assert.deepEqual(out, []);
});

test('determinístico: duas montagens geram exatamente o mesmo catálogo', () => {
  assert.deepEqual(buildCatalog(), buildCatalog());
});
