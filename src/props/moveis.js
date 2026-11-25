// Móveis e enfeites das construções do Vale, em blocos lisos (voxel). Cada função devolve as peças
// de um item para `kit.item(nome, peças)` (src/props/oficina.js): [nome, [u0, y0, v0], [u1, y1, v1],
// cor, opts], com y relativo ao piso. Medidas sempre em frações (x,1 a x,9) para não cair no plano
// das paredes, e peças de cores diferentes só se tocam por faces opostas (sem z-fighting).

import { C } from '../palette.js';

/** Mesa: tampo claro sobre 4 pés escuros recuados 0,15. */
export function mesa(u0, v0, u1, v1, h = 1.5, top = C.pxWoodLight, leg = C.pxWoodDark) {
  const out = [['Tampo', [u0, h - 0.2, v0], [u1, h, v1], top]];
  for (const [a, b] of [
    [u0 + 0.15, v0 + 0.15],
    [u1 - 0.45, v0 + 0.15],
    [u0 + 0.15, v1 - 0.45],
    [u1 - 0.45, v1 - 0.45],
  ])
    out.push(['Pé', [a, 0, b], [a + 0.3, h - 0.2, b + 0.3], leg]);
  return out;
}

/** Banco comprido (assento e pés na mesma madeira). */
export function banco(u0, v0, u1, v1, h = 0.9, color = C.pxWood) {
  const alongU = u1 - u0 >= v1 - v0;
  const out = [['Assento', [u0, h - 0.2, v0], [u1, h, v1], color]];
  if (alongU) {
    out.push(['Pé', [u0 + 0.1, 0, v0 + 0.05], [u0 + 0.4, h - 0.2, v1 - 0.05], color]);
    out.push(['Pé', [u1 - 0.4, 0, v0 + 0.05], [u1 - 0.1, h - 0.2, v1 - 0.05], color]);
  } else {
    out.push(['Pé', [u0 + 0.05, 0, v0 + 0.1], [u1 - 0.05, h - 0.2, v0 + 0.4], color]);
    out.push(['Pé', [u0 + 0.05, 0, v1 - 0.4], [u1 - 0.05, h - 0.2, v1 - 0.1], color]);
  }
  return out;
}

/** Banquinho. */
export const banquinho = (u, v) => [['Banquinho', [u - 0.3, 0, v - 0.3], [u + 0.3, 0.8, v + 0.3], C.pxWood]];

/** Barril de madeira com duas cintas de ferro (as cintas saem 0,05 do corpo). */
export const barril = (u, v) => [
  ['Barril', [u - 0.6, 0, v - 0.6], [u + 0.6, 1.4, v + 0.6], C.pxWood],
  ['Cinta', [u - 0.65, 0.25, v - 0.65], [u + 0.65, 0.4, v + 0.65], C.pxIron],
  ['Cinta', [u - 0.65, 1.0, v - 0.65], [u + 0.65, 1.15, v + 0.65], C.pxIron],
];

/** Caixote. */
export const caixote = (u, v, s = 1.2, color = C.pxWoodLight) => [
  ['Caixote', [u - s / 2, 0, v - s / 2], [u + s / 2, s, v + s / 2], color],
];

/** Saco de grãos ou farinha. */
export const saco = (u, v) => [['Saco', [u - 0.45, 0, v - 0.35], [u + 0.45, 0.9, v + 0.35], C.pxCream]];

/** Fardo de feno. */
export const fardo = (u0, v0, u1, v1, y = 0) => [['Fardo de Feno', [u0, y, v0], [u1, y + 0.9, v1], C.pxHay]];

/** Tapete (sem colisão, 0,1 de altura). */
export const tapete = (u0, v0, u1, v1, color) => [
  ['Tapete', [u0, 0, v0], [u1, 0.1, v1], color, { canCollide: false }],
];

/** Balcão: corpo escuro e tampo claro. */
export const balcao = (u0, v0, u1, v1, h = 1.6) => [
  ['Corpo do Balcão', [u0, 0, v0], [u1, h - 0.2, v1], C.pxWoodDark],
  ['Tampo do Balcão', [u0, h - 0.2, v0], [u1, h, v1], C.pxWoodLight],
];

const BOOKS = [C.pxBook, C.pxClothBlue, C.pxCream, C.pxClothRed, C.pxWoodLight];

/**
 * Estante encostada: corpo escuro e livros coloridos saindo 0,12 da frente. `face` é o lado da
 * frente: '+u', '-u', '+v' ou '-v'.
 */
export function estante(u0, v0, u1, v1, h, face, fill = BOOKS) {
  const out = [['Estante', [u0, 0, v0], [u1, h, v1], C.pxWoodDark]];
  const alongU = face.endsWith('v');
  const [a0, a1] = alongU ? [u0, u1] : [v0, v1];
  const front = { '+u': u1, '-u': u0, '+v': v1, '-v': v0 }[face];
  const dir = face.startsWith('+') ? 1 : -1;
  const [f0, f1] = dir > 0 ? [front, front + 0.12] : [front - 0.12, front];
  let k = 0;
  for (let y = 0.5; y + 0.75 <= h - 0.2; y += 1.0) {
    for (let a = a0 + 0.2; a + 0.5 <= a1 - 0.15; a += 0.6) {
      const color = fill[k++ % fill.length];
      const hh = 0.55 + (k % 3) * 0.1;
      out.push(
        alongU
          ? ['Livro', [a, y, f0], [a + 0.5, y + hh, f1], color]
          : ['Livro', [f0, y, a], [f1, y + hh, a + 0.5], color],
      );
    }
  }
  return out;
}

