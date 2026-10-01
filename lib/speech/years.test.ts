import { describe, expect, it } from 'vitest';
import { parseYears, spokenYears, twoDigitWords, yearToWords } from './years';

describe('yearToWords', () => {
  it('reads ordinary four-digit years in pairs', () => {
    expect(yearToWords(1848)).toBe('eighteen forty-eight');
    expect(yearToWords(3178)).toBe('thirty-one seventy-eight');
    expect(yearToWords(2511)).toBe('twenty-five eleven');
    expect(yearToWords(1066)).toBe('ten sixty-six');
    expect(yearToWords(2010)).toBe('twenty ten');
    expect(yearToWords(2026)).toBe('twenty twenty-six');
    expect(yearToWords(1999)).toBe('nineteen ninety-nine');
    expect(yearToWords(9999)).toBe('ninety-nine ninety-nine');
  });

  it('reads round hundreds and thousands', () => {
    expect(yearToWords(1800)).toBe('eighteen hundred');
    expect(yearToWords(1900)).toBe('nineteen hundred');
    expect(yearToWords(2100)).toBe('twenty-one hundred');
    expect(yearToWords(1000)).toBe('one thousand');
    expect(yearToWords(2000)).toBe('two thousand');
    expect(yearToWords(3000)).toBe('three thousand');
  });

  it('reads a zero in the tens place as "oh"', () => {
    expect(yearToWords(1905)).toBe('nineteen oh five');
    expect(yearToWords(1801)).toBe('eighteen oh one');
    expect(yearToWords(1109)).toBe('eleven oh nine');
  });

  it('reads the first years of a millennium with "thousand", British and American', () => {
    expect(yearToWords(2005)).toBe('two thousand and five');
    expect(yearToWords(2005, 'us')).toBe('two thousand five');
    expect(yearToWords(1001)).toBe('one thousand and one');
    expect(yearToWords(3009, 'us')).toBe('three thousand nine');
  });

  it('reads three-digit and shorter years', () => {
    expect(yearToWords(678)).toBe('six seventy-eight');
    expect(yearToWords(600)).toBe('six hundred');
    expect(yearToWords(605)).toBe('six oh five');
    expect(yearToWords(110)).toBe('one ten');
    expect(yearToWords(79)).toBe('seventy-nine');
    expect(yearToWords(7)).toBe('seven');
  });

  it('rejects values that are not years', () => {
    expect(() => yearToWords(0)).toThrow(RangeError);
    expect(() => yearToWords(10000)).toThrow(RangeError);
    expect(() => yearToWords(18.5)).toThrow(RangeError);
  });

  it('builds two-digit words', () => {
    expect(twoDigitWords(11)).toBe('eleven');
    expect(twoDigitWords(40)).toBe('forty');
    expect(twoDigitWords(48)).toBe('forty-eight');
  });
});

describe('spokenYears / parseYears', () => {
  it('joins a range with "to"', () => {
    expect(spokenYears('1941-1945')).toBe('nineteen forty-one to nineteen forty-five');
    expect(spokenYears('1899-1905')).toBe('eighteen ninety-nine to nineteen oh five');
    expect(spokenYears('1848')).toBe('eighteen forty-eight');
  });

  it('parses years and ranges and rejects anything else', () => {
    expect(parseYears('1848')).toEqual([1848]);
    expect(parseYears('678-702')).toEqual([678, 702]);
    expect(parseYears('SW1A')).toBeNull();
    expect(parseYears('1941-')).toBeNull();
    expect(parseYears('0')).toBeNull();
    expect(() => spokenYears('nineteen')).toThrow();
  });
});
