/**
 * Per-word memory between runs: a simple expanding-interval scheduler, kept in localStorage.
 * A stand-in until the FSRS engine (backlog L-1 to L-4) replaces it; the game only uses
 * review(), isMature() and due(), so the swap stays local to this file.
 */

export const DAY = 24 * 60 * 60 * 1000;
/** Words whose interval reaches this many days are "mature" and move from shooting to typing the pinyin. */
export const MATURE_DAYS = 7;
const GROWTH = 2.5;
const STORAGE_KEY = 'hsk-invaders/progress/v1';

export interface WordRecord {
  level: number;
  /** Days until the next review; 0 means relearning (due now). */
  interval: number;
  due: number;
  reps: number;
  lapses: number;
}

export interface Review {
  correct: boolean;
  /** True when the answer was recalled (typed), not picked from the ships. */
  recall: boolean;
}

/** Next state of a word after one answer. Pure, so it can be unit-tested. */
export function schedule(record: WordRecord | undefined, level: number, review: Review, now: number): WordRecord {
  const prev = record ?? { level, interval: 0, due: now, reps: 0, lapses: 0 };
  if (!review.correct) return { ...prev, level, interval: 0, due: now, reps: prev.reps + 1, lapses: prev.lapses + 1 };
  // Answering early (the word turned up in a run before it was due) keeps the interval, so
  // playing several runs in a day can't inflate it.
  if (prev.reps > 0 && prev.interval > 0 && now < prev.due) return { ...prev, level, reps: prev.reps + 1 };
  let interval = prev.interval === 0 ? 1 : prev.interval * GROWTH;
  // Recognition alone (shooting the right ship) can't take a word past mature; only recall can.
  if (!review.recall) interval = Math.min(interval, MATURE_DAYS);
  return { ...prev, level, interval, due: now + interval * DAY, reps: prev.reps + 1 };
}

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function browserStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export class Progress {
  private readonly records: Map<string, WordRecord>;

  constructor(private readonly storage: Storage | undefined = browserStorage()) {
    let saved: Record<string, WordRecord> = {};
    try {
      saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      // Unreadable or blocked storage: start fresh and keep progress in memory for this session.
    }
    this.records = new Map(Object.entries(saved));
  }

  get(hanzi: string): WordRecord | undefined {
    return this.records.get(hanzi);
  }

  isNew(hanzi: string): boolean {
    return !this.records.has(hanzi);
  }

  isMature(hanzi: string): boolean {
    return (this.records.get(hanzi)?.interval ?? 0) >= MATURE_DAYS;
  }

  review(hanzi: string, level: number, review: Review, now = Date.now()) {
    this.records.set(hanzi, schedule(this.records.get(hanzi), level, review, now));
    this.save();
  }

  /** Every word seen so far, for the stats screen. */
  entries(): [string, WordRecord][] {
    return [...this.records];
  }

  /** Words due for review, most overdue first. */
  due(now = Date.now()): { hanzi: string; level: number }[] {
    return [...this.records]
      .filter(([, r]) => r.due <= now)
      .sort(([, a], [, b]) => a.due - b.due)
      .map(([hanzi, r]) => ({ hanzi, level: r.level }));
  }

  /** Words seen before that are not due: filler for a patrol with only a few due words. */
  notDue(now = Date.now()): { hanzi: string; level: number }[] {
    return [...this.records].filter(([, r]) => r.due > now).map(([hanzi, r]) => ({ hanzi, level: r.level }));
  }

  private save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.records)));
    } catch {
      // Storage full or blocked: progress still lasts for this session.
    }
  }
}

/** Shared instance for the scenes. */
export const progress = new Progress();
