/**
 * UK postcode generator from the six official format patterns (§5.2).
 * Letters exclude those never used in the corresponding position.
 */
import type { Preset } from '@/types';
import { pick, randInt, type Rng } from '../rng';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const without = (excluded: string) => ALPHABET.filter((c) => !excluded.includes(c));

/** Outward first letter: never Q, V, X. */
export const OUTWARD_FIRST = without('QVX');
/** Outward second letter: never I, J, Z. */
export const OUTWARD_SECOND = without('IJZ');
/** Third character of an A9A outward code. */
export const OUTWARD_THIRD_A9A = 'ABCDEFGHJKPSTUW'.split('');
/** Fourth character of an AA9A outward code. */
export const OUTWARD_FOURTH_AA9A = 'ABEHMNPRVWXY'.split('');
/** Inward letters: never C, I, K, M, O, V. */
export const INWARD_LETTERS = without('CIKMOV');

export type UkPostcodePattern = 'A9 9AA' | 'A99 9AA' | 'AA9 9AA' | 'AA99 9AA' | 'A9A 9AA' | 'AA9A 9AA';

export const UK_POSTCODE_PATTERNS: Record<Preset, UkPostcodePattern[]> = {
  easy: ['A9 9AA', 'A99 9AA'],
  medium: ['AA9 9AA', 'AA99 9AA'],
  hard: ['A9A 9AA', 'AA9A 9AA'],
};

export function generateFromPattern(rng: Rng, pattern: UkPostcodePattern): string {
  const outwardPattern = pattern.split(' ')[0];
  let outward = '';
  for (let i = 0; i < outwardPattern.length; i++) {
    const p = outwardPattern[i];
    if (p === 'A') {
      if (i === 0) outward += pick(rng, OUTWARD_FIRST);
      else if (i === 1) outward += pick(rng, OUTWARD_SECOND);
      else if (pattern === 'A9A 9AA') outward += pick(rng, OUTWARD_THIRD_A9A);
      else outward += pick(rng, OUTWARD_FOURTH_AA9A);
    } else {
      // The district's first digit is 1-9; a second digit may be 0-9.
      const afterDigit = i > 0 && outwardPattern[i - 1] === '9';
      outward += String(afterDigit ? randInt(rng, 0, 9) : randInt(rng, 1, 9));
    }
  }
  const inward = `${randInt(rng, 0, 9)}${pick(rng, INWARD_LETTERS)}${pick(rng, INWARD_LETTERS)}`;
  return `${outward} ${inward}`;
}

export function generateUkPostcode(rng: Rng, preset: Preset): string {
  return generateFromPattern(rng, pick(rng, UK_POSTCODE_PATTERNS[preset]));
}

/** Regex that a postcode of the given pattern must match (for tests and debugging). */
export function ukPostcodeRegex(pattern: UkPostcodePattern): RegExp {
  const body = pattern
    .split('')
    .map((p) => (p === 'A' ? '[A-Z]' : p === '9' ? '[0-9]' : ' '))
    .join('');
  return new RegExp(`^${body}$`);
}
