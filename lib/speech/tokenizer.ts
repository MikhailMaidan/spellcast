/**
 * string -> SpeechToken[] (§6.1). Scans the target for runs of identical characters and
 * turns them into "double X" / "triple X" tokens according to the grouping mode.
 */
import type { GroupingMode, PronunciationColumn, SpeechToken, ZeroStyle } from '@/types';
import type { Rng } from '../rng';
import { spokenForm } from './pronounce';

export interface TokenizeOptions {
  grouping: GroupingMode;
  zeroStyle: ZeroStyle;
  column?: PronunciationColumn;
  /** Drives every random decision (grouping coin flips, oh/zero, dash/hyphen). */
  rng?: Rng;
  overrides?: Record<string, string>;
  /** Spoken before the spelling, e.g. "postcode". */
  announce?: string;
  /** Say the whole target as a word first (surnames). */
  readWholeFirst?: boolean;
  /** Say "that's" between the whole word and the spelling (default true). */
  sayThats?: boolean;
}

/** Pause multiplier for a space between halves of a postcode. */
export const SPACE_PAUSE = 1.5;
/** Pause multiplier after the whole word has been read. */
export const WHOLE_WORD_PAUSE = 2;

const ALNUM = /[A-Za-z0-9]/;

export function tokenize(target: string, opts: TokenizeOptions): SpeechToken[] {
  const rng = opts.rng ?? Math.random;
  const pronounce = (ch: string) =>
    spokenForm(ch, { column: opts.column ?? 'gb', zeroStyle: opts.zeroStyle, rng, overrides: opts.overrides });

  const tokens: SpeechToken[] = [];
  if (opts.announce) tokens.push({ text: opts.announce, chars: '' });
  if (opts.readWholeFirst) {
    tokens.push({ text: target, chars: '', pauseAfter: WHOLE_WORD_PAUSE });
    if (opts.sayThats !== false) tokens.push({ text: "that's", chars: '' });
  }

  let i = 0;
  while (i < target.length) {
    const ch = target[i];

    if (ch === ' ') {
      tokens.push({ text: `<pause ${SPACE_PAUSE}x>`, chars: ' ', silent: true, pauseAfter: SPACE_PAUSE });
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
