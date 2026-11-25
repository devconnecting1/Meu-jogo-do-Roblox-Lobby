// Estátua de Luvitlua (o perfil do dono do jogo no Roblox) no estrado do centro do Lobby.
//
// Como as estátuas de criador das praças de lobby: pedestal de pedra em degraus com faixa dourada,
// placa com o nome em letras de pixel (blocos, nada de SurfaceGui) e, em cima, o boneco R6 oficial
// do Roblox com as proporções exatas (em studs, escala 1): tronco 2×2×1, braços e pernas 1×2×1 e
// cabeça ~1,25 com os cantos quebrados em degrau (o "arredondado" do R6 no estilo voxel).
// Tudo alinhado aos eixos, de frente para o spawn (+z), numa cor só de estátua (cinza claro).
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

/** Escala do boneco R6 (o R6 tem 5,2 studs de altura; na estátua, ~18,7). */
export const R6_SCALE = 3.6;

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
        s(`${P}/Nome`, `Letra ${ch}`, [u0, top - (r + 1) * px, 5.3], [u1, top - r * px, 5.45], C.pxEngrave);
        c = e + 1;
      }
    });
  });

  // o boneco R6 sobre o tampo (y = 7,2), em escala R6_SCALE: cada stud do R6 vira R6_SCALE studs
  const F = `${M}/Boneco R6`;
  const k = R6_SCALE;
  const y = 7.2;
  const r6 = (name, [a0, b0, c0], [a1, b1, c1]) =>
    s(F, name, [a0 * k, y + b0 * k, c0 * k], [a1 * k, y + b1 * k, c1 * k], C.pxStatue);
  // pernas e braços 0,02 mais finos que o tronco (o vinco das juntas do R6) e um vão entre as pernas
  r6('Perna Esquerda', [-1, 0, -0.48], [-0.02, 2, 0.48]);
  r6('Perna Direita', [0.02, 0, -0.48], [1, 2, 0.48]);
  r6('Tronco', [-1, 2, -0.5], [1, 4, 0.5]);
  r6('Braço Esquerdo', [-2, 2, -0.48], [-1, 4, 0.48]);
  r6('Braço Direito', [1, 2, -0.48], [2, 4, 0.48]);
  // cabeça: dois blocos cruzados (miolo alto e casca larga) quebram os cantos como no R6
  r6('Cabeça', [-0.52, 4, -0.52], [0.52, 5.2, 0.52]);
  r6('Cabeça', [-0.62, 4.08, -0.62], [0.62, 5.12, 0.62]);
  return b.parts.slice(start);
}
