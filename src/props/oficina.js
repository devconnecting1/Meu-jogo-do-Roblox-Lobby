// Oficina das construções do Vale: o que os prédios do Lobby (lojas.js) e os castelos (castelos.js)
// têm em comum.
//
// Tudo é desenhado numa grade local de 1 stud (a planta de `PLANS` rasterizada), no referencial da
// construção (frame.js: u = lado, v = frente/fundo com a frente em +v, y = altura a partir do chão):
//   * Mask: grade de células de 1×1 stud (ocupada ou não), com anel, erosão e fusão em retângulos;
//   * buildShell: piso, paredes em camadas (base de pedra, janelas acesas, porta com verga), telhado
//     em degraus (a planta encolhida camada a camada, como pixel art) e a zona de passagem da porta;
//   * makeKit: móveis e enfeites com checagem: só entram se ficam sobre o piso livre e, quando têm
//     colisão, fora das zonas de passagem. O que não cabe é pulado e contado em `kit.skipped`.
//
// Regras que evitam z-fighting (AGENTS.md 6.1): paredes, pisos e telhados ficam em coordenadas
// inteiras da grade; móveis sempre em coordenadas "quebradas" (x,1 a x,9), nunca no plano de uma
// parede; peças de cores diferentes que se encostam só se tocam por faces opostas.

/** Grade de células de 1 stud: célula (i, j) cobre u ∈ [u0+i, u0+i+1] e v ∈ [v0+j, v0+j+1]. */
export class Mask {
  constructor(u0, v0, w, h, data = null) {
    this.u0 = u0;
    this.v0 = v0;
    this.w = w;
    this.h = h;
    this.d = data ?? new Uint8Array(w * h);
  }

  /** Grade com as células cujo centro satisfaz `pred(u, v)`. */
  static from(pred, u0, v0, u1, v1) {
    const m = new Mask(u0, v0, u1 - u0, v1 - v0);
    for (let j = 0; j < m.h; j++)
      for (let i = 0; i < m.w; i++) if (pred(u0 + i + 0.5, v0 + j + 0.5)) m.d[j * m.w + i] = 1;
    return m;
  }

  has(i, j) {
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.d[j * this.w + i] === 1;
  }

  /** A célula que contém o ponto (u, v) está ocupada? */
  at(u, v) {
    return this.has(Math.floor(u - this.u0), Math.floor(v - this.v0));
  }

  set(i, j, on = true) {
    if (i >= 0 && j >= 0 && i < this.w && j < this.h) this.d[j * this.w + i] = on ? 1 : 0;
  }

  /** Nova grade (mesmo tamanho) com as células em que `fn(i, j)` é verdade. */
  map(fn) {
    const m = new Mask(this.u0, this.v0, this.w, this.h);
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) if (fn(i, j)) m.d[j * this.w + i] = 1;
    return m;
  }

  clone() {
    return new Mask(this.u0, this.v0, this.w, this.h, this.d.slice());
  }

  or(o) {
    return this.map((i, j) => this.has(i, j) || o.has(i, j));
  }

  minus(o) {
    return this.map((i, j) => this.has(i, j) && !o.has(i, j));
  }

  and(o) {
    return this.map((i, j) => this.has(i, j) && o.has(i, j));
  }

  count() {
    let n = 0;
    for (const x of this.d) n += x;
    return n;
  }

  /** Células ocupadas com algum vizinho (8 direções) vazio: o anel das paredes. */
  ring() {
    return this.map((i, j) => {
      if (!this.has(i, j)) return false;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (!this.has(i + di, j + dj)) return true;
      return false;
    });
  }

  /** Encolhe 1 célula em todas as direções (erosão de Chebyshev). */
  erode1() {
    return this.map((i, j) => {
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (!this.has(i + di, j + dj)) return false;
      return true;
    });
  }

  /** Cobre as células ocupadas com retângulos (linha a linha, depois para baixo): [u0, v0, u1, v1]. */
  rects() {
    const used = new Uint8Array(this.w * this.h);
    const free = (i, j) => this.has(i, j) && !used[j * this.w + i];
    const out = [];
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        if (!free(i, j)) continue;
        let e = i;
        while (free(e + 1, j)) e++;
        let k = j;
        const rowFree = (jj) => {
          for (let ii = i; ii <= e; ii++) if (!free(ii, jj)) return false;
          return true;
        };
        while (rowFree(k + 1)) k++;
        for (let jj = j; jj <= k; jj++) for (let ii = i; ii <= e; ii++) used[jj * this.w + ii] = 1;
        out.push([this.u0 + i, this.v0 + j, this.u0 + e + 1, this.v0 + k + 1]);
      }
    }
    return out;
  }
}

/** A planta (`PLANS[x].parts`) como predicado local (u, v): retângulos e círculos. */
export const planPredicate = (parts) => (u, v) =>
  parts.some((q) =>
    Array.isArray(q) ? u > q[0] && u < q[2] && v > q[1] && v < q[3] : Math.hypot(u - q.c[0], v - q.c[1]) < q.r,
  );

