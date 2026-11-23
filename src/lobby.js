// Lobby "Prisão" — fonte única da verdade do mapa.
//
// Este módulo descreve TODAS as Parts do lobby como dados puros. Ele é usado:
//   * pelo visualizador Three.js (index.html) para mostrar o mapa no navegador;
//   * pelo gerador tools/build-place.mjs para montar o lugar do Roblox (via Rojo).
//
// Estilo "clássico" (referência: prisão de builder de elite):
//   * só Part clássico (Block, e Cylinder nas mesas redondas), material Plastic;
//   * Neon apenas nas lâmpadas e telas;
//   * paredes lisas, studs clássicos só nos pisos de destaque;
//   * nenhuma textura, decal ou MeshPart;
//   * paleta de 3 cores: branco + laranja queimado + azul-marinho.
//
// Unidades em studs. Eixos iguais aos do Roblox e do Three.js (Y para cima).

export const STYLE = Object.freeze({ material: 'Plastic', accent: 'Neon' });

const C = {
  white: [238, 238, 240],
  offWhite: [218, 220, 224],
  lightGray: [198, 200, 206],
  gray: [160, 165, 175],
  grayDark: [96, 100, 110],
  charcoal: [46, 48, 56],
  orange: [204, 94, 38],
  orangeDark: [184, 84, 34],
  navy: [26, 38, 86],
  navyDark: [16, 24, 56],
  blue: [22, 108, 200],
  blueCafe: [40, 92, 130],
  ceiling: [28, 32, 46],
  neon: [244, 250, 255],
  glass: [196, 224, 240],
  mirror: [200, 208, 218],
  red: [156, 42, 34],
  crate: [92, 62, 44],
  crateDark: [60, 40, 30],
  grass: [88, 130, 74],
  apron: [158, 158, 156],
};

// Roupas do showcase (uma por cela, repetindo nos 4 blocos).
export const OUTFITS = [
  { name: 'Detento Laranja', shirt: [214, 96, 30], pants: [214, 96, 30], skin: [245, 205, 160] },
  { name: 'Listrado Clássico', shirt: [236, 236, 236], pants: [236, 236, 236], skin: [204, 142, 105], stripes: [30, 30, 34] },
  { name: 'Guarda', shirt: [40, 64, 140], pants: [26, 30, 44], skin: [160, 105, 75], cap: [26, 30, 44] },
  { name: 'Diretor', shirt: [44, 44, 52], pants: [44, 44, 52], skin: [245, 205, 160], tie: [170, 30, 40] },
  { name: 'Fugitivo', shirt: [214, 96, 30], pants: [64, 84, 140], skin: [120, 80, 55] },
  { name: 'Cozinheiro', shirt: [250, 250, 250], pants: [70, 70, 76], skin: [230, 185, 140], cap: [250, 250, 250] },
  { name: 'Mecânico', shirt: [92, 112, 72], pants: [92, 112, 72], skin: [204, 142, 105] },
  { name: 'VIP Dourado', shirt: [228, 178, 40], pants: [228, 178, 40], skin: [245, 205, 160], stripes: [130, 92, 14] },
];

// ---------------------------------------------------------------------------
// Construtor de partes
// ---------------------------------------------------------------------------

function makeBuilder() {
  const parts = [];
  const builder = {
    parts,
    /** Caixa pelo centro e tamanho. */
    box(model, name, center, size, color, opts = {}) {
      const part = {
        model,
        name,
        position: center.map(round),
        size: size.map(round),
        color,
        transparency: opts.transparency ?? 0,
        canCollide: opts.canCollide ?? true,
        rotation: opts.rotation ?? null, // [rx, ry, rz] em graus (CFrame.Angles)
        light: opts.light ?? null, // { range, brightness, color }
        label: opts.label ?? null, // { text, face, color }
        className: opts.className ?? 'Part',
        shape: opts.shape ?? 'Block',
        material: opts.material ?? 'Plastic',
        studs: opts.studs ?? false, // TopSurface = Studs (estilo clássico)
        group: opts.group ?? model.split('/')[0],
      };
      parts.push(part);
      return part;
    },
    /** Caixa pelos cantos (em qualquer ordem). */
    span(model, name, a, bb, color, opts) {
      const center = [0, 1, 2].map((i) => (a[i] + bb[i]) / 2);
      const size = [0, 1, 2].map((i) => Math.abs(bb[i] - a[i]));
      return builder.box(model, name, center, size, color, opts);
    },
  };
  return builder;
}

