/** Keystroke lag analysis (§7.2 "within the window") and session statistics (§9.3). */
import type { ConcreteContentType, Session, SpeechToken } from '@/types';
import { diffStrings } from './diff';

export interface TokenSpan {
  /** Offset into the normalised target. */
  start: number;
  length: number;
}

/** How many scored characters a token's `chars` contribute. */
export function tokenCharLength(chars: string, ignoreSpaces: boolean): number {
  return ignoreSpaces ? chars.replace(/\s+/g, '').length : chars.length;
}

/** Where each token's characters sit in the normalised target. */
export function tokenCharSpans(tokens: SpeechToken[], ignoreSpaces: boolean): TokenSpan[] {
  let offset = 0;
  return tokens.map((t) => {
    const length = tokenCharLength(t.chars, ignoreSpaces);
    const span = { start: offset, length };
    offset += length;
    return span;
  });
}

/** Index of the token that owns normalised position `pos`, or -1. */
export function tokenIndexForPosition(spans: TokenSpan[], pos: number): number {
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    if (s.length > 0 && pos >= s.start && pos < s.start + s.length) return i;
  }
  return -1;
}

export interface KeystrokeAnalysis {
  time: number;
  tokenIndex: number;
  /** Time by which the keystroke should have landed (null = no constraint known). */
  deadline: number | null;
  lagged: boolean;
}

export interface LagAnalysis {
  keystrokes: KeystrokeAnalysis[];
  lagged: boolean;
}

export interface LagInput {
  tokens: SpeechToken[];
  keystrokeTimes: number[];
  keystrokeChars: string[];
  tokenStartTimes: (number | null)[];
  dictationEndedAt: number;
  gapMs: number;
  ignoreSpaces: boolean;
}

function nextSpokenIndex(tokens: SpeechToken[], from: number): number {
  for (let j = from + 1; j < tokens.length; j++) {
    const t = tokens[j];
    if (!t.silent && t.chars !== '') return j;
  }
  return -1;
}

/**
 * A keystroke is "within the window" when it lands before the next spoken token starts.
 * For the last token the window closes one gap after dictation ends.
 */
export function analyseKeystrokes(input: LagInput): LagAnalysis {
  const spans = tokenCharSpans(input.tokens, input.ignoreSpaces);
  const keystrokes: KeystrokeAnalysis[] = [];
  let pos = 0;
  for (let k = 0; k < input.keystrokeTimes.length; k++) {
    const time = input.keystrokeTimes[k];
    const ch = input.keystrokeChars[k] ?? '';
    if (input.ignoreSpaces && /^\s$/.test(ch)) {
      keystrokes.push({ time, tokenIndex: -1, deadline: null, lagged: false });
      continue;
    }
    const tokenIndex = tokenIndexForPosition(spans, pos);
    pos++;
    let deadline: number | null = null;
    if (tokenIndex >= 0) {
      const next = nextSpokenIndex(input.tokens, tokenIndex);
      if (next === -1) deadline = input.dictationEndedAt + input.gapMs;
      else deadline = input.tokenStartTimes[next] ?? null;
    }
    keystrokes.push({ time, tokenIndex, deadline, lagged: deadline !== null && time > deadline });
  }
  return { keystrokes, lagged: keystrokes.some((k) => k.lagged) };
}

export interface ErrorCount {
  key: string;
  errors: number;
  total: number;
}

export interface TypeStats {
  type: ConcreteContentType;
  attempted: number;
  correct: number;
}

export interface SessionStats {
  attempted: number;
  correct: number;
  /** 0..1 over items. */
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  replays: number;
  lagged: number;
  /** Gap used for each attempt, in order. */
  gapTrajectory: number[];
  perType: TypeStats[];
  /** Characters most often wrong or missing. */
  charErrors: ErrorCount[];
  /** Spoken tokens most often wrong or missing. */
  tokenErrors: ErrorCount[];
}

function bump(map: Map<string, ErrorCount>, key: string, field: 'errors' | 'total'): void {
  const entry = map.get(key) ?? { key, errors: 0, total: 0 };
  entry[field] += 1;
  map.set(key, entry);
}

export function computeSessionStats(session: Session, ignoreSpaces: boolean): SessionStats {
  const attempts = session.attempts;
  let correct = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  let replays = 0;
  let lagged = 0;
  const perType = new Map<ConcreteContentType, TypeStats>();
  const charMap = new Map<string, ErrorCount>();
  const tokenMap = new Map<string, ErrorCount>();

  for (const a of attempts) {
    if (a.correct) {
      correct++;
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
    replays += a.replays;
    if (a.lagged) lagged++;

    const t = perType.get(a.item.contentType) ?? { type: a.item.contentType, attempted: 0, correct: 0 };
    t.attempted++;
    if (a.correct) t.correct++;
    perType.set(a.item.contentType, t);

    const diff = diffStrings(a.item.target, a.typed, { ignoreSpaces });
    const spans = tokenCharSpans(a.item.tokens, ignoreSpaces);
    for (let i = 0; i < diff.normalisedTarget.length; i++) {
      bump(charMap, diff.normalisedTarget[i], 'total');
      const ti = tokenIndexForPosition(spans, i);
      if (ti >= 0) bump(tokenMap, a.item.tokens[ti].text, 'total');
    }
    for (const op of diff.ops) {
      if ((op.type !== 'wrong' && op.type !== 'missing') || op.targetIndex === null) continue;
      bump(charMap, diff.normalisedTarget[op.targetIndex], 'errors');
      const ti = tokenIndexForPosition(spans, op.targetIndex);
      if (ti >= 0) bump(tokenMap, a.item.tokens[ti].text, 'errors');
    }
  }

  const byErrors = (a: ErrorCount, b: ErrorCount) => b.errors - a.errors || b.total - a.total || a.key.localeCompare(b.key);
  return {
    attempted: attempts.length,
    correct,
    accuracy: attempts.length ? correct / attempts.length : 0,
    currentStreak,
    bestStreak,
    replays,
    lagged,
    gapTrajectory: attempts.map((a) => a.gapMs),
    perType: [...perType.values()],
    charErrors: [...charMap.values()].filter((e) => e.errors > 0).sort(byErrors),
    tokenErrors: [...tokenMap.values()].filter((e) => e.errors > 0).sort(byErrors),
  };
}
