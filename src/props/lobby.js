// Peças do Lobby (a praça do spawn): lojas de verdade, banco de praça, vaso com árvore,
// arco de pedra e lampião, no estilo clássico do Roblox (blocos, studs, cores neutras).
//
// Lojas: padaria, ferreiro, armazém e taverna. Todas montadas no referencial local de
// src/props/buildings.js (u = largura, v = profundidade, porta em +v; face 's' → porta em +Z,
// 'n' → −Z, 'e' → +X, 'w' → −X). O prédio fica no fundo do terreno e a frente (calçada com os
// enfeites de cada loja) em +v. Use shopFootprint(tipo, face) para o terreno no mundo.
//
// Casca comum de toda loja (alturas acima do chão):
//   -0,1 … 1    Base de pedra (embasamento)
//    1 … 9      Paredes, com a vitrine ABERTA (nicho de 1,6 de fundo, de u −4,6 a −0,6 e de
//               y 3 a 6,4): o balcão de dentro sai 0,6 pela janela; prateleira no fundo do nicho
//    1 … 7,5    Porta (u 1,4 a 3,8) com batentes e verga; degrau de pedra na frente
//    6,5 … 7,8  Toldo listrado inclinado (sem colisão) com franja
//    5,4 … 7,9  Placa pendurada num braço de ferro (sem colisão), com o emblema da loja
//    9 …        Telhado em degraus (alinhado aos eixos, sólido)
//
// Regras seguidas (testadas em tests/lobby.test.mjs e no catálogo):
// - toda peça encosta numa cadeia que chega ao chão; o que nasce no chão começa em y − 0,1;
// - duas peças de cores diferentes que se cruzam nunca têm face no mesmo plano: caixilhos,
//   batentes, vigas e ripas ficam 0,1 a 0,3 para fora da parede e só encostam nela;
// - toldo e escoras são as únicas peças inclinadas, e não colidem;
// - só cores de C, nada de Neon, nenhuma medida abaixo de 0,04, nomes sem "gui".

import { C } from '../palette.js';
import { FACES, localFrame } from './buildings.js';

/** Terreno de cada loja (largura u × profundidade v, em studs), com a porta em +v. */
export const SHOPS = Object.freeze({
  padaria: Object.freeze({ w: 16, d: 16 }),
  ferreiro: Object.freeze({ w: 20, d: 16 }),
  armazem: Object.freeze({ w: 16, d: 16 }),
  taverna: Object.freeze({ w: 18, d: 18 }),
});

/** Terreno da loja no mundo: w ao longo de X e d ao longo de Z (leste/oeste trocam as medidas). */
export function shopFootprint(kind, face) {
  const f = SHOPS[kind];
  if (!f) throw new Error(`Loja desconhecida: ${kind}`);
  if (!FACES.includes(face)) throw new Error(`Lado inválido: ${face}`);
  return face === 'e' || face === 'w' ? { w: f.d, d: f.w } : { w: f.w, d: f.d };
}

