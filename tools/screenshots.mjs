#!/usr/bin/env node
// Renderiza o visualizador em Chromium headless e salva uma captura por vista.
// Roda no GitHub Actions (job "render"). Uso: node tools/screenshots.mjs <pasta-saida>

import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { VARIANT_SEEDS } from '../src/variants.js';

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
await page.goto(`http://localhost:${server.address().port}/index.html`);
await page.waitForFunction(() => window.__reino?.ready, null, { timeout: 180000 });
await page.addStyleTag({ content: '#hud{display:none !important}' });

const { views, stats, manual } = await page.evaluate(() => ({
  views: window.__reino.views,
  stats: window.__reino.stats,
  manual: window.__reino.manual,
}));
for (const v of views) {
  await page.evaluate((id) => window.__reino.setView(id), v.id);
  // espera dois quadros completos (o SwiftShader é lento) antes de capturar
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(outDir, `${v.id}.png`) });
  console.log(`✔ ${v.id}.png — ${v.title}`);
}
// variantes sorteadas por servidor: uma vista de cima e uma geral de cada semente
const base = `http://localhost:${server.address().port}/index.html`;
for (const seed of VARIANT_SEEDS) {
  await page.goto('about:blank');
  await page.goto(`${base}#seed=${seed}`);
  await page.waitForFunction((s) => window.__reino?.ready && window.__reino.seed === s, seed, { timeout: 180000 });
  await page.addStyleTag({ content: '#hud{display:none !important}' });
  for (const [view, suffix, title] of [
    ['top', '', 'vista de cima'],
    ['overview', '-geral', 'visão geral'],
  ]) {
    await page.evaluate((id) => window.__reino.setView(id), view);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(800);
    const id = `variante-${seed}${suffix}`;
    await page.screenshot({ path: join(outDir, `${id}.png`) });
    views.push({ id, title: `Variante do servidor (semente ${seed}): ${title}` });
    console.log(`✔ ${id}.png`);
  }
}
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ views, stats, manual }, null, 2));

await browser.close();
server.close();
if (errors.length) {
  console.error('Erros no navegador:\n' + errors.join('\n'));
  process.exit(1);
}
