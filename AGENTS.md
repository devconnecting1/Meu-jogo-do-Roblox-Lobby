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
3. **Part clássico:** `Part` (Block, Cylinder ou Ball) e um `SpawnLocation` por mapa. Proibido: MeshPart, Union, Decal, Texture, SurfaceGui, BillboardGui, Humanoid, LocalScript, ModuleScript e `Sky` customizado (testado no `verify-place`). **Única exceção de script:** `EscolherMapa` (`src/game/escolher-mapa.server.luau`, ServerScriptService), que só sorteia a variante do mapa do servidor; não cria instâncias nem mexe em jogador, UI, rede ou dados (testado).
3b. **Um mapa diferente por servidor (procedural):** `createWorld(semente)` gera ilha, lago, rio, lotes, estradas e decoração a partir da semente. A semente padrão `SEED` é o mapa principal (Workspace/Reino, capturas e visualizador). As sementes de `src/variants.js` viram `ServerStorage/Mapas/Semente N`; o `EscolherMapa` sorteia entre o principal e as variantes. Cada variante passa pelos mesmos testes do principal (`tests/variants.test.mjs`) e aparece nas capturas do PR (`variante-N.png`). Para ver qualquer semente: visualizador com `#seed=N`. Mapa realmente infinito (semente nova a cada servidor, gerada no Roblox) exigiria portar o gerador para Luau; hoje o banco de variantes é a forma segura, porque tudo que vai para o lugar foi testado no CI.
4. **Estilo clássico (como as referências):** studs no topo de **toda** peça e inlet embaixo (`classicBuilder` faz isso sozinho). Só o mar e a água ficam lisos. Material `Plastic`; `Neon` só em lâmpada que emite luz (hoje não há nenhuma).
5. **Cores neutras:** use só `src/palette.js`. Saturação HSV ≤ 0,55 (testado). Cores com vida, mas foscas: nada de verde-limão, rosa ou roxo. Não espalhe RGB solto.
6. **Mapa determinístico:** tudo sai da semente `SEED`. A mesma semente gera o mesmo mapa (testado). Mudou a semente? Confira as capturas inteiras.
7. **Tudo se sustenta:** nenhuma peça flutua (cadeia de contato até o `Mar`), nenhuma face visível faz z-fighting e nenhuma peça com colisão invade as zonas livres (`clearanceZones()`): área dos castelos, estradas, pontes, caminhos da praça e spawn. O **manual de montagem** (`src/manual.js`) precisa montar cada peça sobre algo já montado.
8. **Lotes:** 30 fundações de 32×32 sobre a grama, a pelo menos 84 studs uma da outra (120 quando cabe), 110 da praça e do lago e 52 do rio, espalhadas pelos quatro quadrantes. **Toda** fundação liga na praça por estrada (testado). Lote que não dá para ligar é trocado de lugar automaticamente (`planKingdom`).
9. **Estradas e pontes:** estradas de 8 studs, só sobre a grama, em trechos retos (L ou Z). Sobre o rio vira ponte de madeira (até 50 studs) com vigas, postes e corrimão; o guarda-corpo é interrompido onde outra estrada cruza. Curva de estrada nunca fica em cima da água.
10. **Cada coisa no seu lugar:** o **Lobby** fica no centro: plataforma elevada de 88×88, 6 studs acima da grama, com mureta na borda e **4 escadarias de madeira** (6 degraus de 1 stud, postes e corrimão) que descem até o começo das estradas. Em cima: estátua do rei, mercado com 4 barracas de toldo listrado, caixotes, canteiros de flores, colunas antigas e o spawn, com 4 caminhos livres até as escadarias. Estrada nunca entra no quadrado do Lobby + escadarias (`LOBBY_GUARD`); planaltos, florestas, campos, jazidas e cais ficam longe dos lotes e das estradas. Decoração (copa, galho, arbusto, pedra, flor, trigo, bandeira, toldo) não colide.
10b. **Montanhas naturais, não caixas:** `mountain()` é um mapa de alturas em colunas (grade de 3 a 6 studs, degraus de 1,5): pico principal + 1 ou 2 picos secundários + ruído de cristas, apagando na borda. Cor pela altura: encosta de grama com lateral de terra (`C.soil`), rocha listrada no meio (vermelha na região seca) e neve acima de 72% nas altas. Colunas iguais da mesma linha viram uma peça só (orçamento). Pinheiros nas encostas de grama. Colinas e afloramentos usam o mesmo gerador.
10c. **Tudo liga em algo:** a malha de estradas cresce do Lobby para fora; cada lote liga no ponto mais próximo da malha (cruzamento em "T"), sem atravessar outros lotes e sem correr colada (< 16 studs) numa estrada paralela. Cada vila, campo, jazida, torre de vigia e acampamento **só é construído se a sua trilha de terra (4 studs) chegar na estrada** (`addTrail`); nas vilas a trilha vem primeiro e as casas ficam em volta, sem bloqueá-la.
10e. **Vila é cidade, não amontoado:** cada vila tem rua de pedra (6 studs) atravessando, praça com o poço no meio, rua lateral até um largo com casas em volta (como os pátios das vilas reais), casas dos dois lados viradas para a rua, cada uma com calçada até a porta e quintal cercado com jardim atrás; celeiro, feno e moinho ficam na saída, fora do eixo da rua. Uma ponta da rua liga na estrada por trilha, e as trilhas dos campos podem ligar na rua. Um anel de floresta densa cerca cada vila (testado: rua, praça, largo, calçadas e cercas).
10g. **Biomas e costa:** cada semente gira três regiões: **seca** (setor externo com areia firme `C.desertSand`, coqueiros, árvores secas, mato seco `C.hay` e rocha avermelhada `C.rockDesert` nas montanhas, sem neve), **floresta escura** (pinheiros fechados) e **campo** (o resto). Parte da costa vira **falésia** (grama até a beira, barranco claro `C.cliff`, sem praia). Inspiração: princípios gerais de mapas de ilha (regiões distintas, costa variada, florestas densas, vilas espalhadas), nunca a cópia do mapa de outro jogo (testado: região seca, falésias, pinheiros e coqueiros).
10h. **Regiões de fazenda:** grade de 6 campos cercados (trigo, repolho, abóbora, milho) com corredores de terra entre eles, espantalho e sede (casa, celeiro, feno) virada para os campos; só no campo aberto, ligada à estrada por trilha (testado: 6 campos e sede).
10f. **Nada de grama vazia:** além das florestas, bosquetes no campo aberto, ~900 tufos de mato e ~260 pedrinhas (sem colisão), 260 arbustos, 110 canteiros de flores, 110 grupos de pedras e 22 afloramentos de rocha; orçamento `DIM.maxParts` (18000) por mapa (testado).
10d. **Módulos de peças (`src/props/`)**: `statue.js` (fonte com o boneco R6 clássico erguendo o logo), `trees.js` (8 tipos de árvore, arbustos e flores), `buildings.js` (casa, celeiro, moinho, poço, torre de vigia, feno, tenda). Cada módulo tem o seu teste isolado (`tests/statue|trees|buildings.test.mjs`) que monta a peça sobre um chão e roda apoio, z-fighting, paleta e colisão. Peça nova = função no módulo + caso no teste + entrada no catálogo (seção 9).
11. **Peça girada:** pode girar em Y e ainda colidir (piso octogonal, pedestal, caixote torto). Inclinada em X ou Z **nunca colide** (pedras, galhos, pedaço de coluna). O teste de z-fighting ignora peças giradas; o de apoio usa a caixa envolvente.
12. **Luz de dia realista:** Lighting Future, tarde (`ClockTime` 14,6, latitude 32), sol 2,4 com sombra macia, ambiente ≤ 0,6, `ColorShift_Top` levemente quente, correção de cor com contraste leve e saturação ≤ 0, bloom ≤ 0,3, `SunRaysEffect` ≤ 0,1 e `Atmosphere` "Neblina Leve" (densidade 0,2 a 0,4: o horizonte some suave, o mapa continua legível). Sem `Sky` customizado.
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
| `src/catalog.js` | Catálogo de peças (`CATALOG`, `buildCatalog`): cada peça de `src/props/` sozinha no seu chão de studs |
| `viewer/catalog.html`, `viewer/catalog.js` | Visualizador do catálogo (lista de peças, botão "Colisão", `window.__catalogo`) |
| `tools/catalog-shots.mjs` | Fotografa o catálogo (normal e colisão) e gera `catalogo.json` e `CATALOG.md` |
| `src/invariants.js` | Invariantes por semente para o fuzz: `layoutProblems(w)` (barata, sem Parts) e `fullProblems(w, built)` (com Parts) |
| `tools/fuzz.mjs`, `tools/ci/fuzz-summary.mjs` | Fuzz de sementes (uma fatia) e o agregador do resumo; workflow `.github/workflows/fuzz.yml` (veja `docs/FUZZ.md`) |

