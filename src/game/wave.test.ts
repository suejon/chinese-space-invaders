import { describe, expect, it } from 'vitest';
import type { Word } from '../data';
import { seededRng } from './random';
import { conflicts, pickWave } from './wave';

const word = (hanzi: string, gloss: string, meanings: string[] = [gloss]): Word => ({
  hanzi,
  trad: hanzi,
  pinyin: '',
  gloss,
  meanings,
  pos: [],
  freq: 0,
});

describe('conflicts', () => {
  it('flags words that share a sense', () => {
    expect(conflicts(word('能', 'can'), word('会', 'can; to have the skill', ['can', 'to have the skill']))).toBe(true);
  });
  it('ignores "to" and parentheticals when comparing', () => {
    expect(conflicts(word('看', 'to see'), word('见', 'see (sth)'))).toBe(true);
  });
  it('allows unrelated words', () => {
    expect(conflicts(word('他', 'he'), word('她', 'she'))).toBe(false);
  });
});

describe('pickWave', () => {
  const pool = [
    word('能', 'can'),
    word('会', 'can; to know how', ['can', 'to know how']),
    word('可以', 'can; may', ['can', 'may']),
    word('他', 'he'),
    word('她', 'she'),
    word('猫', 'cat'),
    word('狗', 'dog'),
  ];

  it('never puts two valid answers in one wave', () => {
    for (let seed = 0; seed < 50; seed++) {
      const wave = pickWave(pool, 5, seededRng(seed));
      expect(wave).toHaveLength(5);
      const cans = wave.filter((w) => w.meanings.includes('can'));
      expect(cans.length).toBe(1);
    }
  });

  it('returns fewer words when the pool cannot fill the wave', () => {
    expect(pickWave(pool, 10, seededRng(1))).toHaveLength(5);
  });

  it('tries preferred words first', () => {
    const wave = pickWave(pool, 2, seededRng(3), [pool[5], pool[6]]);
    expect(wave.map((w) => w.hanzi).sort()).toEqual(['猫', '狗'].sort());
  });
});
