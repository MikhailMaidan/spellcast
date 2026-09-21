import { describe, expect, it } from 'vitest';
import { adaptGap, adaptRate, clampGap, clampRate, formatGap, formatRate } from './adaptive';

const clean = { correct: true, errors: 0, replays: 0, lagged: false, streak: 1 };

describe('adaptGap', () => {
  it('speeds up by 100 ms after a clean correct item', () => {
    const r = adaptGap(clean, 800);
    expect(r).toMatchObject({ kind: 'gap', previous: 800, next: 700, delta: -100, streakBonus: false });
  });

  it('holds when correct but lagging', () => {
    expect(adaptGap({ ...clean, lagged: true }, 800).next).toBe(800);
  });

  it('slows by 50 ms for one error', () => {
    expect(adaptGap({ ...clean, correct: false, errors: 1, streak: 0 }, 800).next).toBe(850);
  });

  it('slows by 150 ms for two or more errors or a replay', () => {
    expect(adaptGap({ ...clean, correct: false, errors: 2, streak: 0 }, 800).next).toBe(950);
    expect(adaptGap({ ...clean, replays: 1 }, 800).next).toBe(950);
  });

  it('adds a streak bonus every third consecutive correct item', () => {
    expect(adaptGap({ ...clean, streak: 3 }, 800).next).toBe(650);
    expect(adaptGap({ ...clean, streak: 3 }, 800).streakBonus).toBe(true);
    expect(adaptGap({ ...clean, streak: 4 }, 800).next).toBe(700);
    expect(adaptGap({ ...clean, streak: 6, lagged: true }, 800).next).toBe(750);
  });

  it('clamps to the allowed range', () => {
    expect(adaptGap(clean, 50).next).toBe(0);
    expect(adaptGap(clean, 50).delta).toBe(-50);
    expect(adaptGap({ ...clean, correct: false, errors: 5, streak: 0 }, 1950).next).toBe(2000);
  });
});

describe('adaptRate', () => {
  it('maps the same rules onto the speech rate', () => {
    expect(adaptRate(clean, 1)).toMatchObject({ kind: 'rate', previous: 1, next: 1.1, delta: 0.1 });
    expect(adaptRate({ ...clean, lagged: true }, 1).next).toBe(1);
    expect(adaptRate({ ...clean, correct: false, errors: 1, streak: 0 }, 1).next).toBe(0.95);
    expect(adaptRate({ ...clean, correct: false, errors: 3, streak: 0 }, 1).next).toBe(0.85);
    expect(adaptRate({ ...clean, streak: 3 }, 1).next).toBe(1.15);
  });

  it('clamps to the rate range', () => {
    expect(adaptRate(clean, 1.95).next).toBe(2);
    expect(adaptRate({ ...clean, correct: false, errors: 4, streak: 0 }, 0.55).next).toBe(0.5);
  });
});

describe('clamp and format helpers', () => {
  it('snaps the gap to 10 ms and clamps', () => {
    expect(clampGap(835)).toBe(840);
    expect(clampGap(832)).toBe(830);
    expect(clampGap(50)).toBe(50);
    expect(clampGap(-20)).toBe(0);
    expect(clampGap(5000)).toBe(2000);
    expect(clampGap(Number.NaN)).toBe(800);
  });

  it('snaps the rate to two decimals and clamps', () => {
    expect(clampRate(1.049)).toBe(1.05);
    expect(clampRate(0.1)).toBe(0.5);
    expect(clampRate(3)).toBe(2);
    expect(clampRate(Number.NaN)).toBe(1);
  });

  it('formats values', () => {
    expect(formatGap(800)).toBe('0.8 s');
    expect(formatGap(750)).toBe('0.75 s');
    expect(formatGap(2000)).toBe('2.0 s');
    expect(formatRate(1.05)).toBe('1.05×');
  });
});
