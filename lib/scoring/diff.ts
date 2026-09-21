/** Character-level diff of typed vs target using a Levenshtein alignment (§9.1). */

export type DiffOpType = 'correct' | 'wrong' | 'missing' | 'extra';

export interface DiffOp {
  type: DiffOpType;
  /** Target character (null for "extra"). */
  expected: string | null;
  /** Typed character (null for "missing"). */
  typed: string | null;
  /** Index into the normalised target (null for "extra"). */
  targetIndex: number | null;
}

export interface DiffResult {
  ops: DiffOp[];
  normalisedTarget: string;
  normalisedTyped: string;
  correctCount: number;
  /** Wrong + missing + extra. */
  errors: number;
  /** correctCount / target length, 0..1. */
  charAccuracy: number;
  /** Exact match after normalisation. */
  correct: boolean;
}

export interface DiffOptions {
  ignoreSpaces: boolean;
}

/** Upper-case; drop all whitespace when spaces are ignored, otherwise collapse runs to one. */
export function normaliseForScoring(s: string, ignoreSpaces: boolean): string {
  const upper = s.toUpperCase();
  return ignoreSpaces ? upper.replace(/\s+/g, '') : upper.trim().replace(/\s+/g, ' ');
}

export function diffStrings(target: string, typed: string, opts: DiffOptions): DiffResult {
  const a = normaliseForScoring(target, opts.ignoreSpaces);
  const b = normaliseForScoring(typed, opts.ignoreSpaces);
  const n = a.length;
  const m = b.length;

  // dp[i][j] = edit distance between a[0..i) and b[0..j)
  const dp: number[][] = [];
  for (let i = 0; i <= n; i++) {
    dp.push(new Array<number>(m + 1).fill(0));
    dp[i][0] = i;
  }
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      dp[i][j] = Math.min(sub, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }

  // Backtrace, preferring substitution/match over a delete+insert pair.
  const ops: DiffOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      ops.push({
        type: a[i - 1] === b[j - 1] ? 'correct' : 'wrong',
        expected: a[i - 1],
        typed: b[j - 1],
        targetIndex: i - 1,
      });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ type: 'missing', expected: a[i - 1], typed: null, targetIndex: i - 1 });
      i--;
    } else {
      ops.push({ type: 'extra', expected: null, typed: b[j - 1], targetIndex: null });
      j--;
    }
  }
  ops.reverse();

  const correctCount = ops.filter((o) => o.type === 'correct').length;
  const errors = ops.length - correctCount;
  return {
    ops,
    normalisedTarget: a,
    normalisedTyped: b,
    correctCount,
    errors,
    charAccuracy: n === 0 ? (m === 0 ? 1 : 0) : correctCount / n,
    correct: a === b,
  };
}
