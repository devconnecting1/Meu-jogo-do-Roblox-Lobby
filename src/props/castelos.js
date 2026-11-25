// Castelos dos 30 lotes, cada um na sua planta (7 tipos em PLANS, src/map.js), com interior.
//
// Cada castelo tem:
//   * muralha de pedra no contorno da planta (base escura, ameias alternadas, portão de 6 studs com
//     verga); na Fortaleza, as quatro torres redondas sobem mais 4 studs;
//   * pátio de pedra com poço, boneco de treino, barris, caixotes e feno (o que couber);
//   * torre de menagem (o salão do dono) com janelas acesas, telhado em degraus na cor do dono
//     (ardósia para jogadores, telha vermelha para bots), estandartes na fachada e bandeira no topo;
//   * por dentro: trono no estrado, tapete até a porta, estandartes, baú, lareira, cavalete de lanças,
//     mesas compridas nos salões largos e um lampião (a única luz do castelo).
// O caminho do portão até dentro da torre é uma zona de passagem (nada com colisão).

import { C } from '../palette.js';
import { PLANS } from '../map.js';
import { makeFrame } from './frame.js';
import { Mask, planMask, buildShell, makeKit, SKIPPED } from './oficina.js';
import {
  mesa,
  banco,
  barril,
  caixote,
  fardo,
  tapete,
  lareira,
  lampiao,
  estandarte,
  poco,
  bonecoTreino,
  cavalete,
} from './moveis.js';

/** Torre de menagem [u0, v0, u1, v1] de cada planta (porta na frente, alinhada ao portão) e o pátio. */
export const KEEPS = {
  fortaleza: {
    keep: [-5, -6, 5, 4],
    decor: [
      ['Poço', poco(-10.5, -10.5)],
      ['Boneco de Treino', bonecoTreino(10.5, -10.5)],
      ['Barril', barril(-10.6, 9.0)],
      ['Caixote', caixote(10.6, 9.0)],
    ],
  },
  casteloL: {
    keep: [1, -14, 14, -5],
    decor: [
      ['Poço', poco(-8, 8)],
      ['Boneco de Treino', bonecoTreino(-12.5, 3.5)],
      ['Feno', fardo(-5.3, 12.0, -3.7, 13.2)],
      ['Caixote', caixote(-12.6, 12.6)],
      ['Barril', barril(-4, -4)],
      ['Barril', barril(-4, -6.6)],
    ],
  },
  casteloRedondo: {
    keep: [-6, -8, 6, 4],
    decor: [
      ['Poço', poco(-10, -1)],
      ['Boneco de Treino', bonecoTreino(10, -1)],
      ['Caixote', caixote(-8.5, 8.5)],
      ['Barril', barril(8.5, 8.5)],
    ],
  },
  castelaoPatio: {
    keep: [-12, -10, 12, -1],
    decor: [
      ['Poço', poco(-10, 3.2)],
      ['Boneco de Treino', bonecoTreino(10, 3.2)],
      ['Caixote', caixote(-14, 6.2)],
      ['Barril', barril(14, 6.2)],
    ],
  },
  cidadela: {
    keep: [-9, -6, 9, 4],
    decor: [
      ['Poço', poco(-12.5, 0.5)],
      ['Boneco de Treino', bonecoTreino(12.5, 0.5)],
      ['Caixote', caixote(0.5, -12.5)],
      ['Barril', barril(-12.4, 5.6)],
    ],
  },
  casteloU: {
    keep: [-11, -15, 11, -7],
    decor: [
      ['Poço', poco(-10, 6)],
      ['Boneco de Treino', bonecoTreino(10, 6)],
      ['Feno', fardo(-11, 11.6, -9.4, 12.8)],
      ['Caixote', caixote(10, 12)],
      ['Barril', barril(-12.6, -1.4)],
    ],
  },
  forteT: {
    keep: [-13, -14, 13, -6],
    decor: [
      ['Barril', barril(-14.2, -10)],
      ['Barril', barril(14.2, -10)],
    ],
  },
};

