// Referencial local de uma construção do Vale (lojas do Lobby e castelos dos lotes).
//
// Cada construção é desenhada em coordenadas locais, na mesma planta de `PLANS` (src/map.js):
//   u = lado (x local), v = frente/fundo (z local, a FRENTE do prédio fica em +v, virada para o Lobby),
//   y = altura a partir do chão do vale (y = 0 é o topo do terreno, y = 4 no mundo).
// O referencial gira a planta em passos de 90° (`plot.rot`) e leva para o centro do lote/área.
//
// Regras do estilo voxel liso (AGENTS.md):
//   * só blocos alinhados aos eixos (nada de `rotation`): é pixel art em 3D;
//   * tudo começa em y >= 0 (o piso da construção encosta no topo do terreno, nunca entra nele);
//   * nada sai da planta (cada peça fica dentro de algum retângulo/círculo da planta);
//   * nada com colisão dentro das zonas de passagem que a construção declara (`zone`).

/** Gira (u, v) em passos de 90°: a frente +v vai para +z, −x, −z e +x (igual a src/map.js). */
const rot90 = (x, z, k) =>
  [
    [x, z],
    [-z, x],
    [-x, -z],
    [z, -x],
  ][k & 3];

/**
 * Cria o referencial de uma construção.
 * @param b builder (makeBuilder)
 * @param model caminho do modelo (ex.: 'Construções/Taverna')
 * @param plot { x, z, rot } (centro do lote/área no mundo e giro 0..3)
 * @param floorY altura do chão do vale no mundo (DIM.land)
 * @param zones lista compartilhada de zonas de passagem (a submontagem usa a mesma)
 */
export function makeFrame(b, model, plot, floorY, zones = []) {
  const toWorld = (u, v) => {
    const [dx, dz] = rot90(u, v, plot.rot);
    return [plot.x + dx, plot.z + dz];
  };
  const box3 = ([u0, y0, v0], [u1, y1, v1]) => {
    const [ax, az] = toWorld(u0, v0);
    const [cx, cz] = toWorld(u1, v1);
    return {
      min: [Math.min(ax, cx), floorY + Math.min(y0, y1), Math.min(az, cz)],
      max: [Math.max(ax, cx), floorY + Math.max(y0, y1), Math.max(az, cz)],
    };
  };
  return {
    model,
    toWorld,
    zones,
    /** Peça pelos cantos opostos em coordenadas locais (u, y, v). */
    span(name, a, c, color, opts = {}) {
      if (opts.rotation) throw new Error(`${model}/${name}: peça girada não entra no estilo voxel`);
      const { min, max } = box3(a, c);
      return b.span(model, name, min, max, color, opts);
    },
    /** Submontagem (outro modelo, mesmo referencial), ex.: frame.sub('Mesa 1').span(...). */
    sub(suffix) {
      return makeFrame(b, `${model}/${suffix}`, plot, floorY, zones);
    },
    /** Zona de passagem do jogador (porta, corredor, salão): nada com colisão pode entrar nela. */
    zone(name, a, c) {
      const { min, max } = box3(a, c);
      zones.push({ name: `${model}: ${name}`, min, max });
    },
  };
}
