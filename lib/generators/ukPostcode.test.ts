import { describe, expect, it } from 'vitest';
import { PRESETS } from '@/types';
import { mulberry32 } from '../rng';
import { generateUkPostcode, UK_POSTCODE_PATTERNS, ukPostcodeRegex } from './ukPostcode';

describe('generateUkPostcode', () => {
  for (const preset of PRESETS) {
    it(`matches one of the ${preset} patterns and respects letter exclusions`, () => {
      const regexes = UK_POSTCODE_PATTERNS[preset].map(ukPostcodeRegex);
      for (let seed = 1; seed <= 300; seed++) {
        const pc = generateUkPostcode(mulberry32(seed), preset);
        expect(regexes.some((r) => r.test(pc)), `${preset} seed ${seed}: ${pc}`).toBe(true);

        const [outward, inward] = pc.split(' ');
        expect('QVX').not.toContain(outward[0]);
        if (/^[A-Z]{2}/.test(outward)) expect('IJZ').not.toContain(outward[1]);
        expect(inward[0]).toMatch(/[0-9]/);
        for (const ch of inward.slice(1)) expect('CIKMOV').not.toContain(ch);
        // District never starts with 0
        expect(outward[/^[A-Z]{2}/.test(outward) ? 2 : 1]).not.toBe('0');
      }
    });
  }

  it('is deterministic for a seed', () => {
    expect(generateUkPostcode(mulberry32(5), 'medium')).toBe(generateUkPostcode(mulberry32(5), 'medium'));
  });

  it('uses both patterns of a preset over many seeds', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const pc = generateUkPostcode(mulberry32(seed), 'hard');
      seen.add(pc.split(' ')[0].length === 3 ? 'A9A' : 'AA9A');
    }
    expect(seen.size).toBe(2);
  });
});
