// Fonte-monumento: estátua do boneco clássico do Roblox (R6, estilo 2008) em pedra,
// erguendo o logo antigo (quadrado inclinado com furo quadrado) acima da cabeça.
// Só Part clássico, descrito como dados. Todas as medidas são relativas ao centro (cx, cz)
// e ao topo do chão (y). A única peça que encosta no chão é o degrau, afundado 0,1 nele.
//
// Corte (alturas acima de y):
//   -0,1 … 0,6   Degrau da Fonte (quadrado de 22 × 22)
//    0,6 … 2,2   Mureta do tanque (19 × 19, parede de 1,2)
//    2,2 … 2,5   Borda (beiral de 0,2 para dentro e para fora)
//    0,6 … 0,8   Fundo do tanque;  0,8 … 1,9  Água
//    0,8 … 7,0   Pedestal (base, corpo e tampo)
//    7,0 … 20,25 Estátua R6 em escala 2,5 (pernas, tronco, braços e cabeça)
//   19,4 … 26,75 Logo, preso pela ponta de baixo na mão do braço levantado

import { C } from '../palette.js';

/** Meia largura do quadrado ocupado pela fonte (o degrau vai de -11 a +11). */
export const FOUNTAIN_HALF = 11;

const S = 2.5; // 1 unidade do boneco R6 = 2,5 studs
const OX = -2; // estátua e pedestal deslocados em x para o logo erguido ficar no meio da fonte
const TILT = 15; // inclinação do logo em torno do eixo de visão (z), em graus

/**
 * Monta a fonte com a estátua centrada em (cx, cz), sobre um chão plano com topo em y.
 * @param {ReturnType<import('../builder.js').makeBuilder>} b construtor de Parts
 * @param {string} model caminho do modelo (ex.: 'Praça/Fonte')
 */
