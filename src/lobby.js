// Lobby "Prisão" — fonte única da verdade do mapa.
//
// Este módulo descreve TODAS as Parts do lobby como dados puros. Ele é usado:
//   * pelo visualizador Three.js (index.html) para mostrar o mapa no navegador;
//   * pelo gerador tools/build-rbxlx.mjs para criar o arquivo .rbxlx do Roblox.
//
// Regras do estilo: apenas Part clássico (shape Block), material SmoothPlastic,
// todas as superfícies lisas (sem studs) e nenhuma textura/decal.
//
// Unidades em studs. Eixos iguais aos do Roblox e do Three.js (Y para cima).

export const STYLE = Object.freeze({
  material: 'SmoothPlastic',
  shape: 'Block',
});

const C = {
  concrete: [124, 124, 128],
  yard: [138, 138, 134],
  path: [104, 104, 108],
  grass: [96, 140, 80],
  wall: [178, 174, 164],
  wallDark: [96, 100, 110],
  cellWall: [206, 201, 190],
  cellFloor: [150, 150, 146],
  steel: [62, 64, 70],
  catwalk: [92, 96, 104],
  rail: [214, 162, 32],
  roof: [78, 80, 86],
  glass: [168, 208, 232],
  lamp: [255, 244, 206],
  pedestal: [46, 48, 54],
  pedestalTop: [238, 190, 60],
  plaque: [28, 32, 40],
  bed: [70, 76, 84],
  mattress: [222, 222, 214],
  toilet: [236, 236, 236],
  stripe: [240, 196, 30],
  table: [120, 124, 132],
  booth: [52, 70, 104],
  tower: [70, 74, 82],
  padGreen: [60, 190, 90],
  padYellow: [240, 200, 40],
  padRed: [220, 70, 60],
  spawn: [40, 120, 210],
};

// Roupas do showcase (uma por cela, repetindo nos 4 blocos).
export const OUTFITS = [
  { name: 'Detento Laranja', shirt: [255, 128, 0], pants: [255, 128, 0], skin: [245, 205, 160] },
  { name: 'Listrado Clássico', shirt: [235, 235, 235], pants: [235, 235, 235], skin: [204, 142, 105], stripes: [25, 25, 25] },
  { name: 'Guarda', shirt: [52, 88, 160], pants: [30, 32, 40], skin: [160, 105, 75] },
  { name: 'Diretor', shirt: [40, 40, 46], pants: [40, 40, 46], skin: [245, 205, 160], tie: [180, 30, 40] },
  { name: 'Fugitivo', shirt: [255, 128, 0], pants: [70, 90, 140], skin: [120, 80, 55] },
  { name: 'Cozinheiro', shirt: [250, 250, 250], pants: [60, 60, 60], skin: [230, 185, 140] },
  { name: 'Mecânico', shirt: [90, 110, 70], pants: [90, 110, 70], skin: [204, 142, 105] },
  { name: 'VIP Dourado', shirt: [230, 180, 40], pants: [230, 180, 40], skin: [245, 205, 160], stripes: [120, 85, 10] },
];

// ---------------------------------------------------------------------------
// Construtor de partes
// ---------------------------------------------------------------------------

function makeBuilder() {
  const parts = [];
  const models = new Map(); // path -> { name, path }

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
        label: opts.label ?? null, // { text, face, color, bg }
        className: opts.className ?? 'Part',
        group: opts.group ?? model.split('/')[0],
      };
      parts.push(part);
      if (!models.has(model)) models.set(model, model);
      return part;
    },
    /** Caixa pelos cantos mínimo/máximo. */
    span(model, name, min, max, color, opts) {
      const center = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
      const size = [0, 1, 2].map((i) => Math.abs(max[i] - min[i]));
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
  floor1: 0,
  floor2: 16, // piso do 2º andar (topo da laje)
  cellH: 15,
  cellW: 12,
  cellD: 14,
  cellsPerRow: 8,
  roofY: 34,
  catwalkEdge: 20, // passarela vai de |z|=20 até |z|=26
});

