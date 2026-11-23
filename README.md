# Prisão — Roblox

Prisão **fechada** de 2 andares, feita só com **Part clássico** em cores neutras. Não tem UI, NPC nem script: é apenas a construção. O GitHub Actions testa, compila, renderiza e publica tudo automaticamente.

![Átrio](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/atrium.png)

| | |
|---|---|
| ![Visão geral](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/overview.png) | ![Corredor](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/corridor.png) |
| ![Galeria](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/upper.png) | ![Cela](https://raw.githubusercontent.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/ci-previews/main/latest/cell.png) |

*As imagens são geradas pelo CI a cada push na `main`. Em PRs, elas aparecem no comentário "📸 Como ficou".*

## O que tem

- **Envoltória fechada:** piso, teto e 4 paredes opacos. Não há janelas, portas nem exterior.
- **32 celas** em 2 alas × 2 andares. Cada uma tem fachada com janela de observação, porta de grade deslizante, cama, vaso, pia com espelho, mesa, banqueta, prateleira e luz embutida.
- **Átrio de pé-direito duplo** com refeitório (mesas redondas), caixas, colunas no ritmo das celas e luminárias fluorescentes.
- **2º andar** com galerias de guarda-corpo de vidro, ponte central e mezanino, com acesso por uma escada de degraus de 1 stud.
- **Hall** com SpawnLocation e posto de guarda, **depósitos**, **sala de visitas** e **estoque** com estantes.
- **Lighting:** tecnologia Future, sem sol (ambiente fechado), ambiente neutro, correção de cor sutil e bloom leve nas lâmpadas.

## Como funciona

```
src/prison.js ─┬─► src/rojo.js ─► Rojo ─► prisao.rbxl ─► Open Cloud ─► Roblox
               ├─► viewer/main.js (Three.js) ─► capturas do CI / GitHub Pages
               └─► tests/ (apoio, z-fighting, passagens, guarda-corpo, estilo)
```

Tudo roda em `.github/workflows/ci.yml` (`ubuntu-latest`). Os jobs são **test → build → render → publish** (e **pages** na `main`). Veja as regras completas em [AGENTS.md](AGENTS.md).

### Publicação no Roblox

| | |
|---|---|
| Universo | `10548333977` |
| Lugar | `116364339053967` |

Configure em *Settings → Secrets and variables → Actions*:

- `ROBLOX_CLOUD_API`: chave Open Cloud com o escopo `universe-places:write`. **Use a aba Secrets.** O CI também aceita Variables e mascara a chave nos logs.
- `ROBLOX_UNIVERSE_ID` e `ROBLOX_LOCAL_ID`: opcionais.

A publicação acontece em PRs do próprio repositório, em todo push na `main` e manualmente (*Actions → CI → Run workflow*). Ela sempre roda depois dos testes e do build passarem.

> A publicação substitui o lugar inteiro, então não edite a prisão no Studio. As versões anteriores ficam no histórico do Creator Hub.

### Visualizador 3D

- Prévia de qualquer branch: `https://raw.githack.com/devconnecting1/Meu-jogo-do-Roblox-Lobby/<branch>/index.html`
- GitHub Pages (depois do merge na `main`): ative em *Settings → Pages → Source: GitHub Actions*.

Tem 10 vistas, corte sem teto e modo **Andar (WASD)** com física parecida com a do Roblox.