## 4. Como construir (receita)

```js
// dentro de buildMap(), em src/map.js
b.span('Área/Sub', 'Nome', [x0, y0, z0], [x1, y1, z1], C.cor, { canCollide, transparency, rotation });
b.box('Área/Sub', 'Nome', [cx, cy, cz], [sx, sy, sz], C.cor);
```

- **Unidades:** studs, Y para cima. Ilha em x,z ∈ [−600, 600] (grade de 16), mar até ±800. Grama no topo y = 4, areia y = 3, água y = 2,6, mar y = 0. **Medidas saem de `DIM`**: mude a escala lá, nunca com números soltos.
- **Escala do jogador:** personagem de 5 studs, degraus de até 1 stud (escadas dos planaltos), estradas de 8, caminhos da praça de 8.
- **Apoio:** toda peça precisa **encostar** em outra já ligada ao `Mar`. Peças baixas entram 0,1 na grama (ex.: fundação começa em y = 3,9).
- **Base de peça deitada:** cada tipo tem sua altura de base para não empatar (fundação, Lobby, montanhas e construções 3,9; terra arada 3,92; arbustos e flores 3,95; trilha 3,97; degraus 3,88; estrada 4,0).
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
| Lobby | sem estátua, spawn fora do piso, escadaria com degrau > 1 stud ou que não chega ao piso, sem corrimão ou mureta, barraca incompleta, sem caixotes, canteiros ou colunas |
| relevo | menos de 6 montanhas ou 4 colinas, montanha baixa (< 50) ou feita de poucos blocos (parece caixa) |
| trilhas | vila, campo, jazida, torre ou acampamento sem trilha até a estrada; trilha solta |
| estradas x lotes | estrada atravessando um lote de ponta a ponta |
| props isolados | cada prop (estátua, 8 árvores, 7 construções, 4 lados) sem apoio, com z-fighting, cor fora da paleta ou fora do terreno declarado |
| catálogo | função exportada de `src/props/` (ou tipo de árvore/construção) sem entrada no catálogo; entrada vazia, solta do chão, com z-fighting, cor fora da paleta, inclinada com colisão ou sobreposta a outra |
| decoração | poucas árvores, sem outono, planaltos, pedras, campos, jazidas ou cais |
| estilo | classe, shape, material, Neon sem luz, campos desconhecidos (UI/NPC/script), cor fora da paleta, studs fora do lugar |
| orçamento | mais de `DIM.maxParts` Parts ou 60 luzes |
| determinismo | resultado diferente entre duas montagens |
| manual de montagem | peça que não se apoia em nada já montado, etapa com mais de 8 peças, fases fora de ordem |
| Rojo/projeto | enums errados, Lighting fora de Future ou de noite, serviços extras (scripts/UI) |
| `verify-place` (CI) | o `.rbxlx` real com contagem errada, instância proibida, material inesperado ou spawn faltando |
| fuzz de sementes (`tests/invariants.test.mjs` em todo PR; `fuzz.yml` com 100 mil) | semente qualquer com lote fora da grama, perto demais, sem estrada, estrada no Lobby/na água/atravessando lote, ilha sem mar na borda, Lobby fora da grama, sem lago/rio, lotes em < 3 quadrantes; na amostra com Parts: apoio, z-fighting, passagens, limites, spawn, manual, > 10000 Parts, marcos faltando |

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
| "só 0 planaltos com escada" | o retângulo do próprio planalto entrou em `blocked` antes de testar a escada, então `free(escada)` sempre falhava | registre em `blocked` só **depois** de montar tudo que encosta na peça (escada, rampa, cais) |
| z-fighting em X=39: Trilha × Terra Arada (variante 2027) | a borda da trilha (meia-largura 2, coordenadas inteiras) caiu no mesmo plano da borda do campo, com alturas que se cruzam | trilha com meia-largura 2,05: bordas nunca em inteiro ou meio; peça deitada que entra em outra não pode ter borda em coordenada "redonda" |
| z-fighting Estaca da Cerca × Cerca (quintais) | poste e trilho da cerca em cores diferentes com faces no mesmo plano | cerca do quintal toda na mesma madeira (`C.wood`); detalhe de outra cor sempre afastado 0,1 |
| "trilhas soltas" perto das vilas | trilhas dos campos ligam na rua da vila, e o teste não contava a rua como parte da malha | a rua, a praça e o largo da vila fazem parte da malha (ligam na estrada pela trilha da vila) |
| z-fighting Estrada × Fundação (semente 7) | a estrada correu colada no lote e as duas bordas caíram no mesmo inteiro | fundação 0,05 maior que o meio-fio (borda nunca inteira); bordas de peças deitadas: inteiro só nas estradas |
| z-fighting Grama/Areia do Deserto × Montanha/Afloramento/Terra Arada (sementes 7, 101, 2027, 77777) | colunas do relevo e bordas dos campos em coordenada inteira, no mesmo plano da junta das faixas do terreno (múltiplos de 8), com alturas que se cruzam (3,9 a 4,0) | grade do `mountain()` deslocada 0,25; terra arada 0,15 para dentro do retângulo do campo |
| orçamento divergente (10000 × 16000) | o limite de Parts estava repetido em vários testes | um só lugar: `DIM.maxParts` (18000), lido por todos os testes e pelo fuzz |
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
| `render` | depois de `test` (sem forks) | Playwright gera as capturas e os estágios da montagem, `tools/catalog-shots.mjs` fotografa o catálogo de peças, `tools/manual.mjs` gera o manual; tudo vai para o branch `ci-previews` e para um comentário no PR |
| `publish` | PR do próprio repo, push na `main` ou manual | Open Cloud publica o `.rbxl` (fila única `roblox-publish`) |
| `pages` | push na `main` | visualizador no GitHub Pages |
| `fuzz.yml` (workflow separado) | manual (Run workflow) e toda segunda às 04:17 UTC | 100 mil sementes em 40 fatias paralelas + resumo agrupado por tipo de falha (seção 10) |

