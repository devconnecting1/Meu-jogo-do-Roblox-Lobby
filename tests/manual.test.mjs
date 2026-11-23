// Manual de montagem: toda peça entra numa etapa e se apoia no que já foi montado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrison } from '../src/prison.js';
import { buildManual, manualMarkdown } from '../src/manual.js';

const { parts } = buildPrison();
const manual = buildManual(parts);

test('montagem possível: cada peça encosta no que já foi montado antes dela', () => {
  assert.equal(manual.problems.length, 0, '\n' + manual.problems.slice(0, 40).join('\n'));
});

test('toda peça aparece exatamente uma vez no manual', () => {
  const seen = manual.steps.flatMap((s) => s.parts).sort((a, b) => a - b);
  assert.deepEqual(
    seen,
    parts.map((_, i) => i),
  );
});

test('etapas com até 8 peças, numeradas em sequência', () => {
  manual.steps.forEach((s, i) => {
    assert.equal(s.n, i + 1);
    assert.ok(s.parts.length >= 1 && s.parts.length <= 8, `etapa ${s.n}: ${s.parts.length} peças`);
  });
});

test('fases na ordem de obra: laje primeiro, iluminação por último', () => {
  assert.equal(manual.steps[0].phase, 'base');
  assert.equal(manual.steps.at(-1).phase, 'luz');
  const order = manual.phases.map((p) => p.id);
  let last = -1;
  for (const s of manual.steps) {
    const idx = order.indexOf(s.phase);
    assert.ok(idx >= last, `etapa ${s.n} volta para a fase "${s.phase}"`);
    last = idx;
  }
});

test('conexões contadas e manual em texto', () => {
  assert.ok(manual.connections > parts.length, `${manual.connections} conexões para ${parts.length} peças`);
  const md = manualMarkdown(manual);
  assert.match(md, /peças · \d+ etapas · \d+ pontos de conexão verificados/);
});