/** Grade da planta numa caixa quadrada de meia-largura `half` (+1 de folga). */
export const planMask = (parts, half) => Mask.from(planPredicate(parts), -half - 1, -half - 1, half + 1, half + 1);

/** Retângulos da grade como peças (mesma cor, mesma altura). */
export function slabs(f, name, mask, y0, y1, color, opts) {
  for (const [a, b, c, d] of mask.rects()) f.span(name, [a, y0, b], [c, y1, d], color, opts);
}

/**
 * Abre a porta (largura `width`, centrada em u = du, na borda perto de v = dv): em cada coluna da
 * porta, tira do anel as células de parede da borda para dentro. Devolve as células abertas, o
 * sentido para dentro (`s`, −1 ou +1 em v) e onde a abertura termina por dentro (`inner`).
 */
export function carveDoor(occ, wall, du, dv, width) {
  const door = occ.map(() => false);
  const cols = [];
  for (let i = 0; i < occ.w; i++) if (Math.abs(occ.u0 + i + 0.5 - du) < width / 2) cols.push(i);
  const jd = Math.round(dv - occ.v0);
  let below = 0;
  let above = 0;
  for (const i of cols) {
    for (let k = 0; k < 4; k++) {
      if (occ.has(i, jd - 1 - k)) below++;
      if (occ.has(i, jd + k)) above++;
    }
  }
  const s = below >= above ? -1 : 1;
  let inner = dv;
  for (const i of cols) {
    let j = s < 0 ? jd + 5 : jd - 6;
    let started = false;
    for (let t = 0; t < 18; t++, j += s) {
      if (!occ.has(i, j)) {
        if (started) break;
        continue;
      }
      if (!wall.has(i, j)) break;
      wall.set(i, j, false);
      door.set(i, j, true);
      started = true;
      const v = occ.v0 + j + (s < 0 ? 0 : 1);
      inner = s < 0 ? Math.min(inner, v) : Math.max(inner, v);
    }
  }
  return { door, s, inner, du, dv, width };
}

/** Células de janela: trechos retos da parede, longe da porta, num ritmo de 2 abertas a cada `period`. */
function windowCells(occ, wall, door, period, phase) {
  const nearDoor = (i, j) => {
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (door.has(i + di, j + dj)) return true;
    return false;
  };
  const beat = (x) => ((((x + phase) % period) + period) % period) < 2;
  const interior = (i, j) => occ.has(i, j) && !wall.has(i, j) && !door.has(i, j);
  const across = wall.map((i, j) => {
    if (!wall.has(i, j) || nearDoor(i, j) || !wall.has(i - 1, j) || !wall.has(i + 1, j)) return false;
    const up = occ.has(i, j + 1);
    const dn = occ.has(i, j - 1);
    if (up === dn) return false;
    return interior(i, up ? j + 1 : j - 1) && beat(occ.u0 + i);
  });
  const along = wall.map((i, j) => {
    if (!wall.has(i, j) || nearDoor(i, j) || !wall.has(i, j - 1) || !wall.has(i, j + 1)) return false;
    const r = occ.has(i + 1, j);
    const l = occ.has(i - 1, j);
    if (r === l) return false;
    return interior(r ? i + 1 : i - 1, j) && beat(occ.v0 + j);
  });
  return { across, along };
}

/**
 * Casca de um prédio: piso, paredes, porta, janelas e telhado. `o`:
 *   door [du, dv], doorW, doorH (y do alto da porta), H (alto da parede), floorTop, floor (cor ou
 *   false para não montar piso), floorExclude (células sem piso), floorName, base [yTopo, cor], wall (cor),
 *   windows { y0, y1, period, phase, color } ou null, roof { color, step, rise, max, trim } ou null,
 *   merlons { y1, color, skip(mask) } ou null, zoneDepth.
 * Devolve { wall, full, door, zone (local), fit (piso livre para móveis), roofTop, top (célula do topo) }.
 */
