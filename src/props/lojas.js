// Lojas do Vale, cada uma na planta da sua área (PLANS em src/map.js), em tamanho real e com
// interior mobiliado: Taverna, Ferraria, Mercado Coberto, Padaria, Torre do Mago (loja de magia),
// Estábulo, Banco e Salão do Clã (a planta "Salão da Guilda": nas peças o nome não pode ter a sílaba
// proibida do teste de estilo). Só lojas: sem castelos nem igreja (pedido do dono).
//
// Desenho em escala de desenho (planta em 24×24, porta de 4 × 6) e montagem em tamanho real pelo
// referencial (DIM.buildScale em u e v, DIM.buildScaleY na altura): a loja sai com 48 × 48 studs,
// porta de 8 × 9 e pé-direito de 12 ou mais. Cores neutras (reboco, creme, pedra, madeira, ardósia).
// Luz: o lampião (ou a brasa, o forno, a bola de cristal) por dentro e duas lanternas acesas na
// fachada, dos lados da porta. A zona de passagem da porta fica livre (sem nada com colisão).

import { C } from '../palette.js';
import { PLANS, DIM } from '../map.js';
import { makeFrame } from './frame.js';
import { planMask, buildShell, makeKit, SKIPPED } from './oficina.js';
import {
  mesa,
  banco,
  banquinho,
  barril,
  caixote,
  saco,
  fardo,
  tapete,
  balcao,
  estante,
  lareira,
  lampiao,
  estandarte,
  cavalete,
} from './moveis.js';

const LIGHT_FIRE = { type: 'Point', range: 18, brightness: 1.6, color: [255, 150, 90] };

/**
 * Projeto de cada prédio: casca (cores, alturas, porta) e móveis. `door` é a porta do prédio em
 * coordenadas locais (no Banco, a porta do salão fica no alto da escadaria, em v = 4).
 */
