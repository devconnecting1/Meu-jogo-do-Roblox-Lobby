// Construções da vila: casa, celeiro, moinho, poço, torre de vigia, monte de feno e tenda.
//
// Cada tipo é montado em coordenadas locais (u, y, v) e depois girado para o lado pedido:
//   u = largura (eixo X quando a porta olha para norte/sul), v = profundidade, porta sempre em +v.
//   face 's' → porta em +Z, 'n' → porta em −Z, 'e' → porta em +X, 'w' → porta em −X.
// O terreno ocupado (BUILDINGS) é dado no referencial local; para 'e'/'w' ele gira junto,
// então use footprint(tipo, face) para ter a largura (X) e a profundidade (Z) no mundo.
//
// Regras seguidas (as mesmas do mapa, testadas em tests/buildings.test.mjs):
// - toda peça encosta numa cadeia que chega ao chão; o que nasce no chão começa em y − 0,1;
// - nunca duas bases em y − 0,1 de cores diferentes sobrepostas (nem faces laterais coplanares);
// - enxaimel, caixilhos e portas ficam 0,1 a 0,3 para fora da parede (nada no mesmo plano);
// - telhados em degraus alinhados aos eixos (sólidos); peça inclinada em X ou Z nunca colide;
// - só cores de C, nada de Neon, nenhuma medida abaixo de 0,04.

import { C } from '../palette.js';

/** Terreno de cada construção (largura u × profundidade v, em studs), com a porta em +v. */
export const BUILDINGS = Object.freeze({
  casa: Object.freeze({ w: 16, d: 14 }),
  celeiro: Object.freeze({ w: 22, d: 18 }),
  moinho: Object.freeze({ w: 22, d: 14 }),
  poco: Object.freeze({ w: 8, d: 8 }),
  torre: Object.freeze({ w: 10, d: 10 }),
  feno: Object.freeze({ w: 12, d: 10 }),
  tenda: Object.freeze({ w: 10, d: 16 }),
});

export const FACES = Object.freeze(['n', 's', 'e', 'w']);

/** Terreno no mundo: w ao longo de X e d ao longo de Z (leste/oeste trocam as medidas). */
export function footprint(kind, face) {
  const f = BUILDINGS[kind];
  if (!f) throw new Error(`Construção desconhecida: ${kind}`);
  if (!FACES.includes(face)) throw new Error(`Lado inválido: ${face}`);
  return face === 'e' || face === 'w' ? { w: f.d, d: f.w } : { w: f.w, d: f.d };
}