/** Lareira de pedra encostada na parede, com o fogo (sem Neon) na boca. */
export function lareira(u0, v0, u1, v1, h, face) {
  const out = [['Lareira', [u0, 0, v0], [u1, h, v1], C.pxStoneWallDark]];
  const um = (u0 + u1) / 2;
  const vm = (v0 + v1) / 2;
  const fire = {
    '+u': [
      [u1, 0, vm - 0.7],
      [u1 + 0.25, 0.7, vm + 0.7],
    ],
    '-u': [
      [u0 - 0.25, 0, vm - 0.7],
      [u0, 0.7, vm + 0.7],
    ],
    '+v': [
      [um - 0.7, 0, v1],
      [um + 0.7, 0.7, v1 + 0.25],
    ],
    '-v': [
      [um - 0.7, 0, v0 - 0.25],
      [um + 0.7, 0.7, v0],
    ],
  }[face];
  out.push(['Fogo', fire[0], fire[1], C.pxFire, { canCollide: false }]);
  return out;
}

/** Lampião pendurado no forro (`H` = altura do forro, relativa ao piso): a luz do prédio. */
export const lampiao = (u, v, H, color = [255, 214, 150]) => [
  ['Corrente', [u - 0.08, H - 1.2, v - 0.08], [u + 0.08, H, v + 0.08], C.pxIron, { canCollide: false }],
  [
    'Lampião',
    [u - 0.45, H - 2.0, v - 0.45],
    [u + 0.45, H - 1.2, v + 0.45],
    C.pxWindowLit,
    { canCollide: false, material: 'Neon', light: { type: 'Point', range: 20, brightness: 1.3, color } },
  ],
];

/** Estandarte pendurado numa parede (face da parede em `at`, saindo para `dir`). Sem colisão. */
export function estandarte(axis, at, dir, a0, a1, y0, y1, color) {
  const [p0, p1] = dir > 0 ? [at, at + 0.15] : [at - 0.15, at];
  const o = { canCollide: false };
  return axis === 'v'
    ? [
        ['Estandarte', [a0, y0, p0], [a1, y1, p1], color, o],
        ['Barra', [a0 - 0.1, y1, p0], [a1 + 0.1, y1 + 0.15, p1], C.pxGold, o],
      ]
    : [
        ['Estandarte', [p0, y0, a0], [p1, y1, a1], color, o],
        ['Barra', [p0, y1, a0 - 0.1], [p1, y1 + 0.15, a1 + 0.1], C.pxGold, o],
      ];
}

/** Poço de pedra com água, dois postes, travessa e telhadinho. */
export const poco = (u, v) => [
  ['Poço', [u - 1.2, 0, v - 1.2], [u + 1.2, 1.0, v + 1.2], C.pxStoneWall],
  ['Água do Poço', [u - 0.9, 1.0, v - 0.9], [u + 0.9, 1.05, v + 0.9], C.pxWater, { canCollide: false }],
  ['Poste', [u - 1.1, 1.0, v - 0.15], [u - 0.8, 3.0, v + 0.15], C.pxWoodDark],
  ['Poste', [u + 0.8, 1.0, v - 0.15], [u + 1.1, 3.0, v + 0.15], C.pxWoodDark],
  ['Travessa', [u - 1.1, 3.0, v - 0.15], [u + 1.1, 3.3, v + 0.15], C.pxWoodDark],
  ['Telhadinho', [u - 1.4, 3.3, v - 0.9], [u + 1.4, 3.6, v + 0.9], C.pxRoofRed],
];

/** Boneco de treino: poste, saco de palha e braços. */
export const bonecoTreino = (u, v) => [
  ['Poste', [u - 0.15, 0, v - 0.15], [u + 0.15, 2.6, v + 0.15], C.pxWoodDark],
  ['Saco de Palha', [u - 0.45, 1.2, v - 0.3], [u + 0.45, 2.2, v + 0.3], C.pxHay],
  ['Braços', [u - 1.0, 1.8, v - 0.1], [u + 1.0, 2.0, v + 0.1], C.pxWoodDark],
];

/** Cavalete de lanças encostado (frente para `face` = '+u' ou '-u' ou '+v' ou '-v'). */
export function cavalete(u0, v0, u1, v1, face) {
  const out = [['Cavalete', [u0, 0, v0], [u1, 2.8, v1], C.pxWoodDark]];
  const alongU = face.endsWith('v');
  const [a0, a1] = alongU ? [u0, u1] : [v0, v1];
  const front = { '+u': u1, '-u': u0, '+v': v1, '-v': v0 }[face];
  const [f0, f1] = face.startsWith('+') ? [front, front + 0.15] : [front - 0.15, front];
  for (let a = a0 + 0.35; a + 0.15 <= a1 - 0.2; a += 0.7)
    out.push(
      alongU
        ? ['Lança', [a, 0.3, f0], [a + 0.15, 3.3, f1], C.pxIron]
        : ['Lança', [f0, 0.3, a], [f1, 3.3, a + 0.15], C.pxIron],
    );
  return out;
}
