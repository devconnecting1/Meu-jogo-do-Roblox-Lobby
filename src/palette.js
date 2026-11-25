// Paleta do Reino (estilo clássico do Roblox, como as referências, mas em tons neutros).
// Regra (testada): toda Part usa uma cor desta paleta e a saturação HSV fica <= 0,55
// (cores com vida, porém foscas: nada de verde-limão, rosa ou roxo berrante).
// Mude tons aqui, nunca espalhe RGB solto.

export const C = Object.freeze({
  // Mar, rio e lago
  sea: [78, 122, 160],
  water: [92, 140, 172], // rio e lago (um pouco mais claro, transparente)

  // Terreno
  grass: [86, 140, 70], // gramado
  grassDark: [70, 120, 58],
  dirt: [104, 112, 124], // corpo do terreno (rocha azulada, como nas referências)
  sand: [214, 194, 146], // praia
  rock: [112, 118, 132], // planaltos, penhascos e pedras
  rockDark: [84, 90, 104],

  // Estradas, praça e lotes
  road: [124, 128, 138], // estrada de pedra
  plaza: [196, 190, 180], // piso claro da praça (como o piso de studs das referências)
  plazaDark: [150, 146, 138],
  plotStone: [182, 178, 168], // fundação dos lotes de castelo
  plotKerb: [126, 122, 114],
  statue: [168, 166, 160], // estátua e pilares antigos

  // Madeira (pontes, cais, troncos, barracas)
  wood: [128, 92, 62],
  woodDark: [96, 68, 46],
  trunk: [112, 80, 56],
  crate: [150, 118, 86],

  // Vegetação
  leaf: [66, 128, 62],
  leafDark: [50, 104, 50],
  leafLight: [96, 150, 78],
  autumn: [196, 134, 92], // árvores de outono (laranja fosco)
  autumnDark: [164, 110, 76],
  bush: [74, 132, 64],
  flowerRed: [168, 82, 76],
  flowerYellow: [206, 182, 104],

  // Recursos do mapa (futuros pontos de coleta)
  soil: [116, 86, 60], // campo arado
  wheat: [214, 186, 102],
  gold: [210, 178, 100],
  stoneOre: [150, 154, 164],

  // Mais árvores
  pine: [56, 98, 70], // pinheiros
  pineDark: [42, 80, 56],
  birchBark: [214, 210, 200], // bétula (tronco claro)
  birchLeaf: [150, 176, 98],
  blossom: [204, 160, 160], // cerejeira (rosa fosco)
  blossomDark: [180, 136, 138],
  palmLeaf: [104, 150, 84], // coqueiros da praia
  palmTrunk: [150, 124, 92],
  deadWood: [120, 108, 96], // árvore seca
  hay: [206, 182, 110], // feno

  // Biomas: região seca (areia de terra firme e rocha avermelhada) e falésias claras na costa
  desertSand: [206, 182, 136],
  rockDesert: [168, 132, 104],
  cliff: [196, 190, 176],

  // Montanhas e trilhas
  snow: [232, 234, 236],
  path: [150, 134, 110], // trilha de terra batida

  // Construções da vila
  plaster: [218, 210, 192], // parede rebocada
  timber: [92, 70, 52], // enxaimel (vigas aparentes)
  brick: [160, 110, 92],
  roofRed: [150, 84, 72],
  roofSlate: [96, 104, 118],
  roofThatch: [184, 160, 110],
  roofGreen: [88, 112, 92], // telhado da taverna (verde-musgo fosco)
  statueDark: [128, 128, 124],
  iron: [64, 66, 72], // ferro escuro (lampião, bigorna, ferragens)

  // Bandeiras e toldos
  banner: [164, 84, 76],
  bannerDark: [124, 68, 62],
  awningBlue: [96, 120, 150],
  awningOlive: [150, 146, 96],
  cloth: [226, 222, 210],

  // Terreno do Vale (estilo voxel pixelado, blocos lisos): tons quentes e foscos
  pxGrass: [108, 156, 72],
  pxGrassDark: [88, 132, 60],
  pxDirt: [120, 84, 56], // estradas de terra
  pxDirtDark: [96, 66, 46],
  pxSoil: [92, 64, 44], // lateral do chão (terra por baixo da grama)
  pxStone: [204, 184, 148], // pedra clara da praça
  pxStoneDark: [150, 128, 98],
  pxPad: [150, 112, 78], // piso das áreas de construção e dos lotes
  pxPadEdge: [118, 108, 94], // borda de pedra das áreas e lotes
  pxCliff: [146, 98, 66], // penhascos de rocha
  pxCliffDark: [112, 74, 52],
  pxCliffLight: [168, 118, 82],
  pxMoss: [92, 128, 62],
  pxWater: [86, 150, 170],

  // Construções do Vale (voxel liso): madeira, reboco, pedra de muro, telhados, ferro, tecidos e luz
  pxWood: [128, 88, 58],
  pxWoodDark: [92, 62, 44],
  pxWoodLight: [164, 122, 82],
  pxPlaster: [214, 198, 168],
  pxStoneWall: [140, 132, 120],
  pxStoneWallDark: [104, 98, 90],
  pxRoofRed: [148, 82, 68],
  pxRoofSlate: [76, 88, 98],
  pxRoofTeal: [64, 104, 104],
  pxThatch: [196, 160, 98],
  pxIron: [70, 70, 76],
  pxGold: [200, 168, 92],
  pxClothRed: [146, 80, 68],
  pxClothBlue: [78, 98, 140],
  pxCream: [228, 214, 186],
  pxWindowLit: [236, 206, 124], // janela acesa (cor quente, sem Neon)
  pxFire: [232, 150, 106], // chama (Neon com luz, só em lareira/forja/tocha)
  pxBook: [120, 70, 60],
  pxHay: [206, 176, 104],
  pxIce: [170, 210, 228], // espada de gelo da estátua de Luvitlua
  pxArmor: [58, 60, 70], // armadura escura da estátua
});

/** Saturação HSV (0..1) de uma cor [r,g,b]. */
export function saturation([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}
