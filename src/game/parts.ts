import type { Word } from '../data';

export interface HanziData {
  /** Characters that break into components; sem/phon mark the meaning and sound components. */
  chars: Record<string, { parts: string[]; sem?: string; phon?: string }>;
  /** Short English label and pinyin for every character and component. */
  defs: Record<string, [string, string]>;
}

const MAX_LENGTH = 52;

/** One character's breakdown: "妈 = 女 woman + 马 sound mǎ". Null for characters without parts. */
export function describeChar(char: string, data: HanziData): string | null {
  const info = data.chars[char];
  if (!info) return null;
  const parts = info.parts.map((part) => {
    const [def, pinyin] = data.defs[part] ?? ['', ''];
    if (part === info.phon && pinyin) return `${part} sound ${pinyin}`;
    return def ? `${part} ${def}` : part;
  });
  return `${char} = ${parts.join(' + ')}`;
}

/** Breakdown of every character in a word that has parts, as many as fit on one line. */
export function describeParts(word: Word, data: HanziData): string {
  let line = '';
  for (const char of new Set(word.hanzi)) {
    const part = describeChar(char, data);
    if (!part) continue;
    const next = line ? `${line}   ${part}` : part;
    if (next.length > MAX_LENGTH && line) break;
    line = next;
  }
  return line;
}
