import { describe, expect, it } from 'vitest';
import type { Word } from '../data';
import { describeParts, type HanziData } from './parts';

const data: HanziData = {
  chars: {
    妈: { parts: ['女', '马'], sem: '女', phon: '马' },
    好: { parts: ['女', '子'] },
  },
  defs: { 女: ['woman', 'nǚ'], 马: ['horse', 'mǎ'], 子: ['child', 'zǐ'] },
};
const word = (hanzi: string): Word => ({ hanzi, trad: hanzi, pinyin: '', gloss: '', meanings: [], pos: [], freq: 0 });

describe('describeParts', () => {
  it('shows meaning parts by definition and sound parts by pinyin', () => {
    expect(describeParts(word('妈'), data)).toBe('妈 = 女 woman + 马 sound mǎ');
  });
  it('joins the characters of a word and skips ones without parts', () => {
    expect(describeParts(word('好人'), data)).toBe('好 = 女 woman + 子 child');
    expect(describeParts(word('妈好'), data)).toBe('妈 = 女 woman + 马 sound mǎ   好 = 女 woman + 子 child');
  });
  it('is empty when nothing breaks down', () => {
    expect(describeParts(word('人'), data)).toBe('');
  });
});
