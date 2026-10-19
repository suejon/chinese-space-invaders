// Builds public/data/hanzi.json (character components) from Make Me a Hanzi dictionary.txt (LGPL-3.0).
// Usage: npm run build:hanzi (after npm run build:data, since it reads the HSK word lists).
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { buildHanzi } from './hanzi.mjs';

const COMMIT = 'bddc96d41bef78427ed0e034e9f7e31d71fd1b92';
const SOURCE = `https://raw.githubusercontent.com/skishore/makemeahanzi/${COMMIT}/dictionary.txt`;
const CACHE = `.cache/makemeahanzi-${COMMIT}.txt`;
const HSK = 'public/data/hsk';

async function loadSource() {
  if (!existsSync(CACHE)) {
    console.log(`Downloading ${SOURCE}`);
    const res = await fetch(SOURCE);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    await mkdir('.cache', { recursive: true });
    await writeFile(CACHE, await res.text());
  }
  return (await readFile(CACHE, 'utf8'))
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

const wanted = new Set();
for (const file of await readdir(HSK)) {
  if (!/^\d+\.json$/.test(file)) continue;
  for (const word of JSON.parse(await readFile(`${HSK}/${file}`, 'utf8'))) for (const c of word.hanzi) wanted.add(c);
}

const { chars, defs } = buildHanzi(await loadSource(), wanted);
await writeFile('public/data/hanzi.json', JSON.stringify({ source: SOURCE, chars, defs }));
console.log(`${wanted.size} HSK characters, ${Object.keys(chars).length} with components`);
