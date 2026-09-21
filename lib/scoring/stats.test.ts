import { describe, expect, it } from 'vitest';
import type { Attempt, Session } from '@/types';
import { DEFAULT_SETTINGS } from '../settings';
import { tokenize } from '../speech/tokenizer';
import { analyseKeystrokes, computeSessionStats, tokenCharSpans, tokenIndexForPosition } from './stats';

describe('token spans', () => {
  it('gives pause tokens zero length when spaces are ignored', () => {
    const tokens = tokenize('SW1A 0AA', { grouping: 'always', zeroStyle: 'oh' });
    const spans = tokenCharSpans(tokens, true);
    expect(spans.map((s) => s.length)).toEqual([1, 1, 1, 1, 0, 1, 2]);
    expect(tokenIndexForPosition(spans, 4)).toBe(5);
    expect(tokenIndexForPosition(spans, 6)).toBe(6);
    expect(tokenIndexForPosition(spans, 7)).toBe(-1);
    expect(tokenCharSpans(tokens, false).map((s) => s.length)).toEqual([1, 1, 1, 1, 1, 1, 2]);
  });
});

describe('analyseKeystrokes', () => {
  const tokens = [
    { text: 'ay', chars: 'A' },
    { text: 'bee', chars: 'B' },
  ];

  it('flags keystrokes that land after the next token started', () => {
    const r = analyseKeystrokes({
      tokens,
      keystrokeTimes: [500, 2500],
      keystrokeChars: ['a', 'b'],
      tokenStartTimes: [0, 1000],
      dictationEndedAt: 1500,
      gapMs: 500,
      ignoreSpaces: true,
    });
    expect(r.keystrokes[0]).toMatchObject({ tokenIndex: 0, deadline: 1000, lagged: false });
    expect(r.keystrokes[1]).toMatchObject({ tokenIndex: 1, deadline: 2000, lagged: true });
    expect(r.lagged).toBe(true);
  });

  it('is not lagged when everything lands in time', () => {
    const r = analyseKeystrokes({
      tokens,
      keystrokeTimes: [800, 1400],
      keystrokeChars: ['a', 'b'],
      tokenStartTimes: [0, 1000],
      dictationEndedAt: 1500,
      gapMs: 500,
      ignoreSpaces: true,
    });
    expect(r.lagged).toBe(false);
  });

  it('skips typed spaces when spaces are ignored', () => {
    const r = analyseKeystrokes({
      tokens,
      keystrokeTimes: [100, 200, 300],
      keystrokeChars: ['a', ' ', 'b'],
      tokenStartTimes: [0, 1000],
      dictationEndedAt: 1500,
      gapMs: 500,
      ignoreSpaces: true,
    });
    expect(r.keystrokes.map((k) => k.tokenIndex)).toEqual([0, -1, 1]);
  });
});

function attempt(target: string, typed: string, correct: boolean, gapMs: number): Attempt {
  return {
    itemId: target,
    item: { seed: 1, contentType: 'alnum', target, tokens: tokenize(target, { grouping: 'never', zeroStyle: 'oh' }) },
    typed,
    correct,
    charAccuracy: correct ? 1 : 0.5,
    errors: correct ? 0 : 1,
    gapMs,
    replays: 0,
    keystrokeTimes: [],
    keystrokeChars: [],
    tokenStartTimes: [],
    dictationEndedAt: 0,
    lagged: false,
    finishedAt: 0,
  };
}

describe('computeSessionStats', () => {
  it('tracks streaks, accuracy, trajectory and error counts', () => {
    const session: Session = {
      id: 's',
      startedAt: 0,
      settingsSnapshot: DEFAULT_SETTINGS,
      attempts: [attempt('AB12', 'AB12', true, 800), attempt('AB12', 'AB12', true, 700), attempt('MN34', 'NN34', false, 600), attempt('AB12', 'AB12', true, 650)],
    };
    const s = computeSessionStats(session, true);
    expect(s.attempted).toBe(4);
    expect(s.correct).toBe(3);
    expect(s.accuracy).toBe(0.75);
    expect(s.currentStreak).toBe(1);
    expect(s.bestStreak).toBe(2);
    expect(s.gapTrajectory).toEqual([800, 700, 600, 650]);
    expect(s.perType).toEqual([{ type: 'alnum', attempted: 4, correct: 3 }]);
    expect(s.charErrors[0]).toEqual({ key: 'M', errors: 1, total: 1 });
    expect(s.tokenErrors[0]).toEqual({ key: 'em', errors: 1, total: 1 });
  });
});