const CELL_FRONT = DIM.inZ - DIM.cellD; // 26
const PITCH = DIM.cellW + 1; // 13
const ROW_START = -(DIM.cellsPerRow * PITCH + 1) / 2; // -52.5

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
  // Rosto simples feito de blocos (sem decal): olhos e boca.
  const fz = z + f * 0.61;
  b.box(model, 'Olho Esquerdo', [x - 0.25, y + 4.75, fz], [0.16, 0.22, 0.04], [20, 20, 20], { canCollide: false });
  b.box(model, 'Olho Direito', [x + 0.25, y + 4.75, fz], [0.16, 0.22, 0.04], [20, 20, 20], { canCollide: false });
  b.box(model, 'Boca', [x, y + 4.32, fz], [0.5, 0.08, 0.04], [20, 20, 20], { canCollide: false });
  if (outfit.stripes) {
    for (let i = 0; i < 3; i++) {
      const sy = y + 0.4 + i * 0.66;
      b.box(model, `Listra Perna ${i + 1}`, [x, sy, z], [2.04, 0.22, 1.04], outfit.stripes, { canCollide: false });
      b.box(model, `Listra Tronco ${i + 1}`, [x, y + 2.4 + i * 0.66, z], [4.04, 0.22, 1.04], outfit.stripes, { canCollide: false });
    }
  }
  if (outfit.tie) {
    b.box(model, 'Gravata', [x, y + 3.1, z + f * 0.52], [0.3, 1.5, 0.04], outfit.tie, { canCollide: false });
  }
}

/** Uma cela showcase. side = -1 (bloco sul, abre para +Z) ou +1 (bloco norte, abre para -Z). */
function cell(b, index, side, floorY, number) {
  const outfit = OUTFITS[index % OUTFITS.length];
  const model = `Celas/Cela ${String(number).padStart(2, '0')}`;
  const cx = ROW_START + 1 + DIM.cellW / 2 + index * PITCH; // centro X da cela
  const front = side * CELL_FRONT; // plano da grade
  const inward = side; // direção do fundo da cela
  const facing = -side; // a cela "olha" para o átrio
  const y0 = floorY;
  const zAt = (depth) => front + inward * depth; // profundidade -> Z

  // Piso da cela levemente diferente
  b.span(model, 'Piso', [cx - 6, y0, zAt(0.4)], [cx + 6, y0 + 0.1, zAt(DIM.cellD)], C.cellFloor);

  // Verga sólida acima da grade (com placa)
  const lintelZ0 = front + inward * 0;
  const lintelZ1 = front + inward * 0.4;
  b.span(model, 'Verga', [cx - 6, y0 + 13, lintelZ0], [cx + 6, y0 + DIM.cellH, lintelZ1], C.cellWall);
  b.box(
    model,
    'Placa',
    [cx, y0 + 14, front + facing * 0.1],
    [7.5, 1.5, 0.2],
    C.plaque,
    {
      label: {
        text: `CELA ${String(number).padStart(2, '0')} · ${outfit.name.toUpperCase()}`,
        face: facing > 0 ? 'Back' : 'Front',
        color: [255, 210, 80],
      },
    },
  );

  // Grade: barras verticais + travessas
  const barZ = front + inward * 0.2;
  for (let i = 0; i < 8; i++) {
    const bx = cx - 5.25 + i * 1.5;
    b.box(model, `Barra ${i + 1}`, [bx, y0 + 6.5, barZ], [0.3, 13, 0.3], C.steel);
  }
  b.box(model, 'Travessa Inferior', [cx, y0 + 0.6, barZ], [12, 0.35, 0.4], C.steel);
  b.box(model, 'Travessa Meio', [cx, y0 + 9.5, barZ], [12, 0.35, 0.4], C.steel);
  b.box(model, 'Travessa Superior', [cx, y0 + 12.8, barZ], [12, 0.4, 0.4], C.steel);

  // Vidro do showcase logo atrás da grade
  b.box(model, 'Vidro Showcase', [cx, y0 + 6.5, front + inward * 0.6], [12, 13, 0.2], C.glass, { transparency: 0.78 });

  // Pedestal + boneco
  const pz = zAt(5.5);
  b.box(model, 'Pedestal', [cx, y0 + 0.6, pz], [5, 1.2, 5], C.pedestal);
  b.box(model, 'Pedestal Borda', [cx, y0 + 1.3, pz], [5.4, 0.2, 5.4], C.pedestalTop);
  dummy(b, `${model}/Showcase`, [cx, y0 + 1.4, pz], facing, outfit);

  // Holofote do showcase (teto)
  b.box(model, 'Luminária', [cx, y0 + DIM.cellH - 0.2, zAt(5.5)], [3, 0.3, 1.6], C.lamp, {
    canCollide: false,
    light: { range: 16, brightness: 1.2, color: [255, 236, 200] },
  });

  // Beliche no fundo
  const bz = zAt(12);
  for (const lvl of [0, 1]) {
    const by = y0 + 1.8 + lvl * 3.8;
    b.box(model, `Cama ${lvl + 1} Estrado`, [cx - 1.5, by, bz], [7, 0.4, 3.2], C.bed);
    b.box(model, `Cama ${lvl + 1} Colchão`, [cx - 1.5, by + 0.45, bz], [6.8, 0.5, 3], C.mattress);
  }
  for (const dx of [-4.9, 1.9]) {
    for (const dz of [-1.4, 1.4]) {
      b.box(model, 'Pé Beliche', [cx + dx, y0 + 4, bz + dz], [0.3, 8, 0.3], C.bed);
    }
  }

  // Vaso sanitário e pia no canto
  const tz = zAt(12.2);
  b.box(model, 'Vaso Base', [cx + 4.4, y0 + 0.9, tz], [1.6, 1.8, 2], C.toilet);
  b.box(model, 'Vaso Caixa', [cx + 4.4, y0 + 2.4, tz + inward * 0.85], [1.6, 1.4, 0.4], C.toilet);
  b.box(model, 'Pia', [cx + 4.9, y0 + 3.6, zAt(9)], [1.2, 0.5, 1.6], C.toilet);
}

