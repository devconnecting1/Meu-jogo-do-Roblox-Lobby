# AGENTS.md — regras do projeto Prisão (Roblox)

Leia este arquivo inteiro antes de mudar qualquer coisa. Ele vale para qualquer agente (Claude, Codex, Copilot…) e para humanos.

## 1. O que é

Uma **prisão fechada** para Roblox, feita só com Part clássico, descrita como **dados puros** em JavaScript.
O mesmo arquivo gera:

- o lugar do Roblox (`src/rojo.js` → Rojo → `.rbxl` → Open Cloud);
- o visualizador 3D (`viewer/main.js`, Three.js) e as capturas do CI.

Escopo atual: **somente a prisão**, abandonada e com clima de terror. Não criar UI, NPC, sistema de jogo, som ou exterior. Única exceção de script: `src/game/cintilacao.client.luau` (só faz as lâmpadas marcadas piscarem; regra 3).

## 2. Regras de ouro (não negociáveis)

1. **Nada roda localmente.** Testes, build, capturas e publicação rodam no GitHub Actions (`.github/workflows/ci.yml`, `ubuntu-latest`, gratuito em repositório público). Para validar uma mudança: commit → push → ler os comentários que o CI posta no PR.
2. **Fonte única:** o mapa vive em `src/prison.js`. Nunca edite o lugar no Roblox Studio, porque a próxima publicação sobrescreve tudo.
3. **Part clássico:** `Part` (Block) e `SpawnLocation`. `Cylinder` é permitido só como tampo girado (mesas). Proibido: MeshPart, Union, Decal, Texture, SurfaceGui, BillboardGui, Humanoid e Script. **Única exceção:** o LocalScript `Cintilacao` (StarterPlayerScripts) que faz as luzes chamadas `Luz Piscando` oscilarem; ele não cria nem apaga instâncias e não tem gameplay (testado em `tests/rojo.test.mjs` e no `verify-place`).
4. **Materiais e relevo clássico:** `Plastic` em tudo e `Neon` **apenas** em lâmpadas (sem colisão). Studs (`TopSurface = Studs`) só em pisos baixos. O relevo clássico do Roblox (`surface: 'Inlet' | 'Weld' | 'Universal'`, superfícies da própria Part, nunca Texture/Decal) vai em rodapés, bases e capitéis de colunas, pisos de corredor, costelas do túnel e portões; paredes grandes ficam lisas para o detalhe ter contraste.
5. **Cores neutras:** use só `src/palette.js`. Saturação HSV ≤ 0,3 (testado). Não espalhe RGB solto pelo layout.
6. **Ambiente fechado:** piso, teto e 4 paredes opacos, sem janelas, portas ou claraboias para fora. Não existe exterior nem saída. As paredes externas só têm um vão: o portal 12×12 no fim do corredor de serviço (parede oeste), que leva ao **túnel de acesso** (anexo `Túnel/*`, também fechado): eclusa A com o portão de emergência **aberto** → túnel de 40 studs → eclusa B com o **mesmo portão, fechado** (reservado para uma atualização futura). **Telhado desabado:** o único ponto em que o lado de fora aparece é o rombo `ROOF_HOLE` no teto do átrio, com o **céu de noite** (ClockTime 0, luar fraco, `Brightness` ≤ 1, sem `Sky` customizado). Paredes nunca se abrem para fora (testado em `tests/geometry.test.mjs`). Os portões são bipartidos: duas folhas (`Folha Esquerda`/`Folha Direita`) correm num trilho e se encontram no meio; não há script (regra 3 do escopo), então elas ficam paradas e nomeadas para um script futuro animar o fechamento simultâneo.
7. **Tudo se sustenta:** nenhuma peça flutua, nenhuma face visível faz z-fighting, nenhuma peça bloqueia passagem, e toda borda com queda tem guarda-corpo. O **manual de montagem** (`src/manual.js`) precisa conseguir montar cada peça sobre algo já montado.
8. **Nada apertado:** a escala segue a prisão de referência, com mínimos verificados em `tests/space.test.mjs`: cela de 14×16 com pé-direito de 16, corredor de 10, átrio de 48, 27 studs do 2º andar ao teto, escada de 14 e ponte de 10. **Corte em terraços:** a galeria do 2º andar fica em cima das celas do térreo e as celas de cima são recuadas. Nenhuma laje pode cobrir o corredor do térreo: corredor e átrio formam um vão aberto de 68 studs até o teto. Colunas a cada 30 studs e poucos móveis deixam o espaço respirar. Nunca reduza esses valores para "caber" algo; aumente o prédio.
9. **Segredos:** a chave Open Cloud só existe no GitHub (Secrets/Variables). Nunca commitar chaves; o publicador mascara a chave no log.
10. **Cada função tem sua sala:** o bloco de celas (átrio, corredores e galerias) não recebe móveis de outras funções. Refeitório, almoxarifado e enfermaria ficam na **ala oeste**, ligada ao hall por um vão de 12 studs e organizada em torno de um corredor de serviço com faixas no piso. Sala dos guardas e rouparia ficam nos cantos do hall; sala de visitas e estoque de uniformes ficam **fechados** sob o mezanino. No 2º andar não existe piso abandonado: o mezanino tem Sala de Controle (vidraça para o vão), Diretoria, Arquivo, Descanso e Vestiário, e os cantos oeste têm Biblioteca e Sala de Aula, cada uma com parede, porta, forro em y=33 e luz (testado em `tests/rooms.test.mjs`). Função nova = sala nova, com porta e zona livre.
11. **Sem vãos sobrando:** todo espaço entre a última cela e uma parede vira sala ou é fechado por parede (`Parede Técnica`). Um buraco do tamanho de uma cela parece cela faltando.
12. **Luz de terror, mas equilibrada:** o vão de pé-direito duplo usa luminárias de galpão presas ao teto (`HIGH_BAY`, SurfaceLight 110°) entre as vigas, a galeria usa `GALLERY_LIGHT`, e cada sala fechada tem painéis no próprio forro (`panelLight`). Nada de pendente com haste longa no meio do vão. **Equilíbrio (testado):** toda luminária tem brilho entre 0,5 e 1,2 e alcance ≤ 52; `Ambient`/`OutdoorAmbient` ≤ 0,2, `ExposureCompensation` ≤ 0,1, bloom contido; paredes, pisos e colunas com canal de cor ≤ 215. Com gráficos baixos o Roblox ilumina quase só pelo ambiente, então reboco quase branco + ambiente alto estoura tudo. **Clima de abandono:** fluorescente fria (`C.neonCold`), ambiente baixo (0,07), correção de cor dessaturada e esverdeada, `Atmosphere` (poeira no ar), 15% a 45% das lâmpadas queimadas (Plastic `C.lampDead`, sem luz) e 6 a 16 piscando (`flicker: true`). Toda sala fechada mantém pelo menos uma luz acesa (testado em `tests/abandono.test.mjs`).
13. **Abandono que faz sentido:** estrago nunca abre a envoltória nem o túnel (nada do lado de fora aparece). Vale: colunas rachadas que continuam de pé (`brokenColumn`), rombo em parede **interna** (`BREACH`, para o vão escuro sobre a ala oeste), forro furado com placa caída, entulho (`rubble`), manchas de umidade/mofo (`stain`), poças (`puddle`), canos enferrujados e móveis tombados. Tudo isso fica em modelos `Ruínas/*` (ou `Túnel/Ruínas`), apoiado em algo; peça girada (qualquer eixo) **nunca colide**. Pedaços grandes que colidem ficam em `Estrutura/Telhado Caído` e **fora das zonas de passagem**. Destruição de verdade: a coluna de x=0 (norte) **desabou** (`collapsedColumn`: toco com vergalhões, topo partido preso na viga e o fuste caído no chão em 3 pedaços, fora das passagens); as celas de `WRECKED_CELLS` têm porta arrancada no chão, vidro estilhaçado, colchão revirado e, no térreo, a parede do fundo furada para o vão de serviço; as de `CLOSED_CELLS` estão **trancadas** (grade fechada com colisão e cadeado, sem zona de passagem).
15. **Destruição conta uma história** (testado em `tests/abandono.test.mjs`): (1) **rebelião**: barricada no hall com mesa virada e armário deitado, sala dos guardas incendiada (fuligem, cinzas, móveis carbonizados, vidro estourado), sala de controle invadida (vidraça estilhaçada, monitores no chão, papéis); (2) **desabamento**: telhado do átrio caído com o céu à mostra, viga partida, lajes e viga no chão, poça de chuva, musgo e trepadeiras; terremoto com rachadura no piso e na parede do hall; (3) **fuga**: corda de lençóis amarrados do rombo até colchões empilhados, túnel cavado na cela 17 (buraco, terra, colher); (4) **anos de abandono**: arquivo saqueado, biblioteca revirada, enfermaria largada, desmoronamento parcial no túnel. Destruição nova precisa ter motivo nessa história.
16. **Câmera:** só primeira pessoa (`StarterPlayer.CameraMode = LockFirstPerson`, zoom máximo 0,5). Neblina (`Atmosphere` "Poeira no Ar") densa o bastante para o fundo do átrio sumir na penumbra, mas com `Offset` para o que está perto continuar nítido.
14. **Lâmpada que brilha emite luz:** toda peça `Neon` tem luz e toda luz está numa peça `Neon` (testado). Luminária pendente tem **um** tubo; lâmpada apagada, queimada ou de sala sem luz é `Plastic` escuro (`C.lampDead`). Nada de tubo "aceso" de enfeite.

