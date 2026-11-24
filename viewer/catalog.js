// Catálogo de peças no navegador: cada peça reaproveitável sozinha no seu chão de studs
// (src/catalog.js), com a mesma aparência do visualizador do Reino (viewer/main.js).
// O botão "Colisão" pinta de vermelho o que colide e deixa o resto translúcido.
// O CI fotografa cada vista, com e sem colisão (tools/catalog-shots.mjs).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCatalog, GROUPS } from '../src/catalog.js';
import { aabb, stats as countStats } from '../src/builder.js';
import { C } from '../src/palette.js';

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
scene.fog = new THREE.FogExp2(0xc4d6e2, 0.0011);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.3, 4000);

const { parts, entries, cell } = buildCatalog();

// limites do catálogo inteiro (para o sol, a sombra e a vista geral)
const bounds = new THREE.Box3();
for (const p of parts) {
  const { min, max } = aabb(p);
  bounds.expandByPoint(new THREE.Vector3(...min));
  bounds.expandByPoint(new THREE.Vector3(...max));
}
const mid = bounds.getCenter(new THREE.Vector3());
const ext = bounds.getSize(new THREE.Vector3());
const reach = Math.max(ext.x, ext.z) / 2 + 40;

scene.add(new THREE.HemisphereLight(0xe4eef6, 0x6e6654, 1.15));
const sun = new THREE.DirectionalLight(0xfff3e0, 2.1);
sun.position.set(mid.x + 220, 360, mid.z + 150);
sun.target.position.set(mid.x, 0, mid.z);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 10, far: 1200 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.3;
scene.add(sun, sun.target);

// Studs clássicos no topo das peças: textura de 1 stud aplicada em coordenadas de mundo
// (mesma técnica do viewer/main.js; tudo continua instanciado).
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
// Parts -> malhas instanciadas (uma por cor + aparência + colisão)
// ---------------------------------------------------------------------------
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const srgb = ([r, g, b]) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
const cache = new Map();

function material(p) {
  const k = `${p.color}|${p.transparency}|${p.material}|${p.studs}`;
  if (cache.has(k)) return cache.get(k);
  const wet = p.name.startsWith('Água');
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

// modo "Colisão": o que colide fica vermelho e opaco; o resto vira um vulto translúcido
const SOLID = addStuds(new THREE.MeshStandardMaterial({ color: 0xd2483c, emissive: 0x3a0c08, roughness: 0.7 }));
const GHOST = new THREE.MeshStandardMaterial({
  color: 0xe8e6e0,
  roughness: 1,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
});

const pads = new Set(entries.map((e) => e.pad));
const buckets = new Map();
parts.forEach((p, i) => {
  const pad = pads.has(i);
  const k = `${p.color}|${p.transparency}|${p.material}|${p.studs}|${p.canCollide}|${pad}`;
  if (!buckets.has(k)) buckets.set(k, { pad, list: [] });
  buckets.get(k).list.push(p);
});
const meshes = [];
const tmp = new THREE.Object3D();
for (const { pad, list } of buckets.values()) {
  const p0 = list[0];
  const base = material(p0);
  const mesh = new THREE.InstancedMesh(unitBox, base, list.length);
  list.forEach((p, k) => {
    tmp.position.fromArray(p.position);
    tmp.scale.fromArray(p.size);
    tmp.rotation.set(...(p.rotation ?? [0, 0, 0]).map(THREE.MathUtils.degToRad), 'XYZ');
    tmp.updateMatrix();
    mesh.setMatrixAt(k, tmp.matrix);
  });
  const opaque = p0.transparency === 0;
  mesh.castShadow = opaque;
  mesh.receiveShadow = true;
  mesh.renderOrder = opaque ? 0 : 2;
  mesh.frustumCulled = false;
  mesh.userData = { base, opaque, collide: p0.canCollide, pad };
  scene.add(mesh);
  meshes.push(mesh);
}

// gramado em volta dos chãos (só no visualizador; não é Part)
const lawn = new THREE.Mesh(
  new THREE.PlaneGeometry(ext.x + cell * 4, ext.z + cell * 4),
  new THREE.MeshStandardMaterial({ color: srgb(C.grass), roughness: 0.95 }),
);
lawn.rotation.x = -Math.PI / 2;
lawn.position.set(mid.x, -1, mid.z);
lawn.receiveShadow = true;
scene.add(lawn);

let collision = false;
function setCollision(on) {
  collision = Boolean(on);
  for (const mesh of meshes) {
    const { base, opaque, collide, pad } = mesh.userData;
    const ghost = collision && !pad && !collide;
    mesh.material = !collision || pad ? base : collide ? SOLID : GHOST;
    mesh.castShadow = opaque && !ghost;
    mesh.renderOrder = ghost ? 3 : opaque ? 0 : 2;
  }
  document.getElementById('collision').checked = collision;
}

// ---------------------------------------------------------------------------
// Etiquetas com o nome de cada peça (só na vista geral)
// ---------------------------------------------------------------------------
function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20, 21, 24, 0.82)';
  if (g.roundRect) {
    g.beginPath();
    g.roundRect(4, 4, 504, 88, 18);
    g.fill();
  } else {
    g.fillRect(4, 4, 504, 88);
  }
  g.fillStyle = '#f2efe8';
  g.font = '600 44px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 50, 480);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false }));
  const w = Math.min(34, cell * 0.55);
  sprite.scale.set(w, (w * 96) / 512, 1);
  sprite.renderOrder = 10;
  return sprite;
}
const labels = new THREE.Group();
for (const e of entries) {
  const s = makeLabel(e.title);
  s.position.set(e.origin[0], e.center[1] + e.size[1] / 2 + 5, e.origin[2] + e.padSize[1] / 2);
  labels.add(s);
}
scene.add(labels);

