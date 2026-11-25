// Visualizador Three.js do Reino. Lê o mesmo src/map.js que gera o lugar do Roblox.
// Usado no navegador (GitHub Pages / prévia do PR) e pelo CI para gerar as capturas.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWorld, SEED, DIM } from '../src/map.js';
import { stats as countStats } from '../src/builder.js';
import { buildManual } from '../src/manual.js';
import { isWet, surfaceMaterial } from './surfaces.js';

// ---------------------------------------------------------------------------
// Cena: dia claro, sol com sombra e neblina leve (como o Lighting do Roblox)
// ---------------------------------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
app.appendChild(renderer.domElement);

const SKY = 0xaecbe0;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.FogExp2(0xc4d6e2, 0.00062);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 6000);

scene.add(new THREE.HemisphereLight(0xe4eef6, 0x6e6654, 1.15));
const sun = new THREE.DirectionalLight(0xfff3e0, 2.1);
sun.position.set(380, 620, 260);
sun.target.position.set(0, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -720, right: 720, top: 720, bottom: -720, near: 50, far: 1800 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);

// ---------------------------------------------------------------------------
// Parts -> malhas instanciadas (uma por grupo + cor + material + aparência)
// ---------------------------------------------------------------------------
// Aparência (viewer/surfaces.js): material do Roblox desenhado por shader em coordenadas da peça
// (Grass, Cobblestone, WoodPlanks, Brick...) e studs no topo das peças Plastic; tudo instanciado.
// #seed=123 mostra outra variante do mapa (cada servidor do jogo usa uma semente)
const params = new URLSearchParams(location.hash.slice(1));
const seed = Number(params.get('seed')) || SEED;
const world = createWorld(seed);
const { PLOTS, PADS, PONDS } = world;
const { parts } = world.buildMap();
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const cache = new Map();
const lookKey = (p) => `${p.color}|${p.transparency}|${p.material}|${p.studs}|${isWet(p)}`;

function material(p) {
  const k = lookKey(p);
  if (!cache.has(k)) cache.set(k, surfaceMaterial(p));
  return cache.get(k);
}

const manual = buildManual(parts);
const stepOf = new Array(parts.length);
for (const st of manual.steps) for (const i of st.parts) stepOf[i] = st.n;

const buckets = new Map();
parts.forEach((p, i) => {
  const k = `${p.group}|${lookKey(p)}`;
  if (!buckets.has(k)) buckets.set(k, []);
  buckets.get(k).push({ p, i });
});
const instanced = []; // { mesh, items: [{ i, matrix }] }
const tmp = new THREE.Object3D();
for (const list of buckets.values()) {
  const p0 = list[0].p;
  const mesh = new THREE.InstancedMesh(unitBox, material(p0), list.length);
  const entry = { mesh, items: [] };
  list.forEach(({ p, i }, k) => {
    tmp.position.fromArray(p.position);
    tmp.scale.fromArray(p.size);
    tmp.rotation.set(...(p.rotation ?? [0, 0, 0]).map(THREE.MathUtils.degToRad), 'XYZ');
    tmp.updateMatrix();
    mesh.setMatrixAt(k, tmp.matrix);
    entry.items.push({ i, matrix: tmp.matrix.clone() });
  });
  mesh.castShadow = p0.transparency === 0 && p0.name !== 'Mar';
  mesh.receiveShadow = true;
  if (p0.transparency > 0) mesh.renderOrder = 2;
  mesh.frustumCulled = false; // a caixa de cada lote de instâncias cobre o mapa inteiro
  scene.add(mesh);
  instanced.push(entry);
}

// ---------------------------------------------------------------------------
// Vistas (também usadas pelo CI para as capturas)
// ---------------------------------------------------------------------------
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.maxDistance = 2200;
orbit.maxPolarAngle = Math.PI * 0.49;

