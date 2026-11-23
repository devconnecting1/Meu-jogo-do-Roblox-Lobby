// Paleta neutra da prisão. Regra (testada): saturação HSV <= 0.3 em todas as cores.
// Mude tons aqui, nunca espalhe RGB solto pelo layout.

export const C = Object.freeze({
  // Envoltória e paredes
  wall: [212, 208, 200], // reboco claro, levemente quente
  wallTrim: [150, 147, 140], // friso / faixa de parede
  wainscot: [112, 110, 106], // rodapé alto
  ceiling: [70, 72, 76], // teto de concreto escuro
  beam: [92, 94, 98], // vigas
  column: [172, 170, 164],
  columnBase: [96, 96, 98],

  // Pisos
  floor: [128, 128, 126], // laje de concreto
  floorAtrium: [146, 146, 142], // piso do átrio (studs)
  floorCorridor: [166, 164, 158],
  floorCatwalk: [118, 120, 122],
  curb: [66, 68, 72], // meio-fio / rodapé de vidro (studs)

  // Metal e vidro
  steel: [58, 60, 64],
  steelLight: [140, 142, 146],
  glass: [196, 206, 212],
  mirror: [186, 192, 196],

  // Celas
  facade: [104, 108, 114],
  cellWall: [224, 222, 216],
  cellBack: [140, 144, 148],
  cellFloor: [176, 174, 168],
  sheet: [226, 224, 218],
  blanket: [110, 114, 120],
  porcelain: [234, 234, 232],

  // Madeira e escada
  wood: [128, 110, 92],
  woodDark: [86, 74, 62],
  stair: [138, 136, 130],
  stairNose: [190, 182, 160],

  // Luz
  neon: [255, 246, 228], // branco quente das lâmpadas
});

/** Saturação HSV (0..1) de uma cor [r,g,b]. */
export function saturation([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}
