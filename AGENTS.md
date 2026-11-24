# AGENTS.md — regras do projeto Reino (Roblox)

Leia este arquivo inteiro antes de mudar qualquer coisa. Ele vale para qualquer agente (Claude, Codex, Copilot…) e para humanos.

## 1. O que é

O **mapa base** de um jogo de estratégia no estilo Lords Mobile, feito só com **Part clássico** e descrito como **dados puros** em JavaScript (`src/map.js`).
O mesmo arquivo gera:

- o lugar do Roblox (`src/rojo.js` → Rojo → `.rbxl` → Open Cloud);
- o visualizador 3D (`viewer/main.js`, Three.js) e as capturas do CI.

Escopo atual: **somente o mapa e a decoração**. Ainda não existe UI, NPC, script, castelo de jogador nem sistema de jogo. Os 30 lotes (20 jogadores + 10 bots) ficam prontos para o jogo sortear quem fica em cada um.

A prisão antiga (projeto anterior) está guardada no branch `arquivo/prisao`. Ela não é renderizada nem publicada.

## 2. Regras de ouro (não negociáveis)

1. **Nada roda localmente.** Testes, build, capturas e publicação rodam no GitHub Actions (`.github/workflows/ci.yml`, `ubuntu-latest`). Para validar uma mudança: commit → push → ler os comentários que o CI posta no PR.
2. **Fonte única:** o mapa vive em `src/map.js`. Nunca edite o lugar no Roblox Studio, porque a próxima publicação sobrescreve tudo.
3. **Part clássico:** `Part` (Block, Cylinder ou Ball) e um `SpawnLocation`. Proibido: MeshPart, Union, Decal, Texture, SurfaceGui, BillboardGui, Humanoid, Script, LocalScript e `Sky` customizado (testado no `verify-place`).
4. **Estilo clássico (como as referências):** studs no topo de **toda** peça e inlet embaixo (`classicBuilder` faz isso sozinho). Só o mar e a água ficam lisos. Material `Plastic`; `Neon` só em lâmpada que emite luz (hoje não há nenhuma).
5. **Cores neutras:** use só `src/palette.js`. Saturação HSV ≤ 0,55 (testado). Cores com vida, mas foscas: nada de verde-limão, rosa ou roxo. Não espalhe RGB solto.
6. **Mapa determinístico:** tudo sai da semente `SEED`. A mesma semente gera o mesmo mapa (testado). Mudou a semente? Confira as capturas inteiras.
7. **Tudo se sustenta:** nenhuma peça flutua (cadeia de contato até o `Mar`), nenhuma face visível faz z-fighting e nenhuma peça com colisão invade as zonas livres (`clearanceZones()`): área dos castelos, estradas, pontes, caminhos da praça e spawn. O **manual de montagem** (`src/manual.js`) precisa montar cada peça sobre algo já montado.
8. **Lotes:** 30 fundações de 32×32 sobre a grama, a pelo menos 84 studs uma da outra (120 quando cabe), 110 da praça e do lago e 52 do rio, espalhadas pelos quatro quadrantes. **Toda** fundação liga na praça por estrada (testado). Lote que não dá para ligar é trocado de lugar automaticamente (`planKingdom`).
9. **Estradas e pontes:** estradas de 8 studs, só sobre a grama, em trechos retos (L ou Z). Sobre o rio vira ponte de madeira (até 50 studs) com vigas, postes e corrimão; o guarda-corpo é interrompido onde outra estrada cruza. Curva de estrada nunca fica em cima da água.
10. **Cada coisa no seu lugar:** praça no centro (estátua do rei, mercado com 4 barracas, caixotes, canteiros de flores e colunas antigas, com 4 caminhos livres até as saídas); planaltos, florestas, campos, jazidas e cais ficam longe dos lotes e das estradas. Decoração (copa, galho, arbusto, pedra, flor, trigo, bandeira, toldo) não colide.
11. **Peça girada:** pode girar em Y e ainda colidir (piso octogonal, pedestal, caixote torto). Inclinada em X ou Z **nunca colide** (pedras, galhos, pedaço de coluna). O teste de z-fighting ignora peças giradas; o de apoio usa a caixa envolvente.
12. **Luz de dia equilibrada:** Lighting Future, `ClockTime` de dia, `Brightness` 1 a 3, ambiente ≤ 0,6, correção de cor sem saturar, bloom leve e `Atmosphere` "Neblina Leve" (o horizonte some suave).
13. **Segredos:** a chave Open Cloud só existe no GitHub (Secrets/Variables). Nunca commitar chaves; o publicador mascara a chave no log.

## 3. Mapa do repositório