/** Corrimão reto com postes, entre x0 e x1, numa linha z, com aberturas. */
function railingX(b, model, x0, x1, z, y, gaps = []) {
  const inGap = (x) => gaps.some(([g0, g1]) => x > g0 && x < g1);
  const segs = [];
  let start = x0;
  const cuts = [...gaps].sort((a, c) => a[0] - c[0]);
  for (const [g0, g1] of cuts) {
    if (g0 > start) segs.push([start, g0]);
    start = Math.max(start, g1);
  }
  if (start < x1) segs.push([start, x1]);
  segs.forEach(([s0, s1], i) => {
    b.span(model, `Corrimão ${i + 1}`, [s0, y + 3.3, z - 0.2], [s1, y + 3.7, z + 0.2], C.rail);
    b.span(model, `Corrimão Meio ${i + 1}`, [s0, y + 1.8, z - 0.15], [s1, y + 2.1, z + 0.15], C.rail);
    b.span(model, `Rodapé ${i + 1}`, [s0, y, z - 0.15], [s1, y + 0.4, z + 0.15], C.rail);
    for (let x = s0; x <= s1 + 0.01; x += Math.max(2, (s1 - s0) / Math.ceil((s1 - s0) / 4))) {
      if (!inGap(x)) b.box(model, 'Poste', [x, y + 1.85, z], [0.4, 3.7, 0.4], C.rail);
    }
  });
}

function railingZ(b, model, z0, z1, x, y) {
  b.span(model, 'Corrimão', [x - 0.2, y + 3.3, z0], [x + 0.2, y + 3.7, z1], C.rail);
  b.span(model, 'Corrimão Meio', [x - 0.15, y + 1.8, z0], [x + 0.15, y + 2.1, z1], C.rail);
  const n = Math.ceil((z1 - z0) / 4);
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    b.box(model, 'Poste', [x, y + 1.85, z], [0.4, 3.7, 0.4], C.rail);
  }
}

