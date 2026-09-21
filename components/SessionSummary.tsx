'use client';

import type { Session } from '@/types';
import { CONTENT_TYPE_LABELS } from '@/lib/generators';
import { formatGap } from '@/lib/scoring/adaptive';
import type { ErrorCount, SessionStats } from '@/lib/scoring/stats';

export interface SessionSummaryProps {
  open: boolean;
  stats: SessionStats;
  session: Session;
  gapMs: number;
  onClose: () => void;
  onClear: () => void;
  onExport: () => void;
}

const button =
  'rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800';

/** Gap trajectory over the session: one line, current gap as the end marker. */
function GapChart({ values, current }: { values: number[]; current: number }) {
  const points = [...values, current];
  const W = 640;
  const H = 120;
  const padL = 44;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const lo = Math.max(200, Math.min(...points) - 100);
  const hi = Math.min(2000, Math.max(...points) + 100);
  const span = Math.max(hi - lo, 100);
  const x = (i: number) => padL + (points.length === 1 ? 0.5 : i / (points.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / span) * (H - padT - padB);
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = points.length - 1;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label="Gap between characters over the session">
        <line x1={padL} x2={W - padR} y1={y(lo)} y2={y(lo)} className="stroke-zinc-200 dark:stroke-zinc-800" />
        <line x1={padL} x2={W - padR} y1={y(hi)} y2={y(hi)} className="stroke-zinc-200 dark:stroke-zinc-800" />
        <text x={padL - 6} y={y(hi) + 4} textAnchor="end" className="fill-zinc-500 text-[10px]">
          {formatGap(hi)}
        </text>
        <text x={padL - 6} y={y(lo) + 4} textAnchor="end" className="fill-zinc-500 text-[10px]">
          {formatGap(lo)}
        </text>
        <text x={W - padR} y={H - 6} textAnchor="end" className="fill-zinc-500 text-[10px]">
          next item
        </text>
        <text x={padL} y={H - 6} textAnchor="start" className="fill-zinc-500 text-[10px]">
          item 1
        </text>
        <path d={d} fill="none" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={8} fill="transparent">
            <title>
              {i === last ? 'next item' : `item ${i + 1}`}: {formatGap(v)}
            </title>
          </circle>
        ))}
        <circle cx={x(last)} cy={y(points[last])} r={4} className="fill-blue-600 stroke-white dark:fill-blue-400 dark:stroke-zinc-900" strokeWidth={2} />
      </svg>
    </figure>
  );
}

/** Sequential blue ramp, light -> dark, for "how often was this wrong". */
const HEAT_STEPS = ['#cde2fb', '#9ec5f4', '#5598e7', '#256abf', '#104281'];

function Heatmap({ title, entries, limit }: { title: string; entries: ErrorCount[]; limit: number }) {
  const top = entries.slice(0, limit);
  const max = top.length ? top[0].errors : 1;
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</h3>
      {top.length === 0 ? (
        <p className="text-sm text-zinc-500">No errors yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {top.map((e) => {
            const step = Math.min(HEAT_STEPS.length - 1, Math.floor(((e.errors - 1) / max) * HEAT_STEPS.length));
            const dark = step >= 2;
            return (
              <li
                key={e.key}
                className="rounded-md px-2 py-1 font-mono text-sm"
                style={{ backgroundColor: HEAT_STEPS[step], color: dark ? '#ffffff' : '#0b0b0b' }}
                title={`${e.errors} of ${e.total} wrong`}
              >
                {e.key === ' ' ? '␣' : e.key} <span className="opacity-80">{e.errors}/{e.total}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SessionSummary({ open, stats, session, gapMs, onClose, onClear, onExport }: SessionSummaryProps) {
  if (!open) return null;
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/40 p-6" data-no-refocus onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Session summary"
        className="mx-auto flex w-full max-w-[720px] flex-col gap-6 rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Session summary</h2>
          <button type="button" className={button} onClick={onClose}>
            Close (Esc)
          </button>
        </header>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['items', String(stats.attempted)],
            ['correct', String(stats.correct)],
            ['accuracy', pct(stats.correct, stats.attempted)],
            ['streak', String(stats.currentStreak)],
            ['best streak', String(stats.bestStreak)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Gap between characters · now {formatGap(gapMs)}</h3>
          {stats.gapTrajectory.length === 0 ? <p className="text-sm text-zinc-500">No items yet.</p> : <GapChart values={stats.gapTrajectory} current={gapMs} />}
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Heatmap title="Characters most often wrong" entries={stats.charErrors} limit={12} />
          <Heatmap title="Spoken tokens most often wrong" entries={stats.tokenErrors} limit={8} />
        </div>

        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Per content type</h3>
          {stats.perType.length === 0 ? (
            <p className="text-sm text-zinc-500">No items yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="py-1 font-normal">type</th>
                  <th className="py-1 font-normal">items</th>
                  <th className="py-1 font-normal">correct</th>
                  <th className="py-1 font-normal">accuracy</th>
                </tr>
              </thead>
              <tbody>
                {stats.perType.map((t) => (
                  <tr key={t.type} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-1">{CONTENT_TYPE_LABELS[t.type]}</td>
                    <td className="py-1 tabular-nums">{t.attempted}</td>
                    <td className="py-1 tabular-nums">{t.correct}</td>
                    <td className="py-1 tabular-nums">{pct(t.correct, t.attempted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
          <span>
            {stats.replays} replays · {stats.lagged} lagging items · session started {new Date(session.startedAt).toLocaleString()}
          </span>
          <span className="flex gap-2">
            <button type="button" className={button} onClick={onExport}>
              Export JSON
            </button>
            <button type="button" className={`${button} text-red-700 dark:text-red-400`} onClick={onClear}>
              Clear history
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}
