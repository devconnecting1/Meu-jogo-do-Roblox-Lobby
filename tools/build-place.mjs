#!/usr/bin/env node
// Gera build/Prisao.model.json (Rojo). Em seguida o CI roda:
//   rojo build default.project.json -o build/prisao.rbxl
// Roda no GitHub Actions (job "build"); não é necessário rodar localmente.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrison } from '../src/prison.js';
import { toRojoModel } from '../src/rojo.js';
import { stats } from '../src/builder.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'build/Prisao.model.json');

const { parts } = buildPrison();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(toRojoModel(parts), null, 1));
const s = stats(parts);
console.log(`✔ build/Prisao.model.json — ${s.total} Parts, ${s.lights} luzes`);
