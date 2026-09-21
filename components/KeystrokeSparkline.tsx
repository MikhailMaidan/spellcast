'use client';

import type { Attempt, SpeechToken } from '@/types';
import type { LagAnalysis } from '@/lib/scoring/stats';

export interface KeystrokeSparklineProps {
  attempt: Attempt;
  lag: LagAnalysis;
  tokens: SpeechToken[];
}

const W = 640;
const H = 60;
const PAD = 10;

/**
 * One dot per keystroke on a timeline, with a dashed line where each spoken token began.
 * Dots that landed after the next token had started are amber.
 */
export function KeystrokeSparkline({ attempt, lag, tokens }: KeystrokeSparklineProps) {
  const starts = attempt.tokenStartTimes;
  const knownStarts = starts.filter((s): s is number => s !== null);
  const times = attempt.keystrokeTimes;
  if (!times.length && !knownStarts.length) return null;

  const maxT = Math.max(attempt.dictationEndedAt, ...times, ...knownStarts, 1);
  const x = (t: number) => PAD + (Math.min(t, maxT) / maxT) * (W - 2 * PAD);
  const mid = H / 2 - 4;

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" role="img" aria-label="Keystroke timing relative to the spoken tokens">
        <line x1={PAD} x2={W - PAD} y1={mid} y2={mid} className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1} />
        {starts.map((s, i) => {
          const tok = tokens[i];
          if (s === null || !tok || tok.silent || tok.chars === '') return null;
          return (
            <g key={i}>
              <line x1={x(s)} x2={x(s)} y1={6} y2={mid + 10} className="stroke-zinc-400 dark:stroke-zinc-600" strokeWidth={1} strokeDasharray="2 3" />
              <text x={x(s)} y={H - 2} textAnchor="middle" className="fill-zinc-500 font-mono text-[9px]">
                {tok.chars}
              </text>
            </g>
          );
        })}
        {lag.keystrokes.map((k, i) => (
          <circle
            key={i}
            cx={x(k.time)}
            cy={mid}
            r={4}
            className={`${k.lagged ? 'fill-amber-500' : 'fill-blue-600 dark:fill-blue-400'} stroke-white dark:stroke-zinc-950`}
            strokeWidth={2}
          >
            <title>
              {attempt.keystrokeChars[i] ?? '?'} at {Math.round(k.time)} ms{k.lagged ? ' (lagging)' : ''}
            </title>
          </circle>
        ))}
      </svg>
      <figcaption className="text-center text-xs text-zinc-500">
        dots = keystrokes · dashed lines = token starts · <span className="text-amber-600 dark:text-amber-400">amber</span> = typed after the next token had started
      </figcaption>
    </figure>
  );
}
