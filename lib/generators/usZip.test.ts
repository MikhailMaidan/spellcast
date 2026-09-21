import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import { generateUsZip, hasAdjacentRepeat } from './usZip';

describe('generateUsZip', () => {
  it('easy: five digits', () => {
    for (let seed = 1; seed <= 200; seed++) expect(generateUsZip(mulberry32(seed), 'easy')).toMatch(/^\d{5}$/);
  });

  it('medium: five digits with at least one adjacent repeat', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const zip = generateUsZip(mulberry32(seed), 'medium');
      expect(zip).toMatch(/^\d{5}$/);
      expect(hasAdjacentRepeat(zip), zip).toBe(true);
    }
  });

  it('hard: ZIP+4', () => {
    for (let seed = 1; seed <= 200; seed++) expect(generateUsZip(mulberry32(seed), 'hard')).toMatch(/^\d{5}-\d{4}$/);
  });

  it('never contains four identical digits in a row', () => {
    for (const preset of ['easy', 'medium', 'hard'] as const) {
      for (let seed = 1; seed <= 300; seed++) expect(generateUsZip(mulberry32(seed), preset)).not.toMatch(/(.)\1\1\1/);
    }
  });

  it('is deterministic for a seed', () => {
    expect(generateUsZip(mulberry32(3), 'hard')).toBe(generateUsZip(mulberry32(3), 'hard'));
  });
});
