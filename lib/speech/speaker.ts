/**
 * Timed utterance queue (§6.3). One SpeechSynthesisUtterance per token, driven token by
 * token with setTimeout so the gap is exact and cancelling is instant.
 *
 * Two timing modes:
 * - 'pause'   : wait gapMs of silence after a token has finished speaking.
 * - 'cadence' : start the next token gapMs after the previous token *started*, so the
 *               engine's start-up latency and the token's own audio are absorbed by the
 *               gap instead of being added on top of it. If the audio is longer than the
 *               gap the next token follows immediately.
 */
import type { SpeechToken, TimingMode } from '@/types';
import { speechAvailable } from './support';

export interface Timing {
  gapMs: number;
  mode: TimingMode;
}

export interface SpeakRequest {
  tokens: SpeechToken[];
  voice: SpeechSynthesisVoice | null;
  /** Used when no voice object is available. */
  lang: string;
  rate: number;
  /** Read before every gap so [ ] adjustments apply from the next token. */
  getTiming: () => Timing;
  /** A token started speaking (or a pause token began). `atMs` is relative to dictation start. */
  onTokenStart?: (index: number, atMs: number) => void;
  onTokenEnd?: (index: number, atMs: number) => void;
  /** A timed wait of `waitMs` began after token `index`. */
  onGap?: (index: number, waitMs: number) => void;
  onDone?: (atMs: number) => void;
}

/**
 * Chrome sometimes never fires `onend`; this bounds how long we wait for an utterance.
 * Roughly the expected spoken length plus a margin, so a stuck event does not stall the
 * dictation at more than about a second per token.
 */
export function fallbackTimeoutMs(text: string, rate = 1): number {
  return Math.max(1000, Math.round((300 + 150 * text.length) / Math.max(0.5, rate)));
}

/** How long to wait before the next token, given when the previous one started and ended. */
export function gapWaitMs(timing: Timing, multiplier: number, startedAtMs: number, endedAtMs: number): number {
  const gap = multiplier * timing.gapMs;
  if (timing.mode === 'cadence') return Math.max(0, startedAtMs + gap - endedAtMs);
  return gap;
}

export class Speaker {
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Kept referenced on purpose: Chrome drops callbacks of garbage-collected utterances. */
  private current: SpeechSynthesisUtterance | null = null;
  private startedAt = 0;
  private running = false;

  get active(): boolean {
    return this.running;
  }

  /** Milliseconds since the current (or last) dictation started. */
  now(): number {
    return typeof performance !== 'undefined' ? performance.now() - this.startedAt : 0;
  }

  speak(req: SpeakRequest): void {
    this.cancel();
    if (!speechAvailable()) return;
    const gen = ++this.generation;
    this.running = true;
    this.startedAt = performance.now();
    const { tokens } = req;
    const alive = () => gen === this.generation;
    const later = (fn: () => void, ms: number) => {
      this.timer = setTimeout(
        () => {
          if (alive()) fn();
        },
        Math.max(0, ms),
      );
    };

    /** Schedule the token after `index`, letting a following pause token replace the ordinary gap. */
    const scheduleNext = (index: number, startedAtMs: number, endedAtMs: number) => {
      const tok = tokens[index];
      const next = tokens[index + 1];
      let multiplier = tok.pauseAfter ?? 1;
      let nextIndex = index + 1;
      if (next?.silent) {
        req.onTokenStart?.(index + 1, this.now());
        multiplier = next.pauseAfter ?? 1;
        nextIndex = index + 2;
      }
      const wait = gapWaitMs(req.getTiming(), multiplier, startedAtMs, endedAtMs);
      req.onGap?.(index, wait);
      later(() => step(nextIndex), wait);
    };

    const step = (i: number): void => {
      if (!alive()) return;
      if (i >= tokens.length) {
        this.running = false;
        req.onDone?.(this.now());
        return;
      }
      const tok = tokens[i];

      if (tok.silent) {
        // Only reached when a pause token comes first; otherwise scheduleNext absorbs it.
        req.onTokenStart?.(i, this.now());
        const wait = (tok.pauseAfter ?? 1) * req.getTiming().gapMs;
        req.onGap?.(i, wait);
        later(() => step(i + 1), wait);
        return;
      }

      const u = new SpeechSynthesisUtterance(tok.text);
      if (req.voice) u.voice = req.voice;
      u.lang = req.voice?.lang || req.lang;
      u.rate = req.rate;
      u.pitch = 1;

      let startedAtMs = -1;
      let ended = false;
      const markStart = () => {
        if (startedAtMs >= 0 || !alive()) return;
        startedAtMs = this.now();
        req.onTokenStart?.(i, startedAtMs);
      };
      const finish = () => {
        if (ended || !alive()) return;
        ended = true;
        markStart();
        clearTimeout(startFallback);
        clearTimeout(endFallback);
        const endedAtMs = this.now();
        req.onTokenEnd?.(i, endedAtMs);
        scheduleNext(i, startedAtMs, endedAtMs);
      };
      u.onstart = markStart;
      u.onend = finish;
      u.onerror = (e: SpeechSynthesisErrorEvent) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        finish();
      };
      const startFallback = setTimeout(markStart, 400);
      const endFallback = setTimeout(finish, fallbackTimeoutMs(tok.text, req.rate));
      this.current = u;
      window.speechSynthesis.speak(u);
    };

    // Chrome can swallow an utterance queued in the same tick as cancel(); defer slightly.
    later(() => step(0), 40);
  }

  cancel(): void {
    this.generation++;
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.current = null;
    if (speechAvailable()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
  }
}
