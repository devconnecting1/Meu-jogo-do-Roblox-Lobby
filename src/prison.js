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

// Túnel de acesso (anexo a oeste, fechado): portal no fim do corredor de serviço ->
// eclusa A (portão de emergência aberto) -> túnel -> eclusa B (mesmo portão, fechado).
const PORTAL = 6; // meia-largura do portal e do túnel (vão de 12, igual ao corredor de serviço)
const PORTAL_H = 12; // altura do portal e do túnel
const CH = 14; // meia-largura das eclusas
const CH_H = 16; // pé-direito das eclusas
const GA0 = OXW - 10; // -163: face da parede do portão A (fundo da eclusa de entrada)
const TUN0 = GA0 - W; // -165: começo do túnel
const TUN1 = TUN0 - 40; // -205: fim do túnel
const GB1 = TUN1 - W; // -207: face oeste da parede de entrada da eclusa B
const GB0 = GB1 - 10; // -217: face do portão B (fechado, para uma atualização futura)
const TX0 = GB0 - W; // -219: face externa do fundo do túnel
const RZ = CH + W + 14; // 30: fundo das salas laterais das eclusas (triagem, revista, máquinas, solitária)

// Abandono: celas destruídas (porta arrancada, janela estilhaçada, parede do fundo furada) e celas trancadas
export const WRECKED_CELLS = Object.freeze([4, 13, 20, 29]);
export const CLOSED_CELLS = Object.freeze([2, 11, 18, 23, 26, 31]);

// Desabamento do telhado sobre o átrio: o único lugar onde o lado de fora aparece (céu de noite)
export const ROOF_HOLE = Object.freeze({ x: [-4, 26], z: [-9, 9] });

// Abandono: rombo na parede do bloco (lado do hall), aberto para o vão escuro sobre a ala oeste
const BREACH = Object.freeze({ z: [18, 28], y: [24, 34] });

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

// Luz equilibrada (testado em tests/rojo.test.mjs): todas as luminárias entre 0,5 e 1,2 de brilho,
// com Ambient/Exposure baixos no default.project.json, para nada estourar com gráficos baixos.
const HANG_LIGHT = { type: 'Point', range: 28, brightness: 0.8, color: C.neonCold };
// luminária de galpão presa ao teto: ilumina o vão de pé-direito duplo de cima para baixo
const HIGH_BAY = { type: 'Surface', range: 50, brightness: 0.9, color: C.neonCold, angle: 110 };
const GALLERY_LIGHT = { type: 'Surface', range: 30, brightness: 0.8, color: C.neonCold, angle: 110 };
const WARN_LIGHT = { type: 'Point', range: 14, brightness: 0.6, color: C.neonWarn };
const FIXTURE_Y = ROOF - 1.4; // luminárias presas ao teto com haste curta (1,2)
const UPPER_CEIL = TOP; // forro das salas do 2º andar (mesma altura do topo das celas de cima)
const PANEL_LIGHT = { type: 'Surface', range: 18, brightness: 1, color: C.neonCold };
/** Estado de uma lâmpada: 'ok', 'dead' (queimada, sem luz) ou 'flicker' (pisca suave via script). */
const withState = (light, state) => (light && state === 'flicker' ? { ...light, flicker: true } : light);

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
    { name: 'Portal e eclusa de entrada (portão aberto)', min: [TUN0 - 1, 0.6, -5.5], max: [WING_X0 + 0.5, 11, 5.5] },
    { name: 'Túnel de acesso', min: [TUN1 + 0.5, 0.6, -5], max: [TUN0 - 0.5, 8, 5] },
    ...[
      ['Triagem', 1, -160, -154],
      ['Revista', -1, -159.8, -156.2],
      ['Casa de Máquinas', 1, -213.8, -210.2],
      ['Solitária', -1, -213.8, -209],
    ].flatMap(([n, s, x0, x1]) => {
      const zz = (a, c) => (s < 0 ? [-c, -a] : [a, c]);
      const door = n.startsWith('Casa') || n === 'Solitária' ? [-213.7, -210.3] : [-159.7, -156.3];
      const [d0, d1] = zz(CH - 2, CH + W + 2);
      const [r0, r1] = zz(CH + W + 0.5, 25);
      return [
        { name: `Porta da ${n}`, min: [door[0], 0.6, d0], max: [door[1], 9.6, d1] },
        { name: `Entrada da ${n}`, min: [x0, 0.6, r0], max: [x1, 8, r1] },
      ];
    }),
    { name: 'Eclusa do fundo (até o portão fechado)', min: [GB0 + 1.8, 0.6, -5], max: [TUN1 + 0.5, 8, 5] },
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
        const num = n++;
        const id = String(num).padStart(2, '0');
        if (CLOSED_CELLS.includes(num)) continue; // cela trancada: a porta fechada barra a passagem de propósito
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
/** Túnel de acesso: único anexo do prédio, também fechado (termina no portão B). */
export const TUNNEL = Object.freeze({ portal: [-PORTAL, PORTAL], portalTop: PORTAL_H, gateA: GA0, gateB: GB0 });
export const ANNEX = Object.freeze({ min: [TX0, -1, -RZ - W], max: [WING_X0, CH_H + 1, RZ + W] });
export const ANNEX_INTERIOR = Object.freeze({ min: [GB0, 0, -RZ], max: [WING_X0, CH_H, RZ] });

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
      if (op.broken) {
        // vidro estilhaçado: só sobram cacos presos nos cantos do caixilho
        const L = op.c - op.a;
        const glass = { transparency: 0.6 };
        seg('Vidro', op.a, op.a + L * 0.3, y0 + op.bottom, y0 + op.bottom + 2.2, wl + 0.2, wl + 0.4, C.glass, glass);
        seg('Vidro', op.c - L * 0.25, op.c, y0 + op.top - 2.8, y0 + op.top, wl + 0.2, wl + 0.4, C.glass, glass);
        seg('Vidro', op.c - L * 0.15, op.c, y0 + op.bottom, y0 + op.bottom + 1.2, wl + 0.2, wl + 0.4, C.glass, glass);
      } else {
        seg('Vidro', op.a, op.c, y0 + op.bottom, y0 + op.top, wl + 0.2, wl + 0.4, C.glass, { transparency: 0.6 });
      }
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

/**
 * Luminária pendente: carcaça + UM tubo + hastes até o teto. Regra (testada): só brilha (Neon) o tubo
 * que emite luz de verdade; lâmpada sem luz é queimada (Plastic escuro), nunca um Neon "de enfeite".
 */
function hangingLight(b, model, x, y, z, light = HANG_LIGHT, state = 'ok') {
  const stem = ROOF - (y + 0.2);
  const dead = state === 'dead' || !light;
  b.box(model, 'Carcaça', [x, y, z], [8, 0.4, 1.8], C.steel, { canCollide: false });
  b.box(model, 'Tubo', [x, y - 0.3, z], [7.6, 0.25, 1.1], dead ? C.lampDead : C.neonCold, {
    canCollide: false,
    material: dead ? 'Plastic' : 'Neon',
    light: dead ? null : withState(light, state),
  });
  for (const o of [-1.9, 1.9]) {
    b.box(model, 'Haste', [x + o * 1.4, y + 0.2 + stem / 2, z], [0.3, stem, 0.3], C.steel, { canCollide: false });
  }
}

/**
 * Portão de emergência bipartido: duas folhas que correm em sentidos opostos num trilho
 * superior e se encontram no meio do vão (fecham "dos dois lados ao mesmo tempo").
 * Montado na face x = fx de uma parede, do lado s (+1: x > fx), cobrindo o vão |z| < PORTAL.
 * As folhas são peças separadas ('Folha Esquerda'/'Folha Direita') para um script futuro
 * animar o fechamento simultâneo; aqui ficam paradas, abertas (open) ou fechadas.
 */
function emergencyGate(b, model, fx, s, open, floorY = 0.1) {
  const sp = (name, xa, xc, y0, y1, z0, z1, color, opts) => {
    const [x0, x1] = [fx + s * xa, fx + s * xc].sort((p, q) => p - q);
    b.span(model, name, [x0, y0, z0], [x1, y1, z1], color, opts);
  };
  const top = PORTAL_H + 0.2; // base do trilho (acima do vão)
  const reach = CH - 0.6; // o trilho vai de coluna a coluna
  const leaf = PORTAL + 0.4; // cada folha cobre metade do vão + 0,4 de encosto
  const deco = { canCollide: false };
  sp('Trilho Superior', 0, 1.3, top, top + 1.2, -reach, reach, C.steel, { surface: 'Inlet' });
  sp('Trilho do Piso', 0, 1.1, floorY, floorY + 0.25, -reach, reach, C.steel, { surface: 'Inlet' });
  // faixa de alerta zebrada na frente do trilho
  sp('Faixa de Alerta', 1.3, 1.4, top + 0.2, top + 1, -reach + 0.2, reach - 0.2, C.hazard, deco);
  for (let z = -reach + 0.6; z + 1 <= reach - 0.2; z += 2.4) {
    sp('Listra de Alerta', 1.4, 1.45, top + 0.2, top + 1, z, z + 1, C.steel, deco);
  }
  for (const z of [-1, 1]) {
    const [z0, z1] = z < 0 ? [-CH, -reach] : [reach, CH];
    sp('Coluna do Portão', 0, 1.4, floorY, top + 1.2, z0, z1, C.steel, { surface: 'Inlet' });
    // uma luz de alerta acesa; a outra está quebrada (sem luz, então sem brilho)
    sp('Luz de Alerta', 0.3, 1.1, top + 1.2, top + 1.8, z0, z1, z < 0 ? C.neonWarn : C.lampDead, {
      canCollide: false,
      material: z < 0 ? 'Neon' : 'Plastic',
      light: z < 0 ? WARN_LIGHT : null,
    });
  }
  const gap = PORTAL + 0.2;
  const leaves = open
    ? [
        ['Folha Esquerda', -(gap + leaf), -gap],
        ['Folha Direita', gap, gap + leaf],
      ]
    : [
        ['Folha Esquerda', -leaf, 0],
        ['Folha Direita', 0, leaf],
      ];
  for (const [n, z0, z1] of leaves) {
    sp(n, 0.15, 0.75, floorY + 0.25, top, z0, z1, C.steel, { surface: 'Weld' });
    sp('Faixa da Folha', 0.75, 0.9, floorY + 0.8, floorY + 1.6, z0 + 0.3, z1 - 0.3, C.hazard, deco);
    for (const y of [3, 6.5, 10]) {
      sp('Reforço', 0.75, 0.95, floorY + y, floorY + y + 0.6, z0 + 0.3, z1 - 0.3, C.steelLight, deco);
    }
  }
}

