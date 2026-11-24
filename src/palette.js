// Paleta neutra da prisão. Regra (testada): saturação HSV <= 0.3 em todas as cores.
// Mude tons aqui, nunca espalhe RGB solto pelo layout.

export const C = Object.freeze({
  // Envoltória e paredes
  wall: [206, 202, 193], // reboco claro, levemente quente (sem estourar com pouca qualidade gráfica)
  wallTrim: [168, 164, 156], // friso / faixa de parede
  wainscot: [112, 110, 105], // rodapé alto (superfície Inlet)
  ceiling: [104, 106, 110], // teto de concreto
  beam: [126, 128, 132], // vigas
  column: [184, 181, 174],
  columnBase: [120, 120, 122],

  // Pisos
  floor: [154, 154, 150], // laje de concreto
  floorAtrium: [166, 165, 160], // piso do átrio (studs), tom claro do xadrez
  floorAtriumDark: [122, 122, 120], // tom escuro do xadrez
  floorCorridor: [176, 174, 168],
  floorCatwalk: [156, 158, 160],
  curb: [86, 88, 92], // meio-fio / rodapé de vidro (studs)

  // Metal e vidro
  steel: [58, 60, 64],
  steelLight: [162, 164, 168],
  glass: [196, 206, 212],
  mirror: [186, 192, 196],

  // Celas
  facade: [124, 128, 134],
  cellWall: [210, 207, 200],
  cellBack: [164, 168, 172],
  cellFloor: [180, 178, 172],
  sheet: [226, 224, 218],
  blanket: [110, 114, 120],
  porcelain: [234, 234, 232],

  // Madeira e escada
  wood: [128, 110, 92],
  woodDark: [86, 74, 62],
  stair: [138, 136, 130],
  stairNose: [190, 182, 160],

  // Túnel e portões de emergência
  tunnel: [132, 132, 130], // concreto do túnel
  hazard: [214, 198, 156], // faixa de alerta (amarelo-pedra, neutro)

  // Abandono: entulho, umidade, mofo e ferrugem (ainda neutros: saturação <= 0,3)
  debris: [116, 113, 107],
  debrisDark: [74, 73, 70],
  grime: [66, 70, 68], // mancha de umidade
  mold: [84, 94, 86], // mofo esverdeado
  rust: [112, 92, 80], // ferrugem dessaturada
  puddle: [40, 46, 46], // poça d'água parada
  lampDead: [84, 86, 88], // lâmpada queimada (Plastic, sem luz)

  // Luz
  neon: [255, 246, 228], // branco quente das lâmpadas
  neonCold: [214, 232, 226], // fluorescente velha, fria (clima de abandono)
  neonWarn: [255, 230, 196], // lâmpada de alerta do portão
});

/** Saturação HSV (0..1) de uma cor [r,g,b]. */
export function saturation([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}
