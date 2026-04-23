import { describe, it, expect } from 'vitest';
import { lineSimilarity } from '../../src/domain/core/skill-evaluation/lineSimilarity.js';

describe('lineSimilarity', () => {
  it('returns 100 for identical inputs', () => {
    expect(lineSimilarity('a\nb\nc', 'a\nb\nc')).toBe(100);
  });

  it('returns 100 for two empty strings', () => {
    expect(lineSimilarity('', '')).toBe(100);
  });

  it('returns 0 when one side is empty and the other has content', () => {
    expect(lineSimilarity('', 'a\nb')).toBe(0);
    expect(lineSimilarity('a\nb', '')).toBe(0);
  });

  it('treats a single trailing newline as equivalent', () => {
    expect(lineSimilarity('a\nb\n', 'a\nb')).toBe(100);
  });

  it('normalises CRLF to LF', () => {
    expect(lineSimilarity('a\r\nb\r\n', 'a\nb\n')).toBe(100);
  });

  it('scores a one-line change in a three-line file at ~67%', () => {
    // 1 edit over max length 3 → 2/3 = 67
    expect(lineSimilarity('a\nb\nc', 'a\nX\nc')).toBe(67);
  });

  it('penalises completely disjoint files', () => {
    expect(lineSimilarity('a\nb\nc', 'x\ny\nz')).toBe(0);
  });

  it('gives partial credit for a single added line', () => {
    // 1 insertion over max length 4 → 0.75 → 75
    expect(lineSimilarity('a\nb\nc', 'a\nb\nc\nd')).toBe(75);
  });

  it('is symmetric', () => {
    const a = 'one\ntwo\nthree';
    const b = 'one\ntwo\nTHREE\nfour';
    expect(lineSimilarity(a, b)).toBe(lineSimilarity(b, a));
  });
});
