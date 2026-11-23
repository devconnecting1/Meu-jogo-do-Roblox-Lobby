// Visualizador Three.js da prisão. Lê o mesmo src/prison.js que gera o lugar do Roblox.
// Usado no navegador (GitHub Pages / prévia do PR) e pelo CI para gerar as capturas.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildPrison, cellCenterX } from '../src/prison.js';
import { stats as countStats } from '../src/builder.js';
import { buildManual } from '../src/manual.js';

// ---------------------------------------------------------------------------
// Cena (ambiente interno: não existe exterior)
// ---------------------------------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x121315);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.2, 1000);

scene.add(new THREE.HemisphereLight(0xf4f1ea, 0x4a4845, 0.65));
scene.add(new THREE.AmbientLight(0xffffff, 0.3));
// "Luz de teto" difusa vinda de cima (o teto não projeta sombra no visualizador).
const ceilingLight = new THREE.DirectionalLight(0xfff6e8, 1.15);
ceilingLight.position.set(30, 200, 70);
ceilingLight.castShadow = true;
ceilingLight.shadow.mapSize.set(4096, 4096);
Object.assign(ceilingLight.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 500 });
ceilingLight.shadow.bias = -0.0004;
ceilingLight.shadow.normalBias = 0.4;
scene.add(ceilingLight);