/** Painel embutido; ceilingY = face inferior do teto onde ele encosta. */
function panelLight(b, model, x, ceilingY, z, w = 5, d = 1.4, light = true) {
  // light: true (acesa), 'flicker' (pisca) ou false/'dead' (apagada: Plastic escuro, sem brilho falso)
  const dead = light === 'dead' || light === false;
  b.box(model, 'Moldura', [x, ceilingY - 0.05, z], [w + 0.4, 0.1, d + 0.4], C.steel, { canCollide: false });
  b.box(model, 'Painel', [x, ceilingY - 0.15, z], [w, 0.12, d], dead ? C.lampDead : C.neonCold, {
    canCollide: false,
    material: dead ? 'Plastic' : 'Neon',
    light: light === true ? PANEL_LIGHT : light === 'flicker' ? withState(PANEL_LIGHT, 'flicker') : null,
  });
}

/** Gerador pseudoaleatório determinístico: a mesma montagem sai sempre igual. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

/** Monte de entulho no piso: blocos soltos (sem colisão), girados só em Y. */
function rubble(b, model, x, z, seed, { n = 7, spread = 2, floorY = 0, big = 1.4 } = {}) {
  const r = rng(seed);
  const cols = [C.debris, C.debrisDark, C.wall];
  for (let k = 0; k < n; k++) {
    const sx = 0.4 + r() * big;
    const sy = 0.3 + r() * big * 0.6;
    const sz = 0.4 + r() * big;
    const px = x + (r() - 0.5) * spread * 2;
    const pz = z + (r() - 0.5) * spread * 2;
    const rot = Math.round(r() * 7) * 11.25;
    b.box(model, 'Entulho', [px, floorY + sy / 2, pz], [sx, sy, sz], cols[k % 3], {
      canCollide: false,
      rotation: rot ? [0, rot, 0] : null,
    });
  }
}

/**
 * Mancha colada numa parede (umidade, mofo, ferrugem): 3 retângulos sobrepostos da mesma cor.
 * axis 'x': a parede é o plano x = at e a mancha cresce para dir; u = coordenada z. axis 'z': o contrário.
 */
function stain(b, model, axis, at, dir, u, y, w, h, color, seed) {
  const r = rng(seed);
  const [a, c] = [at, at + dir * 0.04].sort((p, q) => p - q);
  for (let k = 0; k < 3; k++) {
    const ww = w * (0.45 + r() * 0.55);
    const hh = h * (0.5 + r() * 0.5);
    const uu = u + (r() - 0.5) * (w - ww);
    const yy = y + (r() - 0.5) * (h - hh);
    const [u0, u1, y0, y1] = [uu - ww / 2, uu + ww / 2, yy - hh / 2, yy + hh / 2];
    const lo = axis === 'x' ? [a, y0, u0] : [u0, y0, a];
    const hi = axis === 'x' ? [c, y1, u1] : [u1, y1, c];
    b.span(model, 'Mancha', lo, hi, color, { canCollide: false });
  }
}

/** Coluna rachada: o meio perdeu o reboco, mostra o núcleo e os vergalhões, mas continua de pé. */
function brokenColumn(b, x, z) {
  const M = 'Estrutura/Colunas';
  const h = COL / 2;
  const [g0, g1] = [10, 13.6];
  b.span(M, 'Coluna', [x - h, 0, z - h], [x + h, g0, z + h], C.column);
  b.span(M, 'Coluna', [x - h, g1, z - h], [x + h, ROOF, z + h], C.column);
  b.span(M, 'Núcleo Exposto', [x - 0.8, g0, z - 0.8], [x + 0.8, g1, z + 0.8], C.debrisDark);
  for (const [dx, dz] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    b.span(
      M,
      'Vergalhão',
      [x + dx * 1.1 - 0.1, g0, z + dz * 1.1 - 0.1],
      [x + dx * 1.1 + 0.1, g1, z + dz * 1.1 + 0.1],
      C.rust,
    );
  }
  // pedaços que ainda seguram (presos embaixo e em cima)
  b.span(M, 'Pedaço da Coluna', [x - h, g0, z - h], [x + 0.3, g0 + 1.4, z + h], C.column);
  b.span(M, 'Pedaço da Coluna', [x + 0.2, g1 - 1, z - h], [x + h, g1, z + 0.4], C.column);
}

/**
 * Coluna desabada: a parte de cima quebrou e caiu. Fica o toco com vergalhões para cima, o topo
 * partido preso no capitel/viga, e o fuste caído no chão em 3 pedaços ao longo da linha das colunas.
 */
function collapsedColumn(b, x, z) {
  const M = 'Estrutura/Colunas';
  const h = COL / 2;
  const [cut0, cut1] = [6.5, 35];
  b.span(M, 'Toco da Coluna', [x - h, 0, z - h], [x + h, cut0, z + h], C.column);
  b.span(M, 'Pedaço da Coluna', [x - h, cut0, z - h], [x + 0.2, cut0 + 1.4, z + 0.6], C.column);
  b.span(M, 'Pedaço da Coluna', [x + 0.5, cut0, z - 0.4], [x + h, cut0 + 0.6, z + h], C.column);
  // o topo partido ficou preso na viga: é montado junto com o teto (fase "teto" do manual)
  const MT = 'Estrutura/Teto';
  b.span(MT, 'Coluna Partida (topo)', [x - h, cut1, z - h], [x + h, ROOF, z + h], C.column);
  b.span(MT, 'Pedaço da Coluna', [x - h, cut1 - 1.1, z - h], [x + 0.4, cut1, z + h], C.column);
  b.span(MT, 'Pedaço da Coluna', [x + 0.6, cut1 - 0.7, z - h], [x + h, cut1, z + 0.3], C.column);
  for (const [dx, dz] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    const [vx, vz] = [x + dx * 1.1, z + dz * 1.1];
    b.span(M, 'Vergalhão', [vx - 0.1, cut0, vz - 0.1], [vx + 0.1, cut0 + 3.2, vz + 0.1], C.rust);
    b.span(MT, 'Vergalhão', [vx - 0.1, cut1 - 2.6, vz - 0.1], [vx + 0.1, cut1, vz + 0.1], C.rust);
  }
  // o fuste caído: dois pedaços inteiros (com colisão, fora das passagens) e um torto no meio
  const R = 'Ruínas/Coluna Caída';
  b.span(R, 'Coluna Caída', [x + 2.4, 0, z - h], [x + 12.4, COL, z + h], C.column);
  b.box(R, 'Coluna Caída', [x + 17.5, COL / 2, z], [9.5, COL, COL], C.column, {
    canCollide: false,
    rotation: [0, 9, 0],
  });
  b.span(R, 'Coluna Caída', [x + 23, 0, z - h + 0.1], [x + 27.6, COL, z + h - 0.1], C.column);
  for (const [rx, rz, seed] of [
    [x + 1.5, z - 2.6, 201],
    [x + 13.5, z - 2.8, 202],
    [x + 21, z + 2.6, 203],
    [x, z + 3, 204],
  ]) {
    rubble(b, R, rx, rz, seed, { n: 8, spread: 1.4, big: 1.6 });
  }
}

