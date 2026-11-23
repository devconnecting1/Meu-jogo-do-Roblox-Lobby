import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildLobby, stats as countStats } from '../src/lobby.js';

const CONFIG = { universeId: '10548333977', placeId: '116364339053967' };

// ---------------------------------------------------------------------------
// Cena
// ---------------------------------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const sky = new THREE.Color(0x9cc7ea);
scene.background = sky;
scene.fog = new THREE.Fog(sky, 260, 620);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 2000);
camera.position.set(-190, 90, -150);

scene.add(new THREE.HemisphereLight(0xdfeeff, 0x6b6656, 0.9));
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xfff2dc, 2.2);
sun.position.set(-120, 200, -90);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = -170; sc.right = 170; sc.top = 170; sc.bottom = -170; sc.near = 10; sc.far = 600;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.4;
scene.add(sun);

// ---------------------------------------------------------------------------
// Parts -> malhas
// ---------------------------------------------------------------------------
const { parts } = buildLobby();
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const groups = new Map(); // group -> THREE.Group
const materialCache = new Map();

function srgb([r, g, b]) {
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

function materialFor(p) {
  const key = `${p.color.join(',')}|${p.transparency}|${p.light ? 1 : 0}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const color = srgb(p.color);
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0.0,
    transparent: p.transparency > 0,
    opacity: 1 - p.transparency,
    depthWrite: p.transparency === 0,
    emissive: p.light ? color : new THREE.Color(0),
    emissiveIntensity: p.light ? 0.9 : 0,
  });
  materialCache.set(key, m);
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

function labelMaterials(p) {
  const base = materialFor(p);
  const faces = { Right: 0, Left: 1, Top: 2, Bottom: 3, Back: 4, Front: 5 };
  const idx = faces[p.label.face] ?? 5;
  // largura/altura da face em studs
  const [sx, sy, sz] = p.size;
  const dims = idx < 2 ? [sz, sy] : idx < 4 ? [sx, sz] : [sx, sy];
  const ppu = 48;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(64, Math.round(dims[0] * ppu));
  canvas.height = Math.max(32, Math.round(dims[1] * ppu));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `rgb(${p.color.join(',')})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const [r, g, b] = p.label.color ?? [255, 255, 255];
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = canvas.height * 0.62;
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  while (ctx.measureText(p.label.text).width > canvas.width * 0.92 && size > 6) {
    size -= 2;
    ctx.font = `700 ${size}px system-ui, sans-serif`;
  }
  ctx.fillText(p.label.text, canvas.width / 2, canvas.height / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 });
  const mats = Array(6).fill(base);
  mats[idx] = faceMat;
  return mats;
}

const buckets = new Map();
const tmp = new THREE.Object3D();
for (const p of parts) {
  if (p.rotation || p.label) {
    const mesh = new THREE.Mesh(unitBox, p.label ? labelMaterials(p) : materialFor(p));
    mesh.position.fromArray(p.position);
    mesh.scale.fromArray(p.size);
    if (p.rotation) mesh.rotation.set(...p.rotation.map(THREE.MathUtils.degToRad), 'XYZ');
    mesh.castShadow = p.transparency < 0.5;
    mesh.receiveShadow = true;
    groupNode(p.group).add(mesh);
    continue;
  }
  const key = `${p.group}|${p.color.join(',')}|${p.transparency}|${p.light ? 1 : 0}`;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(p);
}
for (const list of buckets.values()) {
  const p0 = list[0];
  const mesh = new THREE.InstancedMesh(unitBox, materialFor(p0), list.length);
  list.forEach((p, i) => {
    tmp.position.fromArray(p.position);
    tmp.scale.fromArray(p.size);
    tmp.rotation.set(0, 0, 0);
    tmp.updateMatrix();
    mesh.setMatrixAt(i, tmp.matrix);
  });
  mesh.castShadow = p0.transparency < 0.5 && p0.group !== 'Terreno';
  mesh.receiveShadow = true;
  if (p0.transparency > 0) mesh.renderOrder = 2;
  groupNode(p0.group).add(mesh);
}

// Algumas luzes pontuais (as do átrio) para o interior não ficar escuro.
for (const p of parts) {
  if (!p.light || p.name !== 'Luminária Átrio') continue;
  const l = new THREE.PointLight(srgb(p.light.color), 260, 70, 1.6);
  l.position.set(p.position[0], p.position[1] - 1, p.position[2]);
  scene.add(l);
}

// ---------------------------------------------------------------------------
// Controles e vistas
// ---------------------------------------------------------------------------
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0, 10, 0);
orbit.maxDistance = 600;

