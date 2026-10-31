import type { Word } from '../data';
import { shuffle, type Rng } from './random';

/** Tone marks by tone number; 5 is the neutral tone (no mark). */
const MARKS: Record<string, number> = { '̄': 1, '́': 2, '̌': 3, '̀': 4 };
const MARK_OF: Record<number, string> = { 1: '\u0304', 2: '\u0301', 3: '\u030c', 4: '\u0300' };

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

/** A pinyin syllable with its tone mark removed (ü is kept): "huān" → "huan", "nǚ" → "nü". */
function bare(syllable: string): string {
  return syllable.normalize('NFD').replace(/[\u0300\u0301\u0304\u030c]/g, '').normalize('NFC');
}

/** Put a tone on a bare syllable, on the vowel pinyin marks: a or e first, the o of ou, else the last vowel. */
export function withTone(syllable: string, tone: number): string {
  const s = bare(syllable);
  const mark = MARK_OF[tone];
  if (!mark) return s;
  const lower = s.toLowerCase();
  let at = lower.search(/[ae]/);
  if (at < 0) at = lower.indexOf('ou');
  if (at < 0) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('iouü'.includes(lower[i])) {
        at = i;
        break;
      }
    }
  }
  if (at < 0) return s;
  return (s.slice(0, at + 1) + mark + s.slice(at + 1)).normalize('NFC');
}

/**
 * Ship label for a tone pattern, drawn on the tested word's own syllables with the numbers below:
 * "3-5" for 喜欢 → "xǐ huan\n3 · 0", and "1-5" → "xī huan\n1 · 0".
 */
export function toneLabel(pattern: string, pinyin: string): string {
  const tones = pattern.split('-').map(Number);
  const syllables = pinyin.split(/\s+/).filter(Boolean);
  return `${tones.map((t, i) => withTone(syllables[i] ?? 'ma', t)).join(' ')}\n${tones.map((t) => (t === 5 ? '0' : t)).join(' · ')}`;
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