function round(v) {
  return Math.round(v * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Dimensões principais
// ---------------------------------------------------------------------------

export const DIM = Object.freeze({
  inX: 70, // interior vai de -70 a 70
  inZ: 40, // interior vai de -40 a 40
  wall: 2,
  floor2: 16, // topo da laje do 2º andar
  cellH: 15,
  cellW: 12,
  cellD: 14,
  cellsPerRow: 8,
  roofY: 34,
  catwalkEdge: 18, // vão do átrio: |z| < 18
  stairX0: 38,
  stairX1: 56, // mezanino leste começa em x = 56
  stairHalf: 6,
});

const CELL_FRONT = DIM.inZ - DIM.cellD; // 26
const PITCH = DIM.cellW + 1; // 13
const ROW_START = -(DIM.cellsPerRow * PITCH + 1) / 2; // -52.5
const COLUMN_X = [-65, ...Array.from({ length: 9 }, (_, i) => -52 + i * PITCH)]; // ritmo das colunas
const NEON_LIGHT = { range: 22, brightness: 1.2, color: [255, 250, 240] };

// ---------------------------------------------------------------------------
// Peças compostas
// ---------------------------------------------------------------------------

/** Boneco R6 em tamanho real (5 studs de altura) feito só de blocos. */
function dummy(b, model, base, facing, outfit) {
  const [x, y, z] = base;
  const f = facing; // +1 olha para +Z, -1 olha para -Z
  b.box(model, 'Perna Esquerda', [x - 0.5, y + 1, z], [1, 2, 1], outfit.pants);
  b.box(model, 'Perna Direita', [x + 0.5, y + 1, z], [1, 2, 1], outfit.pants);
  b.box(model, 'Tronco', [x, y + 3, z], [2, 2, 1], outfit.shirt);
  b.box(model, 'Braço Esquerdo', [x - 1.5, y + 3, z], [1, 2, 1], outfit.shirt);
  b.box(model, 'Braço Direito', [x + 1.5, y + 3, z], [1, 2, 1], outfit.shirt);
  b.box(model, 'Mão Esquerda', [x - 1.5, y + 2.2, z], [1.04, 0.4, 1.04], outfit.skin);
  b.box(model, 'Mão Direita', [x + 1.5, y + 2.2, z], [1.04, 0.4, 1.04], outfit.skin);
  b.box(model, 'Cabeça', [x, y + 4.6, z], [1.2, 1.2, 1.2], outfit.skin);
  const fz = z + f * 0.61;
  const face = { canCollide: false };
  b.box(model, 'Olho Esquerdo', [x - 0.25, y + 4.75, fz], [0.16, 0.22, 0.04], [20, 20, 20], face);
  b.box(model, 'Olho Direito', [x + 0.25, y + 4.75, fz], [0.16, 0.22, 0.04], [20, 20, 20], face);
  b.box(model, 'Boca', [x, y + 4.32, fz], [0.5, 0.08, 0.04], [20, 20, 20], face);
  if (outfit.stripes) {
    for (let i = 0; i < 3; i++) {
      b.box(model, `Listra Perna ${i + 1}`, [x, y + 0.4 + i * 0.66, z], [2.04, 0.22, 1.04], outfit.stripes, face);
      b.box(model, `Listra Tronco ${i + 1}`, [x, y + 2.4 + i * 0.66, z], [4.04, 0.22, 1.04], outfit.stripes, face);
    }
  }
  if (outfit.tie) b.box(model, 'Gravata', [x, y + 3.1, z + f * 0.52], [0.3, 1.5, 0.04], outfit.tie, face);
  if (outfit.cap) {
    b.box(model, 'Boné', [x, y + 5.3, z], [1.3, 0.3, 1.3], outfit.cap, face);
    b.box(model, 'Aba', [x, y + 5.2, z + f * 0.85], [1.1, 0.12, 0.5], outfit.cap, face);
  }
}

/** Caixa de madeira clássica: bloco + cantoneiras + cintas. */
function crate(b, model, x, y, z, s = 4) {
  b.box(model, 'Caixa', [x, y + s / 2, z], [s, s, s], C.crate);
  const h = s / 2 - 0.15;
  for (const dx of [-h, h]) for (const dz of [-h, h]) {
    b.box(model, 'Cantoneira', [x + dx, y + s / 2, z + dz], [0.42, s + 0.04, 0.42], C.crateDark);
  }
  b.box(model, 'Cinta Inferior', [x, y + 0.3, z], [s + 0.06, 0.4, s + 0.06], C.crateDark);
  b.box(model, 'Cinta Superior', [x, y + s - 0.3, z], [s + 0.06, 0.4, s + 0.06], C.crateDark);
}

/** Estante metálica de depósito (ao longo de X). */
function rack(b, model, x, z, len = 9, depth = 3, h = 10) {
  for (const dx of [-len / 2 + 0.3, 0, len / 2 - 0.3]) {
    for (const dz of [-depth / 2 + 0.3, depth / 2 - 0.3]) {
      b.box(model, 'Montante', [x + dx, h / 2, z + dz], [0.5, h, 0.5], C.grayDark);
    }
  }
  [0.6, 4, 7.4].forEach((sy, i) => {
    b.box(model, `Prateleira ${i + 1}`, [x, sy, z], [len, 0.3, depth], C.charcoal);
  });
  crate(b, model, x - 2.5, 0.75, z, 2.2);
  crate(b, model, x + 2.2, 4.15, z, 2.2);
  crate(b, model, x - 0.6, 7.55, z, 2.2);
}

/** Luminária fluorescente pendente (suporte escuro + 2 tubos Neon). */
function hangingLight(b, model, x, y, z, stem = 3) {
  b.box(model, 'Carcaça', [x, y, z], [7, 0.4, 1.6], C.charcoal, { canCollide: false });
  for (const o of [-1.7, 1.7]) {
    b.box(model, 'Tubo', [x + o, y - 0.3, z], [3.2, 0.25, 1], C.neon, {
      canCollide: false,
      material: 'Neon',
      light: o < 0 ? NEON_LIGHT : null,
    });
    b.box(model, 'Haste', [x + o * 1.4, y + stem / 2 + 0.2, z], [0.3, stem, 0.3], C.charcoal, { canCollide: false });
  }
}

/** Painel de luz embutido no teto (y = face inferior do teto). */
function flushLight(b, model, x, y, z, w = 4, d = 1.2, light = true) {
  b.box(model, 'Moldura', [x, y - 0.05, z], [w + 0.4, 0.1, d + 0.4], C.charcoal, { canCollide: false });
  b.box(model, 'Painel', [x, y - 0.15, z], [w, 0.12, d], C.neon, {
    canCollide: false,
    material: 'Neon',
    light: light ? { range: 18, brightness: 1, color: [255, 250, 240] } : null,
  });
}

/** Guarda-corpo de vidro (rodapé escuro + vidro + corrimão), reto em X ou em Z. */
function glassRail(b, model, a, bb, y) {
  const alongX = a[1] === bb[1];
  const x0 = Math.min(a[0], bb[0]), x1 = Math.max(a[0], bb[0]);
  const z0 = Math.min(a[1], bb[1]), z1 = Math.max(a[1], bb[1]);
  const seg = (name, w, ya, yb, color, opts) => {
    const lo = alongX ? [x0, ya, z0 - w / 2] : [x0 - w / 2, ya, z0];
    const hi = alongX ? [x1, yb, z0 + w / 2] : [x0 + w / 2, yb, z1];
    b.span(model, name, lo, hi, color, opts);
  };
  seg('Rodapé', 0.7, y, y + 0.6, C.charcoal, { studs: true });
  seg('Vidro', 0.2, y + 0.6, y + 3.6, C.glass, { transparency: 0.6 });
  seg('Corrimão', 0.45, y + 3.6, y + 3.9, C.gray);
}

/** Uma cela showcase. side = -1 (ala sul, abre para +Z) ou +1 (ala norte, abre para -Z). */
function cell(b, index, side, floorY, number) {
  const outfit = OUTFITS[index % OUTFITS.length];
  const id = String(number).padStart(2, '0');
  const model = `Celas/Cela ${id}`;
  const cx = ROW_START + 1 + DIM.cellW / 2 + index * PITCH;
  const front = side * CELL_FRONT;
  const facing = -side; // a cela olha para o corredor
  const y0 = floorY;
  const zAt = (d) => front + side * d; // profundidade (0 = fachada, 14 = fundo) -> Z
  const r = (name, lx0, lx1, ya, yb, d0, d1, color, opts) =>
    b.span(model, name, [cx + lx0, y0 + ya, zAt(d0)], [cx + lx1, y0 + yb, zAt(d1)], color, opts);

  // Fachada azul-marinho: pilar, janela, porta, pilar
  r('Fachada Pilar E', -6, -5, 0, 12, 0, 0.6, C.navy);
  r('Fachada Peitoril', -5, 0.5, 0, 2.5, 0, 0.6, C.navy);
  r('Fachada Verga Janela', -5, 0.5, 10, 12, 0, 0.6, C.navy);
  r('Fachada Pilar Meio', 0.5, 1.5, 0, 12, 0, 0.6, C.navy);
  r('Fachada Verga Porta', 1.5, 4.5, 9, 12, 0, 0.6, C.navy);
  r('Fachada Pilar D', 4.5, 6, 0, 12, 0, 0.6, C.navy);
  // Faixa branca com listras laranja (assinatura visual)
  r('Faixa Superior', -6, 6, 12, DIM.cellH, 0, 0.6, C.white);
  r('Listra Laranja 1', -6, 6, 12.6, 13.2, -0.08, 0, C.orange, { canCollide: false });
  r('Listra Laranja 2', -6, 6, 13.8, 14.4, -0.08, 0, C.orange, { canCollide: false });
  // Placa
  r('Placa', -4.6, -0.1, 10.3, 11.7, -0.12, 0, C.white, {
    canCollide: false,
    label: { text: `${id} · ${outfit.name.toUpperCase()}`, face: facing > 0 ? 'Back' : 'Front', color: C.navy },
  });

  // Janela do showcase
  r('Vidro Janela', -5, 0.5, 2.5, 10, 0.2, 0.4, C.glass, { transparency: 0.75 });
  r('Caixilho E', -5, -4.75, 2.5, 10, -0.05, 0.65, C.charcoal);
  r('Caixilho D', 0.25, 0.5, 2.5, 10, -0.05, 0.65, C.charcoal);
  r('Caixilho Topo', -5, 0.5, 9.75, 10, -0.05, 0.65, C.charcoal);
  r('Caixilho Base', -5, 0.5, 2.5, 2.75, -0.05, 0.65, C.charcoal);
  r('Parapeito', -5.2, 0.7, 2.3, 2.6, -0.4, 0, C.gray);

  // Batente da porta + porta de grade deslizante (aberta)
  r('Batente E', 1.5, 1.75, 0, 9, -0.05, 0.65, C.charcoal);
  r('Batente D', 4.25, 4.5, 0, 9, -0.05, 0.65, C.charcoal);
  r('Batente Topo', 1.5, 4.5, 8.75, 9, -0.05, 0.65, C.charcoal);
  r('Trilho', 1.5, 7, 9, 9.3, -0.5, -0.1, C.charcoal);
  const door = { canCollide: false };
  r('Porta Quadro Topo', 4.6, 7, 8.5, 8.8, -0.45, -0.2, C.charcoal, door);
  r('Porta Quadro Base', 4.6, 7, 0.2, 0.5, -0.45, -0.2, C.charcoal, door);
  r('Porta Quadro E', 4.6, 4.85, 0.2, 8.8, -0.45, -0.2, C.charcoal, door);
  r('Porta Quadro D', 6.75, 7, 0.2, 8.8, -0.45, -0.2, C.charcoal, door);
  r('Porta Travessa', 4.6, 7, 4.3, 4.6, -0.45, -0.2, C.charcoal, door);
  for (const bx of [5.3, 5.8, 6.3]) r('Porta Barra', bx - 0.1, bx + 0.1, 0.5, 8.5, -0.42, -0.23, C.charcoal, door);

  // Interior branco com fundo azul-marinho
  r('Piso', -6, 6, 0, 0.1, 0.6, 14, C.lightGray);
  r('Revestimento E', -6, -5.8, 0, DIM.cellH, 0.6, 13.7, C.white);
  r('Revestimento D', 5.8, 6, 0, DIM.cellH, 0.6, 13.7, C.white);
  r('Parede Fundo', -6, 6, 0, DIM.cellH, 13.7, 14, C.navy);

  // Pedestal + boneco (showcase, centralizado atrás da janela)
  const px = cx - 2.25;
  const pz = zAt(5);
  b.box(model, 'Pedestal', [px, y0 + 0.4, pz], [4.4, 0.8, 4.4], C.navy);
  b.box(model, 'Pedestal Friso', [px, y0 + 0.9, pz], [4.6, 0.2, 4.6], C.orange);
  b.box(model, 'Pedestal Tampo', [px, y0 + 1.1, pz], [4.4, 0.2, 4.4], C.white);
  dummy(b, `${model}/Showcase`, [px, y0 + 1.2, pz], facing, outfit);
  flushLight(b, model, px, y0 + DIM.cellH, pz, 2.4, 2.4);

  // Cama (estrado escuro, gaveta branca, cobertor vermelho)
  r('Cama Base', -5.6, 1.2, 0.1, 1.4, 10.4, 13.6, C.charcoal);
  r('Cama Gaveta', -5.2, 0.8, 0.5, 0.9, 10.3, 10.4, C.white, { canCollide: false });
  r('Colchão', -5.5, 1.1, 1.4, 1.9, 10.5, 13.5, C.white);
  r('Cobertor', -3.5, 1.15, 1.9, 2.1, 10.45, 13.55, C.red);
  r('Travesseiro', -5.3, -4, 1.9, 2.4, 10.8, 13.2, C.white);
  r('Cabeceira', -5.8, -5.5, 0.1, 3, 10.4, 13.6, C.charcoal);

  // Vaso sanitário
  r('Vaso Base', 3.6, 4.9, 0.1, 1.3, 11.6, 13.3, C.white);
  r('Vaso Assento', 3.5, 5, 1.3, 1.5, 11.5, 13.3, C.white);
  r('Vaso Caixa', 3.6, 4.9, 1.3, 3, 13.2, 13.7, C.white);

  // Pia com espelho na parede direita
  r('Pia Coluna', 5.3, 5.6, 0.1, 3, 8.1, 8.4, C.charcoal);
  r('Pia Cuba', 4.9, 5.8, 3, 3.6, 7.5, 9, C.charcoal);
  r('Torneira', 5.5, 5.7, 3.6, 4.1, 8.2, 8.3, C.gray);
  r('Espelho', 5.68, 5.8, 4.6, 7.4, 7.3, 9.2, C.mirror);
}

// ---------------------------------------------------------------------------
// Montagem do lobby
// ---------------------------------------------------------------------------

export function buildLobby() {
  const b = makeBuilder();
  const { inX, inZ, wall, roofY, floor2: F2, catwalkEdge: E, stairX0, stairX1, stairHalf } = DIM;
  const oX = inX + wall; // 72
  const oZ = inZ + wall; // 42

  // --- Terreno ------------------------------------------------------------
  b.span('Terreno', 'Gramado', [-260, -2, -260], [260, -0.2, 260], C.grass);
  b.span('Terreno', 'Calçada', [-96, -0.2, -62], [92, -0.1, 62], C.apron);
  b.span('Terreno', 'Caminho', [-96, -0.1, -5], [-oX, -0.05, 5], C.orange);

  // --- Pisos do térreo ----------------------------------------------------
  const P = 'Prédio/Pisos';
  b.span(P, 'Laje Térreo', [-oX, -1, -oZ], [oX, 0, oZ], C.white);
  b.span(P, 'Piso Átrio', [ROW_START, 0, -16.5], [stairX1, 0.1, 16.5], C.blue, { studs: true });
  b.span(P, 'Piso Zona Jogar', [stairX1, 0, -E], [inX, 0.1, E], C.blueCafe, { studs: true });
  for (const s of [-1, 1]) {
    const tag = s < 0 ? 'Sul' : 'Norte';
    b.span(P, `Corredor ${tag}`, [-inX, 0, s * 20], [stairX1, 0.1, s * 25], C.orange);
    b.span(P, `Meio-fio ${tag}`, [ROW_START, 0, s * 25], [-ROW_START, 0.5, s * CELL_FRONT], C.charcoal, { studs: true });
  }
  // Hall de entrada: faixas laranja que levam ao portão
  for (const z of [-3.2, 0, 3.2]) {
    b.span(P, 'Faixa Hall', [-inX, 0, z - 0.8], [ROW_START, 0.1, z + 0.8], C.orange, { canCollide: false });
  }

  // --- Paredes externas ---------------------------------------------------
  const W = 'Prédio/Paredes';
  const wo = { group: 'Paredes' };
  b.span(W, 'Parede Sul', [-oX, 0, -oZ], [oX, roofY, -inZ], C.white, wo);
  b.span(W, 'Parede Norte', [-oX, 0, inZ], [oX, roofY, oZ], C.white, wo);
  b.span(W, 'Parede Leste', [inX, 0, -inZ], [oX, roofY, inZ], C.white, wo);
  b.span(W, 'Parede Oeste S', [-oX, 0, -inZ], [-inX, roofY, -4], C.white, wo);
  b.span(W, 'Parede Oeste N', [-oX, 0, 4], [-inX, roofY, inZ], C.white, wo);
  b.span(W, 'Parede Oeste Verga', [-oX, 9, -4], [-inX, roofY, 4], C.white, wo);
  // Faixas externas: rodapé marinho + listras laranja
  const ext = { ...wo, canCollide: false };
  for (const [n, a, c] of [
    ['Sul', [-oX - 0.1, 0, -oZ - 0.1], [oX + 0.1, 0, -oZ]],
    ['Norte', [-oX - 0.1, 0, oZ], [oX + 0.1, 0, oZ + 0.1]],
    ['Leste', [oX, 0, -oZ - 0.1], [oX + 0.1, 0, oZ + 0.1]],
    ['Oeste', [-oX - 0.1, 0, -oZ - 0.1], [-oX, 0, oZ + 0.1]],
  ]) {
    if (n !== 'Oeste') b.span(W, `Rodapé Externo ${n}`, a, [c[0], 2.5, c[2]], C.navy, ext);
    b.span(W, `Listra Externa ${n}`, [a[0], 29, a[2]], [c[0], 30.5, c[2]], C.orange, ext);
    b.span(W, `Listra Externa Fina ${n}`, [a[0], 31.3, a[2]], [c[0], 31.8, c[2]], C.orange, ext);
  }
  for (const [z0, z1] of [[-oZ - 0.1, -5.6], [5.6, oZ + 0.1]]) {
    b.span(W, 'Rodapé Externo Oeste', [-oX - 0.1, 0, z0], [-oX, 2.5, z1], C.navy, ext);
  }
  b.box(W, 'Letreiro Fachada', [-oX - 0.25, 15, 0], [0.4, 4, 30], C.navy, {
    ...wo,
    label: { text: 'PENITENCIÁRIA · LOBBY', face: 'Left', color: C.white },
  });

  // Faixas internas nas paredes de topo (leste/oeste) e acima das celas
  const inner = { canCollide: false, group: 'Paredes' };
  for (const [x, dir] of [[-inX, 1], [inX, -1]]) {
    const xb = x + dir * 0.1;
    for (const [ya, yb] of [[10.6, 11.4], [12.2, 13], [26.6, 27.4], [28.2, 29]]) {
      b.span(W, 'Listra Interna', [x, ya, -inZ], [xb, yb, inZ], C.orange, inner);
    }
    b.span(W, 'Rodapé Interno', [x, 0, -inZ], [xb, 1, inZ], C.navy, inner);
  }
  for (const s of [-1, 1]) {
    b.span(W, 'Listra Alta', [-inX, 32.4, s * inZ], [inX, 33.2, s * (inZ - 0.1)], C.orange, inner);
  }

  // Portão principal (folhas cinza com visores escuros e moldura laranja)
  const G = 'Prédio/Entrada';
  b.span(G, 'Moldura Portão S', [-oX - 0.3, 0, -5.6], [-inX + 0.8, 10.5, -4], C.orange);
  b.span(G, 'Moldura Portão N', [-oX - 0.3, 0, 4], [-inX + 0.8, 10.5, 5.6], C.orange);
  b.span(G, 'Moldura Portão Topo', [-oX - 0.3, 9, -5.6], [-inX + 0.8, 10.5, 5.6], C.orange, {
    label: { text: 'BEM-VINDO À PRISÃO', face: 'Right', color: C.white },
  });
  for (const [z0, z1, n] of [[-4, 0, 'S'], [0, 4, 'N']]) {
    b.span(G, `Folha ${n}`, [-inX - 0.6, 0, z0 + 0.05], [-inX - 0.1, 9, z1 - 0.05], C.gray);
    b.span(G, `Visor ${n}`, [-inX - 0.12, 5, z0 + 0.7], [-inX - 0.02, 7.5, z1 - 0.7], C.navyDark, { canCollide: false });
    b.span(G, `Faixa ${n}`, [-inX - 0.12, 3.2, z0 + 0.3], [-inX - 0.02, 3.6, z1 - 0.3], C.charcoal, { canCollide: false });
  }

  // --- Teto, vigas e claraboia -------------------------------------------
  const T = 'Prédio/Teto';
  const to = { group: 'Teto' };
  b.span(T, 'Laje Teto Sul', [-oX, roofY, -oZ], [oX, roofY + 1, -12], C.ceiling, to);
  b.span(T, 'Laje Teto Norte', [-oX, roofY, 12], [oX, roofY + 1, oZ], C.ceiling, to);
  b.span(T, 'Laje Teto Oeste', [-oX, roofY, -12], [-50, roofY + 1, 12], C.ceiling, to);
  b.span(T, 'Laje Teto Leste', [36, roofY, -12], [oX, roofY + 1, 12], C.ceiling, to);
  b.span(T, 'Claraboia', [-50, roofY + 0.3, -12], [36, roofY + 0.7, 12], C.glass, { ...to, transparency: 0.5 });
  for (const x of COLUMN_X) {
    b.span(T, 'Viga Transversal', [x - 0.6, 32.4, -inZ], [x + 0.6, roofY, inZ], C.grayDark, to);
  }
  for (const z of [-E, E]) b.span(T, 'Viga Longitudinal', [-inX, 32.4, z - 0.6], [inX, roofY, z + 0.6], C.grayDark, to);

  // Luminárias pendentes no átrio
  for (let x = -45.5; x <= 32.5; x += PITCH) {
    for (const z of [-8, 8]) hangingLight(b, 'Iluminação/Átrio', x, 29, z, 4.8);
  }

  // --- Colunas ------------------------------------------------------------
  for (const x of COLUMN_X) {
    for (const s of [-1, 1]) {
      b.box('Prédio/Colunas', 'Coluna', [x, roofY / 2, s * E], [2.6, roofY, 2.6], C.gray);
      b.box('Prédio/Colunas', 'Base Coluna', [x, 0.4, s * E], [3.2, 0.8, 3.2], C.grayDark);
    }
  }

  // --- Celas (2 alas x 2 andares x 8) -------------------------------------
  let number = 1;
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'Sul' : 'Norte';
    const z0 = Math.min(side * CELL_FRONT, side * inZ);
    const z1 = Math.max(side * CELL_FRONT, side * inZ);
    for (const floorY of [0, F2]) {
      for (let i = 0; i <= DIM.cellsPerRow; i++) {
        const wx = ROW_START + i * PITCH;
        b.span(`Celas/Ala ${tag}`, 'Divisória', [wx, floorY, z0], [wx + 1, floorY + DIM.cellH, z1], C.navy);
        b.span(`Celas/Ala ${tag}`, 'Divisória Faixa', [wx - 0.02, floorY + 12, side * (CELL_FRONT - 0.02)], [wx + 1.02, floorY + DIM.cellH, side * (CELL_FRONT + 0.6)], C.white, { canCollide: false });
      }
      for (let i = 0; i < DIM.cellsPerRow; i++) cell(b, i, side, floorY, number++);
    }
    b.span(`Celas/Ala ${tag}`, 'Laje Superior', [ROW_START, 31, z0], [-ROW_START, 32, z1], C.offWhite);

    // Laje do 2º andar (passarela + celas) e acabamentos
    const cz0 = side < 0 ? -inZ : E;
    const cz1 = side < 0 ? -E : inZ;
    const pw = `Passarelas/Passarela ${tag}`;
    b.span(pw, 'Laje', [-inX, F2 - 1, cz0], [stairX1, F2, cz1], C.offWhite);
    b.span(pw, 'Piso Passarela', [-inX, F2, side * E], [stairX1, F2 + 0.1, side * 25], C.lightGray);
    b.span(pw, 'Faixa Laranja', [-inX, F2, side * 20.4], [stairX1, F2 + 0.12, side * 21.4], C.orange, { canCollide: false });
    b.span(pw, 'Meio-fio', [ROW_START, F2, side * 25], [-ROW_START, F2 + 0.5, side * CELL_FRONT], C.charcoal, { studs: true });
    b.span(pw, 'Testeira', [-inX, F2 - 1.6, side * E - 0.3], [stairX1, F2, side * E + 0.3], C.orange);

    // Guarda-corpo de vidro entre as colunas (abertura para a ponte em x -23..-16)
    const stops = [-inX, ...COLUMN_X.flatMap((x) => [x - 1.3, x + 1.3]), stairX1];
    for (let i = 0; i < stops.length; i += 2) {
      const a = stops[i], c = stops[i + 1];
      if (c <= a) continue;
      if (a < -16 && c > -23) {
        if (a < -23) glassRail(b, pw, [a, side * E], [-23, side * E], F2);
        if (c > -16) glassRail(b, pw, [-16, side * E], [c, side * E], F2);
        continue;
      }
      glassRail(b, pw, [a, side * E], [c, side * E], F2);
    }

    // Iluminação dos corredores (térreo embutida, 2º andar pendente)
    for (let i = 0; i < DIM.cellsPerRow; i++) {
      const lx = ROW_START + 1 + DIM.cellW / 2 + i * PITCH;
      flushLight(b, `Iluminação/Corredor ${tag}`, lx, F2 - 1, side * 22.5, 5, 1.2, i % 2 === 0);
      hangingLight(b, `Iluminação/Galeria ${tag}`, lx, 30.4, side * 22.5, 3.4);
    }
  }

  // --- Ponte central (2º andar) ------------------------------------------
  const B = 'Passarelas/Ponte';
  b.span(B, 'Laje Ponte', [-23, F2 - 1, -E], [-16, F2, E], C.offWhite);
  b.span(B, 'Piso Ponte', [-23, F2, -E], [-16, F2 + 0.1, E], C.lightGray);
  b.span(B, 'Testeira E', [-23.3, F2 - 1.6, -E], [-22.7, F2, E], C.orange);
  b.span(B, 'Testeira D', [-16.3, F2 - 1.6, -E], [-15.7, F2, E], C.orange);
  glassRail(b, B, [-23, -E + 1.3], [-23, E - 1.3], F2);
  glassRail(b, B, [-16, -E + 1.3], [-16, E - 1.3], F2);

  // --- Mezanino leste + escada laranja ------------------------------------
  const M = 'Passarelas/Mezanino';
  b.span(M, 'Laje Mezanino', [stairX1, F2 - 1, -inZ], [inX, F2, inZ], C.offWhite);
  b.span(M, 'Patamar', [stairX1, F2, -E], [inX, F2 + 0.1, E], C.orange, { studs: true });
  b.span(M, 'Piso Mezanino S', [stairX1, F2, -inZ], [inX, F2 + 0.1, -E], C.lightGray);
  b.span(M, 'Piso Mezanino N', [stairX1, F2, E], [inX, F2 + 0.1, inZ], C.lightGray);
  b.span(M, 'Testeira', [stairX1 - 0.3, F2 - 1.6, -E], [stairX1 + 0.3, F2, E], C.orange);
  glassRail(b, M, [stairX1, -E + 1.3], [stairX1, -stairHalf - 0.8], F2);
  glassRail(b, M, [stairX1, stairHalf + 0.8], [stairX1, E - 1.3], F2);

  const S = 'Escada';
  const run = (stairX1 - stairX0) / F2;
  for (let k = 0; k < F2; k++) {
    const xa = stairX0 + k * run;
    b.span(S, `Degrau ${k + 1}`, [xa, 0, -stairHalf], [stairX1, k + 1, stairHalf], k % 2 ? C.orange : C.orangeDark);
  }
  for (const s of [-1, 1]) {
    b.span(S, 'Parede Escada', [stairX0, 0, s * stairHalf], [stairX1, F2 + 3.5, s * (stairHalf + 0.8)], C.white);
    b.span(S, 'Listra Parede', [stairX0, 1, s * (stairHalf + 0.8)], [stairX1, 1.8, s * (stairHalf + 0.9)], C.orange, { canCollide: false });
    b.span(S, 'Pórtico Pilar', [stairX0 - 1.6, 0, s * stairHalf], [stairX0, 14, s * (stairHalf + 2.4)], C.orange);
  }
  b.span(S, 'Pórtico Viga', [stairX0 - 1.6, 11, -stairHalf - 2.4], [stairX0, 14, stairHalf + 2.4], C.orange, {
    label: { text: '▲ 2º ANDAR', face: 'Left', color: C.white },
  });
  for (let i = 0; i < 6; i++) {
    b.span(S, 'Grelha', [stairX0 + 0.2 + i * 2.6, 13.6, -stairHalf], [stairX0 + 1.0 + i * 2.6, 14, stairHalf], C.orangeDark, { canCollide: false });
  }
  b.span(S, 'Forro Pórtico', [stairX0, 14, -stairHalf], [stairX0 + 16, 14.2, stairHalf], C.orange, { canCollide: false });

  // --- Hall de entrada ----------------------------------------------------
  const H = 'Átrio/Hall';
  b.box(H, 'SpawnLocation', [-62, 0.5, 0], [8, 1, 8], C.orange, { className: 'SpawnLocation', studs: true });
  b.box(H, 'Borda Spawn', [-62, 0.15, 0], [9.2, 0.3, 9.2], C.charcoal, { studs: true });
  b.span(H, 'Balcão Recepção', [-60, 0, 9], [-56.5, 3.5, 16], C.navy);
  b.span(H, 'Tampo Recepção', [-60.3, 3.5, 8.7], [-56.2, 3.8, 16.3], C.white);
  b.span(H, 'Faixa Recepção', [-56.5, 1.2, 9], [-56.4, 1.8, 16], C.orange, { canCollide: false });
  b.box(H, 'Placa Recepção', [-63, 9.5, 12.5], [0.3, 1.6, 7], C.navy, {
    canCollide: false,
    label: { text: 'RECEPÇÃO', face: 'Right', color: C.white },
  });

  // Depósitos fechados (cantos oeste do térreo) com janela
  for (const s of [-1, 1]) {
    const D = `Átrio/Depósito ${s < 0 ? 'Sul' : 'Norte'}`;
    const za = s * CELL_FRONT, zb = s * (CELL_FRONT + 0.6);
    b.span(D, 'Parede Baixa', [-inX, 0, za], [ROW_START, 3, zb], C.white);
    b.span(D, 'Parede Alta', [-inX, 10, za], [ROW_START, F2 - 1, zb], C.white);
    b.span(D, 'Parede E', [-inX, 3, za], [-66, 10, zb], C.white);
    b.span(D, 'Parede D', [-56, 3, za], [ROW_START, 10, zb], C.white);
    b.span(D, 'Vidro', [-66, 3, s * (CELL_FRONT + 0.2)], [-56, 10, s * (CELL_FRONT + 0.4)], C.glass, { transparency: 0.55 });
    for (const [a, c] of [[[-66.3, 2.8], [-65.9, 10.2]], [[-56.1, 2.8], [-55.7, 10.2]], [[-66.3, 9.8], [-55.7, 10.2]], [[-66.3, 2.8], [-55.7, 3.2]]]) {
      b.span(D, 'Caixilho', [a[0], a[1], za - s * 0.05], [c[0], c[1], zb + s * 0.05], C.charcoal);
    }
    b.span(D, 'Listra', [-inX, 12, za - s * 0.08], [ROW_START, 12.8, za], C.orange, { canCollide: false });
    b.box(D, 'Placa', [-61, 11.4, za - s * 0.1], [6, 1.2, 0.2], C.navy, {
      canCollide: false,
      label: { text: 'DEPÓSITO', face: s < 0 ? 'Back' : 'Front', color: C.white },
    });
    crate(b, D, -66, 0, s * 31);
    crate(b, D, -66, 4, s * 31);
    crate(b, D, -61.5, 0, s * 30);
    rack(b, D, -61, s * 37, 12, 3, 10);
    flushLight(b, D, -61, F2 - 1, s * 33, 5, 1.2);
  }

  // --- Átrio: refeitório e caixas ----------------------------------------
  const R = 'Átrio/Refeitório';
  for (const [tx, tz] of [[-42, -8], [-42, 8], [-31, -8], [-31, 8]]) {
    b.box(R, 'Mesa Tampo', [tx, 3.2, tz], [0.4, 7, 7], C.white, { shape: 'Cylinder', rotation: [0, 0, 90] });
    b.box(R, 'Mesa Pé', [tx, 1.6, tz], [1, 3, 1], C.charcoal);
    b.box(R, 'Mesa Base', [tx, 0.25, tz], [3, 0.3, 3], C.charcoal);
    for (const s of [-1, 1]) {
      b.box(R, 'Banco', [tx, 1.8, tz + s * 4.8], [6, 0.5, 1.6], C.gray);
      b.box(R, 'Banco Encosto', [tx, 2.9, tz + s * 5.6], [6, 1.7, 0.35], C.charcoal);
      b.box(R, 'Banco Pé', [tx - 2.2, 0.8, tz + s * 4.8], [0.6, 1.6, 1.2], C.charcoal);
      b.box(R, 'Banco Pé', [tx + 2.2, 0.8, tz + s * 4.8], [0.6, 1.6, 1.2], C.charcoal);
    }
  }
  const K = 'Átrio/Caixas';
  crate(b, K, 4, 0.1, -10);
  crate(b, K, 8.2, 0.1, -10);
  crate(b, K, 6.1, 4.1, -10);
  crate(b, K, 18, 0.1, 11);
  crate(b, K, 18, 0.1, 6.8, 3);

  // --- Zona Jogar (sob o mezanino) ---------------------------------------
  const Z = 'Átrio/Zona Jogar';
  const screens = [
    ['Fila 1', -10, [120, 220, 255]],
    ['Fila 2', 0, [240, 240, 255]],
    ['Fila 3', 10, [255, 50, 220]],
  ];
  for (const [name, z, color] of screens) {
    b.box(Z, `${name} Tela`, [inX - 0.25, 7.5, z], [0.3, 4.5, 6.5], color, { material: 'Neon', canCollide: false, light: { range: 14, brightness: 1, color } });
    b.box(Z, `${name} Moldura`, [inX - 0.1, 7.5, z], [0.2, 5.3, 7.3], C.charcoal, { canCollide: false });
    b.box(Z, `${name} Placa`, [inX - 0.25, 11.2, z], [0.3, 1.4, 6.5], C.navy, {
      canCollide: false,
      label: { text: name.toUpperCase(), face: 'Left', color: C.white },
    });
    b.box(Z, `${name} Aro`, [63, 0.2, z], [6.6, 0.4, 6.6], C.charcoal, { studs: true });
    b.box(Z, name, [63, 0.45, z], [5.6, 0.3, 5.6], color, { studs: true });
  }
  for (const z of [-12, 0, 12]) flushLight(b, Z, 63, F2 - 1, z, 5, 1.2);

  // Estoque aberto sob o mezanino (estantes)
  for (const s of [-1, 1]) {
    const D = `Átrio/Estoque ${s < 0 ? 'Sul' : 'Norte'}`;
    for (const z of [23, 29.5, 36]) rack(b, D, 63, s * z, 9, 3, 10);
    flushLight(b, D, 63, F2 - 1, s * 26.2, 5, 1.2);
    flushLight(b, D, 63, F2 - 1, s * 32.8, 5, 1.2, false);
  }

  return { parts: b.parts };
}

// ---------------------------------------------------------------------------
// Utilidades compartilhadas
// ---------------------------------------------------------------------------

/** Matriz de rotação 3x3 de CFrame.Angles(rx, ry, rz) (graus) = Rx * Ry * Rz. */
export function rotationMatrix(rot) {
  if (!rot) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const [ax, ay, az] = rot.map((d) => (d * Math.PI) / 180);
  const cx = Math.cos(ax), sx = Math.sin(ax);
  const cy = Math.cos(ay), sy = Math.sin(ay);
  const cz = Math.cos(az), sz = Math.sin(az);
  return [
    cy * cz, -cy * sz, sy,
    cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy,
    sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy,
  ].map(round6);
}

function round6(v) {
  const r = Math.round(v * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
}

export function stats(parts) {
  const groups = {};
  for (const p of parts) groups[p.group] = (groups[p.group] || 0) + 1;
  return { total: parts.length, groups };
}
