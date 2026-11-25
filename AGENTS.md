# AGENTS.md — regras do projeto Reino (Roblox)

Leia este arquivo inteiro antes de mudar qualquer coisa. Ele vale para qualquer agente (Claude, Codex, Copilot…) e para humanos.

## 1. O que é

O **mapa base** de um jogo de estratégia (estilo Lords Mobile) no Roblox, descrito como **dados puros** em JavaScript (`src/map.js`).
O mesmo arquivo gera:

- o lugar do Roblox (`src/rojo.js` → Rojo → `.rbxl` → Open Cloud);
- o visualizador 3D (`viewer/main.js`, Three.js) e as capturas do CI.

**Fase atual: o Vale das lojas, à noite.** Terreno em estilo voxel pixelado (blocos lisos, bordas "em escada"), com o Lobby no centro (estátua de Luvitlua e postes de luz), **8 lojas grandes em tamanho real** mobiliadas por dentro e iluminadas, estradas, penhascos, terraços e lagoas. **Sem castelos, sem lotes e sem igreja** (pedido do dono). **O mapa é fixo** (decisão do dono): uma semente só, igual em todo servidor. Inspiração de estilo: mapas voxel pixelados de RPG no Roblox (paleta quente, blocos lisos, caminhos de terra serrilhados, penhascos de rocha em camadas); o vale é original, nunca a cópia do mapa de outro jogo.

**Arquivos guardados (não renderizados nem publicados):**

- `arquivo/prisao`: a prisão do projeto antigo;
- `arquivo/reino-classico`: o Reino clássico até a versão 21 (ilha procedural com vilas, fazendas, biomas, montanhas, Lobby com lojas e fonte, catálogo de peças, Plastic com studs).

Nada deles volta para o mapa sem pedido do dono do projeto.

## 2. Regras de ouro (não negociáveis)

