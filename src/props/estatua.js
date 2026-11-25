// Estátua de Luvitlua (o perfil do dono do jogo no Roblox) no estrado do centro do Lobby.
//
// Como as estátuas de criador das praças de lobby: pedestal de pedra em degraus com faixa dourada,
// placa com o nome em letras de pixel (blocos, nada de SurfaceGui) e, em cima, o avatar em voxel:
// cavaleiro de armadura escura, capa azul e elmo com viseira, erguendo a espada de gelo (a lâmina
// brilha: Neon com luz). Tudo alinhado aos eixos, de frente para o spawn (+z).

import { C } from '../palette.js';

/** Fonte de pixel 5×7 (só as letras do nome). '#' = bloco. */
const FONT = {
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
};

export const STATUE_NAME = 'LUVITLUA';

/**
 * Monta a estátua no centro (x, z) com o pé do pedestal em `baseY` (topo do estrado).
 * Ocupa no máximo ±7,5 em x e z (cabe no estrado de raio 10). Devolve as Parts criadas.
 */
export function buildStatue(b, x, baseY, z) {
  const start = b.parts.length;
  const M = 'Lobby/Estátua de Luvitlua';
  const s = (model, name, [x0, y0, z0], [x1, y1, z1], color, opts) =>
    b.span(model, name, [x + x0, baseY + y0, z + z0], [x + x1, baseY + y1, z + z1], color, opts);
  const P = `${M}/Pedestal`;
  // pedestal em degraus (cada degrau entra no de baixo pelo topo, nunca no mesmo plano lateral)
  s(P, 'Degrau', [-7.5, 0, -7.5], [7.5, 1, 7.5], C.pxStoneWallDark);
  s(P, 'Degrau', [-6.5, 1, -6.5], [6.5, 2, 6.5], C.pxStoneWall);
  s(P, 'Corpo do Pedestal', [-5, 2, -5], [5, 6, 5], C.pxStoneWallDark);
  s(P, 'Faixa Dourada', [-5.4, 6, -5.4], [5.4, 6.6, 5.4], C.pxGold);
  s(P, 'Tampo', [-5.8, 6.6, -5.8], [5.8, 7.2, 5.8], C.pxStoneWall);
  // placa com o nome na frente do pedestal (letras de 0,2 stud por pixel, saindo 0,15 da placa)
  s(P, 'Placa', [-4.8, 2.6, 5], [4.8, 4.8, 5.3], C.pxGold);
  const px = 0.2;
  const width = STATUE_NAME.length * 6 - 1;
  const x0 = -(width * px) / 2;
  const top = 4.4;
  [...STATUE_NAME].forEach((ch, k) => {
    FONT[ch].forEach((row, r) => {
      // blocos seguidos da mesma linha viram uma peça só
      let c = 0;
      while (c < row.length) {
        if (row[c] !== '#') {
          c++;
          continue;
        }
        let e = c;
        while (e + 1 < row.length && row[e + 1] === '#') e++;
        const u0 = x0 + (k * 6 + c) * px;
        const u1 = x0 + (k * 6 + e + 1) * px;
        s(`${P}/Nome`, `Letra ${ch}`, [u0, top - (r + 1) * px, 5.3], [u1, top - r * px, 5.45], C.pxArmor);
        c = e + 1;
      }
    });
  });

  // o avatar em voxel sobre o tampo (y = 7,2), de frente para +z
  const F = `${M}/Avatar`;
  const y = 7.2;
  for (const side of [-1, 1]) {
    const a = side < 0 ? -1.6 : 0.2;
    s(F, 'Bota', [a, y, -0.7], [a + 1.4, y + 1, 0.9], C.pxIron);
    s(F, 'Perna', [a + 0.1, y + 1, -0.5], [a + 1.3, y + 4, 0.5], C.pxArmor);
  }
  s(F, 'Saia da Armadura', [-1.8, y + 3.4, -0.8], [1.8, y + 4.6, 0.8], C.pxIron);
  s(F, 'Cinto', [-2, y + 4.4, -0.9], [2, y + 4.8, 0.9], C.pxGold);
  s(F, 'Tronco', [-1.9, y + 4.6, -0.8], [1.9, y + 8, 0.8], C.pxArmor);
  s(F, 'Peitoral', [-1.4, y + 5.4, 0.8], [1.4, y + 7.6, 1], C.pxIron);
  s(F, 'Emblema', [-0.4, y + 6.2, 1], [0.4, y + 7, 1.1], C.pxGold);
  s(F, 'Capa', [-1.8, y + 2.3, -1.2], [1.8, y + 7.8, -0.8], C.pxClothBlue);
  for (const side of [-1, 1]) {
    const [a0, a1] = side < 0 ? [-3.1, -1.7] : [1.7, 3.1];
    s(F, 'Ombreira', [a0, y + 7.2, -1], [a1, y + 8.6, 1], C.pxIron);
  }
  // braço esquerdo para baixo; braço direito erguido segurando a espada
  s(F, 'Braço Esquerdo', [-2.9, y + 4.7, -0.5], [-1.9, y + 7.2, 0.5], C.pxArmor);
  // a manopla fica 0,05 abaixo do topo do cinto (as duas tampas nunca no mesmo plano)
  s(F, 'Manopla', [-3, y + 3.95, -0.6], [-1.8, y + 4.75, 0.6], C.pxIron);
  s(F, 'Braço Direito', [1.9, y + 7, -0.5], [2.9, y + 10.2, 0.5], C.pxArmor);
  s(F, 'Manopla', [1.8, y + 10.2, -0.6], [3, y + 11, 0.6], C.pxIron);
  // cabeça: elmo com viseira de gelo e penacho
  s(F, 'Elmo', [-1.1, y + 8, -1], [1.1, y + 10.2, 1], C.pxIron);
  s(F, 'Viseira', [-0.8, y + 9, 1], [0.8, y + 9.3, 1.1], C.pxIce);
  s(F, 'Penacho', [-0.25, y + 10.2, -0.9], [0.25, y + 11.2, 0.9], C.pxClothBlue);
  // espada de gelo erguida: cabo, guarda dourada e lâmina que brilha
  const E = `${M}/Espada de Gelo`;
  s(E, 'Cabo', [2.2, y + 10.6, -0.2], [2.6, y + 12, 0.2], C.pxWoodDark);
  s(E, 'Guarda', [1.4, y + 12, -0.3], [3.4, y + 12.4, 0.3], C.pxGold);
  s(E, 'Lâmina', [2, y + 12.4, -0.25], [2.8, y + 18.8, 0.25], C.pxIce, {
    material: 'Neon',
    canCollide: false,
    light: { type: 'Point', range: 18, brightness: 1.4, color: [170, 215, 255] },
  });
  s(E, 'Ponta', [2.2, y + 18.8, -0.15], [2.6, y + 19.8, 0.15], C.pxIce, { canCollide: false });
  return b.parts.slice(start);
}
