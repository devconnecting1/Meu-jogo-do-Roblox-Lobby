// Prisão — fonte única da verdade do mapa (dados puros, sem Roblox, sem DOM).
//
// Consumido por:
//   * viewer/main.js (Three.js) — visualização no navegador / capturas do CI;
//   * src/rojo.js + tools/build-place.mjs — modelo Rojo -> .rbxl publicado no Roblox;
//   * tests/*.test.mjs — regras de construção (colisão, apoio, z-fighting, estilo).
//
// Regras de estilo (ver AGENTS.md): Part clássico (Block; Cylinder só em tampos),
// Plastic + Neon (só lâmpadas), studs só em pisos, cores neutras, sem UI/NPC/scripts,
// ambiente 100% fechado (não existe exterior nem saída).
//
// Unidades: studs. Eixos do Roblox (Y para cima). Interior: x -70..70, z -40..40, y 0..34.

import { makeBuilder } from './builder.js';
import { C } from './palette.js';

export const DIM = Object.freeze({
  inX: 70,
  inZ: 40,
  wall: 2,
  roofY: 34,
  floor2: 16, // topo da laje do 2º andar
  cellH: 15,
  cellW: 12,
  cellD: 14,
  cellsPerRow: 8,
  edge: 18, // borda do vão central (|z| < 18 é pé-direito duplo)
  stairX0: 38,
  stairX1: 56, // mezanino leste começa em x = 56
  stairHalf: 6,
});

const { inX, inZ, wall, roofY, floor2: F2, cellH, cellW, cellD, edge: E, stairX0, stairX1, stairHalf } = DIM;
const oX = inX + wall; // 72
const oZ = inZ + wall; // 42
const PITCH = cellW + 1; // 13
const ROW_START = -(DIM.cellsPerRow * PITCH + 1) / 2; // -52.5
const CELL_FRONT = inZ - cellD; // 26
const COLUMN_X = [-65, ...Array.from({ length: 9 }, (_, i) => -52 + i * PITCH)];
const BRIDGE = [-23, -16];

const HANG_LIGHT = { type: 'Point', range: 24, brightness: 1.1, color: C.neon };
const PANEL_LIGHT = { type: 'Surface', range: 16, brightness: 1.4, color: C.neon };

/** Centro X da cela i (0..7). */
export const cellCenterX = (i) => ROW_START + 1 + cellW / 2 + i * PITCH;

// ---------------------------------------------------------------------------
// Zonas que o jogador precisa atravessar: nenhuma Part com colisão pode invadi-las.
// ---------------------------------------------------------------------------
export function clearanceZones() {
  const zones = [];
  for (const s of [-1, 1]) {
    const t = s < 0 ? 'Sul' : 'Norte';
    zones.push(
      { name: `Corredor térreo ${t}`, min: [-69.5, 0.6, s < 0 ? -25 : 19.7], max: [55.5, 7.5, s < 0 ? -19.7 : 25] },
      { name: `Galeria 2º andar ${t}`, min: [-69.5, F2 + 0.6, s < 0 ? -25 : 19.4], max: [55.5, F2 + 7, s < 0 ? -19.4 : 25] },
    );
  }
  zones.push(
    { name: 'Hall', min: [-69.5, 1.05, -6], max: [-53, 8, 6] },
    { name: 'Eixo central do átrio', min: [-52, 0.6, -2], max: [36, 7.5, 2] },
    { name: 'Ponte', min: [BRIDGE[0] + 0.4, F2 + 0.2, -17.6], max: [BRIDGE[1] - 0.4, F2 + 7, 17.6] },
    { name: 'Patamar do mezanino', min: [56.5, F2 + 0.2, -5.8], max: [69.5, F2 + 7, 5.8] },
    { name: 'Passagem sob o mezanino', min: [56.5, 0.6, -17.5], max: [58.6, 7, 17.5] },
  );
  const run = (stairX1 - stairX0) / F2;
  for (let k = 0; k < F2; k++) {
    const xa = stairX0 + k * run;
    zones.push({ name: `Degrau ${k + 1} (acima)`, min: [xa + 0.05, k + 1.1, -5.9], max: [xa + run - 0.05, k + 8, 5.9] });
  }
  let n = 1;
  for (const side of [-1, 1]) {
    for (const y0 of [0, F2]) {
      for (let i = 0; i < DIM.cellsPerRow; i++) {
        const cx = cellCenterX(i);
        const z = (d) => side * (CELL_FRONT + d);
        const id = String(n++).padStart(2, '0');
        zones.push({
          name: `Porta da cela ${id}`,
          min: [cx + 1.8, y0 + 0.6, Math.min(z(-0.9), z(1.5))],
          max: [cx + 4.2, y0 + 8.6, Math.max(z(-0.9), z(1.5))],
        });
        zones.push({
          name: `Interior da cela ${id}`,
          min: [cx - 2, y0 + 0.2, Math.min(z(1), z(9))],
          max: [cx + 3, y0 + 7, Math.max(z(1), z(9))],
        });
      }
    }
  }
  return zones;
}