// Simula a superfície Studs do Roblox (só no navegador).
function studTexture() {
  const n = 64;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e8e8';
  g.fillRect(0, 0, n, n);
  const cx = n / 2, r = n * 0.3;
  g.fillStyle = '#b8b8b8';
  g.beginPath(); g.arc(cx + 3, cx + 3, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(cx - 2, cx - 2, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#dcdcdc';
  g.beginPath(); g.arc(cx, cx, r * 0.92, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const STUD_TEX = studTexture();

// ---------------------------------------------------------------------------
// Parts -> malhas
// ---------------------------------------------------------------------------
const { parts } = buildPrison();
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 40).rotateZ(Math.PI / 2); // eixo X, como no Roblox
const groups = new Map();
const cache = new Map();
const srgb = ([r, g, b]) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
const NO_SHADOW_GROUPS = new Set(['Teto', 'Iluminação']);

function material(p, studs = false) {
  const k = `${p.color}|${p.transparency}|${p.material}|${studs}`;
  if (cache.has(k)) return cache.get(k);
  const color = srgb(p.color);
  const neon = p.material === 'Neon';
  const m = new THREE.MeshStandardMaterial({
    color,
    map: studs ? STUD_TEX : null,
    roughness: 0.78,
    metalness: 0,
    transparent: p.transparency > 0,
    opacity: 1 - p.transparency,
    depthWrite: p.transparency === 0,
    emissive: neon ? color : new THREE.Color(0),
    emissiveIntensity: neon ? 1.6 : 0,
  });
  cache.set(k, m);
  return m;
}

function groupNode(name) {
  if (!groups.has(name)) {
    const g = new THREE.Group();
    g.name = name;
    scene.add(g);
    groups.set(name, g);
  }
  return groups.get(name);
}

function studGeometry([sx, , sz]) {
  const g = unitBox.clone();
  const uv = g.attributes.uv;
  for (let i = 8; i < 12; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sz); // face +Y
  return g;
}

const manual = buildManual(parts);
const stepOf = new Array(parts.length);
for (const st of manual.steps) for (const i of st.parts) stepOf[i] = st.n;
const singles = []; // { mesh, i }
const instanced = []; // { mesh, items: [{ i, matrix }] }

const castsShadow = (p) => p.transparency < 0.5 && p.material !== 'Neon' && !NO_SHADOW_GROUPS.has(p.group);
const buckets = new Map();
const tmp = new THREE.Object3D();
parts.forEach((p, pi) => {
  if (p.rotation || p.studs || p.shape === 'Cylinder') {
    let geo = p.shape === 'Cylinder' ? unitCyl : unitBox;
    let mat = material(p);
    if (p.studs) {
      geo = studGeometry(p.size);
      mat = [mat, mat, material(p, true), mat, mat, mat];
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.fromArray(p.position);
    mesh.scale.fromArray(p.size);
    if (p.rotation) mesh.rotation.set(...p.rotation.map(THREE.MathUtils.degToRad), 'XYZ');
    mesh.castShadow = castsShadow(p);
    mesh.receiveShadow = true;
    groupNode(p.group).add(mesh);
    singles.push({ mesh, i: pi });
    return;
  }
  const k = `${p.group}|${p.color}|${p.transparency}|${p.material}`;
  if (!buckets.has(k)) buckets.set(k, []);
  buckets.get(k).push({ p, i: pi });
});
for (const list of buckets.values()) {
  const p0 = list[0].p;
  const mesh = new THREE.InstancedMesh(unitBox, material(p0), list.length);
  const entry = { mesh, items: [] };
  list.forEach(({ p, i }, k) => {
    tmp.position.fromArray(p.position);
    tmp.scale.fromArray(p.size);
    tmp.updateMatrix();
    mesh.setMatrixAt(k, tmp.matrix);
    entry.items.push({ i, matrix: tmp.matrix.clone() });
  });
  instanced.push(entry);
  mesh.castShadow = castsShadow(p0);
  mesh.receiveShadow = true;
  if (p0.transparency > 0) mesh.renderOrder = 2;
  groupNode(p0.group).add(mesh);
}

// Luzes reais só nas luminárias pendentes do átrio/hall (o resto é ambiente + emissivo).
for (const p of parts) {
  if (!p.light || p.light.type !== 'Point' || !/Iluminação\/(Átrio|Hall)/.test(p.model)) continue;
  const l = new THREE.PointLight(srgb(p.light.color), 55, 42, 1.6);
  l.position.set(p.position[0], p.position[1] - 1, p.position[2]);
  scene.add(l);
}

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.35, 0.95));
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------
// Vistas (também usadas pelo CI para as capturas)
// ---------------------------------------------------------------------------
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.maxDistance = 400;

const c2 = cellCenterX(2);
const OVERVIEW = { pos: [-45, 170, 150], target: [0, 0, 0], cut: true };
const VIEWS = [
  { id: 'overview', title: 'Visão geral (corte, sem teto)', ...OVERVIEW },
  { id: 'hall', title: 'Hall de entrada e posto de guarda', pos: [-86, 7, -22], target: [-55, 7, 10] },
  { id: 'atrium', title: 'Átrio com refeitório', pos: [-84, 8.5, 0], target: [10, 11, 0] },
  { id: 'corridor', title: 'Corredor das celas (térreo)', pos: [-64, 5.5, 29.5], target: [40, 4.5, 30.5] },
  { id: 'upper', title: 'Galeria do 2º andar', pos: [-64, 22.5, 28.5], target: [40, 21, 29] },
  { id: 'cells', title: 'Fachada das celas', pos: [c2 + 1.5, 6, -21], target: [c2 - 3, 5.5, -38] },
  { id: 'cell', title: 'Interior de uma cela', pos: [c2 + 3.8, 5.5, -35.8], target: [c2 - 3.5, 2.5, -48] },
  { id: 'stairs', title: 'Escada para o mezanino', pos: [22, 7, 3], target: [52, 10, 0] },
  { id: 'visits', title: 'Sala de visitas', pos: [68, 6.5, -22], target: [78, 3.5, 8] },
  { id: 'storage', title: 'Estoque sob o mezanino', pos: [68, 7.5, 25], target: [80, 4, 44] },
  { id: 'build-25', title: 'Montagem — 25% das etapas', ...OVERVIEW, step: 0.25 },
  { id: 'build-50', title: 'Montagem — 50% das etapas', ...OVERVIEW, step: 0.5 },
  { id: 'build-75', title: 'Montagem — 75% das etapas', ...OVERVIEW, step: 0.75 },
];

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const stepInput = document.getElementById('step');
const stepLabel = document.getElementById('step-label');
stepInput.max = String(manual.steps.length);
function setStep(n) {
  const k = Math.max(1, Math.min(manual.steps.length, Math.round(n)));
  for (const { mesh, i } of singles) mesh.visible = stepOf[i] <= k;
  for (const { mesh, items } of instanced) {
    items.forEach(({ i, matrix }, idx) => mesh.setMatrixAt(idx, stepOf[i] <= k ? matrix : ZERO));
    mesh.instanceMatrix.needsUpdate = true;
  }
  stepInput.value = String(k);
  const st = manual.steps[k - 1];
  stepLabel.textContent = `Etapa ${k}/${manual.steps.length} · ${st.phaseTitle}`;
}
stepInput.oninput = () => setStep(Number(stepInput.value));

function setGroupVisible(name, on) {
  const g = groups.get(name);
  if (g) g.visible = on;
}
let cutaway = false;
function setCut(on) {
  cutaway = on;
  setGroupVisible('Teto', !on);
  setGroupVisible('Iluminação', !on);
  document.getElementById('cut')?.classList.toggle('on', on);
}

function setView(id) {
  const v = VIEWS.find((x) => x.id === id);
  if (!v) return;
  exitWalk();
  camera.position.fromArray(v.pos);
  orbit.target.fromArray(v.target);
  orbit.update();
  setCut(Boolean(v.cut));
  setStep(v.step ? v.step * manual.steps.length : manual.steps.length);
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === id));
}

