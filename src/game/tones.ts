import type { Word } from '../data';
import { shuffle, type Rng } from './random';

/** Tone marks by tone number; 5 is the neutral tone (no mark). */
const MARKS: Record<string, number> = { '̄': 1, '́': 2, '̌': 3, '̀': 4 };
const SAMPLE: Record<number, string> = { 1: 'mā', 2: 'má', 3: 'mǎ', 4: 'mà', 5: 'ma' };

/** Tone numbers of a space-separated pinyin reading: "xǐ huan" → [3, 5]. */
export function tonesOf(pinyin: string): number[] {
  return pinyin
    .split(/\s+/)
    .filter(Boolean)
    .map((syllable) => {
      const marks = [...syllable.normalize('NFD')].map((c) => MARKS[c]).filter(Boolean);
      return marks[0] ?? 5;
    });
}

/** Tone pattern of a two-character word, or null for anything else ("3-5"). */
export function tonePair(word: Word): string | null {
  if ([...word.hanzi].length !== 2) return null;
  const tones = tonesOf(word.pinyin);
  if (tones.length !== 2 || tones[0] === 5) return null;
  return tones.join('-');
}

/** Ship label for a tone pattern, drawn on a dummy syllable with the numbers below: "3-5" → "mǎ ma\n3 · 0". */
export function toneLabel(pattern: string): string {
  const tones = pattern.split('-').map(Number);
  return `${tones.map((t) => SAMPLE[t]).join(' ')}\n${tones.map((t) => (t === 5 ? '0' : t)).join(' · ')}`;
}

/** What the pattern sounds like in speech, when sandhi changes it: two third tones are said 2+3. */
export function sandhiNote(pattern: string): string | null {
  return pattern === '3-3' ? 'two 3rd tones are said 2+3' : null;
}

/** Pick up to `size` two-character words with distinct tone patterns, so each ship is one pattern. */
export function pickToneWave(pool: readonly Word[], size: number, rng: Rng): Word[] {
  const byPattern = new Map<string, Word>();
  for (const word of shuffle(pool, rng)) {
    const pattern = tonePair(word);
    if (pattern && !byPattern.has(pattern)) byPattern.set(pattern, word);
  }
  return shuffle([...byPattern.values()], rng).slice(0, size);
}

/** Pinyin reduced to plain letters for typing: "nǚ ér" → "nuer", "xi3huan" → "xihuan". */
export function toneless(pinyin: string): string {
  return pinyin
    .normalize('NFD')
    .toLowerCase()
    .replace(/[̀-ͯ]/g, '')
    .replace(/v/g, 'u')
    .replace(/[^a-z]/g, '');
}
