import { describe, expect, it } from 'vitest';
import { PRESETS } from '@/types';
import { mulberry32 } from '../rng';
import { parseYears, spokenYears } from '../speech/years';
import { generateYear, YEAR_RULES } from './year';

describe('generateYear', () => {
  for (const preset of PRESETS) {
    it(`produces valid ${preset} years and ranges for 400 seeds`, () => {
      const rule = YEAR_RULES[preset];
      for (let seed = 1; seed <= 400; seed++) {
        const target = generateYear(mulberry32(seed), preset);
        const years = parseYears(target);
        expect(years, `${preset} seed ${seed}: ${target}`).not.toBeNull();
        for (const y of years!) {
          expect(y).toBeGreaterThanOrEqual(rule.min);
          expect(y).toBeLessThanOrEqual(rule.max);
        }
        if (years!.length === 2) {
          expect(years![1]).toBeGreaterThan(years![0]);
          expect(years![1] - years![0]).toBeLessThanOrEqual(rule.maxSpan);
        }
        // Every generated target has a spoken form.
        expect(spokenYears(target).length).toBeGreaterThan(0);
      }
    });
  }

  it('easy is always a single four-digit year', () => {
    for (let seed = 1; seed <= 300; seed++) expect(generateYear(mulberry32(seed), 'easy')).toMatch(/^\d{4}$/);
  });

  it('medium and hard include ranges, hard mostly', () => {
    const ranges = (preset: 'medium' | 'hard') => {
      let n = 0;
      for (let seed = 1; seed <= 400; seed++) if (generateYear(mulberry32(seed), preset).includes('-')) n++;
      return n;
    };
    expect(ranges('medium')).toBeGreaterThan(50);
    expect(ranges('hard')).toBeGreaterThan(200);
  });

  it('covers three-digit, far-future and special-reading years', () => {
    const targets: string[] = [];
    for (let seed = 1; seed <= 600; seed++) targets.push(generateYear(mulberry32(seed), 'medium'));
    const singles = targets.filter((t) => !t.includes('-')).map(Number);
    expect(singles.some((y) => y < 1000)).toBe(true);
    expect(singles.some((y) => y > 2100)).toBe(true);
    expect(singles.some((y) => y % 100 === 0)).toBe(true);
    expect(singles.some((y) => y % 100 > 0 && y % 100 < 10)).toBe(true);
  });

  it('is deterministic for a seed', () => {
    expect(generateYear(mulberry32(42), 'hard')).toBe(generateYear(mulberry32(42), 'hard'));
  });
});
