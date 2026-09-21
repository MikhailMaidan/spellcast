/**
 * Syllable-pattern surname generator (§5.1).
 * Names are assembled from onset / nucleus / coda fragments so they look and sound
 * like plausible British or American surnames without being drawn from any list.
 */
import type { Preset, SurnameFlavour } from '@/types';
import { chance, pick, randInt, type Rng } from '../rng';

export type Flavour = 'anglo' | 'immigrant';

export const ANGLO_ONSETS = [
  'B', 'Br', 'Ch', 'Cl', 'D', 'F', 'Fl', 'G', 'Gr', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Pr', 'R', 'S', 'Sh',
  'St', 'Str', 'T', 'Th', 'Tr', 'W', 'Wh', 'Wr',
] as const;
export const NUCLEI = ['a', 'e', 'i', 'o', 'u', 'ea', 'ee', 'ai', 'oo', 'ou', 'ei', 'au'] as const;
/** Consonant-only codas: attach straight after a vowel. */
export const ANGLO_CODAS = ['ck', 'll', 'tt', 'rd', 'rn', 'nd', 'ng', 'th', 'gh', 'ght', 'ss', 'mp', 'ft', 'ld', 'rk'] as const;
/** Syllabic suffixes: attach after a consonant. */
export const ANGLO_SUFFIXES = ['ly', 'ey', 'ton', 'son', 'ley', 'worth', 'bury', 'field', 'ford', 'wood', 'well', 'ham', 'shaw'] as const;

export const IMMIGRANT_ONSETS = ['Sz', 'Cz', 'Wo', 'Kr', 'Schw', 'Zh', 'Dz', 'Prz', 'Ng', 'Vl'] as const;
export const IMMIGRANT_PREFIXES = ['Mc', "O'"] as const;
export const IMMIGRANT_CODAS = ['dt'] as const;
export const IMMIGRANT_SUFFIXES = ['ski', 'cki', 'wicz', 'czyk', 'mann', 'berg', 'stein', 'witz', 'elli', 'ucci', 'ini', 'ough', 'aux'] as const;

