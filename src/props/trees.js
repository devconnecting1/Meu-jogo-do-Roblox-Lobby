// Árvores, arbustos e canteiros de flores no estilo clássico do Roblox (2008-2010):
// blocos simples, copas "em estrela" (dois blocos girados 0° e 45°) e cores da paleta.
//
// Regras que toda peça daqui segue (testadas em tests/trees.test.mjs e nos testes do mapa):
//   * só o 'Tronco' colide: um por árvore, vertical, sem rotação, base exatamente em y;
//   * toda peça decorativa é girada (pelo menos em Y) e não colide. Peças giradas ficam fora
//     da checagem de z-fighting, então copas de árvores vizinhas podem se cruzar à vontade;
//   * toda peça encosta (pela caixa envolvente) em outra que já chega ao tronco e ao chão;
//   * nada passa de y + 30 e nenhuma medida fica abaixo de 0,04;
//   * o sorteio usa só o rand() recebido (mesma semente = mesma árvore).

import { C } from '../palette.js';

export const TREE_KINDS = ['carvalho', 'pinheiro', 'betula', 'cerejeira', 'redonda', 'seca', 'coqueiro', 'outono'];

/**
 * Raio máximo da copa (distância do eixo do tronco até a borda da caixa envolvente mais
 * larga, em x ou z), para espaçar as árvores no mapa.
 */
export const TREE_RADIUS = Object.freeze({
  carvalho: 11,
  pinheiro: 8,
  betula: 5,
  cerejeira: 10,
  redonda: 8,
  seca: 5,
  coqueiro: 9,
  outono: 13,
});

const deco = { canCollide: false };