Credenciais (Settings → Secrets and variables → Actions):

- `ROBLOX_CLOUD_API`: de preferência como Secret; o CI também lê de Variables.
- `ROBLOX_UNIVERSE_ID` e `ROBLOX_LOCAL_ID`: opcionais; o padrão está em `roblox.config.json`.

## 8. Checklist de PR

- [ ] Mudança só em `src/` (mapa/paleta) ou em ferramentas, com regra nova documentada aqui
- [ ] CI verde: lint, testes, build, capturas e publicação
- [ ] Merge só com tudo verde; depois do merge, o push na `main` republica o lugar e o Pages
- [ ] Conferi as capturas do comentário "📸 Como ficou"
- [ ] Peça nova em `src/props/` tem entrada no catálogo e eu conferi as duas imagens dela (normal e colisão)
- [ ] Nenhuma chave, ID secreto ou arquivo gerado (`build/`, `out/`) commitado

## 9. Catálogo de peças

- **O que é:** `src/catalog.js` lista toda peça reaproveitável (`CATALOG`: fonte com a estátua, os 8 tipos de árvore, arbusto, canteiro de flores e as 7 construções, porta para o sul). `buildCatalog()` monta cada uma sozinha num `Chão` de studs (`C.plaza`, topo em y = 0), numa grade de 6 colunas com folga (célula de pelo menos 60 studs), cada uma com a sua semente fixa (tirada do id). Serve para revisar acabamento, escala e colisão sem procurar a peça no mapa.
- **Peça nova = entrada nova:** toda função exportada por um módulo de `src/props/` (menos os ajudantes, como `footprint`) precisa de exatamente uma entrada; funções com tipo (`plantTree`, `building`) precisam de uma por tipo. Árvores e construções novas entram sozinhas (a lista sai de `TREE_KINDS` e `BUILDINGS`); função nova precisa de `entry(...)` em `CATALOG`. Ajudante novo que não monta peça entra em `HELPERS` no teste.
- **Testes (`tests/catalog.test.mjs`):** cobertura de `src/props/`, ids únicos (viram nome de arquivo), cada entrada com pelo menos 1 peça, apoio no próprio chão, z-fighting no catálogo inteiro, paleta, studs fora da água, nada inclinado com colisão, peças e chãos sem sobreposição e determinismo.
- **Visualizador:** `viewer/catalog.html` (prévia: `https://raw.githack.com/<repo>/<branch>/viewer/catalog.html`). Lista por grupo, "Todas as peças" e o botão **Colisão**: o que colide fica vermelho, o resto translúcido (o chão fica normal). `#view=<id>&colisao=1` abre direto. Contrato para o CI: `window.__catalogo = { ready, views, setView(id), setCollision(bool), entries, stats }`, com uma vista por entrada (3/4 de frente, enquadrada pela caixa envolvente) e `todos`.
- **CI:** o job `render` roda `node tools/catalog-shots.mjs out/previews` depois das vistas do mapa: `catalogo-<id>.png` e `catalogo-<id>-colisao.png` para cada vista, `catalogo.json` e `CATALOG.md` (grupo, peça, partes, partes com colisão, tamanho, o que colide e links). Tudo vai para o branch `ci-previews`, e o comentário "📸 Como ficou" ganha a seção **Catálogo de peças** com as miniaturas normal e colisão lado a lado.