/** Escada maciça que sobe ao longo de Z, de zBottom (y=0) até zTop (y=rise). */
function stair(b, model, x0, x1, zBottom, zTop, rise, railX) {
  const steps = rise;
  const dir = Math.sign(zTop - zBottom);
  const run = Math.abs(zTop - zBottom) / steps;
  for (let k = 0; k < steps; k++) {
    const za = zBottom + dir * run * k;
    const zb = zBottom + dir * run * (k + 1);
    b.span(model, `Degrau ${k + 1}`, [x0, 0, Math.min(za, zb)], [x1, k + 1, Math.max(za, zb)], k % 2 ? C.concrete : [116, 116, 120]);
    b.span(model, `Faixa ${k + 1}`, [x0, k + 1, dir > 0 ? za : za - 0.3], [x1, k + 1.05, dir > 0 ? za + 0.3 : za], C.stripe, { canCollide: false });
  }
  // Corrimão inclinado
  const len = Math.hypot(Math.abs(zTop - zBottom), rise);
  const angle = (Math.atan2(rise, Math.abs(zTop - zBottom)) * 180) / Math.PI;
  const midZ = (zBottom + zTop) / 2;
  b.box(model, 'Corrimão Inclinado', [railX, rise / 2 + 3.5, midZ], [0.4, 0.4, len], C.rail, {
    rotation: [dir > 0 ? -angle : angle, 0, 0],
  });
  const posts = 6;
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    const z = zBottom + (zTop - zBottom) * t;
    const top = rise * t;
    b.box(model, 'Poste', [railX, top + 1.75 + 0.5, z], [0.4, 3.5, 0.4], C.rail);
  }
}

function watchtower(b, name, x, z) {
  const m = `Pátio/${name}`;
  for (const dx of [-3, 3]) for (const dz of [-3, 3]) b.box(m, 'Pilar', [x + dx, 9, z + dz], [1, 18, 1], C.tower);
  b.box(m, 'Piso', [x, 18.5, z], [9, 1, 9], C.tower);
  b.box(m, 'Parede Baixa N', [x, 20.5, z + 4.3], [9, 3, 0.4], C.wallDark);
  b.box(m, 'Parede Baixa S', [x, 20.5, z - 4.3], [9, 3, 0.4], C.wallDark);
  b.box(m, 'Parede Baixa L', [x + 4.3, 20.5, z], [0.4, 3, 8.2], C.wallDark);
  b.box(m, 'Parede Baixa O', [x - 4.3, 20.5, z], [0.4, 3, 8.2], C.wallDark);
  b.box(m, 'Vidro', [x, 23.5, z], [8.4, 3, 8.4], C.glass, { transparency: 0.7 });
  b.box(m, 'Telhado', [x, 25.5, z], [10.5, 1, 10.5], C.roof);
  b.box(m, 'Holofote', [x, 24.6, z], [1.4, 0.6, 1.4], C.lamp, { canCollide: false, light: { range: 30, brightness: 1, color: [255, 244, 220] } });
  // escada de marinheiro
  for (let i = 0; i < 9; i++) b.box(m, 'Degrau', [x, 1 + i * 2, z - 3.7], [1.6, 0.25, 0.25], C.steel);
}

// ---------------------------------------------------------------------------
// Montagem do lobby
// ---------------------------------------------------------------------------