/** Giro em Y "redondo" (múltiplo de 5,625°, de 0° a 90°). */
const yaw = (rand) => Math.round(rand() * 16) * 5.625;
const pick = (rand, list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

/** O tronco: única peça que colide, vertical e sem rotação, com a base em y. */
function trunk(b, model, x, y, z, w, h, color) {
  b.box(model, 'Tronco', [x, y + h / 2, z], [w, h, w], color);
}

/**
 * Camada de copa em estrela: dois blocos centrados no eixo, girados rot e rot + 45°
 * (o de 45° é 6% mais estreito e 4% mais alto). `base` é a face de baixo; devolve o topo.
 */
function starLayer(b, model, x, base, z, w, h, c1, c2, rot) {
  b.box(model, 'Copa', [x, base + h / 2, z], [w, h, w], c1, { ...deco, rotation: [0, rot, 0] });
  b.box(model, 'Copa', [x, base + h / 2, z], [w * 0.94, h * 1.04, w * 0.94], c2, {
    ...deco,
    rotation: [0, rot + 45, 0],
  });
  return base + h * 1.02;
}

/**
 * Peça comprida (galho, folha de coqueiro) que nasce num ponto `from` do eixo do tronco.
 * O comprimento fica no X local; rotation [0, yaw, pitch] (CFrame.Angles X·Y·Z) aponta esse
 * eixo para (cos yaw · cos pitch, sin pitch, −sin yaw · cos pitch): pitch > 0 sobe, < 0 desce.
 * A ponta de dentro fica exatamente em `from` (dentro do tronco), então a caixa envolvente
 * da peça sempre contém esse ponto e encosta no tronco.
 */
function limb(b, model, name, from, len, thick, wide, yawDeg, pitchDeg, color) {
  const ry = (yawDeg * Math.PI) / 180;
  const rz = (pitchDeg * Math.PI) / 180;
  const dir = [Math.cos(ry) * Math.cos(rz), Math.sin(rz), -Math.sin(ry) * Math.cos(rz)];
  const center = from.map((v, i) => v + (dir[i] * len) / 2);
  b.box(model, name, center, [len, thick, wide], color, { ...deco, rotation: [0, yawDeg, pitchDeg] });
}

/** Carvalho (e outono, mais largo): tronco, um galho inclinado e 2 ou 3 camadas em estrela. */
function broadleaf(b, model, x, y, z, rand, autumn) {
  const big = rand() < 0.45;
  const H = (autumn ? 8 : 7) + rand() * 4 + (big ? 2 : 0); // 7..13 (outono 8..14)
  const w = (autumn ? 11 : 8) + rand() * 4 + (big ? 3 : 0); // 8..15 (outono 11..18)
  const rot = yaw(rand);
  let c1 = rand() < 0.5 ? C.leafLight : C.leaf;
  let c2 = c1 === C.leafLight ? C.leaf : C.leafDark;
  if (autumn) [c1, c2] = rand() < 0.5 ? [C.autumn, C.autumnDark] : [C.autumnDark, C.autumn];
  trunk(b, model, x, y, z, big ? 2 : 1.6, H, C.trunk);
  limb(b, model, 'Galho', [x, y + H * 0.55, z], 3 + rand(), 0.7, 0.7, Math.round(rand() * 16) * 22.5, 28, C.trunk);
  let top = starLayer(b, model, x, y + H - 0.4, z, w, 2.6, c1, c2, rot);
  top = starLayer(b, model, x, top - 0.3, z, w * 0.66, 2.2, c2, c1, rot + 22.5);
  if (big || (autumn && rand() < 0.5)) starLayer(b, model, x, top - 0.3, z, w * 0.38, 1.6, c1, c2, rot);
  if (autumn) {
    // folhas caídas: placa fina deitada no chão, perto do tronco (afunda 0,02 no chão)
    const a = rand() * 2 * Math.PI;
    const r = 2 + rand() * 1.5;
    b.box(
      model,
      'Folhas Caídas',
      [x + Math.cos(a) * r, y + 0.03, z + Math.sin(a) * r],
      [2.2 + rand(), 0.1, 1.6 + rand()],
      C.autumnDark,
      { ...deco, rotation: [0, yaw(rand), 0] },
    );
  }
}

/** Pinheiro: tronco fino e 3 a 5 camadas em estrela que encolhem para cima, com ponta. */
function pine(b, model, x, y, z, rand) {
  const layers = 3 + Math.floor(rand() * 3); // + a ponta = 4 a 6 andares
  const Ht = 4 + rand() * 2;
  const w0 = 8 + rand() * 3;
  const h = 2.6 + rand() * 0.6;
  const rot = yaw(rand);
  trunk(b, model, x, y, z, 1.2 + rand() * 0.2, Ht, C.trunk);
  let base = y + Ht - 0.4;
  for (let k = 0; k < layers; k++) {
    const t = k / layers;
    const [c1, c2] = k % 2 ? [C.pine, C.pineDark] : [C.pineDark, C.pine];
    base = starLayer(b, model, x, base, z, w0 * (1 - 0.7 * t), h * (1 - 0.1 * t), c1, c2, rot + k * 15) - 0.4;
  }
  const tw = Math.max(1.2, w0 * 0.16);
  b.box(model, 'Ponta', [x, base + 1.2, z], [tw, 2.4, tw], layers % 2 ? C.pine : C.pineDark, {
    ...deco,
    rotation: [0, rot + 45, 0],
  });
}

/** Bétula: tronco claro, alto e fino, com faixas escuras e copa clara e pequena. */
function birch(b, model, x, y, z, rand) {
  const H = 11 + rand() * 4;
  const tw = 1.2 + rand() * 0.2;
  const w = 4.5 + rand() * 1.5;
  const rot = yaw(rand);
  trunk(b, model, x, y, z, tw, H, C.birchBark);
  const rings = 2 + (rand() < 0.5 ? 1 : 0);
  for (let k = 0; k < rings; k++) {
    // faixa 0,06 mais larga que o tronco de cada lado: nenhuma face no mesmo plano
    b.box(
      model,
      'Faixa do Tronco',
      [x, y + H * (0.18 + 0.2 * k) + rand() * 0.8, z],
      [tw + 0.12, 0.3, tw + 0.12],
      k % 2 ? C.timber : C.deadWood,
      { ...deco, rotation: [0, 0, 0] },
    );
  }
  const base = y + H - 2;
  const top = starLayer(b, model, x, base, z, w, 3, C.birchLeaf, C.leafLight, rot);
  starLayer(b, model, x, top - 0.4, z, w * 0.72, 2.6, C.leafLight, C.birchLeaf, rot + 22.5);
  // tufo de lado, um pouco mais baixo, para a copa não ficar simétrica
  const a = rand() * 2 * Math.PI;
  const ts = 2.2 + rand() * 0.6;
  b.box(model, 'Copa', [x + Math.cos(a) * w * 0.3, base - 0.6, z + Math.sin(a) * w * 0.3], [ts, 2, ts], C.birchLeaf, {
    ...deco,
    rotation: [0, yaw(rand), 0],
  });
}

/** Cerejeira: tronco baixo, copa larga e achatada cor-de-rosa, com cachos pendurados. */
function cherry(b, model, x, y, z, rand) {
  const H = 4 + rand() * 2;
  const w = 10 + rand() * 3;
  const rot = yaw(rand);
  const [c1, c2] = rand() < 0.5 ? [C.blossom, C.blossomDark] : [C.blossomDark, C.blossom];
  trunk(b, model, x, y, z, 1.6, H, C.trunk);
  const base = y + H - 0.4;
  const top = starLayer(b, model, x, base, z, w, 2.4, c1, c2, rot);
  starLayer(b, model, x, top - 0.3, z, w * 0.68, 2, c2, c1, rot + 22.5);
  const n = 2 + (rand() < 0.5 ? 1 : 0);
  for (let k = 0; k < n; k++) {
    // cacho embaixo da copa: topo 0,1 dentro dela e longe da borda (r + meia diagonal < w/2)
    const a = ((rot + (k * 360) / n + rand() * 40) * Math.PI) / 180;
    const r = w * (0.22 + rand() * 0.14);
    const c = 0.9 + rand() * 0.3;
    const hh = 1 + rand() * 0.6;
    b.box(
      model,
      'Flores Pendentes',
      [x + Math.cos(a) * r, base + 0.1 - hh / 2, z + Math.sin(a) * r],
      [c, hh, c],
      k % 2 ? c1 : c2,
      { ...deco, rotation: [0, yaw(rand), 0] },
    );
  }
}

/** Árvore redonda: fatias que imitam uma esfera (estreita embaixo e em cima, larga no meio). */
function roundTree(b, model, x, y, z, rand) {
  const H = 4 + rand() * 2;
  const D = 7 + rand() * 3;
  const rot = yaw(rand);
  const [c1, c2] = rand() < 0.5 ? [C.leaf, C.leafDark] : [C.bush, C.leaf];
  trunk(b, model, x, y, z, 1.6, H, C.trunk);
  const base = y + H - 0.6; // a fatia de baixo engole 0,6 do topo do tronco
  const slice = (cy, w, h, color, r) =>
    b.box(model, 'Copa', [x, base + cy * D, z], [w * D, h * D, w * D], color, { ...deco, rotation: [0, r, 0] });
  slice(0.12, 0.64, 0.24, c2, rot + 22.5); // 0 .. 0,24 D
  slice(0.48, 1, 0.56, c1, rot); // 0,2 .. 0,76 D
  slice(0.48, 0.9, 0.66, c2, rot + 45); // 0,15 .. 0,81 D
  slice(0.84, 0.64, 0.24, c1, rot + 22.5); // 0,72 .. 0,96 D
  if (rand() < 0.35) {
    // lóbulo de lado (árvore mais cheia)
    const a = rand() * 2 * Math.PI;
    b.box(
      model,
      'Copa',
      [x + Math.cos(a) * D * 0.38, base + 0.42 * D, z + Math.sin(a) * D * 0.38],
      [0.5 * D, 0.45 * D, 0.5 * D],
      c2,
      { ...deco, rotation: [0, yaw(rand), 0] },
    );
  }
}

/** Árvore seca: tronco cinza-amarronzado e 2 a 4 galhos pelados e inclinados. */
function deadTree(b, model, x, y, z, rand) {
  const H = 6 + rand() * 4;
  trunk(b, model, x, y, z, 1.4 + rand() * 0.4, H, C.deadWood);
  const n = 2 + Math.floor(rand() * 3);
  const start = Math.round(rand() * 8) * 45;
  for (let k = 0; k < n; k++) {
    const yawK = start + Math.round((k * 360) / n + (rand() - 0.5) * 40);
    const from = [x, y + H * (0.5 + (0.45 * (k + rand())) / n), z];
    limb(b, model, 'Galho', from, 2.5 + rand() * 2, 0.6, 0.6, yawK, 25 + Math.round(rand() * 30), C.deadWood);
  }
}

/**
 * Coqueiro (para a areia): tronco de 4 ou 5 gomos empilhados, cada um um pouco deslocado
 * (inclinação sem girar nada), 5 ou 6 folhas compridas caídas e 2 ou 3 cocos.
 * O gomo de baixo é o 'Tronco' (colide); os outros são 'Tronco do Coqueiro' (sem colisão),
 * encostados face a face: as faces laterais de gomos vizinhos nunca dividem área.
 */
function palm(b, model, x, y, z, rand) {
  const n = 4 + (rand() < 0.4 ? 1 : 0);
  const leaves = n === 4 && rand() < 0.5 ? 6 : 5;
  const nuts = n + leaves === 9 && rand() < 0.5 ? 3 : 2; // no máximo 12 peças
  const lean = rand() * 2 * Math.PI;
  let cx = x;
  let cz = z;
  let base = y;
  let tw = 1.5;
  for (let k = 0; k < n; k++) {
    const hs = 2 + Math.floor(rand() * 5) * 0.1; // 2,0 .. 2,4
    if (k > 0) {
      const d = 0.12 + 0.06 * k;
      cx += Math.cos(lean) * d;
      cz += Math.sin(lean) * d;
    }
    tw = 1.5 - 0.05 * k;
    b.box(
      model,
      k === 0 ? 'Tronco' : 'Tronco do Coqueiro',
      [cx, base + hs / 2, cz],
      [tw, hs, tw],
      k % 2 ? C.wood : C.palmTrunk,
      k === 0 ? {} : deco,
    );
    base += hs;
  }
  const start = rand() * 360;
  const from = [cx, base - 0.15, cz]; // dentro do último gomo
  for (let k = 0; k < leaves; k++) {
    const yawK = Math.round(start + (k * 360) / leaves + (rand() - 0.5) * 20);
    const droop = 15 + Math.round(rand() * 15);
    limb(b, model, 'Folha de Coqueiro', from, 5.5 + rand() * 1.5, 0.3, 1.6, yawK, -droop, C.palmLeaf);
  }
  for (let k = 0; k < nuts; k++) {
    // coco encostado no último gomo, logo abaixo das folhas (entra 0,12 no gomo)
    const a = ((start + 30 + (k * 360) / nuts) * Math.PI) / 180;
    const c = 0.7 + rand() * 0.15;
    const r = tw / 2 + c / 2 - 0.12;
    b.box(model, 'Coco', [cx + Math.cos(a) * r, base - 0.25 - c / 2, cz + Math.sin(a) * r], [c, c, c], C.trunk, {
      ...deco,
      rotation: [0, yaw(rand), 0],
    });
  }
}

const PLANTERS = {
  carvalho: (b, m, x, y, z, rand) => broadleaf(b, m, x, y, z, rand, false),
  pinheiro: pine,
  betula: birch,
  cerejeira: cherry,
  redonda: roundTree,
  seca: deadTree,
  coqueiro: palm,
  outono: (b, m, x, y, z, rand) => broadleaf(b, m, x, y, z, rand, true),
};

/** Planta uma árvore do tipo `kind` (um de TREE_KINDS) com a base do tronco em (x, y, z). */
export function plantTree(b, model, kind, x, y, z, rand) {
  const planter = PLANTERS[kind];
  if (!planter) throw new Error(`Tipo de árvore desconhecido: ${kind}`);
  planter(b, model, x, y, z, rand);
}

/** Arbusto pequeno (sem colisão, até 3 peças): redondo, de dois tufos ou florido. */
export function bush(b, model, x, y, z, rand) {
  const s = 2 + rand() * 1.2;
  const h = 1.4 + rand() * 0.8;
  const rot = yaw(rand);
  const color = pick(rand, [C.bush, C.leaf, C.leafDark]);
  const alt = color === C.leafDark ? C.bush : C.leafDark;
  const variant = Math.floor(rand() * 3);
  const base = y - 0.05; // afunda 0,05 no chão
  b.box(model, 'Arbusto', [x, base + h / 2, z], [s, h, s], color, { ...deco, rotation: [0, rot, 0] });
  if (variant === 0) {
    // redondo: bloco de 45°, mais estreito e mais alto (estrela vista de cima)
    b.box(model, 'Arbusto', [x, base + (h * 1.15) / 2, z], [s * 0.85, h * 1.15, s * 0.85], alt, {
      ...deco,
      rotation: [0, rot + 45, 0],
    });
  } else if (variant === 1) {
    // dois tufos: um menor ao lado e um chapéu no topo do principal
    const a = rand() * 2 * Math.PI;
    b.box(
      model,
      'Arbusto',
      [x + Math.cos(a) * s * 0.4, base + (h * 0.75) / 2, z + Math.sin(a) * s * 0.4],
      [s * 0.7, h * 0.75, s * 0.7],
      alt,
      { ...deco, rotation: [0, rot + 30, 0] },
    );
    b.box(model, 'Arbusto', [x, base + h + 0.1, z], [s * 0.55, 0.5, s * 0.55], color, {
      ...deco,
      rotation: [0, rot + 45, 0],
    });
  } else {
    // florido: duas flores encaixadas 0,15 no topo, longe da borda
    const a0 = rand() * 2 * Math.PI;
    for (let k = 0; k < 2; k++) {
      const a = a0 + k * Math.PI;
      b.box(
        model,
        'Flor',
        [x + Math.cos(a) * s * 0.28, base + h + 0.1, z + Math.sin(a) * s * 0.28],
        [0.5, 0.5, 0.5],
        pick(rand, [C.flowerRed, C.flowerYellow, C.blossom, C.cloth]),
        { ...deco, rotation: [0, yaw(rand), 0] },
      );
    }
  }
}

/** Canteiro de 3 ou 4 flores (caule + flor, sem colisão, até 8 peças). */
export function flowerPatch(b, model, x, y, z, rand) {
  const colors = [C.flowerRed, C.flowerYellow, C.blossom, C.cloth];
  const n = 3 + (rand() < 0.5 ? 1 : 0);
  const first = Math.floor(rand() * colors.length);
  const start = rand() * 360;
  for (let k = 0; k < n; k++) {
    const a = ((start + (k * 360) / n + (rand() - 0.5) * 40) * Math.PI) / 180;
    const r = 0.5 + rand() * 1.1;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    const sh = 0.8 + rand() * 0.6;
    const bs = 0.5 + rand() * 0.2;
    const rot = yaw(rand);
    b.box(model, 'Caule', [px, y - 0.05 + sh / 2, pz], [0.2, sh, 0.2], C.leafDark, { ...deco, rotation: [0, rot, 0] });
    // a flor entra 0,1 no topo do caule
    b.box(model, 'Flor', [px, y - 0.15 + sh + bs * 0.4, pz], [bs, bs * 0.8, bs], colors[(first + k) % colors.length], {
      ...deco,
      rotation: [0, rot + 45, 0],
    });
  }
}