1. **Nada roda localmente.** Testes, build, capturas e publicação rodam no GitHub Actions (`.github/workflows/ci.yml`, `ubuntu-latest`). Para validar uma mudança: commit → push → ler os comentários que o CI posta no PR.
2. **Fonte única:** o mapa vive em `src/map.js`. Nunca edite o lugar no Roblox Studio, porque a próxima publicação sobrescreve tudo.
3. **Part simples:** `Part` (Block) e um `SpawnLocation` por mapa. Proibido: MeshPart, Union, Decal, Texture, SurfaceGui, BillboardGui, Humanoid, scripts e `Sky` customizado (testado no `verify-place`).
3b. **Mapa fixo (decisão do dono do projeto):** nada de geração procedural por servidor. `createWorld(SEED)` monta sempre o mesmo vale; variantes, o script de sorteio e o fuzz de sementes foram removidos (o histórico está no git). A semente só existe para o desenho do vale continuar determinístico.
4. **Estilo voxel liso (decisão do dono do projeto):** toda peça em `SmoothPlastic`, **sem studs, sem inlet, sem relevo** nas faces (`materialFor` devolve SmoothPlastic; testado). `Neon` só em lâmpada que emite luz (sem colisão) e nas **janelas acesas** das lojas (peças "Janela", vidraça presa na parede; a luz vem do lampião de dentro). Histórico: o Plastic com studs ficou no `arquivo/reino-classico`; as texturas "realistas" (Grass, Cobblestone…) foram rejeitadas.
5. **Cores:** só `src/palette.js` (grupo `px…` para o Vale), saturação HSV ≤ 0,55 (testado). Tons quentes e foscos: grama verde, terra marrom, pedra bege, rocha marrom-avermelhada, musgo.
6. **Mapa determinístico:** a mesma semente gera o mesmo mapa (testado).
7. **Tudo se sustenta:** nenhuma peça flutua (cadeia de contato até o `Mar`), nenhuma face visível faz z-fighting e nada com colisão invade as zonas livres (`clearanceZones()`: pisos dos lotes e das áreas, caminho do spawn e spawn). O **manual de montagem** (`src/manual.js`) precisa montar cada peça sobre algo já montado.
8. **Grade de pixels:** o terreno é uma grade de células de **4 studs** (`DIM.cell`) em x,z ∈ [−400, 400]. Lotes e áreas têm lado múltiplo de 8 e centro na grade, para o piso cobrir células inteiras. Cada célula tem tipo (mar, chão, água, penhasco), topo e superfície. As peças saem da grade: em cada linha, células seguidas iguais viram um bloco só (corpo de terra embaixo + camada de 1 stud em cima). Por isso as bordas de estradas, praça e lagoas ficam "em escada", como pixel art, e nunca há duas peças deitadas no mesmo plano.
9. **Lobby:** praça circular de pedra clara (raio 46) no centro, com faixas escuras pixeladas (dois anéis e um losango), **estrado** de 1 stud no meio (raio 10) com a **estátua de Luvitlua** (o perfil do dono do jogo): pedestal de pedra em degraus, placa com o nome em letras de pixel e o **boneco R6 oficial do Roblox** (pedido do dono: nada de personagem inventado), com as proporções exatas do R6 em escala 3,6 (tronco 2×2×1, braços e pernas 1×2×1, cabeça de cantos quebrados), numa cor só de estátua e **sem armadura, roupa, arma ou item** (só o corpo do R6; `src/props/estatua.js`, testado) e o **spawn** no lado sul (0, 4, 24). **8 postes de luz** acesos na praça (raio 40, entre as saídas, longe do caminho do spawn). Em volta, um anel de terra (52 a 62) e as **8 lojas** (48 × 48, centro no raio 124, entre as 4 saídas), cada uma na sua planta.
10. **Sem lotes nem castelos (pedido do dono):** o vale só tem as lojas em volta da praça. O que sobrou dos castelos (plantas, torres de menagem, lotes de 32 × 32) está no histórico do git; `PLOTS` existe vazio.
10c. **Lojas grandes com interior (`src/props/lojas.js`, `SHOPS`):** Taverna, Ferraria, Mercado Coberto, Padaria, Torre do Mago, Estábulo, Banco e Salão do Clã, cada uma na sua planta, em **tamanho real**: desenhadas em escala de desenho (planta em 24 × 24) e montadas pelo referencial em `DIM.buildScale` = 2 (u e v) e `DIM.buildScaleY` = 1,5 (altura): 48 × 48 studs, porta de 8 × 9, pé-direito de 12 ou mais (o R6 tem 5). Casca comum (`buildShell` em `src/props/oficina.js`): piso, paredes em camadas (base de pedra, janelas acesas, porta com verga), telhado em degraus (a planta encolhida camada a camada). **Cores neutras** (reboco, creme, pedra, madeira; telhados de ardósia, pedra escura ou madeira). **Luz:** 1 por dentro (lampião, brasa da forja, forno da padaria ou bola de cristal) e **2 lanternas acesas na fachada**, dos lados da porta (3 por loja, testado). Móveis pelo `makeKit`: só entram se a pegada inteira cair no piso livre e, com colisão, fora da zona da porta; nada pode ser pulado (testado). Nas peças, a planta "Salão da Guilda" se chama **"Salão do Clã"** (a sílaba "gui" é proibida pelo teste de estilo). O Banco tem o salão em v ≤ 4 com piso a 1,2 e a escadaria com colunas e pórtico na frente.
10e. **Regras de desenho das construções:** paredes, pisos e telhados na grade local de 1 stud (inteiros); móveis em coordenadas quebradas (x,1 a x,9) para nunca cair no plano de uma parede; peças de cores diferentes só se encostam por faces opostas; tudo dentro da planta (placas e lanternas da fachada saem no máximo 2 studs, testado); nada girado. Coordenadas sempre em escala de desenho (o referencial multiplica).
10b. **Plantas de verdade (`PLANS`, `inPlan`, `planRects`, `footprint`):** cada área de construção tem o formato do prédio que vai receber, nunca um quadrado igual para tudo. Lojas (8, uma de cada): Taverna (L), Ferraria (oficina + forja), Mercado Coberto (salão + alpendre), Padaria (forno + vitrine), Torre do Mago (redonda), Estábulo (U em volta do picadeiro), Banco (salão + escadaria) e Salão da Guilda (octógono). Plantas em coordenadas de desenho com a frente (+z) virada para o Lobby, montadas em escala `DIM.buildScale`; bordas no mundo em múltiplos de 4 para cobrir células inteiras; o piso é a planta e a borda de pedra é 1 célula em volta. Testado: 8 lojas diferentes, áreas todas diferentes, nenhum quadrado cheio, sem igreja e sem castelo.
11. **Estradas:** terra (10 de largura, borda serrilhada por ruído, manchas de terra batida). Quatro saídas retas da praça e cada área/lote ligado à malha por um "L" (dois trechos retos) até um dos 80 pontos mais perto ou, se nenhum servir, por um "Z" (três trechos) que desvia pelos corredores; nunca atravessa outro lote nem área. Sobre a lagoa vira passagem de pedra. **Toda** área e todo lote ligam no Lobby (busca em largura na grade, testado).
12. **Relevo:** **penhascos** em blocos (degraus de 6 studs, até ~80 de altura, cores de rocha alternadas e musgo no topo) cercando boa parte do vale; no resto, o planalto acaba numa borda sobre o mar (testado: as duas coisas existem). **Terraços** de grama (+2 e +4) só longe de estradas, lotes, áreas, água e borda. **Lagoas** (1 ou 2) com leito e água sem colisão. Grama com **manchas escuras** em blocos de 8 studs.
13. **Luz: sempre de noite (pedido do dono).** Lighting Future, `ClockTime` 22,5, brilho 1,2, ambiente azulado ≤ 0,6 mas com `OutdoorAmbient` ≥ 0,2 (o mapa continua visível), correção de cor neutra, bloom ≤ 0,3 (as lanternas e janelas brilham), `Atmosphere` "Neblina Leve" escura (densidade 0,2 a 0,4) e **sem** `SunRaysEffect`. A cidade é iluminada pelas lojas (lampião, lanternas da fachada, janelas acesas) e pelos postes da praça; total ≤ 60 luzes. Sem `Sky` customizado. O visualizador desenha a noite e cada luz do mapa como luz pontual.
14. **Segredos:** a chave Open Cloud só existe no GitHub (Secrets/Variables). Nunca commitar chaves; o publicador mascara a chave no log.

