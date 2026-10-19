import type { Word } from '../data';

export interface WordResult {
  word: Word;
  correct: number;
  wrong: number;
}

export const WAVE_SIZES = [8, 8, 12, 12, 12];
/** In a level run, this wave drills two-syllable tone pairs instead of meanings. */
export const TONE_WAVE = 2;
export const STARTING_SHIELDS = 3;
/** A daily patrol reviews at most this many due words, so it stays a few minutes long. */
export const PATROL_MAX = 36;

/** Wave sizes for a patrol of `count` words: waves of up to 12, none smaller than 4. */
export function patrolWaves(count: number): number[] {
  const words = Math.min(count, PATROL_MAX);
  if (words === 0) return [];
  const waves = Math.ceil(words / 12);
  const base = Math.floor(words / waves);
  return Array.from({ length: waves }, (_, i) => base + (i < words % waves ? 1 : 0));
}

/** A run is either a sector of one HSK level or a daily patrol of due reviews across levels. */
export type RunKind = 'level' | 'patrol';

/** Score, shields and per-word outcomes for one run. Kept free of Phaser so it can be unit-tested. */
export class RunState {
  wave = 0;
  score = 0;
  combo = 0;
  shields = STARTING_SHIELDS;
  invaded = false;
  readonly results = new Map<string, WordResult>();

  constructor(
    readonly level: number,
    readonly kind: RunKind = 'level',
    readonly waveSizes: readonly number[] = WAVE_SIZES,
  ) {}

  get waveCount() {
    return this.waveSizes.length;
  }

  /** True when the current wave drills tone pairs. */
  get isToneWave() {
    return this.kind === 'level' && this.wave === TONE_WAVE;
  }

  get isOver() {
    return this.shields <= 0 || this.invaded;
  }

  get isWon() {
    return !this.isOver && this.wave >= this.waveCount;
  }

  private entry(word: Word): WordResult {
    let result = this.results.get(word.hanzi);
    if (!result) {
      result = { word, correct: 0, wrong: 0 };
      this.results.set(word.hanzi, result);
    }
    return result;
  }

  /** The player hit the prompted word. Returns the points earned. */
  hit(word: Word): number {
    this.entry(word).correct++;
    this.combo++;
    const points = 100 * Math.min(this.combo, 5);
    this.score += points;
    return points;
  }

  /** The player hit `shot` while the prompt was for `target`: the prompt counts as missed. */
  miss(target: Word, shot: Word) {
    this.entry(target).wrong++;
    this.entry(shot);
    this.combo = 0;
    this.shields--;
  }

  get accuracy(): number {
    let correct = 0;
    let total = 0;
    for (const r of this.results.values()) {
      correct += r.correct;
      total += r.correct + r.wrong;
    }
    return total === 0 ? 0 : correct / total;
  }

  /** Words prompted and answered wrong at least once, worst first. */
  get missedWords(): WordResult[] {
    return [...this.results.values()].filter((r) => r.wrong > 0).sort((a, b) => b.wrong - a.wrong);
  }
}
