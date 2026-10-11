import { describe, expect, it } from 'vitest';
import { buildLevels, pickForm, shortGloss, syllabusLevel } from './vocab.mjs';

const form = (pinyin, meanings) => ({ traditional: 'x', transcriptions: { pinyin }, meanings });

describe('syllabusLevel', () => {
  it('uses only the HSK 3.0 exam syllabus tags', () => {
    expect(syllabusLevel({ level: ['newest-3', 'new-4', 'old-3'] })).toBe(3);
    expect(syllabusLevel({ level: ['new-1', 'old-1'] })).toBeNull();
  });
});

describe('pickForm', () => {
  it('prefers the reading with the most senses', () => {
    const entry = { forms: [form('shuì', ['to persuade']), form('shuō', ['to speak', 'to say'])] };
    expect(pickForm(entry).transcriptions.pinyin).toBe('shuō');
  });
  it('uses hand-checked reading overrides', () => {
    const entry = { simplified: '吗', forms: [form('má', ['(coll.) what?', 'x']), form('ma', ['(question particle)'])] };
    expect(pickForm(entry).transcriptions.pinyin).toBe('ma');
  });
  it('skips capitalized (proper noun) readings', () => {
    const entry = { forms: [form('Ān', ['surname An', 'peace']), form('ān', ['peaceful'])] };
    expect(pickForm(entry).transcriptions.pinyin).toBe('ān');
  });
});

describe('shortGloss', () => {
  it('keeps short glosses intact', () => {
    expect(shortGloss('to be')).toBe('to be');
  });
  it('keeps as many parts as fit', () => {
    expect(shortGloss('to speak; to talk; to say; to explain; to comment')).toBe('to speak; to talk; to say');
  });
  it('never exceeds 30 characters', () => {
    const g = shortGloss('(classifier used before a noun that has no specific classifier)');
    expect(g.length).toBeLessThanOrEqual(30);
  });
});

describe('buildLevels', () => {
  it('groups by level and sorts by frequency', () => {
    const entry = (s, level, frequency) => ({ simplified: s, level: [level], frequency, pos: [], forms: [form('a', ['x'])] });
    const levels = buildLevels([entry('b', 'newest-1', 9), entry('a', 'newest-1', 1), entry('c', 'old-1', 1)]);
    expect([...levels.keys()]).toEqual([1]);
    expect(levels.get(1).map((w) => w.hanzi)).toEqual(['a', 'b']);
  });
});
