/**
 * Adaptive speed rules (§7.2). Pure functions: attempt outcome in, next speed out.
 * With token delivery the speed is the gap between tokens; with continuous delivery it
 * is the speech rate, driven by the same rules.
 */

export const GAP_MIN = 0;
export const GAP_MAX = 2000;
/** Resolution of the gap: slider step and the grid the persisted value snaps to. */
export const GAP_STEP = 10;
/** Keyboard steps: [ and ] are coarse, { and } are fine. */
export const GAP_KEY_STEP = 50;
export const GAP_KEY_FINE_STEP = 10;
export const GAP_DEFAULT = 500;

/** SpeechSynthesisUtterance.rate range exposed in settings. */
export const RATE_MIN = 0.5;
export const RATE_MAX = 2;
export const RATE_STEP = 0.05;
export const RATE_KEY_STEP = 0.05;
export const RATE_KEY_FINE_STEP = 0.01;
export const RATE_DEFAULT = 1;

/** Snap to the 10 ms grid and clamp to the allowed range. */
export function clampGap(ms: number): number {
  if (!Number.isFinite(ms)) return GAP_DEFAULT;
  const stepped = Math.round(ms / GAP_STEP) * GAP_STEP;
  return Math.min(GAP_MAX, Math.max(GAP_MIN, stepped));
}

/** Snap to two decimals and clamp to the allowed range. */
export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return RATE_DEFAULT;
  const snapped = Math.round(rate * 100) / 100;
  return Math.min(RATE_MAX, Math.max(RATE_MIN, snapped));
}

export interface AttemptOutcome {
  correct: boolean;
  /** Wrong + missing + extra characters. */
  errors: number;
  replays: number;
  /** At least one keystroke landed after the next token had started speaking. */
  lagged: boolean;
  /** Consecutive fully-correct items including this one (0 when this one was wrong). */
  streak: number;
}

export interface AdaptiveDelta {
  /** Change to the gap in ms; negative = faster. */
  deltaMs: number;
  reason: string;
  streakBonus: boolean;
}

/** The rule table of §7.2, expressed as a gap change. */
export function adaptiveDelta(outcome: AttemptOutcome): AdaptiveDelta {
  let deltaMs: number;
  let reason: string;

  if (outcome.replays > 0) {
    deltaMs = 150;
    reason = 'a replay was used';
  } else if (outcome.errors >= 2) {
    deltaMs = 150;
    reason = `${outcome.errors} characters wrong or missing`;
  } else if (outcome.errors === 1) {
    deltaMs = 50;
    reason = '1 character wrong or missing';
  } else if (!outcome.correct) {
    deltaMs = 150;
    reason = 'not correct';
  } else if (outcome.lagged) {
    deltaMs = 0;
    reason = 'correct, but some keystrokes lagged behind the speaker';
  } else {
    deltaMs = -100;
    reason = 'correct and every keystroke landed within the gap window';
  }

  let streakBonus = false;
  if (outcome.correct && outcome.replays === 0 && outcome.streak > 0 && outcome.streak % 3 === 0) {
    deltaMs -= 50;
    streakBonus = true;
  }
  return { deltaMs, reason, streakBonus };
}

export interface AdaptiveResult {
  kind: 'gap' | 'rate';
  previous: number;
  next: number;
  /** Actual change after clamping: ms for a gap, rate units for a rate. */
  delta: number;
  reason: string;
  streakBonus: boolean;
}

/** Token delivery: adjust the gap between tokens. */
export function adaptGap(outcome: AttemptOutcome, gapMs: number): AdaptiveResult {
  const { deltaMs, reason, streakBonus } = adaptiveDelta(outcome);
  const next = clampGap(gapMs + deltaMs);
  return { kind: 'gap', previous: gapMs, next, delta: next - gapMs, reason, streakBonus };
}

/** Continuous delivery: the same rules move the speech rate (100 ms of gap ≙ 0.10 of rate). */
export function adaptRate(outcome: AttemptOutcome, rate: number): AdaptiveResult {
  const { deltaMs, reason, streakBonus } = adaptiveDelta(outcome);
  const next = clampRate(rate - deltaMs / 1000);
  return { kind: 'rate', previous: rate, next, delta: Math.round((next - rate) * 100) / 100, reason, streakBonus };
}

/** "0.8 s" style display, one decimal when on the 100 ms grid, two otherwise. */
export function formatGap(ms: number): string {
  const seconds = ms / 1000;
  return `${ms % 100 === 0 ? seconds.toFixed(1) : seconds.toFixed(2)} s`;
}

export function formatRate(rate: number): string {
  return `${rate.toFixed(2)}×`;
}