/** Single consonants (or doubles) that link a vowel-final stem to a suffix. */
const LINKS = ['b', 'd', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z', 'll', 'tt', 'nn', 'ss', 'rr', 'dd'] as const;
/** Light codas inside a word, between syllables. */
const MID_CODAS = ['n', 'r', 'l', 's', 't', 'm', 'ck', 'll', 'tt', 'nd', 'ng', 'rd', 'st'] as const;

const VOWEL_END = /[aeiou]$/i;
const CONSONANT_RUN = /[b-df-hj-np-tv-xz]+/g;

interface SurnameRule {
  minSyllables: number;
  maxSyllables: number;
  minLetters: number;
  maxLetters: number;
  flavour: Flavour | 'both';
  /** Hyphen / apostrophe allowed. */
  allowPunctuation: boolean;
}

export const SURNAME_RULES: Record<Preset, SurnameRule> = {
  easy: { minSyllables: 1, maxSyllables: 2, minLetters: 4, maxLetters: 6, flavour: 'anglo', allowPunctuation: false },
  medium: { minSyllables: 2, maxSyllables: 3, minLetters: 6, maxLetters: 9, flavour: 'both', allowPunctuation: false },
  hard: { minSyllables: 3, maxSyllables: 4, minLetters: 9, maxLetters: 14, flavour: 'immigrant', allowPunctuation: true },
};

/** Consonant runs of 4+ that are fine because they come straight from a fragment table. */
const ALLOWED_RUNS = new Set(
  [...ANGLO_ONSETS, ...IMMIGRANT_ONSETS, ...ANGLO_CODAS, ...IMMIGRANT_CODAS, ...ANGLO_SUFFIXES, ...IMMIGRANT_SUFFIXES]
    .map((s) => s.toLowerCase())
    .filter((s) => /^[b-df-hj-np-tv-xz]+$/.test(s) && s.length >= 4),
);

export function resolveFlavour(preset: Preset, setting: SurnameFlavour, rng: Rng): Flavour {
  if (setting === 'british') return 'anglo';
  if (setting === 'american') return 'immigrant';
  const f = SURNAME_RULES[preset].flavour;
  return f === 'both' ? (rng() < 0.5 ? 'anglo' : 'immigrant') : f;
}

function onsetsFor(flavour: Flavour): readonly string[] {
  // Immigrant onsets are listed twice so they show up often in that flavour.
  return flavour === 'anglo' ? ANGLO_ONSETS : [...ANGLO_ONSETS, ...IMMIGRANT_ONSETS, ...IMMIGRANT_ONSETS];
}

function buildStem(rng: Rng, flavour: Flavour, syllables: number): string {
  const onsets = onsetsFor(flavour);
  const midOnsets = onsets.filter((o) => o.length <= 2);
  let stem = '';
  for (let i = 0; i < syllables; i++) {
    const onset = i === 0 ? (chance(rng, 0.1) ? '' : pick(rng, onsets)) : pick(rng, midOnsets);
    // "Wo" already carries its vowel.
    const nucleus = VOWEL_END.test(onset) ? '' : pick(rng, NUCLEI);
    stem += onset + nucleus;
    if (i < syllables - 1 && chance(rng, 0.35)) stem += pick(rng, MID_CODAS);
  }
  return stem;
}

function buildName(rng: Rng, flavour: Flavour, rule: SurnameRule, syllables: number): string {
  const useSuffix = chance(rng, 0.55);
  const stemSyllables = useSuffix ? Math.max(1, syllables - 1) : syllables;
  let name = buildStem(rng, flavour, stemSyllables);

  if (useSuffix) {
    const suffixes = flavour === 'anglo' ? ANGLO_SUFFIXES : [...IMMIGRANT_SUFFIXES, ...IMMIGRANT_SUFFIXES, ...ANGLO_SUFFIXES];
    if (VOWEL_END.test(name)) name += pick(rng, LINKS);
    name += pick(rng, suffixes);
  } else {
    const codas = flavour === 'anglo' ? ANGLO_CODAS : [...ANGLO_CODAS, ...IMMIGRANT_CODAS];
    if (!VOWEL_END.test(name)) name += pick(rng, NUCLEI);
    name += pick(rng, codas);
  }

  if (flavour === 'immigrant' && chance(rng, 0.2)) {
    name = (rule.allowPunctuation ? pick(rng, IMMIGRANT_PREFIXES) : 'Mc') + name;
  }
  return name;
}

/** First letter upper-case, plus the letter after an apostrophe, hyphen or leading "Mc". */
export function capitaliseSurname(raw: string): string {
  const lower = raw.toLowerCase();
  let out = '';
  let upNext = true;
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i];
    if (c === "'" || c === '-') {
      out += c;
      upNext = true;
      continue;
    }
    out += upNext ? c.toUpperCase() : c;
    upNext = false;
    if (i === 1 && lower.startsWith('mc') && lower.length > 2) upNext = true;
  }
  return out;
}

export function letterCount(s: string): number {
  return (s.match(/[a-z]/gi) ?? []).length;
}

export function hasFourIdenticalLetters(s: string): boolean {
  return /(.)\1\1\1/i.test(s);
}

/** A run of 4+ consonants that is not itself a table fragment. */
export function hasUnpronounceableRun(s: string): boolean {
  const runs = s.toLowerCase().match(CONSONANT_RUN) ?? [];
  return runs.some((r) => r.length >= 4 && !ALLOWED_RUNS.has(r));
}

export function isAcceptableSurname(candidate: string, preset: Preset): boolean {
  const rule = SURNAME_RULES[preset];
  const n = letterCount(candidate);
  if (n < rule.minLetters || n > rule.maxLetters) return false;
  if (!rule.allowPunctuation && /['-]/.test(candidate)) return false;
  if (hasFourIdenticalLetters(candidate)) return false;
  if (hasUnpronounceableRun(candidate)) return false;
  return true;
}

/** Deterministic for a given RNG stream: the same seed always yields the same surname. */
export function generateSurname(rng: Rng, preset: Preset, flavourSetting: SurnameFlavour = 'both'): string {
  const rule = SURNAME_RULES[preset];
  let last = '';
  for (let attempt = 0; attempt < 400; attempt++) {
    const flavour = resolveFlavour(preset, flavourSetting, rng);
    const syllables = randInt(rng, rule.minSyllables, rule.maxSyllables);
    let name: string;
    if (rule.allowPunctuation && chance(rng, 0.2)) {
      const first = buildName(rng, flavour, rule, Math.max(1, Math.ceil(syllables / 2)));
      const second = buildName(rng, resolveFlavour(preset, flavourSetting, rng), rule, Math.max(1, Math.floor(syllables / 2)));
      name = `${first}-${second}`;
    } else {
      name = buildName(rng, flavour, rule, syllables);
    }
    last = capitaliseSurname(name);
    if (isAcceptableSurname(last, preset)) return last;
  }
  return last;
}
