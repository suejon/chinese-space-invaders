import type { Word } from '../data';
import { shuffle, type Rng } from './random';

/** Normalize an English sense for comparison: lowercase, no parentheticals, no leading "to ". */
function senseKey(sense: string): string {
  return sense
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/^to /, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function senseKeys(word: Word): Set<string> {
  const keys = new Set<string>();
  for (const meaning of [word.gloss, ...word.meanings]) {
    for (const part of meaning.split(/[;,]/)) {
      const key = senseKey(part);
      if (key.length > 0) keys.add(key);
    }
  }
  return keys;
}

/**
 * Two words conflict when a prompt for one could fairly be answered by the other:
 * same characters, same gloss, or any shared sense (能 / 会 both mean "can").
 */
export function conflicts(a: Word, b: Word): boolean {
  if (a.hanzi === b.hanzi || a.gloss === b.gloss) return true;
  const keysA = senseKeys(a);
  for (const key of senseKeys(b)) if (keysA.has(key)) return true;
  return false;
}

/**
 * Pick `size` words where no two conflict, so any of them can be the prompt with exactly one right answer.
 * `prefer` words are tried first (e.g. words the player has not seen this run).
 */
export function pickWave(pool: readonly Word[], size: number, rng: Rng, prefer: readonly Word[] = []): Word[] {
  const preferred = new Set(prefer.map((w) => w.hanzi));
  const ordered = [
    ...shuffle(pool.filter((w) => preferred.has(w.hanzi)), rng),
    ...shuffle(pool.filter((w) => !preferred.has(w.hanzi)), rng),
  ];
  const wave: Word[] = [];
  for (const word of ordered) {
    if (wave.length === size) break;
    if (wave.every((other) => !conflicts(word, other))) wave.push(word);
  }
  return wave;
}
