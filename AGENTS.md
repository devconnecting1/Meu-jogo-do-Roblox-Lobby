# AGENTS.md — regras do projeto Prisão (Roblox)

Leia este arquivo inteiro antes de mudar qualquer coisa. Ele vale para qualquer agente (Claude, Codex, Copilot…) e para humanos.

## 1. O que é

Uma **prisão fechada** para Roblox, feita só com Part clássico, descrita como **dados puros** em JavaScript.
O mesmo arquivo gera:

- o lugar do Roblox (`src/rojo.js` → Rojo → `.rbxl` → Open Cloud);
- o visualizador 3D (`viewer/main.js`, Three.js) e as capturas do CI.

Escopo atual: **somente a prisão**. Não criar UI, NPC, script, sistema de jogo, som ou exterior.

## 2. Regras de ouro (não negociáveis)

1. **Nada roda localmente.** Testes, build, capturas e publicação rodam no GitHub Actions (`.github/workflows/ci.yml`, `ubuntu-latest`, gratuito em repositório público). Para validar uma mudança: commit → push → ler os comentários que o CI posta no PR.
2. **Fonte única:** o mapa vive em `src/prison.js`. Nunca edite o lugar no Roblox Studio, porque a próxima publicação sobrescreve tudo.
3. **Part clássico:** `Part` (Block) e `SpawnLocation`. `Cylinder` é permitido só como tampo girado (mesas). Proibido: MeshPart, Union, Decal, Texture, SurfaceGui, BillboardGui, Humanoid e Script.
4. **Materiais:** `Plastic` em tudo e `Neon` **apenas** em lâmpadas (sem colisão). Studs (`TopSurface = Studs`) só em pisos baixos; paredes lisas.
5. **Cores neutras:** use só `src/palette.js`. Saturação HSV ≤ 0,3 (testado). Não espalhe RGB solto pelo layout.
6. **Ambiente fechado:** piso, teto e 4 paredes opacos, sem janelas, portas ou claraboias para fora. Não existe exterior nem saída.
7. **Tudo se sustenta:** nenhuma peça flutua, nenhuma face visível faz z-fighting, nenhuma peça bloqueia passagem, e toda borda com queda tem guarda-corpo.
8. **Segredos:** a chave Open Cloud só existe no GitHub (Secrets/Variables). Nunca commitar chaves; o publicador mascara a chave no log.

## 3. Mapa do repositório

| Caminho | Papel |
|---|---|
| `src/palette.js` | Paleta neutra (`C`) + `saturation()` |
| `src/builder.js` | `makeBuilder()` (`box`/`span`), `rotationMatrix`, `aabb`, `stats` |
| `src/prison.js` | **Layout** (`buildPrison`), dimensões (`DIM`), zonas livres (`clearanceZones`), bordas (`fallEdges`), limites (`ENVELOPE`/`INTERIOR`) |
| `src/checks.js` | Verificações: flutuação, z-fighting, passagens, guarda-corpo e limites |
| `src/rojo.js` | Parts → `.model.json` do Rojo (enums Roblox) |
| `default.project.json` | Projeto Rojo: Workspace + **Lighting** (Future, efeitos) |
| `tests/*.test.mjs` | Regras de geometria, estilo e Rojo (node:test, sem dependências) |
| `tools/build-place.mjs` | Gera `build/Prisao.model.json` |
| `tools/publish.mjs` | Publica `.rbxl` via Open Cloud (com novas tentativas e máscara da chave) |
| `tools/screenshots.mjs` | Renderiza as vistas do visualizador (Playwright) |
| `tools/ci/*` | Verificação do lugar, branch `ci-previews` e comentários no PR |
| `viewer/main.js`, `index.html` | Visualizador Three.js |

## 4. Como construir (receita)

```js
// dentro de buildPrison(), em src/prison.js
b.span('Área/Sub', 'Nome', [x0, y0, z0], [x1, y1, z1], C.cor, { canCollide, studs, transparency, material, light });
b.box('Área/Sub', 'Nome', [cx, cy, cz], [sx, sy, sz], C.cor);
```

- **Unidades:** studs. Y para cima. Interior: x −70…70, z −40…40, y 0…34. Térreo y=0; 2º andar y=16.
- **Escala do jogador:** personagem de 5 studs. Pé-direito de 15 por andar, portas de 3×9 ou mais, corredores com 5 ou mais de largura e degraus de **até 1 stud**.
- **Apoio:** toda peça precisa **encostar** em outra que já esteja ligada à `Laje Térreo`. Luminárias levam haste até o teto (`hangingLight`) ou encostam no teto (`panelLight`).
- **Peça decorativa colada em superfície** (friso, faixa, placa): use `canCollide: false` e desloque-a para fora da face (por exemplo, `-0.08`), **nunca** no mesmo plano da face.
- **Recortes (janela/porta):** monte a parede em pedaços em volta do vão. Caixilhos ficam **dentro** do vão, não sobre a parede.
- **Nova área transitável:** adicione uma zona em `clearanceZones()`. Bordas novas com queda vão em `fallEdges()`.
- **Nova cor:** adicione em `src/palette.js` (neutra) e reutilize.
- **Luz:** sempre numa peça `Neon` sem colisão. `light: { type: 'Point' | 'Surface', range, brightness, color }`. Orçamento: até 120 luzes.

