// Builds public/data/hsk/{1..7}.json from drkameleon/complete-hsk-vocabulary (MIT).
// Usage: npm run build:data
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { buildLevels } from './vocab.mjs';

const COMMIT = '7ac65bf1a6387d35f1ade478906172a19311c7f9';
const SOURCE = `https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/${COMMIT}/complete.json`;
const CACHE = `.cache/complete-hsk-vocabulary-${COMMIT}.json`;
const OUT = 'public/data/hsk';

async function loadSource() {
  if (!existsSync(CACHE)) {
    console.log(`Downloading ${SOURCE}`);
    const res = await fetch(SOURCE);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    await mkdir('.cache', { recursive: true });
    await writeFile(CACHE, await res.text());
  }
  return JSON.parse(await readFile(CACHE, 'utf8'));
}

const levels = buildLevels(await loadSource());
await mkdir(OUT, { recursive: true });
let total = 0;
const index = [];
for (const [level, words] of levels) {
  total += words.length;
  index.push({ level, count: words.length, cumulative: total });
  await writeFile(`${OUT}/${level}.json`, JSON.stringify(words));
  console.log(`HSK ${level === 7 ? '7-9' : level}: ${words.length} words (cumulative ${total})`);
}
await writeFile(`${OUT}/index.json`, JSON.stringify({ source: SOURCE, levels: index }, null, 2));
