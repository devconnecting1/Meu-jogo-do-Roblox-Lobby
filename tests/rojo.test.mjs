// O que vai para o Roblox: modelo Rojo e projeto (Lighting, sem scripts/UI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPrison } from '../src/prison.js';
import { toRojoModel, partJson, ENUM } from '../src/rojo.js';
import { rotationMatrix } from '../src/builder.js';

const { parts } = buildPrison();
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

test('propriedades Roblox corretas (material, shape, superfícies, ancorado)', () => {
  for (const p of parts) {
    const n = partJson(p);
    assert.equal(n.properties.Anchored, true);
    assert.equal(n.properties.Material.Enum, ENUM.Material[p.material]);
    assert.equal(n.properties.Shape.Enum, ENUM.PartType[p.shape]);
    const relief = ENUM.SurfaceType[p.surface ?? 'Smooth'];
    assert.equal(n.properties.TopSurface.Enum, p.studs ? 3 : relief);
    assert.equal(n.properties.BottomSurface.Enum, 0);
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

test('projeto: Lighting Future, ambiente noturno/fechado e efeitos sutis', () => {
  const L = project.tree.Lighting;
  assert.equal(L.$properties.Technology.Enum, 4, 'Technology = Future');
  assert.equal(L.$properties.Brightness, 0, 'sem sol (ambiente fechado)');
  assert.equal(L['Correcao de Cor'].$className, 'ColorCorrectionEffect');
  assert.equal(L['Brilho das Lampadas'].$className, 'BloomEffect');
});

test('luz equilibrada: ambiente e exposição contidos, nada estoura mesmo com gráficos baixos', () => {
  const P = project.tree.Lighting.$properties;
  for (const k of ['Ambient', 'OutdoorAmbient']) {
    for (const v of P[k]) assert.ok(v <= 0.2, `${k} = ${P[k]} (máximo 0,2)`);
  }
  assert.ok(P.ExposureCompensation <= 0.1, `ExposureCompensation = ${P.ExposureCompensation}`);
  assert.ok(P.EnvironmentDiffuseScale <= 0.25, `EnvironmentDiffuseScale = ${P.EnvironmentDiffuseScale}`);
  const bloom = project.tree.Lighting['Brilho das Lampadas'].$properties;
  assert.ok(bloom.Intensity <= 0.25 && bloom.Threshold >= 1.8, 'bloom forte demais');
  // todas as luminárias no mesmo patamar: nenhuma sala fica estourada nem escura
  for (const p of parts.filter((x) => x.light)) {
    const { brightness, range } = p.light;
    assert.ok(brightness >= 0.5 && brightness <= 1.2, `${p.model}/${p.name}: brilho ${brightness}`);
    assert.ok(range <= 52, `${p.model}/${p.name}: alcance ${range}`);
  }
});

test('projeto: só Workspace + Lighting (sem scripts, UI ou NPCs)', () => {
  const services = Object.keys(project.tree).filter((k) => !k.startsWith('$'));
  assert.deepEqual(services.sort(), ['Lighting', 'Workspace']);
  assert.equal(project.tree.Workspace['Prisão'].$path, 'build/Prisao.model.json');
});
