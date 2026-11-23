#!/usr/bin/env node
// Publica build/lobby.rbxl (gerado pelo Rojo) no lugar do Roblox via Open Cloud (Place Publishing API).
//
// Requer a variável de ambiente ROBLOX_API_KEY (nunca commite a chave!).
// IDs vêm de roblox.config.json (podem ser sobrescritos por ROBLOX_UNIVERSE_ID / ROBLOX_PLACE_ID).
//
// Uso:
//   ROBLOX_API_KEY=... node tools/publish.mjs            # versão Published (vai ao ar)
//   ROBLOX_API_KEY=... node tools/publish.mjs --saved    # só salva (não vai ao ar)

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(root, 'roblox.config.json'), 'utf8'));

const universeId = process.env.ROBLOX_UNIVERSE_ID || config.universeId;
const placeId = process.env.ROBLOX_PLACE_ID || config.placeId;
const apiKey = process.env.ROBLOX_API_KEY;
const versionType = process.argv.includes('--saved') ? 'Saved' : 'Published';
const file = resolve(root, 'build/lobby.rbxl');

if (!apiKey) {
  console.error('✖ Defina ROBLOX_API_KEY (Creator Hub → Open Cloud → API Keys, escopo universe-places:write).');
  process.exit(1);
}

const body = readFileSync(file);
const url = `https://apis.roblox.com/universes/v1/${universeId}/places/${placeId}/versions?versionType=${versionType}`;

console.log(`→ Enviando ${(body.length / 1024).toFixed(0)} KB para universo ${universeId}, lugar ${placeId} (${versionType})`);

const res = await fetch(url, {
  method: 'POST',
  headers: { 'x-api-key': apiKey, 'Content-Type': 'application/octet-stream' },
  body,
});
const text = await res.text();

if (!res.ok) {
  console.error(`✖ HTTP ${res.status}: ${text}`);
  process.exit(1);
}

const { versionNumber } = JSON.parse(text);
console.log(`✔ Publicado! Versão ${versionNumber}`);
console.log(`  https://www.roblox.com/games/${placeId}`);
