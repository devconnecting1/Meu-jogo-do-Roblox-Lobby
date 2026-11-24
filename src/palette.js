// Paleta neutra da prisão. Regra (testada): saturação HSV <= 0.3 em todas as cores.
// Mude tons aqui, nunca espalhe RGB solto pelo layout.

export const C = Object.freeze({
  // Envoltória e paredes
  wall: [234, 231, 224], // reboco claro, levemente quente
  wallTrim: [168, 164, 156], // friso / faixa de parede
  wainscot: [128, 126, 120], // rodapé alto
  ceiling: [104, 106, 110], // teto de concreto
  beam: [126, 128, 132], // vigas
  column: [200, 198, 192],
  columnBase: [120, 120, 122],

  // Pisos
  floor: [154, 154, 150], // laje de concreto
  floorAtrium: [178, 178, 174], // piso do átrio (studs)
  floorCorridor: [200, 198, 192],
  floorCatwalk: [156, 158, 160],
  curb: [86, 88, 92], // meio-fio / rodapé de vidro (studs)

  // Metal e vidro
  steel: [58, 60, 64],
  steelLight: [162, 164, 168],
  glass: [196, 206, 212],
  mirror: [186, 192, 196],

  // Celas
  facade: [124, 128, 134],
  cellWall: [238, 236, 230],
  cellBack: [164, 168, 172],
  cellFloor: [198, 196, 190],
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
