import { describe, expect, it } from 'vitest';
import type { Word } from '../data';
import { patrolWaves, RunState, STARTING_SHIELDS, TONE_WAVE } from './run';

const word = (hanzi: string): Word => ({ hanzi, trad: hanzi, pinyin: '', gloss: hanzi, meanings: [], pos: [], freq: 0 });

describe('RunState', () => {
  it('scores hits with a capped combo', () => {
    const run = new RunState(1);
    const points = Array.from({ length: 7 }, () => run.hit(word('一')));
    expect(points).toEqual([100, 200, 300, 400, 500, 500, 500]);
  });

  it('loses a shield and resets combo on a miss', () => {
    const run = new RunState(1);
    run.hit(word('一'));
    run.miss(word('二'), word('三'));
    expect(run.shields).toBe(STARTING_SHIELDS - 1);
    expect(run.combo).toBe(0);
    expect(run.missedWords.map((r) => r.word.hanzi)).toEqual(['二']);
    expect(run.accuracy).toBe(0.5);
  });

  it('ends when shields run out or the formation lands', () => {
    const run = new RunState(1);
    for (let i = 0; i < STARTING_SHIELDS; i++) run.miss(word('二'), word('三'));
    expect(run.isOver).toBe(true);
    const landed = new RunState(1);
    landed.invaded = true;
    expect(landed.isOver).toBe(true);
  });

  it('is won after the last wave', () => {
    const run = new RunState(1);
    run.wave = run.waveCount;
    expect(run.isWon).toBe(true);
  });
});

describe('patrolWaves', () => {
  it('splits due words into waves of 4 to 12', () => {
    expect(patrolWaves(0)).toEqual([]);
    expect(patrolWaves(4)).toEqual([4]);
    expect(patrolWaves(13)).toEqual([7, 6]);
    expect(patrolWaves(100)).toEqual([12, 12, 12]);
  });
});

describe('tone waves', () => {
  it('only appear in level runs', () => {
    const run = new RunState(1);
    run.wave = TONE_WAVE;
    expect(run.isToneWave).toBe(true);
    const patrol = new RunState(0, 'patrol', [8, 8, 8]);
    patrol.wave = TONE_WAVE;
    expect(patrol.isToneWave).toBe(false);
  });
});
