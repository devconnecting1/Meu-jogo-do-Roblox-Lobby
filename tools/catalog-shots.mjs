#!/usr/bin/env node
// Fotografa o catálogo de peças (viewer/catalog.html) em Chromium headless: uma captura por
// vista e outra com o destaque de colisão, mais catalogo.json e CATALOG.md com a tabela.
// Roda no GitHub Actions (job "render"). Uso: node tools/catalog-shots.mjs <pasta-saida>

import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = resolve(process.argv[2] ?? 'out/previews');
mkdirSync(outDir, { recursive: true });

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
};
const server = createServer((req, res) => {
  const path = resolve(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  const file = path === root ? join(root, 'index.html') : path;
  if (!(file + sep).startsWith(root + sep) || !existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:${server.address().port}/viewer/catalog.html`);
// (globalThis é o window da página: assim o arquivo passa no ESLint com os globais do Node)
await page.waitForFunction(() => globalThis.__catalogo?.ready, null, { timeout: 180000 });
await page.addStyleTag({ content: '#hud{display:none !important}' });

const { views, entries, stats } = await page.evaluate(() => ({
  views: globalThis.__catalogo.views,
  entries: globalThis.__catalogo.entries,
  stats: globalThis.__catalogo.stats,
}));

async function shot(id, collision, file) {
  await page.evaluate(
    ([v, c]) => {
      globalThis.__catalogo.setCollision(c);
      globalThis.__catalogo.setView(v);
    },
    [id, collision],
  );
  // espera dois quadros completos (o SwiftShader é lento) antes de capturar
  await page.evaluate(
    () => new Promise((r) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(r))),
  );
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outDir, file) });
}

const images = {};
for (const v of views) {
  const normal = `catalogo-${v.id}.png`;
  const colisao = `catalogo-${v.id}-colisao.png`;
  await shot(v.id, false, normal);
  await shot(v.id, true, colisao);
  images[v.id] = { normal, colisao };
  console.log(`✔ ${normal} + ${colisao} — ${v.title}`);
}
await page.evaluate(() => globalThis.__catalogo.setCollision(false));

const withImages = entries.map((e) => ({ ...e, images: images[e.id] }));
writeFileSync(
  join(outDir, 'catalogo.json'),
  JSON.stringify({ views, stats, overview: images.todos, entries: withImages }, null, 2),
);

const num = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
let md = '# Catálogo de peças\n\n';
md += 'Gerado pelo CI (`tools/catalog-shots.mjs`) a partir de `src/catalog.js`: cada peça reaproveitável ';
md += 'sozinha no seu chão de studs. Na imagem "colisão", o que colide fica vermelho e o resto translúcido.\n\n';
md += `**${entries.length} peças** · ${stats.total - entries.length} partes (fora os chãos) · ${stats.collidable} com colisão\n\n`;
if (images.todos)
  md += `![Todas as peças](${images.todos.normal})\n\n[Todas as peças com colisão](${images.todos.colisao})\n\n`;
md += '| Grupo | Peça | Partes | Partes com colisão | Tamanho (L × A × P) | O que colide | Imagens |\n';
md += '|---|---|---:|---:|---|---|---|\n';
for (const e of withImages) {
  const size = e.size.map(num).join(' × ');
  const solid = e.collidableParts.length ? e.collidableParts.join(', ') : '—';
  const links = e.images ? `[normal](${e.images.normal}) · [colisão](${e.images.colisao})` : '—';
  md += `| ${e.group} | ${e.title} | ${e.parts} | ${e.collidable} | ${size} | ${solid} | ${links} |\n`;
}
writeFileSync(join(outDir, 'CATALOG.md'), md);
console.log(`✔ Catálogo: ${entries.length} peças, ${views.length * 2} capturas, catalogo.json e CATALOG.md`);

await browser.close();
server.close();
if (errors.length) {
  console.error('Erros no navegador:\n' + errors.join('\n'));
  process.exit(1);
}