const CURTAIN = { H: 10, gateH: 8, merlon: 1.2, tower: 4 };
const KEEP = { H: 11, doorH: 6 };

const ownerColors = (owner) =>
  owner === 'bot' ? { cloth: C.pxClothRed, roof: C.pxRoofRed } : { cloth: C.pxClothBlue, roof: C.pxRoofSlate };

/** Monta o castelo do lote `plot` (chão do vale em `floorY`). Devolve as zonas de passagem (mundo). */
export function buildCastle(b, plot, floorY) {
  const plan = PLANS[plot.plan];
  const spec = KEEPS[plot.plan];
  const { cloth, roof } = ownerColors(plot.owner);
  const half = plot.size / 2;
  const root = `Construções/${plot.name}`;
  const fc = makeFrame(b, `${root}/Muralha`, plot, floorY);
  const fk = makeFrame(b, `${root}/Torre de Menagem`, plot, floorY, fc.zones);
  const fy = makeFrame(b, `${root}/Pátio`, plot, floorY, fc.zones);

  const occ = planMask(plan.parts, half);
  const [a0, b0, a1, b1] = spec.keep;
  const keepOcc = Mask.from(
    (u, v) => u > a0 && u < a1 && v > b0 && v < b1,
    occ.u0,
    occ.v0,
    occ.u0 + occ.w,
    occ.v0 + occ.h,
  );
  const [du, dv] = plan.door;

  // torres (só na Fortaleza: anel dentro dos círculos e fora do quadrado do meio)
  const circles = plan.parts.filter((q) => !Array.isArray(q));
  const rects = plan.parts.filter((q) => Array.isArray(q));
  const ring = occ.ring();
  const towers =
    circles.length && rects.length
      ? ring.map((i, j) => {
          if (!ring.has(i, j)) return false;
          const [u, v] = [occ.u0 + i + 0.5, occ.v0 + j + 0.5];
          const inCircle = circles.some((q) => Math.hypot(u - q.c[0], v - q.c[1]) < q.r);
          const inRect = rects.some((q) => u > q[0] && u < q[2] && v > q[1] && v < q[3]);
          return inCircle && !inRect;
        })
      : null;

  // muralha com portão, pátio de pedra (sem a torre de menagem) e ameias
  const curtain = buildShell(fc, occ, {
    door: [du, dv],
    doorW: 6,
    doorH: CURTAIN.gateH,
    H: CURTAIN.H,
    floor: C.pxStoneDark,
    floorName: 'Pátio',
    floorExclude: keepOcc,
    base: [1.2, C.pxStoneWallDark],
    wall: C.pxStoneWall,
    windows: null,
    roof: null,
    merlons: { y1: CURTAIN.H + CURTAIN.merlon, color: C.pxStoneWall, skip: towers },
  });
  if (towers) {
    const t = towers.and(curtain.full);
    for (const [a, bb, c, d] of t.rects())
      fc.span('Torre', [a, CURTAIN.H, bb], [c, CURTAIN.H + CURTAIN.tower, d], C.pxStoneWall);
    const top = CURTAIN.H + CURTAIN.tower;
    const merl = t.map((i, j) => t.has(i, j) && Math.floor((t.u0 + i + t.v0 + j) / 2) % 2 === 0);
    for (const [a, bb, c, d] of merl.rects())
      fc.span('Ameia da Torre', [a, top, bb], [c, top + CURTAIN.merlon, d], C.pxStoneWall);
  }

  // torre de menagem
  const keep = buildShell(fk, keepOcc, {
    door: [du, b1],
    doorW: 6,
    doorH: KEEP.doorH,
    H: KEEP.H,
    floor: C.pxWood,
    base: [1.0, C.pxStoneWallDark],
    wall: C.pxPlaster,
    windows: { y0: 3.0, y1: 5.0, period: 5, phase: 0, color: C.pxWindowLit },
    roof: { color: roof, step: 2, rise: 1.2, trim: C.pxWoodDark },
  });

  // passagem: do lado de fora do portão até 3 studs dentro da torre
  const s = curtain.door.s;
  const zone = {
    min: [du - 2.8, 0.45, s < 0 ? b1 - 3 : dv - 2],
    max: [du + 2.8, KEEP.doorH - 0.2, s < 0 ? dv + 2 : b1 + 3],
  };
  fc.zone('Portão e Salão', zone.min, zone.max);

  // estandartes na fachada da torre e bandeira no topo (sem colisão)
  const put = (f, pieces) => pieces.forEach(([n, a, c, color, o]) => f.span(n, a, c, color, o));
  put(fk, estandarte('v', b1, 1, du - 4.6, du - 3.6, 4.0, 9.0, cloth));
  put(fk, estandarte('v', b1, 1, du + 3.6, du + 4.6, 4.0, 9.0, cloth));
  if (keep.top) {
    const [ta, tb, tc, td] = keep.top;
    const [cx, cz] = [(ta + tc) / 2 + 0.2, (tb + td) / 2 + 0.2];
    fk.span('Mastro', [cx - 0.15, keep.roofTop, cz - 0.15], [cx + 0.15, keep.roofTop + 5, cz + 0.15], C.pxWoodDark);
    fk.span('Bandeira', [cx + 0.15, keep.roofTop + 3.4, cz - 0.08], [cx + 2.4, keep.roofTop + 4.8, cz + 0.08], cloth, {
      canCollide: false,
    });
  }

  // interior do salão
  const kit = makeKit(fk, keep.fit, [zone], 0.4);
  const add = (name, pieces) => kit.item(name, pieces);
  const [a, bb, c, d] = [a0 + 1, b0 + 1, a1 - 1, b1 - 1];
  add('Trono', [
    ['Estrado do Trono', [du - 1.9, 0, bb + 0.1], [du + 1.9, 0.5, bb + 2.3], C.pxStoneWall],
    ['Encosto do Trono', [du - 0.9, 0.5, bb + 0.3], [du + 0.9, 3.6, bb + 0.7], C.pxGold],
    ['Assento do Trono', [du - 0.7, 0.5, bb + 0.5], [du + 0.7, 1.3, bb + 1.7], cloth],
  ]);
  add('Tapete', tapete(du - 0.9, bb + 2.4, du + 0.9, d - 0.1, cloth));
  add('Estandarte', estandarte('v', bb, 1, du - 3.4, du - 2.4, 2.2, 5.6, cloth));
  add('Estandarte', estandarte('v', bb, 1, du + 2.4, du + 3.4, 2.2, 5.6, cloth));
  add('Baú', [
    ['Baú', [du + 2.4, 0, bb + 0.3], [du + 3.7, 0.9, bb + 1.2], C.pxWood],
    ['Fecho', [du + 2.9, 0.4, bb + 1.2], [du + 3.2, 0.7, bb + 1.3], C.pxGold],
  ]);
  const m = (bb + d) / 2 + 0.3;
  add('Lareira', lareira(a, m - 1.4, a + 0.9, m + 1.4, 3.0, '+u'));
  add('Cavalete de Lanças', cavalete(c - 0.3, m - 1.6, c, m + 1.6, '-u'));
  if (c - du >= 8 && du - a >= 8) {
    const L = Math.min(6, d - bb - 4.6);
    for (const side of [-1, 1]) {
      const [t0, t1] = side < 0 ? [du - 5.8, du - 4.2] : [du + 4.2, du + 5.8];
      const [s0, s1] = side < 0 ? [du - 3.9, du - 3.3] : [du + 3.3, du + 3.9];
      add('Mesa do Salão', mesa(t0, bb + 2.6, t1, bb + 2.6 + L));
      add('Banco do Salão', banco(s0, bb + 2.6, s1, bb + 2.6 + L));
    }
  }
  add('Lampião', lampiao((a0 + a1) / 2 + 0.3, (b0 + b1) / 2 + 0.3, KEEP.H - 0.4));
  SKIPPED.push(...kit.skipped);

  // pátio: o que couber (fora do caminho e da torre)
  const yard = makeKit(fy, occ.minus(curtain.full).minus(keepOcc), [zone], 0.4);
  for (const [name, pieces] of spec.decor) yard.item(name, pieces);

  return fc.zones;
}