## 10. Fuzz de 100 mil mapas

Detalhes em [`docs/FUZZ.md`](docs/FUZZ.md).

- **Duas camadas** (`src/invariants.js`): `layoutProblems(createWorld(semente))` é barata (sem Parts) e roda em **toda** semente; `fullProblems(w, w.buildMap())` monta as Parts e roda numa amostra (sementes múltiplas de `full_every`). Cada problema é `tipo: detalhe`, no máximo 20 por verificação.
- **Em todo PR:** `tests/invariants.test.mjs` (job `test` do CI normal) roda o layout na semente padrão e nas sementes 1 a 25, e a construção completa em `SEED`, 7 e 12345.
- **O grande:** `.github/workflows/fuzz.yml` ("Fuzz de mapas (100 mil sementes)"): Actions → Fuzz de mapas → Run workflow (`total`, `shards`, `full_every`, `first`), e toda segunda-feira sozinho. O resumo do Actions agrupa as falhas por tipo, com as 50 primeiras sementes de cada.
- **Regra:** semente que falha se corrige **no gerador** (`src/map.js`), nunca pulando a semente nem afrouxando a invariante. Depois de corrigir, rode o fuzz de novo e registre a lição na tabela 6.1.
- **Torres de vigia e acampamentos** faltando só geram aviso (mapa apertado pode não ter espaço); os outros marcos (vilas, campos, jazidas, cais, montanhas, colinas, trilhas) são obrigatórios. No fuzz bastam lotes em 3 dos 4 quadrantes; a semente padrão continua exigindo os 4 (`tests/map.test.mjs`).
