import { describe, expect, it } from 'vitest';
import { buildHanzi, shortDef, topLevelParts } from './hanzi.mjs';

describe('topLevelParts', () => {
  it('splits a two-part character', () => {
    expect(topLevelParts('⿰女子')).toEqual(['女', '子']);
    expect(topLevelParts('⿱相心')).toEqual(['相', '心']);
  });
  it('flattens nested shapes and drops unknown parts', () => {
    expect(topLevelParts('⿰氵⿱？口')).toEqual(['氵', '口']);
    expect(topLevelParts('⿲彳⿱山王攵')).toEqual(['彳', '山', '王', '攵']);
  });
  it('returns nothing for atomic characters', () => {
    expect(topLevelParts('？')).toEqual([]);
    expect(topLevelParts('')).toEqual([]);
  });
});

describe('shortDef', () => {
  it('keeps the first sense without parentheticals', () => {
    expect(shortDef('woman, girl; female')).toBe('woman');
    expect(shortDef('heart (radical); mind')).toBe('heart');
    expect(shortDef(undefined)).toBe('');
  });
});

describe('buildHanzi', () => {
  const entries = [
    { character: '妈', definition: 'mother, mom', pinyin: ['mā'], decomposition: '⿰女马', etymology: { type: 'pictophonetic', semantic: '女', phonetic: '马' } },
    { character: '女', definition: 'woman, girl', pinyin: ['nǚ'], decomposition: '？' },
    { character: '马', definition: 'horse', pinyin: ['mǎ'], decomposition: '？' },
  ];
  it('records parts, meaning and sound components, and their definitions', () => {
    const { chars, defs } = buildHanzi(entries, ['妈', '女']);
    expect(chars).toEqual({ 妈: { parts: ['女', '马'], sem: '女', phon: '马' } });
    expect(defs).toEqual({ 妈: ['mother', 'mā'], 女: ['woman', 'nǚ'], 马: ['horse', 'mǎ'] });
  });
});
