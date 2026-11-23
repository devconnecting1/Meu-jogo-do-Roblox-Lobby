#!/usr/bin/env node
// Cria/atualiza um comentário fixo no PR (um por tipo) — roda no GitHub Actions.
// Uso:
//   node tools/ci/pr-comment.mjs tests    <relatorio.txt>   (env: OUTCOME)
//   node tools/ci/pr-comment.mjs previews <manifest.json>   (env: BASE_URL)
//   node tools/ci/pr-comment.mjs publish  <resumo.md>
// Env comuns: GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, SHA, GITHUB_SERVER_URL, GITHUB_RUN_ID

import { existsSync, readFileSync } from 'node:fs';

const [mode, file] = process.argv.slice(2);
const env = process.env;
const repo = env.GITHUB_REPOSITORY;
const pr = env.PR_NUMBER;
if (!pr) {
  console.log('Sem PR: nada a comentar.');
  process.exit(0);
}
const runUrl = `${env.GITHUB_SERVER_URL}/${repo}/actions/runs/${env.GITHUB_RUN_ID}`;
const short = (env.SHA || '').slice(0, 7);
const marker = `<!-- prisao-ci:${mode} -->`;
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

function testsBody() {
  const report = existsSync(file) ? strip(readFileSync(file, 'utf8')) : '(sem relatório)';
  const ok = env.OUTCOME === 'success';
  const lines = report.split('\n');
  const totals = lines.filter((l) => /^ℹ (tests|pass|fail|duration_ms)/.test(l)).map((l) => l.replace('ℹ ', '')).join(' · ');
  let body = `${marker}\n## ${ok ? '✅' : '❌'} Testes da construção — \`${short}\`\n\n${totals || ''}\n\n[Execução no Actions](${runUrl})\n`;
  if (!ok) {
    const failStart = lines.findIndex((l) => /failing tests/i.test(l));
    const tail = (failStart >= 0 ? lines.slice(failStart) : lines.slice(-200)).join('\n').slice(0, 55000);
    body += `\n<details open><summary>Falhas</summary>\n\n\`\`\`\n${tail}\n\`\`\`\n</details>\n`;
  }
  return body;
}

function previewsBody() {
  const { views, stats } = JSON.parse(readFileSync(file, 'utf8'));
  const base = env.BASE_URL;
  let body = `${marker}\n## 📸 Como ficou — \`${short}\`\n\n**${stats.total} Parts · ${stats.lights} luzes · 32 celas** · [visualizador 3D desta branch](https://raw.githack.com/${repo}/${env.HEAD_REF || 'main'}/index.html)\n\n`;
  for (const v of views) body += `**${v.title}**\n\n![${v.title}](${base}/${v.id}.png)\n\n`;
  body += `[Execução no Actions](${runUrl})\n`;
  return body;
}

function publishBody() {
  const md = existsSync(file) ? readFileSync(file, 'utf8') : '(sem resumo)';
  return `${marker}\n## 🎮 Publicação no Roblox — \`${short}\`\n\n${md}\n\n[Execução no Actions](${runUrl})\n`;
}

const body = { tests: testsBody, previews: previewsBody, publish: publishBody }[mode]?.();
if (!body) throw new Error(`modo desconhecido: ${mode}`);

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GH_TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
};

let existing = null;
for (let page = 1; page <= 10 && !existing; page++) {
  const list = await api(`/repos/${repo}/issues/${pr}/comments?per_page=100&page=${page}`);
  existing = list.find((c) => c.body?.includes(marker));
  if (list.length < 100) break;
}
if (existing) {
  await api(`/repos/${repo}/issues/comments/${existing.id}`, { method: 'PATCH', body: JSON.stringify({ body }) });
  console.log(`Comentário atualizado: ${existing.html_url}`);
} else {
  const c = await api(`/repos/${repo}/issues/${pr}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
  console.log(`Comentário criado: ${c.html_url}`);
}
