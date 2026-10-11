// Pure helpers for turning complete-hsk-vocabulary entries into game words.

const SKIP_MEANING = /^(surname |variant of|old variant|archaic variant|see |used in |abbr\. for |\(Tw\)|CL:)/i;
const MAX_GLOSS = 30;

/** The HSK 3.0 exam syllabus level (Nov 2025 lists, tagged "newest-N"); 7 = levels 7–9. */
export function syllabusLevel(entry) {
  const tags = entry.level.filter((l) => l.startsWith('newest-'));
  if (tags.length === 0) return null;
  return Math.min(...tags.map((l) => Number(l.slice('newest-'.length))));
}

function usableMeanings(form) {
  return form.meanings.filter((m) => !SKIP_MEANING.test(m));
}

/** Prefer the common-noun reading with the most senses (说 shuō over shuì), skipping surname-only forms. */
export function pickForm(entry) {
  const candidates = entry.forms.filter((f) => !/^[A-ZĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙ]/.test(f.transcriptions.pinyin));
  const pool = candidates.length > 0 ? candidates : entry.forms;
  return pool.reduce((best, f) => (usableMeanings(f).length > usableMeanings(best).length ? f : best), pool[0]);
}

/** A short English prompt: as many "; "-separated parts as fit in MAX_GLOSS chars. */
export function shortGloss(meaning) {
  const parts = meaning.replace(/\s+/g, ' ').trim().split('; ');
  let gloss = parts[0];
  for (const part of parts.slice(1)) {
    if (gloss.length + 2 + part.length > MAX_GLOSS) break;
    gloss += '; ' + part;
  }
  if (gloss.length > MAX_GLOSS) {
    const bare = gloss.replace(/\s*\([^)]*\)/g, '').trim();
    if (bare.length >= 2) gloss = bare;
  }
  if (gloss.length > MAX_GLOSS) {
    const space = gloss.lastIndexOf(' ', MAX_GLOSS - 1);
    gloss = gloss.slice(0, space > 0 ? space : MAX_GLOSS - 1) + '…';
  }
  return gloss;
}

export function toWord(entry) {
  const form = pickForm(entry);
  const meanings = usableMeanings(form);
  const senses = meanings.length > 0 ? meanings : form.meanings;
  return {
    hanzi: entry.simplified,
    trad: form.traditional,
    pinyin: form.transcriptions.pinyin,
    gloss: shortGloss(senses[0] ?? ''),
    meanings: senses.slice(0, 3),
    pos: entry.pos,
    freq: entry.frequency,
  };
}

/** Group syllabus words by level, each level sorted by frequency (most common first). */
export function buildLevels(entries) {
  const levels = new Map();
  for (const entry of entries) {
    const level = syllabusLevel(entry);
    if (level === null) continue;
    if (!levels.has(level)) levels.set(level, []);
    levels.get(level).push(toWord(entry));
  }
  for (const words of levels.values()) words.sort((a, b) => a.freq - b.freq);
  return new Map([...levels].sort(([a], [b]) => a - b));
}
