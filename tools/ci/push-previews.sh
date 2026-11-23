#!/usr/bin/env bash
# Publica as capturas no branch órfão "ci-previews" (não polui o histórico do código).
# Entradas (env): TARGET (ex.: pr-1 ou main), SHA, SRC (pasta com as PNGs).
# Saída: base_url (para o comentário do PR), escrita em $GITHUB_OUTPUT.
set -euo pipefail

SRC="${SRC:-out/previews}"
SHORT="${SHA:0:7}"
DIR="${TARGET}/${SHORT}"
BRANCH=ci-previews
WT="$(mktemp -d)"

git config --global user.name "github-actions[bot]"
git config --global user.email "41898282+github-actions[bot]@users.noreply.github.com"

if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  git fetch --depth=1 origin "$BRANCH"
  git worktree add --detach "$WT" FETCH_HEAD
else
  git worktree add --detach "$WT" HEAD
  git -C "$WT" checkout --orphan "$BRANCH"
  git -C "$WT" rm -rfq .
  printf '# ci-previews\n\nCapturas geradas automaticamente pelo CI. Não edite.\n' > "$WT/README.md"
fi

mkdir -p "$WT/$DIR" "$WT/$TARGET/latest"
cp "$SRC"/* "$WT/$DIR/"
rm -f "$WT/$TARGET/latest/"*
cp "$SRC"/* "$WT/$TARGET/latest/"

git -C "$WT" add -A
git -C "$WT" commit -qm "capturas: ${TARGET} ${SHORT}" || echo "sem mudanças"

for attempt in 1 2 3 4 5; do
  if git -C "$WT" push -q origin "HEAD:refs/heads/$BRANCH"; then break; fi
  echo "push recusado (tentativa $attempt); rebase e nova tentativa"
  git -C "$WT" fetch -q --depth=50 origin "$BRANCH"
  git -C "$WT" rebase -q FETCH_HEAD
  sleep $((attempt * 2))
done

echo "base_url=https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${BRANCH}/${DIR}" >> "$GITHUB_OUTPUT"
