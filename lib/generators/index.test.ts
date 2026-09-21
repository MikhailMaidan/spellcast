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

  it('adds announcement and whole-word tokens per settings', () => {
    const surname = { ...settings, contentType: 'surname' as const, announceType: true, readWholeFirst: true };
    const item = createItem({ seed: 7, settings: surname, now: 1 });
    expect(item.tokens[0]).toEqual({ text: 'surname', chars: '' });
    expect(item.tokens[1].text).toBe(item.target);
    expect(item.tokens[2].text).toBe("that's");

    const postcode = { ...settings, contentType: 'ukPostcode' as const, announceType: true, readWholeFirst: true };
    const pc = createItem({ seed: 7, settings: postcode, now: 1 });
    expect(pc.tokens[0]).toEqual({ text: 'postcode', chars: '' });
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

  it('uses the pronunciation column for Z', () => {
    const z = { ...settings, contentType: 'alnum' as const, announceType: false, pronunciationOverrides: {} };
    let seed = 1;
    let item = createItem({ seed, settings: z, column: 'gb', now: 1 });
    while (!item.target.includes('Z') && seed < 500) item = createItem({ seed: ++seed, settings: z, column: 'gb', now: 1 });
    expect(item.target).toContain('Z');
    expect(item.tokens.some((t) => /zed/.test(t.text))).toBe(true);
    const us = createItem({ seed, settings: z, column: 'us', now: 1 });
    expect(us.tokens.some((t) => /zee/.test(t.text))).toBe(true);
  });
});
