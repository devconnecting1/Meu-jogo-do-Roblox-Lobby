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
const HANG_Y = 30; // altura das luminárias pendentes do vão

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
});

const HANG_LIGHT = { type: 'Point', range: 32, brightness: 1.2, color: C.neon };
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
    { name: 'Patamar do mezanino', min: [STAIR_X1 + 0.5, F2 + 0.2, -SH + 0.2], max: [IN_X - 0.5, F2 + 7, SH - 0.2] },
    { name: 'Passagem sob o mezanino', min: [STAIR_X1 + 0.5, 0.6, -E + 1], max: [STAIR_X1 + 5.5, 8, E - 1] },
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

export const ENVELOPE = Object.freeze({ min: [-OX, -1, -OZ], max: [OX, ROOF + 1, OZ] });
export const INTERIOR = Object.freeze({ min: [-IN_X, 0, -IN_Z], max: [IN_X, ROOF, IN_Z] });

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

function rack(b, model, x, z, len = 10, depth = 3.5, h = 11) {
  for (const dx of [-len / 2 + 0.3, 0, len / 2 - 0.3]) {
    for (const dz of [-depth / 2 + 0.3, depth / 2 - 0.3]) {
      b.box(model, 'Montante', [x + dx, h / 2, z + dz], [0.5, h, 0.5], C.steel);
    }
  }
  [0.6, 4.2, 7.8].forEach((sy, i) => b.box(model, `Prateleira ${i + 1}`, [x, sy, z], [len, 0.3, depth], C.steelLight));
  // caixas sempre entre os montantes (montantes em x, x ± (len/2 - 0.3))
  crate(b, model, x - 2.4, 0.75, z, 2.4);
  crate(b, model, x + 2.4, 4.35, z, 2.4);
  crate(b, model, x - 2.4, 7.95, z, 2.4);
}

