// Prisão — fonte única da verdade do mapa (dados puros, sem Roblox, sem DOM).
//
// Consumido por:
//   * viewer/main.js (Three.js) — visualização no navegador / capturas do CI;
//   * src/rojo.js + tools/build-place.mjs — modelo Rojo -> .rbxl publicado no Roblox;
//   * src/manual.js — manual de montagem passo a passo (etapas + conexões);
//   * tests/*.test.mjs — regras de construção (apoio, colisão, z-fighting, estilo, espaço).
//
// Regras (ver AGENTS.md): Part clássico, Plastic + Neon (só lâmpadas), studs só em pisos,
// cores neutras, sem UI/NPC/scripts, ambiente 100% fechado e ESPAÇOSO.
//
// Corte em "terraços" (como a prisão de referência): a galeria do 2º andar fica EM CIMA
// das celas do térreo e as celas de cima são recuadas. Assim o corredor do térreo e o átrio
// formam um único vão aberto até o teto — nada de laje cobrindo o corredor.
//
//   z:  0 ........ 24 ......... 34 .......... 44 ............ 50 ...... 60
//       átrio      | corredor   | cela térreo (16 de fundo)  |
//                  | (aberto)   | galeria 2º  | cela de cima (16 de fundo)
//
// Unidades: studs. Eixos do Roblox (Y para cima). Todas as medidas derivam de DIM.

import { makeBuilder } from './builder.js';
import { C } from './palette.js';

export const DIM = Object.freeze({
  cellW: 14, // largura interna da cela
  cellD: 16, // profundidade da cela
  cellH: 16, // pé-direito da cela (andar)
  cellsPerRow: 8,
  corridor: 10, // corredor do térreo diante das celas (aberto até o teto)
  walkway: 10, // galeria do 2º andar, apoiada sobre as celas do térreo
  voidHalf: 24, // metade da largura do átrio (linha das colunas)
  hall: 27.5, // profundidade do hall oeste
  wing: 62, // ala oeste (corredor de serviço, refeitório, almoxarifado, enfermaria)
  wingCeiling: 20, // forro das salas da ala oeste
  slab: 1,
  upperClear: 10, // folga entre o topo das celas de cima e o teto
  wall: 2,
  columnEvery: 30, // colunas a cada 2 celas (deixa o átrio respirar)
  stairHalf: 7, // escada com 14 de largura
  stairRun: 1.25, // piso de cada degrau
  bridgeHalf: 5, // ponte com 10 de largura
});

// ---------------------------------------------------------------------------
// Medidas derivadas
// ---------------------------------------------------------------------------
const PITCH = DIM.cellW + 1; // 15
const ROW = (DIM.cellsPerRow * PITCH + 1) / 2; // 60.5 -> fila de celas em x -60.5..60.5
const E = DIM.voidHalf; // 24 -> linha das colunas
const CELL_FRONT = E + DIM.corridor; // 34 -> fachada das celas do térreo = borda da galeria
const UPPER_FRONT = CELL_FRONT + DIM.walkway; // 44 -> fachada das celas de cima
const IN_Z = UPPER_FRONT + DIM.cellD; // 60
const GROUND_BACK = CELL_FRONT + DIM.cellD; // 50 -> fundo das celas do térreo
const IN_X = ROW + DIM.hall; // 88
const F2 = DIM.cellH + DIM.slab; // 17 -> piso do 2º andar
const TOP = F2 + DIM.cellH; // 33 -> topo das celas de cima
const ROOF = TOP + DIM.slab + DIM.upperClear; // 44 -> face inferior do teto
const STAIR_X1 = ROW + 5.5; // 66 -> início do mezanino
const STAIR_X0 = STAIR_X1 - F2 * DIM.stairRun; // 44.75
const SH = DIM.stairHalf;
const BRIDGE_X = -15; // centro da ponte (entre as colunas -30 e 0)
const BRIDGE = [BRIDGE_X - DIM.bridgeHalf, BRIDGE_X + DIM.bridgeHalf];
const COL = 3; // seção das colunas
const COLUMN_X = [-60, -30, 0, 30, 60];
const W = DIM.wall;
const OX = IN_X + W;
const OZ = IN_Z + W;
const WING_X1 = -IN_X - 1; // -89: face oeste da parede que separa o hall da ala oeste
const WING_X0 = WING_X1 - DIM.wing; // -151
const OXW = WING_X0 - W; // -153: face externa da parede oeste
const WC = DIM.wingCeiling;

export const LEVELS = Object.freeze({
  F2,
  TOP,
  ROOF,
  IN_X,
  IN_Z,
  CELL_FRONT,
  UPPER_FRONT,
  EDGE: E,
  STAIR_X0,
  STAIR_X1,
  ROW,
  BRIDGE,
  WING: [WING_X0, WING_X1],
});

const HANG_LIGHT = { type: 'Point', range: 32, brightness: 1.2, color: C.neon };
// luminária de galpão presa ao teto: ilumina o vão de pé-direito duplo de cima para baixo
const HIGH_BAY = { type: 'Surface', range: 52, brightness: 2.4, color: C.neon, angle: 120 };
const GALLERY_LIGHT = { type: 'Surface', range: 34, brightness: 1.8, color: C.neon, angle: 120 };
const FIXTURE_Y = ROOF - 1.4; // luminárias presas ao teto com haste curta (1,2)
const UPPER_CEIL = TOP; // forro das salas do 2º andar (mesma altura do topo das celas de cima)
const PANEL_LIGHT = { type: 'Surface', range: 18, brightness: 1.4, color: C.neon };

/** Centro X da cela i (0..7). */
export const cellCenterX = (i) => -ROW + 1 + DIM.cellW / 2 + i * PITCH;
/** Fachada (|z|) das celas de um andar. */
export const cellFront = (y0) => (y0 === 0 ? CELL_FRONT : UPPER_FRONT);

