// Converte as Parts (dados puros) no formato .model.json do Rojo 7.
// Documentação do formato: https://rojo.space/docs/v7/sync-details/#json-models

import { rotationMatrix } from './builder.js';

export const ENUM = Object.freeze({
  Material: { Plastic: 256, Neon: 288 },
  PartType: { Block: 1, Cylinder: 2 },
  SurfaceType: { Smooth: 0, Weld: 2, Studs: 3, Inlet: 4, Universal: 5 },
  NormalId: { Bottom: 4 },
});

const c3 = ([r, g, b]) => [r, g, b].map((v) => Math.round((v / 255) * 1e4) / 1e4);
const SIDES = ['BottomSurface', 'FrontSurface', 'BackSurface', 'LeftSurface', 'RightSurface'];

function lightJson(light) {
  if (light.type === 'Surface') {
    return {
      name: light.flicker ? 'Luz Piscando' : 'Luz',
      className: 'SurfaceLight',
      properties: {
        Face: { Enum: ENUM.NormalId.Bottom },
        Angle: light.angle ?? 90,
        Brightness: light.brightness,
        Range: light.range,
        Color: c3(light.color),
        Shadows: true,
      },
    };
  }
  return {
    name: light.flicker ? 'Luz Piscando' : 'Luz',
    className: 'PointLight',
    properties: { Brightness: light.brightness, Range: light.range, Color: c3(light.color), Shadows: true },
  };
}

const surfaceEnum = (p) => ENUM.SurfaceType[p.surface ?? 'Smooth'];

export function partJson(p) {
  const m = rotationMatrix(p.rotation);
  const properties = {
    Anchored: true,
    CanCollide: p.canCollide,
    CanTouch: false,
    CanQuery: p.canCollide,
    CastShadow: p.transparency < 0.5 && p.material !== 'Neon',
    Size: p.size,
    CFrame: { CFrame: { position: p.position, orientation: [m.slice(0, 3), m.slice(3, 6), m.slice(6, 9)] } },
    Color: c3(p.color),
    Material: { Enum: ENUM.Material[p.material] },
    Shape: { Enum: ENUM.PartType[p.shape] },
    Transparency: p.transparency,
    TopSurface: { Enum: p.studs ? ENUM.SurfaceType.Studs : surfaceEnum(p) },
  };
  // a face de baixo fica sempre lisa (encosta no apoio); as laterais recebem o relevo clássico
  for (const s of SIDES) properties[s] = { Enum: s === 'BottomSurface' ? ENUM.SurfaceType.Smooth : surfaceEnum(p) };
  if (p.className === 'SpawnLocation') {
    properties.Neutral = true;
    properties.Duration = 0;
    properties.CanTouch = true; // necessário para o spawn funcionar
  }
  const node = { name: p.name, className: p.className, properties };
  if (p.light) node.children = [lightJson(p.light)];
  return node;
}

/** Agrupa as Parts em Models seguindo o caminho "A/B/C" (ordem estável). */
export function toRojoModel(parts) {
  const root = { className: 'Model', children: [] };
  const index = new Map([['', root]]);
  for (const p of parts) {
    let path = '';
    let parent = root;
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
  return root;
}