/** Bordas com queda: amostradas no teste para garantir guarda-corpo contínuo. */
export function fallEdges() {
  return [
    { name: 'Borda galeria Sul', axis: 'x', at: -E, from: -inX, to: stairX1, y: F2, openings: [BRIDGE] },
    { name: 'Borda galeria Norte', axis: 'x', at: E, from: -inX, to: stairX1, y: F2, openings: [BRIDGE] },
    { name: 'Borda do mezanino', axis: 'z', at: stairX1, from: -E, to: E, y: F2, openings: [[-stairHalf, stairHalf]] },
    { name: 'Ponte lado oeste', axis: 'z', at: BRIDGE[0], from: -E, to: E, y: F2, openings: [] },
    { name: 'Ponte lado leste', axis: 'z', at: BRIDGE[1], from: -E, to: E, y: F2, openings: [] },
  ];
}

export const ENVELOPE = Object.freeze({ min: [-oX, -1, -oZ], max: [oX, roofY + 1, oZ] });
export const INTERIOR = Object.freeze({ min: [-inX, 0, -inZ], max: [inX, roofY, inZ] });

// ---------------------------------------------------------------------------
// Peças compostas
// ---------------------------------------------------------------------------

function crate(b, model, x, y, z, s = 4) {
  b.box(model, 'Caixa', [x, y + s / 2, z], [s, s, s], C.wood);
  const h = s / 2 - 0.15;
  for (const dx of [-h, h]) for (const dz of [-h, h]) {
    b.box(model, 'Cantoneira', [x + dx, y + s / 2, z + dz], [0.42, s + 0.04, 0.42], C.woodDark);
  }
  b.box(model, 'Cinta Inferior', [x, y + 0.3, z], [s + 0.06, 0.4, s + 0.06], C.woodDark);
  b.box(model, 'Cinta Superior', [x, y + s - 0.3, z], [s + 0.06, 0.4, s + 0.06], C.woodDark);
}

function rack(b, model, x, z, len = 9, depth = 3, h = 10) {
  for (const dx of [-len / 2 + 0.3, 0, len / 2 - 0.3]) {
    for (const dz of [-depth / 2 + 0.3, depth / 2 - 0.3]) {
      b.box(model, 'Montante', [x + dx, h / 2, z + dz], [0.5, h, 0.5], C.steel);
    }
  }
  [0.6, 4, 7.4].forEach((sy, i) => b.box(model, `Prateleira ${i + 1}`, [x, sy, z], [len, 0.3, depth], C.steelLight));
  crate(b, model, x - 2.5, 0.75, z, 2.2);
  crate(b, model, x + 2.2, 4.15, z, 2.2);
  crate(b, model, x - 0.6, 7.55, z, 2.2);
}

