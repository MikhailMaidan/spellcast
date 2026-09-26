/**
 * string -> SpeechToken[] (§6.1). Scans the target for runs of identical characters and
 * turns them into "double X" / "triple X" tokens according to the grouping mode.
 */
import type { GroupingMode, LetterStyle, PronunciationColumn, SpeechToken, ZeroStyle } from '@/types';
import type { Rng } from '../rng';
import { spokenForm } from './pronounce';

export interface TokenizeOptions {
  grouping: GroupingMode;
  zeroStyle: ZeroStyle;
  column?: PronunciationColumn;
  /** Drives every random decision (grouping coin flips, oh/zero, dash/hyphen). */
  rng?: Rng;
  overrides?: Record<string, string>;
  /** 'plain' sends letters as themselves; 'spelled' (default) uses the map. */
  letterStyle?: LetterStyle;
  /** Spoken before the spelling, e.g. "The postcode is". */
  announce?: string;
  /** Say the whole target as a word first (surnames), slowly and distinctly. */
  readWholeFirst?: boolean;
  /** Absolute speech rate for that whole-word reading (default 0.8). */
  wholeWordRate?: number;
}

/** Pause multiplier for a space between halves of a postcode. */
export const SPACE_PAUSE = 1.5;
/** A speaker always pauses noticeably between halves of a postcode, whatever the letter gap. */
export const SPACE_MIN_PAUSE_MS = 350;
/** Short breath between "The surname is" and the name itself. */
export const ANNOUNCE_MIN_PAUSE_MS = 250;
/** A speaker always pauses noticeably after the intro before spelling. */
export const INTRO_MIN_PAUSE_MS = 700;
/** The whole word is read slowly so an unfamiliar name can be followed; independent of the letter rate. */
export const WHOLE_WORD_RATE_DEFAULT = 0.8;

const ALNUM = /[A-Za-z0-9]/;

/**
 * The introduction: "The surname is" (normal speed), then the whole word as its own slow,
 * distinct utterance ("Bell."), each followed by a guaranteed pause. Either part can be off.
 */
export function introTokens(target: string, announce?: string, readWholeFirst?: boolean, wholeWordRate = WHOLE_WORD_RATE_DEFAULT): SpeechToken[] {
  const tokens: SpeechToken[] = [];
  if (announce) tokens.push({ text: announce, chars: '', minPauseAfterMs: readWholeFirst ? ANNOUNCE_MIN_PAUSE_MS : INTRO_MIN_PAUSE_MS });
  if (readWholeFirst) tokens.push({ text: `${target}.`, chars: '', rate: wholeWordRate, minPauseAfterMs: INTRO_MIN_PAUSE_MS });
  return tokens;
}

export function tokenize(target: string, opts: TokenizeOptions): SpeechToken[] {
  const rng = opts.rng ?? Math.random;
  const pronounce = (ch: string) =>
    spokenForm(ch, {
      column: opts.column ?? 'gb',
      zeroStyle: opts.zeroStyle,
      rng,
      overrides: opts.overrides,
      letterStyle: opts.letterStyle ?? 'spelled',
    });

  const tokens: SpeechToken[] = introTokens(target, opts.announce, opts.readWholeFirst, opts.wholeWordRate);

  let i = 0;
  while (i < target.length) {
    const ch = target[i];

    if (ch === ' ') {
      tokens.push({ text: `<pause ${SPACE_PAUSE}x>`, chars: ' ', silent: true, pauseAfter: SPACE_PAUSE, minPauseAfterMs: SPACE_MIN_PAUSE_MS });
      i++;
      continue;
    }

    if (ALNUM.test(ch)) {
      let run = 1;
      while (i + run < target.length && target[i + run].toUpperCase() === ch.toUpperCase()) run++;
      const spoken = pronounce(ch);
      let remaining = run;
      let offset = i;
      while (remaining > 0) {
        const size = remaining >= 3 ? 3 : remaining;
        const grouped =
          size >= 2 && (opts.grouping === 'always' || (opts.grouping === 'random' && rng() < 0.5));
        if (grouped) {
          tokens.push({ text: `${size === 3 ? 'triple' : 'double'} ${spoken}`, chars: target.slice(offset, offset + size) });
        } else {
          for (let k = 0; k < size; k++) tokens.push({ text: spoken, chars: target[offset + k] });
        }
        offset += size;
        remaining -= size;
      }
      i += run;
      continue;
    }

    tokens.push({ text: pronounce(ch), chars: ch });
    i++;
  }
  return tokens;
}

/** "ess · double you · one · ay · oh · double ay" — the spelling tokens only. */
export function spokenSummary(tokens: SpeechToken[]): string {
  return tokens
    .filter((t) => !t.silent && t.chars !== '')
    .map((t) => t.text)
    .join(' · ');
}