const viewsEl = document.getElementById('views');
for (const v of VIEWS.filter((x) => !x.step)) {
  const b = document.createElement('button');
  b.dataset.view = v.id;
  b.textContent = v.title.split(' (')[0];
  b.onclick = () => setView(v.id);
  viewsEl.appendChild(b);
}
document.getElementById('cut').onclick = () => setCut(!cutaway);
document.getElementById('toggle').onclick = () => document.getElementById('hud').classList.toggle('collapsed');

// ---------------------------------------------------------------------------
// Modo andar (física simples estilo Roblox: WalkSpeed 16, gravidade 196.2)
// ---------------------------------------------------------------------------
const colliders = parts
  .filter((p) => p.canCollide && !p.rotation)
  .map((p) => ({ min: p.position.map((c, i) => c - p.size[i] / 2), max: p.position.map((c, i) => c + p.size[i] / 2) }));
const GRID = 8;
const grid = new Map();
colliders.forEach((c, i) => {
  for (let gx = Math.floor(c.min[0] / GRID); gx <= Math.floor(c.max[0] / GRID); gx++)
    for (let gz = Math.floor(c.min[2] / GRID); gz <= Math.floor(c.max[2] / GRID); gz++) {
      const k = gx + ',' + gz;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    }
});
const SPAWN = [-76, 1, 0];
const PLAYER = { half: 0.9, height: 5, eye: 4.5 };
const player = { pos: new THREE.Vector3(...SPAWN), vel: new THREE.Vector3(), onGround: false };
const keys = {};
const look = new PointerLockControls(camera, document.body);
let walking = false;

