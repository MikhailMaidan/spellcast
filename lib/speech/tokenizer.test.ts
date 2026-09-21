import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import { introText, spokenSummary, tokenize } from './tokenizer';

const plain = (tokens: { text: string; chars: string }[]) => tokens.map(({ text, chars }) => ({ text, chars }));

describe('tokenize', () => {
  it('reproduces the specification example', () => {
    const tokens = tokenize('SW1A 0AA', { grouping: 'always', zeroStyle: 'oh' });
    expect(plain(tokens)).toEqual([
      { text: 'ess', chars: 'S' },
      { text: 'double you', chars: 'W' },
      { text: 'one', chars: '1' },
      { text: 'ay', chars: 'A' },
      { text: '<pause 1.5x>', chars: ' ' },
      { text: 'oh', chars: '0' },
      { text: 'double ay', chars: 'AA' },
    ]);
    expect(tokens[4].silent).toBe(true);
    expect(tokens[4].pauseAfter).toBe(1.5);
  });

  it('never groups when grouping is "never"', () => {
    const tokens = tokenize('SW1A 0AA', { grouping: 'never', zeroStyle: 'oh' });
    expect(plain(tokens).slice(-2)).toEqual([
      { text: 'ay', chars: 'A' },
      { text: 'ay', chars: 'A' },
    ]);
  });

  it('flips a seeded coin when grouping is "random"', () => {
    const forms = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const tokens = tokenize('AA', { grouping: 'random', zeroStyle: 'oh', rng: mulberry32(seed) });
      forms.add(tokens.map((t) => t.text).join('|'));
    }
    expect(forms).toEqual(new Set(['double ay', 'ay|ay']));
    const a = tokenize('AA', { grouping: 'random', zeroStyle: 'oh', rng: mulberry32(3) });
    const b = tokenize('AA', { grouping: 'random', zeroStyle: 'oh', rng: mulberry32(3) });
    expect(a).toEqual(b);
  });

  it('handles triples and splits longer runs', () => {
    expect(plain(tokenize('B777', { grouping: 'always', zeroStyle: 'oh' }))).toEqual([
      { text: 'bee', chars: 'B' },
      { text: 'triple seven', chars: '777' },
    ]);
    expect(plain(tokenize('AAAA', { grouping: 'always', zeroStyle: 'oh' }))).toEqual([
      { text: 'triple ay', chars: 'AAA' },
      { text: 'ay', chars: 'A' },
    ]);
  });

  it('groups letters case-insensitively but keeps the original chars', () => {
    expect(plain(tokenize('Bell', { grouping: 'always', zeroStyle: 'oh' }))).toEqual([
      { text: 'bee', chars: 'B' },
      { text: 'ee', chars: 'e' },
      { text: 'double el', chars: 'll' },
    ]);
  });

  it('speaks separators', () => {
    const tokens = tokenize("O'K-1/2", { grouping: 'never', zeroStyle: 'oh', rng: mulberry32(1) });
    expect(tokens.map((t) => t.text)).toEqual(['oh', 'apostrophe', 'kay', expect.stringMatching(/^(dash|hyphen)$/), 'one', 'slash', 'two']);
  });

  it('follows zeroStyle and the pronunciation column', () => {
    expect(tokenize('0', { grouping: 'never', zeroStyle: 'zero' })[0].text).toBe('zero');
    expect(tokenize('0', { grouping: 'never', zeroStyle: 'oh' })[0].text).toBe('oh');
    expect(['oh', 'zero']).toContain(tokenize('0', { grouping: 'never', zeroStyle: 'random', rng: mulberry32(2) })[0].text);
    expect(tokenize('Z', { grouping: 'never', zeroStyle: 'oh', column: 'gb' })[0].text).toBe('zed');
    expect(tokenize('Z', { grouping: 'never', zeroStyle: 'oh', column: 'us' })[0].text).toBe('zee');
  });

  it('applies pronunciation overrides, including inside groups', () => {
    const tokens = tokenize('LL', { grouping: 'always', zeroStyle: 'oh', overrides: { 'gb:L': 'ell' } });
    expect(tokens[0].text).toBe('double ell');
    const single = tokenize('L', { grouping: 'always', zeroStyle: 'oh', column: 'us', overrides: { 'gb:L': 'ell' } });
    expect(single[0].text).toBe('el');
  });

  it('prefixes a single introductory phrase', () => {
    const tokens = tokenize('Bell', { grouping: 'always', zeroStyle: 'oh', announce: 'The surname is', readWholeFirst: true });
    expect(tokens[0]).toEqual({ text: "The surname is Bell, that's", chars: '' });
    expect(tokens[1].text).toBe('bee');
    expect(tokenize('Bell', { grouping: 'always', zeroStyle: 'oh', announce: 'The surname is' })[0]).toEqual({ text: 'The surname is', chars: '' });
    expect(tokenize('Bell', { grouping: 'always', zeroStyle: 'oh', readWholeFirst: true })[0]).toEqual({ text: "Bell, that's", chars: '' });
    expect(tokenize('Bell', { grouping: 'always', zeroStyle: 'oh' })[0].chars).toBe('B');
    expect(introText('Bell')).toBeNull();
  });

  it('sends plain letters when asked, keeping digits, symbols and overrides', () => {
    const tokens = tokenize("Bell-7", { grouping: 'always', zeroStyle: 'oh', letterStyle: 'plain', rng: mulberry32(1) });
    expect(tokens.map((t) => t.text)).toEqual(['B', 'E', 'double L', expect.stringMatching(/^(dash|hyphen)$/), 'seven']);
    const overridden = tokenize('A', { grouping: 'never', zeroStyle: 'oh', letterStyle: 'plain', overrides: { 'gb:A': 'ay' } });
    expect(overridden[0].text).toBe('ay');
  });

  it('summarises the spelling tokens only', () => {
    const tokens = tokenize('SW1A 0AA', { grouping: 'always', zeroStyle: 'oh', announce: 'The postcode is' });
    expect(spokenSummary(tokens)).toBe('ess · double you · one · ay · oh · double ay');
  });

  it('concatenated token chars rebuild the target', () => {
    for (const target of ['SW1A 0AA', 'Wojciechowski', '90210-1234', 'DDD/LLL-DD']) {
      const tokens = tokenize(target, { grouping: 'random', zeroStyle: 'random', rng: mulberry32(8) });
      expect(tokens.map((t) => t.chars).join('')).toBe(target);
    }
  });
});