export const SHOPS = {
  taverna: {
    model: 'Taverna',
    door: [6, 0],
    H: 8,
    wall: C.pxPlaster,
    roof: C.pxRoofSlate,
    floor: C.pxWood,
    furnish(add, H) {
      add('Balcão', balcao(-7.7, -8.3, 1.7, -7.3));
      add('Prateleira de Garrafas', estante(-7.7, -11, 1.7, -10.3, 3.3, '+v', [C.pxWindowLit, C.pxMoss, C.pxBook]));
      add('Barril', barril(9.6, -9.7));
      add('Barril', barril(9.6, -8.1));
      add('Barril', barril(8.0, -9.7));
      for (const u0 of [-9.6, -3.6]) {
        add('Mesa', mesa(u0, -5.3, u0 + 3.2, -3.7));
        add('Banco', banco(u0, -6.2, u0 + 3.2, -5.6));
        add('Banco', banco(u0, -3.4, u0 + 3.2, -2.8));
      }
      add('Lareira', lareira(-11, 4.1, -10.1, 7.9, 3.1, '+u'));
      add('Tapete', tapete(-9.7, 4.6, -8.4, 7.4, C.pxCream));
      for (const v0 of [2.3, 8.3]) {
        add('Mesa', mesa(-7.6, v0, -4.4, v0 + 1.6));
        add('Banco', banco(-7.6, v0 - 0.9, -4.4, v0 - 0.3));
        add('Banco', banco(-7.6, v0 + 1.9, -4.4, v0 + 2.5));
      }
      add('Lampião', lampiao(-2.7, -4.7, H));
    },
    outside(f) {
      // chaminé da lareira e placa com caneca sobre a porta
      f.span('Chaminé', [-11.6, 8.3, 4.6], [-10.2, 13, 7.4], C.pxStoneWallDark);
      f.span('Placa', [4.6, 6.4, 0], [7.4, 7.6, 0.2], C.pxWoodDark);
      f.span('Caneca da Placa', [5.6, 6.7, 0.2], [6.4, 7.3, 0.3], C.pxGold);
    },
  },

  ferraria: {
    model: 'Ferraria',
    door: [-4, 8],
    H: 8,
    wall: C.pxStoneWall,
    roof: C.pxStoneWallDark,
    floor: C.pxStoneDark,
    furnish(add) {
      add('Forja', [
        ['Forja', [7.6, 0, -2.4], [11, 1.5, 2.4], C.pxStoneWallDark],
        [
          'Brasa',
          [8.1, 1.5, -1.9],
          [10.6, 1.75, 1.9],
          C.pxFire,
          { material: 'Neon', canCollide: false, light: LIGHT_FIRE },
        ],
        ['Coifa', [7.9, 4.2, -2.2], [11, 7.6, 2.2], C.pxStoneWallDark, { canCollide: false }],
      ]);
      add('Bigorna', [
        ['Toco', [5.2, 0, -0.4], [6.0, 0.8, 0.4], C.pxWoodDark],
        ['Bigorna', [4.9, 0.8, -0.25], [6.5, 1.3, 0.25], C.pxIron],
      ]);
      add('Tina', [
        ...barril(5.6, 2.3),
        ['Espelho da Tina', [5.1, 1.4, 1.8], [6.1, 1.45, 2.8], C.pxWater, { canCollide: false }],
      ]);
      const rack = [['Painel de Armas', [-9.6, 0, -7], [-4.4, 3.2, -6.7], C.pxWoodDark]];
      for (let u = -9.1; u <= -5.2; u += 1.0) rack.push(['Espada', [u, 0.5, -6.7], [u + 0.2, 2.9, -6.55], C.pxIron]);
      rack.push(['Escudo', [-5.0, 1.2, -6.7], [-4.6, 2.6, -6.55], C.pxClothRed]);
      add('Armas na Parede', rack);
      add('Bancada', [
        ...mesa(-10.7, -1.6, -9.1, 2.6),
        ['Martelo', [-10.3, 1.5, -0.9], [-9.6, 1.7, -0.5], C.pxIron],
        ['Tenaz', [-10.2, 1.5, 0.7], [-9.5, 1.65, 1.0], C.pxIron],
      ]);
      add('Caixote de Minério', caixote(1.6, -5.8));
      add('Caixote de Carvão', caixote(1.6, -4.4, 1.2, C.pxWoodDark));
      add('Barril', barril(-10.2, 5.8));
      add('Cavalete', cavalete(-11, -5.6, -10.7, -2.6, '+u'));
    },
    outside(f) {
      f.span('Chaminé', [8.6, 8.3, -0.9], [10.6, 12.6, 0.9], C.pxStoneWallDark);
      f.span('Placa', [-5.4, 6.4, 8], [-2.6, 7.6, 8.2], C.pxWoodDark);
      f.span('Bigorna da Placa', [-4.6, 6.7, 8.2], [-3.4, 7.2, 8.3], C.pxIron);
    },
  },

  mercado: {
    model: 'Mercado Coberto',
    door: [0, 12],
    H: 8,
    wall: C.pxWoodLight,
    roof: C.pxWoodDark,
    floor: C.pxStoneWall,
    furnish(add, H) {
      const stalls = [
        [-10.6, C.pxCream, [C.pxClothRed, C.pxHay, C.pxMoss]],
        [-2.6, C.pxWoodLight, [C.pxCream, C.pxBook, C.pxWindowLit]],
        [5.4, C.pxStoneWall, [C.pxMoss, C.pxClothRed, C.pxHay]],
      ];
      for (const [u0, cloth, goods] of stalls) {
        const u1 = u0 + 5.2;
        const p = [
          ...balcao(u0, -5.4, u1, -4.4, 1.4),
          ['Poste da Barraca', [u0, 0, -7], [u0 + 0.3, 4.0, -6.7], C.pxWoodDark],
          ['Poste da Barraca', [u1 - 0.3, 0, -7], [u1, 4.0, -6.7], C.pxWoodDark],
          ['Toldo', [u0, 4.0, -7], [u1, 4.2, -4.2], cloth, { canCollide: false }],
        ];
        goods.forEach((g, k) =>
          p.push(['Mercadoria', [u0 + 0.4 + k * 1.6, 1.4, -5.2], [u0 + 1.4 + k * 1.6, 1.8, -4.6], g]),
        );
        add('Barraca', p);
      }
      add('Barril', barril(-10.1, 0.5));
      add('Barril', barril(-10.1, 2.1));
      add('Saco', saco(10.2, 0.3));
      add('Saco', saco(10.2, 1.5));
      add('Saco', saco(9.0, 0.9));
      add('Caixote', caixote(10.1, -2.6));
      add('Caixote', caixote(8.7, -2.6));
      add('Mesa de Frutas', [
        ...mesa(-1.9, -1.6, 1.9, 0.2, 1.2),
        ['Frutas', [-1.5, 1.2, -1.3], [-0.3, 1.5, -0.1], C.pxClothRed],
        ['Frutas', [0.3, 1.2, -1.3], [1.5, 1.5, -0.1], C.pxHay],
      ]);
      add('Lampião', lampiao(0.3, -2.7, H));
    },
    outside(f) {
      f.span('Placa', [-1.4, 6.3, 12], [1.4, 7.5, 12.2], C.pxWoodDark);
      f.span('Moeda da Placa', [-0.4, 6.6, 12.2], [0.4, 7.2, 12.3], C.pxGold);
    },
  },

  padaria: {
    model: 'Padaria',
    door: [0, 8],
    H: 8,
    wall: C.pxCream,
    roof: C.pxRoofSlate,
    floor: C.pxStoneWall,
    furnish(add) {
      add('Forno', [
        ['Forno', [-8.6, 0, -9], [-3.4, 3.2, -7.2], C.pxStoneWallDark],
        [
          'Fogo do Forno',
          [-6.8, 0.6, -7.2],
          [-5.2, 1.6, -6.95],
          C.pxFire,
          { material: 'Neon', canCollide: false, light: LIGHT_FIRE },
        ],
      ]);
      const breads = [C.pxHay, C.pxWoodLight, C.pxCream];
      add('Prateleira de Pães', estante(-9, -6.6, -8.3, -1.4, 3.4, '+u', breads));
      add('Prateleira de Pães', estante(8.3, -6.6, 9, -1.4, 3.4, '-u', breads));
      add('Balcão', [
        ...balcao(-4.6, -2.6, 4.6, -1.8, 1.6),
        ['Pão', [-3.9, 1.6, -2.4], [-2.9, 1.9, -2.0], C.pxHay],
        ['Pão', [-0.5, 1.6, -2.4], [0.5, 1.9, -2.0], C.pxWoodLight],
        ['Pão', [2.9, 1.6, -2.4], [3.9, 1.9, -2.0], C.pxHay],
      ]);
      add('Mesa de Sovar', [
        ...mesa(3.4, -8.8, 8.2, -7.4),
        ['Massa', [4.4, 1.5, -8.5], [5.8, 1.7, -7.7], C.pxCream],
        ['Massa', [6.4, 1.5, -8.5], [7.6, 1.7, -7.7], C.pxCream],
      ]);
      add('Saco de Farinha', saco(6.8, -5.0));
      add('Saco de Farinha', saco(6.8, -3.8));
      add('Barril', barril(-6.8, 1.6));
      add('Vitrine', [...mesa(2.6, 4.6, 4.4, 6.4), ['Bolo', [3.0, 1.5, 5.0], [4.0, 1.9, 6.0], C.pxCream]]);
      add('Vitrine', [...mesa(-4.4, 4.6, -2.6, 6.4), ['Bolo', [-4.0, 1.5, 5.0], [-3.0, 1.9, 6.0], C.pxHay]]);
    },
    outside(f) {
      f.span('Chaminé', [-7.7, 8.3, -8.6], [-6.3, 13, -7.4], C.pxStoneWallDark);
      f.span('Placa', [-1.4, 6.3, 8], [1.4, 7.5, 8.2], C.pxWoodDark);
      f.span('Pão da Placa', [-0.6, 6.6, 8.2], [0.6, 7.2, 8.3], C.pxHay);
    },
  },

  torreMago: {
    model: 'Torre do Mago',
    door: [0, 12],
    H: 13,
    wall: C.pxStoneWall,
    roof: C.pxRoofSlate,
    roofStep: 1,
    roofRise: 1.1,
    floor: C.pxWoodDark,
    windows: { y0: 3.0, y1: 5.2, period: 5, phase: 2 },
    furnish(add) {
      add('Tapete Estrelado', [
        ...tapete(-3.1, -1.1, 3.1, 1.1, C.pxStoneDark),
        ...tapete(-1.1, -3.1, 1.1, 3.1, C.pxStoneDark),
      ]);
      add('Mesa do Mago', [
        ['Pedestal', [-0.5, 0.1, -0.5], [0.5, 1.0, 0.5], C.pxWoodDark],
        ['Tampo', [-1.6, 1.0, -1.6], [1.6, 1.2, 1.6], C.pxWoodLight],
        [
          'Bola de Cristal',
          [-0.4, 1.2, -0.4],
          [0.4, 2.0, 0.4],
          C.pxCream,
          {
            material: 'Neon',
            canCollide: false,
            light: { type: 'Point', range: 22, brightness: 1.4, color: [190, 205, 255] },
          },
        ],
      ]);
      add('Estante', estante(-2.6, -9.9, 2.6, -9.1, 3.6, '+v'));
      add('Estante', estante(-9.9, -2.6, -9.1, 2.6, 3.6, '+u'));
      add('Estante', estante(9.1, -2.6, 9.9, 2.6, 3.6, '-u'));
      add('Caldeirão', [
        ['Caldeirão', [-6.4, 0, 3.8], [-4.8, 1.1, 5.4], C.pxIron],
        ['Poção', [-6.2, 1.1, 4.0], [-5.0, 1.15, 5.2], C.pxMoss, { canCollide: false }],
      ]);
      add('Luneta', [
        ['Tripé', [5.2, 0, 4.2], [5.6, 1.6, 4.6], C.pxWoodDark],
        ['Luneta', [4.4, 1.6, 4.25], [6.6, 2.0, 4.55], C.pxGold],
      ]);
      add('Caixote de Pergaminhos', caixote(5.6, -5.2, 1.2, C.pxWood));
      add('Banquinho', banquinho(-2.5, 2.1));
    },
  },

  estabulo: {
    model: 'Estábulo',
    door: [0, -4],
    H: 7,
    wall: C.pxWood,
    roof: C.pxThatch,
    floor: C.pxSoil,
    furnish(add, H) {
      for (const side of [-1, 1]) {
        const [w0, w1] = side < 0 ? [-11, -6.6] : [6.6, 11];
        const wallU = side < 0 ? -11 : 11;
        for (const v of [0.15, 4.15])
          add('Divisória', [['Divisória', [w0, 0, v], [w1, 2.2, v + 0.3], C.pxWoodDark]]);
        for (const v of [0.45, 4.45]) {
          const [h0, h1] = side < 0 ? [wallU + 0.3, wallU + 1.7] : [wallU - 1.7, wallU - 0.3];
          const [t0, t1] = side < 0 ? [wallU + 0.2, wallU + 0.8] : [wallU - 0.8, wallU - 0.2];
          add('Feno da Baia', fardo(h0, v + 0.6, h1, v + 1.6));
          add('Cocho', [
            ['Cocho', [t0, 0, v + 2.1], [t1, 0.8, v + 3.3], C.pxWood],
            ['Espelho do Cocho', [t0 + 0.1, 0.8, v + 2.2], [t1 - 0.1, 0.85, v + 3.2], C.pxWater, { canCollide: false }],
          ]);
        }
      }
      add('Selas', [
        ['Cavalete de Selas', [-8.6, 0, -11], [-3.4, 1.6, -10.6], C.pxWoodDark],
        ['Sela', [-8.2, 1.6, -10.95], [-6.8, 2.1, -10.65], C.pxClothRed],
        ['Sela', [-6.2, 1.6, -10.95], [-4.8, 2.1, -10.65], C.pxBook],
      ]);
      add('Feno', [
        ...fardo(7.4, -10.8, 9.0, -9.6),
        ...fardo(9.2, -10.8, 10.8, -9.6),
        ...fardo(8.3, -10.8, 9.9, -9.6, 0.9),
      ]);
      add('Saco de Ração', saco(-9.8, -6.3));
      add('Saco de Ração', saco(-9.8, -7.5));
      add('Barril', barril(9.8, -6.6));
      add('Lampião', lampiao(0.3, -7.7, H));
    },
  },

  banco: {
    model: 'Banco',
    parts: [[-8, -12, 8, 4]], // o salão; a escadaria da frente (v de 4 a 8) é montada à parte
    door: [0, 4],
    H: 9,
    floorTop: 1.2,
    doorH: 6.4,
    baseTop: 2.0,
    wall: C.pxCream,
    roof: C.pxRoofSlate,
    floor: C.pxStoneWall,
    windows: { y0: 3.4, y1: 5.8, period: 5, phase: 1 },
    zoneFront: 10,
    furnish(add, H) {
      for (const [u0, u1, xs] of [
        [-6.9, -3.1, [-6.5, -5.5, -4.5, -3.5]],
        [3.1, 6.9, [3.4, 4.4, 5.4, 6.4]],
      ]) {
        const p = [
          ['Corpo do Balcão', [u0, 0, -3.4], [u1, 1.1, -2.6], C.pxWoodDark],
          ['Tampo do Balcão', [u0, 1.1, -3.4], [u1, 1.3, -2.6], C.pxWoodLight],
          ['Trilho da Grade', [u0, 3.0, -3.1], [u1, 3.15, -2.9], C.pxIron],
        ];
        for (const x of xs) p.push(['Grade', [x, 1.3, -3.05], [x + 0.12, 3.0, -2.95], C.pxIron]);
        add('Caixa do Banco', p);
      }
      add('Cofre', [
        ['Cofre', [-4.6, 0, -11], [4.6, 5.0, -8.4], C.pxStoneWallDark],
        ['Porta do Cofre', [-1.6, 0.4, -8.4], [1.6, 3.6, -8.2], C.pxIron],
        ['Roda do Cofre', [-0.5, 1.5, -8.2], [0.5, 2.5, -8.05], C.pxGold],
      ]);
      add('Pilha de Ouro', [['Pilha de Ouro', [-6.6, 0, -10.6], [-5.4, 0.6, -9.4], C.pxGold]]);
      add('Pilha de Ouro', [['Pilha de Ouro', [5.4, 0, -10.6], [6.6, 0.6, -9.4], C.pxGold]]);
      for (const u of [-6.2, 5.0])
        add('Baú', [
          ['Baú', [u, 0, -6.4], [u + 1.4, 0.9, -5.4], C.pxWood],
          ['Fecho', [u + 0.55, 0.4, -5.4], [u + 0.85, 0.7, -5.3], C.pxGold],
        ]);
      add('Banco de Espera', banco(-6.9, 0.4, -6.3, 2.6));
      add('Banco de Espera', banco(6.3, 0.4, 6.9, 2.6));
      add('Tapete', tapete(-1.2, -7.6, 1.2, 2.9, C.pxStoneDark));
      add('Lampião', lampiao(0.3, -5.3, H));
    },
    outside(f) {
      // escadaria de pedra até a porta do salão (1,2 acima do chão), colunas e pórtico
      f.span('Degrau', [-3.7, 0, 4.0], [3.7, 1.2, 5.3], C.pxStoneWall);
      f.span('Degrau', [-3.7, 0, 5.3], [3.7, 0.8, 6.6], C.pxStoneWall);
      f.span('Degrau', [-3.7, 0, 6.6], [3.7, 0.4, 7.9], C.pxStoneWall);
      for (const u of [-3.65, 3.15]) f.span('Coluna', [u, 1.2, 4.4], [u + 0.5, 6.6, 4.9], C.pxCream);
      f.span('Pórtico', [-3.9, 6.6, 4.0], [3.9, 7.2, 5.2], C.pxCream);
      f.span('Moeda do Pórtico', [-0.6, 6.7, 5.2], [0.6, 7.1, 5.35], C.pxGold);
    },
  },

  guilda: {
    model: 'Salão do Clã',
    door: [0, 12],
    H: 9,
    wall: C.pxWoodLight,
    roof: C.pxRoofSlate,
    floor: C.pxWood,
    furnish(add, H) {
      add('Mesa Redonda', mesa(-2.4, -3.6, 2.4, -0.4, 1.5));
      for (const [u, v] of [
        [-3.1, -2.1],
        [3.1, -2.1],
        [-1.1, -4.3],
        [1.1, -4.3],
        [-1.1, 0.3],
        [1.1, 0.3],
      ])
        add('Banquinho', banquinho(u, v));
      add('Tapete', tapete(-1.2, 1.6, 1.2, 10.9, C.pxStoneDark));
      const board = [
        ['Poste do Quadro', [-10.9, 0, -2.0], [-10.6, 3.0, -1.7], C.pxWoodDark],
        ['Poste do Quadro', [-10.9, 0, 1.7], [-10.6, 3.0, 2.0], C.pxWoodDark],
        ['Quadro de Missões', [-10.95, 1.2, -2.2], [-10.75, 2.85, 2.2], C.pxWood],
      ];
      for (const [v0, y0] of [
        [-1.8, 1.5],
        [-0.6, 2.0],
        [0.6, 1.4],
        [1.2, 2.2],
      ])
        board.push(['Cartaz', [-10.75, y0, v0], [-10.68, y0 + 0.6, v0 + 0.5], C.pxCream]);
      add('Quadro de Missões', board);
      add('Troféu', [
        ['Pedestal do Troféu', [-0.7, 0, -10.9], [0.7, 1.2, -9.5], C.pxStoneWall],
        ['Troféu', [-0.4, 1.2, -10.5], [0.4, 2.2, -9.9], C.pxGold],
      ]);
      add('Estandarte', estandarte('v', -11, 1, -2.6, -1.6, 2.5, 6.0, C.pxCream));
      add('Estandarte', estandarte('v', -11, 1, 1.6, 2.6, 2.5, 6.0, C.pxCream));
      add('Cavalete', cavalete(10.7, -2.6, 11, 1.4, '-u'));
      add('Barril', barril(9.6, 2.2));
      add('Lampião', lampiao(0.3, -2.3, H));
    },
    outside(f) {
      f.span('Escudo da Placa', [-1.0, 6.3, 12], [1.0, 7.9, 12.2], C.pxWoodDark);
      f.span('Faixa do Escudo', [-0.2, 6.5, 12.2], [0.2, 7.7, 12.3], C.pxGold);
    },
  },
};

