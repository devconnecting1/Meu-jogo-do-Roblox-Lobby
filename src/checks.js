// Verificações geométricas usadas pelos testes (tests/*.test.mjs).
// Todas são funções puras: recebem Parts e devolvem uma lista de problemas legíveis.

import { aabb } from './builder.js';

const EPS = 0.01;
const label = (p) => `${p.model}/${p.name} @ [${p.position.join(', ')}]`;
const boxes = (parts) => parts.map((p) => ({ p, ...aabb(p) }));

/** Intersecção estrita (volume > 0) entre caixa e AABB. */
export function intersects(a, b, eps = EPS) {
  return [0, 1, 2].every((i) => a.min[i] < b.max[i] - eps && b.min[i] < a.max[i] - eps);
}

/** Toque ou intersecção (para o grafo de apoio). */
function touches(a, b, eps = EPS) {
  return [0, 1, 2].every((i) => a.min[i] <= b.max[i] + eps && b.min[i] <= a.max[i] + eps);
}

/**
 * "Nada flutua": todas as Parts precisam estar ligadas (por toque/encaixe) à Part raiz.
 * Retorna as Parts soltas.
 */
export function findFloating(parts, rootName = 'Mar') {
  const bx = boxes(parts);
  const order = bx.map((_, i) => i).sort((a, b) => bx[a].min[0] - bx[b].min[0]);
  const parent = bx.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let oi = 0; oi < order.length; oi++) {
    const i = order[oi];
    for (let oj = oi + 1; oj < order.length; oj++) {
      const j = order[oj];
      if (bx[j].min[0] > bx[i].max[0] + EPS) break;
      if (touches(bx[i], bx[j])) parent[find(i)] = find(j);
    }
  }
  const rootIdx = bx.findIndex((b) => b.p.name === rootName);
  if (rootIdx < 0) return [`Parte raiz "${rootName}" não encontrada`];
  const r = find(rootIdx);
  return bx.filter((_, i) => find(i) !== r).map((b) => `Flutuando: ${label(b.p)}`);
}

/** Chave visual: duas faces com a mesma chave no mesmo plano não geram artefato visível. */
const visualKey = (p) => `${p.color.join(',')}|${p.material}|${p.transparency}`;

function faces(parts) {
  const out = [];
  parts.forEach((p, idx) => {
    if (p.rotation) return; // peças giradas (tampos cilíndricos) ficam fora desta checagem
    const { min, max } = aabb(p);
    for (let a = 0; a < 3; a++) {
      const [u, v] = [0, 1, 2].filter((k) => k !== a);
      for (const s of [-1, 1]) {
        out.push({
          idx,
          p,
          a,
          s,
          d: s < 0 ? min[a] : max[a],
          r: [min[u], max[u], min[v], max[v]],
        });
      }
    }
  });
  return out;
}

const key = (a, s, d) => `${a}|${s}|${Math.round(d * 1000)}`;
const overlapRect = (r1, r2) => {
  const r = [Math.max(r1[0], r2[0]), Math.min(r1[1], r2[1]), Math.max(r1[2], r2[2]), Math.min(r1[3], r2[3])];
  return r[1] - r[0] > EPS && r[3] - r[2] > EPS ? r : null;
};
const contains = (outer, inner) =>
  outer[0] <= inner[0] + EPS && outer[1] >= inner[1] - EPS && outer[2] <= inner[2] + EPS && outer[3] >= inner[3] - EPS;

/**
 * Z-fighting: duas faces no mesmo plano, mesma direção, área sobreposta e aparência diferente.
 * Ignora quando a região fica escondida (encostada numa face oposta opaca, ou enterrada
 * dentro de outra Part opaca).
 */
export function findZFighting(parts) {
  const fs = faces(parts);
  const buckets = new Map();
  for (const f of fs) {
    const k = key(f.a, f.s, f.d);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(f);
  }
  const bx = boxes(parts);
  const hidden = (f, rect, ignore) => {
    for (const o of buckets.get(key(f.a, -f.s, f.d)) ?? []) {
      if (o.p.transparency === 0 && !ignore.has(o.idx) && contains(o.r, rect)) return true;
    }
    const [u, v] = [0, 1, 2].filter((k) => k !== f.a);
    return bx.some((b, i) => {
      if (ignore.has(i) || b.p.transparency !== 0 || b.p.rotation) return false;
      return (
        b.min[f.a] < f.d - EPS && b.max[f.a] > f.d + EPS && contains([b.min[u], b.max[u], b.min[v], b.max[v]], rect)
      );
    });
  };
  const problems = [];
  for (const list of buckets.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const f1 = list[i],
          f2 = list[j];
        if (f1.idx === f2.idx || visualKey(f1.p) === visualKey(f2.p)) continue;
        const rect = overlapRect(f1.r, f2.r);
        if (!rect) continue;
        if (hidden(f1, rect, new Set([f1.idx, f2.idx]))) continue;
        const axis = 'XYZ'[f1.a];
        problems.push(
          `Z-fighting em ${axis}=${f1.d} (${f1.s > 0 ? '+' : '-'}${axis}): ${label(f1.p)}  ×  ${label(f2.p)}`,
        );
      }
    }
  }
  return problems;
}

/** Nenhuma Part com colisão pode invadir as zonas de passagem do jogador. */
export function findClearanceViolations(parts, zones) {
  const solid = boxes(parts.filter((p) => p.canCollide));
  const problems = [];
  for (const z of zones) {
    for (const b of solid) {
      if (intersects(z, b)) problems.push(`Bloqueia "${z.name}": ${label(b.p)}`);
    }
  }
  return problems;
}

/** Amostra bordas com queda: cada ponto precisa estar dentro de alguma Part com colisão. */
export function findEdgeGaps(parts, edges, step = 0.25, height = 1.5) {
  const solid = boxes(parts.filter((p) => p.canCollide));
  const problems = [];
  for (const e of edges) {
    let gapStart = null;
    const flush = (t) => {
      if (gapStart !== null)
        problems.push(`Sem guarda-corpo em "${e.name}" de ${gapStart.toFixed(2)} a ${t.toFixed(2)}`);
      gapStart = null;
    };
    for (let t = e.from; t <= e.to + 1e-9; t += step) {
      const open = e.openings.some(([a, b]) => t >= a - EPS && t <= b + EPS);
      const pt = e.axis === 'x' ? [t, e.y + height, e.at] : [e.at, e.y + height, t];
      const covered =
        open || solid.some((b) => [0, 1, 2].every((i) => pt[i] >= b.min[i] - EPS && pt[i] <= b.max[i] + EPS));
      if (covered) flush(t);
      else if (gapStart === null) gapStart = t;
    }
    flush(e.to);
  }
  return problems;
}

/** Parts fora de uma caixa limite. */
export function findOutside(parts, bounds, eps = EPS) {
  return boxes(parts)
    .filter((b) => [0, 1, 2].some((i) => b.min[i] < bounds.min[i] - eps || b.max[i] > bounds.max[i] + eps))
    .map((b) => `Fora dos limites: ${label(b.p)}`);
}
