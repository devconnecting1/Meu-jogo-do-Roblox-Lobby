#!/usr/bin/env node
// Publica o .rbxl no lugar do Roblox via Open Cloud (Place Publishing API).
// Roda SOMENTE no GitHub Actions (job "publish"), depois dos testes e do build.
//
// Credenciais (GitHub → Settings → Secrets and variables → Actions):
//   ROBLOX_CLOUD_API      chave Open Cloud (escopo universe-places:write) — prefira "Secret"
//   ROBLOX_UNIVERSE_ID    opcional (padrão: roblox.config.json)
//   ROBLOX_LOCAL_ID       opcional (padrão: roblox.config.json)
//
// Uso: node tools/publish.mjs build/reino.rbxl [--saved]

import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(root, 'roblox.config.json'), 'utf8'));
const args = process.argv.slice(2);
const file = resolve(root, args.find((a) => !a.startsWith('--')) ?? 'build/reino.rbxl');
const versionType = args.includes('--saved') ? 'Saved' : 'Published';

const apiKey = (process.env.ROBLOX_CLOUD_API || '').trim();
const universeId = (process.env.ROBLOX_UNIVERSE_ID || config.universeId).trim();
const placeId = (process.env.ROBLOX_LOCAL_ID || config.placeId).trim();

const summary = (md) => {
  for (const f of [process.env.GITHUB_STEP_SUMMARY, process.env.PUBLISH_REPORT]) if (f) appendFileSync(f, md + '\n');
};

// Nunca deixar a chave aparecer no log (repositório público).
if (apiKey && process.env.GITHUB_ACTIONS) console.log(`::add-mask::${apiKey}`);

if (!apiKey) {
  console.log('::warning title=Roblox::ROBLOX_CLOUD_API não configurada — publicação ignorada.');
  summary('### Roblox\n⚠️ `ROBLOX_CLOUD_API` não configurada: publicação ignorada.');
  process.exit(0);
}
if (!/^\d+$/.test(universeId) || !/^\d+$/.test(placeId)) {
  console.error('::error title=Roblox::IDs de universo/lugar inválidos.');
  process.exit(1);
}

const body = readFileSync(file);
const url = `https://apis.roblox.com/universes/v1/${universeId}/places/${placeId}/versions?versionType=${versionType}`;
console.log(
  `→ Enviando ${(body.length / 1024).toFixed(0)} KB para universo ${universeId}, lugar ${placeId} (${versionType})`,
);

let lastError = '';
for (let attempt = 1; attempt <= 4; attempt++) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/octet-stream' },
    body,
  });
  const text = await res.text();
  if (res.ok) {
    const { versionNumber } = JSON.parse(text);
    console.log(`✔ Publicado! Versão ${versionNumber}`);
    summary(
      `### Roblox\n✅ Publicado no lugar \`${placeId}\` — versão **${versionNumber}** (${versionType}).\nhttps://www.roblox.com/games/${placeId}`,
    );
    process.exit(0);
  }
  lastError = `HTTP ${res.status}: ${text}`;
  // 4xx (exceto 429) não melhora com nova tentativa
  if (res.status < 500 && res.status !== 429) break;
  await new Promise((r) => setTimeout(r, attempt * 5000));
}
console.error(`::error title=Roblox::Falha ao publicar — ${lastError}`);
summary(`### Roblox\n❌ Falha ao publicar: \`${lastError}\``);
process.exit(1);