// ---------------------------------------------------------------------------
// Vistas: uma por peça (3/4 de frente, enquadrada pela caixa envolvente) + "todos"
// ---------------------------------------------------------------------------
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.maxDistance = 1600;
orbit.maxPolarAngle = Math.PI * 0.49;

const ENTRY_DIR = new THREE.Vector3(0.8, 0.62, 1).normalize();
const ALL_DIR = new THREE.Vector3(0.35, 1, 0.9).normalize();
const VIEWS = [
  {
    id: 'todos',
    title: 'Todas as peças do catálogo',
    center: [mid.x, 0, mid.z],
    size: [ext.x, ext.y, ext.z],
    dir: ALL_DIR,
    fit: 0.62,
  },
  ...entries.map((e) => ({ id: e.id, title: e.title, center: e.center, size: e.size, dir: ENTRY_DIR, fit: 1.12 })),
];

/** Câmera a uma distância em que a esfera envolvente cabe no quadro (vertical e horizontal). */
function frame(v) {
  const r = Math.max(1.5, 0.5 * Math.hypot(...v.size));
  const half = THREE.MathUtils.degToRad(camera.fov) / 2;
  const halfH = Math.atan(Math.tan(half) * camera.aspect);
  const dist = (r / Math.sin(Math.min(half, halfH))) * v.fit;
  const target = new THREE.Vector3(...v.center);
  return { pos: target.clone().addScaledVector(v.dir, dist), target };
}

let current = 'todos';
function setView(id) {
  const v = VIEWS.find((x) => x.id === id);
  if (!v) return;
  current = id;
  const { pos, target } = frame(v);
  camera.position.copy(pos);
  orbit.target.copy(target);
  orbit.update();
  labels.visible = id === 'todos';
  document.querySelectorAll('#hud button[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === id));
  const e = entries.find((x) => x.id === id);
  const info = document.getElementById('info');
  if (e) {
    const [w, h, d] = e.size.map((n) => String(Math.round(n * 10) / 10).replace('.', ','));
    info.replaceChildren();
    const title = document.createElement('b');
    title.textContent = e.title;
    info.append(
      title,
      ` · ${e.group}`,
      document.createElement('br'),
      `${e.parts} partes · ${e.collidable} com colisão · ${w} × ${h} × ${d} studs`,
      document.createElement('br'),
      `Colidem: ${e.collidableParts.length ? e.collidableParts.join(', ') : 'nada'}`,
    );
  } else {
    info.textContent = `${entries.length} peças em ${GROUPS.filter((g) => entries.some((x) => x.group === g)).length} grupos`;
  }
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------
document.getElementById('all').onclick = () => setView('todos');
const groupsEl = document.getElementById('groups');
for (const g of GROUPS) {
  const list = entries.filter((e) => e.group === g);
  if (!list.length) continue;
  const h = document.createElement('h2');
  h.textContent = g;
  const row = document.createElement('div');
  row.className = 'row';
  for (const e of list) {
    const b = document.createElement('button');
    b.dataset.view = e.id;
    b.textContent = e.title;
    b.onclick = () => setView(e.id);
    row.appendChild(b);
  }
  groupsEl.append(h, row);
}
document.getElementById('collision').onchange = (ev) => setCollision(ev.target.checked);
document.getElementById('toggle').onclick = () => document.getElementById('hud').classList.toggle('collapsed');

const s = countStats(parts);
const solidCount = parts.filter((p, i) => p.canCollide && !pads.has(i)).length;
document.getElementById('stats').textContent =
  `${entries.length} peças · ${s.total - entries.length} partes (fora os chãos) · ${solidCount} com colisão`;

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  setView(current);
});
renderer.setAnimationLoop(() => {
  orbit.update();
  renderer.render(scene, camera);
});

const hash = new URLSearchParams(location.hash.slice(1));
setCollision(hash.get('colisao') === '1');
setView(hash.get('view') || 'todos');
window.__catalogo = {
  ready: true,
  views: VIEWS.map(({ id, title }) => ({ id, title })),
  setView,
  setCollision,
  entries,
  stats: { ...s, entries: entries.length, collidable: solidCount },
};
