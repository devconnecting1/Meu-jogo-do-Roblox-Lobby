# CLAUDE.md

@AGENTS.md

## Regras específicas para o Claude

- **Não execute nada localmente** (nem `node`, `npm`, `rojo`, Playwright ou testes). O usuário exige que tudo rode no GitHub Actions. Edite os arquivos, faça commit e push, e leia os resultados:
  - comentário **"Testes da construção"**: lista exata das falhas (peça + coordenada);
  - comentário **"📸 Como ficou"**: capturas de cada vista (branch `ci-previews`);
  - comentário **"🎮 Publicação no Roblox"**: versão publicada ou erro da Open Cloud;
  - comentário **"ESLint + Prettier"**: se houver o branch `autoformat/pr-N`, incorpore com `git fetch origin autoformat/pr-N && git merge --no-edit FETCH_HEAD` (não formate à mão).
- Depois de abrir ou atualizar um PR, acompanhe a atividade do PR e só encerre quando os comentários do CI chegarem.
- Antes de mexer no mapa, leia `src/map.js` e as seções 4 e 6 do AGENTS.md. O terreno sai da grade de células de 4 studs (tipo, topo e superfície): mude a grade, não crie peças soltas no chão. Sorteios sempre com `rand()`/`nz()` da semente.
- Revise mentalmente cada peça nova contra as regras: apoio, plano das faces (base das peças deitadas), zona livre e distância de lotes/estradas. É mais barato do que uma rodada de CI.
- Falha de teste se corrige na geometria. Nunca afrouxe um teste para ficar verde.
- Ao receber falha: leia **a lista inteira** do comentário (todas as peças e coordenadas), entenda a causa real e corrija tudo num commit só. Depois registre a lição nova na tabela 6.1 do AGENTS.md.
- Antes de cada push, confira as peças novas contra a tabela 6.1 do AGENTS.md (nomes com "gui", espessura < 0,04, bases deitadas no mesmo plano, fase do manual, decoração com colisão perto de passagens, Neon sem luz, cor fora da paleta neutra).
- **Imagens sempre:** a cada commit com capturas, baixe **todas** as imagens do comentário "📸 Como ficou" (branch `ci-previews/pr-N/<sha>/`) e envie no chat como anexo para o usuário baixar, inclusive catálogo e variantes. Diga o que melhorou e o que ainda está fraco.
- **Memória do projeto:** toda regra, lição, teste ou decisão nova vai para o AGENTS.md (regras, tabela de testes, 6.1) no mesmo commit; o README resume o que existe. Nada fica só na conversa.
- Não faça push enquanto o job de capturas roda (cancela as imagens), a não ser para corrigir teste vermelho. O usuário sempre quer **ver as imagens** no chat: baixe do branch `ci-previews/pr-N/<sha>/` e envie.
- Decoração nova precisa fazer sentido no reino (regra 10 do AGENTS.md): nada no caminho de lotes, estradas ou da praça.
- A prisão antiga fica só no branch `arquivo/prisao` e o Reino clássico (até a versão 21) no `arquivo/reino-classico`; não traga nada deles de volta sem pedido do usuário.
- Estilo atual (pedido do usuário): voxel pixelado liso, SmoothPlastic sem studs. Referência de estilo, nunca cópia do mapa de outro jogo.
- Nunca grave chaves em arquivos, commits, comentários ou logs.
- Quando o usuário pedir, faça merge do PR **somente** com todos os jobs verdes (lint, testes, build, capturas e publicação).
- Commits e PRs em português.