const deco = { canCollide: false };
const r2 = (v) => Math.round(v * 100) / 100;
const deg = (rad) => r2((rad * 180) / Math.PI);
const pick = (rand, list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

/**
 * Referencial local de uma construção. `box`/`span` recebem (u, y, v) relativos ao centro e ao
 * chão; `rot: ['u' | 'v' | 'y', graus]` gira em torno de um eixo local; `wheel: true` faz um
 * cilindro com o eixo ao longo de u (roda).
 */
function localFrame(b, model, x, y, z, face) {
  const swap = face === 'e' || face === 'w';
  const toWorld = {
    s: (u, v) => [x + u, z + v],
    n: (u, v) => [x - u, z - v],
    e: (u, v) => [x + v, z - u],
    w: (u, v) => [x - v, z + u],
  }[face];
  // eixo do mundo (0 = X, 2 = Z) e sentido de cada eixo local horizontal
  const axes = {
    s: { u: [0, 1], v: [2, 1] },
    n: { u: [0, -1], v: [2, -1] },
    e: { u: [2, -1], v: [0, 1] },
    w: { u: [2, 1], v: [0, -1] },
  }[face];
  const worldRotation = ([axis, a]) => {
    if (axis === 'y') return [0, r2(a), 0];
    const [i, sign] = axes[axis];
    const rot = [0, 0, 0];
    rot[i] = r2(sign * a);
    return rot;
  };
  const box = (name, [cu, cy, cv], [su, sy, sv], color, opts = {}) => {
    const { rot, wheel, ...rest } = opts;
    const [wx, wz] = toWorld(cu, cv);
    let size = swap ? [sv, sy, su] : [su, sy, sv];
    if (rot) rest.rotation = worldRotation(rot);
    if (wheel) {
      // cilindro do Roblox tem o eixo em X: girado 90° em Y quando u vira Z
      size = [su, sy, sv];
      rest.shape = 'Cylinder';
      if (swap) rest.rotation = [0, 90, 0];
    }
    return b.box(model, name, [wx, y + cy, wz], size, color, rest);
  };
  const span = (name, a, c, color, opts) =>
    box(
      name,
      [0, 1, 2].map((i) => (a[i] + c[i]) / 2),
      [0, 1, 2].map((i) => Math.abs(c[i] - a[i])),
      color,
      opts,
    );
  return { box, span };
}

// ---------------------------------------------------------------------------
// Casa: base de pedra, reboco com enxaimel, porta, 2 janelas, telhado em degraus e chaminé
// ---------------------------------------------------------------------------
function casa(f, rand) {
  const roof = pick(rand, [C.roofRed, C.roofSlate, C.roofThatch]);
  const cs = rand() < 0.5 ? -1 : 1; // lado da chaminé
  f.span('Base de Pedra', [-6.5, -0.1, -5.5], [6.5, 1, 5.5], C.rock);
  f.span('Degrau', [-2, -0.1, 5.5], [2, 0.5, 6.5], C.rockDark);
  f.span('Parede', [-6, 1, -5], [6, 9, 5], C.plaster);
  // enxaimel: postes de canto 0,15 para fora nas duas faces, vigas 0,1 para fora entre eles
  for (const su of [-1, 1]) {
    for (const sv of [-1, 1]) {
      f.span('Poste de Canto', [su * 5.75, 1, sv * 4.75], [su * 6.15, 9, sv * 5.15], C.timber);
    }
  }
  for (const sv of [-1, 1]) f.span('Viga', [-5.75, 8.3, sv * 5], [5.75, 8.9, sv * 5.1], C.timber);
  for (const su of [-1, 1]) f.span('Viga', [su * 6, 8.3, -4.75], [su * 6.1, 8.9, 4.75], C.timber);
  // porta (0,2 para fora) com batentes e verga (0,3 para fora)
  f.span('Porta', [-1.6, 1, 5], [1.6, 7, 5.2], C.woodDark);
  for (const su of [-1, 1]) f.span('Batente', [su * 1.6, 1, 5], [su * 2, 7, 5.3], C.timber);
  f.span('Verga', [-2, 7, 5], [2, 7.5, 5.3], C.timber);
  f.span('Maçaneta', [0.9, 3.8, 5.2], [1.2, 4.2, 5.35], C.rockDark, deco);
  // janelas: vidraça escura rebaixada entre os caixilhos (0,1 contra 0,25)
  for (const su of [-1, 1]) {
    const u0 = Math.min(su * 3, su * 4.6);
    const u1 = Math.max(su * 3, su * 4.6);
    f.span('Vidraça', [u0, 3.5, 5], [u1, 6, 5.1], C.rockDark);
    f.span('Caixilho', [u0 - 0.3, 3.2, 5], [u0, 6.3, 5.25], C.timber);
    f.span('Caixilho', [u1, 3.2, 5], [u1 + 0.3, 6.3, 5.25], C.timber);
    f.span('Caixilho', [u0, 6, 5], [u1, 6.3, 5.25], C.timber);
    f.span('Caixilho', [u0, 3.2, 5], [u1, 3.5, 5.25], C.timber);
  }
  // telhado de duas águas em degraus (cumeeira ao longo de u), beiral de 1 stud
  for (let k = 0; k < 6; k++) {
    const hv = 6.4 - k;
    f.span('Telhado', [-7, 9 + k, -hv], [7, 10 + k, hv], roof);
  }
  f.span('Cumeeira', [-7.2, 15, -0.6], [7.2, 15.5, 0.6], C.woodDark);
  // chaminé na água de trás: faces em v = −3,3 e −1,7 (degraus do telhado em −3,4 e −2,4)
  f.span('Chaminé', [cs * 3.2, 9, -3.3], [cs * 4.8, 17, -1.7], C.brick);
  f.span('Topo da Chaminé', [cs * 3, 17, -3.5], [cs * 5, 17.4, -1.5], C.rockDark);
}

// ---------------------------------------------------------------------------
// Celeiro: tábuas de madeira, portão duplo na empena, telhado vermelho e fardos de feno
// ---------------------------------------------------------------------------
function celeiro(f, rand) {
  const s = rand() < 0.5 ? -1 : 1; // lado dos fardos
  f.span('Base do Celeiro', [-8.4, -0.1, -7.4], [8.4, 1, 7.4], C.rock);
  f.span('Soleira', [-4, -0.1, 7.4], [4, 0.5, 8.4], C.rockDark);
  f.span('Parede do Celeiro', [-8, 1, -7], [8, 11, 7], C.wood);
  for (const su of [-1, 1]) {
    for (const sv of [-1, 1]) {
      f.span('Poste de Canto', [su * 7.75, 1, sv * 6.75], [su * 8.15, 11, sv * 7.15], C.woodDark);
    }
  }
  // ripas verticais 0,1 para fora (laterais e fundo)
  for (const su of [-1, 1]) {
    for (const vc of [-3.5, 0, 3.5]) f.span('Ripa', [su * 8, 1, vc - 0.2], [su * 8.1, 11, vc + 0.2], C.woodDark);
  }
  for (const uc of [-4, 4]) f.span('Ripa', [uc - 0.2, 1, -7.1], [uc + 0.2, 11, -7], C.woodDark);
  // portão duplo: folhas 0,2 para fora, travessas 0,35 e diagonal em Z (girada, sem colisão)
  const dg = deg(Math.atan2(5.6, 2.8));
  const dl = Math.hypot(2.8, 5.6);
  for (const su of [-1, 1]) {
    f.span('Folha da Porta', [0, 1, 7], [su * 3.6, 9, 7.2], C.woodDark);
    f.span('Travessa', [su * 0.2, 1.6, 7.2], [su * 3.4, 2.2, 7.35], C.timber);
    f.span('Travessa', [su * 0.2, 7.8, 7.2], [su * 3.4, 8.4, 7.35], C.timber);
    f.box('Diagonal', [su * 1.8, 5, 7.26], [dl, 0.35, 0.12], C.timber, { ...deco, rot: ['v', -su * dg] });
    f.span('Batente', [su * 3.6, 1, 7], [su * 4, 9, 7.3], C.timber);
  }
  f.span('Verga', [-4, 9, 7], [4, 9.6, 7.3], C.timber);
  // telhado em degraus com a cumeeira ao longo de v (empena sobre o portão)
  for (let k = 0; k < 8; k++) {
    const hu = 9.4 - 1.15 * k;
    f.span('Telhado', [-hu, 11 + k, -8], [hu, 12 + k, 8], C.roofRed);
  }
  f.span('Cumeeira', [-0.7, 19, -8.2], [0.7, 19.5, 8.2], C.woodDark);
  f.span('Portinhola do Palheiro', [-1.4, 12.4, 8], [1.4, 15.4, 8.15], C.woodDark);
  // fardos de feno encostados num dos lados (fora da base de pedra)
  f.span('Fardo de Feno', [s * 8.6, -0.1, 0.5], [s * 10.8, 1.5, 3.5], C.hay);
  f.span('Fardo de Feno', [s * 8.6, -0.1, 3.8], [s * 10.8, 1.5, 6.8], C.hay);
  f.span('Fardo de Feno', [s * 8.8, 1.5, 1.5], [s * 10.6, 3.1, 5], C.hay);
  f.span('Feno Solto', [s * 5, -0.1, 7.6], [s * 7.6, 0.25, 8.8], C.hay, deco);
}

// ---------------------------------------------------------------------------
// Moinho: torre de pedra afunilada, telhado em degraus e 4 pás com vela no cubo
// ---------------------------------------------------------------------------
function moinho(f, rand) {
  const roof = pick(rand, [C.roofRed, C.roofSlate]);
  const phase = 30 + Math.min(3, Math.floor(rand() * 4)) * 10; // pás sempre inclinadas
  f.span('Base do Moinho', [-5.2, -0.1, -5.2], [5.2, 1, 5.2], C.rockDark);
  for (const [h, y0, y1] of [
    [4.6, 1, 7],
    [4.1, 7, 13],
    [3.6, 13, 19],
    [3.1, 19, 24],
  ]) {
    f.span('Torre do Moinho', [-h, y0, -h], [h, y1, h], C.statue);
  }
  for (const [h, yc] of [
    [4.8, 7],
    [4.3, 13],
  ]) {
    f.span('Cinta de Pedra', [-h, yc - 0.3, -h], [h, yc + 0.3, h], C.statueDark);
  }
  [3.8, 3, 2.2, 1.4].forEach((h, k) => f.span('Telhado do Moinho', [-h, 24 + k, -h], [h, 25 + k, h], roof));
  f.span('Ponta', [-0.4, 28, -0.4], [0.4, 29.5, 0.4], C.woodDark);
  // porta na frente, com batentes, verga e degrau
  f.span('Porta', [-1.4, 1, 4.6], [1.4, 6, 4.8], C.woodDark);
  for (const su of [-1, 1]) f.span('Batente', [su * 1.4, 1, 4.6], [su * 1.8, 6, 4.9], C.timber);
  f.span('Verga', [-1.8, 6, 4.6], [1.8, 6.5, 4.9], C.timber);
  f.span('Degrau', [-1.8, -0.1, 5.2], [1.8, 0.5, 6.2], C.rockDark);
  f.span('Janela', [-0.8, 9, 4.1], [0.8, 11, 4.25], C.rockDark);
  // eixo entra na torre; o cubo encosta no eixo e as pás encostam no cubo (v de 5,4 a 5,6)
  const hy = 21.5;
  f.span('Eixo', [-0.6, hy - 0.6, 2.6], [0.6, hy + 0.6, 4.6], C.woodDark);
  f.span('Cubo', [-1, hy - 1, 4.6], [1, hy + 1, 5.4], C.wood);
  const R = 10;
  for (let k = 0; k < 4; k++) {
    const a = phase + 90 * k;
    const [cu, sn] = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
    f.box('Pá do Moinho', [(cu * R) / 2, hy + (sn * R) / 2, 5.5], [R, 0.5, 0.2], C.wood, { ...deco, rot: ['v', a] });
    // vela de pano ao lado da pá, de 2,5 a 9,5 do centro
    const [m, off] = [6, 1.35];
    f.box('Vela', [cu * m - sn * off, hy + sn * m + cu * off, 5.5], [7, 2.2, 0.1], C.cloth, {
      ...deco,
      rot: ['v', a],
    });
  }
}

// ---------------------------------------------------------------------------
// Poço: anel octogonal de pedra, água, dois postes, sarilho, telhadinho e baldes
// ---------------------------------------------------------------------------
function poco(f, rand) {
  const roof = pick(rand, [C.roofRed, C.roofThatch, C.roofSlate]);
  f.span('Borda do Poço', [-1.1, -0.1, 1.6], [1.1, 2.4, 2.6], C.rock);
  f.span('Borda do Poço', [-1.1, -0.1, -2.6], [1.1, 2.4, -1.6], C.rock);
  f.span('Borda do Poço', [-2.6, -0.1, -1.1], [-1.6, 2.4, 1.1], C.rock);
  f.span('Borda do Poço', [1.6, -0.1, -1.1], [2.6, 2.4, 1.1], C.rock);
  // cantos girados 45° em Y (podem colidir): fecham o octógono
  for (const su of [-1, 1]) {
    for (const sv of [-1, 1]) {
      f.box('Borda do Poço', [su * 1.485, 1.15, sv * 1.485], [2.2, 2.5, 1], C.rock, {
        rot: ['y', su * sv > 0 ? 45 : -45],
      });
    }
  }
  f.span('Fundo do Poço', [-1.6, -0.1, -1.6], [1.6, 0.4, 1.6], C.rockDark);
  f.span('Água do Poço', [-1.6, 0.4, -1.6], [1.6, 1.6, 1.6], C.water, {
    ...deco,
    transparency: 0.25,
    studs: false,
  });
  for (const su of [-1, 1]) f.span('Poste do Poço', [su * 1.9, 2.4, -0.2], [su * 2.3, 6.4, 0.2], C.woodDark);
  f.span('Sarilho', [-1.9, 5.2, -0.15], [1.9, 5.5, 0.15], C.wood);
  f.span('Telhado do Poço', [-2.8, 6.4, -2], [2.8, 6.9, 2], roof);
  f.span('Telhado do Poço', [-2.8, 6.9, -1.3], [2.8, 7.4, 1.3], roof);
  f.span('Telhado do Poço', [-2.8, 7.4, -0.6], [2.8, 7.9, 0.6], roof);
  f.span('Corda', [-0.05, 3.4, -0.05], [0.05, 5.2, 0.05], C.hay, deco);
  f.span('Balde', [-0.4, 2.6, -0.4], [0.4, 3.4, 0.4], C.wood, deco);
  f.span('Balde', [2.9, -0.1, 1.6], [3.6, 0.8, 2.3], C.wood);
}

// ---------------------------------------------------------------------------
// Torre de vigia: 4 pernas, escoras em X, plataforma com parapeito, telhado e escada
// ---------------------------------------------------------------------------
function torre(f, rand) {
  const roof = pick(rand, [C.roofRed, C.roofSlate, C.roofThatch]);
  for (const su of [-1, 1]) {
    for (const sv of [-1, 1]) f.span('Perna', [su * 3.1, -0.1, sv * 3.1], [su * 3.9, 23, sv * 3.9], C.woodDark);
  }
  f.span('Plataforma', [-4.2, 16, -4.2], [4.2, 16.6, 4.2], C.wood);
  // parapeito entre as pernas, aberto na frente para a escada
  f.span('Parapeito', [-3.1, 16.6, -3.65], [3.1, 19.2, -3.35], C.wood);
  for (const su of [-1, 1]) {
    f.span('Parapeito', [su * 3.35, 16.6, -3.1], [su * 3.65, 19.2, 3.1], C.wood);
    f.span('Parapeito', [su * 0.9, 16.6, 3.35], [su * 3.1, 19.2, 3.65], C.wood);
  }
  // escoras em X nos 4 lados, abaixo da plataforma (giradas, sem colisão)
  const bg = deg(Math.atan2(13, 6.2));
  const bl = Math.hypot(6.2, 13);
  for (const sg of [-1, 1]) {
    for (const s of [-1, 1]) {
      f.box('Escora', [0, 8.5, s * 3.5], [bl, 0.4, 0.3], C.wood, { ...deco, rot: ['v', sg * bg] });
      f.box('Escora', [s * 3.5, 8.5, 0], [0.3, 0.4, bl], C.wood, { ...deco, rot: ['u', sg * bg] });
    }
  }
  [4.8, 3.8, 2.8, 1.8].forEach((h, k) =>
    f.span('Telhado da Torre', [-h, 23 + 0.6 * k, -h], [h, 23.6 + 0.6 * k, h], roof),
  );
  f.span('Ponta', [-0.4, 25.4, -0.4], [0.4, 26.8, 0.4], C.woodDark);
  // escada encostada na frente da plataforma
  for (const su of [-1, 1]) f.span('Banzo da Escada', [su * 0.5, -0.1, 4.2], [su * 0.8, 18.2, 4.5], C.wood);
  for (let k = 0; k < 9; k++) {
    const h = 1.2 + 1.75 * k;
    f.span('Degrau da Escada', [-0.5, h, 4.25], [0.5, h + 0.25, 4.45], C.woodDark);
  }
}

// ---------------------------------------------------------------------------
// Feno: monte de 2 ou 3 camadas, fardo opcional e uma carroça
// ---------------------------------------------------------------------------
function feno(f, rand) {
  const layers = rand() < 0.5 ? 2 : 3;
  const bale = rand() < 0.5;
  f.span('Monte de Feno', [-5, -0.1, -3.4], [-0.6, 2.2, 1], C.hay);
  f.span('Monte de Feno', [-4.4, 2.2, -2.8], [-1.2, 3.8, 0.4], C.hay);
  if (layers === 3) f.span('Monte de Feno', [-3.7, 3.8, -2.1], [-1.9, 4.8, -0.3], C.wheat);
  if (bale) f.span('Fardo', [-4.6, -0.1, 2], [-2.2, 1.5, 3.4], C.wheat);
  // carroça: caçamba sobre o eixo, rodas (cilindros sem colisão), varal apoiado no chão
  f.span('Caçamba', [1.2, 1.6, -3], [4.8, 2.2, 1.6], C.wood);
  f.span('Tábua Lateral', [1.2, 2.2, -3], [1.5, 3.2, 1.6], C.woodDark);
  f.span('Tábua Lateral', [4.5, 2.2, -3], [4.8, 3.2, 1.6], C.woodDark);
  for (const uc of [0.9, 5.1]) f.box('Roda', [uc, 1.4, -0.8], [0.4, 3, 3], C.woodDark, { ...deco, wheel: true });
  f.span('Eixo', [0.9, 1.2, -1], [5.1, 1.6, -0.6], C.woodDark);
  f.span('Varal', [2.7, 1.7, 1.6], [3.3, 2.1, 4.4], C.woodDark);
  f.span('Apoio', [2.7, -0.1, 3.8], [3.3, 1.7, 4.4], C.woodDark);
}

// ---------------------------------------------------------------------------
// Tenda: lona listrada em degraus, mastros, fogueira de pedras (sem fogo aceso) e troncos
// ---------------------------------------------------------------------------
function tenda(f, rand) {
  const accent = pick(rand, [C.banner, C.awningBlue, C.awningOlive]);
  // lona de v = −6 a 0 (a porta fica em v = 0); listras alternadas
  [3.4, 2.6, 1.8, 1].forEach((h, k) =>
    f.span('Lona', [-h, k === 0 ? -0.1 : 1.3 * k, -6], [h, 1.3 * (k + 1), 0], k % 2 ? accent : C.cloth),
  );
  f.span('Entrada', [-0.9, -0.1, 0], [0.9, 2.4, 0.1], C.rockDark);
  for (const su of [-1, 1]) f.span('Aba da Entrada', [su * 0.9, 0.3, 0], [su * 1.5, 2.2, 0.2], C.cloth, deco);
  f.span('Cumeeira', [-0.25, 5.2, -6.4], [0.25, 5.6, 0.4], C.woodDark);
  f.span('Mastro', [-0.2, -0.1, 0.2], [0.2, 6.4, 0.6], C.woodDark);
  f.span('Mastro', [-0.2, -0.1, -6.6], [0.2, 5.6, -6.2], C.woodDark);
  f.span('Flâmula', [0.2, 5.8, 0.35], [1.6, 6.4, 0.45], accent, deco);
  // fogueira apagada em v = 4: cinzas, lenha cruzada e anel de 6 pedras
  const fv = 4;
  f.span('Cinzas', [-0.6, -0.1, fv - 0.6], [0.6, 0.15, fv + 0.6], C.rockDark);
  f.span('Lenha', [-0.8, 0.15, fv - 0.2], [0.8, 0.55, fv + 0.2], C.woodDark, deco);
  f.span('Lenha', [-0.2, 0.15, fv - 0.8], [0.2, 0.55, fv + 0.8], C.woodDark, deco);
  for (let k = 0; k < 6; k++) {
    const a = ((30 + 60 * k) * Math.PI) / 180;
    f.box('Pedra da Fogueira', [1.3 * Math.cos(a), 0.2, fv + 1.3 * Math.sin(a)], [0.9, 0.6, 0.7], k % 2 ? C.rockDark : C.rock, {
      rot: ['y', 20 + 15 * k],
    });
  }
  // troncos para sentar em volta
  for (const su of [-1, 1]) f.span('Tronco de Sentar', [su * 2.4, -0.1, fv - 1.3], [su * 3.2, 0.7, fv + 1.3], C.trunk);
  f.span('Tronco de Sentar', [-1.3, -0.1, fv + 2.4], [1.3, 0.7, fv + 3.2], C.trunk);
  f.span('Caixote', [3.7, -0.1, -5.2], [4.9, 1.1, -4], C.crate);
}

const BUILDERS = { casa, celeiro, moinho, poco, torre, feno, tenda };

/**
 * Monta uma construção centrada em (x, z) sobre o chão de topo y, com a porta no lado `face`.
 * `rand` é o sorteio determinístico do mapa ([0, 1)); nada aqui usa Math.random.
 * Retorna a lista das Parts criadas.
 */
export function building(b, model, kind, x, y, z, face, rand) {
  const make = BUILDERS[kind];
  if (!make) throw new Error(`Construção desconhecida: ${kind}`);
  if (!FACES.includes(face)) throw new Error(`Lado inválido: ${face}`);
  const start = b.parts.length;
  make(localFrame(b, model, x, y, z, face), rand);
  return b.parts.slice(start);
}
