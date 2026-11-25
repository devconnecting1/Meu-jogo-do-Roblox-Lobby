// Fonte-monumento: estátua do boneco clássico do Roblox (R6, estilo 2008) em pedra,
// erguendo o logo antigo (quadrado inclinado com furo quadrado) acima da cabeça.
// Só Part clássico, descrito como dados. Todas as medidas são relativas ao centro (cx, cz)
// e ao topo do chão (y). Só o degrau de baixo encosta no chão, afundado 0,1 nele.
//
// A fonte é octogonal (como as fontes de praça bem feitas): cada octógono é uma cruz de duas
// caixas alinhadas aos eixos + 4 cantos girados 45° em Y (giro só em Y pode colidir).
//
// Corte (alturas acima de y):
//   -0,1 … 0,3   Degrau de baixo (octógono de apótema 12,8)
//    0,3 … 0,6   Degrau de cima (apótema 12)
//    0,6 … 2,0   Mureta do tanque (anel de 11 a 9,8);  2,0 … 2,4  Borda larga para sentar (11,4 a 9,5)
//    0,6 … 0,8   Fundo do tanque;  0,8 … 1,7  Água do tanque
//    0,8 … 4,2   Coluna da taça (estrela de 2 caixas) com o colarinho de 3,5 a 4,2
//    4,2 … 5,9   Taça de cima (fundo, parede, beiral) com água de 4,6 a 5,3
//    4,9 … 5,3   8 bicas na parede da taça; filetes de água caem até 1,5 (dentro do tanque)
//    4,6 … 10,0  Pedestal no meio da taça (base, corpo com placa, tampo)
//   10,0 … 23,25 Estátua R6 em escala 2,5 (pernas, tronco, braços e cabeça)
//   22,4 … 29,75 Logo, preso pela ponta de baixo na mão do braço levantado

import { C } from '../palette.js';

/** Meia largura do quadrado ocupado pela fonte (o degrau de baixo vai de -12,8 a +12,8). */
export const FOUNTAIN_HALF = 13;

const S = 2.5; // 1 unidade do boneco R6 = 2,5 studs
const OX = -2; // estátua e pedestal deslocados em x para o logo erguido ficar no meio da fonte
const TILT = 15; // inclinação do logo em torno do eixo de visão (z), em graus
const TAN = Math.tan(Math.PI / 8); // meia aresta ÷ apótema do octógono regular (0,4142)
const SQ = Math.SQRT1_2;

/** Giro em Y que deixa o eixo X local de um canto (su, sv) tangente ao octógono. */
const cornerYaw = (su, sv) => (su * sv > 0 ? 45 : -45);

/**
 * Monta a fonte com a estátua centrada em (cx, cz), sobre um chão plano com topo em y.
 * @param {ReturnType<import('../builder.js').makeBuilder>} b construtor de Parts
 * @param {string} model caminho do modelo (ex.: 'Praça/Fonte')
 */
