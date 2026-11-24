# Reino — Roblox

Mapa base de um jogo de estratégia no estilo **Lords Mobile**, feito só com **Part clássico** (studs em cima, inlet embaixo) e cores neutras. Ainda não tem UI, NPC, script nem castelos de jogador: é o terreno onde os castelos vão ficar. O GitHub Actions testa, compila, renderiza e publica tudo automaticamente.

![Visão geral](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/overview.png)

| | |
|---|---|
| ![Lobby](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/lobby.png) | ![Mercado](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/market.png) |
| ![Ponte](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/bridge.png) | ![Planalto](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/mesa.png) |

*As imagens são geradas pelo CI a cada push na `main`. Em PRs, elas aparecem no comentário "📸 Como ficou".*

## O que tem

- **Ilha de 1200×1200 studs** cercada de mar, com praia, lago e um rio que corta o oeste até o mar.
- **30 lotes de castelo** (20 para jogadores e 10 para bots), espalhados pelo mapa com folga entre eles. Cada lote tem fundação de 32×32 com studs, meio-fio, marcos nos cantos e bandeira. O jogo vai sortear depois quem fica em cada lote.
- **Lobby** no centro, como nas referências: plataforma elevada de studs com mureta e 4 escadarias de madeira com corrimão, estátua do rei com coroa, espada e escudo, mercado com 4 barracas de toldo listrado, caixotes, canteiros de flores, colunas antigas (algumas partidas) e o spawn.
- **Estradas de pedra** ligando todos os lotes ao Lobby e **pontes de madeira** com guarda-corpo sobre o rio.
- **Natureza:** florestas verdes e bosques de outono com árvores de copa em camadas, arbustos, pedras e **planaltos de rocha** com topo de grama e escadaria de pedra para subir.
- **Recursos** (futuros pontos de coleta): campos de trigo cercados, jazidas de ouro e pedreiras.
- **Costa:** cais de madeira com barco amarrado.
- **Dia claro** (Lighting Future), sombra suave e neblina leve no horizonte.
- **Manual de montagem:** o CI gera etapas de até 8 peças e verifica que cada uma se apoia no que já foi montado.

A prisão do projeto anterior está guardada no branch [`arquivo/prisao`](https://github.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/tree/arquivo/prisao).

## Como funciona

```
src/map.js ─┬─► src/rojo.js ─► Rojo ─► reino.rbxl ─► Open Cloud ─► Roblox
            ├─► viewer/main.js (Three.js) ─► capturas do CI / GitHub Pages
            └─► tests/ (apoio, z-fighting, passagens, lotes, estradas, estilo)
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
