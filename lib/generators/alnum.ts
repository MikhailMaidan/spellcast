/**
 * Free-form alphanumeric / reference-code generator (§5.4).
 * Templates: L = letter, D = digit, "-" and "/" are literal separators.
 */
import type { Preset } from '@/types';
import { chance, pick, randInt, type Rng } from '../rng';

export const ALNUM_TEMPLATES: Record<Preset, string[]> = {
  easy: ['LLDD', 'DDDL', 'LLL-DD'],
  medium: ['LLDDDL', 'DLLDDD', 'LL-DDDD', 'DDLLDD'],
  hard: ['LLDDLLDD', 'DDD/LLL-DD', 'LLLDDDDL', 'LDLDLDLD'],
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
/** Letters that are easily confused by ear: B/P, M/N, S/F, I/E. */
export const CONFUSABLE_LETTERS = 'BPMNSFIE'.split('');
export const SAFE_LETTERS = ALPHABET.filter((c) => !CONFUSABLE_LETTERS.includes(c));
/** Confusables listed three times so they come up often. */
const HARD_LETTER_POOL = [...ALPHABET, ...CONFUSABLE_LETTERS, ...CONFUSABLE_LETTERS];

const FOUR_IDENTICAL = /(.)\1\1\1/;

function fill(rng: Rng, template: string, preset: Preset): string[] {
  const letters = preset === 'easy' ? SAFE_LETTERS : preset === 'medium' ? ALPHABET : HARD_LETTER_POOL;
  return template.split('').map((p) => {
    if (p === 'L') return pick(rng, letters);
    if (p === 'D') return String(randInt(rng, 0, 9));
    return p;
  });
}

/** Copy a character onto its neighbour of the same class so a "double"/"triple" appears. */
function forceRun(rng: Rng, template: string, chars: string[]): void {
  const candidates: number[] = [];
  for (let i = 0; i < template.length - 1; i++) {
    if ((template[i] === 'L' || template[i] === 'D') && template[i] === template[i + 1]) candidates.push(i);
  }
  if (!candidates.length) return;
  const i = pick(rng, candidates);
  chars[i + 1] = chars[i];
  if (chance(rng, 0.3) && template[i + 2] === template[i]) chars[i + 2] = chars[i];
}

export function generateAlnum(rng: Rng, preset: Preset): string {
  const template = pick(rng, ALNUM_TEMPLATES[preset]);
  for (let attempt = 0; attempt < 100; attempt++) {
    const chars = fill(rng, template, preset);
    if (preset === 'hard' && chance(rng, 0.6)) forceRun(rng, template, chars);
    const code = chars.join('');
    if (!FOUR_IDENTICAL.test(code)) return code;
  }
  return template.replace(/L/g, 'A').replace(/D/g, '1');
}

/** Regex that a code of the given template must match (for tests and debugging). */
export function alnumTemplateRegex(template: string): RegExp {
  const body = template
    .split('')
    .map((p) => (p === 'L' ? '[A-Z]' : p === 'D' ? '[0-9]' : `\\${p}`))
    .join('');
  return new RegExp(`^${body}$`);
}