| Caminho | Papel |
|---|---|
| `src/palette.js` | Paleta neutra (`C`) + `saturation()` |
| `src/builder.js` | `makeBuilder()` (`box`/`span`), `rotationMatrix`, `aabb`, `stats` |
| `src/map.js` | **Mapa** (`buildMap`), dimensões (`DIM`), lotes (`PLOTS`), praça (`PLAZA`), terreno (`terrainAt`), zonas livres (`clearanceZones`), limites (`ENVELOPE`) |
| `src/checks.js` | Verificações: flutuação, z-fighting, passagens e limites |
| `src/rojo.js` | Parts → `.model.json` do Rojo (enums Roblox; studs em cima, inlet embaixo) |
| `src/manual.js` | Manual de montagem: fases, etapas de até 8 peças, simulação de apoio e contagem de conexões |
| `default.project.json` | Projeto Rojo: Workspace + **Lighting** (Future, dia, efeitos leves) |
| `tests/*.test.mjs` | Regras de geometria, mapa, estilo, Rojo e manual (node:test, sem dependências) |
| `tools/build-place.mjs` | Gera `build/Reino.model.json` |
| `tools/publish.mjs` | Publica `build/reino.rbxl` via Open Cloud (com novas tentativas e máscara da chave) |
| `tools/screenshots.mjs` | Renderiza as vistas do visualizador (Playwright), inclusive os estágios da montagem |
| `tools/manual.mjs` | Gera `MANUAL.md` e `manual.json` (publicados no branch `ci-previews`) |
| `tools/ci/*` | Verificação do lugar, branch `ci-previews` e comentários no PR |
| `viewer/main.js`, `index.html` | Visualizador Three.js (tudo instanciado; studs por shader em coordenadas de mundo) |

## 4. Como construir (receita)

```js
// dentro de buildMap(), em src/map.js
b.span('Área/Sub', 'Nome', [x0, y0, z0], [x1, y1, z1], C.cor, { canCollide, transparency, rotation });
b.box('Área/Sub', 'Nome', [cx, cy, cz], [sx, sy, sz], C.cor);
```

- **Unidades:** studs, Y para cima. Ilha em x,z ∈ [−600, 600] (grade de 16), mar até ±800. Grama no topo y = 4, areia y = 3, água y = 2,6, mar y = 0. **Medidas saem de `DIM`**: mude a escala lá, nunca com números soltos.
- **Escala do jogador:** personagem de 5 studs, degraus de até 1 stud (escadas dos planaltos), estradas de 8, caminhos da praça de 8.
- **Apoio:** toda peça precisa **encostar** em outra já ligada ao `Mar`. Peças baixas entram 0,1 na grama (ex.: fundação começa em y = 3,9).
- **Base de peça deitada:** cada tipo tem sua altura de base para não empatar (fundação 3,9; praça 3,95; terra arada 3,92; degrau 3,88; estrada 4,0).
- **Nova área transitável:** adicione uma zona em `clearanceZones()`.
- **Nova decoração:** sorteie com `rand()` (nunca `Math.random`), respeite `free()`, `awayFromPlots()`, `distToRoads()` e `allGrass()`, e registre o retângulo em `blocked`.
- **Nova cor:** adicione em `src/palette.js` (saturação ≤ 0,55) e reutilize.

## 5. Testes (o que cada um protege)

| Teste | Protege contra |
|---|---|
| nada flutua | peças soltas no ar (grafo de contato a partir do `Mar`) |
| sem z-fighting | duas faces visíveis no mesmo plano com cores diferentes (tremulação) |
| passagens livres | colisão sobre os lotes, estradas, pontes, caminhos da praça ou spawn |
| limites / ilha | peça fora do mapa, ilha encostando na borda da grade |
| terreno | grama, areia, rio e lago faltando ou na altura errada; água com colisão |
| lotes | menos de 30, nomes repetidos, perto demais, fora da grama, um quadrante vazio |
| estradas | lote sem caminho até a praça, estrada fora da grama, ponte fora do rio |
| praça / mercado | sem estátua, spawn fora do piso, barraca incompleta, sem caixotes, canteiros ou colunas |
| escadarias | degrau maior que 1,1 stud ou escada que não chega ao topo |
| decoração | poucas árvores, sem outono, planaltos, pedras, campos, jazidas ou cais |
| estilo | classe, shape, material, Neon sem luz, campos desconhecidos (UI/NPC/script), cor fora da paleta, studs fora do lugar |
| orçamento | mais de 8000 Parts ou 60 luzes |
| determinismo | resultado diferente entre duas montagens |
| manual de montagem | peça que não se apoia em nada já montado, etapa com mais de 8 peças, fases fora de ordem |
| Rojo/projeto | enums errados, Lighting fora de Future ou de noite, serviços extras (scripts/UI) |
| `verify-place` (CI) | o `.rbxlx` real com contagem errada, instância proibida, material inesperado ou spawn faltando |

Quando um teste falhar, a mensagem lista a peça (`Modelo/Nome @ [x, y, z]`). Corrija a geometria, não o teste. Só mude um teste quando a **regra** mudar, e registre isso aqui.

