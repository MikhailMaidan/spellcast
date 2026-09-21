import { describe, expect, it } from 'vitest';
import { buildSegments, fallbackTimeoutMs, gapWaitMs, partIndexForChar } from './speaker';
import { tokenize } from './tokenizer';

const postcode = tokenize('SW1A 0AA', { grouping: 'always', zeroStyle: 'oh' });

describe('buildSegments', () => {
  it('token delivery: one utterance per token, pause tokens attached to the previous one', () => {
    const segs = buildSegments(postcode, 'token', 'short');
    expect(segs.map((s) => s.text)).toEqual(['ess', 'double you', 'one', 'ay', 'oh', 'double ay']);
    expect(segs[3]).toMatchObject({ pauseAfter: 1.5, pauseToken: 4 });
    expect(segs[4].pauseAfter).toBe(1);
    expect(segs.every((s) => s.parts.length === 1)).toBe(true);
  });

  it('continuous delivery: the spelling is one utterance with separators', () => {
    const segs = buildSegments(postcode, 'continuous', 'short');
    expect(segs).toHaveLength(1);
    expect(segs[0].text).toBe('ess, double you, one, ay. oh, double ay');
    expect(segs[0].parts.map((p) => p.token)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(segs[0].parts.map((p) => p.offset)).toEqual([0, 5, 17, 22, 26, 26, 30]);
    expect(buildSegments(postcode, 'continuous', 'none')[0].text).toBe('ess double you one ay. oh double ay');
    expect(buildSegments(postcode, 'continuous', 'long')[0].text).toBe('ess. double you. one. ay. oh. double ay');
  });

  it('keeps announcement and whole-word tokens as their own utterances', () => {
    const tokens = tokenize('Bell', { grouping: 'always', zeroStyle: 'oh', announce: 'surname', readWholeFirst: true });
    const segs = buildSegments(tokens, 'continuous', 'short');
    expect(segs.map((s) => s.text)).toEqual(['surname', 'Bell', "that's", 'bee, ee, double el']);
    expect(segs[1].pauseAfter).toBe(2);
    expect(segs[3].parts.map((p) => p.token)).toEqual([3, 4, 5]);
  });

  it('starts with a silent segment when a pause token comes first', () => {
    const segs = buildSegments([{ text: '<pause 1.5x>', chars: ' ', silent: true, pauseAfter: 1.5 }, { text: 'ay', chars: 'A' }], 'token', 'short');
    expect(segs[0]).toMatchObject({ silent: true, pauseAfter: 1.5, pauseToken: 0 });
    expect(segs[1].text).toBe('ay');
  });
});

describe('partIndexForChar', () => {
  it('maps a character offset to the token spoken there', () => {
    const parts = buildSegments(postcode, 'continuous', 'short')[0].parts;
    expect(partIndexForChar(parts, 0)).toBe(0);
    expect(partIndexForChar(parts, 12)).toBe(1); // inside "double you"
    expect(partIndexForChar(parts, 26)).toBe(5); // the pause part shares its offset with "oh"; the later part wins
    expect(partIndexForChar(parts, 99)).toBe(6);
  });
});

describe('gapWaitMs', () => {
  it('pause mode waits the full gap after the token ended', () => {
    expect(gapWaitMs({ gapMs: 300, mode: 'pause' }, 1, 1000, 1400)).toBe(300);
    expect(gapWaitMs({ gapMs: 300, mode: 'pause' }, 1.5, 1000, 1400)).toBe(450);
    expect(gapWaitMs({ gapMs: 0, mode: 'pause' }, 1, 1000, 1400)).toBe(0);
  });

  it('cadence mode measures from the token start and absorbs its audio', () => {
    expect(gapWaitMs({ gapMs: 600, mode: 'cadence' }, 1, 1000, 1400)).toBe(200);
    expect(gapWaitMs({ gapMs: 300, mode: 'cadence' }, 1, 1000, 1400)).toBe(0);
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
