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

  // Bandeiras e toldos
  banner: [164, 84, 76],
  bannerDark: [124, 68, 62],
  awningBlue: [96, 120, 150],
  awningOlive: [150, 146, 96],
  cloth: [226, 222, 210],
});

/** Saturação HSV (0..1) de uma cor [r,g,b]. */
export function saturation([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}