const VIEWS = {
  exterior: { pos: [-165, 62, -128], target: [-12, 6, 0], roof: true },
  plan: { pos: [10, 210, 95], target: [0, 0, 0], roof: false },
  ground: { pos: [-62, 6, -15], target: [20, 6, -27], roof: true },
  upper: { pos: [-49, 20.5, 23], target: [30, 17, 20.5], roof: true },
  cell: { pos: [22.5, 5, -15.5], target: [19.5, 4.2, -31.5], roof: true },
};

const roofBtn = document.getElementById('roof');
const wallsBtn = document.getElementById('walls');
function setGroupVisible(name, on, btn) {
  const g = groups.get(name);
  if (g) g.visible = on;
  btn?.classList.toggle('on', on);
}
roofBtn.onclick = () => setGroupVisible('Teto', !groups.get('Teto').visible, roofBtn);
wallsBtn.onclick = () => setGroupVisible('Paredes', !groups.get('Paredes').visible, wallsBtn);

function setView(name) {
  const v = VIEWS[name];
  if (!v) return;
  exitWalk();
  camera.position.fromArray(v.pos);
  orbit.target.fromArray(v.target);
  orbit.update();
  setGroupVisible('Teto', v.roof, roofBtn);
  setGroupVisible('Paredes', true, wallsBtn);
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
}
document.querySelectorAll('#views button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
document.getElementById('toggle').onclick = () => document.getElementById('hud').classList.toggle('collapsed');

// ---------------------------------------------------------------------------
// Modo andar (física simples estilo Roblox: WalkSpeed 16, gravidade 196.2)
// ---------------------------------------------------------------------------
const colliders = parts
  .filter((p) => p.canCollide && !p.rotation && p.group !== 'Terreno')
  .map((p) => ({
    min: p.position.map((c, i) => c - p.size[i] / 2),
    max: p.position.map((c, i) => c + p.size[i] / 2),
  }));
colliders.push({ min: [-260, -10, -260], max: [260, -0.2, 260] }); // gramado

const GRID = 8;
const grid = new Map();
colliders.forEach((c, i) => {
  for (let gx = Math.floor(c.min[0] / GRID); gx <= Math.floor(c.max[0] / GRID); gx++)
    for (let gz = Math.floor(c.min[2] / GRID); gz <= Math.floor(c.max[2] / GRID); gz++) {
      if (Math.abs(gx) > 40 || Math.abs(gz) > 40) continue;
      const k = gx + ',' + gz;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    }
});
const ground = colliders.length - 1;

const PLAYER = { half: 0.9, height: 5, eye: 4.5 };
const player = { pos: new THREE.Vector3(-40, 1, 0), vel: new THREE.Vector3(), onGround: false };
const keys = {};
const look = new PointerLockControls(camera, document.body);
let walking = false;

function nearby(x, z) {
  const set = new Set([ground]);
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
    // tenta subir degrau (até 1.2 stud)
    const top = Math.max(...hit.map((c) => c.max[1]));
    if (player.onGround && top - player.pos.y <= 1.2) {
      const y = player.pos.y;
      player.pos.y = top + 0.01;
      if (!hits(player.pos, list).length) return;
      player.pos.y = y;
    }
    player.pos[axis] -= delta;
    return;
  }
  // eixo Y
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
  if (player.pos.y < -50) player.pos.set(-40, 1, 0);
  camera.position.set(player.pos.x, player.pos.y + PLAYER.eye, player.pos.z);
}

const walkBtn = document.getElementById('walk');
function enterWalk() {
  walking = true;
  orbit.enabled = false;
  walkBtn.classList.add('on');
  document.getElementById('walkhint').style.display = 'block';
  document.getElementById('cross').style.display = 'block';
  player.pos.set(-40, 1, 0);
  player.vel.set(0, 0, 0);
  camera.position.set(-40, 1 + PLAYER.eye, 0);
  camera.lookAt(0, 1 + PLAYER.eye, 0);
  setGroupVisible('Teto', true, roofBtn);
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
// Painel
// ---------------------------------------------------------------------------
const s = countStats(parts);
const lights = parts.filter((p) => p.light).length;
document.getElementById('stats').innerHTML = `
  <div><b>${s.total}</b> Parts · <b>32</b> celas showcase · <b>${lights}</b> luzes</div>
  <div>Universo ${CONFIG.universeId} · Lugar ${CONFIG.placeId}</div>
  <div><a href="https://www.roblox.com/games/${CONFIG.placeId}" target="_blank" rel="noopener">Abrir no Roblox ↗</a></div>`;

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (walking) stepWalk(dt);
  else orbit.update();
  renderer.render(scene, camera);
});

const initial = new URLSearchParams(location.hash.slice(1)).get('view') || 'exterior';
setView(initial);
window.__lobby = { setView, ready: true, parts: s.total };
