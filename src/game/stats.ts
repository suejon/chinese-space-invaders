/**
 * Learning statistics: a per-day answer log kept in localStorage, plus pure summaries of it and
 * of the per-word records in progress.ts, for the stats screen. Kept free of Phaser so it can be unit-tested.
 */
import { browserStorage, MATURE_DAYS, type Storage, type WordRecord } from './progress';

const STORAGE_KEY = 'hsk-invaders/history/v1';
/** Days of history kept; older days are dropped on save so storage can't grow without bound. */
const KEEP_DAYS = 400;

export interface DayLog {
  correct: number;
  wrong: number;
  /** Words answered for the first time that day. */
  newWords: number;
}

/** Local calendar day as YYYY-MM-DD, so a day ends at the player's midnight, not UTC's. */
export function dayKey(time: number): string {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Key of the day `offset` days before the day of `now` (DST-safe: steps by calendar date). */
function dayBefore(now: number, offset: number): string {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return dayKey(d.getTime());
}

export class History {
  private readonly days: Map<string, DayLog>;

  constructor(private readonly storage: Storage | undefined = browserStorage()) {
    let saved: Record<string, DayLog> = {};
    try {
      saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      // Unreadable or blocked storage: start fresh and keep history in memory for this session.
    }
    this.days = new Map(Object.entries(saved));
  }

  /** Log one counted answer (the same answers that update a word's schedule). */
  answer(correct: boolean, isNew: boolean, now = Date.now()) {
    const key = dayKey(now);
    const day = this.days.get(key) ?? { correct: 0, wrong: 0, newWords: 0 };
    if (correct) day.correct++;
    else day.wrong++;
    if (isNew) day.newWords++;
    this.days.set(key, day);
    this.save(now);
  }

  get(key: string): DayLog | undefined {
    return this.days.get(key);
  }

  entries(): [string, DayLog][] {
    return [...this.days];
  }

  private save(now: number) {
    const oldest = dayBefore(now, KEEP_DAYS);
    for (const key of this.days.keys()) if (key < oldest) this.days.delete(key);
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.days)));
    } catch {
      // Storage full or blocked: history still lasts for this session.
    }
  }
}

/** Shared instance for the scenes. */
export const history = new History();

export interface LevelStats {
  level: number;
  total: number;
  /** Seen at least once, not yet mature. */
  learning: number;
  /** Interval has reached MATURE_DAYS: answered by recall. */
  mature: number;
}

/** Words seen and mastered in each level, in the order of `levels`. */
export function levelBreakdown(records: [string, WordRecord][], levels: { level: number; count: number }[]): LevelStats[] {
  const stats = new Map(levels.map((l) => [l.level, { level: l.level, total: l.count, learning: 0, mature: 0 }]));
  for (const [, r] of records) {
    const s = stats.get(r.level);
    if (!s) continue;
    if (r.interval >= MATURE_DAYS) s.mature++;
    else s.learning++;
  }
  return [...stats.values()];
}

export interface Totals {
  seen: number;
  mature: number;
  due: number;
}

export function totals(records: [string, WordRecord][], now = Date.now()): Totals {
  let mature = 0;
  let due = 0;
  for (const [, r] of records) {
    if (r.interval >= MATURE_DAYS) mature++;
    if (r.due <= now) due++;
  }
  return { seen: records.length, mature, due };
}

export interface WeakWord {
  hanzi: string;
  level: number;
  lapses: number;
  reps: number;
}

/**
 * Words most often missed: ranked by misses, then by share of answers missed. Words never missed,
 * or already mature again, are left out, so the list is what still needs work.
 */
export function weakestWords(records: [string, WordRecord][], count: number): WeakWord[] {
  return records
    .filter(([, r]) => r.lapses > 0 && r.interval < MATURE_DAYS)
    .map(([hanzi, r]) => ({ hanzi, level: r.level, lapses: r.lapses, reps: r.reps }))
    .sort((a, b) => b.lapses - a.lapses || b.lapses / b.reps - a.lapses / a.reps)
    .slice(0, count);
}

export interface DayPoint extends DayLog {
  key: string;
}

/** The last `days` days, oldest first, ending today; days without play have zero answers. */
export function recentDays(history: History, days: number, now = Date.now()): DayPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const key = dayBefore(now, days - 1 - i);
    return { key, ...(history.get(key) ?? { correct: 0, wrong: 0, newWords: 0 }) };
  });
}

/** Share of answers right over a span of days, or undefined if none were answered. */
export function accuracyOf(days: DayLog[]): number | undefined {
  const correct = days.reduce((n, d) => n + d.correct, 0);
  const total = days.reduce((n, d) => n + d.correct + d.wrong, 0);
  return total === 0 ? undefined : correct / total;
}

/** Days in a row with at least one answer, counting back from today (or yesterday, if not played yet today). */
export function streak(history: History, now = Date.now()): number {
  const played = (offset: number) => {
    const d = history.get(dayBefore(now, offset));
    return !!d && d.correct + d.wrong > 0;
  };
  let offset = played(0) ? 0 : 1;
  let count = 0;
  while (played(offset)) {
    count++;
    offset++;
  }
  return count;
}