/** Luminária pendente: carcaça + 2 tubos Neon + hastes até o teto (topY). */
function hangingLight(b, model, x, y, z, topY = roofY) {
  const stem = topY - (y + 0.2);
  b.box(model, 'Carcaça', [x, y, z], [7, 0.4, 1.6], C.steel, { canCollide: false });
  for (const o of [-1.7, 1.7]) {
    b.box(model, 'Tubo', [x + o, y - 0.3, z], [3.2, 0.25, 1], C.neon, {
      canCollide: false,
      material: 'Neon',
      light: o < 0 ? HANG_LIGHT : null,
    });
    b.box(model, 'Haste', [x + o * 1.4, y + 0.2 + stem / 2, z], [0.3, stem, 0.3], C.steel, { canCollide: false });
  }
}

/** Painel embutido; ceilingY = face inferior do teto onde ele encosta. */
function panelLight(b, model, x, ceilingY, z, w = 4, d = 1.2, light = true) {
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
  const front = side * CELL_FRONT;
  const zAt = (d) => front + side * d; // d: 0 = fachada, 14 = fundo; negativo = corredor
  const r = (name, lx0, lx1, ya, yb, d0, d1, color, opts) =>
    b.span(model, name, [cx + lx0, y0 + ya, zAt(d0)], [cx + lx1, y0 + yb, zAt(d1)], color, opts);
  const deco = { canCollide: false };

  // Fachada (inclui a frente da divisória à esquerda: lx -7..-6)
  r('Fachada Pilar E', -7, -5, 0, 12, 0, 0.6, C.facade);
  r('Fachada Peitoril', -5, 0.5, 0, 2.5, 0, 0.6, C.facade);
  r('Fachada Verga Janela', -5, 0.5, 10, 12, 0, 0.6, C.facade);
  r('Fachada Pilar Meio', 0.5, 1.5, 0, 12, 0, 0.6, C.facade);
  r('Fachada Verga Porta', 1.5, 4.5, 9, 12, 0, 0.6, C.facade);
  r('Fachada Pilar D', 4.5, 6, 0, 12, 0, 0.6, C.facade);
  r('Faixa Superior', -7, 6, 12, cellH, 0, 0.6, C.wall);
  r('Friso', -7, 6, 13.2, 13.6, -0.08, 0, C.wallTrim, deco);

  // Janela de observação (showcase)
  r('Vidro Janela', -5, 0.5, 2.5, 10, 0.2, 0.4, C.glass, { transparency: 0.7 });
  r('Caixilho E', -5, -4.8, 2.5, 10, -0.05, 0.65, C.steel);
  r('Caixilho D', 0.3, 0.5, 2.5, 10, -0.05, 0.65, C.steel);
  r('Caixilho Topo', -5, 0.5, 9.8, 10, -0.05, 0.65, C.steel);
  r('Caixilho Base', -5, 0.5, 2.5, 2.7, -0.05, 0.65, C.steel);
  r('Parapeito', -5.2, 0.7, 2.3, 2.6, -0.4, 0, C.steelLight);

  // Porta: batente + porta de grade deslizante aberta (apoiada no meio-fio e no trilho)
  r('Batente E', 1.5, 1.7, 0, 9, -0.05, 0.65, C.steel);
  r('Batente D', 4.3, 4.5, 0, 9, -0.05, 0.65, C.steel);
  r('Batente Topo', 1.5, 4.5, 8.8, 9, -0.05, 0.65, C.steel);
  r('Trilho', 1.5, 7, 9, 9.3, -0.5, 0, C.steel);
  r('Porta Topo', 4.6, 7, 8.7, 9, -0.35, 0, C.steel, deco);
  r('Porta Base', 4.6, 7, 0.5, 0.8, -0.35, 0, C.steel, deco);
  r('Porta Montante E', 4.6, 4.85, 0.5, 9, -0.35, 0, C.steel, deco);
  r('Porta Montante D', 6.75, 7, 0.5, 9, -0.35, 0, C.steel, deco);
  r('Porta Travessa', 4.6, 7, 4.5, 4.8, -0.35, 0, C.steel, deco);
  for (const bx of [5.3, 5.8, 6.3]) r('Porta Barra', bx - 0.1, bx + 0.1, 0.8, 8.7, -0.3, -0.05, C.steel, deco);

  // Interior
  r('Piso', -6, 6, 0, 0.1, 0.6, 14, C.cellFloor);
  r('Revestimento E', -6, -5.8, 0, cellH, 0.6, 13.7, C.cellWall);
  r('Revestimento D', 5.8, 6, 0, cellH, 0.6, 13.7, C.cellWall);
  r('Parede Fundo', -6, 6, 0, cellH, 13.7, 14, C.cellBack);
  panelLight(b, model, cx, y0 + cellH, zAt(6), 3, 1.6);

  // Cama
  r('Cama Base', -5.6, 1.2, 0.1, 1.4, 10.4, 13.6, C.steel);
  r('Cama Gaveta', -5.2, 0.8, 0.5, 0.9, 10.3, 10.4, C.steelLight, deco);
  r('Colchão', -5.5, 1.1, 1.4, 1.9, 10.5, 13.5, C.sheet);
  r('Cobertor', -3.5, 1.15, 1.9, 2.1, 10.45, 13.55, C.blanket);
  r('Travesseiro', -5.3, -4, 1.9, 2.4, 10.8, 13.2, C.sheet);
  r('Cabeceira', -5.8, -5.5, 0.1, 3, 10.4, 13.6, C.steel);

  // Vaso sanitário
  r('Vaso Base', 3.6, 4.9, 0.1, 1.3, 11.6, 13.3, C.porcelain);
  r('Vaso Assento', 3.5, 5, 1.3, 1.5, 11.5, 13.3, C.porcelain);
  r('Vaso Caixa', 3.6, 4.9, 1.3, 3, 13.2, 13.7, C.porcelain);

  // Pia com espelho
  r('Pia Coluna', 5.3, 5.6, 0.1, 3, 8.1, 8.4, C.steel);
  r('Pia Cuba', 4.9, 5.8, 3, 3.6, 7.5, 9, C.steelLight);
  r('Torneira', 5.5, 5.7, 3.6, 4.1, 8.2, 8.3, C.steel);
  r('Espelho', 5.68, 5.8, 4.6, 7.4, 7.3, 9.2, C.mirror);

  // Mesa de parede, banqueta e prateleira
  r('Mesa', -5.8, -4.2, 2.6, 2.9, 4, 7, C.wood);
  r('Mesa Suporte', -5.8, -5.5, 0.1, 2.6, 5.3, 5.7, C.steel);
  r('Banqueta Coluna', -3.55, -3.25, 0.1, 1.5, 5.35, 5.65, C.steel);
  r('Banqueta Assento', -3.9, -2.9, 1.5, 1.8, 5, 6, C.wood);
  r('Prateleira', -5.8, -4.8, 6, 6.2, 3.8, 7.2, C.wood);
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

export function buildPrison() {
  const b = makeBuilder();

  // --- Envoltória fechada (sem janelas, portas ou claraboia) ---------------
  const ENV = 'Envoltória';
  b.span(ENV, 'Laje Térreo', [-oX, -1, -oZ], [oX, 0, oZ], C.floor, { group: 'Piso' });
  const wo = { group: 'Paredes' };
  b.span(ENV, 'Parede Sul', [-oX, 0, -oZ], [oX, roofY, -inZ], C.wall, wo);
  b.span(ENV, 'Parede Norte', [-oX, 0, inZ], [oX, roofY, oZ], C.wall, wo);
  b.span(ENV, 'Parede Leste', [inX, 0, -inZ], [oX, roofY, inZ], C.wall, wo);
  b.span(ENV, 'Parede Oeste', [-oX, 0, -inZ], [-inX, roofY, inZ], C.wall, wo);
  b.span(ENV, 'Laje Teto', [-oX, roofY, -oZ], [oX, roofY + 1, oZ], C.ceiling, { group: 'Teto' });

  // Faixas internas das paredes (decorativas, sem colisão)
  const W = 'Acabamento/Paredes';
  const band = { canCollide: false, group: 'Paredes' };
  const bands = [
    ['Rodapé Alto', 0, 1.2, C.wainscot],
    ['Faixa Térreo', 12.6, 13.2, C.wallTrim],
    ['Faixa 2º Andar', 28.6, 29.2, C.wallTrim],
  ];
  for (const [x, dir] of [[-inX, 1], [inX, -1]]) {
    for (const [n, ya, yb, col] of bands) b.span(W, n, [x, ya, -inZ], [x + dir * 0.1, yb, inZ], col, band);
  }
  for (const s of [-1, 1]) {
    for (const [x0, x1] of [[-inX, ROW_START], [-ROW_START, inX]]) {
      for (const [n, ya, yb, col] of bands) b.span(W, n, [x0, ya, s * inZ], [x1, yb, s * (inZ - 0.1)], col, band);
    }
    b.span(W, 'Faixa Alta', [-inX, 32.6, s * inZ], [inX, 33.2, s * (inZ - 0.1)], C.wallTrim, band);
  }

  // --- Teto: vigas no ritmo das colunas ------------------------------------
  const T = 'Estrutura/Teto';
  for (const x of COLUMN_X) b.span(T, 'Viga Transversal', [x - 0.6, 32.4, -inZ], [x + 0.6, roofY, inZ], C.beam, { group: 'Teto' });
  for (const z of [-E, E]) b.span(T, 'Viga Longitudinal', [-inX, 32.4, z - 0.6], [inX, roofY, z + 0.6], C.beam, { group: 'Teto' });

  // --- Colunas ---------------------------------------------------------------
  for (const x of COLUMN_X) {
    for (const s of [-1, 1]) {
      b.box('Estrutura/Colunas', 'Coluna', [x, roofY / 2, s * E], [2.6, roofY, 2.6], C.column);
      b.box('Estrutura/Colunas', 'Base Coluna', [x, 0.4, s * E], [3.2, 0.8, 3.2], C.columnBase);
    }
  }

  // --- Pisos do térreo -----------------------------------------------------
  const P = 'Pisos';
  b.span(P, 'Piso Átrio', [ROW_START, 0, -16.5], [stairX1, 0.1, 16.5], C.floorAtrium, { studs: true });
  b.span(P, 'Piso Sala de Visitas', [stairX1, 0, -E], [inX, 0.1, E], C.floorCorridor);
  for (const s of [-1, 1]) {
    const t = s < 0 ? 'Sul' : 'Norte';
    b.span(P, `Corredor ${t}`, [-inX, 0, s * 20], [stairX1, 0.1, s * 25], C.floorCorridor);
    b.span(P, `Meio-fio ${t}`, [ROW_START, 0, s * 25], [-ROW_START, 0.5, s * CELL_FRONT], C.curb, { studs: true });
  }

  // --- Blocos de celas -------------------------------------------------------
  let number = 1;
  for (const side of [-1, 1]) {
    const t = side < 0 ? 'Sul' : 'Norte';
    const A = `Celas/Ala ${t}`;
    const zf = side * CELL_FRONT;
    const zDiv = side * (CELL_FRONT + 0.6);
    const zBack = side * inZ;
    for (const y0 of [0, F2]) {
      for (let i = 0; i <= DIM.cellsPerRow; i++) {
        const wx = ROW_START + i * PITCH;
        b.span(A, 'Divisória', [wx, y0, zDiv], [wx + 1, y0 + cellH, zBack], C.facade);
      }
      // Fecho da fachada sobre a última divisória
      const wl = ROW_START + DIM.cellsPerRow * PITCH;
      b.span(A, 'Fachada Final', [wl, y0, zf], [wl + 1, y0 + 12, zDiv], C.facade);
      b.span(A, 'Faixa Final', [wl, y0 + 12, zf], [wl + 1, y0 + cellH, zDiv], C.wall);
      b.span(A, 'Friso Final', [wl, y0 + 13.2, zf - side * 0.08], [wl + 1, y0 + 13.6, zf], C.wallTrim, { canCollide: false });
      for (let i = 0; i < DIM.cellsPerRow; i++) cell(b, i, side, y0, number++);
    }
    b.span(A, 'Laje Superior', [ROW_START, 31, zf], [-ROW_START, 32, zBack], C.cellWall);

    // Laje do 2º andar + acabamentos da galeria
    const G = `Galerias/Galeria ${t}`;
    const zEdge = side * E;
    b.span(G, 'Laje', [-inX, F2 - 1, zEdge], [stairX1, F2, zBack], C.cellWall);
    b.span(G, 'Piso Galeria', [-inX, F2, zEdge], [stairX1, F2 + 0.1, side * 25], C.floorCatwalk);
    b.span(G, 'Meio-fio', [ROW_START, F2, side * 25], [-ROW_START, F2 + 0.5, zf], C.curb, { studs: true });
    for (const [x0, x1] of [[-inX, BRIDGE[0]], [BRIDGE[1], stairX1]]) {
      b.span(G, 'Testeira', [x0, F2 - 1.4, zEdge - side * 0.4], [x1, F2, zEdge], C.wallTrim);
    }
    // Guarda-corpo entre colunas (vão da ponte livre)
    const stops = [-inX, ...COLUMN_X.flatMap((x) => [x - 1.3, x + 1.3]), stairX1];
    for (let i = 0; i < stops.length; i += 2) {
      const a = stops[i], c = stops[i + 1];
      const parts = a < BRIDGE[1] && c > BRIDGE[0] ? [[a, BRIDGE[0]], [BRIDGE[1], c]] : [[a, c]];
      for (const [p0, p1] of parts) if (p1 - p0 > 0.05) glassRail(b, G, 'x', zEdge, p0, p1, F2);
    }
    // Iluminação dos corredores e galerias
    for (let i = 0; i < DIM.cellsPerRow; i++) {
      const lx = cellCenterX(i);
      panelLight(b, `Iluminação/Corredor ${t}`, lx, F2 - 1, side * 22.5, 5, 1.2, i % 2 === 0);
      hangingLight(b, `Iluminação/Galeria ${t}`, lx, 30.4, side * 22.5);
    }
  }

  // --- Ponte central ---------------------------------------------------------
  const B = 'Galerias/Ponte';
  b.span(B, 'Laje Ponte', [BRIDGE[0], F2 - 1, -E], [BRIDGE[1], F2, E], C.cellWall);
  b.span(B, 'Piso Ponte', [BRIDGE[0], F2, -E], [BRIDGE[1], F2 + 0.1, E], C.floorCatwalk);
  b.span(B, 'Testeira O', [BRIDGE[0] - 0.4, F2 - 1.4, -E], [BRIDGE[0], F2, E], C.wallTrim);
  b.span(B, 'Testeira L', [BRIDGE[1], F2 - 1.4, -E], [BRIDGE[1] + 0.4, F2, E], C.wallTrim);
  glassRail(b, B, 'z', BRIDGE[0], -E, E, F2);
  glassRail(b, B, 'z', BRIDGE[1], -E, E, F2);

  // --- Mezanino leste + escada ---------------------------------------------
  const M = 'Galerias/Mezanino';
  b.span(M, 'Laje Mezanino', [stairX1, F2 - 1, -inZ], [inX, F2, inZ], C.cellWall);
  b.span(M, 'Patamar', [stairX1, F2, -E], [inX, F2 + 0.1, E], C.floorAtrium, { studs: true });
  b.span(M, 'Piso Mezanino S', [stairX1, F2, -inZ], [inX, F2 + 0.1, -E], C.floorCatwalk);
  b.span(M, 'Piso Mezanino N', [stairX1, F2, E], [inX, F2 + 0.1, inZ], C.floorCatwalk);
  for (const [z0, z1] of [[-E, -stairHalf - 0.8], [stairHalf + 0.8, E]]) {
    b.span(M, 'Testeira', [stairX1 - 0.4, F2 - 1.4, z0], [stairX1, F2, z1], C.wallTrim);
  }
  glassRail(b, M, 'z', stairX1, -E, -stairHalf - 0.8, F2);
  glassRail(b, M, 'z', stairX1, stairHalf + 0.8, E, F2);

  const S = 'Escada';
  const run = (stairX1 - stairX0) / F2;
  for (let k = 0; k < F2; k++) {
    const xa = stairX0 + k * run;
    b.span(S, `Degrau ${k + 1}`, [xa, 0, -stairHalf], [stairX1, k + 1, stairHalf], C.stair);
    b.span(S, `Focinho ${k + 1}`, [xa, k + 1, -stairHalf], [xa + 0.4, k + 1.05, stairHalf], C.stairNose, { canCollide: false });
  }
  for (const s of [-1, 1]) {
    b.span(S, 'Parede Escada', [stairX0, 0, s * stairHalf], [stairX1, F2 + 3.5, s * (stairHalf + 0.8)], C.wall);
    b.span(S, 'Pórtico Pilar', [stairX0 - 1.6, 0, s * stairHalf], [stairX0, 14, s * (stairHalf + 2.4)], C.wallTrim);
  }
  b.span(S, 'Fundo Escada', [stairX1, 0, -stairHalf - 0.8], [stairX1 + 0.4, F2 - 1, stairHalf + 0.8], C.wall);
  b.span(S, 'Pórtico Viga', [stairX0 - 1.6, 11, -stairHalf], [stairX0, 14, stairHalf], C.wallTrim);

  // --- Hall: spawn e posto de guarda ---------------------------------------
  const H = 'Hall';
  b.box(H, 'SpawnLocation', [-62, 0.5, 0], [8, 1, 8], C.steelLight, { className: 'SpawnLocation', studs: true });
  b.box(H, 'Borda Spawn', [-62, 0.15, 0], [9.2, 0.3, 9.2], C.curb, { studs: true });
  b.span(H, 'Balcão', [-60, 0, 9], [-56.5, 3.5, 16], C.facade);
  b.span(H, 'Tampo Balcão', [-60.3, 3.5, 8.7], [-56.2, 3.8, 16.3], C.steelLight);
  b.span(H, 'Vidro Balcão', [-56.4, 3.8, 9], [-56.3, 7.5, 16], C.glass, { transparency: 0.6 });
  b.span(H, 'Painel Monitores', [-inX, 6, 9.5], [-inX + 0.3, 9, 15.5], C.steel, { canCollide: false });
  for (const z of [-8, 8]) hangingLight(b, 'Iluminação/Hall', -61, 29, z);

  // --- Depósitos fechados (cantos oeste) ------------------------------------
  for (const s of [-1, 1]) {
    const D = `Depósitos/Depósito ${s < 0 ? 'Sul' : 'Norte'}`;
    const za = s * CELL_FRONT;
    const zb = s * (CELL_FRONT + 0.6);
    b.span(D, 'Parede Baixa', [-inX, 0, za], [ROW_START, 3, zb], C.wall);
    b.span(D, 'Parede Alta', [-inX, 10, za], [ROW_START, F2 - 1, zb], C.wall);
    b.span(D, 'Parede E', [-inX, 3, za], [-66, 10, zb], C.wall);
    b.span(D, 'Parede D', [-56, 3, za], [ROW_START, 10, zb], C.wall);
    b.span(D, 'Vidro', [-66, 3, s * (CELL_FRONT + 0.2)], [-56, 10, s * (CELL_FRONT + 0.4)], C.glass, { transparency: 0.6 });
    const zf0 = za - s * 0.05, zf1 = zb + s * 0.05;
    b.span(D, 'Caixilho E', [-66, 3, zf0], [-65.8, 10, zf1], C.steel);
    b.span(D, 'Caixilho D', [-56.2, 3, zf0], [-56, 10, zf1], C.steel);
    b.span(D, 'Caixilho Topo', [-66, 9.8, zf0], [-56, 10, zf1], C.steel);
    b.span(D, 'Caixilho Base', [-66, 3, zf0], [-56, 3.2, zf1], C.steel);
    crate(b, D, -66, 0, s * 31);
    crate(b, D, -66, 4, s * 31);
    crate(b, D, -61.5, 0, s * 30);
    rack(b, D, -61, s * 37, 12, 3, 10);
    panelLight(b, D, -61, F2 - 1, s * 33, 5, 1.2);
  }

  // --- Átrio: refeitório e caixas --------------------------------------------
  const R = 'Átrio/Refeitório';
  for (const [tx, tz] of [[-42, -8], [-42, 8], [-31, -8], [-31, 8]]) {
    b.box(R, 'Mesa Tampo', [tx, 3.2, tz], [0.4, 7, 7], C.porcelain, { shape: 'Cylinder', rotation: [0, 0, 90] });
    b.box(R, 'Mesa Pé', [tx, 1.6, tz], [1, 3, 1], C.steel);
    b.box(R, 'Mesa Base', [tx, 0.25, tz], [3, 0.3, 3], C.steel);
    for (const s of [-1, 1]) {
      b.box(R, 'Banco', [tx, 1.8, tz + s * 4.8], [6, 0.5, 1.6], C.steelLight);
      b.box(R, 'Banco Encosto', [tx, 2.9, tz + s * 5.6], [6, 1.7, 0.35], C.steel);
      b.box(R, 'Banco Pé', [tx - 2.2, 0.85, tz + s * 4.8], [0.6, 1.5, 1.2], C.steel);
      b.box(R, 'Banco Pé', [tx + 2.2, 0.85, tz + s * 4.8], [0.6, 1.5, 1.2], C.steel);
    }
  }
  const K = 'Átrio/Caixas';
  crate(b, K, 4, 0.1, -10);
  crate(b, K, 8.2, 0.1, -10);
  crate(b, K, 6.1, 4.1, -10);
  crate(b, K, 18, 0.1, 11);
  crate(b, K, 18, 0.1, 6.8, 3);
  for (let x = -45.5; x <= 32.5; x += PITCH) {
    for (const z of [-8, 8]) hangingLight(b, 'Iluminação/Átrio', x, 29, z);
  }

  // --- Sala de visitas (sob o mezanino) -------------------------------------
  const V = 'Sala de Visitas';
  b.span(V, 'Balcão', [62, 0.1, -15], [64, 3, 15], C.facade);
  b.span(V, 'Tampo', [61.8, 3, -15], [64.2, 3.3, 15], C.steelLight);
  b.span(V, 'Vidro Divisor', [62.9, 3.3, -15], [63.1, 9, 15], C.glass, { transparency: 0.6 });
  b.span(V, 'Travessa Vidro', [62.8, 9, -15], [63.2, 9.3, 15], C.steel);
  for (let z = -15; z <= 15; z += 5) {
    b.span(V, 'Divisória Cabine', [59, 0.1, z - 0.15], [67, 7, z + 0.15], C.wallTrim);
  }
  for (let z = -12.5; z <= 12.5; z += 5) {
    for (const x of [60.5, 65.5]) {
      b.box(V, 'Banqueta Coluna', [x, 0.8, z], [0.4, 1.4, 0.4], C.steel);
      b.box(V, 'Banqueta Assento', [x, 1.65, z], [1.4, 0.3, 1.4], C.wood);
    }
  }
  for (const z of [-12, 0, 12]) panelLight(b, V, 63, F2 - 1, z, 5, 1.2);

  // --- Estoque sob o mezanino (estantes) ------------------------------------
  for (const s of [-1, 1]) {
    const D = `Depósitos/Estoque ${s < 0 ? 'Sul' : 'Norte'}`;
    for (const z of [23, 29.5, 36]) rack(b, D, 63, s * z, 9, 3, 10);
    panelLight(b, D, 63, F2 - 1, s * 26.2, 5, 1.2);
    panelLight(b, D, 63, F2 - 1, s * 32.8, 5, 1.2, false);
  }

  return { parts: b.parts };
}