export function buildLobby() {
  const b = makeBuilder();
  const { inX, inZ, wall, roofY } = DIM;
  const oX = inX + wall; // 72
  const oZ = inZ + wall; // 42

  // --- Terreno e pátio ----------------------------------------------------
  b.span('Terreno', 'Gramado', [-260, -2, -260], [260, -0.2, 260], C.grass);
  b.span('Pátio', 'Piso do Pátio', [-118, -0.2, -76], [100, -0.1, 76], C.yard);
  b.span('Pátio', 'Caminho Entrada', [-118, -0.1, -6], [-oX, -0.05, 6], C.path);

  // Cerca perimetral com portão no oeste
  const fx0 = -116, fx1 = 98, fz = 74, fh = 14;
  const fence = (name, min, max) => {
    b.span('Pátio/Cerca', name, min, max, [150, 152, 156], { transparency: 0.55 });
  };
  fence('Cerca Sul', [fx0, 0, -fz - 0.15], [fx1, fh, -fz + 0.15]);
  fence('Cerca Norte', [fx0, 0, fz - 0.15], [fx1, fh, fz + 0.15]);
  fence('Cerca Leste', [fx1 - 0.15, 0, -fz], [fx1 + 0.15, fh, fz]);
  fence('Cerca Oeste A', [fx0 - 0.15, 0, -fz], [fx0 + 0.15, fh, -8]);
  fence('Cerca Oeste B', [fx0 - 0.15, 0, 8], [fx0 + 0.15, fh, fz]);
  for (let x = fx0; x <= fx1; x += 10.7) {
    b.box('Pátio/Cerca', 'Poste', [x, fh / 2, -fz], [0.8, fh, 0.8], C.steel);
    b.box('Pátio/Cerca', 'Poste', [x, fh / 2, fz], [0.8, fh, 0.8], C.steel);
  }
  for (let z = -fz; z <= fz; z += 10.57) {
    b.box('Pátio/Cerca', 'Poste', [fx1, fh / 2, z], [0.8, fh, 0.8], C.steel);
    if (Math.abs(z) > 8) b.box('Pátio/Cerca', 'Poste', [fx0, fh / 2, z], [0.8, fh, 0.8], C.steel);
  }
  b.span('Pátio/Cerca', 'Trilho Superior Sul', [fx0, fh, -fz - 0.3], [fx1, fh + 0.5, -fz + 0.3], C.steel);
  b.span('Pátio/Cerca', 'Trilho Superior Norte', [fx0, fh, fz - 0.3], [fx1, fh + 0.5, fz + 0.3], C.steel);
  b.span('Pátio/Cerca', 'Trilho Superior Leste', [fx1 - 0.3, fh, -fz], [fx1 + 0.3, fh + 0.5, fz], C.steel);
  // Portão (aberto) do pátio
  b.box('Pátio/Portão', 'Pilar Portão N', [fx0, 9, 9], [2, 18, 2], C.wallDark);
  b.box('Pátio/Portão', 'Pilar Portão S', [fx0, 9, -9], [2, 18, 2], C.wallDark);
  b.box('Pátio/Portão', 'Viga Portão', [fx0, 17.5, 0], [2, 1.5, 20], C.wallDark, {
    label: { text: 'PENITENCIÁRIA ROBLOX', face: 'Left', color: [255, 210, 80] },
  });

  watchtower(b, 'Torre NO', fx0 + 6, fz - 6);
  watchtower(b, 'Torre SO', fx0 + 6, -fz + 6);
  watchtower(b, 'Torre NE', fx1 - 6, fz - 6);
  watchtower(b, 'Torre SE', fx1 - 6, -fz + 6);

  // --- Prédio: piso, paredes, teto -----------------------------------------
  b.span('Prédio', 'Piso Térreo', [-oX, -1, -oZ], [oX, 0, oZ], C.concrete);
  // Linhas amarelas de segurança no átrio
  for (const s of [-1, 1]) {
    b.span('Prédio/Faixas', 'Faixa Amarela', [-52.5, 0, s * 19.6 - 0.2], [52.5, 0.05, s * 19.6 + 0.2], C.stripe, { canCollide: false });
  }

  const wallOpts = { group: 'Paredes' };
  // Paredes longas (sul/norte): sólida até 32, faixa de vidro 32..34
  for (const s of [-1, 1]) {
    const zA = s < 0 ? -oZ : inZ;
    const zB = s < 0 ? -inZ : oZ;
    const tag = s < 0 ? 'Sul' : 'Norte';
    b.span('Prédio/Paredes', `Parede ${tag}`, [-oX, 0, zA], [oX, 32, zB], C.wall, wallOpts);
    b.span('Prédio/Paredes', `Janela Alta ${tag}`, [-oX, 32, zA], [oX, roofY, zB], C.glass, { ...wallOpts, transparency: 0.6 });
    for (let x = -66; x <= 66; x += 12) {
      b.span('Prédio/Paredes', 'Montante', [x - 0.5, 32, zA - 0.1], [x + 0.5, roofY, zB + 0.1], C.steel, wallOpts);
    }
  }
  // Parede leste (fechada, com janelas altas)
  b.span('Prédio/Paredes', 'Parede Leste Baixa', [inX, 0, -inZ], [oX, 24, inZ], C.wall, wallOpts);
  b.span('Prédio/Paredes', 'Janela Leste', [inX, 24, -inZ], [oX, 30, inZ], C.glass, { ...wallOpts, transparency: 0.6 });
  b.span('Prédio/Paredes', 'Parede Leste Alta', [inX, 30, -inZ], [oX, roofY, inZ], C.wall, wallOpts);
  // Parede oeste com portão principal (z -6..6, altura 12)
  b.span('Prédio/Paredes', 'Parede Oeste S', [-oX, 0, -inZ], [-inX, roofY, -6], C.wall, wallOpts);
  b.span('Prédio/Paredes', 'Parede Oeste N', [-oX, 0, 6], [-inX, roofY, inZ], C.wall, wallOpts);
  b.span('Prédio/Paredes', 'Parede Oeste Verga', [-oX, 12, -6], [-inX, roofY, 6], C.wall, wallOpts);
  b.box('Prédio/Entrada', 'Letreiro Entrada', [-oX - 0.3, 15, 0], [0.6, 4, 22], C.plaque, {
    label: { text: 'BLOCO A · LOBBY', face: 'Left', color: [255, 210, 80] },
  });
  // Grades do portão principal abertas para os lados
  for (let i = 0; i < 6; i++) {
    b.box('Prédio/Entrada', 'Grade Portão', [-oX - 0.6 - i * 1, 6, -6.4], [0.35, 12, 0.35], C.steel);
    b.box('Prédio/Entrada', 'Grade Portão', [-oX - 0.6 - i * 1, 6, 6.4], [0.35, 12, 0.35], C.steel);
  }
  b.box('Prédio/Entrada', 'Travessa Portão S', [-oX - 3, 11.5, -6.4], [6, 0.4, 0.4], C.steel);
  b.box('Prédio/Entrada', 'Travessa Portão N', [-oX - 3, 11.5, 6.4], [6, 0.4, 0.4], C.steel);

  // Teto com claraboia central
  b.span('Prédio/Teto', 'Teto Sul', [-oX, roofY, -oZ], [oX, roofY + 1, -6], C.roof, { group: 'Teto' });
  b.span('Prédio/Teto', 'Teto Norte', [-oX, roofY, 6], [oX, roofY + 1, oZ], C.roof, { group: 'Teto' });
  b.span('Prédio/Teto', 'Teto Leste', [52, roofY, -6], [oX, roofY + 1, 6], C.roof, { group: 'Teto' });
  b.span('Prédio/Teto', 'Teto Oeste', [-oX, roofY, -6], [-52, roofY + 1, 6], C.roof, { group: 'Teto' });
  b.span('Prédio/Teto', 'Claraboia', [-52, roofY + 0.3, -6], [52, roofY + 0.7, 6], C.glass, { group: 'Teto', transparency: 0.55 });
  for (let x = -48; x <= 48; x += 8) {
    b.span('Prédio/Teto', 'Viga Claraboia', [x - 0.4, roofY - 0.6, -6], [x + 0.4, roofY + 1, 6], C.steel, { group: 'Teto' });
  }
  // Luminárias penduradas no átrio
  for (let x = -44; x <= 44; x += 22) {
    for (const z of [-11, 11]) {
      b.box('Prédio/Iluminação', 'Cabo', [x, roofY - 2, z], [0.15, 4, 0.15], C.steel, { canCollide: false });
      b.box('Prédio/Iluminação', 'Luminária Átrio', [x, roofY - 4.3, z], [6, 0.6, 1.4], C.lamp, {
        canCollide: false,
        light: { range: 40, brightness: 1.4, color: [255, 240, 210] },
      });
    }
  }

  // --- Blocos de celas (2 lados x 2 andares x 8) --------------------------
  let number = 1;
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'Sul' : 'Norte';
    const zFront = side * CELL_FRONT;
    const zBack = side * inZ;
    const z0 = Math.min(zFront, zBack);
    const z1 = Math.max(zFront, zBack);
    for (const floorY of [0, DIM.floor2]) {
      // paredes divisórias
      for (let i = 0; i <= DIM.cellsPerRow; i++) {
        const wx = ROW_START + i * PITCH;
        b.span(`Celas/Bloco ${tag}`, 'Divisória', [wx, floorY, z0], [wx + 1, floorY + DIM.cellH, z1], C.cellWall);
      }
      // parede do fundo (acabamento interno)
      b.span(`Celas/Bloco ${tag}`, 'Fundo', [ROW_START, floorY, side < 0 ? z0 : z1 - 0.3], [-ROW_START, floorY + DIM.cellH, side < 0 ? z0 + 0.3 : z1], C.cellWall);
      for (let i = 0; i < DIM.cellsPerRow; i++) cell(b, i, side, floorY, number++);
    }
    // Laje do 2º andar (celas + passarela) e laje superior das celas
    const cz0 = side < 0 ? -inZ : DIM.catwalkEdge;
    const cz1 = side < 0 ? -DIM.catwalkEdge : inZ;
    b.span(`Passarela ${tag}`, 'Laje 2º Andar', [-inX, DIM.floor2 - 1, cz0], [inX, DIM.floor2, cz1], C.catwalk);
    b.span(`Celas/Bloco ${tag}`, 'Laje Superior', [ROW_START, 31, z0], [-ROW_START, 32, z1], C.cellWall);
    // Vigas sob a passarela
    for (let x = -60; x <= 60; x += 15) {
      b.box(`Passarela ${tag}`, 'Pilar', [x, (DIM.floor2 - 1) / 2, side * (DIM.catwalkEdge + 0.6)], [1, DIM.floor2 - 1, 1], C.steel);
    }
  }

  // Corrimãos das passarelas (com aberturas para ponte e escadas)
  railingX(b, 'Passarela Sul', -inX, inX, -DIM.catwalkEdge, DIM.floor2, [[-4, 4], [62, 70]]);
  railingX(b, 'Passarela Norte', -inX, inX, DIM.catwalkEdge, DIM.floor2, [[-4, 4], [54, 62]]);

  // Ponte central no 2º andar
  b.span('Ponte', 'Ponte', [-4, DIM.floor2 - 1, -DIM.catwalkEdge], [4, DIM.floor2, DIM.catwalkEdge], C.catwalk);
  railingZ(b, 'Ponte', -DIM.catwalkEdge, DIM.catwalkEdge, -3.8, DIM.floor2);
  railingZ(b, 'Ponte', -DIM.catwalkEdge, DIM.catwalkEdge, 3.8, DIM.floor2);

  // Escadas em tesoura no leste
  stair(b, 'Escadas/Escada Sul', 62, 70, 14, -DIM.catwalkEdge, DIM.floor2, 62.2);
  stair(b, 'Escadas/Escada Norte', 54, 62, -14, DIM.catwalkEdge, DIM.floor2, 54.2);

  // --- Átrio: spawn, guarita, mesas, zona de jogar ------------------------
  b.box('Átrio', 'SpawnLocation', [-40, 0.5, 0], [10, 1, 10], C.spawn, { className: 'SpawnLocation' });
  b.box('Átrio', 'Borda Spawn', [-40, 0.05, 0], [12, 0.1, 12], C.stripe, { canCollide: false });

  // Guarita central (sob a ponte)
  const g = 'Átrio/Guarita';
  b.span(g, 'Base', [-6, 0, -5], [6, 4, 5], C.booth);
  b.span(g, 'Balcão', [-6.4, 4, -5.4], [6.4, 4.4, 5.4], C.table);
  for (const [px, pz] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) b.box(g, 'Coluna', [px, 6.5, pz], [0.6, 5, 0.6], C.booth);
  b.span(g, 'Vidro N', [-6, 4.4, 4.8], [6, 9, 5], C.glass, { transparency: 0.7 });
  b.span(g, 'Vidro S', [-6, 4.4, -5], [6, 9, -4.8], C.glass, { transparency: 0.7 });
  b.span(g, 'Vidro L', [5.8, 4.4, -5], [6, 9, 5], C.glass, { transparency: 0.7 });
  b.span(g, 'Vidro O', [-6, 4.4, -5], [-5.8, 9, 5], C.glass, { transparency: 0.7 });
  b.span(g, 'Teto Guarita', [-6.6, 9, -5.6], [6.6, 9.8, 5.6], C.booth, {
    label: { text: 'GUARITA', face: 'Left', color: [255, 255, 255] },
  });
  b.box(g, 'Sirene', [0, 10.3, 0], [1.2, 0.8, 1.2], C.padRed, { light: { range: 18, brightness: 1, color: [255, 60, 40] } });

  // Refeitório: mesas e bancos de aço
  for (const tx of [-24, -12]) {
    for (const tz of [-10, 10]) {
      const m = 'Átrio/Refeitório';
      b.box(m, 'Mesa', [tx, 2.6, tz], [8, 0.4, 3.5], C.table);
      b.box(m, 'Pé Mesa', [tx, 1.2, tz], [1, 2.4, 1], C.steel);
      b.box(m, 'Banco', [tx, 1.4, tz - 2.8], [8, 0.4, 1.2], C.table);
      b.box(m, 'Banco', [tx, 1.4, tz + 2.8], [8, 0.4, 1.2], C.table);
      b.box(m, 'Pé Banco', [tx, 0.6, tz - 2.8], [0.8, 1.2, 0.8], C.steel);
      b.box(m, 'Pé Banco', [tx, 0.6, tz + 2.8], [0.8, 1.2, 0.8], C.steel);
    }
  }

  // Zona JOGAR: portal de grades + 3 plataformas de fila
  const p = 'Átrio/Zona Jogar';
  b.span(p, 'Pilar Portal S', [38, 0, -13], [40, 14, -11], C.wallDark);
  b.span(p, 'Pilar Portal N', [38, 0, 11], [40, 14, 13], C.wallDark);
  b.span(p, 'Viga Portal', [38, 14, -13], [40, 17, 13], C.wallDark, {
    label: { text: 'FUGA ▶ JOGAR', face: 'Left', color: [120, 255, 140] },
  });
  [[-7, C.padGreen, 'Fila 1'], [0, C.padYellow, 'Fila 2'], [7, C.padRed, 'Fila 3']].forEach(([z, color, name]) => {
    b.box(p, `${name} Moldura`, [46, 0.15, z], [6.4, 0.3, 6.4], C.steel);
    b.box(p, name, [46, 0.4, z], [5.6, 0.3, 5.6], color, {
      light: { range: 10, brightness: 0.8, color },
    });
    b.box(p, `${name} Placa`, [50, 4, z], [0.4, 2, 5], C.plaque, {
      label: { text: name.toUpperCase(), face: 'Left', color: [255, 255, 255] },
    });
    b.box(p, `${name} Suporte`, [50, 1.5, z], [0.4, 3, 0.4], C.steel);
  });

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
  // Rx * Ry * Rz
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
