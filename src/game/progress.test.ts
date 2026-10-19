import { describe, expect, it } from 'vitest';
import { DAY, MATURE_DAYS, Progress, schedule } from './progress';

const recognize = { correct: true, recall: false };
const recall = { correct: true, recall: true };
const wrong = { correct: false, recall: false };

describe('schedule', () => {
  it('starts a new word at one day and grows the interval when reviewed on time', () => {
    const first = schedule(undefined, 1, recognize, 0);
    expect(first.interval).toBe(1);
    expect(first.due).toBe(DAY);
    expect(schedule(first, 1, recognize, first.due).interval).toBe(2.5);
  });

  it('does not grow the interval when answered before it is due', () => {
    const first = schedule(undefined, 1, recognize, 0);
    const early = schedule(first, 1, recognize, DAY / 2);
    expect(early.interval).toBe(1);
    expect(early.due).toBe(DAY);
  });

  it('caps recognition at mature; only recall goes past it', () => {
    const mature = { level: 1, interval: 6.25, due: 0, reps: 4, lapses: 0 };
    expect(schedule(mature, 1, recognize, 0).interval).toBe(MATURE_DAYS);
    const atCap = { ...mature, interval: MATURE_DAYS };
    expect(schedule(atCap, 1, recognize, 0).interval).toBe(MATURE_DAYS);
    expect(schedule(atCap, 1, recall, 0).interval).toBe(MATURE_DAYS * 2.5);
  });

  it('sends a wrong answer back to relearning, due now', () => {
    const mature = { level: 2, interval: 20, due: 5, reps: 6, lapses: 0 };
    const lapsed = schedule(mature, 2, wrong, 100);
    expect(lapsed).toMatchObject({ interval: 0, due: 100, lapses: 1 });
  });
});

describe('Progress', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };

  it('lists due words, most overdue first, and persists between instances', () => {
    const storage = memory();
    const p = new Progress(storage);
    p.review('好', 1, recognize, 0);
    p.review('猫', 2, wrong, 10);
    p.review('狗', 2, recognize, 10 * DAY);
    const reloaded = new Progress(storage);
    expect(reloaded.due(3 * DAY)).toEqual([
      { hanzi: '猫', level: 2 },
      { hanzi: '好', level: 1 },
    ]);
    expect(reloaded.notDue(3 * DAY)).toEqual([{ hanzi: '狗', level: 2 }]);
    expect(reloaded.isNew('人')).toBe(true);
  });

  it('works without storage', () => {
    const p = new Progress(undefined);
    p.review('好', 1, recognize, 0);
    expect(p.isMature('好')).toBe(false);
  });
});