## 3. Mapa do repositório

| Caminho | Papel |
|---|---|
| `src/palette.js` | Paleta neutra (`C`) + `saturation()` |
| `src/builder.js` | `makeBuilder()` (`box`/`span`), `rotationMatrix`, `aabb`, `stats` |
| `src/prison.js` | **Layout** (`buildPrison`), dimensões (`DIM`), zonas livres (`clearanceZones`), bordas (`fallEdges`), limites (`ENVELOPE`/`INTERIOR`) |
| `src/checks.js` | Verificações: flutuação, z-fighting, passagens, guarda-corpo e limites |
| `src/rojo.js` | Parts → `.model.json` do Rojo (enums Roblox) |
| `src/manual.js` | Manual de montagem: fases de obra, etapas de até 8 peças, simulação de apoio e contagem de conexões |
| `default.project.json` | Projeto Rojo: Workspace + **Lighting** (Future, efeitos) |
| `tests/*.test.mjs` | Regras de geometria, estilo e Rojo (node:test, sem dependências) |
| `tools/build-place.mjs` | Gera `build/Prisao.model.json` |
| `tools/publish.mjs` | Publica `.rbxl` via Open Cloud (com novas tentativas e máscara da chave) |
| `tools/screenshots.mjs` | Renderiza as vistas do visualizador (Playwright), inclusive os estágios da montagem |
| `tools/manual.mjs` | Gera `MANUAL.md` e `manual.json` (publicados no branch `ci-previews`) |
| `eslint.config.js`, `.prettierrc.json` | Lint e formatação (aplicados só no CI) |
| `tools/ci/*` | Verificação do lugar, branch `ci-previews` e comentários no PR |
| `viewer/main.js`, `index.html` | Visualizador Three.js |

