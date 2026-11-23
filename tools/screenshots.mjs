#!/usr/bin/env node
// Renderiza o visualizador em Chromium headless e salva capturas em docs/screenshots/.
// Uso: node tools/screenshots.mjs   (requer o pacote "playwright" disponível)

import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = path.endsWith('/') ? join(path, 'index.html') : path;
  if (!file.startsWith(root) || !existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const outDir = join(root, 'docs/screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => m.type() === 'error' && console.error('[browser]', m.text()));
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.__lobby?.ready, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none !important}' });

for (const view of ['exterior', 'plan', 'ground', 'upper', 'cell']) {
  await page.evaluate((v) => window.__lobby.setView(v), view);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(outDir, `${view}.png`) });
  console.log(`✔ docs/screenshots/${view}.png`);
}

await browser.close();
server.close();
