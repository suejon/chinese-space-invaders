import { describe, expect, it } from 'vitest';
import { DAY, MATURE_DAYS, type WordRecord } from './progress';
import { accuracyOf, dayKey, History, levelBreakdown, recentDays, streak, totals, weakestWords } from './stats';

const rec = (level: number, interval: number, reps = 1, lapses = 0, due = 0): WordRecord => ({ level, interval, due, reps, lapses });

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

// Noon local time, so adding whole days never crosses midnight.
const NOON = new Date(2026, 9, 31, 12).getTime();

describe('levelBreakdown', () => {
  it('splits seen words into learning and mature per level', () => {
    const records: [string, WordRecord][] = [
      ['一', rec(1, 1)],
      ['二', rec(1, MATURE_DAYS)],
      ['爱', rec(2, 0)],
      ['?', rec(9, 1)],
    ];
    const levels = levelBreakdown(records, [
      { level: 1, count: 10 },
      { level: 2, count: 5 },
    ]);
    expect(levels).toEqual([
      { level: 1, total: 10, learning: 1, mature: 1 },
      { level: 2, total: 5, learning: 1, mature: 0 },
    ]);
  });
});

describe('totals', () => {
  it('counts seen, mature and due words', () => {
    const records: [string, WordRecord][] = [
      ['一', rec(1, 1, 1, 0, NOON - 1)],
      ['二', rec(1, MATURE_DAYS, 4, 0, NOON + DAY)],
    ];
    expect(totals(records, NOON)).toEqual({ seen: 2, mature: 1, due: 1 });
  });
});

describe('weakestWords', () => {
  it('ranks by misses, then miss rate, and skips words never missed or mature again', () => {
    const records: [string, WordRecord][] = [
      ['a', rec(1, 0, 10, 2)],
      ['b', rec(1, 0, 4, 2)],
      ['c', rec(1, 1, 5, 3)],
      ['d', rec(1, 1, 5, 0)],
      ['e', rec(1, MATURE_DAYS, 9, 4)],
    ];
    expect(weakestWords(records, 5).map((w) => w.hanzi)).toEqual(['c', 'b', 'a']);
    expect(weakestWords(records, 1).map((w) => w.hanzi)).toEqual(['c']);
  });
});

describe('History', () => {
  it('logs answers per local day and persists them', () => {
    const storage = memoryStorage();
    const history = new History(storage);
    history.answer(true, true, NOON);
    history.answer(false, false, NOON);
    history.answer(true, false, NOON + DAY);
    const reloaded = new History(storage);
    expect(reloaded.get(dayKey(NOON))).toEqual({ correct: 1, wrong: 1, newWords: 1 });
    expect(reloaded.get(dayKey(NOON + DAY))).toEqual({ correct: 1, wrong: 0, newWords: 0 });
  });

  it('fills recent days with zeros and computes accuracy', () => {
    const history = new History(memoryStorage());
    history.answer(true, true, NOON - 2 * DAY);
    history.answer(false, true, NOON);
    history.answer(true, true, NOON);
    const days = recentDays(history, 3, NOON);
    expect(days.map((d) => d.correct + d.wrong)).toEqual([1, 0, 2]);
    expect(days[2].key).toBe(dayKey(NOON));
    expect(accuracyOf(days)).toBeCloseTo(2 / 3);
    expect(accuracyOf([])).toBeUndefined();
  });

  it('counts a streak back from today, or from yesterday before today is played', () => {
    const history = new History(memoryStorage());
    expect(streak(history, NOON)).toBe(0);
    history.answer(true, true, NOON - 3 * DAY);
    history.answer(true, true, NOON - 2 * DAY);
    history.answer(true, true, NOON - DAY);
    expect(streak(history, NOON)).toBe(3);
    history.answer(true, true, NOON);
    expect(streak(history, NOON)).toBe(4);
    expect(streak(history, NOON + 2 * DAY)).toBe(0);
  });
});