## 4. Como construir (receita)

```js
// dentro de buildPrison(), em src/prison.js
b.span('Área/Sub', 'Nome', [x0, y0, z0], [x1, y1, z1], C.cor, { canCollide, studs, transparency, material, light });
b.box('Área/Sub', 'Nome', [cx, cy, cz], [sx, sy, sz], C.cor);
```

- **Unidades:** studs. Y para cima. Interior: x −151…88 (ala oeste em x −151…−89, forro das salas em y=20), z −60…60, y 0…44. Túnel de acesso (anexo): x −219…−151, eclusas com |z| ≤ 14 e pé-direito 16, túnel com |z| ≤ 6 e 12 de altura. Térreo y=0; 2º andar y=17. Fachadas: térreo em |z|=34, celas de cima em |z|=44 (galeria entre 34 e 44). **Todas as medidas derivam de `DIM`** em `src/prison.js`: mude a escala lá, nunca com números soltos.
- **Escala do jogador:** personagem de 5 studs. Pé-direito de 16 por andar, portas de 3,5×10, corredores de 10 e degraus de **até 1 stud** (piso de 1,25).
- **Apoio:** toda peça precisa **encostar** em outra que já esteja ligada à `Laje Térreo`. Luminárias levam haste até o teto (`hangingLight`) ou encostam no teto (`panelLight`).
- **Peça decorativa colada em superfície** (friso, faixa, placa): use `canCollide: false` e desloque-a para fora da face (por exemplo, `-0.08`), **nunca** no mesmo plano da face.
- **Recortes (janela/porta):** monte a parede em pedaços em volta do vão. Caixilhos ficam **dentro** do vão, não sobre a parede.
- **Paredes de sala:** use `wallRun(b, modelo, 'x'|'z', u0, u1, w0, w1, y0, h, [door(a, c), win(a, c)])`; ele já monta verga, peitoril, vidro, batentes e caixilhos. Feche os cantos (a parede lateral começa onde a frontal começa) para não sobrar fresta.
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
| manual de montagem | peça que não se apoia em nada já montado, peça fora do manual, etapa com mais de 8 peças, fases fora de ordem |
| abandono | lâmpadas queimadas/piscando fora da faixa, sala fechada sem nenhuma luz, estrago na envoltória, ruína com colisão, sala nova do túnel sem porta ou luz |
| luz equilibrada | luminária forte demais, ambiente/exposição altos, bloom exagerado, parede ou piso claro demais (estoura com gráficos baixos) |
| túnel | portal fora do lugar, túnel sem fundo, portão B aberto ou diferente do A, folha do portão A dentro do vão |
| zoneamento | refeitório, almoxarifado, enfermaria, guardas ou rouparia ausentes; mesas ou caixas dentro do bloco de celas; móveis no átrio |
| espaço (anti-aperto) | cela, corredor, vão, pé-direito, escada, ponte ou porta abaixo do mínimo da referência; laje cobrindo o corredor do térreo; celas de cima sem recuo |
| Rojo/projeto | enums errados, Lighting fora de Future, serviços extras (scripts/UI) |
| `verify-place` (CI) | o `.rbxl` real com contagem errada, instância proibida ou material inesperado |

