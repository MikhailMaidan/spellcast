import { describe, expect, it } from 'vitest';
import { PRESETS } from '@/types';
import { mulberry32 } from '../rng';
import {
  capitaliseSurname,
  generateSurname,
  hasFourIdenticalLetters,
  hasUnpronounceableRun,
  isAcceptableSurname,
  letterCount,
  SURNAME_RULES,
} from './surname';

describe('generateSurname', () => {
  for (const preset of PRESETS) {
    it(`produces acceptable ${preset} surnames for 300 seeds`, () => {
      const rule = SURNAME_RULES[preset];
      for (let seed = 1; seed <= 300; seed++) {
        const name = generateSurname(mulberry32(seed), preset);
        expect(name, `seed ${seed}`).toMatch(/^[A-Z]/);
        expect(isAcceptableSurname(name, preset), `seed ${seed}: ${name}`).toBe(true);
        const n = letterCount(name);
        expect(n).toBeGreaterThanOrEqual(rule.minLetters);
        expect(n).toBeLessThanOrEqual(rule.maxLetters);
        expect(name).toMatch(/^[A-Za-z'-]+$/);
      }
    });
  }

  it('is deterministic for a seed', () => {
    expect(generateSurname(mulberry32(99), 'hard')).toBe(generateSurname(mulberry32(99), 'hard'));
    expect(generateSurname(mulberry32(99), 'easy')).toBe(generateSurname(mulberry32(99), 'easy'));
  });

  it('varies across seeds', () => {
    const names = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) names.add(generateSurname(mulberry32(seed), 'medium'));
    expect(names.size).toBeGreaterThan(80);
  });

  it('never uses punctuation below the hard preset', () => {
    for (let seed = 1; seed <= 300; seed++) {
      expect(generateSurname(mulberry32(seed), 'easy')).not.toMatch(/['-]/);
      expect(generateSurname(mulberry32(seed), 'medium')).not.toMatch(/['-]/);
    }
  });

  it('sometimes hyphenates or apostrophises on hard', () => {
    let punctuated = 0;
    for (let seed = 1; seed <= 300; seed++) {
      if (/['-]/.test(generateSurname(mulberry32(seed), 'hard'))) punctuated++;
    }
    expect(punctuated).toBeGreaterThan(10);
  });

  it('honours the british flavour setting (no immigrant prefixes)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const name = generateSurname(mulberry32(seed), 'hard', 'british');
      expect(name).not.toMatch(/'/);
      expect(name).not.toMatch(/^Mc/);
    }
  });
});

describe('surname helpers', () => {
  it('capitalises after apostrophes, hyphens and Mc', () => {
    expect(capitaliseSurname("o'kearney-szewicz")).toBe("O'Kearney-Szewicz");
    expect(capitaliseSurname('mcgreeson')).toBe('McGreeson');
    expect(capitaliseSurname('BRACK')).toBe('Brack');
  });

  it('detects unpronounceable consonant runs but allows table fragments', () => {
    expect(hasUnpronounceableRun('Brandstree')).toBe(true);
    expect(hasUnpronounceableRun('Schwartz')).toBe(false);
    expect(hasUnpronounceableRun('Ashworth')).toBe(false);
  });

  it('detects four identical letters', () => {
    expect(hasFourIdenticalLetters('Bellll')).toBe(true);
    expect(hasFourIdenticalLetters('Belll')).toBe(false);
  });
});