// ---------------------------------------------------------------------------
// Zonas que o jogador atravessa: nenhuma Part com colisão pode invadi-las.
// ---------------------------------------------------------------------------
export function clearanceZones() {
  const zones = [];
  const zr = (s, a, b) => (s < 0 ? [-b, -a] : [a, b]);
  for (const s of [-1, 1]) {
    const t = s < 0 ? 'Sul' : 'Norte';
    const [g0, g1] = zr(s, E + 2, CELL_FRONT - 1);
    const [w0, w1] = zr(s, CELL_FRONT + 0.6, UPPER_FRONT - 1);
    const [d0, d1] = zr(s, E + 2, CELL_FRONT - 0.5);
    zones.push(
      { name: `Corredor térreo ${t}`, min: [-IN_X + 0.5, 0.6, g0], max: [STAIR_X1 - 0.5, 8, g1] },
      { name: `Galeria 2º andar ${t}`, min: [-IN_X + 0.5, F2 + 0.6, w0], max: [STAIR_X1 - 0.5, F2 + 7, w1] },
      // pé-direito duplo: nada colide sobre o corredor do térreo (só a ponte o atravessa)
      { name: `Pé-direito duplo ${t} (oeste)`, min: [-ROW, 0.6, d0], max: [BRIDGE[0] - 0.5, ROOF - 6, d1] },
      { name: `Pé-direito duplo ${t} (leste)`, min: [BRIDGE[1] + 0.5, 0.6, d0], max: [ROW, ROOF - 6, d1] },
    );
  }
  zones.push(
    { name: 'Hall', min: [-IN_X + 0.5, 1.05, -8], max: [-ROW - 1.5, 9, 8] },
    { name: 'Eixo central do átrio', min: [-ROW, 0.6, -3.5], max: [STAIR_X0 - 2, 8, 3.5] },
    {
      name: 'Ponte',
      min: [BRIDGE[0] + 0.5, F2 + 0.2, -CELL_FRONT + 0.6],
      max: [BRIDGE[1] - 0.5, F2 + 7, CELL_FRONT - 0.6],
    },
    {
      name: 'Corredor do mezanino',
      min: [STAIR_X1 + 0.5, F2 + 0.2, -CELL_FRONT + 0.6],
      max: [STAIR_X1 + 5.4, F2 + 7, CELL_FRONT - 0.6],
    },
    { name: 'Passagem da sala de visitas', min: [STAIR_X1 + 0.7, 0.6, -E + 1], max: [STAIR_X1 + 5.5, 8, E - 1] },
    // salas do 2º andar e do térreo sob o mezanino
    { name: 'Porta da sala de controle', min: [STAIR_X1 + 4, F2 + 0.6, -1.6], max: [STAIR_X1 + 8.5, F2 + 9.6, 1.6] },
    // ala oeste
    { name: 'Vão hall → ala oeste', min: [WING_X1 - 1, 0.6, -5.5], max: [-IN_X + 0.5, 11, 5.5] },
    { name: 'Corredor de serviço', min: [WING_X0 + 0.5, 0.6, -5], max: [WING_X1 - 0.5, 8, 5] },
    { name: 'Porta do refeitório', min: [-125.5, 0.6, 4], max: [-114.5, 11, 9] },
    { name: 'Corredor entre as mesas', min: [-150, 0.6, 25], max: [-90, 8, 35] },
    { name: 'Porta do almoxarifado', min: [-134.5, 0.6, -9], max: [-127.5, 11, -4] },
    { name: 'Corredor do almoxarifado', min: [-138, 0.6, -58], max: [-131, 8, -7.5] },
    { name: 'Porta da enfermaria', min: [-108.5, 0.6, -9], max: [-101.5, 11, -4] },
    ...[-1, 1].flatMap((s) => {
      const zr2 = (a, c) => (s < 0 ? [-c, -a] : [a, c]);
      const t = s < 0 ? 'Sul' : 'Norte';
      const box = (name, x0, x1, za, zc, y0, y1) => {
        const [z0, z1] = zr2(za, zc);
        return { name: `${name} ${t}`, min: [x0, y0, z0], max: [x1, y1, z1] };
      };
      return [
        box('Galeria do mezanino', STAIR_X1 - 0.5, IN_X - 0.5, CELL_FRONT + 0.6, UPPER_FRONT - 0.6, F2 + 0.6, F2 + 7),
        box('Porta da diretoria/arquivo', STAIR_X1 + 4, STAIR_X1 + 8.5, 26.3, 29.7, F2 + 0.6, F2 + 9.6),
        box('Porta descanso/vestiário', 70.3, 73.7, UPPER_FRONT - 2, UPPER_FRONT + 2.5, F2 + 0.6, F2 + 9.6),
        box('Porta biblioteca/aula', -75.7, -72.3, UPPER_FRONT - 2, UPPER_FRONT + 2.5, F2 + 0.6, F2 + 9.6),
        box('Porta da sala de visitas', STAIR_X1 - 2, STAIR_X1 + 3, 16.3, 19.7, 0.6, 9.6),
        box('Porta dos uniformes', STAIR_X1 - 2, STAIR_X1 + 3, 28.3, 31.7, 0.6, 9.6),
      ];
    }),
    { name: 'Corredor da enfermaria', min: [-116, 0.6, -49], max: [-90, 8, -16] },
  );
  for (let k = 0; k < F2; k++) {
    const xa = STAIR_X0 + k * DIM.stairRun;
    zones.push({
      name: `Degrau ${k + 1} (acima)`,
      min: [xa + 0.05, k + 1.1, -SH + 0.1],
      max: [xa + DIM.stairRun - 0.05, k + 8, SH - 0.1],
    });
  }
  let n = 1;
  for (const side of [-1, 1]) {
    for (const y0 of [0, F2]) {
      const front = cellFront(y0);
      for (let i = 0; i < DIM.cellsPerRow; i++) {
        const cx = cellCenterX(i);
        const z = (d) => side * (front + d);
        const id = String(n++).padStart(2, '0');
        zones.push({
          name: `Porta da cela ${id}`,
          min: [cx + 2.3, y0 + 0.6, Math.min(z(-1), z(1.6))],
          max: [cx + 5.2, y0 + 9.6, Math.max(z(-1), z(1.6))],
        });
        zones.push({
          name: `Interior da cela ${id}`,
          min: [cx - 3, y0 + 0.2, Math.min(z(1), z(11))],
          max: [cx + 4, y0 + 7, Math.max(z(1), z(11))],
        });
      }
    }
  }
  return zones;
}

/** Bordas com queda: amostradas no teste para garantir guarda-corpo contínuo. */
export function fallEdges() {
  return [
    { name: 'Borda galeria Sul', axis: 'x', at: -CELL_FRONT, from: -IN_X, to: STAIR_X1, y: F2, openings: [BRIDGE] },
    { name: 'Borda galeria Norte', axis: 'x', at: CELL_FRONT, from: -IN_X, to: STAIR_X1, y: F2, openings: [BRIDGE] },
    {
      name: 'Borda do mezanino',
      axis: 'z',
      at: STAIR_X1,
      from: -CELL_FRONT,
      to: CELL_FRONT,
      y: F2,
      openings: [[-SH, SH]],
    },
    { name: 'Ponte lado oeste', axis: 'z', at: BRIDGE[0], from: -CELL_FRONT, to: CELL_FRONT, y: F2, openings: [] },
    { name: 'Ponte lado leste', axis: 'z', at: BRIDGE[1], from: -CELL_FRONT, to: CELL_FRONT, y: F2, openings: [] },
  ];
}

export const ENVELOPE = Object.freeze({ min: [OXW, -1, -OZ], max: [OX, ROOF + 1, OZ] });
export const INTERIOR = Object.freeze({ min: [WING_X0, 0, -IN_Z], max: [IN_X, ROOF, IN_Z] });

// ---------------------------------------------------------------------------
// Peças compostas
// ---------------------------------------------------------------------------

function crate(b, model, x, y, z, s = 4) {
  b.box(model, 'Caixa', [x, y + s / 2, z], [s, s, s], C.wood);
  const h = s / 2 - 0.15;
  for (const dx of [-h, h]) {
    for (const dz of [-h, h]) {
      // a cantoneira só sobressai para cima (nunca abaixo do apoio)
      b.box(model, 'Cantoneira', [x + dx, y + s / 2 + 0.02, z + dz], [0.42, s + 0.04, 0.42], C.woodDark);
    }
  }
  b.box(model, 'Cinta Inferior', [x, y + 0.3, z], [s + 0.06, 0.4, s + 0.06], C.woodDark);
  b.box(model, 'Cinta Superior', [x, y + s - 0.3, z], [s + 0.06, 0.4, s + 0.06], C.woodDark);
}

/** Estante metálica (ao longo de X). items: 'caixas' (almoxarifado) ou 'roupas' (rouparia/uniformes). */
function rack(b, model, x, z, len = 10, depth = 3.5, h = 11, items = 'caixas', y0 = 0) {
  for (const dx of [-len / 2 + 0.3, 0, len / 2 - 0.3]) {
    for (const dz of [-depth / 2 + 0.3, depth / 2 - 0.3]) {
      b.box(model, 'Montante', [x + dx, y0 + h / 2, z + dz], [0.5, h, 0.5], C.steel);
    }
  }
  [0.6, 4.2, 7.8].forEach((sy, i) =>
    b.box(model, `Prateleira ${i + 1}`, [x, y0 + sy, z], [len, 0.3, depth], C.steelLight),
  );
  if (items === 'livros') {
    [0.75, 4.35, 7.95].forEach((sy) => {
      for (const [dx, col] of [
        [-2.4, C.wood],
        [2.4, C.blanket],
      ]) {
        b.box(model, 'Livros', [x + dx, y0 + sy + 0.7, z], [2.4, 1.4, depth - 0.8], col);
      }
    });
    return;
  }
  // itens sempre entre os montantes (montantes em x, x ± (len/2 - 0.3))
  if (items === 'roupas') {
    [0.75, 4.35, 7.95].forEach((sy, i) => {
      for (const [dx, col] of [
        [-2.4, i % 2 ? C.blanket : C.sheet],
        [2.4, i % 2 ? C.sheet : C.blanket],
      ]) {
        b.box(model, 'Pilha de Roupas', [x + dx, y0 + sy + 0.6, z], [2.4, 1.2, depth - 1.2], col);
      }
    });
    return;
  }
  crate(b, model, x - 2.4, y0 + 0.75, z, 2.4);
  crate(b, model, x + 2.4, y0 + 4.35, z, 2.4);
  crate(b, model, x - 2.4, y0 + 7.95, z, 2.4);
}

