# Reino — Roblox

Mapa base de um jogo de estratégia no estilo **Lords Mobile** no Roblox. **Fase atual: o Terreno do Vale**, um terreno vazio em estilo voxel pixelado (blocos lisos, bordas em escada, cores quentes), pronto para receber as construções. O GitHub Actions testa, compila, renderiza e publica tudo automaticamente.

![Visão geral](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/overview.png)

| | |
|---|---|
| ![Lobby](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/lobby.png) | ![Penhascos](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/cliffs.png) |
| ![Lote](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/plot.png) | ![Estrada](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/road.png) |

*As imagens são geradas pelo CI a cada push na `main`. Em PRs, elas aparecem no comentário "📸 Como ficou".*

## O que tem

- **Vale procedural:** um planalto de até 720×720 studs com o vale no meio. Cada servidor sorteia uma semente: o formato do vale, os penhascos, as lagoas, os lotes, as estradas e os terraços mudam.
- **Lobby** no centro: praça de pedra clara com faixas escuras pixeladas, estrado no meio (lugar da futura construção central) e o spawn.
- **Áreas com a planta do prédio:** 8 áreas em volta da praça, cada uma com o formato da construção que vai receber (taverna em L, capela em cruz, torre redonda, estábulo em U, mercado com alpendre…), e **30 lotes de castelo** (20 jogadores e 10 bots) com 7 plantas diferentes (fortaleza com torres, castelo em L, redondo, com pátio, em cruz, em U e em T), todos planos, com borda de pedra e a frente virada para o Lobby.
- **Estradas de terra** com borda serrilhada ligando a praça a todas as áreas e lotes; passagem de pedra sobre as lagoas.
- **Relevo:** penhascos de rocha em blocos com musgo no topo cercando boa parte do vale, borda aberta sobre o mar no resto, terraços de grama e lagoas.
- **Estilo voxel liso:** SmoothPlastic sem studs, grama com manchas escuras em blocos, paleta quente (`src/palette.js`, grupo `px…`).
- **Luz de fim de tarde** (Lighting Future, sombra nítida, neblina leve no horizonte).
- **Manual de montagem:** o CI gera etapas de até 8 peças e verifica que cada uma se apoia no que já foi montado.
- **Fuzz de 100 mil mapas:** um workflow separado (*Actions → Fuzz de mapas → Run workflow*, e toda segunda-feira) testa as regras de layout em 100 mil sementes; todo PR testa 26 sementes. Veja [docs/FUZZ.md](docs/FUZZ.md).

**Guardados:** o Reino clássico até a versão 21 (ilha com vilas, fazendas, biomas, montanhas, Lobby com lojas e fonte, catálogo de peças, Plastic com studs) está no branch [`arquivo/reino-classico`](https://github.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/tree/arquivo/reino-classico), e a prisão do projeto anterior no [`arquivo/prisao`](https://github.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/tree/arquivo/prisao).

## Como funciona

```
src/map.js ─┬─► src/rojo.js ─► Rojo ─► reino.rbxl ─► Open Cloud ─► Roblox
            ├─► viewer/main.js (Three.js) ─► capturas do CI / GitHub Pages
            └─► tests/ (apoio, z-fighting, passagens, lotes, estradas, relevo, estilo)
```

Tudo roda em `.github/workflows/ci.yml` (`ubuntu-latest`). Os jobs são **lint (ESLint + Prettier) → test → build → render → publish** (e **pages** na `main`). Veja as regras completas em [AGENTS.md](AGENTS.md).

### Publicação no Roblox

| | |
|---|---|
| Universo | `10548333977` |
| Lugar | `116364339053967` |

Configure em *Settings → Secrets and variables → Actions*:

- `ROBLOX_CLOUD_API`: chave Open Cloud com o escopo `universe-places:write`. **Use a aba Secrets.** O CI também aceita Variables e mascara a chave nos logs.
- `ROBLOX_UNIVERSE_ID` e `ROBLOX_LOCAL_ID`: opcionais.

A publicação acontece em PRs do próprio repositório, em todo push na `main` e manualmente (*Actions → CI → Run workflow*), sempre depois dos testes e do build passarem.

> A publicação substitui o lugar inteiro, então não edite o mapa no Studio. As versões anteriores ficam no histórico do Creator Hub.

### Visualizador 3D

- Prévia de qualquer branch: `https://raw.githack.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/<branch>/index.html`
- GitHub Pages (depois do merge na `main`): ative em *Settings → Pages → Source: GitHub Actions*.
