import { describe, expect, it } from 'vitest';
import { diffStrings, normaliseForScoring } from './diff';

const opts = { ignoreSpaces: true };

describe('diffStrings', () => {
  it('marks an exact match as correct', () => {
    const d = diffStrings('ABC', 'abc', opts);
    expect(d.correct).toBe(true);
    expect(d.errors).toBe(0);
    expect(d.charAccuracy).toBe(1);
    expect(d.ops.map((o) => o.type)).toEqual(['correct', 'correct', 'correct']);
  });

  it('classifies wrong, missing and extra characters', () => {
    expect(diffStrings('ABC', 'ABD', opts).ops[2]).toMatchObject({ type: 'wrong', expected: 'C', typed: 'D', targetIndex: 2 });
    expect(diffStrings('ABC', 'AC', opts).ops[1]).toMatchObject({ type: 'missing', expected: 'B', typed: null, targetIndex: 1 });
    expect(diffStrings('ABC', 'ABXC', opts).ops[2]).toMatchObject({ type: 'extra', expected: null, typed: 'X', targetIndex: null });
  });

  it('computes accuracy over the target length', () => {
    const d = diffStrings('ABCD', 'ABXD', opts);
    expect(d.charAccuracy).toBe(0.75);
    expect(d.errors).toBe(1);
    expect(d.correct).toBe(false);
  });

  it('handles spaces according to ignoreSpaces', () => {
    expect(diffStrings('SW1A 0AA', 'sw1a0aa', { ignoreSpaces: true }).correct).toBe(true);
    const strict = diffStrings('SW1A 0AA', 'SW1A0AA', { ignoreSpaces: false });
    expect(strict.correct).toBe(false);
    expect(strict.errors).toBe(1);
    expect(strict.ops.find((o) => o.type === 'missing')?.expected).toBe(' ');
  });

  it('handles empty input', () => {
    const d = diffStrings('ABC', '', opts);
    expect(d.errors).toBe(3);
    expect(d.charAccuracy).toBe(0);
    expect(d.ops.every((o) => o.type === 'missing')).toBe(true);
  });

  it('normalises whitespace', () => {
    expect(normaliseForScoring(' a b  c ', true)).toBe('ABC');
    expect(normaliseForScoring(' a b  c ', false)).toBe('A B C');
  });
});
