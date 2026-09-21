/** US ZIP code generator (§5.3): 5 digits, 5 digits with a repeat, or ZIP+4. */
import type { Preset } from '@/types';
import { randInt, type Rng } from '../rng';

const FOUR_IDENTICAL = /(.)\1\1\1/;

export function hasAdjacentRepeat(s: string): boolean {
  return /(.)\1/.test(s);
}

function digits(rng: Rng, count: number): string {
  let out = '';
  for (let i = 0; i < count; i++) out += String(randInt(rng, 0, 9));
  return out;
}

export function generateUsZip(rng: Rng, preset: Preset): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let zip: string;
    if (preset === 'easy') {
      zip = digits(rng, 5);
    } else if (preset === 'medium') {
      const d = digits(rng, 5).split('');
      if (!hasAdjacentRepeat(d.join(''))) {
        const i = randInt(rng, 0, 3);
        d[i + 1] = d[i];
      }
      zip = d.join('');
    } else {
      zip = `${digits(rng, 5)}-${digits(rng, 4)}`;
    }
    // Runs of four identical digits would defeat the double/triple grouping; try again.
    if (!FOUR_IDENTICAL.test(zip)) return zip;
  }
  return preset === 'hard' ? '12345-6789' : '12345';
}
