# CLAUDE.md

@AGENTS.md

## Regras específicas para o Claude

- **Não execute nada localmente** (nem `node`, `npm`, `rojo`, Playwright ou testes). O usuário exige que tudo rode no GitHub Actions. Edite os arquivos, faça commit e push, e leia os resultados:
  - comentário **"Testes da construção"**: lista exata das falhas (peça + coordenada);
  - comentário **"📸 Como ficou"**: capturas de cada vista (branch `ci-previews`);
  - comentário **"🎮 Publicação no Roblox"**: versão publicada ou erro da Open Cloud.
- Depois de abrir ou atualizar um PR, acompanhe a atividade do PR e só encerre quando os comentários do CI chegarem.
- Antes de mexer na geometria, leia `src/prison.js` e as seções 4 e 6 do AGENTS.md. Prefira os helpers (`span`, `hangingLight`, `panelLight`, `glassRail`, `crate`, `rack`) a criar peças soltas.
- Revise mentalmente cada peça nova contra as regras: apoio, plano das faces, zona livre e borda com queda. É mais barato do que uma rodada de CI.
- Falha de teste se corrige na geometria. Nunca afrouxe um teste para ficar verde.
- Nunca grave chaves em arquivos, commits, comentários ou logs.
- Commits e PRs em português.
