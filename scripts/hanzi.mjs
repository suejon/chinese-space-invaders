// Pure helpers for turning Make Me a Hanzi dictionary entries into character component data.

const BINARY = new Set('⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻');
const TERNARY = new Set('⿲⿳');
const MAX_DEF = 14;

/**
 * Split an IDS decomposition into its top-level components. A nested sub-shape contributes its
 * leaf characters, and unknown parts ("？") are dropped: ⿱相心 → [相, 心], ⿰女⿱？子 → [女, 子].
 */
export function topLevelParts(ids) {
  const chars = [...ids];
  let i = 0;
  const leaves = () => {
    const c = chars[i++];
    if (c === undefined) return [];
    const arity = BINARY.has(c) ? 2 : TERNARY.has(c) ? 3 : 0;
    if (arity === 0) return c === '？' ? [] : [c];
    return Array.from({ length: arity }, leaves).flat();
  };
  const op = chars[i++];
  const arity = BINARY.has(op) ? 2 : TERNARY.has(op) ? 3 : 0;
  return Array.from({ length: arity }, leaves).flat();
}

/** A short English label for a component: the first sense, trimmed. */
export function shortDef(definition) {
  if (!definition) return '';
  let def = definition.split(/[;,]/)[0].replace(/\([^)]*\)/g, '').trim();
  if (def.length > MAX_DEF) {
    const space = def.lastIndexOf(' ', MAX_DEF);
    def = space > 0 ? def.slice(0, space) : def.slice(0, MAX_DEF);
  }
  return def;
}

/**
 * Build component data for the given characters.
 * chars: { 好: { parts: ['女', '子'], sem?: '女', phon?: '马' } } for characters that decompose.
 * defs: { 女: ['woman', 'nǚ'] } for every character and component referenced.
 */
export function buildHanzi(entries, wanted) {
  const byChar = new Map(entries.map((e) => [e.character, e]));
  const chars = {};
  const defs = {};
  const define = (c) => {
    const entry = byChar.get(c);
    if (!entry || defs[c]) return;
    defs[c] = [shortDef(entry.definition), entry.pinyin?.[0] ?? ''];
  };
  for (const c of wanted) {
    const entry = byChar.get(c);
    if (!entry) continue;
    define(c);
    const parts = topLevelParts(entry.decomposition ?? '').filter((p) => p !== c);
    if (parts.length < 2) continue;
    const info = { parts };
    const ety = entry.etymology;
    if (ety?.type === 'pictophonetic') {
      if (ety.semantic && parts.includes(ety.semantic)) info.sem = ety.semantic;
      if (ety.phonetic && parts.includes(ety.phonetic)) info.phon = ety.phonetic;
    }
    chars[c] = info;
    parts.forEach(define);
  }
  return { chars, defs };
}
