// Visualizador Three.js do Reino. Lê o mesmo src/map.js que gera o lugar do Roblox.
// Usado no navegador (GitHub Pages / prévia do PR) e pelo CI para gerar as capturas.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildMap, PLOTS, LAKE, DIM } from '../src/map.js';
import { stats as countStats } from '../src/builder.js';
import { buildManual } from '../src/manual.js';

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

// Studs clássicos no topo das peças: textura de 1 stud aplicada em coordenadas de mundo
// (assim tudo continua instanciado e o CI renderiza rápido).
function studTexture() {
  const n = 64;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2f2';
  g.fillRect(0, 0, n, n);
  g.strokeStyle = '#d6d6d6';
  g.lineWidth = 2;
  g.strokeRect(1, 1, n - 2, n - 2);
  const cx = n / 2;
  const r = n * 0.28;
  const disc = (dx, dy, color, rr = r) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(cx + dx, cx + dy, rr, 0, Math.PI * 2);
    g.fill();
  };
  disc(3, 3, '#a9a9a9');
  disc(-2, -2, '#ffffff');
  disc(0, 0, '#e4e4e4', r * 0.9);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const STUD_TEX = studTexture();

function addStuds(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.studMap = { value: STUD_TEX };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vStudUv;\nvarying float vStudTop;')
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'vec4 studWorld = vec4(transformed, 1.0);',
          '#ifdef USE_INSTANCING',
          '  studWorld = instanceMatrix * studWorld;',
          '#endif',
          'studWorld = modelMatrix * studWorld;',
          'vStudUv = studWorld.xz;',
          'vStudTop = normal.y;',
        ].join('\n'),
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D studMap;\nvarying vec2 vStudUv;\nvarying float vStudTop;',
      )
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\nif (vStudTop > 0.5) diffuseColor.rgb *= texture2D(studMap, vStudUv).rgb;',
      );
  };
  m.customProgramCacheKey = () => 'studs';
  return m;
}

// ---------------------------------------------------------------------------
// Parts -> malhas instanciadas (uma por grupo + cor + aparência)
// ---------------------------------------------------------------------------
const { parts, landmarks } = buildMap();
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const srgb = ([r, g, b]) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
const cache = new Map();

function material(p) {
  const k = `${p.color}|${p.transparency}|${p.material}|${p.studs}|${p.name === 'Mar'}`;
  if (cache.has(k)) return cache.get(k);
  const wet = p.name === 'Mar' || p.name.startsWith('Água');
  const m = new THREE.MeshStandardMaterial({
    color: srgb(p.color),
    roughness: wet ? 0.3 : 0.82,
    metalness: wet ? 0.05 : 0,
    transparent: p.transparency > 0,
    opacity: 1 - p.transparency,
    depthWrite: p.transparency === 0,
  });
  if (p.studs) addStuds(m);
  cache.set(k, m);
  return m;
}

const manual = buildManual(parts);
const stepOf = new Array(parts.length);
for (const st of manual.steps) for (const i of st.parts) stepOf[i] = st.n;

const buckets = new Map();
parts.forEach((p, i) => {
  const k = `${p.group}|${p.color}|${p.transparency}|${p.material}|${p.studs}`;
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
const OVERVIEW = { pos: [560, 540, 760], target: [-20, 0, 40] };
const plot = [...PLOTS].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
const VIEWS = [
  { id: 'overview', title: 'Visão geral do reino', ...OVERVIEW },
  { id: 'top', title: 'Mapa visto de cima (30 lotes, estradas, rio e lago)', pos: [0, 1300, 140], target: [0, 0, 0] },
  { id: 'lobby', title: 'Lobby: estátua do rei, mercado e colunas antigas', ...look(0, 0, 78, 48, 96, 10) },
  { id: 'market', title: 'Mercado do Lobby (altura do jogador)', pos: [0, 17, 40], target: [0, 13, 0] },
  { id: 'lobby-stairs', title: 'Escadaria de madeira do Lobby', pos: [74, 17, 26], target: [44, 8, 0] },
  { id: 'plot', title: `${plot.name}: fundação do castelo`, ...look(plot.x, plot.z, 52, 34, 62, 5) },
  {
    id: 'plots',
    title: 'Lotes espalhados pelo mapa',
    pos: [plot.x * 0.3 + 220, 260, plot.z * 0.3 + 260],
    target: [plot.x, 0, plot.z],
  },
];
const add = (v) => v && VIEWS.push(v);
if (landmarks.bridges.length) {
  const [x, z, axis] = landmarks.bridges[0];
  add({
    id: 'bridge',
    title: 'Ponte de madeira sobre o rio',
    ...(axis === 'x' ? look(x, z, 18, 24, 46) : look(x, z, 46, 24, 18)),
  });
  add({
    id: 'bridge-walk',
    title: 'Atravessando a ponte (altura do jogador)',
    pos: axis === 'x' ? [x - 26, 12, z] : [x, 12, z - 26],
    target: axis === 'x' ? [x + 20, 7, z] : [x, 7, z + 20],
  });
}
add({ id: 'lake', title: 'Lago e rio', ...look(LAKE.x, LAKE.z, 120, 80, -100, 0) });
if (landmarks.groves.green) {
  const [x, z] = landmarks.groves.green;
  add({ id: 'forest', title: 'Floresta', ...look(x, z, 62, 40, 62, 8) });
}
if (landmarks.groves.autumn) {
  const [x, z] = landmarks.groves.autumn;
  add({ id: 'autumn', title: 'Bosque de outono', ...look(x, z, 62, 40, 62, 8) });
}
const mesa = landmarks.mesas.find((m) => m[3]) ?? landmarks.mesas[0];
if (mesa) add({ id: 'mesa', title: 'Planalto de rocha com escadaria', ...look(mesa[0], mesa[1], -70, 34, 40, 10) });
if (landmarks.farms.length) {
  const [x, z] = landmarks.farms[0];
  add({ id: 'farm', title: 'Campo de trigo', ...look(x, z, 34, 22, 38, 3) });
}
const mine = landmarks.mines.find((m) => m[2] === 'ouro') ?? landmarks.mines[0];
if (mine) add({ id: 'mine', title: 'Jazida de ouro', ...look(mine[0], mine[1], 24, 18, 28, 4) });
if (landmarks.docks.length) {
  const [x, z, axis, dir] = landmarks.docks[0];
  const out = (t) => (axis === 'x' ? [x + dir * t, z] : [x, z + dir * t]);
  const [tx, tz] = out(20);
  add({ id: 'dock', title: 'Cais e barco na praia', ...look(tx, tz, 34, 20, 34, 2) });
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

setView(new URLSearchParams(location.hash.slice(1)).get('view') || 'overview');
window.__reino = {
  ready: true,
  views: VIEWS.map(({ id, title }) => ({ id, title })),
  setView,
  stats: s,
  manual: { parts: manual.parts, steps: manual.steps.length, connections: manual.connections },
};
