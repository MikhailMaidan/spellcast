'use client';

export interface GapRun {
  /** Changes for every gap so the animation restarts. */
  id: number;
  ms: number;
}

/** A thin bar that fills over the current pause between tokens. */
export function GapTimerBar({ run }: { run: GapRun | null }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800" aria-hidden="true">
      {run && <div key={run.id} className="gap-fill h-full bg-blue-500" style={{ animationDuration: `${run.ms}ms` }} />}
    </div>
  );
}