## 3. Mapa do repositório

| Caminho | Papel |
|---|---|
| `src/palette.js` | Paleta (`C`, grupo `px…` do Vale) + `saturation()` |
| `src/materials.js` | `MATERIAL_ENUM` do Rojo; `materialFor` devolve SmoothPlastic |
| `src/builder.js` | `makeBuilder()` (`box`/`span`), `rotationMatrix`, `aabb`, `stats` |
| `src/map.js` | **Mapa** (`createWorld`, `buildMap`), `DIM`, `T`, `PLAZA`, `PLOTS`, `PADS`, `PONDS`, `terrainAt`/`heightAt`/`surfaceAt`, `clearanceZones`, `ENVELOPE` |
| `src/props/oficina.js`, `src/props/moveis.js` | Base das construções: planta em grade de 1 stud (`Mask`), `buildShell` (piso, paredes, porta, janelas, telhado), `makeKit` (móveis com checagem) e os móveis |
| `src/props/lojas.js`, `src/props/castelos.js`, `src/props/estatua.js`, `src/props/frame.js` | Prédios do Lobby, castelos, estátua de Luvitlua e o referencial local das construções |
| `src/checks.js` | Verificações: flutuação, z-fighting, passagens e limites |
| `src/rojo.js` | Parts → `.model.json` do Rojo |
| `src/manual.js` | Manual de montagem: fases (mar, chão, Lobby, estradas, áreas, lotes, penhascos, lagoas), etapas de até 8 peças |
| `src/invariants.js` | Invariantes do mapa: `layoutProblems(w)` e `fullProblems(w, built)` |
| `default.project.json` | Projeto Rojo: Workspace e **Lighting** |
| `tests/*.test.mjs` | Regras de geometria, mapa, estilo, Rojo, manual, variantes e invariantes (node:test, sem dependências) |
| `tools/build-place.mjs`, `tools/publish.mjs` | Gera os modelos do Rojo e publica o `.rbxl` via Open Cloud |
| `tools/screenshots.mjs`, `tools/manual.mjs` | Capturas do visualizador (Playwright) e o manual |
| `tools/ci/*` | Verificação do lugar, branch `ci-previews` e comentários no PR |
| `viewer/main.js`, `viewer/surfaces.js`, `index.html` | Visualizador Three.js (tudo instanciado; aparência por material em `surfaces.js`) |

## 4. Como construir (receita)

