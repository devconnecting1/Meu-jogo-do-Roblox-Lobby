// Materiais do Roblox (texturas nativas da engine, sem Decal/Texture nem upload de imagem).
// Cada cor da paleta tem o seu material, então o mapa ganha textura realista sem números soltos:
// grama com Grass, areia com Sand, pedra com Rock/Slate, estrada de paralelepípedo, madeira em
// tábuas, tijolo, tecido, neve e metal. Peças pequenas e coloridas (flores, frutas, emblemas)
// continuam em Plastic com studs, o toque clássico. O Rojo traduz o nome para o Enum.Material.
import { C } from './palette.js';

/** Enum.Material do Roblox (valores oficiais) para cada material usado no mapa. */
export const MATERIAL_ENUM = Object.freeze({
  Plastic: 256,
  SmoothPlastic: 272,
  Neon: 288,
  Wood: 512,
  WoodPlanks: 528,
  Marble: 784,
  Slate: 800,
  Concrete: 816,
  Granite: 832,
  Brick: 848,
  Pebble: 864,
  Cobblestone: 880,
  Rock: 896,
  Sandstone: 912,
  Metal: 1088,
  Grass: 1280,
  Sand: 1296,
  Fabric: 1312,
  Snow: 1328,
  Ground: 1360,
  Glass: 1568,
});

export const MATERIALS = Object.freeze(Object.keys(MATERIAL_ENUM));

const BY_COLOR = [
  // terreno
  [['grass', 'grassDark'], 'Grass'],
  [['sand', 'desertSand'], 'Sand'],
  [['snow'], 'Snow'],
  [['soil', 'path'], 'Ground'],
  [['dirt', 'rockDark'], 'Slate'],
  [['rock', 'stoneOre', 'rockDesert'], 'Rock'],
  [['cliff'], 'Sandstone'],
  // pedra trabalhada
  [['road', 'plazaDark'], 'Cobblestone'],
  [['plaza', 'plotStone', 'plotKerb'], 'Concrete'],
  [['statue'], 'Marble'],
  [['statueDark'], 'Granite'],
  [['brick', 'roofRed'], 'Brick'],
  [['roofSlate', 'roofGreen'], 'Slate'],
  [['plaster'], 'Concrete'],
  // madeira
  [['wood', 'woodDark', 'crate'], 'WoodPlanks'],
  [['trunk', 'palmTrunk', 'deadWood', 'birchBark', 'timber'], 'Wood'],
  // vegetação (folhas, palha e plantações com a textura de grama)
  [
    [
      'leaf',
      'leafDark',
      'leafLight',
      'autumn',
      'autumnDark',
      'bush',
      'pine',
      'pineDark',
      'birchLeaf',
      'blossom',
      'blossomDark',
      'palmLeaf',
      'wheat',
      'hay',
      'roofThatch',
    ],
    'Grass',
  ],
  // tecidos e metais
  [['cloth', 'banner', 'bannerDark', 'awningBlue', 'awningOlive'], 'Fabric'],
  [['iron', 'gold'], 'Metal'],
  // água
  [['water'], 'Glass'],
  [['sea'], 'SmoothPlastic'],
];

const TABLE = new Map();
for (const [keys, material] of BY_COLOR) {
  for (const k of keys) if (C[k]) TABLE.set(C[k].join(','), material);
}

/**
 * Material de uma peça. Estilo atual (regra 4 do AGENTS.md): blocos lisos em SmoothPlastic, sem
 * studs, como os mapas voxel pixelados. O Reino clássico (Plastic com studs) está guardado no branch
 * arquivo/reino-classico; as texturas "realistas" (tabela abaixo) foram rejeitadas.
 */
export function materialFor() {
  return 'SmoothPlastic';
}

export const REALISTIC_TABLE = TABLE;
