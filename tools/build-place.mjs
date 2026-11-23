#!/usr/bin/env node
// Gera build/Lobby.model.json (formato Rojo) a partir de src/lobby.js.
// Depois, `rojo build -o build/lobby.rbxl` monta o lugar usando default.project.json.
//
// Uso: node tools/build-place.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLobby, rotationMatrix, stats } from '../src/lobby.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'build/Lobby.model.json');

const ENUM = {
  Material: { Plastic: 256, SmoothPlastic: 272, Neon: 288 },
  PartType: { Ball: 0, Block: 1, Cylinder: 2 },
  Smooth: 0,
  Studs: 3,
  PixelsPerStud: 1,
  NormalId: { Right: 0, Top: 1, Back: 2, Left: 3, Bottom: 4, Front: 5 },
};

const c3 = ([r, g, b]) => [r / 255, g / 255, b / 255].map((v) => Math.round(v * 1e4) / 1e4);

function partJson(p) {
  const m = rotationMatrix(p.rotation);
  const properties = {
    Anchored: true,
    CanCollide: p.canCollide,
    CastShadow: p.transparency < 0.5 && p.material !== 'Neon',
    Size: p.size,
    CFrame: {
      CFrame: {
        position: p.position,
        orientation: [m.slice(0, 3), m.slice(3, 6), m.slice(6, 9)],
      },
    },
    Color: c3(p.color),
    Material: { Enum: ENUM.Material[p.material] ?? ENUM.Material.Plastic },
    Shape: { Enum: ENUM.PartType[p.shape] ?? ENUM.PartType.Block },
    Transparency: p.transparency,
    TopSurface: { Enum: p.studs ? ENUM.Studs : ENUM.Smooth },
    BottomSurface: { Enum: ENUM.Smooth },
    FrontSurface: { Enum: ENUM.Smooth },
    BackSurface: { Enum: ENUM.Smooth },
    LeftSurface: { Enum: ENUM.Smooth },
    RightSurface: { Enum: ENUM.Smooth },
  };
  if (p.className === 'SpawnLocation') {
    properties.Neutral = true;
    properties.Duration = 0;
  }
  const children = [];
  if (p.light) {
    children.push({
      name: 'Luz',
      className: 'PointLight',
      properties: { Brightness: p.light.brightness, Range: p.light.range, Color: c3(p.light.color), Shadows: false },
    });
  }
  if (p.label) {
    children.push({
      name: 'Texto',
      className: 'SurfaceGui',
      properties: {
        Face: { Enum: ENUM.NormalId[p.label.face] ?? 5 },
        SizingMode: { Enum: ENUM.PixelsPerStud },
        PixelsPerStud: 50,
        LightInfluence: 0,
      },
      children: [
        {
          name: 'Rotulo',
          className: 'TextLabel',
          properties: {
            Size: { UDim2: [[1, 0], [1, 0]] },
            BackgroundTransparency: 1,
            Text: p.label.text,
            TextScaled: true,
            TextColor3: c3(p.label.color ?? [255, 255, 255]),
            FontFace: {
              Font: { family: 'rbxasset://fonts/families/SourceSansPro.json', weight: 'Bold', style: 'Normal' },
            },
          },
        },
      ],
    });
  }
  const node = { name: p.name, className: p.className, properties };
  if (children.length) node.children = children;
  return node;
}

// Agrupa as Parts em Models seguindo o caminho "A/B/C".
function buildTree(parts) {
  const rootNode = { className: 'Model', children: [] };
  const index = new Map([['', rootNode]]);
  for (const p of parts) {
    let path = '';
    let parent = rootNode;
    for (const seg of p.model.split('/')) {
      path += '/' + seg;
      if (!index.has(path)) {
        const m = { name: seg, className: 'Model', children: [] };
        parent.children.push(m);
        index.set(path, m);
      }
      parent = index.get(path);
    }
    parent.children.push(partJson(p));
  }
  return rootNode;
}

const { parts } = buildLobby();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(buildTree(parts)));
const s = stats(parts);
console.log(`✔ build/Lobby.model.json — ${s.total} Parts (Plastic + Neon, studs só nos pisos, sem texturas)`);
