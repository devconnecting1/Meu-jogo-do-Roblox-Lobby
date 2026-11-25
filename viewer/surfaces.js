// Aparência das Parts no visualizador: os materiais do Roblox (Grass, Sand, Cobblestone, WoodPlanks,
// Brick...) desenhados por shader, sem nenhuma imagem. Cada material ganha um programa próprio
// (onBeforeCompile no MeshStandardMaterial) com textura procedural nas coordenadas da peça: para peças
// sem rotação isso é a coordenada de mundo, então faixas vizinhas do terreno continuam sem emenda e tudo
// segue instanciado. Detalhes finos somem com a distância (sfL), para não cintilar nas vistas de longe.
// Plastic com studs continua com a textura clássica de 1 stud no topo (addStuds).
import * as THREE from 'three';

/** Água e mar: viram o programa "Water" (ondulação e brilho do sol), qualquer que seja o material. */
export const isWet = (p) => p.name === 'Mar' || p.name.startsWith('Água');

// [roughness, metalness] de cada material (sem envMap, então metal fica moderado para não escurecer)
const PBR = {
  Plastic: [0.7, 0],
  SmoothPlastic: [0.4, 0],
  Neon: [0.6, 0],
  Wood: [0.85, 0],
  WoodPlanks: [0.8, 0],
  Marble: [0.32, 0],
  Slate: [0.82, 0],
  Concrete: [0.92, 0],
  Granite: [0.55, 0],
  Brick: [0.9, 0],
  Pebble: [0.88, 0],
  Cobblestone: [0.9, 0],
  Rock: [0.92, 0],
  Sandstone: [0.9, 0],
  Metal: [0.4, 0.35],
  Grass: [0.96, 0],
  Sand: [0.95, 0],
  Fabric: [0.97, 0],
  Snow: [0.62, 0],
  Ground: [0.98, 0],
  Glass: [0.12, 0.05],
  Water: [0.14, 0.05],
};

const srgb = ([r, g, b]) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);

// ---------------------------------------------------------------------------
// Studs clássicos no topo das peças Plastic: textura de 1 stud em coordenadas de mundo
// ---------------------------------------------------------------------------
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

