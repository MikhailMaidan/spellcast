/**
 * Character -> spoken form mapping (§6.2). Never pass a bare letter to the synthesiser:
 * "A" tends to come out as the article "uh" and short letters get clipped.
 */
import type { LetterStyle, PronunciationColumn, ZeroStyle } from '@/types';
import type { Rng } from '../rng';

/**
 * Spelled-out forms. Where the spec's spelling is not a real word ("jee", "el", "ar") a
 * dictionary word with the same sound is used instead, because voices read two-letter
 * non-words unpredictably.
 */
export const LETTERS_GB: Record<string, string> = {
  A: 'ay', B: 'bee', C: 'see', D: 'dee', E: 'ee', F: 'eff', G: 'gee', H: 'aitch', I: 'eye', J: 'jay',
  K: 'kay', L: 'ell', M: 'em', N: 'en', O: 'oh', P: 'pee', Q: 'cue', R: 'are', S: 'ess', T: 'tee',
  U: 'you', V: 'vee', W: 'double you', X: 'ex', Y: 'why', Z: 'zed',
};

export const LETTERS_US: Record<string, string> = { ...LETTERS_GB, Z: 'zee' };

export const DIGITS: Record<string, string> = {
  '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
};

export const ZERO_FORMS = { oh: 'oh', zero: 'zero' } as const;
export const HYPHEN_FORMS = ['dash', 'hyphen'] as const;
export const SYMBOLS: Record<string, string> = { "'": 'apostrophe', '/': 'slash' };

/** Every character the generators can produce, in editor order. */
export const PRONOUNCEABLE_CHARS: readonly string[] = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  ...'0123456789'.split(''),
  '-',
  "'",
  '/',
];

export function overrideKey(column: PronunciationColumn, ch: string): string {
  return `${column}:${ch.toUpperCase()}`;
}

/** Which pronunciation column a voice's language tag selects. */
export function columnForLang(lang: string | null | undefined): PronunciationColumn {
  const l = (lang ?? '').replace('_', '-').toLowerCase();
  return l.startsWith('en-us') ? 'us' : 'gb';
}

/** Default spoken form for the editor table (0 shows both styles). */
export function defaultSpokenForm(ch: string, column: PronunciationColumn, letterStyle: LetterStyle = 'spelled'): string {
  const upper = ch.toUpperCase();
  if (/^[A-Z]$/.test(upper)) return letterStyle === 'plain' ? upper : (column === 'us' ? LETTERS_US : LETTERS_GB)[upper];
  if (upper === '0') return column === 'us' ? 'zero / oh' : 'oh / zero';
  if (DIGITS[upper]) return DIGITS[upper];
  if (upper === '-') return 'dash / hyphen';
  return SYMBOLS[upper] ?? ch;
}

export interface PronounceOptions {
  column?: PronunciationColumn;
  zeroStyle?: ZeroStyle;
  /** Used for the "random" choices (zero style, dash/hyphen). Defaults to Math.random. */
  rng?: Rng;
  overrides?: Record<string, string>;
  /** 'plain' hands the letter itself to the voice; 'spelled' (default) uses the map. */
  letterStyle?: LetterStyle;
}

/** The spoken form of a single character. */
export function spokenForm(ch: string, opts: PronounceOptions = {}): string {
  const column = opts.column ?? 'gb';
  const rng = opts.rng ?? Math.random;
  const zeroStyle = opts.zeroStyle ?? 'random';
  const upper = ch.toUpperCase();

  const override = opts.overrides?.[overrideKey(column, upper)];
  if (override && override.trim()) return override.trim();

  if (/^[A-Z]$/.test(upper)) {
    if (opts.letterStyle === 'plain') return upper;
    return (column === 'us' ? LETTERS_US : LETTERS_GB)[upper];
  }
  if (upper === '0') {
    const style = zeroStyle === 'random' ? (rng() < 0.5 ? 'oh' : 'zero') : zeroStyle;
    return ZERO_FORMS[style];
  }
  if (DIGITS[upper]) return DIGITS[upper];
  if (upper === '-') return HYPHEN_FORMS[rng() < 0.5 ? 0 : 1];
  if (SYMBOLS[upper]) return SYMBOLS[upper];
  return ch;
}
