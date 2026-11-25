// O que vai para o Roblox: modelo Rojo e projeto (Lighting de dia, sem scripts/UI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMap } from '../src/map.js';
import { toRojoModel, partJson, ENUM } from '../src/rojo.js';
import { rotationMatrix } from '../src/builder.js';

const { parts } = buildMap();
const model = toRojoModel(parts);
const project = JSON.parse(readFileSync(new URL('../default.project.json', import.meta.url), 'utf8'));

function flatten(node, out = []) {
  if (node.className !== 'Model') out.push(node);
  for (const c of node.children ?? []) flatten(c, out);
  return out;
}

test('o modelo Rojo contém exatamente as Parts do mapa (+ luzes)', () => {
  const nodes = flatten(model);
  const partNodes = nodes.filter((n) => ['Part', 'SpawnLocation'].includes(n.className));
  assert.equal(partNodes.length, parts.length);
  const lights = nodes.filter((n) => /Light$/.test(n.className));
  assert.equal(lights.length, parts.filter((p) => p.light).length);
  const classes = new Set(nodes.map((n) => n.className));
  for (const c of classes) assert.ok(['Part', 'SpawnLocation', 'PointLight', 'SurfaceLight'].includes(c), c);
});

test('propriedades Roblox corretas (material, shape, studs em cima, inlet embaixo, ancorado)', () => {
  for (const p of parts) {
    const n = partJson(p);
    assert.equal(n.properties.Anchored, true);
    assert.equal(n.properties.Material.Enum, ENUM.Material[p.material]);
    assert.equal(n.properties.Shape.Enum, ENUM.PartType[p.shape]);
    const relief = ENUM.SurfaceType[p.surface ?? 'Smooth'];
    assert.equal(n.properties.TopSurface.Enum, p.studs ? ENUM.SurfaceType.Studs : relief);
    assert.equal(n.properties.BottomSurface.Enum, p.studs ? ENUM.SurfaceType.Inlet : ENUM.SurfaceType.Smooth);
    for (const s of ['FrontSurface', 'BackSurface', 'LeftSurface', 'RightSurface']) {
      assert.equal(n.properties[s].Enum, relief, `${p.name}: ${s}`);
    }
    assert.equal(n.properties.CanCollide, p.canCollide);
    assert.deepEqual(n.properties.Size, p.size);
    assert.deepEqual(n.properties.CFrame.CFrame.position, p.position);
  }
});

test('orientação do CFrame é uma rotação válida (ortonormal)', () => {
  for (const p of parts.filter((x) => x.rotation)) {
    const m = rotationMatrix(p.rotation);
    for (let r = 0; r < 3; r++) {
      const row = m.slice(r * 3, r * 3 + 3);
      assert.ok(Math.abs(Math.hypot(...row) - 1) < 1e-5, `${p.name}: linha ${r}`);
    }
  }
});

test('projeto: Lighting Future, dia claro e efeitos sutis', () => {
  const L = project.tree.Lighting;
  const P = L.$properties;
  assert.equal(P.Technology.Enum, 4, 'Technology = Future');
  assert.ok(P.ClockTime >= 9 && P.ClockTime <= 16, `ClockTime ${P.ClockTime} não é dia`);
  assert.ok(P.Brightness >= 1 && P.Brightness <= 3, `Brightness ${P.Brightness}`);
  for (const k of ['Ambient', 'OutdoorAmbient']) {
    for (const v of P[k]) assert.ok(v <= 0.6, `${k} = ${P[k]} (máximo 0,6: nada estoura com gráficos baixos)`);
  }
  assert.ok(P.ExposureCompensation <= 0.2, `ExposureCompensation = ${P.ExposureCompensation}`);
  assert.equal(L['Correcao de Cor'].$className, 'ColorCorrectionEffect');
  assert.ok(L['Correcao de Cor'].$properties.Saturation <= 0, 'correção de cor não pode saturar (cores neutras)');
  assert.equal(L['Brilho'].$className, 'BloomEffect');
  assert.ok(L['Brilho'].$properties.Intensity <= 0.3, 'bloom forte demais');
  assert.equal(L['Neblina Leve'].$className, 'Atmosphere');
  assert.equal(L['Raios de Sol'].$className, 'SunRaysEffect');
  assert.ok(L['Raios de Sol'].$properties.Intensity <= 0.1, 'raios de sol fortes demais');
  const atm = L['Neblina Leve'].$properties;
  assert.ok(atm.Density >= 0.2 && atm.Density <= 0.4, 'neblina: o horizonte some suave, mas o mapa continua visível');
});

test('projeto: um mapa fixo no Workspace, sem scripts nem mapas extras', () => {
  const services = Object.keys(project.tree).filter((k) => !k.startsWith('$'));
  assert.deepEqual(services.sort(), ['Lighting', 'Workspace']);
  assert.equal(project.tree.Workspace['Reino'].$path, 'build/Reino.model.json');
  const raw = JSON.stringify(project.tree.Lighting) + JSON.stringify(project.tree.Workspace);
  for (const banned of ['Gui', 'Humanoid', 'Sky"']) assert.ok(!raw.includes(banned), `projeto tem ${banned}`);
});