export function addStuds(m) {
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
// Texturas procedurais (GLSL)
// ---------------------------------------------------------------------------
// Vértice: centro, tamanho, posição local (em studs, sem a rotação) e normal local da peça.
const VERT_DECL = `
varying vec3 vSurfLoc;
varying vec3 vSurfCenter;
varying vec3 vSurfScale;
varying vec3 vSurfNrm;`;

const VERT_BODY = `
mat4 surfM = modelMatrix;
#ifdef USE_INSTANCING
  surfM = modelMatrix * instanceMatrix;
#endif
vSurfScale = vec3(length(surfM[0].xyz), length(surfM[1].xyz), length(surfM[2].xyz));
vSurfCenter = surfM[3].xyz;
vSurfLoc = position * vSurfScale;
vSurfNrm = normal;`;

// Fragmento: ruído barato (hash sem seno, value noise, Voronoi 3x3) + relevo pela derivada da altura.
const FRAG_DECL = `
varying vec3 vSurfLoc;
varying vec3 vSurfCenter;
varying vec3 vSurfScale;
varying vec3 vSurfNrm;
float surfFoot;
struct Surf { vec3 tint; float h; float r; vec4 over; };
float sfH(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float sfN(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = sfH(i);
  float b = sfH(i + vec2(1.0, 0.0));
  float c = sfH(i + vec2(0.0, 1.0));
  float d = sfH(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// peso de um detalhe de período s (studs): 1 de perto, 0 quando o pixel já cobre o detalhe
float sfL(float s) { return 1.0 - smoothstep(0.12 * s, 0.45 * s, surfFoot); }
// ruído com sinal (-1..1) de período s, que some com a distância
float sfS(vec2 p, float s) {
  float w = sfL(s);
  if (w <= 0.0) return 0.0;
  return (sfN(p / s) - 0.5) * 2.0 * w;
}
// Voronoi: (distância ao centro da pedra, distância aproximada até a borda, sorteio da pedra)
vec3 sfV(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  float id = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 c = i + g;
      vec2 o = g + 0.15 + 0.7 * vec2(sfH(c), sfH(c + 17.31)) - f;
      float d = dot(o, o);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = sfH(c + 41.7);
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  d1 = sqrt(d1);
  return vec3(d1, sqrt(d2) - d1, id);
}
// relevo (bump) a partir da altura h em studs, como o perturbNormalArb do three.js
vec3 sfBump(vec3 pos, vec3 nrm, float h) {
  vec3 sx = dFdx(pos);
  vec3 sy = dFdy(pos);
  vec3 r1 = cross(sy, nrm);
  vec3 r2 = cross(nrm, sx);
  float det = dot(sx, r1) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * nrm - grad);
}`;

// Prólogo comum: tp (coordenada da peça em studs), face dominante, uv da face e saídas padrão.
const SURF_HEAD = `
Surf sfSurface(vec3 base) {
  vec3 tp = vSurfCenter + vSurfLoc;
  surfFoot = max(length(dFdx(tp)), length(dFdy(tp)));
  vec3 an = abs(vSurfNrm);
  vec3 mn = an.y >= max(an.x, an.z) ? vec3(0.0, 1.0, 0.0) : (an.x >= an.z ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0));
  float top = mn.y;
  float hc = mn.x > 0.5 ? tp.z : tp.x;
  float fw = mn.x > 0.5 ? vSurfScale.z : vSurfScale.x;
  vec2 uv = top > 0.5 ? tp.xz : vec2(hc, tp.y);
  vec3 tint = vec3(1.0);
  float h = 0.0;
  float r = 1.0;
  vec4 over = vec4(0.0);
`;
const SURF_TAIL = `
  return Surf(tint, h, r, over);
}`;

// Corpo de cada material: ajusta tint (multiplica a cor, ~0,8 a 1,15), h (relevo em studs),
// r (multiplica a rugosidade) e over (cor por cima, como a argamassa do tijolo).
const BODIES = {
  Grass: `
  float big = sfS(uv, 23.0);
  float mid = sfS(uv + 5.1, 3.1);
  float fine = sfS(uv + 7.3, 0.23);
  float speck = step(0.9, sfH(floor(uv / vec2(0.07, 0.16)))) * sfL(0.12);
  tint = vec3(1.0 + 0.07 * big, 1.0 + 0.05 * big, 1.0 - 0.03 * big) * (1.0 + 0.06 * mid + 0.1 * fine + 0.1 * speck);
  h = 0.012 * fine + 0.006 * speck;`,

  Sand: `
  float big = sfS(uv, 17.0);
  float mid = sfS(uv + 2.0, 2.3);
  float g1 = sfS(uv + 1.7, 0.09);
  float g2 = sfS(uv + 5.1, 0.17);
  float rw = sfL(3.0) * top;
  float rip = rw > 0.0 ? sin(uv.x * 1.9 + uv.y * 0.6 + sfN(uv * 0.2) * 5.0) * rw : 0.0;
  tint = vec3(1.0 + 0.05 * big + 0.03 * mid + 0.05 * g1 + 0.04 * g2 + 0.03 * rip);
  h = 0.015 * rip + 0.004 * g1;`,

  Snow: `
  float big = sfS(uv, 13.0);
  float mid = sfS(uv + 3.0, 1.7);
  float spark = step(0.985, sfH(floor(uv * 9.0))) * sfL(0.11);
  tint = vec3(1.0 + 0.03 * big + 0.03 * mid) + vec3(0.0, 0.005, 0.02) * mid + 0.16 * spark;
  h = 0.03 * mid;
  r = 1.0 - 0.4 * spark;`,

  Ground: `
  float big = sfS(uv, 9.0);
  float mid = sfS(uv + 3.0, 1.3);
  float fine = sfS(uv + 7.0, 0.27);
  float clump = smoothstep(0.1, 0.7, mid + 0.4 * fine);
  tint = vec3(1.0 + 0.06 * big + 0.06 * fine) * (0.94 + 0.12 * clump);
  h = 0.03 * clump + 0.01 * fine;
  float pw = sfL(0.7);
  if (pw > 0.0) {
    vec3 v = sfV(uv / 0.7 + 2.3);
    float st = (1.0 - smoothstep(0.18, 0.3, v.x)) * step(0.8, v.z) * pw;
    tint *= 1.0 + 0.16 * st;
    h += 0.03 * st;
  }`,

  Rock: `
  float big = sfS(uv, 7.0);
  float mid = sfS(uv + 2.0, 1.9);
  float fine = sfS(uv + 5.0, 0.4);
  float cw = sfL(0.6);
  float crack = 0.0;
  if (cw > 0.0) crack = smoothstep(0.9, 0.97, 1.0 - abs(sfN(uv / 2.7 + 11.0) * 2.0 - 1.0)) * cw;
  float strata = (1.0 - top) * sin(tp.y * 2.3 + big * 2.0) * sfL(2.7);
  tint = vec3(1.0 + 0.08 * big + 0.07 * mid + 0.06 * fine + 0.03 * strata - 0.22 * crack);
  h = 0.06 * mid + 0.015 * fine - 0.04 * crack;`,

  Slate: `
  float lw = sfL(0.6) * (1.0 - top);
  float layer = tp.y * 1.7 + sfN(vec2(uv.x * 0.21, tp.y * 0.3)) * 1.4;
  float lf = fract(layer);
  float seam = (1.0 - smoothstep(0.0, 0.09, lf)) * lw;
  float lay = (sfH(vec2(floor(layer), 3.0)) - 0.5) * lw;
  float plate = 0.0;
  float edge = 0.0;
  float pw = sfL(1.6) * top;
  if (pw > 0.0) {
    vec3 v = sfV(uv / 1.6);
    plate = (v.z - 0.5) * pw;
    edge = (1.0 - smoothstep(0.0, 0.06, v.y)) * sfL(0.5) * top;
  }
  tint = vec3(1.0 + 0.1 * lay + 0.1 * plate + 0.05 * sfS(uv, 4.0) + 0.04 * sfS(uv + 3.0, 0.3));
  tint *= 1.0 - 0.2 * seam - 0.18 * edge;
  h = -0.03 * seam - 0.03 * edge;`,

  Sandstone: `
  float band = sin(tp.y * 2.4 + sfN(vec2(uv.x * 0.12, tp.y * 0.4)) * 3.0) * sfL(2.6);
  float band2 = sin(tp.y * 7.1 + 1.3) * sfL(0.9);
  tint = vec3(1.0 + 0.06 * band + 0.025 * band2 + 0.05 * sfS(uv, 5.0) + 0.05 * sfS(uv + 3.0, 0.12));
  h = 0.02 * band;`,

  Cobblestone: `
  float w = sfL(1.4);
  if (w > 0.0) {
    vec3 v = sfV(uv / 1.4);
    float e = v.y * 1.4;
    float mortar = (1.0 - smoothstep(0.05, 0.12, e)) * w;
    float dome = smoothstep(0.0, 0.45, e);
    tint = vec3(1.0 + w * (0.2 * (v.z - 0.5) + 0.08 * (dome - 1.0)));
    over = vec4(base * 0.55, 0.85 * mortar);
    h = w * (0.07 * dome - 0.04 * mortar);
  }
  tint *= mix(0.93, 1.0, w) * (1.0 + 0.05 * sfS(uv + 9.0, 0.2) + 0.04 * sfS(uv, 8.0));`,

  Pebble: `
  float w = sfL(0.6);
  if (w > 0.0) {
    vec3 v = sfV(uv / 0.6);
    float e = v.y * 0.6;
    float gap = 1.0 - smoothstep(0.02, 0.07, e);
    tint = vec3(1.0 + 0.22 * (v.z - 0.5) * w) * (1.0 - 0.35 * gap * w);
    h = w * 0.04 * smoothstep(0.0, 0.2, e);
  }
  tint *= mix(0.94, 1.0, w);`,

  Concrete: `
  float a = sfS(uv, 6.0);
  float b = sfS(uv + 4.0, 0.9);
  float c = sfS(uv + 8.0, 0.13);
  float pw = sfL(0.1);
  float pore = pw > 0.0 ? step(0.965, sfH(floor(uv / 0.1))) * pw : 0.0;
  tint = vec3(1.0 + 0.035 * a + 0.03 * b + 0.035 * c - 0.12 * pore);
  h = 0.005 * c - 0.01 * pore;`,

  Marble: `
  float warp = sfN(uv * 0.35) * 4.0 + sfN(uv * 1.1 + 5.0) * 1.2;
  float v1 = abs(sin(uv.x * 0.6 + uv.y * 0.35 + warp));
  float v2 = abs(sin(uv.x * 1.3 - uv.y * 0.9 + warp * 1.7));
  float vein = (1.0 - smoothstep(0.0, 0.12, v1)) * sfL(0.8);
  float vein2 = (1.0 - smoothstep(0.0, 0.06, v2)) * sfL(0.5);
  tint = vec3(1.03 + 0.04 * sfS(uv, 3.0) - 0.12 * vein - 0.06 * vein2);
  r = 1.0 + 0.3 * vein;`,

  Granite: `
  float w = sfL(0.11);
  float dark = w > 0.0 ? smoothstep(0.68, 0.8, sfN(uv / 0.11)) * w : 0.0;
  float lw = sfL(0.07);
  float light = lw > 0.0 ? smoothstep(0.72, 0.85, sfN(uv / 0.07 + 7.0)) * lw : 0.0;
  tint = vec3(1.0 + 0.05 * sfS(uv, 2.5) - 0.2 * dark + 0.14 * light) * mix(0.98, 1.0, w);
  r = 1.0 + 0.25 * dark;`,

  Brick: `
  vec2 q = uv / vec2(2.0, 1.0);
  q.x += 0.5 * mod(floor(q.y), 2.0);
  vec2 cell = floor(q);
  vec2 f = fract(q);
  vec2 fd = min(f, 1.0 - f) * vec2(2.0, 1.0);
  float e = min(fd.x, fd.y);
  float w = sfL(0.5);
  float mortar = (1.0 - smoothstep(0.05, 0.09, e)) * w;
  float bt = (sfH(cell + 0.37) - 0.5) * sfL(1.0);
  tint = vec3(1.0 + 0.16 * bt + 0.05 * sfS(uv + 2.0, 0.25));
  over = vec4(mix(base, vec3(0.3, 0.28, 0.25), 0.65), 0.9 * mortar);
  h = w * 0.03 * smoothstep(0.0, 0.12, e);`,

  WoodPlanks: `
  bool longX = vSurfScale.x >= vSurfScale.z;
  bool wide = fw >= vSurfScale.y;
  float along = top > 0.5 ? (longX ? tp.x : tp.z) : (wide ? hc : tp.y);
  float across = top > 0.5 ? (longX ? tp.z : tp.x) : (wide ? tp.y : hc);
  float pid = floor(across);
  float fa = fract(across);
  float w = sfL(0.4);
  float seam = (1.0 - smoothstep(0.03, 0.07, min(fa, 1.0 - fa))) * w;
  float fj = fract((along + sfH(vec2(pid, 1.7)) * 8.0) / 8.0) * 8.0;
  float joint = (1.0 - smoothstep(0.03, 0.06, min(fj, 8.0 - fj))) * w;
  float pt = (sfH(vec2(pid, 5.3)) - 0.5) * sfL(1.0);
  float gw = sfL(0.12);
  float g = gw > 0.0 ? (sfN(vec2(along * 0.3, across * 8.0 + pid * 3.1)) - 0.5) * 2.0 * gw : 0.0;
  tint = vec3(1.0 + 0.14 * pt + 0.09 * g) * (1.0 - 0.35 * max(seam, joint));
  h = -0.025 * max(seam, joint) + 0.003 * g;`,

  Wood: `
  vec3 s = vSurfScale;
  vec3 ma = s.y >= max(s.x, s.z) ? vec3(0.0, 1.0, 0.0) : (s.x >= s.z ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0));
  float endg = dot(ma, mn);
  vec3 mb = clamp(vec3(1.0) - ma - mn, 0.0, 1.0);
  float along = dot(tp, ma);
  float across = dot(tp, mb);
  float sw = sfL(0.25);
  float streak = sw > 0.0 ? smoothstep(0.58, 0.8, sfN(vec2(across * 4.0, along * 0.35))) * sw : 0.0;
  float tone = sfS(vec2(across, along * 0.15), 0.6);
  float rr = length(vSurfLoc * (vec3(1.0) - ma));
  float rings = sin(rr * 12.0 + sfN(vec2(rr * 2.0, along)) * 1.5) * sfL(0.5);
  vec3 bark = vec3(1.0 + 0.07 * tone) * (1.0 - 0.2 * streak);
  vec3 cut = vec3(1.1 + 0.06 * rings);
  tint = mix(bark, cut, endg);
  h = (1.0 - endg) * (0.004 * tone - 0.02 * streak);`,

  Fabric: `
  float w = sfL(0.16);
  float weave = w > 0.0 ? sin(uv.x * 19.6) * sin(uv.y * 19.6) * w : 0.0;
  float tw = sfL(0.08);
  float thr = tw > 0.0 ? (sfN(vec2(uv.x * 12.0, uv.y * 0.8)) - 0.5) * 2.0 * tw : 0.0;
  tint = vec3(1.0 + 0.06 * weave + 0.04 * thr + 0.04 * sfS(uv, 1.3) + 0.03 * sfS(uv + 3.0, 6.0));
  h = 0.003 * weave;`,

  Metal: `
  float bw = sfL(0.05);
  float br = bw > 0.0 ? (sfN(vec2(uv.x * 0.8, uv.y * 25.0)) - 0.5) * 2.0 * bw : 0.0;
  tint = vec3(1.0 + 0.06 * br + 0.05 * sfS(uv, 2.0));
  r = 1.0 + 0.25 * br;`,

  Water: `
  vec2 p = tp.xz;
  float w1 = sfL(4.0);
  float wv = 0.0;
  if (w1 > 0.0) wv = (sin(p.x * 0.9 + p.y * 0.55 + sfN(p * 0.15) * 4.0) + 0.5 * sin(p.y * 1.6 - p.x * 0.7 + 1.3)) * w1;
  float chop = sfS(p + 3.0, 0.9);
  tint = vec3(1.0 + 0.05 * sfS(p, 40.0) + 0.04 * sfS(p + 9.0, 7.0) + 0.02 * wv);
  h = 0.035 * wv + 0.02 * chop;
  r = 1.0 + 0.4 * (1.0 - w1);`,
};
BODIES.Glass = BODIES.Water;

/** Liga a textura procedural do material `kind` num MeshStandardMaterial. */
function addSurface(m, kind) {
  const body = BODIES[kind];
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}\n${SURF_HEAD}{${body}\n}${SURF_TAIL}`)
      .replace(
        '#include <map_fragment>',
        [
          '#include <map_fragment>',
          'Surf surfOut = sfSurface(diffuseColor.rgb);',
          'diffuseColor.rgb = mix(diffuseColor.rgb * surfOut.tint, surfOut.over.rgb, surfOut.over.a);',
        ].join('\n'),
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * surfOut.r, 0.04, 1.0);',
      )
      .replace(
        '#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\nnormal = sfBump(-vViewPosition, normal, surfOut.h);',
      );
  };
  m.customProgramCacheKey = () => `surf-${kind}`;
  return m;
}

/** Material do visualizador para uma Part: cor da paleta + material do Roblox (textura, rugosidade e metal). */
export function surfaceMaterial(p) {
  const material = p.material ?? 'Plastic';
  const kind = isWet(p) ? 'Water' : material;
  const [roughness, metalness] = PBR[kind] ?? PBR.Plastic;
  const color = srgb(p.color);
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    transparent: p.transparency > 0,
    opacity: 1 - p.transparency,
    depthWrite: p.transparency === 0,
  });
  if (kind === 'Neon') {
    m.emissive.copy(color);
    m.emissiveIntensity = 0.9;
  }
  if (p.studs) return addStuds(m);
  if (BODIES[kind]) return addSurface(m, kind);
  return m;
}