export function fountainStatue(b, model, cx, y, cz) {
  const P = (x, h, z) => [cx + x, y + h, cz + z];
  const span = (m, name, a, z, color, opts) => b.span(m, name, P(...a), P(...z), color, opts);
  const water = { transparency: 0.25, canCollide: false, studs: false };

  /** Octógono maciço de apótema a, entre as alturas h0 e h1. */
  const octagon = (m, name, a, h0, h1, color, opts = {}) => {
    const w = a * TAN;
    span(m, name, [-a, h0, -w], [a, h1, w], color, opts);
    span(m, name, [-w, h0, -a], [w, h1, a], color, opts);
    // cantos: aresta 2w na tangente, profundidade w (de a − w até a na diagonal)
    const rc = a - w / 2;
    for (const su of [-1, 1]) {
      for (const sv of [-1, 1]) {
        b.box(m, name, P(su * rc * SQ, (h0 + h1) / 2, sv * rc * SQ), [2 * w, h1 - h0, w], color, {
          ...opts,
          rotation: [0, cornerYaw(su, sv), 0],
        });
      }
    }
  };

  /** Anel octogonal entre os apótemas ai (dentro) e ao (fora). */
  const ring = (m, name, ao, ai, h0, h1, color, opts = {}) => {
    const w = ao * TAN; // meia aresta de fora
    for (const s of [-1, 1]) {
      span(m, name, [-w, h0, s * ai], [w, h1, s * ao], color, opts);
      span(m, name, [s * ai, h0, -w], [s * ao, h1, w], color, opts);
    }
    const rc = (ao + ai) / 2;
    for (const su of [-1, 1]) {
      for (const sv of [-1, 1]) {
        b.box(m, name, P(su * rc * SQ, (h0 + h1) / 2, sv * rc * SQ), [2 * w, h1 - h0, ao - ai], color, {
          ...opts,
          rotation: [0, cornerYaw(su, sv), 0],
        });
      }
    }
  };

  // --- Tanque de baixo ------------------------------------------------------
  const F = `${model}/Tanque`;
  octagon(F, 'Degrau da Fonte', 12.8, -0.1, 0.3, C.statueDark);
  octagon(F, 'Degrau da Fonte', 12, 0.3, 0.6, C.statue);
  ring(F, 'Mureta', 11, 9.8, 0.6, 2, C.statueDark);
  // borda larga (1,9) com beiral de 0,3 para dentro e 0,4 para fora: dá para sentar
  ring(F, 'Borda', 11.4, 9.5, 2, 2.4, C.statue);
  // fundo escuro e água encostados na mureta (o topo da água, 1,7, não coincide com nenhuma face)
  octagon(F, 'Fundo da Fonte', 9.8, 0.6, 0.8, C.rockDark);
  octagon(F, 'Água da Fonte', 9.8, 0.8, 1.7, C.water, water);

  // --- Taça de cima ---------------------------------------------------------
  const T = `${model}/Taça`;
  // coluna em estrela (caixa reta + caixa girada 45°) e colarinho octogonal embaixo da taça
  span(T, 'Coluna da Taça', [-1.8, 0.8, -1.8], [1.8, 4.2, 1.8], C.statueDark);
  b.box(T, 'Coluna da Taça', P(0, 2.5, 0), [3.6, 3.4, 3.6], C.statueDark, { rotation: [0, 45, 0] });
  octagon(T, 'Base da Taça', 3.4, 3.5, 4.2, C.statueDark);
  octagon(T, 'Fundo da Taça', 5.4, 4.2, 4.6, C.statue);
  ring(T, 'Parede da Taça', 5.4, 4.6, 4.6, 5.6, C.statue);
  ring(T, 'Beiral da Taça', 5.7, 4.4, 5.6, 5.9, C.statueDark);
  octagon(T, 'Água da Taça', 4.6, 4.6, 5.3, C.water, water);

  // 8 bicas na parede da taça (4 retas e 4 nas diagonais, giradas 45°) e os filetes de água
  // caindo até 1,5 (0,2 dentro da água do tanque). Cada filete entra 0,05 na sua bica.
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    // r = distância ao centro, l = lateral
    const at = (r, l) => (dx ? [dx * r, dx * l] : [dz * l, dz * r]);
    const box = (r0, l0, h0, r1, l1, h1) => {
      const [x0, z0] = at(r0, l0);
      const [x1, z1] = at(r1, l1);
      return [
        [x0, h0, z0],
        [x1, h1, z1],
      ];
    };
    span(T, 'Bica', ...box(5.4, -0.3, 4.9, 6.4, 0.3, 5.3), C.statueDark);
    span(T, 'Água da Bica', ...box(6, -0.15, 1.5, 6.3, 0.15, 4.95), C.water, water);
  }
  for (const su of [-1, 1]) {
    for (const sv of [-1, 1]) {
      // eixo X local da bica apontando para fora (giro oposto ao dos cantos)
      b.box(T, 'Bica', P(su * 5.9 * SQ, 5.1, sv * 5.9 * SQ), [1, 0.4, 0.6], C.statueDark, {
        rotation: [0, -cornerYaw(su, sv), 0],
      });
      const [fx, fz] = [su * 6.15 * SQ, sv * 6.15 * SQ];
      span(T, 'Água da Bica', [fx - 0.15, 1.5, fz - 0.15], [fx + 0.15, 4.95, fz + 0.15], C.water, water);
    }
  }

  // --- Pedestal (no meio da taça, saindo da água) ----------------------------
  const PD = `${model}/Pedestal`;
  span(PD, 'Base do Pedestal', [OX - 2.2, 4.6, -2.2], [OX + 2.2, 6.4, 2.2], C.statueDark);
  span(PD, 'Corpo do Pedestal', [OX - 1.7, 6.4, -1.7], [OX + 1.7, 9.4, 1.7], C.statue);
  span(PD, 'Tampo do Pedestal', [OX - 2.8, 9.4, -2.2], [OX + 2.8, 10, 2.2], C.statueDark);
  // placa de bronze na frente (-z), 0,1 para fora da face, sem colisão
  span(PD, 'Placa', [OX - 1.2, 7.2, -1.8], [OX + 1.2, 8.6, -1.7], C.gold, { canCollide: false });

  // --- Estátua R6 (escala S) ------------------------------------------------
  const E = `${model}/Estátua`;
  const t0 = 10; // pés no tampo do pedestal
  const hip = t0 + 2 * S; // 15
  const neck = hip + 2 * S; // 20
  const half = S / 2; // profundidade de 1 unidade
  span(E, 'Perna Esquerda', [OX - S, t0, -half], [OX, hip, half], C.statue);
  span(E, 'Perna Direita', [OX, t0, -half], [OX + S, hip, half], C.statue);
  span(E, 'Tronco da Estátua', [OX - S, hip, -half], [OX + S, neck, half], C.statueDark);
  span(E, 'Braço Esquerdo', [OX - 2 * S, hip, -half], [OX - S, neck, half], C.statue);
  // braço girado 180° no ombro (junta a 0,5 unidade abaixo do topo do tronco): caixa vertical
  const shoulder = neck - S / 2; // 18,75
  const armBottom = shoulder - S / 2; // 17,5
  const armTop = shoulder + 1.5 * S; // 22,5
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
