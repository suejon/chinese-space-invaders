import { describe, expect, it } from 'vitest';
import type { Word } from '../data';
import { seededRng } from './random';
import { pickToneWave, sandhiNote, toneLabel, toneless, tonePair, tonesOf, withTone } from './tones';

const word = (hanzi: string, pinyin: string): Word => ({ hanzi, trad: hanzi, pinyin, gloss: hanzi, meanings: [], pos: [], freq: 0 });

describe('tones', () => {
  it('reads tone numbers from tone marks', () => {
    expect(tonesOf('xǐ huan')).toEqual([3, 5]);
    expect(tonesOf('nǚ ér')).toEqual([3, 2]);
    expect(tonesOf('péng you')).toEqual([2, 5]);
  });

  it('gives two-character words a tone pattern', () => {
    expect(tonePair(word('你好', 'nǐ hǎo'))).toBe('3-3');
    expect(tonePair(word('好', 'hǎo'))).toBeNull();
    expect(tonePair(word('一点儿', 'yī diǎn r'))).toBeNull();
  });

  it('puts tones on the right vowel', () => {
    expect(withTone('huān', 3)).toBe('huǎn');
    expect(withTone('xǐ', 1)).toBe('xī');
    expect(withTone('gou', 3)).toBe('gǒu');
    expect(withTone('duì', 2)).toBe('duí');
    expect(withTone('liú', 4)).toBe('liù');
    expect(withTone('nǚ', 2)).toBe('nǘ');
    expect(withTone('xué', 5)).toBe('xue');
  });

  it("labels patterns on the tested word's syllables and notes 3-3 sandhi", () => {
    expect(toneLabel('1-5', 'xǐ huan')).toBe('xī huan\n1 · 0');
    expect(toneLabel('3-5', 'xǐ huan')).toBe('xǐ huan\n3 · 0');
    expect(toneLabel('4-2', 'lǎo shī')).toBe('lào shí\n4 · 2');
    expect(sandhiNote('3-3')).not.toBeNull();
    expect(sandhiNote('3-4')).toBeNull();
  });

  it('picks words with distinct patterns', () => {
    const pool = [word('你好', 'nǐ hǎo'), word('很好', 'hěn hǎo'), word('老师', 'lǎo shī'), word('学生', 'xué sheng'), word('好', 'hǎo')];
    for (let seed = 0; seed < 20; seed++) {
      const wave = pickToneWave(pool, 8, seededRng(seed));
      expect(wave).toHaveLength(3);
      expect(new Set(wave.map(tonePair)).size).toBe(3);
    }
  });

  it('reduces pinyin to typeable letters', () => {
    expect(toneless('nǚ ér')).toBe('nuer');
    expect(toneless('Xī ān')).toBe('xian');
    expect(toneless('nv3')).toBe('nu');
  });
});