Quando um teste falhar, a mensagem lista a peça (`Modelo/Nome @ [x, y, z]`). Corrija a geometria, não o teste. Só mude um teste quando a **regra** mudar, e registre isso aqui.

## 6. Problemas conhecidos e como evitar

### 6.1 Lições aprendidas no CI (não repetir)

Cada item abaixo já derrubou o CI uma vez. Antes de dar push, confira a peça nova contra esta lista.

| Falha | Causa real | Como evitar |
|---|---|---|
| "só os campos conhecidos de Part" / UI | o nome continha `gui` (ex.: "Guia do Piso") e o teste procura `npc\|gui\|decal\|texture\|script` em `modelo/nome` | não use nomes com essas sílabas: "Trilho do Piso", não "Guia" |
| "tamanho 0.02" | peça com alguma medida < 0,04 | espessura mínima 0,04 (adesivos, marcas e manchas usam 0,04 a 0,06) |
| z-fighting em Y = topo do piso | duas peças deitadas (poça, musgo, entulho, laje caída) com a **base** no mesmo plano e cores diferentes, cruzando a junta de duas placas do piso | cada tipo de peça deitada tem sua altura de base: poça afunda 0,02 no piso, musgo começa em 0,09, entulho em 0,1 |
| z-fighting em face lateral | caco, barra ou vergalhão encostado com a face no mesmo plano de outra peça de outra cor | afaste 0,1 ou mude a posição; peça girada fica fora da checagem |
| "Fora dos limites" (INTERIOR) | peça interna passando do teto (y > 44) ou de uma parede | pedaço pendurado no teto fica **abaixo** de y = 44 e entra 1 stud sob a laje que o segura |
| "não se apoia em nada montado antes" | peça presa no teto ou na viga, mas a fase do manual dela vem antes do teto (ex.: topo da coluna partida em `Estrutura/Colunas`) | o que pende do teto vai em `Estrutura/Teto`; o que fica no chão da galeria não pode estar na fase "celas" (a galeria é montada depois) |
| "Bloqueia zona" | decoração com colisão invadindo uma zona livre (cadeado de 0,25 no corredor) | enfeite perto de passagem usa `canCollide: false`; confira `clearanceZones()` |
| "Neon sem luz é lâmpada falsa" | tubo ou painel brilhando sem emitir luz | lâmpada apagada é `Plastic` `C.lampDead`; `hangingLight` tem um tubo só |
| átrio com móveis | peça com colisão no átrio fora dos modelos estruturais | destroço grande com colisão fica em `Estrutura/Telhado Caído`, fora das zonas |
| Prettier | linhas longas escritas à mão | nunca formate à mão: incorpore `autoformat/pr-N` |
| capturas canceladas | push novo enquanto o job `render` ainda roda (o CI cancela o anterior) | espere "📸 Como ficou" antes do próximo push, a não ser que haja teste vermelho para corrigir |

