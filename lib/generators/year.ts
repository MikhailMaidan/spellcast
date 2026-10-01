/**
 * Year and year-range generator. Targets are digits ("1848", "678", "1941-1945"); the
 * spoken form comes from lib/speech/years.ts, so the listener hears "eighteen forty-eight"
 * and has to write the number.
 */
import type { Preset } from '@/types';
import { chance, pick, randInt, type Rng } from '../rng';

interface YearRule {
  min: number;
  max: number;
  /** Chance of a year with a special reading ("eighteen hundred", "nineteen oh five", "two thousand"). */
  special: number;
  /** Chance of a range such as 1941-1945. */
  range: number;
  /** Longest span of a range in years. */
  maxSpan: number;
}

export const YEAR_RULES: Record<Preset, YearRule> = {
  easy: { min: 1100, max: 2029, special: 0.1, range: 0, maxSpan: 0 },
  medium: { min: 100, max: 9999, special: 0.25, range: 0.25, maxSpan: 30 },
  hard: { min: 100, max: 9999, special: 0.3, range: 0.65, maxSpan: 90 },
};

const SPECIAL_KINDS = ['hundred', 'oh', 'thousand', 'thousand-and'] as const;

/** An ordinary year. Beyond the easy preset, most are historical but any year can come up. */
function plainYear(rng: Rng, rule: YearRule): number {
  if (rule.min >= 1000) return randInt(rng, rule.min, rule.max);
  const band = rng();
  if (band < 0.6) return randInt(rng, 1000, 2100);
  if (band < 0.75) return randInt(rng, rule.min, 999);
  return randInt(rng, 2101, rule.max);
}

/** A year whose reading is not the plain pair-pair form. */
function specialYear(rng: Rng, rule: YearRule): number {
  const kind = pick(rng, SPECIAL_KINDS);
  let year: number;
  if (kind === 'hundred') {
    year = randInt(rng, Math.ceil(rule.min / 100), Math.floor(rule.max / 100)) * 100;
  } else if (kind === 'oh') {
    year = randInt(rng, Math.ceil(rule.min / 100), Math.floor(rule.max / 100)) * 100 + randInt(rng, 1, 9);
  } else if (kind === 'thousand') {
    year = randInt(rng, 1, 9) * 1000;
  } else {
    year = randInt(rng, 1, 9) * 1000 + randInt(rng, 1, 9);
  }
  return year >= rule.min && year <= rule.max ? year : plainYear(rng, rule);
}

export function generateYear(rng: Rng, preset: Preset): string {
  const rule = YEAR_RULES[preset];
  const one = () => (chance(rng, rule.special) ? specialYear(rng, rule) : plainYear(rng, rule));
  if (rule.range > 0 && chance(rng, rule.range)) {
    const start = one();
    const end = Math.min(rule.max, start + randInt(rng, 1, rule.maxSpan));
    if (end > start) return `${start}-${end}`;
  }
  return String(one());
}
