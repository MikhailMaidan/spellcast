import { describe, expect, it } from 'vitest';
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '../settings';
import { createItem, resolveContentType } from './index';
import { mulberry32 } from '../rng';

const settings: Settings = DEFAULT_SETTINGS;

describe('createItem', () => {
  it('is fully determined by seed, settings and column', () => {
    const a = createItem({ seed: 1234, settings, column: 'gb', now: 1 });
    const b = createItem({ seed: 1234, settings, column: 'gb', now: 2 });
    expect(a.target).toBe(b.target);
    expect(a.tokens).toEqual(b.tokens);
    expect(a.contentType).toBe(b.contentType);
  });

  it('changes with the seed', () => {
    const targets = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) targets.add(createItem({ seed, settings, now: 1 }).target);
    expect(targets.size).toBeGreaterThan(25);
  });

  it('draws mixed items only from the enabled types', () => {
    const only = { ...settings, contentType: 'mixed' as const, mixedTypes: ['usZip' as const] };
    for (let seed = 1; seed <= 20; seed++) expect(createItem({ seed, settings: only, now: 1 }).contentType).toBe('usZip');
    const rng = mulberry32(1);
    expect(resolveContentType({ contentType: 'surname', mixedTypes: [] }, rng)).toBe('surname');
  });

  it('adds one introductory phrase per settings', () => {
    const surname = { ...settings, contentType: 'surname' as const, announceType: true, readWholeFirst: true };
    const item = createItem({ seed: 7, settings: surname, now: 1 });
    expect(item.tokens[0]).toEqual({ text: 'The surname is', chars: '', minPauseAfterMs: 250 });
    expect(item.tokens[1]).toEqual({ text: `${item.target}.`, chars: '', rate: 0.8, minPauseAfterMs: 700 });
    expect(item.tokens[2].chars).not.toBe('');

    const postcode = { ...settings, contentType: 'ukPostcode' as const, announceType: true, readWholeFirst: true };
    const pc = createItem({ seed: 7, settings: postcode, now: 1 });
    expect(pc.tokens[0]).toEqual({ text: 'The postcode is', chars: '', minPauseAfterMs: 700 });
    expect(pc.tokens[1].chars).not.toBe('');

    const quiet = { ...settings, contentType: 'alnum' as const, announceType: false, readWholeFirst: false };
    expect(createItem({ seed: 7, settings: quiet, now: 1 }).tokens[0].chars).not.toBe('');
  });

  it('token chars concatenate to the target', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const item = createItem({ seed, settings, now: 1 });
      expect(item.tokens.map((t) => t.chars).join('')).toBe(item.target);
    }
  });

  it('speaks years as one English phrase standing for all the digits', () => {
    const years = { ...settings, contentType: 'year' as const, preset: 'hard' as const, announceType: true };
    let sawRange = false;
    let sawSingle = false;
    for (let seed = 1; seed <= 60; seed++) {
      const item = createItem({ seed, settings: years, now: 1 });
      expect(item.contentType).toBe('year');
      const isRange = item.target.includes('-');
      expect(item.tokens).toHaveLength(2);
      expect(item.tokens[0]).toEqual({ text: isRange ? 'The years are' : 'The year is', chars: '', minPauseAfterMs: 700 });
      expect(item.tokens[1].chars).toBe(item.target);
      expect(item.tokens[1].text).toMatch(isRange ? /^[a-z -]+ to [a-z -]+$/ : /^[a-z -]+$/);
      sawRange ||= isRange;
      sawSingle ||= !isRange;
    }
    expect(sawRange && sawSingle).toBe(true);

    const quiet = createItem({ seed: 5, settings: { ...years, announceType: false }, now: 1 });
    expect(quiet.tokens).toHaveLength(1);
    expect(quiet.tokens[0].chars).toBe(quiet.target);
  });

  it('sends plain upper-case letters by default', () => {
    const plain = { ...settings, contentType: 'surname' as const, announceType: false, readWholeFirst: false, grouping: 'never' as const };
    const item = createItem({ seed: 3, settings: plain, now: 1 });
    expect(item.tokens.map((t) => t.text).join('')).toBe(item.target.toUpperCase().replace(/[^A-Z]/g, (c) => (c === '-' ? '' : c)).replace(/'/g, ''));
  });

  it('uses the pronunciation column for Z in the spelled style', () => {
    const z = { ...settings, contentType: 'alnum' as const, announceType: false, letterStyle: 'spelled' as const, pronunciationOverrides: {} };
    let seed = 1;
    let item = createItem({ seed, settings: z, column: 'gb', now: 1 });
    while (!item.target.includes('Z') && seed < 500) item = createItem({ seed: ++seed, settings: z, column: 'gb', now: 1 });
    expect(item.target).toContain('Z');
    expect(item.tokens.some((t) => /zed/.test(t.text))).toBe(true);
    const us = createItem({ seed, settings: z, column: 'us', now: 1 });
    expect(us.tokens.some((t) => /zee/.test(t.text))).toBe(true);
  });
});
