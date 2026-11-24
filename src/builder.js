// Ferramentas genéricas para descrever Parts como dados puros.
// Nada aqui sabe sobre a prisão: é reaproveitável e testado em tests/.

/** Arredonda para 3 casas (evita lixo de ponto flutuante nos arquivos gerados). */
export const round = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};

/**
 * Cria um construtor de partes.
 * Cada Part é um objeto simples com: model (caminho "A/B/C"), name, position (centro),
 * size, color [r,g,b] 0-255, transparency, canCollide, rotation [rx,ry,rz] graus|null,
 * light {type:'Point'|'Surface', range, brightness, color}|null, className, shape,
 * material ('Plastic'|'Neon'), studs (TopSurface = Studs), surface ('Inlet'|'Weld'|'Universal' nas faces
 * laterais e no topo, relevo clássico do Roblox), group (camada do visualizador).
 */
export function makeBuilder() {
  const parts = [];
  const api = {
    parts,
    /** Caixa pelo centro e tamanho. */
    box(model, name, center, size, color, opts = {}) {
      const part = {
        model,
        name,
        position: center.map(round),
        size: size.map(round),
        color,
        transparency: opts.transparency ?? 0,
        canCollide: opts.canCollide ?? true,
        rotation: opts.rotation ?? null,
        light: opts.light ?? null,
        className: opts.className ?? 'Part',
        shape: opts.shape ?? 'Block',
        material: opts.material ?? 'Plastic',
        studs: opts.studs ?? false,
        surface: opts.surface ?? null,
        group: opts.group ?? model.split('/')[0],
      };
      parts.push(part);
      return part;
    },
    /** Caixa pelos cantos opostos (em qualquer ordem). */
    span(model, name, a, b, color, opts) {
      const center = [0, 1, 2].map((i) => (a[i] + b[i]) / 2);
      const size = [0, 1, 2].map((i) => Math.abs(b[i] - a[i]));
      return api.box(model, name, center, size, color, opts);
    },
  };
  return api;
}

/** Matriz 3x3 (linhas) de CFrame.Angles(rx, ry, rz) em graus = Rx * Ry * Rz. */
export function rotationMatrix(rot) {
  if (!rot) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const [ax, ay, az] = rot.map((d) => (d * Math.PI) / 180);
  const cx = Math.cos(ax),
    sx = Math.sin(ax);
  const cy = Math.cos(ay),
    sy = Math.sin(ay);
  const cz = Math.cos(az),
    sz = Math.sin(az);
  const r6 = (v) => {
    const r = Math.round(v * 1e6) / 1e6;
    return Object.is(r, -0) ? 0 : r;
  };
  return [
    cy * cz,
    -cy * sz,
    sy,
    cx * sz + sx * sy * cz,
    cx * cz - sx * sy * sz,
    -sx * cy,
    sx * sz - cx * sy * cz,
    sx * cz + cx * sy * sz,
    cx * cy,
  ].map(r6);
}

/** Caixa alinhada aos eixos (AABB) de uma Part, considerando a rotação. */
export function aabb(p) {
  const m = rotationMatrix(p.rotation);
  const half = [0, 1, 2].map((i) => [0, 1, 2].reduce((acc, j) => acc + Math.abs(m[i * 3 + j]) * (p.size[j] / 2), 0));
  return {
    min: p.position.map((c, i) => c - half[i]),
    max: p.position.map((c, i) => c + half[i]),
  };
}

/** Contagem por grupo (usado no visualizador e no CI). */
export function stats(parts) {
  const groups = {};
  for (const p of parts) groups[p.group] = (groups[p.group] || 0) + 1;
  return { total: parts.length, lights: parts.filter((p) => p.light).length, groups };
}