export function fountainStatue(b, model, cx, y, cz) {
  const P = (x, h, z) => [cx + x, y + h, cz + z];
  const span = (m, name, a, z, color, opts) => b.span(m, name, P(...a), P(...z), color, opts);
  const water = { transparency: 0.25, canCollide: false, studs: false };

  // --- Tanque ---------------------------------------------------------------
  const F = `${model}/Tanque`;
  span(F, 'Degrau da Fonte', [-11, -0.1, -11], [11, 0.6, 11], C.statue);

  // mureta (colide): norte/sul inteiras, leste/oeste entre elas
  for (const s of [-1, 1]) {
    span(F, 'Mureta', [-9.5, 0.6, s * 8.3], [9.5, 2.2, s * 9.5], C.statueDark);
    span(F, 'Mureta', [s * 8.3, 0.6, -8.3], [s * 9.5, 2.2, 8.3], C.statueDark);
  }
  // borda com beiral de 0,2 dos dois lados da mureta (topo em 2,5)
  for (const s of [-1, 1]) {
    span(F, 'Borda', [-9.7, 2.2, s * 8.1], [9.7, 2.5, s * 9.7], C.statue);
    span(F, 'Borda', [s * 8.1, 2.2, -8.1], [s * 9.7, 2.5, 8.1], C.statue);
  }
  // pilares dos cantos, apoiados na borda norte/sul
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      span(F, 'Pilar do Canto', [sx * 8.3, 2.5, sz * 8.3], [sx * 9.5, 3.7, sz * 9.5], C.statueDark);
      span(F, 'Remate do Pilar', [sx * 8.5, 3.7, sz * 8.5], [sx * 9.3, 4.5, sz * 9.3], C.statue);
    }
  }
  // fundo escuro e água (a água encosta na mureta; o topo dela, 1,9, não coincide com nenhuma face)
  span(F, 'Fundo da Fonte', [-8.3, 0.6, -8.3], [8.3, 0.8, 8.3], C.rockDark);
  span(F, 'Água da Fonte', [-8.3, 0.8, -8.3], [8.3, 1.9, 8.3], C.water, water);

  // --- Pedestal -------------------------------------------------------------
  const PD = `${model}/Pedestal`;
  span(PD, 'Base do Pedestal', [OX - 3.5, 0.8, -3.5], [OX + 3.5, 2.4, 3.5], C.statueDark);
  span(PD, 'Corpo do Pedestal', [OX - 2.6, 2.4, -2.6], [OX + 2.6, 6.4, 2.6], C.statue);
  span(PD, 'Tampo do Pedestal', [OX - 3, 6.4, -3], [OX + 3, 7, 3], C.statueDark);
  // placa de bronze na frente (-z), 0,1 para fora da face, sem colisão
  span(PD, 'Placa', [OX - 1.6, 3.4, -2.7], [OX + 1.6, 5.4, -2.6], C.gold, { canCollide: false });
  // bicas nos outros três lados, com o filete de água caindo fora da base (|u| >= 3,7 > 3,5)
  // (u = distância ao eixo do pedestal; w = largura em torno do meio da face)
  const spout = (xz) => {
    const box = (u0, w0, h0, u1, w1, h1) => {
      const [x0, z0] = xz(u0, w0);
      const [x1, z1] = xz(u1, w1);
      return [
        [x0, h0, z0],
        [x1, h1, z1],
      ];
    };
    span(PD, 'Bica', ...box(2.6, -0.4, 4.2, 4.4, 0.4, 4.8), C.statueDark);
    // o filete entra 0,05 na bica (apoio) e 0,2 na água do tanque
    span(PD, 'Água da Bica', ...box(3.7, -0.25, 1.7, 4.2, 0.25, 4.25), C.water, water);
  };
  spout((u, w) => [OX + u, w]); // leste
  spout((u, w) => [OX - u, w]); // oeste
  spout((u, w) => [OX + w, u]); // fundo (+z)

  // --- Estátua R6 (escala S) ------------------------------------------------
  const E = `${model}/Estátua`;
  const t0 = 7; // pés no tampo do pedestal
  const hip = t0 + 2 * S; // 12
  const neck = hip + 2 * S; // 17
  const half = S / 2; // profundidade de 1 unidade
  span(E, 'Perna Esquerda', [OX - S, t0, -half], [OX, hip, half], C.statue);
  span(E, 'Perna Direita', [OX, t0, -half], [OX + S, hip, half], C.statue);
  span(E, 'Tronco da Estátua', [OX - S, hip, -half], [OX + S, neck, half], C.statueDark);
  span(E, 'Braço Esquerdo', [OX - 2 * S, hip, -half], [OX - S, neck, half], C.statue);
  // braço girado 180° no ombro (junta a 0,5 unidade abaixo do topo do tronco): caixa vertical
  const shoulder = neck - S / 2; // 15,75
  const armBottom = shoulder - S / 2; // 14,5
  const armTop = shoulder + 1.5 * S; // 19,5
  span(E, 'Braço Levantado', [OX + S, armBottom, -half], [OX + 2 * S, armTop, half], C.statue);
  // cabeça: duas caixas cruzadas (cantos chanfrados) e um tampo menor, imitando a cabeça arredondada
  span(E, 'Cabeça da Estátua', [OX - 1.5, neck, -1.2], [OX + 1.5, neck + 3, 1.2], C.statue);
  span(E, 'Cabeça da Estátua', [OX - 1.2, neck, -1.5], [OX + 1.2, neck + 3, 1.5], C.statue);
  span(E, 'Topo da Cabeça', [OX - 1.2, neck + 3, -1.2], [OX + 1.2, neck + 3.25, 1.2], C.statue);

  // --- Logo clássico (4 barras giradas juntas em torno do mesmo centro) -----------------
  // Quadrado de 6 com barras de 1,5 (furo de 3) e 1 de espessura, inclinado TILT graus em z.
  // Todas sem colisão (peça girada nunca colide).
  const L = `${model}/Logo`;
  const outer = 6;
  const bar = 1.5;
  const depth = 1;
  const cosT = Math.cos((TILT * Math.PI) / 180);
  const sinT = Math.sin((TILT * Math.PI) / 180);
  // mesmo giro que CFrame.Angles(0, 0, TILT) aplica à peça (rotationMatrix em src/builder.js)
  const rot = (ox, oy) => [ox * cosT - oy * sinT, ox * sinT + oy * cosT];
  const off = (outer - bar) / 2; // 2,25
  const bars = [
    [0, off, outer, bar], // topo
    [0, -off, outer, bar], // baixo
    [-off, 0, bar, outer - 2 * bar], // esquerda
    [off, 0, bar, outer - 2 * bar], // direita
  ];
  // A ponta mais baixa do quadrado (canto local (-3, -3)) fica sobre o meio da mão;
  // a barra de baixo entra 0,1 na mão (contato garantido).
  const [lowX, lowY] = rot(-outer / 2, -outer / 2); // (-2,121; -3,674)
  const lx = OX + 1.5 * S - lowX; // centro do logo em x
  const ly = armTop - 0.1 - lowY; // centro do logo em y
  for (const [ox, oy, sx, sy] of bars) {
    const [rx, ry] = rot(ox, oy);
    b.box(L, 'Logo', P(lx + rx, ly + ry, 0), [sx, sy, depth], C.cloth, {
      canCollide: false,
      rotation: [0, 0, TILT],
    });
  }
}
