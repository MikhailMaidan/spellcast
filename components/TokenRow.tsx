'use client';

import { memo } from 'react';
import type { SpeechToken } from '@/types';
import { normaliseForScoring } from '@/lib/scoring/diff';
import { tokenCharSpans } from '@/lib/scoring/stats';

export interface TokenRowProps {
  tokens: SpeechToken[];
  /** Index of the token being spoken, or -1. */
  current: number;
  /** Raw typed text for live feedback, or null to skip the correctness colouring. */
  typed: string | null;
  ignoreSpaces: boolean;
  /** Show the spoken text inside each box (otherwise blank boxes, closer to the exam). */
  showText: boolean;
}

type Status = 'idle' | 'ok' | 'partial' | 'bad';

const STATUS_CLASS: Record<Status, string> = {
  idle: 'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  ok: 'border-green-600 bg-green-50 text-green-800 dark:border-green-500 dark:bg-green-950 dark:text-green-200',
  partial: 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  bad: 'border-red-600 bg-red-50 text-red-800 dark:border-red-500 dark:bg-red-950 dark:text-red-200',
};

/** One box per token; memoised so keystrokes do not re-render it unless live feedback is on. */
function TokenRowBase({ tokens, current, typed, ignoreSpaces, showText }: TokenRowProps) {
  const spans = tokenCharSpans(tokens, ignoreSpaces);
  const typedNorm = typed === null ? null : normaliseForScoring(typed, ignoreSpaces);

  return (
    <div className="flex min-h-9 flex-wrap items-center justify-center gap-2" aria-label="Spoken tokens">
      {tokens.map((tok, i) => {
        const isCurrent = i === current;
        if (tok.silent) {
          return (
            <span
              key={i}
              className={`h-2 w-5 rounded-full ${isCurrent ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              aria-label="pause"
            />
          );
        }
        const meta = tok.chars === '';
        let status: Status = 'idle';
        if (typedNorm !== null && !meta) {
          const { start, length } = spans[i];
          const expected = tok.chars.toUpperCase();
          const slice = typedNorm.slice(start, start + length);
          if (slice.length) {
            status = slice === expected.slice(0, slice.length) ? (slice.length === expected.length ? 'ok' : 'partial') : 'bad';
          }
        }
        const ring = isCurrent ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950' : '';
        return (
          <span
            key={i}
            className={`min-w-8 rounded-md border px-2 py-1 text-center font-mono text-sm ${meta ? 'italic opacity-70' : ''} ${STATUS_CLASS[status]} ${ring}`}
          >
            {showText ? tok.text : meta ? '…' : ' '}
          </span>
        );
      })}
    </div>
  );
}

export const TokenRow = memo(TokenRowBase);