/** Porta e altura do piso de cada prédio (o visualizador usa para a vista de dentro). */
export const SHOP_DOORS = Object.fromEntries(
  Object.entries(SHOPS).map(([k, s]) => [k, { door: s.door, floorTop: s.floorTop ?? 0.4, model: s.model }]),
);

const SCALE = { s: DIM.buildScale, y: DIM.buildScaleY };
const LIGHT_LANTERN = { type: 'Point', range: 22, brightness: 1.4, color: [255, 206, 140] };

/** Monta a loja da área `pad` (chão do vale em `floorY`). Devolve as zonas de passagem (mundo). */
export function buildShop(b, pad, floorY) {
  const s = SHOPS[pad.plan];
  const f = makeFrame(b, `Construções/${s.model}`, pad, floorY, [], SCALE);
  const occ = planMask(s.parts ?? PLANS[pad.plan].parts, pad.size / 2 / DIM.buildScale);
  const floorTop = s.floorTop ?? 0.4;
  const shell = buildShell(f, occ, {
    door: s.door,
    doorW: 4,
    doorH: s.doorH ?? 6,
    H: s.H,
    floorTop,
    floor: s.floor,
    base: [s.baseTop ?? 1.0, C.pxStoneWallDark],
    wall: s.wall,
    windows: { y0: 2.4, y1: 4.6, period: 6, phase: 0, color: C.pxWindowLit, material: 'Neon', ...(s.windows ?? {}) },
    roof: { color: s.roof, step: s.roofStep ?? 2, rise: s.roofRise ?? 1.2, trim: C.pxWoodDark },
  });
  const zone = shell.zone;
  if (s.zoneFront) zone.max[2] = Math.max(zone.max[2], s.zoneFront);
  f.zone('Porta', [zone.min[0], zone.min[1], zone.min[2]], [zone.max[0], zone.max[1], zone.max[2]]);
  const kit = makeKit(f, shell.fit, [zone], floorTop);
  s.furnish((name, pieces) => kit.item(name, pieces), s.H - floorTop);
  SKIPPED.push(...kit.skipped);
  if (s.outside) s.outside(f);

  // duas lanternas acesas na fachada, dos lados da porta (presas na parede por um suporte de ferro)
  const { du, dv } = shell.door;
  const out = -shell.door.s;
  for (const side of [-1, 1]) {
    const u = du + side * 2.7;
    const [b0, b1] = out > 0 ? [dv, dv + 0.45] : [dv - 0.45, dv];
    const [l0, l1] = out > 0 ? [dv + 0.2, dv + 0.65] : [dv - 0.65, dv - 0.2];
    f.span('Suporte da Lanterna', [u - 0.1, 4.6, b0], [u + 0.1, 4.75, b1], C.pxIron, { canCollide: false });
    f.span('Lanterna da Fachada', [u - 0.25, 3.9, l0], [u + 0.25, 4.6, l1], C.pxWindowLit, {
      material: 'Neon',
      canCollide: false,
      light: LIGHT_LANTERN,
    });
  }
  return f.zones;
}
