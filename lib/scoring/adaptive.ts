/** Gap adjustment rules (§7.2). Pure function: attempt outcome in, next gap out. */

export const GAP_MIN = 0;
export const GAP_MAX = 2000;
/** Resolution of the gap: slider step and the grid the persisted value snaps to. */
export const GAP_STEP = 10;
/** Keyboard steps: [ and ] are coarse, { and } are fine. */
export const GAP_KEY_STEP = 50;
export const GAP_KEY_FINE_STEP = 10;
export const GAP_DEFAULT = 800;

/** Snap to the 10 ms grid and clamp to the allowed range. */
export function clampGap(ms: number): number {
  if (!Number.isFinite(ms)) return GAP_DEFAULT;
  const stepped = Math.round(ms / GAP_STEP) * GAP_STEP;
  return Math.min(GAP_MAX, Math.max(GAP_MIN, stepped));
}

export interface AdaptiveInput {
  /** Gap used for the attempt just finished. */
  gapMs: number;
  correct: boolean;
  /** Wrong + missing + extra characters. */
  errors: number;
  replays: number;
  /** At least one keystroke landed after the next token had started speaking. */
  lagged: boolean;
  /** Consecutive fully-correct items including this one (0 when this one was wrong). */
  streak: number;
}

export interface AdaptiveResult {
  previousGapMs: number;
  nextGapMs: number;
  /** Actual change after clamping. */
  deltaMs: number;
  reason: string;
  streakBonus: boolean;
}

export function adaptGap(input: AdaptiveInput): AdaptiveResult {
  let delta: number;
  let reason: string;

  if (input.replays > 0) {
    delta = 150;
    reason = 'a replay was used';
  } else if (input.errors >= 2) {
    delta = 150;
    reason = `${input.errors} characters wrong or missing`;
  } else if (input.errors === 1) {
    delta = 50;
    reason = '1 character wrong or missing';
  } else if (!input.correct) {
    delta = 150;
    reason = 'not correct';
  } else if (input.lagged) {
    delta = 0;
    reason = 'correct, but some keystrokes lagged behind the speaker';
  } else {
    delta = -100;
    reason = 'correct and every keystroke landed within the gap window';
  }

  let streakBonus = false;
  if (input.correct && input.replays === 0 && input.streak > 0 && input.streak % 3 === 0) {
    delta -= 50;
    streakBonus = true;
  }

  const nextGapMs = clampGap(input.gapMs + delta);
  return { previousGapMs: input.gapMs, nextGapMs, deltaMs: nextGapMs - input.gapMs, reason, streakBonus };
}

/** "0.8 s" style display, one decimal when on the 100 ms grid, two otherwise. */
export function formatGap(ms: number): string {
  const seconds = ms / 1000;
  return `${ms % 100 === 0 ? seconds.toFixed(1) : seconds.toFixed(2)} s`;
}