/** Mesa redonda (tampo cilíndrico) com dois bancos de encosto, ao longo de X. */
function diningTable(b, model, tx, tz) {
  b.box(model, 'Mesa Tampo', [tx, 3.2, tz], [0.4, 8, 8], C.porcelain, { shape: 'Cylinder', rotation: [0, 0, 90] });
  b.box(model, 'Mesa Pé', [tx, 1.6, tz], [1.2, 3, 1.2], C.steel);
  b.box(model, 'Mesa Base', [tx, 0.25, tz], [3.4, 0.3, 3.4], C.steel);
  for (const s of [-1, 1]) {
    b.box(model, 'Banco', [tx, 1.8, tz + s * 5.4], [7, 0.5, 1.8], C.steelLight);
    b.box(model, 'Banco Encosto', [tx, 2.95, tz + s * 6.3], [7, 1.8, 0.4], C.steel);
    b.box(model, 'Banco Pé', [tx - 2.6, 0.85, tz + s * 5.4], [0.7, 1.5, 1.4], C.steel);
    b.box(model, 'Banco Pé', [tx + 2.6, 0.85, tz + s * 5.4], [0.7, 1.5, 1.4], C.steel);
  }
}

/**
 * Parede reta com portas e janelas. axis 'x': corre em X (espessura em Z = w0..w1);
 * axis 'z': corre em Z (espessura em X). y0 = piso, h = altura.
 * openings: { a, c, kind: 'door' | 'window', top, bottom } (a/c ao longo da parede; top/bottom relativos a y0).
 */
function wallRun(b, model, axis, u0, u1, w0, w1, y0, h, openings = []) {
  const P = (u, y, w) => (axis === 'x' ? [u, y, w] : [w, y, u]);
  const wl = Math.min(w0, w1);
  const wh = Math.max(w0, w1);
  const seg = (name, ua, ub, ya, yb, wa, wb, color, opts) =>
    b.span(model, name, P(ua, ya, wa), P(ub, yb, wb), color, opts);
  let cur = u0;
  for (const op of [...openings].sort((p, q) => p.a - q.a)) {
    if (op.a > cur) seg('Parede', cur, op.a, y0, y0 + h, wl, wh, C.wall);
    if (op.kind === 'door') {
      seg('Verga Porta', op.a, op.c, y0 + op.top, y0 + h, wl, wh, C.wall);
      seg('Batente E', op.a, op.a + 0.2, y0, y0 + op.top, wl - 0.05, wh + 0.05, C.steel);
      seg('Batente D', op.c - 0.2, op.c, y0, y0 + op.top, wl - 0.05, wh + 0.05, C.steel);
      seg('Batente Topo', op.a, op.c, y0 + op.top - 0.2, y0 + op.top, wl - 0.05, wh + 0.05, C.steel);
    } else {
      seg('Peitoril', op.a, op.c, y0, y0 + op.bottom, wl, wh, C.wall);
      seg('Verga Janela', op.a, op.c, y0 + op.top, y0 + h, wl, wh, C.wall);
      seg('Vidro', op.a, op.c, y0 + op.bottom, y0 + op.top, wl + 0.2, wl + 0.4, C.glass, { transparency: 0.6 });
      seg('Caixilho E', op.a, op.a + 0.2, y0 + op.bottom, y0 + op.top, wl - 0.05, wh + 0.05, C.steel);
      seg('Caixilho D', op.c - 0.2, op.c, y0 + op.bottom, y0 + op.top, wl - 0.05, wh + 0.05, C.steel);
      seg('Caixilho Topo', op.a, op.c, y0 + op.top - 0.2, y0 + op.top, wl - 0.05, wh + 0.05, C.steel);
      seg('Caixilho Base', op.a, op.c, y0 + op.bottom, y0 + op.bottom + 0.2, wl - 0.05, wh + 0.05, C.steel);
    }
    cur = op.c;
  }
  if (cur < u1) seg('Parede', cur, u1, y0, y0 + h, wl, wh, C.wall);
}
const door = (a, c, top = 10) => ({ a, c, kind: 'door', top });
const win = (a, c, bottom = 3, top = 11) => ({ a, c, kind: 'window', bottom, top });

/** Parede reta ao longo de X (espessura em Z) com vãos [x0, x1, alturaDoVão]. */
function wallX(b, model, x0, x1, z0, z1, h, openings = []) {
  let cur = x0;
  for (const [a, c, oh] of [...openings].sort((p, q) => p[0] - q[0])) {
    if (a > cur) b.span(model, 'Parede', [cur, 0, z0], [a, h, z1], C.wall);
    b.span(model, 'Verga', [a, oh, z0], [c, h, z1], C.wall);
    cur = c;
  }
  if (cur < x1) b.span(model, 'Parede', [cur, 0, z0], [x1, h, z1], C.wall);
}

/** Luminária pendente: carcaça + 2 tubos Neon + hastes até o teto. */
function hangingLight(b, model, x, y, z, light = HANG_LIGHT) {
  const stem = ROOF - (y + 0.2);
  b.box(model, 'Carcaça', [x, y, z], [8, 0.4, 1.8], C.steel, { canCollide: false });
  for (const o of [-1.9, 1.9]) {
    b.box(model, 'Tubo', [x + o, y - 0.3, z], [3.6, 0.25, 1.1], C.neon, {
      canCollide: false,
      material: 'Neon',
      light: o < 0 ? light : null,
    });
    b.box(model, 'Haste', [x + o * 1.4, y + 0.2 + stem / 2, z], [0.3, stem, 0.3], C.steel, { canCollide: false });
  }
}

/** Painel embutido; ceilingY = face inferior do teto onde ele encosta. */
function panelLight(b, model, x, ceilingY, z, w = 5, d = 1.4, light = true) {
  b.box(model, 'Moldura', [x, ceilingY - 0.05, z], [w + 0.4, 0.1, d + 0.4], C.steel, { canCollide: false });
  b.box(model, 'Painel', [x, ceilingY - 0.15, z], [w, 0.12, d], C.neon, {
    canCollide: false,
    material: 'Neon',
    light: light ? PANEL_LIGHT : null,
  });
}

/** Guarda-corpo de vidro reto (em X ou em Z), apoiado em y. */
function glassRail(b, model, axis, at, from, to, y) {
  const seg = (name, w, ya, yb, color, opts) => {
    if (axis === 'x') b.span(model, name, [from, ya, at - w / 2], [to, yb, at + w / 2], color, opts);
    else b.span(model, name, [at - w / 2, ya, from], [at + w / 2, yb, to], color, opts);
  };
  seg('Rodapé', 0.7, y, y + 0.6, C.curb, { studs: true });
  seg('Vidro', 0.2, y + 0.6, y + 3.6, C.glass, { transparency: 0.6 });
  seg('Corrimão', 0.45, y + 3.6, y + 3.9, C.steelLight);
}