- **Terreno:** mude a grade em `createWorld` (tipo, topo e superfície por célula); `buildMap` transforma a grade em peças sozinho. Superfície nova = entrada em `SURF` (cor, nome, modelo) e, se for caminho, em `PATH_SURF`.
- **Peça solta** (futuras construções): `b.span('Área/Sub', 'Nome', [x0, y0, z0], [x1, y1, z1], C.cor, { canCollide, transparency, rotation })` em cima do chão (topo y = 4). Bordas de peças novas **fora** da grade de 4 studs (deslocar 0,25), senão caem no plano das juntas do terreno (lição 6.1).
- **Unidades:** studs, Y para cima. Chão do vale y = 4, mar y = 0, lagoa até 3,2. Medidas saem de `DIM`.
- **Nova área transitável:** zona em `clearanceZones()`.
- **Sorteio:** sempre `rand()`/`nz()` da semente, nunca `Math.random`.
- **Nova cor:** `src/palette.js` (saturação ≤ 0,55).

## 5. Testes (o que cada um protege)

| Teste | Protege contra |
|---|---|
| nada flutua | peças soltas no ar (grafo de contato a partir do `Mar`) |
| sem z-fighting | duas faces visíveis no mesmo plano com cores diferentes |
| passagens livres | colisão sobre os pisos dos lotes e das áreas, no caminho do spawn ou no spawn |
| limites / planalto | peça fora do mapa, terreno encostando na borda da grade |
| alturas | estrada ou lote fora do nível do chão, água acima do chão ou com colisão, superfícies faltando |
| Lobby | praça sem pedra, sem faixas ou sem estrado, spawn fora do piso ou fora da praça |
| áreas das lojas | menos de 8, piso torto, sem estrada até o Lobby |
| plantas | prédio repetido na praça, planta de castelo na praça (ou de loja num lote), menos de 6 plantas de castelo, menos de 10 tamanhos, mais de 3 quadrados cheios |
| estradas | lote sem estrada até o Lobby, poucas estradas, sem manchas de terra batida |
| relevo | penhasco baixo (< 40 acima do chão) ou de poucos blocos, poucos terraços, sem lagoa, grama sem manchas; borda só de penhasco ou só aberta |
| estilo | classe, material (SmoothPlastic; Neon só com luz ou janela acesa), studs ou relevo nas faces, campos desconhecidos (UI/NPC/script), cor fora da paleta |
| orçamento | mais de `DIM.maxParts` (32000) Parts ou 60 luzes |
| lojas | móvel pulado (fora do piso livre ou na passagem), loja sem piso/parede/janela/telhado/lanterna, diferente de 3 luzes (1 dentro + 2 na fachada), interior vazio, peça fora da planta, paredes abaixo de 12 studs, área repetida, quadrado cheio, igreja ou castelo |
| noite | Lighting fora da noite (`ClockTime` entre 20 e 4), noite escura demais, raios de sol, praça sem os 8 postes de luz acesos |
| estátua | estátua sem pedestal/placa/letras, baixa, fora do estrado, fora das proporções do R6, com mais de uma cor, com armadura/item/luz |
| determinismo | resultado diferente entre duas montagens |
| manual de montagem | peça que não se apoia em nada já montado, etapa com mais de 8 peças, fases fora de ordem |
| Rojo/projeto | enums errados, Lighting fora de Future ou de noite, serviços extras (scripts/UI) |
| `verify-place` (CI) | o `.rbxlx` real com contagem errada, instância proibida, material inesperado ou spawn faltando |

Quando um teste falhar, a mensagem lista a peça (`Modelo/Nome @ [x, y, z]`). Corrija a geometria, não o teste. Só mude um teste quando a **regra** mudar, e registre isso aqui.

## 6. Problemas conhecidos e como evitar

### 6.1 Lições aprendidas no CI (não repetir)