- **Z-fighting:** duas peças com faces coplanares e cores diferentes. Desloque a decorativa (0,05 a 0,1), deixe uma por dentro da outra, ou use a mesma cor.
- **Colisão invisível:** peças decorativas (frisos, portas abertas, lâmpadas) usam `canCollide: false`. Vidro de guarda-corpo **colide** de propósito.
- **Degrau alto:** o personagem sobe no máximo cerca de 1 stud sem pular. A escada usa degraus de 1 × 1,125.
- **Sobreposição de colisão em passagens:** sempre confira `clearanceZones()` ao mover móveis.
- **Fresta no canto de duas paredes:** se a parede frontal termina em z=12 e a lateral começa em x+0,6, sobra um furo de 0,6×0,6. Comece a lateral no mesmo x da frontal.
- **SurfaceLight:** o ângulo vem de `light.angle` (padrão 90). No visualizador só átrio, hall e galerias recebem luz real; as salas usam o emissivo.
- **Relevo no visualizador:** `viewer/main.js` desenha Inlet/Weld/Universal com texturas geradas em canvas (repetição de 1 ou 2 studs). A face de baixo fica lisa, como no `src/rojo.js`.
- **Ruínas giradas:** só em modelos `Ruínas`, em qualquer eixo e sem colisão; confira se a caixa envolvente encosta no apoio (o piso tem topo em 0,1 no átrio) (o teste de z-fighting ignora peças giradas; a checagem de apoio usa a caixa envolvente).
- **Script de cintilação:** se precisar de mais luzes piscando, marque `flicker` pelo estado da lâmpada (`hangingLight(..., 'flicker')` ou `panelLight(..., 'flicker')`). O conversor nomeia a luz `Luz Piscando` e o script acha sozinho.
- **Portão de emergência:** use `emergencyGate(b, modelo, faceX, lado, aberto)`; ele monta trilho, guia, colunas, faixa zebrada, luzes de alerta e as duas folhas. Folhas abertas ficam fora do vão (|z| ≥ 6,2).
- **Peças giradas** ficam fora da checagem de z-fighting. Evite girar; só tampos cilíndricos.
- **Open Cloud:** a API recusa `.rbxlx` feito à mão ("Invalid Content stream"). Publique sempre o `.rbxl` **binário do Rojo**.
- **`Lighting.Technology`** não é alterável por script; vai no `default.project.json` (Future = 4). Se o Rojo mudar de versão, confira o `verify-place`.
- **Cilindro do Roblox** tem o eixo em X. O tampo usa `rotation: [0, 0, 90]`.
- **CanQuery = false** só é permitido com CanCollide = false (o conversor já respeita isso).
- **Publicação substitui o lugar inteiro.** O histórico de versões fica no Creator Hub.

## 7. CI/CD (`.github/workflows/ci.yml`)

| Job | Quando | O que faz |
|---|---|---|
| `lint` | sempre | Prettier `--check` + ESLint. Se falhar num PR, publica a correção em `autoformat/pr-N` (incorporar com `git merge origin/autoformat/pr-N`) |
| `test` | sempre | `node --test`, resumo e comentário no PR |
| `build` | depois de `test` | Rojo gera `.rbxl`/`.rbxlx`, roda `verify-place`, artefato `lugar` |
| `render` | depois de `test` (sem forks) | Playwright gera as capturas e os estágios da montagem, `tools/manual.mjs` gera o manual; tudo vai para o branch `ci-previews` e para um comentário no PR |
| `publish` | PR do próprio repo, push na `main` ou manual | Open Cloud publica o `.rbxl` (fila única `roblox-publish`) |
| `pages` | push na `main` | visualizador no GitHub Pages |

Credenciais (Settings → Secrets and variables → Actions):

- `ROBLOX_CLOUD_API`: de preferência como Secret; o CI também lê de Variables.
- `ROBLOX_UNIVERSE_ID` e `ROBLOX_LOCAL_ID`: opcionais; o padrão está em `roblox.config.json`.

## 8. Checklist de PR

- [ ] Mudança só em `src/` (layout/paleta) ou em ferramentas, com regra nova documentada aqui
- [ ] CI verde: lint, testes, build, capturas e publicação
- [ ] Merge só com tudo verde; depois do merge, o push na `main` republica o lugar e o Pages
- [ ] Conferi as capturas do comentário "📸 Como ficou"
- [ ] Nenhuma chave, ID secreto ou arquivo gerado (`build/`, `out/`) commitado
