import { describe, expect, it } from 'vitest';
import { PRESETS } from '@/types';
import { mulberry32 } from '../rng';
import { ALNUM_TEMPLATES, alnumTemplateRegex, CONFUSABLE_LETTERS, generateAlnum } from './alnum';

describe('generateAlnum', () => {
  for (const preset of PRESETS) {
    it(`matches one of the ${preset} templates`, () => {
      const regexes = ALNUM_TEMPLATES[preset].map(alnumTemplateRegex);
      for (let seed = 1; seed <= 300; seed++) {
        const code = generateAlnum(mulberry32(seed), preset);
        expect(regexes.some((r) => r.test(code)), `${preset} seed ${seed}: ${code}`).toBe(true);
        expect(code).not.toMatch(/(.)\1\1\1/);
      }
    });
  }

  it('easy codes avoid confusable letters', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const code = generateAlnum(mulberry32(seed), 'easy');
      for (const ch of code) expect(CONFUSABLE_LETTERS, code).not.toContain(ch);
    }
  });

  it('hard codes often contain repeated runs', () => {
    let runs = 0;
    for (let seed = 1; seed <= 300; seed++) if (/(.)\1/.test(generateAlnum(mulberry32(seed), 'hard'))) runs++;
    expect(runs).toBeGreaterThan(120);
  });

  it('is deterministic for a seed', () => {
    expect(generateAlnum(mulberry32(11), 'medium')).toBe(generateAlnum(mulberry32(11), 'medium'));
  });
});
