// Variantes do mapa por servidor. A semente padrão (SEED) é o mapa principal, que fica no
// Workspace; as outras vão para ServerStorage/Mapas e o script EscolherMapa sorteia uma
// por servidor (cada servidor tem um reino diferente). Toda semente daqui passa pelos
// mesmos testes do mapa principal (tests/variants.test.mjs) antes de ir para o lugar.
export const VARIANT_SEEDS = Object.freeze([101, 2027, 4242, 77777]);

/** Nome da variante no ServerStorage (o script usa o nome como atributo do Workspace). */
export const variantName = (seed) => `Semente ${seed}`;