/** Luminária pendente: carcaça + 2 tubos Neon + hastes até o teto. */
function hangingLight(b, model, x, y, z) {
  const stem = ROOF - (y + 0.2);
  b.box(model, 'Carcaça', [x, y, z], [8, 0.4, 1.8], C.steel, { canCollide: false });
  for (const o of [-1.9, 1.9]) {
    b.box(model, 'Tubo', [x + o, y - 0.3, z], [3.6, 0.25, 1.1], C.neon, {
      canCollide: false,
      material: 'Neon',
      light: o < 0 ? HANG_LIGHT : null,
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
  r('Piso', -7, 7, 0, 0.1, 0.6, D, C.cellFloor);
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
  b.span(ENV, 'Laje Térreo', [-OX, -1, -OZ], [OX, 0, OZ], C.floor, { group: 'Piso' });
  const wo = { group: 'Paredes' };
  b.span(ENV, 'Parede Sul', [-OX, 0, -OZ], [OX, ROOF, -IN_Z], C.wall, wo);
  b.span(ENV, 'Parede Norte', [-OX, 0, IN_Z], [OX, ROOF, OZ], C.wall, wo);
  b.span(ENV, 'Parede Leste', [IN_X, 0, -IN_Z], [OX, ROOF, IN_Z], C.wall, wo);
  b.span(ENV, 'Parede Oeste', [-OX, 0, -IN_Z], [-IN_X, ROOF, IN_Z], C.wall, wo);
  b.span(ENV, 'Laje Teto', [-OX, ROOF, -OZ], [OX, ROOF + 1, OZ], C.ceiling, { group: 'Teto' });

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
    for (const [n, ya, yb, col] of bands) b.span(WB, n, [x, ya, -IN_Z], [x + dir * 0.1, yb, IN_Z], col, band);
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
  for (const x of COLUMN_X) b.span(T, 'Viga Transversal', [x - 0.7, ROOF - 1.8, -IN_Z], [x + 0.7, ROOF, IN_Z], C.beam, tg);
  for (const z of [-E, E]) b.span(T, 'Viga Longitudinal', [-IN_X, ROOF - 1.8, z - 0.7], [IN_X, ROOF, z + 0.7], C.beam, tg);

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
  b.span(P, 'Piso Sala de Visitas', [STAIR_X1, 0, -E], [IN_X, 0.1, E], C.floorCorridor);
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
      if (i % 2 === 0) hangingLight(b, `Iluminação/Corredor ${t}`, lx, HANG_Y, side * (E + 5));
      hangingLight(b, `Iluminação/Galeria ${t}`, lx, ROOF - 5, side * (CELL_FRONT + 5));
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
  for (const z of [-12, 12]) hangingLight(b, 'Iluminação/Hall', -71, HANG_Y, z);

  // --- Depósitos fechados (cantos oeste do térreo) ---------------------------
  for (const s of [-1, 1]) {
    const D = `Depósitos/Depósito ${s < 0 ? 'Sul' : 'Norte'}`;
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
    crate(b, D, -84, 0, s * 42);
    crate(b, D, -84, 4, s * 42);
    crate(b, D, -78.5, 0, s * 41);
    rack(b, D, -74, s * 55, 14, 3.5, 11);
    panelLight(b, D, -74, F2 - 1, s * 47);
  }

  // --- Átrio: poucos móveis, muito espaço -------------------------------------
  const R = 'Átrio/Refeitório';
  for (const [tx, tz] of [
    [-42, -12],
    [-8, 12],
  ]) {
    b.box(R, 'Mesa Tampo', [tx, 3.2, tz], [0.4, 8, 8], C.porcelain, { shape: 'Cylinder', rotation: [0, 0, 90] });
    b.box(R, 'Mesa Pé', [tx, 1.6, tz], [1.2, 3, 1.2], C.steel);
    b.box(R, 'Mesa Base', [tx, 0.25, tz], [3.4, 0.3, 3.4], C.steel);
    for (const s of [-1, 1]) {
      b.box(R, 'Banco', [tx, 1.8, tz + s * 5.4], [7, 0.5, 1.8], C.steelLight);
      b.box(R, 'Banco Encosto', [tx, 2.95, tz + s * 6.3], [7, 1.8, 0.4], C.steel);
      b.box(R, 'Banco Pé', [tx - 2.6, 0.85, tz + s * 5.4], [0.7, 1.5, 1.4], C.steel);
      b.box(R, 'Banco Pé', [tx + 2.6, 0.85, tz + s * 5.4], [0.7, 1.5, 1.4], C.steel);
    }
  }
  const K = 'Átrio/Caixas';
  crate(b, K, 12, 0.1, -15);
  crate(b, K, 16.2, 0.1, -15);
  crate(b, K, 14.1, 4.1, -15);
  crate(b, K, 30, 0.1, 15);
  crate(b, K, 30, 0.1, 10.5, 3);
  for (let i = 0; i < DIM.cellsPerRow; i += 2) {
    for (const z of [-10, 10]) hangingLight(b, 'Iluminação/Átrio', cellCenterX(i), HANG_Y, z);
  }

  // --- Sala de visitas (sob o mezanino) -------------------------------------
  const V = 'Sala de Visitas';
  b.span(V, 'Balcão', [76, 0.1, -18], [78, 3, 18], C.facade);
  b.span(V, 'Tampo', [75.8, 3, -18], [78.2, 3.3, 18], C.steelLight);
  b.span(V, 'Vidro Divisor', [76.9, 3.3, -18], [77.1, 9, 18], C.glass, { transparency: 0.6 });
  b.span(V, 'Travessa Vidro', [76.8, 9, -18], [77.2, 9.3, 18], C.steel);
  for (let z = -18; z <= 18; z += 6) b.span(V, 'Divisória Cabine', [72, 0.1, z - 0.15], [82, 7.5, z + 0.15], C.wallTrim);
  for (let z = -15; z <= 15; z += 6) {
    for (const x of [74, 80]) {
      b.box(V, 'Banqueta Coluna', [x, 0.8, z], [0.4, 1.4, 0.4], C.steel);
      b.box(V, 'Banqueta Assento', [x, 1.65, z], [1.4, 0.3, 1.4], C.wood);
    }
  }
  for (const z of [-15, 0, 15]) panelLight(b, V, 77, F2 - 1, z);

  // --- Estoque sob o mezanino (estantes) ------------------------------------
  for (const s of [-1, 1]) {
    const D = `Depósitos/Estoque ${s < 0 ? 'Sul' : 'Norte'}`;
    for (const z of [30, 40, 50]) rack(b, D, 77, s * z);
    panelLight(b, D, 77, F2 - 1, s * 35);
    panelLight(b, D, 77, F2 - 1, s * 45, 5, 1.4, false);
  }

  return { parts: b.parts };
}