/** Uma cela. side = -1 (ala sul, abre para +Z) ou +1 (ala norte, abre para -Z). */
function cell(b, index, side, y0, number) {
  const id = String(number).padStart(2, '0');
  const model = `Celas/Cela ${id}`;
  const cx = cellCenterX(index);
  const front = side * cellFront(y0);
  const zAt = (d) => front + side * d; // d: 0 = fachada, 16 = fundo; negativo = corredor
  const r = (name, lx0, lx1, ya, yb, d0, d1, color, opts) =>
    b.span(model, name, [cx + lx0, y0 + ya, zAt(d0)], [cx + lx1, y0 + yb, zAt(d1)], color, opts);
  const deco = { canCollide: false };
  const H = DIM.cellH;
  const D = DIM.cellD;

  // Fachada (inclui a frente da divisória à esquerda: lx -8..-7)
  r('Fachada Pilar E', -8, -6, 0, 13, 0, 0.6, C.facade);
  r('Fachada Peitoril', -6, 1, 0, 3, 0, 0.6, C.facade);
  r('Fachada Verga Janela', -6, 1, 11, 13, 0, 0.6, C.facade);
  r('Fachada Pilar Meio', 1, 2, 0, 13, 0, 0.6, C.facade);
  r('Fachada Verga Porta', 2, 5.5, 10, 13, 0, 0.6, C.facade);
  r('Fachada Pilar D', 5.5, 7, 0, 13, 0, 0.6, C.facade);
  r('Faixa Superior', -8, 7, 13, H, 0, 0.6, C.wall);
  r('Friso', -8, 7, 14.3, 14.7, -0.08, 0, C.wallTrim, deco);

  // Janela de observação (showcase)
  r('Vidro Janela', -6, 1, 3, 11, 0.2, 0.4, C.glass, { transparency: 0.7 });
  r('Caixilho E', -6, -5.8, 3, 11, -0.05, 0.65, C.steel);
  r('Caixilho D', 0.8, 1, 3, 11, -0.05, 0.65, C.steel);
  r('Caixilho Topo', -6, 1, 10.8, 11, -0.05, 0.65, C.steel);
  r('Caixilho Base', -6, 1, 3, 3.2, -0.05, 0.65, C.steel);
  r('Parapeito', -6.2, 1.2, 2.8, 3.1, -0.4, 0, C.steelLight);

  // Porta: batente + porta de grade deslizante aberta (apoiada no meio-fio e no trilho)
  r('Batente E', 2, 2.2, 0, 10, -0.05, 0.65, C.steel);
  r('Batente D', 5.3, 5.5, 0, 10, -0.05, 0.65, C.steel);
  r('Batente Topo', 2, 5.5, 9.8, 10, -0.05, 0.65, C.steel);
  r('Trilho', 2, 8, 10, 10.3, -0.5, 0, C.steel);
  r('Porta Topo', 5.6, 8, 9.7, 10, -0.35, 0, C.steel, deco);
  r('Porta Base', 5.6, 8, 0.5, 0.8, -0.35, 0, C.steel, deco);
  r('Porta Montante E', 5.6, 5.85, 0.5, 10, -0.35, 0, C.steel, deco);
  r('Porta Montante D', 7.75, 8, 0.5, 10, -0.35, 0, C.steel, deco);
  r('Porta Travessa', 5.6, 8, 5, 5.3, -0.35, 0, C.steel, deco);
  for (const bx of [6.3, 6.8, 7.3]) r('Porta Barra', bx - 0.1, bx + 0.1, 0.8, 9.7, -0.3, -0.05, C.steel, deco);

  // Interior
  // o piso termina na face da parede do fundo (atrás das celas do térreo há um vão de serviço)
  r('Piso', -7, 7, 0, 0.1, 0.6, D - 0.3, C.cellFloor);
  r('Revestimento E', -7, -6.8, 0, H, 0.6, D - 0.3, C.cellWall);
  r('Revestimento D', 6.8, 7, 0, H, 0.6, D - 0.3, C.cellWall);
  r('Parede Fundo', -7, 7, 0, H, D - 0.3, D, C.cellBack);
  panelLight(b, model, cx, y0 + H, zAt(7), 3.4, 1.8);

  // Cama
  r('Cama Base', -6.6, 0.4, 0.1, 1.4, 12.2, 15.6, C.steel);
  r('Cama Gaveta', -6.2, 0, 0.5, 0.9, 12.1, 12.2, C.steelLight, deco);
  r('Colchão', -6.5, 0.3, 1.4, 1.9, 12.3, 15.5, C.sheet);
  r('Cobertor', -4.3, 0.35, 1.9, 2.1, 12.25, 15.55, C.blanket);
  r('Travesseiro', -6.3, -4.9, 1.9, 2.4, 12.6, 15.2, C.sheet);
  r('Cabeceira', -6.8, -6.5, 0.1, 3, 12.2, 15.6, C.steel);

  // Vaso sanitário
  r('Vaso Base', 4.4, 5.8, 0.1, 1.3, 13.6, 15.3, C.porcelain);
  r('Vaso Assento', 4.3, 5.9, 1.3, 1.5, 13.5, 15.3, C.porcelain);
  r('Vaso Caixa', 4.4, 5.8, 1.3, 3, 15.2, 15.7, C.porcelain);

  // Pia com espelho (parede direita)
  r('Pia Coluna', 6.3, 6.6, 0.1, 3, 9.6, 9.9, C.steel);
  r('Pia Cuba', 5.9, 6.8, 3, 3.6, 9, 10.5, C.steelLight);
  r('Torneira', 6.5, 6.7, 3.6, 4.1, 9.7, 9.8, C.steel);
  r('Espelho', 6.68, 6.8, 4.6, 7.4, 8.8, 10.7, C.mirror);

  // Mesa de parede, banqueta e prateleira (parede esquerda)
  r('Mesa', -6.8, -5.2, 2.6, 2.9, 5, 8, C.wood);
  r('Mesa Suporte', -6.8, -6.5, 0.1, 2.6, 6.3, 6.7, C.steel);
  r('Banqueta Coluna', -4.55, -4.25, 0.1, 1.5, 6.35, 6.65, C.steel);
  r('Banqueta Assento', -4.9, -3.9, 1.5, 1.8, 6, 7, C.wood);
  r('Prateleira', -6.8, -5.8, 7, 7.2, 4.8, 8.2, C.wood);
}

// ---------------------------------------------------------------------------
// Montagem (a ordem aqui não importa: o manual define as etapas)
// ---------------------------------------------------------------------------

