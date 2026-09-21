import { describe, expect, it } from 'vitest';
import { fallbackTimeoutMs, gapWaitMs } from './speaker';

describe('gapWaitMs', () => {
  it('pause mode waits the full gap after the token ended', () => {
    expect(gapWaitMs({ gapMs: 300, mode: 'pause' }, 1, 1000, 1400)).toBe(300);
    expect(gapWaitMs({ gapMs: 300, mode: 'pause' }, 1.5, 1000, 1400)).toBe(450);
    expect(gapWaitMs({ gapMs: 0, mode: 'pause' }, 1, 1000, 1400)).toBe(0);
  });

  it('cadence mode measures from the token start and absorbs its audio', () => {
    // token started at 1000 and ended at 1400; next should start at 1000 + 600 = 1600
    expect(gapWaitMs({ gapMs: 600, mode: 'cadence' }, 1, 1000, 1400)).toBe(200);
    // audio longer than the gap: no extra wait
    expect(gapWaitMs({ gapMs: 300, mode: 'cadence' }, 1, 1000, 1400)).toBe(0);
    // pause multiplier applies to the whole interval
    expect(gapWaitMs({ gapMs: 600, mode: 'cadence' }, 1.5, 1000, 1400)).toBe(500);
  });
});

describe('fallbackTimeoutMs', () => {
  it('scales with token length and rate, with a floor', () => {
    expect(fallbackTimeoutMs('ay')).toBe(1000);
    expect(fallbackTimeoutMs('double you')).toBe(1800);
    expect(fallbackTimeoutMs('double you', 2)).toBe(1000);
    expect(fallbackTimeoutMs('triple seven', 0.5)).toBe(4200);
  });
});