## 6. Problemas conhecidos e como evitar

### 6.1 Lições aprendidas no CI (não repetir)

Cada item já derrubou o CI uma vez (a maioria no projeto da prisão; continuam valendo). Confira a peça nova contra esta lista antes do push.

| Falha | Causa real | Como evitar |
|---|---|---|
| "só os campos conhecidos de Part" / UI | o nome continha `gui` (ex.: "Guia") e o teste procura `npc\|gui\|decal\|texture\|script` em `modelo/nome` | não use nomes com essas sílabas: "Trilho", não "Guia" |
| "tamanho 0.02" | peça com alguma medida < 0,04 | espessura mínima 0,04 (bandeiras e franjas usam 0,2) |
| z-fighting em Y = topo do piso | duas peças deitadas com a **base** no mesmo plano e cores diferentes, cruzando a junta de duas faixas do terreno | cada tipo de peça deitada tem sua altura de base (seção 4) |
| z-fighting em face lateral | peça encostada com a face no mesmo plano de outra de outra cor | afaste 0,1 ou faça uma encostar na outra pelo lado oposto |
| "não se apoia em nada montado antes" | peça presa em algo de uma fase do manual que vem depois | confira a ordem de `PHASES` em `src/manual.js` |
| "Bloqueia zona" | decoração com colisão dentro de uma zona livre | enfeite perto de passagem usa `canCollide: false`; confira `clearanceZones()` |
| "Neon sem luz é lâmpada falsa" | peça brilhando sem emitir luz | lâmpada apagada é `Plastic` |
| Prettier | linhas longas escritas à mão | nunca formate à mão: incorpore `autoformat/pr-N` |
| capturas canceladas | push novo enquanto o job `render` ainda roda (o CI cancela o anterior) | espere "📸 Como ficou" antes do próximo push, a não ser que haja teste vermelho para corrigir |
| captura com a vista anterior | o SwiftShader demora a desenhar muitas malhas | tudo instanciado no visualizador; o CI espera 2 quadros antes de capturar |

- **Z-fighting:** duas peças com faces coplanares e cores diferentes. Desloque a decorativa (0,05 a 0,1), deixe uma por dentro da outra, ou use a mesma cor.
- **Guarda-corpo da ponte:** postes ficam em |w| = 4,7 (fora da faixa de 8 da estrada). Se outra estrada cruza, o poste e o corrimão daquele trecho somem (senão bloqueiam a passagem).
- **Estrada sob a fundação:** a estrada termina no centro do lote, por baixo da fundação (3,9 a 4,6 cobre 4,0 a 4,3). Não suba a estrada acima de 4,6.
- **Cilindro do Roblox** tem o eixo em X. O tampo usa `rotation: [0, 0, 90]`.
- **CanQuery = false** só é permitido com CanCollide = false (o conversor já respeita isso).
- **Open Cloud:** a API recusa `.rbxlx` feito à mão ("Invalid Content stream"). Publique sempre o `.rbxl` **binário do Rojo**.
- **`Lighting.Technology`** não é alterável por script; vai no `default.project.json` (Future = 4).
- **Publicação substitui o lugar inteiro.** O histórico de versões fica no Creator Hub.

## 7. CI/CD (`.github/workflows/ci.yml`)

| Job | Quando | O que faz |
|---|---|---|
| `lint` | sempre | Prettier `--check` + ESLint. Se falhar num PR, publica a correção em `autoformat/pr-N` (incorporar com `git merge origin/autoformat/pr-N`) |
| `test` | sempre | `node --test`, resumo e comentário no PR |
| `build` | depois de `test` | Rojo gera `build/reino.rbxl`/`.rbxlx`, roda `verify-place`, artefato `lugar` |
| `render` | depois de `test` (sem forks) | Playwright gera as capturas e os estágios da montagem, `tools/manual.mjs` gera o manual; tudo vai para o branch `ci-previews` e para um comentário no PR |
| `publish` | PR do próprio repo, push na `main` ou manual | Open Cloud publica o `.rbxl` (fila única `roblox-publish`) |
| `pages` | push na `main` | visualizador no GitHub Pages |

Credenciais (Settings → Secrets and variables → Actions):

- `ROBLOX_CLOUD_API`: de preferência como Secret; o CI também lê de Variables.
- `ROBLOX_UNIVERSE_ID` e `ROBLOX_LOCAL_ID`: opcionais; o padrão está em `roblox.config.json`.

## 8. Checklist de PR

- [ ] Mudança só em `src/` (mapa/paleta) ou em ferramentas, com regra nova documentada aqui
- [ ] CI verde: lint, testes, build, capturas e publicação
- [ ] Merge só com tudo verde; depois do merge, o push na `main` republica o lugar e o Pages
- [ ] Conferi as capturas do comentário "📸 Como ficou"
- [ ] Nenhuma chave, ID secreto ou arquivo gerado (`build/`, `out/`) commitado