/** Poça d'água parada no piso (topo em floorY). */
function puddle(b, model, x, z, w, d, floorY, seed) {
  const r = rng(seed);
  for (let k = 0; k < 2; k++) {
    const ww = w * (0.6 + r() * 0.4);
    const dd = d * (0.6 + r() * 0.4);
    const px = x + (r() - 0.5) * (w - ww);
    const pz = z + (r() - 0.5) * (d - dd);
    // a base fica 0,02 dentro do piso: assim não divide plano com entulho, musgo ou lajes caídas
    b.span(
      model,
      'Poça',
      [px - ww / 2, floorY - 0.02, pz - dd / 2],
      [px + ww / 2, floorY + 0.04, pz + dd / 2],
      C.puddle,
      {
        canCollide: false,
      },
    );
  }
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
  const wrecked = WRECKED_CELLS.includes(number);
  const closed = CLOSED_CELLS.includes(number);
  if (wrecked) {
    // vidro estilhaçado: sobraram cacos presos nos cantos, o resto está no chão
    r('Vidro Janela', -6, -4.4, 3, 5.6, 0.2, 0.4, C.glass, { transparency: 0.7 });
    r('Vidro Janela', -0.6, 1, 7.4, 11, 0.2, 0.4, C.glass, { transparency: 0.7 });
    for (const [a, c, d0] of [
      [-6.6, -5.6, 1.2],
      [-3.2, -2.1, 2.4],
      [-1.4, -0.6, 1.6],
      [3.6, 4.4, 4.4],
    ]) {
      r('Caco de Vidro', a, c, 0.1, 0.15, d0, d0 + 0.7, C.glass, { canCollide: false, transparency: 0.5 });
    }
  } else {
    r('Vidro Janela', -6, 1, 3, 11, 0.2, 0.4, C.glass, { transparency: 0.7 });
  }
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
  if (wrecked) {
    // porta arrancada do trilho e jogada dentro da cela (deitada: a altura vira comprimento em x)
    const lay = (name, a, c, ya, yb) =>
      r(name, -5 + (ya - 0.5), -5 + (yb - 0.5), 0.1, 0.4, 1.2 + (a - 5.6), 1.2 + (c - 5.6), C.steel, deco);
    lay('Porta Topo', 5.6, 8, 9.7, 10);
    lay('Porta Base', 5.6, 8, 0.5, 0.8);
    lay('Porta Montante E', 5.6, 5.85, 0.5, 10);
    lay('Porta Montante D', 7.75, 8, 0.5, 10);
    lay('Porta Travessa', 5.6, 8, 5, 5.3);
    for (const bx of [6.3, 6.8, 7.3]) lay('Porta Barra', bx - 0.1, bx + 0.1, 0.8, 9.7);
  } else if (closed) {
    // cela trancada: a grade fechada cobre todo o vão da porta (com colisão) e tem cadeado
    r('Porta Topo', 2.2, 5.3, 9.7, 10, -0.35, 0, C.steel);
    r('Porta Base', 2.2, 5.3, 0.5, 0.8, -0.35, 0, C.steel);
    r('Porta Montante E', 2.2, 2.45, 0.5, 10, -0.35, 0, C.steel);
    r('Porta Montante D', 5.05, 5.3, 0.5, 10, -0.35, 0, C.steel);
    r('Porta Travessa', 2.2, 5.3, 5, 5.3, -0.35, 0, C.steel);
    for (const bx of [2.95, 3.5, 4.05, 4.55]) r('Porta Barra', bx - 0.1, bx + 0.1, 0.8, 9.7, -0.3, -0.05, C.steel);
    r('Cadeado', 4.7, 5.3, 4.4, 5.1, -0.6, -0.35, C.steelLight, deco);
  } else {
    r('Porta Topo', 5.6, 8, 9.7, 10, -0.35, 0, C.steel, deco);
    r('Porta Base', 5.6, 8, 0.5, 0.8, -0.35, 0, C.steel, deco);
    r('Porta Montante E', 5.6, 5.85, 0.5, 10, -0.35, 0, C.steel, deco);
    r('Porta Montante D', 7.75, 8, 0.5, 10, -0.35, 0, C.steel, deco);
    r('Porta Travessa', 5.6, 8, 5, 5.3, -0.35, 0, C.steel, deco);
    for (const bx of [6.3, 6.8, 7.3]) r('Porta Barra', bx - 0.1, bx + 0.1, 0.8, 9.7, -0.3, -0.05, C.steel, deco);
  }

  // Interior
  // o piso termina na face da parede do fundo (atrás das celas do térreo há um vão de serviço)
  r('Piso', -7, 7, 0, 0.1, 0.6, D - 0.3, C.cellFloor);
  r('Revestimento E', -7, -6.8, 0, H, 0.6, D - 0.3, C.cellWall);
  r('Revestimento D', 6.8, 7, 0, H, 0.6, D - 0.3, C.cellWall);
  if (wrecked && y0 === 0) {
    // parede do fundo furada: aparece o vão de serviço escuro atrás das celas (interno, fechado)
    r('Parede Fundo', -7, 7, 0, 2.5, D - 0.3, D, C.cellBack);
    r('Parede Fundo', -7, 7, 9, H, D - 0.3, D, C.cellBack);
    r('Parede Fundo', -7, -4, 2.5, 9, D - 0.3, D, C.cellBack);
    r('Parede Fundo', 0, 7, 2.5, 9, D - 0.3, D, C.cellBack);
    r('Pedaço de Parede', -4, -3, 2.5, 4, D - 0.3, D, C.cellBack);
    r('Pedaço de Parede', -1.2, 0, 7.2, 9, D - 0.3, D, C.cellBack);
  } else {
    r('Parede Fundo', -7, 7, 0, H, D - 0.3, D, C.cellBack);
  }
  // celas abandonadas: 1 em cada 3 com a lâmpada queimada, duas piscando
  const lamp = wrecked || number % 3 === 0 ? 'dead' : [7, 22].includes(number) ? 'flicker' : true;
  panelLight(b, model, cx, y0 + H, zAt(7), 3.4, 1.8, lamp);

  // Cama
  r('Cama Base', -6.6, 0.4, 0.1, 1.4, 12.2, 15.6, C.steel);
  r('Cama Gaveta', -6.2, 0, 0.5, 0.9, 12.1, 12.2, C.steelLight, deco);
  if (wrecked) {
    // colchão e cobertor arrancados da cama, no chão; entulho espalhado
    r('Colchão', -1.5, 4, 0.1, 0.6, 4, 7.4, C.sheet, deco);
    r('Cobertor', 0.5, 3.6, 0.1, 0.3, 8, 10.5, C.blanket, deco);
    r('Travesseiro', -6.3, -4.9, 1.4, 1.9, 12.6, 15.2, C.sheet);
    rubble(b, `Ruínas/Cela ${id}`, cx - 2, zAt(9), 100 + number, { n: 6, spread: 1.4, floorY: y0 + 0.1, big: 0.9 });
  } else {
    r('Colchão', -6.5, 0.3, 1.4, 1.9, 12.3, 15.5, C.sheet);
    r('Cobertor', -4.3, 0.35, 1.9, 2.1, 12.25, 15.55, C.blanket);
    r('Travesseiro', -6.3, -4.9, 1.9, 2.4, 12.6, 15.2, C.sheet);
  }
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
  // parede oeste com o portal do túnel de acesso (o único vão da envoltória; o túnel é fechado)
  b.span(ENV, 'Parede Oeste S', [OXW, 0, -IN_Z], [WING_X0, ROOF, -PORTAL], C.wall, wo);
  b.span(ENV, 'Parede Oeste N', [OXW, 0, PORTAL], [WING_X0, ROOF, IN_Z], C.wall, wo);
  b.span(ENV, 'Parede Oeste Verga', [OXW, PORTAL_H, -PORTAL], [WING_X0, ROOF, PORTAL], C.wall, wo);
  // laje do teto com o desabamento sobre o átrio (ROOF_HOLE): o céu noturno aparece por ali
  const [hx0, hx1] = ROOF_HOLE.x;
  const [hz0, hz1] = ROOF_HOLE.z;
  const roof = { group: 'Teto' };
  b.span(ENV, 'Laje Teto Oeste', [OXW, ROOF, -OZ], [hx0, ROOF + 1, OZ], C.ceiling, roof);
  b.span(ENV, 'Laje Teto Leste', [hx1, ROOF, -OZ], [OX, ROOF + 1, OZ], C.ceiling, roof);
  b.span(ENV, 'Laje Teto Sul', [hx0, ROOF, -OZ], [hx1, ROOF + 1, hz0], C.ceiling, roof);
  b.span(ENV, 'Laje Teto Norte', [hx0, ROOF, hz1], [hx1, ROOF + 1, OZ], C.ceiling, roof);

  // Parede que separa o bloco de celas (hall) da ala oeste, com vão de 12 × 12
  const PB = 'Estrutura/Paredes';
  b.span(PB, 'Parede do Bloco S', [WING_X1, 0, -IN_Z], [-IN_X, ROOF, -6], C.wall, wo);
  // parede norte do bloco com um rombo (abandono): mostra o vão escuro sobre o forro da ala oeste
  const [bz0, bz1] = BREACH.z;
  const [by0, by1] = BREACH.y;
  b.span(PB, 'Parede do Bloco N', [WING_X1, 0, 6], [-IN_X, by0, IN_Z], C.wall, wo);
  b.span(PB, 'Parede do Bloco N Alta', [WING_X1, by1, 6], [-IN_X, ROOF, IN_Z], C.wall, wo);
  b.span(PB, 'Parede do Bloco N Lado S', [WING_X1, by0, 6], [-IN_X, by1, bz0], C.wall, wo);
  b.span(PB, 'Parede do Bloco N Lado N', [WING_X1, by0, bz1], [-IN_X, by1, IN_Z], C.wall, wo);
  // bordas irregulares do rombo (pedaços de parede) e o miolo exposto
  const RB = 'Ruínas/Rombo da Parede';
  for (const [za, zb, ya, yb] of [
    [bz0, bz0 + 2.5, by0, by0 + 1.6],
    [bz0 + 4, bz0 + 6, by0, by0 + 0.9],
    [bz1 - 2.5, bz1, by0, by0 + 2.2],
    [bz0, bz0 + 1.8, by1 - 1.6, by1],
    [bz0 + 5, bz0 + 8, by1 - 0.9, by1],
    [bz0, bz0 + 1.2, by0 + 3, by0 + 6.5],
    [bz1 - 1.4, bz1, by0 + 4, by0 + 7],
  ]) {
    b.span(RB, 'Pedaço de Parede', [WING_X1, ya, za], [-IN_X, yb, zb], C.wall);
  }
  b.span(RB, 'Miolo Exposto', [WING_X1 + 0.15, by0, bz0], [-IN_X - 0.15, by0 + 0.35, bz1], C.debrisDark);
  for (const z of [bz0 + 3.2, bz0 + 7.4]) {
    b.span(RB, 'Vergalhão', [WING_X1 + 0.4, by0, z], [WING_X1 + 0.6, by0 + 2.6, z + 0.2], C.rust);
  }
  b.span(PB, 'Parede do Bloco Verga', [WING_X1, 12, -6], [-IN_X, ROOF, 6], C.wall, wo);

  // Faixas internas das paredes (decorativas, sem colisão)
  const WB = 'Acabamento/Paredes';
  const band = { canCollide: false, group: 'Paredes' };
  const bands = [
    ['Rodapé Alto', 0, 3.5, C.wainscot, 'Inlet'],
    ['Capa do Rodapé', 3.5, 3.8, C.wallTrim, null, 0.2],
    ['Faixa Térreo', 13.6, 14.2, C.wallTrim],
    ['Faixa 2º Andar', F2 + 13.6, F2 + 14.2, C.wallTrim],
  ];
  for (const [x, dir] of [
    [-IN_X, 1],
    [IN_X, -1],
  ]) {
    for (const [n, ya, yb, col, surface, t = 0.1] of bands) {
      // no lado do hall a parede tem o vão para a ala oeste (z -6..6, até 12 de altura)
      const hitsBreach = x < 0 && ya < BREACH.y[1] && yb > BREACH.y[0];
      const zs =
        x < 0 && yb <= 12
          ? [
              [-IN_Z, -6],
              [6, IN_Z],
            ]
          : hitsBreach
            ? [
                [-IN_Z, BREACH.z[0]],
                [BREACH.z[1], IN_Z],
              ]
            : [[-IN_Z, IN_Z]];
      for (const [z0, z1] of zs) b.span(WB, n, [x, ya, z0], [x + dir * t, yb, z1], col, { ...band, surface });
    }
  }
  for (const s of [-1, 1]) {
    for (const [x0, x1] of [
      [-IN_X, -ROW],
      [ROW, IN_X],
    ]) {
      for (const [n, ya, yb, col, surface, t = 0.1] of bands) {
        b.span(WB, n, [x0, ya, s * IN_Z], [x1, yb, s * (IN_Z - t)], col, { ...band, surface });
      }
    }
    b.span(WB, 'Faixa Alta', [-IN_X, ROOF - 3.4, s * IN_Z], [IN_X, ROOF - 2.8, s * (IN_Z - 0.1)], C.wallTrim, band);
  }

  // --- Teto: vigas no ritmo das colunas ------------------------------------
  const T = 'Estrutura/Teto';
  const tg = { group: 'Teto' };
  for (const x of COLUMN_X)
    if (x > ROOF_HOLE.x[0] && x < ROOF_HOLE.x[1]) {
      // viga partida no desabamento: os dois lados ficam presos, com a ponta quebrada
      b.span(T, 'Viga Transversal', [x - 0.7, ROOF - 1.8, -IN_Z], [x + 0.7, ROOF, ROOF_HOLE.z[0]], C.beam, tg);
      b.span(T, 'Viga Transversal', [x - 0.7, ROOF - 1.8, ROOF_HOLE.z[1]], [x + 0.7, ROOF, IN_Z], C.beam, tg);
      const [zs0, zs1] = ROOF_HOLE.z;
      b.span(T, 'Viga Partida', [x - 0.5, ROOF - 1.3, zs0], [x + 0.4, ROOF, zs0 + 1.6], C.beam, tg);
      b.span(T, 'Viga Partida', [x - 0.3, ROOF - 0.9, zs1 - 1.1], [x + 0.6, ROOF, zs1], C.beam, tg);
    } else {
      b.span(T, 'Viga Transversal', [x - 0.7, ROOF - 1.8, -IN_Z], [x + 0.7, ROOF, IN_Z], C.beam, tg);
    }
  for (const z of [-E, E])
    b.span(T, 'Viga Longitudinal', [-IN_X, ROOF - 1.8, z - 0.7], [IN_X, ROOF, z + 0.7], C.beam, tg);

  // --- Colunas (a cada 2 celas, soltas no vão) ------------------------------
  for (const x of COLUMN_X) {
    for (const s of [-1, 1]) {
      if ((x === -30 && s < 0) || (x === 30 && s > 0)) brokenColumn(b, x, s * E);
      else if (x === 0 && s > 0) collapsedColumn(b, x, s * E);
      else b.box('Estrutura/Colunas', 'Coluna', [x, ROOF / 2, s * E], [COL, ROOF, COL], C.column);
      b.box('Estrutura/Colunas', 'Base Coluna', [x, 0.45, s * E], [COL + 0.6, 0.9, COL + 0.6], C.columnBase, {
        surface: 'Inlet',
      });
      // capitel clássico sob as vigas
      const capModel = x === 0 && s > 0 ? 'Estrutura/Teto' : 'Estrutura/Colunas'; // capitel da coluna desabada pende da viga
      b.box(capModel, 'Capitel', [x, ROOF - 2.4, s * E], [COL + 0.6, 1.2, COL + 0.6], C.columnBase, {
        surface: 'Inlet',
      });
    }
  }

  // --- Pisos do térreo -----------------------------------------------------
  const P = 'Pisos';
  // piso do átrio em xadrez clássico (11 × 4 placas de 11,5 × 11, studs)
  const TILE_X = (STAIR_X1 + ROW) / 11;
  const TILE_Z = (2 * (E - 2)) / 4;
  for (let i = 0; i < 11; i++) {
    for (let j = 0; j < 4; j++) {
      const x0 = -ROW + i * TILE_X;
      const z0 = -(E - 2) + j * TILE_Z;
      const col = (i + j) % 2 ? C.floorAtriumDark : C.floorAtrium;
      b.span(P, 'Piso Átrio', [x0, 0, z0], [x0 + TILE_X, 0.1, z0 + TILE_Z], col, { studs: true });
    }
  }
  // o piso começa atrás do fundo da escada (0,4), por dentro das paredes da sala: nenhuma face coplanar
  b.span(P, 'Piso Sala de Visitas', [STAIR_X1 + 0.4, 0, -E], [IN_X, 0.1, E], C.floorCorridor);
  for (const s of [-1, 1]) {
    const t = s < 0 ? 'Sul' : 'Norte';
    b.span(P, `Corredor ${t}`, [-IN_X, 0, s * (E + 2)], [STAIR_X1, 0.1, s * (CELL_FRONT - 1)], C.floorCorridor, {
      surface: 'Inlet',
    });
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
      const state =
        (side > 0 && (i === 2 || i === 7)) || (side < 0 && i === 5) ? 'dead' : side < 0 && i === 4 ? 'flicker' : 'ok';
      hangingLight(
        b,
        `Iluminação/Galeria ${t}`,
        lx,
        FIXTURE_Y,
        side * (CELL_FRONT + 5),
        GALLERY_LIGHT,
        i % 2 ? 'dead' : state,
      );
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
  for (const z of [-14, 14]) hangingLight(b, 'Iluminação/Hall', -74, FIXTURE_Y, z, HIGH_BAY, z < 0 ? 'flicker' : 'ok');

  // --- Salas do bloco (cantos oeste do térreo): guardas e rouparia ----------
  for (const s of [-1, 1]) {
    const D = s < 0 ? 'Salas/Rouparia' : 'Salas/Sala dos Guardas';
    const za = s * CELL_FRONT;
    const zb = s * (CELL_FRONT + 0.6);
    b.span(D, 'Parede Baixa', [-IN_X, 0, za], [-ROW, 3, zb], C.wall);
    b.span(D, 'Parede Alta', [-IN_X, 11, za], [-ROW, F2 - 1, zb], C.wall);
    b.span(D, 'Parede E', [-IN_X, 3, za], [-84, 11, zb], C.wall);
    b.span(D, 'Parede D', [-66, 3, za], [-ROW, 11, zb], C.wall);
    if (s > 0) {
      // sala dos guardas: o vidro estourou no incêndio; sobraram cacos nos cantos
      b.span(D, 'Vidro', [-84, 3, s * (CELL_FRONT + 0.2)], [-80.5, 6.5, s * (CELL_FRONT + 0.4)], C.glass, {
        transparency: 0.6,
      });
      b.span(D, 'Vidro', [-69.5, 7.6, s * (CELL_FRONT + 0.2)], [-66, 11, s * (CELL_FRONT + 0.4)], C.glass, {
        transparency: 0.6,
      });
    } else {
      b.span(D, 'Vidro', [-84, 3, s * (CELL_FRONT + 0.2)], [-66, 11, s * (CELL_FRONT + 0.4)], C.glass, {
        transparency: 0.6,
      });
    }
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
      b.span(D, 'Mesa', [-80, 2.8, 44], [-70, 3.1, 47], C.charred); // carbonizada no incêndio
      for (const lx of [-79.5, -71]) b.span(D, 'Mesa Pé', [lx, 0, 44.3], [lx + 0.5, 2.8, 46.7], C.steel);
      for (const mx of [-78, -74])
        b.span(D, 'Monitor', [mx, 3.1, 45.8], [mx + 2, 4.6, 46.2], C.steel, { canCollide: false });
      panelLight(b, D, -74, F2 - 1, 47, 5, 1.4, 'flicker');
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
    for (const z of [-(E + 5), -12, 12, E + 5]) {
      const k = `${x},${z}`;
      if (k === '-45,12') continue; // esta caiu no chão (Ruínas/Átrio)
      const state = ['-15,-29', '15,29', '45,-12', '-45,-29'].includes(k)
        ? 'dead'
        : ['-15,12', '45,12'].includes(k)
          ? 'flicker'
          : 'ok';
      hangingLight(b, 'Iluminação/Átrio', x, FIXTURE_Y, z, HIGH_BAY, state);
    }
  }

  // --- Sala de visitas (sob o mezanino) -------------------------------------
  const V = 'Sala de Visitas';
  b.span(V, 'Balcão', [76, 0.1, -18], [78, 3, 18], C.facade);
  b.span(V, 'Tampo', [75.8, 3, -18], [78.2, 3.3, 18], C.steelLight);
  // vidro do parlatório quebrado no meio (sobrou um caco baixo; os pedaços caíram no balcão e no chão)
  b.span(V, 'Vidro Divisor', [76.9, 3.3, -18], [77.1, 9, 0], C.glass, { transparency: 0.6 });
  b.span(V, 'Vidro Divisor', [76.9, 3.3, 6], [77.1, 9, 18], C.glass, { transparency: 0.6 });
  b.span(V, 'Vidro Divisor', [76.9, 3.3, 0], [77.1, 5.2, 1.4], C.glass, { transparency: 0.6 });
  b.span(V, 'Travessa Vidro', [76.8, 9, -18], [77.2, 9.3, 18], C.steel);
  for (let z = -18; z <= 18; z += 6)
    b.span(V, 'Divisória Cabine', [72, 0.1, z - 0.15], [82, 7.5, z + 0.15], C.wallTrim);
  for (let z = -15; z <= 15; z += 6) {
    for (const x of [74, 80]) {
      b.box(V, 'Banqueta Coluna', [x, 0.8, z], [0.4, 1.4, 0.4], C.steel);
      b.box(V, 'Banqueta Assento', [x, 1.65, z], [1.4, 0.3, 1.4], C.wood);
    }
  }
  for (const z of [-15, 0, 15]) panelLight(b, V, 77, F2 - 1, z, 5, 1.4, z === 15 ? 'dead' : true);

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
  // vidraça estilhaçada na invasão da sala de controle
  const broken = (w) => ({ ...w, broken: true });
  wallRun(b, CT, 'z', -12, 12, LX, LX + 0.6, y2, RH, [
    broken(win(-11, -3, 3, 11)),
    door(-2, 2),
    broken(win(3, 11, 3, 11)),
  ]);
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
  for (const x of [-140, -120, -100]) {
    panelLight(b, `Iluminação/Corredor de Serviço`, x, WC, 0, 5, 1.4, x === -120 ? 'dead' : true);
  }

  // Refeitório (norte): balcão de servir, quadros de cardápio e mesas redondas
  b.span(RN, 'Piso Refeitório', [WING_X0, 0, 6.6], [WING_X1, 0.1, IN_Z], C.floorAtrium, { studs: true });
  // balcão de servir na parede do fundo, com quadros de cardápio iluminados
  b.span(RN, 'Balcão de Servir', [-140, 0.1, 54], [-100, 3.5, 57], C.facade);
  b.span(RN, 'Tampo Balcão', [-140.3, 3.5, 53.7], [-99.7, 3.8, 57.3], C.steelLight);
  b.span(RN, 'Vidro Protetor', [-140, 3.8, 54.4], [-100, 7, 54.6], C.glass, { transparency: 0.6 });
  for (const x of [-132, -120, -108]) {
    b.span(RN, 'Quadro Cardápio', [x - 4, 8, IN_Z - 0.3], [x + 4, 13, IN_Z], C.steel);
    // a luz dos quadros queimou: sem emissão, sem brilho
    b.span(RN, 'Lâmpada do Quadro', [x - 3.6, 13, IN_Z - 0.5], [x + 3.6, 13.3, IN_Z], C.lampDead, {
      canCollide: false,
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
        z === 30 || (z === 14 && x === -127) || (z === 46 && x === -112)
          ? x === -112 && z === 30
            ? 'flicker'
            : true
          : x === -142 && z === 46
            ? 'dead'
            : false,
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
    for (const z of [-44, -24]) {
      const lamp = z === -24 ? (x === -124 ? 'flicker' : true) : x === -124 ? 'dead' : false;
      panelLight(b, 'Iluminação/Almoxarifado', x, WC, z, 5, 1.4, lamp);
    }
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
    for (const z of [-45, -25]) {
      const lamp = z === -45 ? (x === -96 ? 'flicker' : true) : x === -110 ? 'dead' : false;
      panelLight(b, 'Iluminação/Enfermaria', x, WC, z, 5, 1.4, lamp);
    }
  }

  // --- Túnel de acesso: portal -> eclusa A (portão aberto) -> túnel -> eclusa B (fechado) --
  const TE = 'Túnel/Envoltória';
  const tw = { group: 'Paredes' };
  const tt = { group: 'Teto' };
  b.span(TE, 'Laje do Túnel', [TX0, -1, -RZ - W], [OXW, 0, RZ + W], C.floor, { group: 'Piso' });
  for (const [n, x0, x1] of [
    ['A', TUN0, OXW],
    ['B', TX0, TUN1],
  ]) {
    // paredes laterais das eclusas, com a porta das salas laterais
    const dx = n === 'A' ? GA0 + 3 : GB0 + 3;
    for (const s of [-1, 1]) wallRun(b, TE, 'x', x0, x1, s * CH, s * (CH + W), 0, CH_H, [door(dx, dx + 4)]);
    b.span(TE, `Teto Eclusa ${n}`, [x0, CH_H, -CH - W], [x1, CH_H + 1, CH + W], C.ceiling, tt);
  }
  // paredes de passagem entre eclusas e túnel (vão de 12 × 12)
  for (const [n, x0, x1] of [
    ['A', TUN0, GA0],
    ['B', GB1, TUN1],
  ]) {
    for (const s of [-1, 1]) {
      b.span(TE, `Parede do Portal ${n}`, [x0, 0, s * PORTAL], [x1, CH_H, s * CH], C.tunnel, tw);
    }
    b.span(TE, `Verga do Portal ${n}`, [x0, PORTAL_H, -PORTAL], [x1, CH_H, PORTAL], C.tunnel, tw);
  }
  b.span(TE, 'Parede do Fundo', [TX0, 0, -CH], [GB0, CH_H, CH], C.tunnel, tw);
  for (const s of [-1, 1]) {
    b.span(TE, 'Parede do Túnel', [TUN1, 0, s * PORTAL], [TUN0, PORTAL_H, s * (PORTAL + W)], C.tunnel, tw);
  }
  b.span(TE, 'Teto do Túnel', [TUN1, PORTAL_H, -PORTAL - W], [TUN0, PORTAL_H + 1, PORTAL + W], C.ceiling, tt);

  const TP = 'Túnel/Pisos';
  b.span(TP, 'Soleira', [OXW, 0, -PORTAL], [WING_X0, 0.1, PORTAL], C.steelLight, { surface: 'Inlet' });
  b.span(TP, 'Piso Eclusa A', [GA0, 0, -CH], [OXW, 0.1, CH], C.floorCorridor, { surface: 'Inlet' });
  b.span(TP, 'Piso do Túnel', [GB1, 0, -PORTAL], [GA0, 0.1, PORTAL], C.floorCorridor, { surface: 'Inlet' });
  b.span(TP, 'Piso Eclusa B', [GB0, 0, -CH], [GB1, 0.1, CH], C.floorCorridor, { surface: 'Inlet' });
  for (const z of [-3.2, 0, 3.2]) {
    b.span(TP, 'Faixa Piso', [GB1, 0.1, z - 0.5], [GA0, 0.15, z + 0.5], C.wallTrim, { canCollide: false });
  }

  // estrutura do túnel: costelas de aço a cada 8 studs e rodapé com relevo
  const TS = 'Túnel/Estrutura';
  for (let x = TUN0 - 4; x > TUN1 + 1; x -= 8) {
    for (const s of [-1, 1]) {
      b.span(TS, 'Costela', [x - 0.3, 0.1, s * (PORTAL - 0.4)], [x + 0.3, PORTAL_H - 0.4, s * PORTAL], C.wallTrim, {
        surface: 'Inlet',
      });
    }
    b.span(TS, 'Costela Topo', [x - 0.3, PORTAL_H - 0.4, -PORTAL], [x + 0.3, PORTAL_H, PORTAL], C.wallTrim, {
      surface: 'Inlet',
    });
  }
  for (const s of [-1, 1]) {
    b.span(TS, 'Rodapé', [TUN1, 0.1, s * (PORTAL - 0.1)], [TUN0, 3.5, s * PORTAL], C.wainscot, {
      canCollide: false,
      surface: 'Inlet',
    });
  }

  // portões de emergência: o de entrada fica aberto; o do fundo é o mesmo portão, fechado
  emergencyGate(b, 'Túnel/Portão A (aberto)', GA0, 1, true);
  emergencyGate(b, 'Túnel/Portão B (fechado)', GB0, 1, false);

  // luz do túnel e das eclusas (mesmo patamar das outras salas)
  const TL = 'Túnel/Iluminação';
  for (let x = TUN0 - 8; x > TUN1 + 1; x -= 8) {
    panelLight(b, TL, x, PORTAL_H, 0, 5, 1.4, x === TUN0 - 16 ? 'dead' : x === TUN0 - 32 ? 'flicker' : true);
  }
  for (const x of [(GA0 + OXW) / 2, (GB0 + GB1) / 2]) {
    for (const z of [-8, 8]) panelLight(b, TL, x, CH_H, z, 5, 1.4, true);
  }

  // --- Salas laterais das eclusas (o anexo continua fechado: |z| <= 32) ----------
  for (const [n, x0, x1, ix0, ix1] of [
    ['A', TUN0, OXW, GA0, OXW],
    ['B', TX0, TUN1, GB0, GB1],
  ]) {
    for (const s of [-1, 1]) {
      const zz = (a, c) => (s < 0 ? [-c, -a] : [a, c]);
      const [z0, z1] = zz(CH + W, RZ);
      b.span(TE, `Parede Externa ${n}`, [x0, 0, s * RZ], [x1, CH_H, s * (RZ + W)], C.tunnel, tw);
      b.span(TE, `Parede Oeste da Sala ${n}`, [x0, 0, z0], [ix0, CH_H, z1], C.tunnel, tw);
      if (n === 'B') b.span(TE, `Parede Leste da Sala ${n}`, [ix1, 0, z0], [x1, CH_H, z1], C.tunnel, tw);
      b.span(TE, `Teto da Sala ${n}`, [x0, CH_H, s * (CH + W)], [x1, CH_H + 1, s * (RZ + W)], C.ceiling, tt);
      b.span(TP, `Piso da Sala ${n}`, [ix0, 0, z0], [ix1, 0.1, z1], C.cellFloor, { surface: 'Inlet' });
    }
  }
  // Triagem (entrada, norte): banco de espera, régua de altura, mesa e armários
  const TR = 'Túnel/Triagem';
  b.span(TR, 'Banco de Espera', [GA0, 0.1, 19], [GA0 + 1.6, 1.8, 28], C.woodDark);
  b.span(TR, 'Régua de Altura', [GA0, 0.1, 17], [GA0 + 0.04, 8, 18], C.steelLight, { canCollide: false });
  for (const y of [2, 4, 6, 8 - 0.2]) {
    b.span(TR, 'Marca da Régua', [GA0 + 0.04, y - 0.1, 17], [GA0 + 0.08, y + 0.1, 18], C.steel, { canCollide: false });
  }
  b.span(TR, 'Mesa de Triagem', [-158, 2.5, 26], [-154, 2.8, 28.5], C.wood);
  for (const lx of [-158, -154.4]) b.span(TR, 'Mesa Pé', [lx, 0.1, 26.2], [lx + 0.4, 2.5, 28.3], C.steel);
  for (const ax of [GA0, GA0 + 2]) b.span(TR, 'Armário', [ax, 0.1, RZ - 1.6], [ax + 2, 7, RZ], C.steelLight);
  panelLight(b, TR, -158, CH_H, 22, 5, 1.4, 'flicker');
  // Revista (entrada, sul): pórtico detector de metais, mesa e banco
  const RV = 'Túnel/Revista';
  for (const px of [-160.5, -156.1])
    b.span(RV, 'Pórtico Detector', [px, 0.1, -22.3], [px + 0.6, 8, -21.7], C.steelLight);
  b.span(RV, 'Pórtico Detector Topo', [-160.5, 8, -22.4], [-155.5, 8.8, -21.6], C.steelLight);
  b.span(RV, 'Marca de Pés', [-159, 0.1, -19.6], [-157, 0.15, -18.4], C.hazard, { canCollide: false });
  b.span(RV, 'Mesa de Revista', [-158, 2.5, -29], [-154, 2.8, -26.5], C.steelLight);
  for (const lx of [-158, -154.4]) b.span(RV, 'Mesa Pé', [lx, 0.1, -28.8], [lx + 0.4, 2.5, -26.7], C.steel);
  b.span(RV, 'Banco', [GA0, 0.1, -28], [GA0 + 1.6, 1.8, -19], C.woodDark);
  panelLight(b, RV, -158, CH_H, -23);
  // Casa de Máquinas (fundo, norte): geradores parados, tanque enferrujado, canos e painel
  const MQ = 'Túnel/Casa de Máquinas';
  for (const gz of [18, 24]) {
    b.span(MQ, 'Gerador', [GB0, 0.1, gz], [GB0 + 2.6, 4, gz + 4], C.steel, { surface: 'Weld' });
    b.span(MQ, 'Tampa do Gerador', [GB0 + 0.2, 4, gz + 0.3], [GB0 + 2.4, 4.4, gz + 3.7], C.rust);
    b.span(MQ, 'Escapamento', [GB0 + 0.8, 4.4, gz + 1.7], [GB0 + 1.4, CH_H, gz + 2.3], C.rust);
  }
  b.span(MQ, 'Tanque', [GB1 - 2.6, 0.1, 25], [GB1, 9, 29.6], C.rust, { surface: 'Inlet' });
  for (const y of [2, 6]) b.span(MQ, 'Cinta do Tanque', [GB1 - 2.8, y, 24.8], [GB1, y + 0.5, 29.8], C.steel);
  b.span(MQ, 'Painel de Controle', [-213, 3, RZ - 0.3], [-210, 7, RZ], C.steel);
  for (const ix of [-212.4, -211.4]) {
    b.span(MQ, 'Indicador Apagado', [ix, 5.6, RZ - 0.4], [ix + 0.5, 6.1, RZ - 0.3], C.lampDead, { canCollide: false });
  }
  for (const cz of [27.5, 28.6]) b.span(MQ, 'Cano', [GB0, 14, cz], [GB1 - 2.6, 14.6, cz + 0.6], C.rust);
  panelLight(b, MQ, -212, CH_H, 22, 5, 1.4, 'flicker');
  // Solitária (fundo, sul): cama de concreto, vaso no chão e marcas de dias riscadas na parede
  const SO = 'Túnel/Solitária';
  b.span(SO, 'Cama de Concreto', [GB0, 0.1, -29.6], [GB0 + 3, 1.8, -23], C.debris);
  b.span(SO, 'Vaso no Chão', [-209.5, 0.1, -29], [-208.5, 0.14, -28], C.debrisDark, { canCollide: false });
  for (let g = 0; g < 4; g++) {
    for (let k = 0; k < 5; k++) {
      const mx = -216 + g * 1.6 + k * 0.25;
      b.span(SO, 'Marca Riscada', [mx, 4, -RZ], [mx + 0.08, 5.4, -RZ + 0.04], C.debrisDark, { canCollide: false });
    }
  }
  panelLight(b, SO, -212, CH_H, -23, 5, 1.4, 'dead');
  panelLight(b, SO, -212, CH_H, -27, 3, 1, 'flicker');

  // --- Abandono: luminária caída, entulho, manchas, poças, forro furado, móveis tombados --
  const RA = 'Ruínas/Átrio';
  for (const o of [-1, 1]) {
    b.box(RA, 'Haste Partida', [-45 + o * 2.66, ROOF - 0.8, 12], [0.3, 1.6, 0.3], C.steel, { canCollide: false });
  }
  b.box(RA, 'Luminária Caída', [-44, 0.3, 13], [8, 0.4, 1.8], C.steel, { canCollide: false, rotation: [0, 22.5, 0] });
  rubble(b, RA, -42, 10.5, 11, { n: 6, spread: 2.2, floorY: 0.1, big: 0.6 });
  // colunas rachadas: entulho caído na base
  rubble(b, RA, -30, -21.2, 21, { n: 8, spread: 1.4 });
  rubble(b, RA, 30, 21.2, 31, { n: 8, spread: 1.4 });
  puddle(b, RA, -4, 8, 7, 4, 0.1, 41);
  puddle(b, RA, 22, -14, 5, 3, 0.1, 42);
  // rombo da parede do bloco: entulho no chão do hall, embaixo do buraco
  rubble(b, RB, -84.5, 23, 51, { n: 10, spread: 1.6 });

  // manchas de umidade e mofo nas paredes lisas do hall e das salas dos cantos
  const RM = 'Ruínas/Manchas';
  stain(b, RM, 'x', -IN_X, 1, -17, 18.5, 6, 7, C.grime, 61);
  stain(b, RM, 'x', -IN_X, 1, 49, 7, 6, 4, C.mold, 62);
  stain(b, RM, 'x', -IN_X, 1, -43, 8.5, 5, 4, C.grime, 63);
  stain(b, RM, 'x', -IN_X, 1, -30, 22, 4, 10, C.grime, 64);
  stain(b, RM, 'x', IN_X, -1, 40, 8, 6, 5, C.mold, 65);
  // ala oeste: paredes do refeitório e do almoxarifado (envoltória por dentro)
  stain(b, RM, 'z', IN_Z, -1, -147, 8, 5, 8, C.grime, 66);
  stain(b, RM, 'z', IN_Z, -1, -95, 9, 5, 7, C.mold, 67);
  stain(b, RM, 'z', -IN_Z, 1, -134, 12, 5, 6, C.grime, 68);
  // túnel: escorrido entre as costelas
  for (const [x, s, seed] of [
    [TUN0 - 8, 1, 71],
    [TUN0 - 24, -1, 72],
    [TUN0 - 32, 1, 73],
  ]) {
    stain(b, 'Túnel/Ruínas', 'z', s * PORTAL, -s, x, 6.5, 4, 5, C.grime, seed);
  }
  stain(b, 'Túnel/Ruínas', 'z', -RZ, 1, -211, 9, 4, 5, C.mold, 74);

  // forro furado na ala oeste: placa escura no forro + placa caída e entulho no chão
  const RW = 'Ruínas/Ala Oeste';
  for (const [x, z, floorY, seed] of [
    [-134, 38, 0.1, 81],
    [-134, -30, 0, 82],
    [-104, -36, 0.1, 83],
  ]) {
    b.span(RW, 'Buraco no Forro', [x - 2, WC - 0.04, z - 1.6], [x + 2.2, WC, z + 1.4], C.debrisDark, {
      canCollide: false,
    });
    b.box(RW, 'Placa de Forro Caída', [x + 0.6, floorY + 0.1, z + 0.4], [3, 0.2, 2.6], C.cellWall, {
      canCollide: false,
      rotation: [0, 33.75, 0],
    });
    rubble(b, RW, x - 1, z - 1, seed, { n: 5, spread: 1.2, floorY, big: 0.7 });
    // fiação solta pendurada do forro furado
    for (const [dx, dz, len] of [
      [1.2, 0.2, 5.5],
      [-1.1, -0.7, 3.8],
    ]) {
      b.span(RW, 'Fio Solto', [x + dx - 0.06, WC - len, z + dz - 0.06], [x + dx + 0.06, WC, z + dz + 0.06], C.steel, {
        canCollide: false,
      });
    }
  }
  // banco tombado e caixa caída
  b.box(RW, 'Banco Tombado', [-135, 1, 50], [7, 1.8, 0.5], C.steelLight, {
    canCollide: false,
    rotation: [0, 16.875, 0],
  });
  b.box(RW, 'Caixa Caída', [-134.5, 1.5, -48], [3, 3, 3], C.wood, { canCollide: false, rotation: [0, 28.125, 0] });
  puddle(b, RW, -116, 26, 6, 3, 0.1, 84);
  puddle(b, RW, -100, -40, 4, 3, 0.1, 85);

  // túnel: canos enferrujados presos nas costelas, poças e entulho junto às paredes
  const RT = 'Túnel/Ruínas';
  for (const s of [-1, 1]) {
    b.span(RT, 'Cano', [TUN0 - 4.3 - 32, 9.4, s * (PORTAL - 1)], [TUN0 - 3.7, 10, s * (PORTAL - 0.4)], C.rust, {
      canCollide: false,
    });
  }
  puddle(b, RT, TUN0 - 20, 0, 9, 3.4, 0.1, 91);
  rubble(b, RT, TUN0 - 28, 4.4, 92, { n: 5, spread: 0.9, floorY: 0.1, big: 0.8 });
  puddle(b, RT, -212, 25, 3, 2.5, 0.1, 93);

  // =====================================================================================
  // HISTÓRIA CONTADA PELA DESTRUIÇÃO
  //  1) rebelião: barricada no hall, sala dos guardas incendiada, sala de controle invadida;
  //  2) desabamento: o telhado do átrio caiu (céu noturno à mostra), a viga partiu e o piso rachou;
  //  3) fuga: corda de lençóis amarrados pendurada no rombo do telhado e um túnel cavado numa cela;
  //  4) anos de abandono: chuva entrando (poças, musgo, trepadeiras), arquivo e biblioteca revirados.
  // =====================================================================================
  const tilt = (dx, dz) => (Math.atan2(-dz, dx) * 180) / Math.PI;

  // --- 2) desabamento do telhado sobre o átrio -----------------------------------------
  const RC = 'Ruínas/Telhado Caído';
  const SC = 'Estrutura/Telhado Caído'; // pedaços grandes, com colisão e fora das passagens
  // bordas irregulares do rombo (ainda presas na laje) e vergalhões expostos
  for (const [x0, x1, y0, z0, z1] of [
    // pedaços de laje que ficaram pendurados sob a borda (entram 1 stud sob a laje que os segura)
    [hx0 - 1, hx0 + 2.5, ROOF - 0.8, -3, 2],
    [hx0 - 1, hx0 + 1.5, ROOF - 0.6, hz0 - 1, hz0 + 4],
    [6, 10, ROOF - 0.7, hz0 - 1, hz0 + 1.8],
    [15, 18, ROOF - 1.1, hz1 - 2.2, hz1 + 1],
    [hx1 - 3, hx1 + 1, ROOF - 1.3, 4, hz1 + 1],
    [hx1 - 1.6, hx1 + 1, ROOF - 0.7, hz0 - 1, hz0 + 3],
  ]) {
    b.span(RC, 'Borda Partida', [x0, y0, z0], [x1, ROOF, z1], C.ceiling, { canCollide: false });
  }
  for (const x of [3, 12, 19]) {
    b.span(RC, 'Vergalhão', [x - 0.08, ROOF - 0.15, hz0 - 1], [x + 0.08, ROOF, hz0 + 2.4], C.rust, {
      canCollide: false,
    });
  }
  for (const z of [-4, 3.5]) {
    b.span(RC, 'Vergalhão', [hx1 - 2.6, ROOF - 0.15, z - 0.08], [hx1 + 1, ROOF, z + 0.08], C.rust, {
      canCollide: false,
    });
  }
  // o que caiu: lajes grandes (com colisão), uma laje tombada, o pedaço da viga e muito entulho
  b.span(SC, 'Laje Caída', [2, 0.1, 4.5], [12, 1.1, 10.5], C.ceiling);
  b.span(SC, 'Laje Caída', [4, 1.1, 5], [9, 1.9, 9.5], C.ceiling);
  b.span(SC, 'Laje Caída', [15, 0.1, -10], [24, 1.1, -4.5], C.ceiling);
  b.box(RC, 'Laje Tombada', [13, 1.5, 7.5], [6, 0.9, 5], C.ceiling, { canCollide: false, rotation: [0, 20, 18] });
  b.box(RC, 'Laje Tombada', [21, 1.6, -3], [5, 0.9, 4], C.ceiling, { canCollide: false, rotation: [-14, 35, 0] });
  b.span(SC, 'Viga Caída', [-12, 0.1, 4.6], [1.5, 1.9, 6], C.beam);
  b.box(RC, 'Viga Caída', [-13.5, 1.12, 8.6], [1.4, 1.8, 4.5], C.beam, { canCollide: false, rotation: [0, 35, 14] });
  for (const [x, z, seed] of [
    [6, 2.6, 401],
    [18, -2, 402],
    [11, -6.5, 403],
    [24, 4, 404],
    [-1.5, 7, 405],
    [0, -5.5, 406],
    [14, 1, 407],
  ]) {
    rubble(b, RC, x, z, seed, { n: 9, spread: 2.2, floorY: 0.1, big: 1.8 });
  }
  // a chuva entra pelo rombo: poça grande, musgo no piso e trepadeiras penduradas na borda
  puddle(b, RC, 12, -1, 15, 9, 0.1, 411);
  puddle(b, RC, 3, -4, 6, 4, 0.1, 412);
  const mr = rng(420);
  for (let k = 0; k < 9; k++) {
    const x = hx0 + 2 + mr() * (hx1 - hx0 - 4);
    const z = hz0 + 1 + mr() * (hz1 - hz0 - 2);
    const w = 1.5 + mr() * 3;
    b.span(RC, 'Musgo', [x - w / 2, 0.09, z - w / 3], [x + w / 2, 0.13, z + w / 3], k % 2 ? C.moss : C.mossDark, {
      canCollide: false,
    });
  }
  const vine = (x, z, len, seed) => {
    const r = rng(seed);
    b.span(RC, 'Trepadeira', [x - 0.12, ROOF - len, z - 0.12], [x + 0.12, ROOF, z + 0.12], C.mossDark, {
      canCollide: false,
    });
    for (let y = ROOF - 1.5; y > ROOF - len + 0.5; y -= 1.6 + r() * 1.2) {
      const side = r() < 0.5 ? -1 : 1;
      b.span(
        RC,
        'Folhagem',
        [x + side * 0.12, y - 0.5, z - 0.4],
        [x + side * (0.12 + 0.5 + r() * 0.5), y + 0.3, z + 0.4],
        C.moss,
        {
          canCollide: false,
        },
      );
    }
  };
  // presas na face de baixo da laje, logo além da borda do rombo
  [
    [1.6, 10],
    [5.5, 16],
    [13, 7],
    [22.5, 12],
  ].forEach(([x, len], k) => vine(x, hz0 - 0.2, len, 430 + k));
  [
    [3, 13],
    [9.5, 8],
    [17, 18],
    [23.5, 10],
  ].forEach(([x, len], k) => vine(x, hz1 + 0.2, len, 440 + k));

  // --- 3) fuga: corda de lençóis amarrados pendurada no rombo, sobre colchões empilhados ---
  const RF = 'Ruínas/Fuga';
  const ropeX = 8.5;
  const ropeZ = hz0 - 0.15;
  for (let k = 0; k < 3; k++) {
    b.span(
      RF,
      'Colchão Empilhado',
      [ropeX - 2 + k * 0.3, 0.1 + k * 0.6, ropeZ - 2.4],
      [ropeX + 1.8 + k * 0.2, 0.7 + k * 0.6, ropeZ + 1.6],
      C.sheet,
      {
        canCollide: false,
      },
    );
  }
  for (let y = 1.9; y < ROOF; y += 1.75) {
    const top = Math.min(y + 1.5, ROOF);
    b.span(RF, 'Lençol Amarrado', [ropeX - 0.3, y, ropeZ - 0.1], [ropeX + 0.3, top, ropeZ + 0.1], C.sheet, {
      canCollide: false,
    });
    if (top < ROOF) {
      b.span(
        RF,
        'Nó',
        [ropeX - 0.45, top, ropeZ - 0.18],
        [ropeX + 0.45, Math.min(top + 0.25, ROOF), ropeZ + 0.18],
        C.sheet,
        {
          canCollide: false,
        },
      );
    }
  }
  // túnel cavado na cela 17: buraco no piso, terra amontoada e a colher usada para cavar
  {
    const cx = cellCenterX(0);
    const zc = CELL_FRONT + 9;
    const RT2 = 'Ruínas/Cela 17';
    b.span(RT2, 'Buraco Cavado', [cx + 1.6, 0.1, zc - 1.2], [cx + 4, 0.14, zc + 1.2], C.crack, { canCollide: false });
    for (const [dx, dz, w, h] of [
      [-0.6, 0.2, 1.4, 0.7],
      [0.4, -1.8, 1.8, 0.5],
      [-1.2, -1.2, 1, 0.9],
    ]) {
      b.span(
        RT2,
        'Terra',
        [cx + 1.6 + dx - w / 2, 0.1, zc + dz - w / 2],
        [cx + 1.6 + dx + w / 2, 0.1 + h, zc + dz + w / 2],
        C.dirt,
        {
          canCollide: false,
        },
      );
    }
    b.span(RT2, 'Colher', [cx + 4.2, 0.1, zc + 1.4], [cx + 4.9, 0.15, zc + 1.55], C.steelLight, { canCollide: false });
  }

  // --- 1) rebelião: barricada no hall (mesa de pé, armário deitado, banco e colchão) -------
  const RBa = 'Ruínas/Barricada';
  b.span(RBa, 'Armário Tombado', [-66, 0, -20], [-62.5, 1.8, -13], C.steelLight);
  b.span(RBa, 'Banco Empilhado', [-65.5, 1.8, -19.5], [-63.7, 2.3, -12.5], C.steelLight);
  b.span(RBa, 'Colchão Encostado', [-66.5, 0, -19], [-66.1, 5.5, -13], C.sheet);
  b.box(RBa, 'Mesa Virada', [-61.4, 4, -14], [0.4, 8, 8], C.porcelain, { shape: 'Cylinder', rotation: [0, 10, 0] });
  b.span(RBa, 'Mesa Pé', [-64, 0, -10.6], [-61, 1.2, -9.4], C.steel);
  rubble(b, RBa, -64, -9.5, 451, { n: 6, spread: 1.2, big: 0.9 });

  // sala dos guardas incendiada: fuligem no teto e na parede, cinzas, cadeira queimada, cacos
  const RI = 'Ruínas/Incêndio';
  for (const [x0, x1, z0, z1] of [
    [-84, -66, 38, 46],
    [-80, -68, 44, 55],
    [-86, -76, 50, 58],
  ]) {
    b.span(RI, 'Fuligem no Teto', [x0, F2 - 1.04, z0], [x1, F2 - 1, z1], C.soot, { canCollide: false });
  }
  stain(b, RI, 'x', -IN_X, 1, 42, 12.3, 10, 4, C.soot, 461);
  // a fumaça escapou pela janela quebrada e enegreceu a parede do lado do corredor
  stain(b, RI, 'z', CELL_FRONT, -1, -76, 13.4, 14, 4.6, C.soot, 462);
  b.span(RI, 'Cadeira Queimada', [-76, 0, 47.6], [-74.6, 1.6, 49], C.charred);
  b.span(RI, 'Cadeira Queimada', [-76, 1.6, 48.7], [-74.6, 3.6, 49], C.charred);
  for (const [x, z, w] of [
    [-72, 50, 3],
    [-82, 42, 2.4],
    [-68, 41, 2],
  ]) {
    b.span(RI, 'Cinzas', [x - w / 2, 0, z - w / 3], [x + w / 2, 0.08, z + w / 3], C.soot, { canCollide: false });
  }
  for (const [x, z] of [
    [-82, 36.2],
    [-79.5, 36.9],
    [-70, 35.6],
    [-82.5, 32.4],
    [-69, 31.8],
  ]) {
    const fy = z < CELL_FRONT ? 0.1 : 0; // no corredor o piso tem acabamento
    b.span(RI, 'Caco de Vidro', [x, fy, z], [x + 0.8, fy + 0.05, z + 0.6], C.glass, {
      canCollide: false,
      transparency: 0.5,
    });
  }

  // sala de controle invadida: monitores no chão, papéis espalhados e cacos dos dois lados
  const RCt = 'Ruínas/Controle';
  b.span(RCt, 'Monitor Quebrado', [77.5, F2 + 0.1, 5], [79.5, F2 + 0.5, 7.4], C.steel, { canCollide: false });
  b.span(RCt, 'Monitor Quebrado', [79.5, F2 + 0.1, -9], [81.5, F2 + 0.5, -6.8], C.steel, { canCollide: false });
  const pr = rng(470);
  for (let k = 0; k < 10; k++) {
    const x = 78 + pr() * 8.5;
    const z = -11 + pr() * 22;
    b.box(RCt, 'Papel', [x, F2 + 0.125, z], [1.1, 0.05, 0.8], C.sheet, {
      canCollide: false,
      rotation: [0, Math.round(pr() * 8) * 11.25, 0],
    });
  }
  for (const [x, z] of [
    [70.6, -7],
    [70.9, 6.5],
    [72.7, -11.3],
    [72.7, 10.8],
  ]) {
    b.span(RCt, 'Caco de Vidro', [x, F2 + 0.1, z], [x + 0.7, F2 + 0.15, z + 0.6], C.glass, {
      canCollide: false,
      transparency: 0.5,
    });
  }
  // parlatório: cacos do vidro divisor no balcão e no chão
  for (const [x, y, z] of [
    [76.2, 3.3, 2],
    [77.2, 3.3, 3.6],
    [78.6, 0.1, 1.5],
    [75, 0.1, 4.2],
  ]) {
    b.span('Ruínas/Parlatório', 'Caco de Vidro', [x, y, z], [x + 0.6, y + 0.05, z + 0.5], C.glass, {
      canCollide: false,
      transparency: 0.5,
    });
  }

  // arquivo saqueado: gavetas puxadas e papéis no chão; biblioteca: estante caída e livros
  const RAq = 'Ruínas/Arquivo';
  for (const k of [1, 3, 4]) {
    b.span(RAq, 'Gaveta Aberta', [74 + k * 2 + 0.2, F2 + 1.2, -30.4], [76 + k * 2 - 0.2, F2 + 2, -29], C.steelLight, {
      canCollide: false,
    });
  }
  const ar = rng(480);
  for (let k = 0; k < 14; k++) {
    b.box(RAq, 'Papel', [75 + ar() * 11, F2 + 0.125, -28 + ar() * 14], [1.1, 0.05, 0.8], C.sheet, {
      canCollide: false,
      rotation: [0, Math.round(ar() * 8) * 11.25, 0],
    });
  }
  const RBi = 'Ruínas/Biblioteca';
  for (const y of [F2, F2 + 0.5]) {
    b.span(RBi, 'Estante Caída', [-71, y, 47], [-61, y + 0.5, 49.5], y === F2 ? C.steel : C.steelLight, {
      canCollide: false,
    });
  }
  const lr = rng(490);
  for (let k = 0; k < 14; k++) {
    b.box(
      RBi,
      'Livro',
      [-70 + lr() * 9, F2 + 0.2, 50 + lr() * 4.5],
      [1.2, 0.4, 0.9],
      [C.wood, C.blanket, C.debris][k % 3],
      {
        canCollide: false,
        rotation: [0, Math.round(lr() * 8) * 11.25, 0],
      },
    );
  }

  // enfermaria: suporte de soro em pé e outro caído, papéis no chão
  const REn = 'Ruínas/Enfermaria';
  b.span(REn, 'Base do Suporte', [-105.6, 0.1, -52.1], [-104.4, 0.3, -50.9], C.steel);
  b.span(REn, 'Suporte de Soro', [-105.1, 0.3, -51.6], [-104.9, 7, -51.4], C.steel);
  b.span(REn, 'Bolsa de Soro', [-104.9, 5.4, -51.65], [-104.3, 6.6, -51.35], C.sheet, {
    canCollide: false,
    transparency: 0.3,
  });
  b.box(REn, 'Suporte de Soro Caído', [-99, 0.2, -47], [6.5, 0.2, 0.2], C.steel, {
    canCollide: false,
    rotation: [0, 22.5, 0],
  });

  // --- terremoto: rachadura atravessando o piso do átrio e subindo a parede do hall -------
  const RR = 'Ruínas/Rachadura';
  const crack = (pts) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k];
      const [bx, bz] = pts[k + 1];
      const len = Math.hypot(bx - ax, bz - az);
      b.box(RR, 'Rachadura', [(ax + bx) / 2, 0.12, (az + bz) / 2], [len + 0.3, 0.04, 0.35], C.crack, {
        canCollide: false,
        rotation: [0, tilt(bx - ax, bz - az), 0],
      });
    }
  };
  crack([
    [-58, 6],
    [-50, 3.6],
    [-43, 7],
    [-35, 4],
    [-28, 9],
    [-21, 6.5],
    [-14, 11],
    [-7, 8.5],
  ]);
  crack([
    [-35, 4],
    [-31, -2],
    [-26, -5],
    [-22, -11],
  ]);
  for (const [x, z, rot] of [
    [-44, 5.2, [5, 15, 0]],
    [-27.5, 7.6, [-6, 40, 3]],
  ]) {
    b.box(RR, 'Placa Solta', [x, 0.3, z], [2.6, 0.25, 2.2], C.floorAtriumDark, { canCollide: false, rotation: rot });
  }
  // na parede do hall (face x = -88), subindo em zigue-zague
  for (let k = 0; k < 10; k++) {
    const y = 4.2 + k * 2.6;
    const z = -25 + (k % 2 ? 0.6 : -0.6) + k * 0.2;
    b.span(RR, 'Rachadura na Parede', [-IN_X, y, z - 0.14], [-IN_X + 0.04, y + 2.7, z + 0.14], C.crack, {
      canCollide: false,
    });
  }

  // --- túnel: desmoronamento parcial perto da eclusa do fundo -------------------------
  rubble(b, 'Túnel/Ruínas', TUN1 + 7, -3.4, 501, { n: 12, spread: 1.4, floorY: 0.1, big: 1.6 });
  rubble(b, 'Túnel/Ruínas', TUN1 + 4, 3.2, 502, { n: 6, spread: 1.1, floorY: 0.1, big: 1.2 });

  return { parts: b.parts };
}