function nearby(x, z) {
  const set = new Set();
  const gx = Math.floor(x / GRID), gz = Math.floor(z / GRID);
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) (grid.get(gx + i + ',' + (gz + j)) || []).forEach((n) => set.add(n));
  return [...set].map((i) => colliders[i]);
}
function hits(pos, list) {
  const a0 = [pos.x - PLAYER.half, pos.y, pos.z - PLAYER.half];
  const a1 = [pos.x + PLAYER.half, pos.y + PLAYER.height, pos.z + PLAYER.half];
  return list.filter((c) => a0[0] < c.max[0] && a1[0] > c.min[0] && a0[1] < c.max[1] && a1[1] > c.min[1] && a0[2] < c.max[2] && a1[2] > c.min[2]);
}
function moveAxis(axis, delta, list) {
  if (!delta) return;
  player.pos[axis] += delta;
  const hit = hits(player.pos, list);
  if (!hit.length) return;
  if (axis !== 'y') {
    const topY = Math.max(...hit.map((c) => c.max[1]));
    if (player.onGround && topY - player.pos.y <= 1.2) {
      const y = player.pos.y;
      player.pos.y = topY + 0.01;
      if (!hits(player.pos, list).length) return;
      player.pos.y = y;
    }
    player.pos[axis] -= delta;
    return;
  }
  if (delta < 0) {
    player.pos.y = Math.max(...hit.map((c) => c.max[1])) + 0.001;
    player.onGround = true;
  } else {
    player.pos.y = Math.min(...hit.map((c) => c.min[1])) - PLAYER.height - 0.001;
  }
  player.vel.y = 0;
}
function stepWalk(dt) {
  const speed = keys.ShiftLeft || keys.ShiftRight ? 28 : 16;
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
  const wish = new THREE.Vector3();
  if (keys.KeyW || keys.ArrowUp) wish.add(fwd);
  if (keys.KeyS || keys.ArrowDown) wish.sub(fwd);
  if (keys.KeyD || keys.ArrowRight) wish.add(right);
  if (keys.KeyA || keys.ArrowLeft) wish.sub(right);
  if (wish.lengthSq()) wish.normalize().multiplyScalar(speed);
  if (keys.Space && player.onGround) {
    player.vel.y = 50;
    player.onGround = false;
  }
  player.vel.y -= 196.2 * dt;
  const list = nearby(player.pos.x, player.pos.z);
  moveAxis('x', wish.x * dt, list);
  moveAxis('z', wish.z * dt, list);
  player.onGround = false;
  moveAxis('y', player.vel.y * dt, list);
  if (player.pos.y < -20) player.pos.set(...SPAWN);
  camera.position.set(player.pos.x, player.pos.y + PLAYER.eye, player.pos.z);
}
const walkBtn = document.getElementById('walk');
function enterWalk() {
  walking = true;
  orbit.enabled = false;
  walkBtn.classList.add('on');
  document.getElementById('walkhint').style.display = 'block';
  document.getElementById('cross').style.display = 'block';
  player.pos.set(...SPAWN);
  player.vel.set(0, 0, 0);
  camera.position.set(SPAWN[0], SPAWN[1] + PLAYER.eye, SPAWN[2]);
  camera.lookAt(0, SPAWN[1] + PLAYER.eye, 0);
  setCut(false);
  setStep(manual.steps.length);
  look.lock();
}
function exitWalk() {
  if (!walking) return;
  walking = false;
  orbit.enabled = true;
  walkBtn.classList.remove('on');
  document.getElementById('walkhint').style.display = 'none';
  document.getElementById('cross').style.display = 'none';
  if (look.isLocked) look.unlock();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  orbit.target.copy(camera.position).addScaledVector(dir, 10);
}
walkBtn.onclick = () => (walking ? exitWalk() : enterWalk());
look.addEventListener('unlock', () => exitWalk());
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (walking && e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => (keys[e.code] = false));

// ---------------------------------------------------------------------------
// Painel e loop
// ---------------------------------------------------------------------------
const s = countStats(parts);
document.getElementById('stats').textContent =
  `${s.total} peças · ${manual.steps.length} etapas · ${manual.connections} conexões verificadas · ${s.lights} luzes`;

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (walking) stepWalk(dt);
  else orbit.update();
  composer.render();
});

setView(new URLSearchParams(location.hash.slice(1)).get('view') || 'atrium');
window.__prison = {
  ready: true,
  views: VIEWS.map(({ id, title }) => ({ id, title })),
  setView,
  stats: s,
  manual: { parts: manual.parts, steps: manual.steps.length, connections: manual.connections },
};