export function buildPrison() {
  const b = makeBuilder();
  const H = DIM.cellH;

  // --- Envoltória fechada (sem janelas, portas ou claraboia) ---------------
  const ENV = 'Envoltória';
  b.span(ENV, 'Laje Térreo', [OXW, -1, -OZ], [OX, 0, OZ], C.floor, { group: 'Piso' });
  const wo = { group: 'Paredes' };
  b.span(ENV, 'Parede Sul', [OXW, 0, -OZ], [OX, ROOF, -IN_Z], C.wall, wo);
  b.span(ENV, 'Parede Norte', [OXW, 0, IN_Z], [OX, ROOF, OZ], C.wall, wo);
  b.span(ENV, 'Parede Leste', [IN_X, 0, -IN_Z], [OX, ROOF, IN_Z], C.wall, wo);
  b.span(ENV, 'Parede Oeste', [OXW, 0, -IN_Z], [WING_X0, ROOF, IN_Z], C.wall, wo);
  b.span(ENV, 'Laje Teto', [OXW, ROOF, -OZ], [OX, ROOF + 1, OZ], C.ceiling, { group: 'Teto' });

  // Parede que separa o bloco de celas (hall) da ala oeste, com vão de 12 × 12
  const PB = 'Estrutura/Paredes';
  b.span(PB, 'Parede do Bloco S', [WING_X1, 0, -IN_Z], [-IN_X, ROOF, -6], C.wall, wo);
  b.span(PB, 'Parede do Bloco N', [WING_X1, 0, 6], [-IN_X, ROOF, IN_Z], C.wall, wo);
  b.span(PB, 'Parede do Bloco Verga', [WING_X1, 12, -6], [-IN_X, ROOF, 6], C.wall, wo);

  // Faixas internas das paredes (decorativas, sem colisão)
  const WB = 'Acabamento/Paredes';
  const band = { canCollide: false, group: 'Paredes' };
  const bands = [
    ['Rodapé Alto', 0, 1.2, C.wainscot],
    ['Faixa Térreo', 13.6, 14.2, C.wallTrim],
    ['Faixa 2º Andar', F2 + 13.6, F2 + 14.2, C.wallTrim],
  ];
  for (const [x, dir] of [
    [-IN_X, 1],
    [IN_X, -1],
  ]) {
    for (const [n, ya, yb, col] of bands) {
      // no lado do hall a parede tem o vão para a ala oeste (z -6..6, até 12 de altura)
      const zs =
        x < 0 && yb <= 12
          ? [
              [-IN_Z, -6],
              [6, IN_Z],
            ]
          : [[-IN_Z, IN_Z]];
      for (const [z0, z1] of zs) b.span(WB, n, [x, ya, z0], [x + dir * 0.1, yb, z1], col, band);
    }
  }
  for (const s of [-1, 1]) {
    for (const [x0, x1] of [
      [-IN_X, -ROW],
      [ROW, IN_X],
    ]) {
      for (const [n, ya, yb, col] of bands) b.span(WB, n, [x0, ya, s * IN_Z], [x1, yb, s * (IN_Z - 0.1)], col, band);
    }
    b.span(WB, 'Faixa Alta', [-IN_X, ROOF - 3.4, s * IN_Z], [IN_X, ROOF - 2.8, s * (IN_Z - 0.1)], C.wallTrim, band);
  }

  // --- Teto: vigas no ritmo das colunas ------------------------------------
  const T = 'Estrutura/Teto';
  const tg = { group: 'Teto' };
  for (const x of COLUMN_X)
    b.span(T, 'Viga Transversal', [x - 0.7, ROOF - 1.8, -IN_Z], [x + 0.7, ROOF, IN_Z], C.beam, tg);
  for (const z of [-E, E])
    b.span(T, 'Viga Longitudinal', [-IN_X, ROOF - 1.8, z - 0.7], [IN_X, ROOF, z + 0.7], C.beam, tg);

  // --- Colunas (a cada 2 celas, soltas no vão) ------------------------------
  for (const x of COLUMN_X) {
    for (const s of [-1, 1]) {
      b.box('Estrutura/Colunas', 'Coluna', [x, ROOF / 2, s * E], [COL, ROOF, COL], C.column);
      b.box('Estrutura/Colunas', 'Base Coluna', [x, 0.45, s * E], [COL + 0.6, 0.9, COL + 0.6], C.columnBase);
    }
  }

  // --- Pisos do térreo -----------------------------------------------------
  const P = 'Pisos';
  b.span(P, 'Piso Átrio', [-ROW, 0, -(E - 2)], [STAIR_X1, 0.1, E - 2], C.floorAtrium, { studs: true });
  // o piso começa atrás do fundo da escada (0,4), por dentro das paredes da sala: nenhuma face coplanar
  b.span(P, 'Piso Sala de Visitas', [STAIR_X1 + 0.4, 0, -E], [IN_X, 0.1, E], C.floorCorridor);
  for (const s of [-1, 1]) {
    const t = s < 0 ? 'Sul' : 'Norte';
    b.span(P, `Corredor ${t}`, [-IN_X, 0, s * (E + 2)], [STAIR_X1, 0.1, s * (CELL_FRONT - 1)], C.floorCorridor);
    b.span(P, `Meio-fio ${t}`, [-ROW, 0, s * (CELL_FRONT - 1)], [ROW, 0.5, s * CELL_FRONT], C.curb, { studs: true });
  }

  // --- Blocos de celas (de cima recuadas) ------------------------------------
  let number = 1;
  for (const side of [-1, 1]) {
    const t = side < 0 ? 'Sul' : 'Norte';
    const A = `Celas/Ala ${t}`;
    for (const y0 of [0, F2]) {
      const front = cellFront(y0);
      const zf = side * front;
      const zDiv = side * (front + 0.6);
      for (let i = 0; i <= DIM.cellsPerRow; i++) {
        const wx = -ROW + i * PITCH;
        // no térreo as divisórias das pontas vão até a parede e fecham o vão de serviço atrás das celas
        const end = y0 === 0 && (i === 0 || i === DIM.cellsPerRow) ? IN_Z : y0 === 0 ? GROUND_BACK : IN_Z;
        b.span(A, 'Divisória', [wx, y0, zDiv], [wx + 1, y0 + H, side * end], C.facade);
      }
      // Fecho da fachada sobre a última divisória
      const wl = ROW - 1;
      b.span(A, 'Fachada Final', [wl, y0, zf], [ROW, y0 + 13, zDiv], C.facade);
      b.span(A, 'Faixa Final', [wl, y0 + 13, zf], [ROW, y0 + H, zDiv], C.wall);
      b.span(A, 'Friso Final', [wl, y0 + 14.3, zf - side * 0.08], [ROW, y0 + 14.7, zf], C.wallTrim, {
        canCollide: false,
      });
      for (let i = 0; i < DIM.cellsPerRow; i++) cell(b, i, side, y0, number++);
    }
    b.span(A, 'Laje Superior', [-ROW, TOP, side * UPPER_FRONT], [ROW, TOP + 1, side * IN_Z], C.cellWall);

    // Laje do 2º andar: começa na fachada do térreo (não cobre o corredor)
    const G = `Galerias/Galeria ${t}`;
    const zEdge = side * CELL_FRONT;
    b.span(G, 'Laje', [-IN_X, F2 - 1, zEdge], [STAIR_X1, F2, side * IN_Z], C.cellWall);
    b.span(G, 'Piso Galeria', [-IN_X, F2, zEdge], [STAIR_X1, F2 + 0.1, side * (UPPER_FRONT - 1)], C.floorCatwalk);
    b.span(
      G,
      'Faixa Piso',
      [-IN_X, F2 + 0.1, side * (CELL_FRONT + 2.4)],
      [STAIR_X1, F2 + 0.15, side * (CELL_FRONT + 3)],
      C.wallTrim,
      { canCollide: false },
    );
    b.span(G, 'Meio-fio', [-ROW, F2, side * (UPPER_FRONT - 1)], [ROW, F2 + 0.5, side * UPPER_FRONT], C.curb, {
      studs: true,
    });
    for (const [x0, x1] of [
      [-IN_X, BRIDGE[0]],
      [BRIDGE[1], STAIR_X1],
    ]) {
      b.span(G, 'Testeira', [x0, F2 - 1, zEdge - side * 0.4], [x1, F2, zEdge], C.wallTrim);
      glassRail(b, G, 'x', zEdge, x0, x1, F2);
    }
    // Iluminação: pendentes sobre o corredor (vão aberto) e sobre a galeria
    for (let i = 0; i < DIM.cellsPerRow; i++) {
      const lx = cellCenterX(i);
      hangingLight(b, `Iluminação/Galeria ${t}`, lx, FIXTURE_Y, side * (CELL_FRONT + 5), i % 2 ? null : GALLERY_LIGHT);
    }
  }

  // --- Ponte central ---------------------------------------------------------
  const BR = 'Galerias/Ponte';
  b.span(BR, 'Laje Ponte', [BRIDGE[0], F2 - 1, -CELL_FRONT], [BRIDGE[1], F2, CELL_FRONT], C.cellWall);
  b.span(BR, 'Piso Ponte', [BRIDGE[0], F2, -CELL_FRONT], [BRIDGE[1], F2 + 0.1, CELL_FRONT], C.floorCatwalk);
  b.span(BR, 'Testeira O', [BRIDGE[0] - 0.4, F2 - 1, -CELL_FRONT], [BRIDGE[0], F2, CELL_FRONT], C.wallTrim);
  b.span(BR, 'Testeira L', [BRIDGE[1], F2 - 1, -CELL_FRONT], [BRIDGE[1] + 0.4, F2, CELL_FRONT], C.wallTrim);
  glassRail(b, BR, 'z', BRIDGE[0], -CELL_FRONT, CELL_FRONT, F2);
  glassRail(b, BR, 'z', BRIDGE[1], -CELL_FRONT, CELL_FRONT, F2);

  // --- Mezanino leste + escada ---------------------------------------------
  const M = 'Galerias/Mezanino';
  b.span(M, 'Laje Mezanino', [STAIR_X1, F2 - 1, -IN_Z], [IN_X, F2, IN_Z], C.cellWall);
  b.span(M, 'Patamar', [STAIR_X1, F2, -CELL_FRONT], [IN_X, F2 + 0.1, CELL_FRONT], C.floorAtrium, { studs: true });
  b.span(M, 'Piso Mezanino S', [STAIR_X1, F2, -IN_Z], [IN_X, F2 + 0.1, -CELL_FRONT], C.floorCatwalk);
  b.span(M, 'Piso Mezanino N', [STAIR_X1, F2, CELL_FRONT], [IN_X, F2 + 0.1, IN_Z], C.floorCatwalk);
  for (const [z0, z1] of [
    [-CELL_FRONT, -SH - 0.8],
    [SH + 0.8, CELL_FRONT],
  ]) {
    b.span(M, 'Testeira', [STAIR_X1 - 0.4, F2 - 1, z0], [STAIR_X1, F2, z1], C.wallTrim);
    glassRail(b, M, 'z', STAIR_X1, z0, z1, F2);
  }

  const S = 'Escada';
  for (let k = 0; k < F2; k++) {
    const xa = STAIR_X0 + k * DIM.stairRun;
    b.span(S, `Degrau ${k + 1}`, [xa, 0, -SH], [STAIR_X1, k + 1, SH], C.stair);
    b.span(S, `Focinho ${k + 1}`, [xa, k + 1, -SH], [xa + 0.4, k + 1.05, SH], C.stairNose, { canCollide: false });
  }
  for (const s of [-1, 1]) {
    b.span(S, 'Parede Escada', [STAIR_X0, 0, s * SH], [STAIR_X1, F2 + 3.5, s * (SH + 0.8)], C.wall);
    b.span(S, 'Pórtico Pilar', [STAIR_X0 - 1.6, 0, s * SH], [STAIR_X0, 15, s * (SH + 2.4)], C.wallTrim);
  }
  b.span(S, 'Fundo Escada', [STAIR_X1, 0, -SH - 0.8], [STAIR_X1 + 0.4, F2 - 1, SH + 0.8], C.wall);
  b.span(S, 'Pórtico Viga', [STAIR_X0 - 1.6, 12, -SH], [STAIR_X0, 15, SH], C.wallTrim);

  // --- Hall: spawn e posto de guarda ---------------------------------------
  const HL = 'Hall';
  b.box(HL, 'SpawnLocation', [-76, 0.5, 0], [10, 1, 10], C.steelLight, { className: 'SpawnLocation', studs: true });
  b.box(HL, 'Borda Spawn', [-76, 0.15, 0], [11.4, 0.3, 11.4], C.curb, { studs: true });
  b.span(HL, 'Balcão', [-74, 0, 12], [-70, 3.5, 20], C.facade);
  b.span(HL, 'Tampo Balcão', [-74.3, 3.5, 11.7], [-69.7, 3.8, 20.3], C.steelLight);
  b.span(HL, 'Vidro Balcão', [-69.9, 3.8, 12], [-69.8, 7.5, 20], C.glass, { transparency: 0.6 });
  b.span(HL, 'Painel Monitores', [-IN_X, 6, 13], [-IN_X + 0.3, 9.5, 19], C.steel, { canCollide: false });
  for (const z of [-14, 14]) hangingLight(b, 'Iluminação/Hall', -74, FIXTURE_Y, z, HIGH_BAY);

  // --- Salas do bloco (cantos oeste do térreo): guardas e rouparia ----------
  for (const s of [-1, 1]) {
    const D = s < 0 ? 'Salas/Rouparia' : 'Salas/Sala dos Guardas';
    const za = s * CELL_FRONT;
    const zb = s * (CELL_FRONT + 0.6);
    b.span(D, 'Parede Baixa', [-IN_X, 0, za], [-ROW, 3, zb], C.wall);
    b.span(D, 'Parede Alta', [-IN_X, 11, za], [-ROW, F2 - 1, zb], C.wall);
    b.span(D, 'Parede E', [-IN_X, 3, za], [-84, 11, zb], C.wall);
    b.span(D, 'Parede D', [-66, 3, za], [-ROW, 11, zb], C.wall);
    b.span(D, 'Vidro', [-84, 3, s * (CELL_FRONT + 0.2)], [-66, 11, s * (CELL_FRONT + 0.4)], C.glass, {
      transparency: 0.6,
    });
    const zf0 = za - s * 0.05;
    const zf1 = zb + s * 0.05;
    b.span(D, 'Caixilho E', [-84, 3, zf0], [-83.8, 11, zf1], C.steel);
    b.span(D, 'Caixilho D', [-66.2, 3, zf0], [-66, 11, zf1], C.steel);
    b.span(D, 'Caixilho Topo', [-84, 10.8, zf0], [-66, 11, zf1], C.steel);
    b.span(D, 'Caixilho Base', [-84, 3, zf0], [-66, 3.2, zf1], C.steel);
    if (s > 0) {
      // armários dos guardas na parede do fundo + mesa de monitoramento
      for (let k = 0; k < 6; k++)
        b.span(D, 'Armário', [-86 + k * 2, 0, IN_Z - 1.6], [-84 + k * 2, 7, IN_Z], C.steelLight);
      b.span(D, 'Mesa', [-80, 2.8, 44], [-70, 3.1, 47], C.steelLight);
      for (const lx of [-79.5, -71]) b.span(D, 'Mesa Pé', [lx, 0, 44.3], [lx + 0.5, 2.8, 46.7], C.steel);
      for (const mx of [-78, -74])
        b.span(D, 'Monitor', [mx, 3.1, 45.8], [mx + 2, 4.6, 46.2], C.steel, { canCollide: false });
      panelLight(b, D, -74, F2 - 1, 47);
    } else {
      rack(b, D, -74, -55, 14, 3.5, 11, 'roupas');
      rack(b, D, -74, -45.5, 14, 3.5, 11, 'roupas');
      b.span(D, 'Mesa de Dobrar', [-86, 2.8, -42], [-82, 3.1, -38], C.steelLight);
      for (const lz of [-41.7, -38.5]) b.span(D, 'Mesa Pé', [-85.7, 0, lz], [-82.3, 2.8, lz + 0.2], C.steel);
      panelLight(b, D, -74, F2 - 1, -50);
    }
  }

  // --- Átrio: livre (refeitório e caixas ficam em salas próprias na ala oeste) -
  // grade de luminárias de galpão entre as vigas (cobre átrio e corredores do térreo)
  for (const x of [-45, -15, 15, 45]) {
    for (const z of [-(E + 5), -12, 12, E + 5]) hangingLight(b, 'Iluminação/Átrio', x, FIXTURE_Y, z, HIGH_BAY);
  }

  // --- Sala de visitas (sob o mezanino) -------------------------------------
  const V = 'Sala de Visitas';
  b.span(V, 'Balcão', [76, 0.1, -18], [78, 3, 18], C.facade);
  b.span(V, 'Tampo', [75.8, 3, -18], [78.2, 3.3, 18], C.steelLight);
  b.span(V, 'Vidro Divisor', [76.9, 3.3, -18], [77.1, 9, 18], C.glass, { transparency: 0.6 });
  b.span(V, 'Travessa Vidro', [76.8, 9, -18], [77.2, 9.3, 18], C.steel);
  for (let z = -18; z <= 18; z += 6)
    b.span(V, 'Divisória Cabine', [72, 0.1, z - 0.15], [82, 7.5, z + 0.15], C.wallTrim);
  for (let z = -15; z <= 15; z += 6) {
    for (const x of [74, 80]) {
      b.box(V, 'Banqueta Coluna', [x, 0.8, z], [0.4, 1.4, 0.4], C.steel);
      b.box(V, 'Banqueta Assento', [x, 1.65, z], [1.4, 0.3, 1.4], C.wood);
    }
  }
  for (const z of [-15, 0, 15]) panelLight(b, V, 77, F2 - 1, z);

  // paredes da sala de visitas (porta em cada lado da escada) e do depósito de uniformes
  for (const s of [-1, 1]) {
    const zs = (a, c) => (s < 0 ? [-c, -a] : [a, c]);
    const [v0, v1] = zs(SH + 0.8, E);
    wallRun(b, V, 'z', v0, v1, STAIR_X1, STAIR_X1 + 0.6, 0, F2 - 1, [s < 0 ? door(-20, -16) : door(16, 20)]);
    b.span(V, 'Parede Fundo Visitas', [STAIR_X1 + 0.6, 0, s * E], [IN_X, F2 - 1, s * (E + 0.6)], C.wall);
    const U = `Salas/Uniformes ${s < 0 ? 'Sul' : 'Norte'}`;
    const [u0, u1] = zs(E, IN_Z);
    wallRun(b, U, 'z', u0, u1, STAIR_X1, STAIR_X1 + 0.6, 0, F2 - 1, [s < 0 ? door(-32, -28) : door(28, 32)]);
    // o vão entre a última cela e o mezanino é fechado (não é uma cela faltando)
    b.span(
      'Estrutura/Paredes',
      'Parede Técnica',
      [ROW, 0, s * CELL_FRONT],
      [STAIR_X1, F2 - 1, s * (CELL_FRONT + 0.6)],
      C.wall,
    );
  }

  // --- Estoque de uniformes sob o mezanino (estantes) -----------------------
  for (const s of [-1, 1]) {
    const D = `Salas/Uniformes ${s < 0 ? 'Sul' : 'Norte'}`;
    for (const z of [30, 40, 50]) rack(b, D, 77, s * z, 10, 3.5, 11, 'roupas');
    panelLight(b, D, 77, F2 - 1, s * 35);
    panelLight(b, D, 77, F2 - 1, s * 45, 5, 1.4, false);
  }

  // --- Salas do 2º andar: mezanino leste ---------------------------------------
  const y2 = F2;
  const RH = UPPER_CEIL - F2; // 16
  const LX = STAIR_X1 + 6; // 72: frente das salas do mezanino (atrás do patamar)
  // Sala de Controle (vidraça voltada para o vão)
  const CT = 'Salas/Controle';
  wallRun(b, CT, 'z', -12, 12, LX, LX + 0.6, y2, RH, [win(-11, -3, 3, 11), door(-2, 2), win(3, 11, 3, 11)]);
  for (const s of [-1, 1]) b.span(CT, 'Parede Lateral', [LX, y2, s * 12], [IN_X, y2 + RH, s * 12.6], C.wall);
  b.span(CT, 'Forro', [LX, UPPER_CEIL, -12.6], [IN_X, UPPER_CEIL + 1, 12.6], C.cellWall, { group: 'Teto' });
  for (const s of [-1, 1]) {
    const [c0, c1] = s < 0 ? [-10, -3] : [3, 10];
    b.span(CT, 'Console', [LX + 1.5, y2 + 0.1, c0], [LX + 4.5, y2 + 3, c1], C.facade);
    b.span(CT, 'Tampo Console', [LX + 1.3, y2 + 3, c0 - 0.2], [LX + 4.7, y2 + 3.3, c1 + 0.2], C.steelLight);
    for (const m of [c0 + 1, c0 + 4]) {
      b.span(CT, 'Monitor', [LX + 3.8, y2 + 3.3, m], [LX + 4.2, y2 + 5.3, m + 2], C.steel, { canCollide: false });
    }
  }
  b.span(CT, 'Parede de Monitores', [IN_X - 0.3, y2 + 4, -8], [IN_X, y2 + 10, 8], C.steel, { canCollide: false });
  for (const z of [-6, 6]) panelLight(b, CT, 80, UPPER_CEIL, z);
  // Diretoria (norte) e Arquivo (sul)
  for (const s of [-1, 1]) {
    const R2 = s > 0 ? 'Salas/Diretoria' : 'Salas/Arquivo';
    const zs = (a, c) => (s < 0 ? [-c, -a] : [a, c]);
    const [r0, r1] = zs(12.6, 32);
    wallRun(b, R2, 'z', r0, r1, LX, LX + 0.6, y2, RH, [s < 0 ? door(-30, -26) : door(26, 30)]);
    b.span(R2, 'Parede Fundo', [LX, y2, s * 32], [IN_X, y2 + RH, s * 32.6], C.wall);
    b.span(R2, 'Forro', [LX, UPPER_CEIL, s * 12.6], [IN_X, UPPER_CEIL + 1, s * 32.6], C.cellWall, { group: 'Teto' });
    panelLight(b, R2, 80, UPPER_CEIL, s * 22);
    if (s > 0) {
      b.span(R2, 'Mesa', [79, y2 + 2.5, 19], [86, y2 + 2.8, 23], C.wood);
      for (const lx of [79.5, 85]) b.span(R2, 'Mesa Pé', [lx, y2 + 0.1, 19.5], [lx + 0.5, y2 + 2.5, 22.5], C.steel);
      rack(b, R2, 81, 14.5, 10, 2.5, 9, 'livros', y2 + 0.1);
    } else {
      for (let k = 0; k < 6; k++) {
        b.span(R2, 'Arquivo de Aço', [74 + k * 2, y2 + 0.1, -32], [76 + k * 2, y2 + 5, -30.4], C.steelLight);
      }
      b.span(R2, 'Mesa', [78, y2 + 2.5, -22], [86, y2 + 2.8, -18], C.wood);
      for (const lx of [78.5, 85]) b.span(R2, 'Mesa Pé', [lx, y2 + 0.1, -21.5], [lx + 0.5, y2 + 2.5, -18.5], C.steel);
    }
  }
  // Sala de Descanso (norte) e Vestiário (sul), atrás da galeria; incluem o vão depois da última cela
  for (const s of [-1, 1]) {
    const R3 = s > 0 ? 'Salas/Descanso' : 'Salas/Vestiário';
    wallRun(b, R3, 'x', ROW, IN_X, s * UPPER_FRONT, s * (UPPER_FRONT + 0.6), y2, RH, [
      door(70, 74),
      win(76, 86, 3, 11),
    ]);
    b.span(R3, 'Forro', [ROW, UPPER_CEIL, s * UPPER_FRONT], [IN_X, UPPER_CEIL + 1, s * IN_Z], C.cellWall, {
      group: 'Teto',
    });
    panelLight(b, R3, 77, UPPER_CEIL, s * 52);
    if (s > 0) {
      b.span(R3, 'Sofá Assento', [74, y2 + 0.1, 54], [84, y2 + 1.6, 57], C.blanket);
      b.span(R3, 'Sofá Encosto', [74, y2 + 0.1, 57], [84, y2 + 3.5, 58.2], C.blanket);
      b.span(R3, 'Mesa de Centro', [76, y2 + 0.1, 49], [82, y2 + 1.4, 51.5], C.wood);
      b.span(R3, 'Geladeira', [85, y2 + 0.1, 46], [87.5, y2 + 6.5, 48.5], C.porcelain);
    } else {
      for (let k = 0; k < 9; k++) {
        b.span(R3, 'Armário', [68 + k * 2, y2 + 0.1, -IN_Z], [70 + k * 2, y2 + 7, -IN_Z + 1.6], C.steelLight);
      }
      b.span(R3, 'Banco', [70, y2 + 0.1, -53], [84, y2 + 1.6, -51.6], C.wood);
    }
  }

  // --- Salas do 2º andar: cantos oeste (Biblioteca e Sala de Aula) -----------
  for (const s of [-1, 1]) {
    const R4 = s > 0 ? 'Salas/Biblioteca' : 'Salas/Sala de Aula';
    wallRun(b, R4, 'x', -IN_X, -ROW, s * UPPER_FRONT, s * (UPPER_FRONT + 0.6), y2, RH, [
      win(-86, -79, 3, 11),
      door(-76, -72),
    ]);
    b.span(R4, 'Forro', [-IN_X, UPPER_CEIL, s * UPPER_FRONT], [-ROW, UPPER_CEIL + 1, s * IN_Z], C.cellWall, {
      group: 'Teto',
    });
    panelLight(b, R4, -74, UPPER_CEIL, s * 52);
    if (s > 0) {
      rack(b, R4, -80, 57.5, 10, 2.5, 9, 'livros', y2);
      rack(b, R4, -67, 57.5, 10, 2.5, 9, 'livros', y2);
      b.span(R4, 'Mesa de Leitura', [-80, y2 + 2.5, 49], [-72, y2 + 2.8, 52], C.wood);
      for (const lx of [-79.5, -73]) b.span(R4, 'Mesa Pé', [lx, y2, 49.5], [lx + 0.5, y2 + 2.5, 51.5], C.steel);
    } else {
      for (const dx of [-84, -78, -72]) {
        for (const dz of [-51, -56]) {
          b.span(R4, 'Carteira', [dx - 1.2, y2 + 2.4, dz - 0.8], [dx + 1.2, y2 + 2.7, dz + 0.8], C.wood);
          b.span(R4, 'Carteira Pé', [dx - 0.2, y2, dz - 0.2], [dx + 0.2, y2 + 2.4, dz + 0.2], C.steel);
        }
      }
      b.span(R4, 'Mesa do Professor', [-68, y2 + 2.5, -55], [-63, y2 + 2.8, -50], C.wood);
      for (const lz of [-54.5, -51]) b.span(R4, 'Mesa Pé', [-67.5, y2, lz], [-63.5, y2 + 2.5, lz + 0.5], C.steel);
      b.span(R4, 'Quadro', [-IN_X, y2 + 4, -56], [-IN_X + 0.3, y2 + 9, -48], C.steel, { canCollide: false });
    }
  }

  // --- Ala oeste: corredor de serviço + refeitório + almoxarifado + enfermaria --
  const AO = 'Ala Oeste';
  // forro das salas (o vão acima fica fechado entre as paredes e o teto)
  b.span(`${AO}/Forro`, 'Laje Ala', [WING_X0, WC, -IN_Z], [WING_X1, WC + 1, IN_Z], C.cellWall, { group: 'Teto' });

  // Corredor de serviço (z -6..6) com faixas no piso, ligado ao hall pelo vão da parede do bloco
  const CS = `${AO}/Corredor de Serviço`;
  b.span(CS, 'Piso Corredor', [WING_X0, 0, -6], [WING_X1, 0.1, 6], C.floorCorridor);
  for (const z of [-3.2, 0, 3.2]) {
    b.span(CS, 'Faixa Piso', [WING_X0, 0.1, z - 0.8], [WING_X1, 0.15, z + 0.8], C.wallTrim, { canCollide: false });
  }
  // parede norte: janela para o refeitório + porta
  const RN = `${AO}/Refeitório`;
  b.span(RN, 'Parede Janela O', [WING_X0, 0, 6], [-145, WC, 6.6], C.wall);
  b.span(RN, 'Peitoril', [-145, 0, 6], [-131, 4, 6.6], C.wall);
  b.span(RN, 'Verga Janela', [-145, 11, 6], [-131, WC, 6.6], C.wall);
  b.span(RN, 'Vidro', [-145, 4, 6.2], [-131, 11, 6.4], C.glass, { transparency: 0.6 });
  b.span(RN, 'Caixilho E', [-145, 4, 5.95], [-144.8, 11, 6.65], C.steel);
  b.span(RN, 'Caixilho D', [-131.2, 4, 5.95], [-131, 11, 6.65], C.steel);
  b.span(RN, 'Caixilho Topo', [-145, 10.8, 5.95], [-131, 11, 6.65], C.steel);
  b.span(RN, 'Caixilho Base', [-145, 4, 5.95], [-131, 4.2, 6.65], C.steel);
  wallX(b, RN, -131, WING_X1, 6, 6.6, WC, [[-126, -114, 12]]);
  // parede sul: portas do almoxarifado e da enfermaria
  wallX(b, `${AO}/Corredor de Serviço`, WING_X0, WING_X1, -6.6, -6, WC, [
    [-135, -127, 12],
    [-109, -101, 12],
  ]);
  for (const x of [-140, -120, -100]) panelLight(b, `Iluminação/Corredor de Serviço`, x, WC, 0);

  // Refeitório (norte): balcão de servir, quadros de cardápio e mesas redondas
  b.span(RN, 'Piso Refeitório', [WING_X0, 0, 6.6], [WING_X1, 0.1, IN_Z], C.floorAtrium, { studs: true });
  // balcão de servir na parede do fundo, com quadros de cardápio iluminados
  b.span(RN, 'Balcão de Servir', [-140, 0.1, 54], [-100, 3.5, 57], C.facade);
  b.span(RN, 'Tampo Balcão', [-140.3, 3.5, 53.7], [-99.7, 3.8, 57.3], C.steelLight);
  b.span(RN, 'Vidro Protetor', [-140, 3.8, 54.4], [-100, 7, 54.6], C.glass, { transparency: 0.6 });
  for (const x of [-132, -120, -108]) {
    b.span(RN, 'Quadro Cardápio', [x - 4, 8, IN_Z - 0.3], [x + 4, 13, IN_Z], C.steel);
    b.span(RN, 'Lâmpada do Quadro', [x - 3.6, 13, IN_Z - 0.5], [x + 3.6, 13.3, IN_Z], C.neon, {
      canCollide: false,
      material: 'Neon',
    });
  }
  // 8 mesas em 2 fileiras, com corredor largo entre elas
  for (const tx of [-142, -127, -112, -97]) for (const tz of [18, 42]) diningTable(b, RN, tx, tz);
  for (const x of [-142, -127, -112, -97]) {
    for (const z of [14, 30, 46]) {
      panelLight(
        b,
        'Iluminação/Refeitório',
        x,
        WC,
        z,
        5,
        1.4,
        z === 30 || (z === 14 && x === -127) || (z === 46 && x === -112),
      );
    }
  }

  // Almoxarifado (sudoeste): estantes em fileiras com corredor central e caixas perto da porta
  const AX = `${AO}/Almoxarifado`;
  b.span(AX, 'Divisória Enfermaria', [-118, 0, -IN_Z], [-117.4, WC, -6.6], C.wall);
  for (const rx of [-145, -124]) for (const rz of [-54, -44, -34, -24]) rack(b, AX, rx, rz);
  crate(b, AX, -147, 0, -14);
  crate(b, AX, -142.8, 0, -14);
  crate(b, AX, -144.9, 4, -14);
  for (const x of [-145, -124]) {
    for (const z of [-44, -24]) panelLight(b, 'Iluminação/Almoxarifado', x, WC, z, 5, 1.4, z === -24);
  }

  // Enfermaria (sudeste da ala): leitos com divisórias, balcão e armário
  const EF = `${AO}/Enfermaria`;
  b.span(EF, 'Piso Enfermaria', [-117.4, 0, -IN_Z], [WING_X1, 0.1, -6.6], C.cellFloor);
  for (const bx of [-111, -103, -95]) {
    b.span(EF, 'Leito Base', [bx - 1.8, 0.1, -59.6], [bx + 1.8, 1.6, -52.6], C.steel);
    b.span(EF, 'Leito Colchão', [bx - 1.7, 1.6, -59.5], [bx + 1.7, 2.1, -52.7], C.sheet);
    b.span(EF, 'Leito Cobertor', [bx - 1.75, 2.1, -57.5], [bx + 1.75, 2.3, -52.65], C.blanket);
    b.span(EF, 'Leito Travesseiro', [bx - 1.3, 2.1, -59.3], [bx + 1.3, 2.5, -58], C.sheet);
    b.span(EF, 'Leito Cabeceira', [bx - 1.8, 0.1, -IN_Z], [bx + 1.8, 3.5, -59.6], C.steel);
  }
  for (const px of [-107, -99]) b.span(EF, 'Divisória Leito', [px - 0.1, 0.1, -IN_Z], [px + 0.1, 7, -50], C.cellWall);
  b.span(EF, 'Balcão', [-100, 0.1, -14], [-92, 3.5, -11], C.facade);
  b.span(EF, 'Tampo Balcão', [-100.3, 3.5, -14.3], [-91.7, 3.8, -10.7], C.steelLight);
  b.span(EF, 'Armário', [WING_X1 - 0.6, 3, -40], [WING_X1, 9, -30], C.steelLight);
  for (const x of [-110, -96]) {
    for (const z of [-45, -25]) panelLight(b, 'Iluminação/Enfermaria', x, WC, z, 5, 1.4, z === -45);
  }

  return { parts: b.parts };
}
