'use client';

import { formatGap } from '@/lib/scoring/adaptive';
import type { SessionStats } from '@/lib/scoring/stats';

export interface StatsBarProps {
  stats: SessionStats;
  gapMs: number;
  onOpenSettings: () => void;
  onOpenStats: () => void;
}

const keyButton =
  'rounded border border-zinc-300 px-2 py-0.5 font-mono text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800';

export function StatsBar({ stats, gapMs, onOpenSettings, onOpenStats }: StatsBarProps) {
  const acc = stats.attempted ? `${Math.round(stats.accuracy * 100)}%` : '–';
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-4 px-6 py-3">
        <h1 className="text-base font-semibold tracking-tight">IELTS Spelling Trainer</h1>
        <div className="flex items-center gap-4 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
          <span>
            acc <strong className="text-zinc-900 dark:text-zinc-100">{acc}</strong>
          </span>
          <span>
            streak <strong className="text-zinc-900 dark:text-zinc-100">{stats.currentStreak}</strong>
          </span>
          <span>
            gap{' '}
            <strong key={gapMs} className="gap-pop text-zinc-900 dark:text-zinc-100">
              {formatGap(gapMs)}
            </strong>
          </span>
          <button type="button" data-no-refocus onClick={onOpenStats} className={keyButton} title="Session summary (T)">
            T
          </button>
          <button type="button" data-no-refocus onClick={onOpenSettings} className={keyButton} title="Settings (S)">
            S
          </button>
        </div>
      </div>
    </header>
  );
}
