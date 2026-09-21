/**
 * Timed utterance queue (§6.3). One SpeechSynthesisUtterance per token, driven token by
 * token with setTimeout so the gap is exact and cancelling is instant.
 */
import type { SpeechToken } from '@/types';
import { speechAvailable } from './support';

export interface SpeakRequest {
  tokens: SpeechToken[];
  voice: SpeechSynthesisVoice | null;
  /** Used when no voice object is available. */
  lang: string;
  rate: number;
  /** Read for every gap so [ ] adjustments apply from the next token. */
  getGapMs: () => number;
  /** A token started speaking (or a pause token began). `atMs` is relative to dictation start. */
  onTokenStart?: (index: number, atMs: number) => void;
  onTokenEnd?: (index: number, atMs: number) => void;
  /** A timed gap of `waitMs` began after token `index`. */
  onGap?: (index: number, waitMs: number) => void;
  onDone?: (atMs: number) => void;
}

/** Chrome sometimes never fires `onend`; this bounds how long we wait for an utterance. */
export function fallbackTimeoutMs(text: string): number {
  return Math.max(1500, 400 * text.length);
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
      this.timer = setTimeout(() => {
        if (alive()) fn();
      }, ms);
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
        req.onTokenStart?.(i, this.now());
        const wait = (tok.pauseAfter ?? 1) * req.getGapMs();
        req.onGap?.(i, wait);
        later(() => step(i + 1), wait);
        return;
      }

      const u = new SpeechSynthesisUtterance(tok.text);
      if (req.voice) u.voice = req.voice;
      u.lang = req.voice?.lang || req.lang;
      u.rate = req.rate;
      u.pitch = 1;

      let started = false;
      let ended = false;
      const markStart = () => {
        if (started || !alive()) return;
        started = true;
        req.onTokenStart?.(i, this.now());
      };
      const finish = () => {
        if (ended || !alive()) return;
        ended = true;
        markStart();
        clearTimeout(startFallback);
        clearTimeout(endFallback);
        req.onTokenEnd?.(i, this.now());
        const next = tokens[i + 1];
        if (next?.silent) {
          // The pause token supplies its own (longer) gap.
          step(i + 1);
          return;
        }
        const wait = (tok.pauseAfter ?? 1) * req.getGapMs();
        req.onGap?.(i, wait);
        later(() => step(i + 1), wait);
      };
      u.onstart = markStart;
      u.onend = finish;
      u.onerror = (e: SpeechSynthesisErrorEvent) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        finish();
      };
      const startFallback = setTimeout(markStart, 400);
      const endFallback = setTimeout(finish, fallbackTimeoutMs(tok.text));
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
