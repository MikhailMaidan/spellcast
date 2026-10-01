/**
 * How years are read aloud in English. Years are spoken in pairs, not digit by digit:
 *
 *   1848 -> "eighteen forty-eight"      1800 -> "eighteen hundred"
 *   1905 -> "nineteen oh five"          2000 -> "two thousand"
 *   2005 -> "two thousand and five" (British) / "two thousand five" (American)
 *   2010 -> "twenty ten"                 678 -> "six seventy-eight"
 *   3178 -> "thirty-one seventy-eight"  1941-1945 -> "nineteen forty-one to nineteen forty-five"
 */
import type { PronunciationColumn } from '@/types';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export const YEAR_MIN = 1;
export const YEAR_MAX = 9999;

/** 0..99 as words: "seven", "eleven", "forty", "forty-eight". */
export function twoDigitWords(n: number): string {
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens];
}

/** A year (1..9999) the way it is said in English. */
export function yearToWords(year: number, column: PronunciationColumn = 'gb'): string {
  if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) {
    throw new RangeError(`year out of range: ${year}`);
  }
  if (year < 100) return twoDigitWords(year);

  const high = Math.floor(year / 100);
  const low = year % 100;

  if (year < 1000) {
    // Three digits: "six hundred", "six oh five", "six seventy-eight".
    if (low === 0) return `${ONES[high]} hundred`;
    if (low < 10) return `${ONES[high]} oh ${ONES[low]}`;
    return `${ONES[high]} ${twoDigitWords(low)}`;
  }

  if (year % 1000 === 0) return `${ONES[year / 1000]} thousand`;
  if (low === 0) return `${twoDigitWords(high)} hundred`;
  if (low < 10) {
    // 2005 is "two thousand and five"; 1905 is "nineteen oh five".
    if (high % 10 === 0) {
      const thousands = ONES[high / 10];
      return column === 'us' ? `${thousands} thousand ${ONES[low]}` : `${thousands} thousand and ${ONES[low]}`;
    }
    return `${twoDigitWords(high)} oh ${ONES[low]}`;
  }
  return `${twoDigitWords(high)} ${twoDigitWords(low)}`;
}

/** "1848" -> [1848]; "1941-1945" -> [1941, 1945]; null when the string is neither. */
export function parseYears(target: string): number[] | null {
  const m = /^(\d{1,4})(?:-(\d{1,4}))?$/.exec(target.trim());
  if (!m) return null;
  const years = [Number(m[1])];
  if (m[2] !== undefined) years.push(Number(m[2]));
  return years.every((y) => y >= YEAR_MIN && y <= YEAR_MAX) ? years : null;
}

/** The spoken form of a year or a year range ("… to …"). */
export function spokenYears(target: string, column: PronunciationColumn = 'gb'): string {
  const years = parseYears(target);
  if (!years) throw new Error(`not a year or a year range: ${target}`);
  return years.map((y) => yearToWords(y, column)).join(' to ');
}
