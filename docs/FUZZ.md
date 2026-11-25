# Fuzz de mapas (100 mil sementes)

O mapa sai de uma semente: `createWorld(semente)` gera ilha, lago, rio, lotes e estradas, e `w.buildMap()` monta as Parts. As regras do AGENTS.md precisam valer para **qualquer** semente, e não só para a padrão (`SEED`). O fuzz testa milhares de sementes no GitHub Actions para achar a que quebra uma regra antes de ela virar um mapa de servidor.

Nada disso roda localmente. Tudo roda no GitHub Actions, como o resto do projeto.

## O que é verificado

As verificações ficam em `src/invariants.js` (funções puras, sem I/O). Cada problema é uma linha `tipo: detalhe`, e cada verificação guarda no máximo 20 linhas (o resto vira `… +N problemas`).

### Camada barata: `layoutProblems(w)` (toda semente, sem Parts)

| Tipo | Regra |
|---|---|
| `lotes (quantidade)` | exatamente `DIM.plots` (30) lotes |
| `lotes (nomes repetidos)` | nomes únicos |
| `lotes (perto demais)` | dois lotes a pelo menos `DIM.minPlotSpacing` (84) studs |
| `lotes (fora da grama)` | fundação + 2 studs de folga toda sobre grama (amostra a cada 2 studs) |
| `lotes (perto do Lobby ou da água)` | ≥ 110 do centro do Lobby e do lago, ≥ 52 do rio |
| `lotes (sem estrada)` | `w.plotsConnected` todo `true` (a estrada do lote chega ao Lobby) |
| `lotes (quadrantes)` | lotes em pelo menos 3 dos 4 quadrantes |
| `estradas (trecho torto ou vazio)` | cada trecho de `ROAD_LEGS` é reto (eixo X ou Z) e tem comprimento |
| `estradas (dentro do Lobby)` | o eixo do trecho (amostra a cada 2 studs) nunca entra no quadrado do Lobby + escadarias (meia-largura `PLAZA.guard`) |
| `estradas (fora da grama)` | o eixo só passa por grama ou rio (ponte) |
| `estradas (atravessam lote)` | nenhum trecho passa por dentro de um lote, menos o trecho que começa ou termina dentro dele (é a estrada chegando ao centro do lote) |
| `ilha (borda sem mar)` | as 4 bordas da grade (a cada 16 studs) são mar |
| `Lobby (fora da grama)` | o quadrado do Lobby (meia-largura `PLAZA.reach`) é todo grama |
| `água (lago ou rio faltando)` | existe pelo menos uma célula de lago e uma de rio |

### Camada cara: `fullProblems(w, built)` (amostra, com Parts)

| Tipo | Regra |
|---|---|
| `apoio` | `findFloating(parts, 'Mar')`: nada flutua |
| `z-fighting` | `findZFighting(parts)` |
| `passagens` | `findClearanceViolations(parts, w.clearanceZones())` |
| `limites` | `findOutside(parts, w.ENVELOPE)` |
| `spawn` | exatamente um `SpawnLocation` |
| `manual de montagem` | `buildManual(parts).problems` vazio |
| `orçamento` | no máximo 10 000 Parts |
| `marcos` | vilas, campos, jazidas, cais, montanhas, colinas e trilhas existem |

Torres de vigia e acampamentos faltando viram **aviso** (aparecem no resumo, mas não derrubam o fuzz): num mapa apertado pode não sobrar espaço para eles.

Uma exceção dentro do gerador ou das verificações vira o problema `exceção: …` da semente (com as primeiras linhas da pilha).

## Onde roda

| Onde | Sementes | Quando |
|---|---|---|
| `tests/invariants.test.mjs` (job `test` do CI normal) | layout: `SEED` e 1 a 25; Parts: `SEED`, 7 e 12345 | em todo PR e push |
| `.github/workflows/fuzz.yml` | layout: 100 000 (1 a 100 000); Parts: as múltiplas de 2000 (50 mapas) | manual e toda segunda-feira às 04:17 UTC |

O workflow grande tem três jobs:

1. `plan` divide as sementes em fatias (padrão: 40 fatias de 2500).
2. `fuzz` (uma por fatia, em paralelo, até 60 min cada) roda `node tools/fuzz.mjs --from <n> --count <n> --full-every <k> --out out/fuzz` e publica o artefato `fuzz-<fatia>` com `fuzz-<from>.json`.
3. `summary` baixa todos os artefatos, roda `tools/ci/fuzz-summary.mjs` e escreve `fuzz-summary.md` no resumo da execução (e no artefato `resumo-do-fuzz`): totais, sementes por segundo, faixas sem resultado (fatia cancelada ou com tempo esgotado), falhas agrupadas por tipo com as 50 primeiras sementes de cada, e os avisos.

## Como rodar

**Actions → Fuzz de mapas (100 mil sementes) → Run workflow**, e escolha:

| Campo | Padrão | O que é |
|---|---|---|
| `total` | 100000 | quantas sementes testar |
| `shards` | 40 | quantos jobs em paralelo (1 a 256) |
| `full_every` | 2000 | monta as Parts nas sementes múltiplas desse número (0 = nunca) |
| `first` | 1 | primeira semente |

Depois abra a execução: o resumo aparece no fim da página (job "Resumo do fuzz").

## Como reproduzir uma semente que falhou

1. **No CI, só aquela semente:** Run workflow com `first` = a semente, `total` = 1, `shards` = 1 e `full_every` = 1. A fatia única roda as duas camadas e o log mostra cada problema.
2. **No visualizador:** abra o visualizador com `#seed=<n>` no fim do endereço (por exemplo `index.html#seed=4242`) para ver o mapa daquela semente.
3. **No CI normal, num PR:** acrescente a semente em `LAYOUT_SEEDS` (ou `FULL_SEEDS`) de `tests/invariants.test.mjs`. Ela passa a ser testada em todo PR, e a correção fica protegida dali em diante.

## Regra de ouro

**Semente que falha se corrige no gerador (`src/map.js`), nunca pulando a semente, nunca afrouxando a invariante.** Se o gerador às vezes não consegue cumprir uma regra (por exemplo, encaixar 30 lotes), ele precisa trocar de estratégia sozinho (como `planKingdom` já troca lotes sem estrada de lugar). Depois de corrigir:

- coloque a semente que falhou em `tests/invariants.test.mjs` (regressão);
- rode o fuzz de novo;
- registre a lição na tabela 6.1 do AGENTS.md.

Mudar uma invariante só vale quando a **regra** do jogo muda, e a mudança vai para o AGENTS.md no mesmo commit.

## Tempo estimado

- Camada barata: um `createWorld` faz a grade de 75×75 células, o sorteio dos lotes e a malha de estradas. Estimativa: 20 a 100 ms por semente, então uma fatia de 2500 sementes leva de 1 a 5 minutos.
- Camada cara: `buildMap()` com 5 a 9 mil Parts mais apoio, z-fighting e manual. Estimativa: 10 a 40 s por mapa, 1 ou 2 por fatia.
- Com 40 fatias em paralelo, a execução inteira deve levar menos de 10 minutos (fora a fila dos runners). O resumo mostra os números reais (sementes/s por job e a fatia mais lenta); se uma fatia passar de 60 min, aumente `shards`.
