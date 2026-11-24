#!/usr/bin/env node
// Cria/atualiza um comentário fixo no PR (um por tipo) — roda no GitHub Actions.
// Uso:
//   node tools/ci/pr-comment.mjs tests    <relatorio.txt>   (env: OUTCOME)
//   node tools/ci/pr-comment.mjs previews <manifest.json>   (env: BASE_URL)
//   node tools/ci/pr-comment.mjs publish  <resumo.md>
//   node tools/ci/pr-comment.mjs lint                       (env: PRETTIER, ESLINT, AUTOFIX_BRANCH)
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
// marcador antigo mantido de propósito: assim os comentários já existentes no PR são atualizados
const marker = `<!-- prisao-ci:${mode} -->`;
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
const strip = (s) => s.replace(ANSI, '');

function testsBody() {
  const report = existsSync(file) ? strip(readFileSync(file, 'utf8')) : '(sem relatório)';
  const ok = env.OUTCOME === 'success';
  const lines = report.split('\n');
  const totals = lines
    .filter((l) => /^ℹ (tests|pass|fail|duration_ms)/.test(l))
    .map((l) => l.replace('ℹ ', ''))
    .join(' · ');
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
  const manualFile = file.replace(/manifest\.json$/, 'manual.json');
  const manual = existsSync(manualFile) ? JSON.parse(readFileSync(manualFile, 'utf8')) : null;
  const base = env.BASE_URL;
  const blob = base
    .replace('https://raw.githubusercontent.com/', 'https://github.com/')
    .replace('/ci-previews/', '/blob/ci-previews/');
  const viewer = `https://raw.githack.com/${repo}/${env.HEAD_REF || 'main'}/index.html`;
  let body = `${marker}\n## 📸 Como ficou — \`${short}\`\n\n`;
  if (manual) {
    body += `**${manual.parts} peças · ${manual.steps} etapas · ${manual.connections} pontos de conexão verificados** · ${stats.lights} luzes · [manual de montagem](${blob}/MANUAL.md) · [visualizador 3D](${viewer})\n\n`;
  }
  const build = views.filter((v) => v.id.startsWith('build-'));
  for (const v of views.filter((x) => !x.id.startsWith('build-')))
    body += `**${v.title}**\n\n![${v.title}](${base}/${v.id}.png)\n\n`;
  if (build.length) {
    body += `### Montagem passo a passo\n\n| ${build.map((v) => v.title.replace('Montagem — ', '')).join(' | ')} |\n|${build.map(() => '---').join('|')}|\n`;
    body += `| ${build.map((v) => `![${v.title}](${base}/${v.id}.png)`).join(' | ')} |\n\n`;
  }
  body += `[Execução no Actions](${runUrl})\n`;
  return body;
}

function lintBody() {
  const tail = (f, n = 60) =>
    existsSync(f) ? strip(readFileSync(f, 'utf8')).trim().split('\n').slice(-n).join('\n') : '';
  const ok = env.PRETTIER === 'success' && env.ESLINT === 'success';
  let body = `${marker}\n## ${ok ? '✅' : '❌'} ESLint + Prettier — \`${short}\`\n\nPrettier: **${env.PRETTIER}** · ESLint: **${env.ESLINT}**\n`;
  if (env.PRETTIER !== 'success') {
    body += `\n<details><summary>Prettier</summary>\n\n\`\`\`\n${tail('prettier-report.txt')}\n\`\`\`\n</details>\n`;
  }
  if (env.ESLINT !== 'success') {
    body += `\n<details open><summary>ESLint</summary>\n\n\`\`\`\n${tail('eslint-report.txt', 120)}\n\`\`\`\n</details>\n`;
  }
  if (env.AUTOFIX_BRANCH) {
    body += `\nCorreção automática publicada em \`${env.AUTOFIX_BRANCH}\` (prettier --write + eslint --fix). Incorpore com \`git merge origin/${env.AUTOFIX_BRANCH}\`.\n`;
  }
  return body + `\n[Execução no Actions](${runUrl})\n`;
}

function publishBody() {
  const md = existsSync(file) ? readFileSync(file, 'utf8') : '(sem resumo)';
  return `${marker}\n## 🎮 Publicação no Roblox — \`${short}\`\n\n${md}\n\n[Execução no Actions](${runUrl})\n`;
}

const body = { tests: testsBody, previews: previewsBody, publish: publishBody, lint: lintBody }[mode]?.();
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
