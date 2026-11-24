// Manual de montagem passo a passo (inspirado em "builds that hold together"):
// ordena as Parts em etapas físicas, garante que cada peça encosta no que já foi
// montado e conta os pontos de conexão (contatos entre peças).

import { aabb } from './builder.js';

const EPS = 0.01;
const MAX_PER_STEP = 8;

/** Fases na ordem real de obra. A primeira regra que casar define a fase. */
export const PHASES = [
  { id: 'base', title: 'Mar (base de tudo)', match: (p) => p.name === 'Mar' },
  { id: 'terreno', title: 'Terreno: terra, grama, areia, rio e lago', match: (p) => p.model === 'Terreno' },
  { id: 'praca', title: 'Praça do Reino e estátua do rei', match: (p) => p.model === 'Praça do Reino' },
  { id: 'estradas', title: 'Estradas de pedra', match: (p) => p.model === 'Estradas' },
  { id: 'pontes', title: 'Pontes de madeira', match: (p) => p.model.startsWith('Pontes') },
  { id: 'lotes', title: 'Lotes dos castelos (30)', match: (p) => p.model.startsWith('Lotes') },
  { id: 'relevo', title: 'Planaltos de rocha', match: (p) => p.model.startsWith('Relevo/Planalto') },
  { id: 'recursos', title: 'Recursos: trigo, ouro e pedra', match: (p) => p.model.startsWith('Recursos') },
  { id: 'costa', title: 'Cais e barcos', match: (p) => p.model.startsWith('Costa') },
  { id: 'natureza', title: 'Florestas, arbustos e pedras', match: () => true },
];

const touches = (a, b) => [0, 1, 2].every((i) => a.min[i] <= b.max[i] + EPS && b.min[i] <= a.max[i] + EPS);

/** Quantidade de pares de peças em contato (pontos de conexão). */
export function countConnections(parts) {
  const bx = parts.map(aabb);
  const order = bx.map((_, i) => i).sort((a, b) => bx[a].min[0] - bx[b].min[0]);
  let n = 0;
  for (let oi = 0; oi < order.length; oi++) {
    const a = bx[order[oi]];
    for (let oj = oi + 1; oj < order.length; oj++) {
      const b = bx[order[oj]];
      if (b.min[0] > a.max[0] + EPS) break;
      if (touches(a, b)) n++;
    }
  }
  return n;
}

/**
 * Gera o manual. Dentro de cada fase, as peças entram em "ondas": só entra a peça que
 * encosta em algo já montado (busca em largura). Peças que nunca encostam viram problemas.
 * Etapas = até 8 peças consecutivas da mesma submontagem (modelo).
 */
export function buildManual(parts) {
  const items = parts.map((p, i) => ({ p, i, box: aabb(p), phase: PHASES.findIndex((ph) => ph.match(p)) }));
  const placed = [];
  const order = [];
  const problems = [];

  for (let ph = 0; ph < PHASES.length; ph++) {
    let remaining = items.filter((x) => x.phase === ph);
    if (!remaining.length) continue;
    if (!placed.length) {
      // a primeira peça da obra é a base (o mar)
      const first = remaining.shift();
      placed.push(first);
      order.push(first);
    }
    let frontier = placed.slice();
    while (remaining.length) {
      const wave = remaining.filter((x) => frontier.some((y) => touches(x.box, y.box)));
      if (!wave.length) break;
      const inWave = new Set(wave);
      remaining = remaining.filter((x) => !inWave.has(x));
      // dentro da onda: por modelo, de baixo para cima
      wave.sort((a, b) => a.p.model.localeCompare(b.p.model) || a.box.min[1] - b.box.min[1] || a.i - b.i);
      placed.push(...wave);
      order.push(...wave);
      frontier = wave;
    }
    for (const x of remaining) {
      problems.push(`Fase "${PHASES[ph].title}": ${x.p.model}/${x.p.name} não se apoia em nada montado antes`);
    }
  }

  const steps = [];
  for (const x of order) {
    const last = steps[steps.length - 1];
    const phase = PHASES[x.phase];
    if (last && last.model === x.p.model && last.phase === phase.id && last.parts.length < MAX_PER_STEP) {
      last.parts.push(x.i);
      last.names.push(x.p.name);
    } else {
      steps.push({
        n: steps.length + 1,
        phase: phase.id,
        phaseTitle: phase.title,
        model: x.p.model,
        parts: [x.i],
        names: [x.p.name],
      });
    }
  }

  return {
    parts: parts.length,
    steps,
    phases: PHASES.map(({ id, title }) => ({ id, title })),
    connections: countConnections(parts),
    problems,
  };
}

/** Texto do manual (markdown) para o CI publicar. */
export function manualMarkdown(manual) {
  const lines = [
    '# Manual de montagem do Reino',
    '',
    `**${manual.parts} peças · ${manual.steps.length} etapas · ${manual.connections} pontos de conexão verificados**`,
  ];
  let phase = null;
  for (const s of manual.steps) {
    if (s.phase !== phase) {
      phase = s.phase;
      lines.push('', `## ${s.phaseTitle}`, '');
    }
    const counts = {};
    for (const n of s.names) counts[n] = (counts[n] || 0) + 1;
    const desc = Object.entries(counts)
      .map(([n, c]) => (c > 1 ? `${c}× ${n}` : n))
      .join(', ');
    lines.push(`${s.n}. **${s.model}** — ${desc}`);
  }
  return lines.join('\n') + '\n';
}