const deco = { canCollide: false };
const r2 = (v) => Math.round(v * 100) / 100;
const pick = (rand, list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

// Medidas da casca (referencial local)
const HW = 6; // meia largura da parede
const VB = -6.5; // fundo da parede
const VF = 2.5; // frente da parede
const VK = 0.9; // fundo do nicho da vitrine
const H = 9; // topo da parede
const WIN = Object.freeze({ u0: -4.6, u1: -0.6, y0: 3, y1: 6.4 }); // abertura da vitrine
const DOOR = Object.freeze({ u0: 1.4, u1: 3.8, y1: 7 });
const SIGN_U = 5; // braço da placa, entre a porta e o canto

// ---------------------------------------------------------------------------
// Casca comum
// ---------------------------------------------------------------------------

/**
 * Base, paredes com a vitrine aberta, balcão, porta, toldo, placa e janelas laterais.
 * S = { wall, plinth, trim, door, accent, emblem }.
 */
function shell(f, S) {
  f.span('Base de Pedra', [-HW - 0.5, -0.1, VB - 0.5], [HW + 0.5, 1, VF + 0.5], S.plinth);
  f.span('Degrau', [DOOR.u0 - 0.4, -0.1, VF + 0.5], [DOOR.u1 + 0.4, 0.5, VF + 1.5], C.rockDark);

  // paredes: bloco do fundo + 4 peças da frente em volta do nicho da vitrine (todas da mesma cor)
  f.span('Parede', [-HW, 1, VB], [HW, H, VK], S.wall);
  f.span('Parede', [-HW, 1, VK], [WIN.u0, H, VF], S.wall);
  f.span('Parede', [WIN.u1, 1, VK], [HW, H, VF], S.wall);
  f.span('Parede', [WIN.u0, 1, VK], [WIN.u1, WIN.y0, VF], S.wall);
  f.span('Parede', [WIN.u0, WIN.y1, VK], [WIN.u1, H, VF], S.wall);

  // dentro do nicho: fundo escuro, prateleira e o balcão, que sai 0,6 pela janela
  f.span('Fundo da Vitrine', [WIN.u0, WIN.y0, VK], [WIN.u1, WIN.y1, VK + 0.1], C.woodDark);
  f.span('Prateleira', [WIN.u0 + 0.3, 5, VK + 0.1], [WIN.u1 - 0.3, 5.25, VK + 0.6], C.wood);
  f.span('Balcão', [WIN.u0, WIN.y0, VK + 0.1], [WIN.u1, WIN.y0 + 0.35, VF + 0.6], C.wood);

  // caixilho da vitrine (0,25 para fora) e duas mãos-francesas embaixo do balcão
  const fv = [VF, VF + 0.25];
  f.span('Caixilho', [WIN.u0 - 0.4, WIN.y0 - 0.4, fv[0]], [WIN.u0, WIN.y1 + 0.4, fv[1]], S.trim);
  f.span('Caixilho', [WIN.u1, WIN.y0 - 0.4, fv[0]], [WIN.u1 + 0.4, WIN.y1 + 0.4, fv[1]], S.trim);
  f.span('Caixilho', [WIN.u0, WIN.y0 - 0.4, fv[0]], [WIN.u1, WIN.y0, fv[1]], S.trim);
  f.span('Caixilho', [WIN.u0, WIN.y1, fv[0]], [WIN.u1, WIN.y1 + 0.4, fv[1]], S.trim);
  for (const u of [-4.2, -1.3]) f.span('Mão-Francesa', [u, 2.2, VF], [u + 0.3, WIN.y0, VF + 0.5], S.trim);

  // porta (0,2 para fora) com batentes e verga (0,3 para fora)
  f.span('Porta', [DOOR.u0, 1, VF], [DOOR.u1, DOOR.y1, VF + 0.2], S.door);
  f.span('Batente', [DOOR.u0 - 0.4, 1, VF], [DOOR.u0, DOOR.y1, VF + 0.3], S.trim);
  f.span('Batente', [DOOR.u1, 1, VF], [DOOR.u1 + 0.4, DOOR.y1, VF + 0.3], S.trim);
  f.span('Verga', [DOOR.u0 - 0.4, DOOR.y1, VF], [DOOR.u1 + 0.4, DOOR.y1 + 0.5, VF + 0.3], S.trim);
  f.span('Maçaneta', [3.2, 3.8, VF + 0.2], [3.5, 4.2, VF + 0.35], C.iron, deco);

  // toldo listrado sobre a vitrine: 6 faixas inclinadas 25° (a ponta de dentro entra na parede)
  const a = 25;
  const len = 2.6;
  const cos = Math.cos((a * Math.PI) / 180);
  const sin = Math.sin((a * Math.PI) / 180);
  const vc = VF + (len / 2) * cos - 0.05;
  const yc = 7.7 - (len / 2) * sin;
  const vOut = vc + (len / 2) * cos; // ponta de fora (onde pendura a franja)
  const yOut = yc - (len / 2) * sin;
  for (let k = 0; k < 6; k++) {
    const u0 = -5.5 + 0.9 * k;
    const [c1, c2] = k % 2 ? [C.cloth, S.accent] : [S.accent, C.cloth];
    f.box('Toldo', [u0 + 0.45, yc, vc], [0.9, 0.2, len], c1, { ...deco, rot: ['u', a] });
    f.span('Franja', [u0, yOut - 0.65, vOut - 0.1], [u0 + 0.9, yOut + 0.05, vOut + 0.1], c2, deco);
  }

  // placa pendurada num braço de ferro, de lado para a rua (vista por quem passa)
  const su = SIGN_U;
  f.span('Suporte da Placa', [su - 0.15, 7.6, VF], [su + 0.15, 7.9, VF + 2.2], C.iron, deco);
  for (const v of [VF + 0.5, VF + 1.6]) f.span('Corrente', [su - 0.05, 7, v], [su + 0.05, 7.6, v + 0.1], C.iron, deco);
  f.span('Placa', [su - 0.1, 5.4, VF + 0.35], [su + 0.1, 7, VF + 1.95], C.wood, deco);
  f.span('Emblema', [su - 0.2, 5.75, VF + 0.75], [su + 0.2, 6.65, VF + 1.55], S.emblem, deco);

  // janela pequena em cada lado (vidraça escura 0,1 para fora, caixilho 0,25)
  for (const s of [-1, 1]) {
    const [u0, u1, u2] = [s * HW, s * (HW + 0.1), s * (HW + 0.25)];
    f.span('Vidraça', [u0, 3.6, -4], [u1, 6, -1.6], C.rockDark);
    f.span('Caixilho', [u0, 3.3, -4.3], [u2, 6.3, -4], S.trim);
    f.span('Caixilho', [u0, 3.3, -1.6], [u2, 6.3, -1.3], S.trim);
    f.span('Caixilho', [u0, 6, -4], [u2, 6.3, -1.6], S.trim);
    f.span('Caixilho', [u0, 3.3, -4], [u2, 3.6, -1.6], S.trim);
  }
}

/** Postes (ou cunhais) nos 4 cantos, 0,15 para fora das duas faces. */
function corners(f, name, color) {
  for (const s of [-1, 1]) {
    for (const [v0, v1] of [
      [VF - 0.25, VF + 0.15],
      [VB - 0.15, VB + 0.25],
    ]) {
      f.span(name, [s * (HW - 0.25), 1, v0], [s * (HW + 0.15), H, v1], color);
    }
  }
}

/** Vigas (ou cornija) logo abaixo do telhado, 0,1 para fora, entre os postes de canto. */
function beams(f, name, color, sides) {
  const e = HW - 0.25;
  f.span(name, [-e, 8.3, VF], [e, 8.9, VF + 0.1], color);
  f.span(name, [-e, 8.3, VB - 0.1], [e, 8.9, VB], color);
  if (!sides) return;
  for (const s of [-1, 1]) f.span(name, [s * HW, 8.3, VB + 0.25], [s * (HW + 0.1), 8.9, VF - 0.25], color);
}

/** Telhado de duas águas em degraus com a cumeeira ao longo de u (empenas nos lados). */
function roofAlongU(f, color, y0, hu, vc, hv0) {
  for (let k = 0; k < 6; k++) {
    const hv = hv0 - k;
    f.span('Telhado', [-hu, y0 + k, vc - hv], [hu, y0 + k + 1, vc + hv], color);
  }
  f.span('Cumeeira', [-hu - 0.2, y0 + 6, vc - 0.6], [hu + 0.2, y0 + 6.5, vc + 0.6], C.woodDark);
}

/** Telhado de duas águas em degraus com a cumeeira ao longo de v (empena virada para a rua). */
function roofAlongV(f, color, y0, hu0, v0, v1) {
  for (let k = 0; k < 6; k++) {
    const hu = r2(hu0 - 1.15 * k);
    f.span('Telhado', [-hu, y0 + k, v0], [hu, y0 + k + 1, v1], color);
  }
  f.span('Cumeeira', [-0.7, y0 + 6, v0 - 0.2], [0.7, y0 + 6.5, v1 + 0.2], C.woodDark);
}

/** Barril de pé: corpo, 2 aros de ferro e tampa. */
function barrel(f, u, v) {
  f.span('Barril', [u - 0.8, -0.1, v - 0.8], [u + 0.8, 2.1, v + 0.8], C.wood);
  for (const h of [0.35, 1.45])
    f.span('Aro do Barril', [u - 0.86, h, v - 0.86], [u + 0.86, h + 0.2, v + 0.86], C.iron, deco);
  f.span('Tampa do Barril', [u - 0.65, 2.1, v - 0.65], [u + 0.65, 2.2, v + 0.65], C.woodDark, deco);
}

/** Mercadoria pequena (sem colisão) numa fila ao longo de u: [u0, u1, altura, cor]. */
function goods(f, name, y, v0, v1, items) {
  for (const [u0, u1, h, color] of items) f.span(name, [u0, y, v0], [u1, y + h, v1], color, deco);
}

// ---------------------------------------------------------------------------
// Padaria: reboco com enxaimel, telhado vermelho, chaminé do forno e caixotes de pães
// ---------------------------------------------------------------------------
function padaria(f, rand) {
  shell(f, {
    wall: C.plaster,
    plinth: C.rock,
    trim: C.timber,
    door: C.woodDark,
    accent: C.banner,
    emblem: C.wheat,
  });
  corners(f, 'Poste de Canto', C.timber);
  beams(f, 'Viga', C.timber, true);
  f.span('Montante', [0.2, 1, VF], [0.6, 8.3, VF + 0.1], C.timber);
  roofAlongU(f, C.roofRed, H, 7, -2, 5.5);
  // chaminé do forno na água de trás: faces em v = −5,2 e −3,6 (degraus do telhado em −5,5 e −4,5)
  f.span('Chaminé', [2, H, -5.2], [3.6, 17, -3.6], C.brick);
  f.span('Topo da Chaminé', [1.8, 17, -5.4], [3.8, 17.4, -3.4], C.rockDark);

  const crust = () => pick(rand, [C.autumn, C.wheat, C.hay]);
  // vitrine: pães e um bolo no balcão, pães na prateleira
  goods(f, 'Pão', 3.35, 1.6, 2.6, [
    [-4.2, -3.3, 0.4, crust()],
    [-1.6, -0.9, 0.35, crust()],
  ]);
  f.span('Bolo', [-2.9, 3.35, 1.7], [-2, 3.95, 2.5], C.wheat, deco);
  f.span('Cobertura do Bolo', [-2.8, 3.95, 1.8], [-2.1, 4.1, 2.4], C.cloth, deco);
  goods(f, 'Pão', 5.25, 1.05, 1.45, [
    [-4, -3.4, 0.4, crust()],
    [-2.9, -2.3, 0.4, crust()],
    [-1.8, -1.2, 0.4, crust()],
  ]);

  // calçada: dois caixotes de pães (com cinta escura) e sacos de farinha
  for (const u of [-5.4, -3.2]) {
    f.span('Caixote de Pães', [u, -0.1, 4], [u + 1.8, 1.2, 5.4], C.crate);
    f.span('Ripa do Caixote', [u - 0.1, 0.85, 3.9], [u + 1.9, 1.05, 5.5], C.woodDark);
    goods(f, 'Pão', 1.2, 4.3, 5.1, [
      [u + 0.3, u + 0.8, 0.35, crust()],
      [u + 1, u + 1.5, 0.35, crust()],
    ]);
  }
  f.span('Saco de Farinha', [4.6, -0.1, 3.4], [5.6, 1.3, 4.4], C.cloth);
  f.span('Saco de Farinha', [5.8, -0.1, 3.4], [6.8, 1.1, 4.4], C.cloth);
  f.span('Amarra', [4.9, 1.3, 3.7], [5.3, 1.5, 4.1], C.hay, deco);
}

// ---------------------------------------------------------------------------
// Ferreiro: pedra com cunhais, telhado de ardósia, chaminé, alpendre com forja, bigorna e tina
// ---------------------------------------------------------------------------
function ferreiro(f, rand) {
  shell(f, {
    wall: C.rock,
    plinth: C.rockDark,
    trim: C.woodDark,
    door: C.wood,
    accent: C.awningBlue,
    emblem: C.iron,
  });
  corners(f, 'Cunhal', C.statueDark);
  beams(f, 'Cornija', C.statueDark, false);
  roofAlongV(f, C.roofSlate, H, 7, VB - 1, VF + 1);
  f.span('Respiro', [-0.8, 11, VF + 1], [0.8, 12.6, VF + 1.1], C.rockDark);
  // chaminé: faces em u = 3 e 4,6 (degraus do telhado em 3,55 e 4,7)
  f.span('Chaminé', [3, H, -5], [4.6, 17, -3.4], C.statueDark);
  f.span('Topo da Chaminé', [2.8, 17, -5.2], [4.8, 17.4, -3.2], C.rockDark);

  // alpendre no lado +u: telhado encostado na parede e 2 postes
  f.span('Telhado do Alpendre', [HW, 7.6, -3.4], [9.9, 8.1, 3.4], C.roofSlate);
  for (const v of [-3.2, 2.7]) f.span('Poste do Alpendre', [9.2, -0.1, v], [9.7, 7.6, v + 0.5], C.woodDark);
  // forja de pedra com brasas (apagadas: sem luz), coifa e duto até o telhado do alpendre
  f.span('Forja', [6.7, -0.1, -2.8], [8.7, 2.4, -0.8], C.statueDark);
  f.span('Brasas', [7, 2.4, -2.5], [8.4, 2.7, -1.1], C.autumnDark, deco);
  f.span('Coifa', [6.6, 5, -2.9], [8.8, 5.6, -0.7], C.statueDark);
  f.span('Duto', [7.2, 5.6, -2.3], [8.2, 7.6, -1.3], C.statueDark);
  f.span('Fole', [8.7, 0.9, -2.3], [9.4, 1.5, -1.3], C.wood, deco);
  f.span('Cabo do Fole', [9.4, 1.1, -1.9], [9.9, 1.3, -1.7], C.woodDark, deco);
  // bigorna sobre o cepo, com martelo
  f.span('Cepo', [7, -0.1, 0.4], [8.2, 1.5, 1.6], C.trunk);
  f.span('Bigorna', [7.2, 1.5, 0.6], [8, 2, 1.4], C.iron);
  f.span('Bigorna', [7.35, 2, 0.75], [7.85, 2.4, 1.25], C.iron);
  f.span('Bigorna', [6.9, 2.4, 0.65], [8.3, 2.9, 1.35], C.iron);
  f.span('Ponta da Bigorna', [8.3, 2.55, 0.85], [8.8, 2.8, 1.15], C.iron);
  f.span('Martelo', [7.3, 2.9, 0.85], [7.8, 3.2, 1.15], C.iron, deco);
  f.span('Cabo do Martelo', [7.45, 2.95, 1.15], [7.65, 3.15, 2], C.wood, deco);
  // tina de água para temperar o ferro (fundo + 4 paredes; a água só encosta nelas)
  f.span('Tina', [6.8, -0.1, 2], [8.6, 0.3, 3.2], C.wood);
  f.span('Tina', [6.8, 0.3, 2], [8.6, 1.2, 2.2], C.wood);
  f.span('Tina', [6.8, 0.3, 3], [8.6, 1.2, 3.2], C.wood);
  f.span('Tina', [6.8, 0.3, 2.2], [7, 1.2, 3], C.wood);
  f.span('Tina', [8.4, 0.3, 2.2], [8.6, 1.2, 3], C.wood);
  f.span('Água da Tina', [7, 0.3, 2.2], [8.4, 1, 3], C.water, { ...deco, transparency: 0.25, studs: false });

  // calçada: carvão e um caixote com lingotes
  f.span('Pilha de Carvão', [-5.4, -0.1, 3.6], [-3.8, 0.7, 5], C.iron);
  f.span('Carvão', [-5, 0.7, 4], [-4.2, 1.1, 4.6], C.iron, deco);
  f.span('Caixote', [-3.4, -0.1, 3.6], [-1.8, 1.3, 5], C.crate);
  const metal = () => pick(rand, [C.gold, C.statue, C.stoneOre]);
  goods(f, 'Lingote', 1.3, 3.9, 4.7, [
    [-3.1, -2.6, 0.3, metal()],
    [-2.5, -2.1, 0.3, metal()],
  ]);
  // vitrine: ferramenta, elmo e ferradura no balcão; lâminas na prateleira
  f.span('Ferramenta', [-4.2, 3.35, 1.8], [-3.4, 3.55, 2.6], C.iron, deco);
  f.span('Elmo', [-2.8, 3.35, 1.7], [-1.9, 4.1, 2.5], C.statue, deco);
  f.span('Ferradura', [-1.6, 3.35, 1.9], [-0.9, 3.5, 2.5], C.iron, deco);
  goods(f, 'Lâmina', 5.25, 1.1, 1.4, [
    [-4, -3, 0.15, C.statue],
    [-2.6, -1.6, 0.15, metal()],
    [-1.4, -1, 0.5, C.iron],
  ]);
}

// ---------------------------------------------------------------------------
// Armazém: tábuas com ripas, telhado de palha, porta do sótão com roldana, barris e caixotes
// ---------------------------------------------------------------------------
function armazem(f, rand) {
  shell(f, {
    wall: C.wood,
    plinth: C.rock,
    trim: C.timber,
    door: C.woodDark,
    accent: C.awningOlive,
    emblem: C.crate,
  });
  corners(f, 'Poste de Canto', C.woodDark);
  // ripas verticais 0,1 para fora (frente, lados e fundo), longe dos caixilhos
  for (const u of [-5.6, 0.25]) f.span('Ripa', [u, 1, VF], [u + 0.3, H, VF + 0.1], C.woodDark);
  for (const s of [-1, 1]) {
    for (const vc of [-5.5, 0]) f.span('Ripa', [s * HW, 1, vc - 0.2], [s * (HW + 0.1), H, vc + 0.2], C.woodDark);
  }
  for (const uc of [-3, 3]) f.span('Ripa', [uc - 0.2, 1, VB - 0.1], [uc + 0.2, H, VB], C.woodDark);
  roofAlongV(f, C.roofThatch, H, 7, VB - 1, VF + 1);
  // porta do sótão na empena, viga da roldana saindo do telhado e um caixote pendurado
  f.span('Portinhola do Sótão', [-1.2, 10.2, VF + 1], [1.2, 12.6, VF + 1.15], C.woodDark);
  f.span('Viga da Roldana', [-0.3, 13.1, 1], [0.3, 13.6, 5], C.woodDark);
  f.span('Corda', [-0.05, 10, 4.55], [0.05, 13.1, 4.65], C.hay, deco);
  f.span('Caixote Suspenso', [-0.6, 8.8, 4], [0.6, 10, 5.2], C.crate, deco);

  // calçada: dois barris à direita da porta, caixotes empilhados à esquerda, sacos no lado
  barrel(f, 5.4, 4.4);
  barrel(f, 5.6, 6.4);
  f.span('Caixote', [-5.6, -0.1, 3.6], [-3.6, 1.9, 5.6], C.crate);
  f.span('Ripa do Caixote', [-5.7, 0.8, 3.5], [-3.5, 1, 5.7], C.woodDark);
  f.span('Caixote', [-3.4, -0.1, 3.8], [-1.6, 1.7, 5.6], C.crate);
  f.span('Ripa do Caixote', [-3.5, 0.7, 3.7], [-1.5, 0.9, 5.7], C.woodDark);
  f.box('Caixote', [-4.6, 2.6, 4.6], [1.4, 1.4, 1.4], C.wood, { rot: ['y', 15] });
  f.span('Saco', [-7.6, -0.1, 0.4], [-6.7, 1.2, 1.4], C.cloth);
  f.span('Saco', [-7.6, -0.1, 1.6], [-6.7, 1, 2.6], C.cloth);

  // vitrine: pote, saco e rolo de pano no balcão; potes na prateleira
  const jar = () => pick(rand, [C.brick, C.cloth, C.gold, C.statue]);
  f.span('Pote', [-4.2, 3.35, 1.8], [-3.6, 4, 2.4], C.brick, deco);
  f.span('Saco', [-3.2, 3.35, 1.6], [-2.2, 3.95, 2.6], C.cloth, deco);
  f.span('Rolo de Pano', [-1.8, 3.35, 1.8], [-0.9, 3.75, 2.4], C.awningBlue, deco);
  goods(f, 'Pote', 5.25, 1.1, 1.4, [
    [-4, -3.5, 0.5, jar()],
    [-3.1, -2.6, 0.5, jar()],
    [-2.2, -1.7, 0.4, jar()],
    [-1.5, -1, 0.5, jar()],
  ]);
}

// ---------------------------------------------------------------------------
// Taverna: térreo de tijolo, andar de cima em balanço com enxaimel, telhado verde, mesas
// ---------------------------------------------------------------------------
function taverna(f, rand) {
  shell(f, {
    wall: C.brick,
    plinth: C.rockDark,
    trim: C.timber,
    door: C.woodDark,
    accent: C.bannerDark,
    emblem: C.gold,
  });
  corners(f, 'Cunhal', C.statue);
  beams(f, 'Viga', C.timber, true);
  // andar de cima 0,4 maior que o térreo em todos os lados (balanço), com mísulas na frente
  f.span('Andar de Cima', [-HW - 0.4, H, VB - 0.4], [HW + 0.4, 14, VF + 0.4], C.plaster);
  for (const u of [-5.4, 0.4, 5.4]) f.span('Mísula', [u - 0.2, 8.5, VF], [u + 0.2, H, VF + 0.4], C.timber);
  // enxaimel na frente do andar de cima (0,1 para fora): vigas, montantes e um X no meio
  const fv = [VF + 0.4, VF + 0.5];
  f.span('Viga', [-HW - 0.4, H, fv[0]], [HW + 0.4, 9.4, fv[1]], C.timber);
  f.span('Viga', [-HW - 0.4, 13.6, fv[0]], [HW + 0.4, 14, fv[1]], C.timber);
  for (const u of [-6.4, -2.2, 1.8, 6]) f.span('Montante', [u, 9.4, fv[0]], [u + 0.4, 13.6, fv[1]], C.timber);
  const xa = r2((Math.atan2(4.2, 3.6) * 180) / Math.PI);
  const xl = Math.hypot(3.6, 4.2);
  for (const s of [-1, 1]) {
    f.box('Escora', [0, 11.5, VF + 0.45], [xl, 0.25, 0.1], C.timber, { ...deco, rot: ['v', s * xa] });
  }
  // duas janelas no andar de cima (vidraça rebaixada entre os caixilhos)
  for (const s of [-1, 1]) {
    const u0 = Math.min(s * 3.2, s * 5);
    const u1 = Math.max(s * 3.2, s * 5);
    f.span('Vidraça', [u0, 10.4, fv[0]], [u1, 12.6, fv[1]], C.rockDark);
    const cv = [fv[0], VF + 0.65];
    f.span('Caixilho', [u0 - 0.3, 10.1, cv[0]], [u0, 12.9, cv[1]], C.timber);
    f.span('Caixilho', [u1, 10.1, cv[0]], [u1 + 0.3, 12.9, cv[1]], C.timber);
    f.span('Caixilho', [u0, 12.6, cv[0]], [u1, 12.9, cv[1]], C.timber);
    f.span('Caixilho', [u0, 10.1, cv[0]], [u1, 10.4, cv[1]], C.timber);
  }
  roofAlongU(f, C.roofGreen, 14, HW + 1.4, -2, 5.9);

  // calçada: duas mesas com bancos e canecas; dois barris no lado
  for (const u of [-4, 6]) {
    const v = 6.4;
    f.span('Mesa', [u - 1.6, 2.4, v - 0.9], [u + 1.6, 2.8, v + 0.9], C.wood);
    for (const du of [-1.2, 1.2]) {
      for (const dv of [-0.5, 0.5]) {
        f.span('Perna da Mesa', [u + du - 0.2, -0.1, v + dv - 0.2], [u + du + 0.2, 2.4, v + dv + 0.2], C.woodDark);
      }
    }
    for (const s of [-1, 1]) {
      f.span('Banco', [u - 1.6, 1.4, v + s * 1.35], [u + 1.6, 1.7, v + s * 1.95], C.wood);
      for (const du of [-1.25, 1.25]) {
        f.span('Perna do Banco', [u + du - 0.15, -0.1, v + s * 1.5], [u + du + 0.15, 1.4, v + s * 1.8], C.woodDark);
      }
    }
    for (const [du, dv] of [
      [-0.7, -0.2],
      [0.8, 0.3],
    ]) {
      const [cu, cv] = [u + du, v + dv];
      f.span('Caneca', [cu - 0.2, 2.8, cv - 0.2], [cu + 0.2, 3.3, cv + 0.2], pick(rand, [C.crate, C.statue]), deco);
      f.span('Espuma', [cu - 0.15, 3.3, cv - 0.15], [cu + 0.15, 3.4, cv + 0.15], C.cloth, deco);
    }
  }
  barrel(f, -7.5, 1.5);
  barrel(f, -7.5, -0.4);

  // vitrine: canecas e um barrilete no balcão; garrafas na prateleira
  for (const u of [-4.2, -3.3]) {
    f.span('Caneca', [u, 3.35, 1.8], [u + 0.5, 3.9, 2.3], C.crate, deco);
    f.span('Espuma', [u + 0.05, 3.9, 1.85], [u + 0.45, 4, 2.25], C.cloth, deco);
  }
  f.span('Barrilete', [-2, 3.35, 1.4], [-0.9, 4.3, 2.6], C.woodDark, deco);
  const bottle = () => pick(rand, [C.leafDark, C.brick, C.gold, C.pineDark]);
  goods(
    f,
    'Garrafa',
    5.25,
    1.1,
    1.4,
    [-4, -3.4, -2.8, -2.2, -1.6].map((u) => [u, u + 0.3, 0.7, bottle()]),
  );
}

const SHOP_BUILDERS = { padaria, ferreiro, armazem, taverna };

/**
 * Monta uma loja centrada em (x, z) sobre o chão de topo y, com a porta no lado `face`.
 * `rand` é o sorteio determinístico do mapa ([0, 1)); nada aqui usa Math.random.
 * Retorna a lista das Parts criadas.
 */
export function shop(b, model, kind, x, y, z, face, rand) {
  const make = SHOP_BUILDERS[kind];
  if (!make) throw new Error(`Loja desconhecida: ${kind}`);
  if (!FACES.includes(face)) throw new Error(`Lado inválido: ${face}`);
  const start = b.parts.length;
  make(localFrame(b, model, x, y, z, face), rand);
  return b.parts.slice(start);
}

// ---------------------------------------------------------------------------
// Banco de praça: pés de pedra, assento e encosto de ripas de madeira (encosto em −v)
// ---------------------------------------------------------------------------

/** Banco de praça de 4,4 × 1,7 centrado em (x, z), virado para `face` (quem senta olha para lá). */
export function bench(b, model, x, y, z, face, rand) {
  if (!FACES.includes(face)) throw new Error(`Lado inválido: ${face}`);
  const f = localFrame(b, model, x, y, z, face);
  const stone = pick(rand, [C.statue, C.statueDark]);
  const wood = pick(rand, [C.wood, C.woodDark]);
  const start = b.parts.length;
  for (const s of [-1, 1]) {
    f.span('Pé do Banco', [s * 1.3, -0.1, -0.6], [s * 1.9, 1.4, 0.6], stone);
    f.span('Poste do Encosto', [s * 1.5, 0.6, -0.9], [s * 1.9, 3.2, -0.6], stone);
  }
  for (const [v0, v1] of [
    [-0.7, -0.3],
    [-0.2, 0.2],
    [0.3, 0.7],
  ]) {
    f.span('Ripa do Assento', [-2.2, 1.4, v0], [2.2, 1.7, v1], wood);
  }
  for (const h of [2, 2.7]) f.span('Ripa do Encosto', [-2.2, h, -1], [2.2, h + 0.4, -0.8], wood);
  return b.parts.slice(start);
}

// ---------------------------------------------------------------------------
// Vaso de pedra com terra e uma arvorezinha (copa em estrela, girada e sem colisão)
// ---------------------------------------------------------------------------

/** Vaso quadrado de 4,4 × 4,4 centrado em (x, z), com a árvore no meio e flores nos cantos. */
export function planter(b, model, x, y, z, rand) {
  const start = b.parts.length;
  const span = (name, a, c, color, opts) =>
    b.span(model, name, [x + a[0], y + a[1], z + a[2]], [x + c[0], y + c[1], z + c[2]], color, opts);
  span('Base do Vaso', [-2.2, -0.1, -2.2], [2.2, 0.4, 2.2], C.statueDark);
  span('Vaso', [-2, 0.4, -2], [2, 1.8, 2], C.statue);
  // borda em 4 peças em volta da terra (a terra só encosta nelas, 0,1 abaixo do topo)
  span('Borda do Vaso', [-2.2, 1.8, -2.2], [2.2, 2.1, -1.7], C.statueDark);
  span('Borda do Vaso', [-2.2, 1.8, 1.7], [2.2, 2.1, 2.2], C.statueDark);
  span('Borda do Vaso', [-2.2, 1.8, -1.7], [-1.7, 2.1, 1.7], C.statueDark);
  span('Borda do Vaso', [1.7, 1.8, -1.7], [2.2, 2.1, 1.7], C.statueDark);
  span('Terra do Vaso', [-1.7, 1.8, -1.7], [1.7, 2, 1.7], C.soil);
  span('Tronco', [-0.25, 2, -0.25], [0.25, 4.4, 0.25], C.trunk);
  // copa: 2 ou 3 camadas em estrela (caixa girada r e r + 45°), cada uma entrando na de baixo
  const r = Math.round(rand() * 8) * 5.625;
  const [c1, c2] = pick(rand, [
    [C.leaf, C.leafDark],
    [C.leafLight, C.leaf],
    [C.autumn, C.autumnDark],
    [C.blossom, C.blossomDark],
  ]);
  const layers = rand() < 0.5 ? 2 : 3;
  let base = 4.2;
  for (let k = 0; k < layers; k++) {
    const w = 2.8 - 0.8 * k;
    const h = 1.6 - 0.35 * k;
    b.box(model, 'Copa', [x, y + base + h / 2, z], [w, h, w], c1, { ...deco, rotation: [0, r, 0] });
    b.box(model, 'Copa', [x, y + base + (h * 1.04) / 2, z], [w * 0.94, h * 1.04, w * 0.94], c2, {
      ...deco,
      rotation: [0, r + 45, 0],
    });
    base += h - 0.1;
  }
  // flores nos 4 cantos da terra
  for (const su of [-1, 1]) {
    for (const sv of [-1, 1]) {
      const color = pick(rand, [C.flowerRed, C.flowerYellow, C.cloth, C.blossom]);
      span('Flor', [su * 0.95, 2, sv * 0.95], [su * 1.45, 2.4, sv * 1.45], color, deco);
    }
  }
  return b.parts.slice(start);
}

// ---------------------------------------------------------------------------
// Arco de pedra sobre uma passagem (pilares fora da passagem, verga a 9,8 do chão)
// ---------------------------------------------------------------------------

/**
 * Arco centrado em (x, z) sobre uma passagem de `width` studs. `axis` é a direção de quem
 * passa ('x' ou 'z'); os pilares ficam dos dois lados, de |lateral| = width/2 para fora.
 * Nada com colisão fica dentro da passagem abaixo de y + 8 (as mísulas começam em 8,4).
 */
export function archGate(b, model, x, y, z, axis = 'x', width = 10) {
  if (axis !== 'x' && axis !== 'z') throw new Error(`Eixo inválido: ${axis}`);
  const start = b.parts.length;
  // t = ao longo da passagem, w = lateral
  const at = (t, w) => (axis === 'x' ? [x + t, z + w] : [x + w, z + t]);
  const span = (name, [t0, h0, w0], [t1, h1, w1], color, opts) => {
    const [ax, az] = at(t0, w0);
    const [cx, cz] = at(t1, w1);
    return b.span(model, name, [ax, y + h0, az], [cx, y + h1, cz], color, opts);
  };
  const h = width / 2;
  const end = h + 2.6; // ponta da verga (por fora dos pilares)
  for (const s of [-1, 1]) {
    span('Base do Pilar', [-1.3, -0.1, s * h], [1.3, 1, s * end], C.statueDark);
    span('Pilar do Arco', [-1, 1, s * (h + 0.3)], [1, 9, s * (h + 2.3)], C.statue);
    span('Capitel', [-1.3, 9, s * h], [1.3, 9.8, s * end], C.statueDark);
    // mísulas em degraus por dentro, abaixo da verga, sugerindo a curva do arco
    span('Mísula', [-0.9, 8.4, s * (h - 1)], [0.9, 9.8, s * h], C.statue);
    span('Mísula', [-0.9, 9.1, s * (h - 1.8)], [0.9, 9.8, s * (h - 1)], C.statue);
    // estandarte nas duas faces de cada pilar (sem colisão)
    for (const st of [-1, 1]) {
      span('Estandarte', [st * 1, 3.5, s * (h + 0.6)], [st * 1.2, 8.5, s * (h + 2)], C.banner, deco);
      span('Ponta do Estandarte', [st * 1, 3, s * (h + 0.9)], [st * 1.2, 3.5, s * (h + 1.7)], C.bannerDark, deco);
    }
  }
  span('Verga do Arco', [-1.1, 9.8, -end], [1.1, 11.4, end], C.statue);
  // ameias em cima da verga e o brasão nas duas faces
  const step = (end - 1) / 2;
  for (let k = -2; k <= 2; k++) {
    span('Ameia', [-0.8, 11.4, k * step - 0.7], [0.8, 12.4, k * step + 0.7], C.statueDark);
  }
  for (const st of [-1, 1]) span('Brasão', [st * 1.1, 10, -1.2], [st * 1.3, 11.2, 1.2], C.gold, deco);
  return b.parts.slice(start);
}

// ---------------------------------------------------------------------------
// Lampião: poste de ferro escuro com lanterna (vidro claro de Plastic, sem luz)
// ---------------------------------------------------------------------------

/** Lampião de 9,6 studs com a base em (x, y, z). */
export function lampPost(b, model, x, y, z) {
  const start = b.parts.length;
  const span = (name, a, c, color, opts) =>
    b.span(model, name, [x + a[0], y + a[1], z + a[2]], [x + c[0], y + c[1], z + c[2]], color, opts);
  span('Base do Lampião', [-0.7, -0.1, -0.7], [0.7, 0.6, 0.7], C.statueDark);
  span('Haste do Lampião', [-0.25, 0.6, -0.25], [0.25, 7, 0.25], C.iron);
  for (const hy of [1.2, 6.4]) span('Anel do Lampião', [-0.4, hy, -0.4], [0.4, hy + 0.3, 0.4], C.iron);
  span('Base da Lanterna', [-0.6, 7, -0.6], [0.6, 7.3, 0.6], C.iron);
  span('Vidro da Lanterna', [-0.45, 7.3, -0.45], [0.45, 8.5, 0.45], C.cloth);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      span('Grade da Lanterna', [sx * 0.45, 7.3, sz * 0.45], [sx * 0.6, 8.5, sz * 0.6], C.iron);
    }
  }
  span('Teto da Lanterna', [-0.7, 8.5, -0.7], [0.7, 8.8, 0.7], C.iron);
  span('Teto da Lanterna', [-0.45, 8.8, -0.45], [0.45, 9.1, 0.45], C.iron);
  span('Remate', [-0.15, 9.1, -0.15], [0.15, 9.6, 0.15], C.iron);
  return b.parts.slice(start);
}