export function buildShell(f, occ, o) {
  const ring = occ.ring();
  const wall = ring.clone();
  const dr = carveDoor(occ, wall, o.door[0], o.door[1], o.doorW);
  const full = wall.or(dr.door);
  const floorTop = o.floorTop ?? 0.4;

  // piso (inclui a soleira da porta)
  if (o.floor !== false) {
    let floor = occ.minus(wall);
    if (o.floorExclude) floor = floor.minus(o.floorExclude);
    slabs(f, o.floorName ?? 'Piso', floor, 0, floorTop, o.floor);
  }

  // paredes em camadas: base de pedra, corpo, faixa das janelas, verga da porta
  const win = o.windows ? windowCells(occ, wall, dr.door, o.windows.period ?? 6, o.windows.phase ?? 0) : null;
  const winAll = win ? win.across.or(win.along) : null;
  const [baseTop, baseColor] = o.base;
  const cuts = [0, baseTop, o.doorH, o.H];
  if (win) cuts.push(o.windows.y0, o.windows.y1);
  const ys = [...new Set(cuts.filter((y) => y >= 0 && y <= o.H))].sort((a, b) => a - b);
  for (let k = 0; k + 1 < ys.length; k++) {
    const [y0, y1] = [ys[k], ys[k + 1]];
    let mask = y1 <= o.doorH + 1e-9 ? wall : full;
    if (win && y0 >= o.windows.y0 - 1e-9 && y1 <= o.windows.y1 + 1e-9) mask = mask.minus(winAll);
    const base = y1 <= baseTop + 1e-9;
    slabs(f, base ? 'Base da Parede' : 'Parede', mask, y0, y1, base ? baseColor : o.wall);
  }
  if (win) {
    const { y0, y1, color } = o.windows;
    for (const [a, b, c] of win.across.rects()) f.span('Janela', [a, y0, b + 0.4], [c, y1, b + 0.6], color);
    for (const [a, b, , d] of win.along.rects()) f.span('Janela', [a + 0.4, y0, b], [a + 0.6, y1, d], color);
  }

  // ameias (castelos): blocos alternados em cima do anel
  if (o.merlons) {
    const keep = full.map((i, j) => full.has(i, j) && Math.floor((full.u0 + i + full.v0 + j) / 2) % 2 === 0);
    const m = o.merlons.skip ? keep.minus(o.merlons.skip) : keep;
    slabs(f, 'Ameia', m, o.H, o.merlons.y1, o.merlons.color);
  }

  // telhado em degraus: a planta encolhida `step` células por camada
  let roofTop = o.H;
  let top = null;
  if (o.roof) {
    const { color, step = 2, rise = 1.2, max = 14, trim } = o.roof;
    let m = occ;
    for (let k = 0; k < max && m.count() > 0; k++) {
      const y0 = o.H + k * rise;
      slabs(f, 'Telhado', m, y0, y0 + rise, k === 0 && trim ? trim : color);
      roofTop = y0 + rise;
      top = m.rects()[0];
      for (let s = 0; s < step; s++) m = m.erode1();
    }
  }

  // zona de passagem: da frente da porta para dentro, na largura da porta (menos 0,2 de cada lado)
  const half = o.doorW / 2 - 0.2;
  const depth = o.zoneDepth ?? 5;
  const [va, vb] = dr.s < 0 ? [dr.inner - depth, dr.dv + 2] : [dr.dv - 2, dr.inner + depth];
  const zone = {
    min: [dr.du - half, floorTop + 0.05, va],
    max: [dr.du + half, o.doorH - 0.2, vb],
  };
  const fit = occ.minus(full);
  return { wall, full, door: dr, zone, fit, roofTop, top, floorTop };
}

/** A caixa local a (min) e c (max) invade a zona z (volume > 0)? */
const hits = (a, c, z) => [0, 1, 2].every((k) => a[k] < z.max[k] - 0.01 && z.min[k] < c[k] - 0.01);

/**
 * Kit de móveis com checagem. `y` das peças é relativo ao piso (`floorTop`). Cada item é uma lista de
 * peças [nome, [u0, y0, v0], [u1, y1, v1], cor, opts]; o item só entra inteiro se toda a pegada
 * cair no piso livre (`fit`) e as peças com colisão ficarem fora das zonas.
 */
export function makeKit(f, fit, zones, floorTop) {
  const kit = { placed: 0, skipped: [] };
  const onFloor = (u0, v0, u1, v1) => {
    for (let u = Math.floor(u0 + 0.02); u < u1 - 0.02; u++)
      for (let v = Math.floor(v0 + 0.02); v < v1 - 0.02; v++) if (!fit.at(u + 0.5, v + 0.5)) return false;
    return true;
  };
  kit.item = (name, pieces) => {
    const abs = pieces.map(([n, a, c, color, opts = {}]) => [
      n,
      [Math.min(a[0], c[0]), floorTop + Math.min(a[1], c[1]), Math.min(a[2], c[2])],
      [Math.max(a[0], c[0]), floorTop + Math.max(a[1], c[1]), Math.max(a[2], c[2])],
      color,
      opts,
    ]);
    const bad = abs.some(
      ([, a, c, , opts]) =>
        !onFloor(a[0], a[2], c[0], c[2]) || (opts.canCollide !== false && zones.some((z) => hits(a, c, z))),
    );
    if (bad) {
      kit.skipped.push(`${f.model}/${name}`);
      return false;
    }
    const s = f.sub(`Interior/${name}`);
    for (const [n, a, c, color, opts] of abs) s.span(n, a, c, color, opts);
    kit.placed++;
    return true;
  };
  return kit;
}

/** Lista global dos móveis que não couberam (o teste exige que fique vazia). */
export const SKIPPED = [];