Cada item já derrubou o CI uma vez (na prisão ou no Reino clássico; as regras de geometria continuam valendo para o Vale e para as construções futuras). Confira a peça nova contra esta lista antes do push.

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
| z-fighting Grama × Acampamento/Lona (semente 12345) | construções montadas em coordenada inteira: a lateral da lona caiu na junta das faixas do terreno (Z = −360) | `placeBuilding` monta tudo 0,25 fora da grade (como o relevo) |
| "Flutuando: Vegetação/Juncos/Junco" | a touceira testava só o centro na grama; os juncos saem até 0,8 para o lado e alguns caíram em cima da água (topo 2,6, abaixo da grama) | a área inteira da touceira (±1,5) precisa ser grama (`allGrass`) |
| (decisão) texturas realistas rejeitadas | a versão 20 trocou Plastic por Grass/Cobblestone/WoodPlanks e o dono preferiu o visual clássico | todo o mapa em Plastic com studs; realismo vem da arquitetura, da luz e da composição, não do material |
| Vale: "Lote N com superfície loteBorda" e "28 lotes, esperado 30" (todas as sementes) | lote de 28 (meia-largura 14) com centro na grade de 4: o piso cobria só 24 e a amostra caía na borda; e o vale não tinha espaço para 30 lotes | lado de lote/área múltiplo de 8; vale maior (raio 300, grade ±400) e 60 mil tentativas; ligação com "Z" quando o "L" não passa |
| Vale: "lotes só em 5 quadrantes" e "lote sem estrada" (semente 77777) | `Math.sign(0)` criou um quinto "quadrante" para o lote no eixo; e nenhum L/Z passava entre os lotes vizinhos | quadrante com `>= 0`; último recurso da estrada: busca em largura na grade até a estrada mais perto, virando trechos retos nas curvas |
| Vale: "só 9 tamanhos de planta" | capela, ferraria e banco tinham 20 células; guilda e torre 24; cidadela e L 48; pátio e T 44 | cada prédio com área própria, como na vida real (capela 16, banco 18, torre r12 = 32, cidadela 40, forte em T 34); conte as células da planta nova antes do push |
| "só 5 montanhas" (Lobby novo) | o relevo consome `rand()` (pinheiros nas encostas); mudar o perfil das montanhas mudou o sorteio e a vaga das montanhas acabou em 6000 tentativas | depois de 4000 tentativas o relevo aceita raio 15% menor, depois de 6500, 28% menor: mapa apertado nunca fica sem montanha |
| orçamento divergente (10000 × 16000) | o limite de Parts estava repetido em vários testes | um só lugar: `DIM.maxParts` (18000), lido por todos os testes e pelo fuzz |
| Construções: z-fighting Poste do Quadro × Quadro de Missões (Y = topo) | poste e quadro de cores diferentes com o topo na mesma altura (3,0) | topos de peças vizinhas em alturas diferentes (quadro em 2,85) |
| Construções: z-fighting Telhado × Chaminé (Y = forro) | a chaminé começava no forro (y = H), no mesmo plano da face de baixo do telhado | chaminé começa 0,3 acima do forro, dentro do telhado |
| Construções: "água abaixo do chão" | o teste de alturas trata toda peça com nome começando em "Água" como lagoa; poço, tina e cocho ficam acima do chão | água de enfeite se chama "Espelho do Poço/da Tina/do Cocho" |
| Construções: "Fortaleza sem Ameia" | toda a muralha da Fortaleza é torre e as ameias de torre tinham outro nome | ameia de torre também se chama "Ameia" |
| Construções: "Neon não deve colidir" (Bola de Cristal) | peça Neon com luz, mas com colisão | toda luz Neon (lampião, brasa, cristal) com `canCollide: false` |
| (decisão) castelos, lotes e igreja removidos; lojas grandes, neutras e iluminadas; mapa só de noite | o dono pediu "apenas lojas", tamanho real e noite | plantas em escala de desenho × `DIM.buildScale`; nada de castelo/igreja (testado); Lighting de noite (testado) |
| capturas: "page.screenshot: Timeout 30000ms" (Salão da Guilda) | o SwiftShader do CI demorou mais de 30 s para desenhar uma vista com muitas peças | `page.screenshot` com 150 s de limite; no visualizador, só 8 luzes pontuais fixas que vão para as luzes mais perto de cada vista (o shader não recompila) |
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
| `render` | depois de `test` (sem forks) | Playwright gera as capturas das vistas, das variantes e dos estágios da montagem; `tools/manual.mjs` gera o manual; tudo vai para o branch `ci-previews` e para um comentário no PR |
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

## 9. Catálogo de peças

O catálogo de peças (props, `src/catalog.js`, `viewer/catalog.html`, `tools/catalog-shots.mjs`) foi guardado com o Reino clássico no branch `arquivo/reino-classico`. Quando as construções do Vale começarem, ele volta com as peças novas (estilo liso): cada peça reaproveitável sozinha no seu chão, fotografada normal e com a colisão em vermelho, com teste de cobertura.

## 10. Fuzz de sementes (removido)

Com o mapa fixo (regra 3b), o fuzz de 100 mil sementes, as variantes e o `EscolherMapa` saíram do projeto. `tests/invariants.test.mjs` continua rodando as invariantes de layout e da construção completa na semente única (`SEED`).