## 5. Testes (o que cada um protege)

| Teste | Protege contra |
|---|---|
| nada flutua | peças soltas no ar (grafo de contato a partir da laje) |
| sem z-fighting | duas faces visíveis no mesmo plano com cores diferentes (tremulação) |
| passagens livres | colisão bloqueando corredor, porta de cela, escada, ponte ou spawn |
| guarda-corpo contínuo | buracos na borda do 2º andar (amostrado a cada 0,25 stud) |
| envoltória | peças fora do prédio e exterior visível |
| ambiente fechado | parede, piso ou teto faltando ou transparente |
| escada | degrau maior que 1 stud, ou escada que não chega ao 2º andar |
| spawn | zero ou vários SpawnLocation, ou spawn fora do piso |
| 32 celas | cela sem cama, vaso, pia, janela, porta ou luz |
| estilo | classe, shape, material, Neon com colisão, campos desconhecidos (UI/NPC/script) |
| cores neutras | saturação maior que 0,3 |
| orçamento | mais de 5000 Parts ou mais de 120 luzes |
| determinismo | resultado diferente entre duas montagens |
| Rojo/projeto | enums errados, Lighting fora de Future, serviços extras (scripts/UI) |
| `verify-place` (CI) | o `.rbxl` real com contagem errada, instância proibida ou material inesperado |

Quando um teste falhar, a mensagem lista a peça (`Modelo/Nome @ [x, y, z]`). Corrija a geometria, não o teste. Só mude um teste quando a **regra** mudar, e registre isso aqui.

## 6. Problemas conhecidos e como evitar

- **Z-fighting:** duas peças com faces coplanares e cores diferentes. Desloque a decorativa (0,05 a 0,1), deixe uma por dentro da outra, ou use a mesma cor.
- **Colisão invisível:** peças decorativas (frisos, portas abertas, lâmpadas) usam `canCollide: false`. Vidro de guarda-corpo **colide** de propósito.
- **Degrau alto:** o personagem sobe no máximo cerca de 1 stud sem pular. A escada usa degraus de 1 × 1,125.
- **Sobreposição de colisão em passagens:** sempre confira `clearanceZones()` ao mover móveis.
- **Peças giradas** ficam fora da checagem de z-fighting. Evite girar; só tampos cilíndricos.
- **Open Cloud:** a API recusa `.rbxlx` feito à mão ("Invalid Content stream"). Publique sempre o `.rbxl` **binário do Rojo**.
- **`Lighting.Technology`** não é alterável por script; vai no `default.project.json` (Future = 4). Se o Rojo mudar de versão, confira o `verify-place`.
- **Cilindro do Roblox** tem o eixo em X. O tampo usa `rotation: [0, 0, 90]`.
- **CanQuery = false** só é permitido com CanCollide = false (o conversor já respeita isso).
- **Publicação substitui o lugar inteiro.** O histórico de versões fica no Creator Hub.

## 7. CI/CD (`.github/workflows/ci.yml`)

| Job | Quando | O que faz |
|---|---|---|
| `test` | sempre | `node --test`, resumo e comentário no PR |
| `build` | depois de `test` | Rojo gera `.rbxl`/`.rbxlx`, roda `verify-place`, artefato `lugar` |
| `render` | depois de `test` (sem forks) | Playwright gera as capturas, envia ao branch `ci-previews` e comenta no PR |
| `publish` | PR do próprio repo, push na `main` ou manual | Open Cloud publica o `.rbxl` (fila única `roblox-publish`) |
| `pages` | push na `main` | visualizador no GitHub Pages |

Credenciais (Settings → Secrets and variables → Actions):

- `ROBLOX_CLOUD_API`: de preferência como Secret; o CI também lê de Variables.
- `ROBLOX_UNIVERSE_ID` e `ROBLOX_LOCAL_ID`: opcionais; o padrão está em `roblox.config.json`.

## 8. Checklist de PR

- [ ] Mudança só em `src/` (layout/paleta) ou em ferramentas, com regra nova documentada aqui
- [ ] CI verde: testes, build, capturas e publicação
- [ ] Conferi as capturas do comentário "📸 Como ficou"
- [ ] Nenhuma chave, ID secreto ou arquivo gerado (`build/`, `out/`) commitado