const look = (x, z, dx, h, dz, ty = 4) => ({ pos: [x + dx, h, z + dz], target: [x, ty, z] });
const OVERVIEW = { pos: [380, 360, 500], target: [-10, 0, 20] };
const plot = [...PLOTS].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
const pad = PADS[0];
const VIEWS = [
  { id: 'overview', title: 'Visão geral do Vale', ...OVERVIEW },
  {
    id: 'top',
    title: 'Vale visto de cima (Lobby, áreas, 30 lotes, estradas e lagoas)',
    pos: [0, 820, 90],
    target: [0, 0, 0],
  },
  { id: 'lobby', title: 'Lobby: praça de pedra com o estrado no meio', ...look(0, 0, 60, 52, 80, 4) },
  { id: 'lobby-walk', title: 'Chegando na praça (altura do jogador)', pos: [0, 9, 74], target: [0, 6, 0] },
  { id: 'pads', title: 'Áreas de construção em volta da praça', ...look(pad.x, pad.z, 40, 34, 46, 4) },
  { id: 'plot', title: `${plot.name}: lote do castelo`, ...look(plot.x, plot.z, 40, 30, 48, 4) },
  {
    id: 'road',
    title: 'Estrada de terra (altura do jogador)',
    pos: [plot.x * 0.55, 10, plot.z * 0.55 + 6],
    target: [plot.x, 5, plot.z],
  },
];
const add = (v) => v && VIEWS.push(v);
// penhasco mais alto: câmera dentro do vale olhando para a parede de rocha
{
  let best = null;
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    const r = world.valleyR(Math.cos(a) * 200, Math.sin(a) * 200);
    const h = world.heightAt(Math.cos(a) * (r + 30), Math.sin(a) * (r + 30));
    if (!best || h > best.h) best = { a, r, h };
  }
  const [cx, cz] = [Math.cos(best.a), Math.sin(best.a)];
  add({
    id: 'cliffs',
    title: 'Penhascos de rocha em blocos cercando o vale',
    pos: [cx * (best.r - 90), 22, cz * (best.r - 90)],
    target: [cx * (best.r + 20), best.h * 0.6, cz * (best.r + 20)],
  });
}
if (PONDS.length) {
  const [p] = PONDS;
  add({ id: 'pond', title: 'Lagoa com passagem de pedra', ...look(p.x, p.z, p.r * 1.6, 34, p.r * 1.8, 2) });
}
VIEWS.push(
  { id: 'build-25', title: 'Montagem — 25% das etapas', ...OVERVIEW, step: 0.25 },
  { id: 'build-50', title: 'Montagem — 50% das etapas', ...OVERVIEW, step: 0.5 },
  { id: 'build-75', title: 'Montagem — 75% das etapas', ...OVERVIEW, step: 0.75 },
);

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const stepInput = document.getElementById('step');
const stepLabel = document.getElementById('step-label');
stepInput.max = String(manual.steps.length);
function setStep(n) {
  const k = Math.max(1, Math.min(manual.steps.length, Math.round(n)));
  for (const { mesh, items } of instanced) {
    items.forEach(({ i, matrix }, idx) => mesh.setMatrixAt(idx, stepOf[i] <= k ? matrix : ZERO));
    mesh.instanceMatrix.needsUpdate = true;
  }
  stepInput.value = String(k);
  const st = manual.steps[k - 1];
  stepLabel.textContent = `Etapa ${k}/${manual.steps.length} · ${st.phaseTitle}`;
}
stepInput.oninput = () => setStep(Number(stepInput.value));

function setView(id) {
  const v = VIEWS.find((x) => x.id === id);
  if (!v) return;
  camera.position.fromArray(v.pos);
  orbit.target.fromArray(v.target);
  orbit.update();
  setStep(v.step ? v.step * manual.steps.length : manual.steps.length);
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === id));
}

const viewsEl = document.getElementById('views');
for (const v of VIEWS.filter((x) => !x.step)) {
  const b = document.createElement('button');
  b.dataset.view = v.id;
  b.textContent = v.title.split(/ \(|:/)[0];
  b.onclick = () => setView(v.id);
  viewsEl.appendChild(b);
}
document.getElementById('toggle').onclick = () => document.getElementById('hud').classList.toggle('collapsed');

// ---------------------------------------------------------------------------
// Painel e loop
// ---------------------------------------------------------------------------
const s = countStats(parts);
document.getElementById('stats').textContent =
  `${s.total} peças · ${manual.steps.length} etapas · ${manual.connections} conexões verificadas · ` +
  `${PLOTS.length} lotes (${DIM.players} jogadores + ${DIM.bots} bots)`;

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.setAnimationLoop(() => {
  orbit.update();
  renderer.render(scene, camera);
});

setView(params.get('view') || 'overview');
window.__reino = {
  ready: true,
  seed,
  views: VIEWS.map(({ id, title }) => ({ id, title })),
  setView,
  stats: s,
  manual: { parts: manual.parts, steps: manual.steps.length, connections: manual.connections },
};
