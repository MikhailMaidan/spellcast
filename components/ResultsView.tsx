'use client';

import type { Attempt, Item } from '@/types';
import { formatGap, type AdaptiveResult } from '@/lib/scoring/adaptive';
import type { DiffOp, DiffResult } from '@/lib/scoring/diff';
import type { LagAnalysis } from '@/lib/scoring/stats';
import { KeystrokeSparkline } from './KeystrokeSparkline';

export interface ResultState {
  attempt: Attempt;
  diff: DiffResult;
  adaptation: AdaptiveResult | null;
  lag: LagAnalysis;
}

const OP_CLASS: Record<DiffOp['type'], string> = {
  correct: 'text-green-700 dark:text-green-400',
  wrong: 'rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  missing: 'rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  extra: 'rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
};

function glyph(ch: string | null, fallback: string): string {
  if (ch === null) return fallback;
  return ch === ' ' ? '␣' : ch;
}

/** Two aligned monospace rows: the target with per-character colouring and the typed string. */
function DiffRows({ ops }: { ops: DiffOp[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="mx-auto border-separate border-spacing-x-0.5 font-mono text-2xl">
        <tbody>
          <tr>
            <th scope="row" className="pr-3 text-left text-xs font-normal text-zinc-500">
              target
            </th>
            {ops.map((op, i) => (
              <td key={i} className={`min-w-7 px-1 text-center ${op.type === 'extra' ? 'text-zinc-300 dark:text-zinc-600' : OP_CLASS[op.type]}`}>
                {glyph(op.expected, '·')}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="pr-3 text-left text-xs font-normal text-zinc-500">
              typed
            </th>
            {ops.map((op, i) => (
              <td key={i} className={`min-w-7 px-1 text-center ${op.type === 'missing' ? 'text-zinc-300 dark:text-zinc-600' : OP_CLASS[op.type]}`}>
                {glyph(op.typed, '_')}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export interface ResultsViewProps {
  item: Item;
  result: ResultState;
  /** Token being spoken while "listening again", or -1. */
  currentToken: number;
}

export function ResultsView({ item, result, currentToken }: ResultsViewProps) {
  const { attempt, diff, adaptation, lag } = result;
  const verdict = diff.correct ? '✔ Correct' : `✘ ${diff.errors} ${diff.errors === 1 ? 'error' : 'errors'}`;
  const spoken = item.tokens.map((t, i) => ({ t, i })).filter(({ t }) => !t.silent && t.chars !== '');

  return (
    <section className="flex flex-col gap-6" aria-live="polite">
      <p className={`text-center text-2xl font-semibold ${diff.correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
        {verdict}
      </p>

      <DiffRows ops={diff.ops} />

      <p className="text-center font-mono text-sm text-zinc-600 dark:text-zinc-400">
        {spoken.map(({ t, i }, k) => (
          <span key={i}>
            {k > 0 && ' · '}
            <span className={i === currentToken ? 'rounded bg-blue-100 px-1 text-blue-900 dark:bg-blue-900 dark:text-blue-100' : ''}>{t.text}</span>
          </span>
        ))}
      </p>

      <KeystrokeSparkline attempt={attempt} lag={lag} tokens={item.tokens} />

      <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        {adaptation ? (
          <p>
            gap {formatGap(adaptation.previousGapMs)} → <strong className="text-zinc-900 dark:text-zinc-100">{formatGap(adaptation.nextGapMs)}</strong>{' '}
            <span className="text-zinc-500">
              ({adaptation.deltaMs > 0 ? '+' : ''}
              {adaptation.deltaMs} ms: {adaptation.reason}
              {adaptation.streakBonus ? ', plus a streak bonus' : ''})
            </span>
          </p>
        ) : (
          <p>adaptive speed is off · gap stays at {formatGap(attempt.gapMs)}</p>
        )}
        {attempt.replays > 0 && <p>replay used ({attempt.replays})</p>}
      </div>
    </section>
  );
}
