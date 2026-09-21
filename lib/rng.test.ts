import { describe, expect, it } from 'vitest';
import { deriveSeed, mulberry32, pick, randInt } from './rng';

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds and stays within [0, 1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
    for (const v of [...seqA, ...seqB]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randInt is inclusive of both bounds', () => {
    const rng = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randInt(rng, 1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('pick returns members of the list', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 50; i++) expect(['a', 'b', 'c']).toContain(pick(rng, ['a', 'b', 'c']));
  });

  it('deriveSeed produces a different, stable seed', () => {
    expect(deriveSeed(123, 0x5bd1e995)).toBe(deriveSeed(123, 0x5bd1e995));
    expect(deriveSeed(123, 0x5bd1e995)).not.toBe(123);
  });
});
