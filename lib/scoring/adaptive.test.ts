import { describe, expect, it } from 'vitest';
import { adaptGap, clampGap, formatGap } from './adaptive';

const base = { gapMs: 800, correct: true, errors: 0, replays: 0, lagged: false, streak: 1 };

describe('adaptGap', () => {
  it('speeds up by 100 ms after a clean correct item', () => {
    expect(adaptGap(base).nextGapMs).toBe(700);
  });

  it('holds when correct but lagging', () => {
    expect(adaptGap({ ...base, lagged: true }).nextGapMs).toBe(800);
  });

  it('slows by 50 ms for one error', () => {
    expect(adaptGap({ ...base, correct: false, errors: 1, streak: 0 }).nextGapMs).toBe(850);
  });

  it('slows by 150 ms for two or more errors or a replay', () => {
    expect(adaptGap({ ...base, correct: false, errors: 2, streak: 0 }).nextGapMs).toBe(950);
    expect(adaptGap({ ...base, replays: 1 }).nextGapMs).toBe(950);
  });

  it('adds a streak bonus every third consecutive correct item', () => {
    expect(adaptGap({ ...base, streak: 3 }).nextGapMs).toBe(650);
    expect(adaptGap({ ...base, streak: 3 }).streakBonus).toBe(true);
    expect(adaptGap({ ...base, streak: 4 }).nextGapMs).toBe(700);
    expect(adaptGap({ ...base, streak: 6, lagged: true }).nextGapMs).toBe(750);
  });

  it('clamps to the allowed range', () => {
    expect(adaptGap({ ...base, gapMs: 250 }).nextGapMs).toBe(200);
    expect(adaptGap({ ...base, gapMs: 1950, correct: false, errors: 5, streak: 0 }).nextGapMs).toBe(2000);
    expect(adaptGap({ ...base, gapMs: 250 }).deltaMs).toBe(-50);
  });
});

describe('clampGap / formatGap', () => {
  it('snaps to 50 ms and clamps', () => {
    expect(clampGap(830)).toBe(850);
    expect(clampGap(820)).toBe(800);
    expect(clampGap(50)).toBe(200);
    expect(clampGap(5000)).toBe(2000);
    expect(clampGap(Number.NaN)).toBe(800);
  });

  it('formats seconds', () => {
    expect(formatGap(800)).toBe('0.8 s');
    expect(formatGap(750)).toBe('0.75 s');
    expect(formatGap(2000)).toBe('2.0 s');
  });
});
