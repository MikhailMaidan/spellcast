/**
 * Utterance queue (§6.3) with two delivery modes.
 *
 * 'token'      : one SpeechSynthesisUtterance per token, driven token by token with
 *                setTimeout so the gap is exact and cancelling is instant. Every
 *                utterance pays the engine's start-up latency, which is measured and
 *                subtracted from the scheduled wait so the configured gap is close to
 *                the silence actually heard.
 * 'continuous' : the whole spelling is one utterance ("ess, double you, one, ay")
 *                at the voice's natural pace - no per-letter latency at all. Token
 *                progress comes from word-boundary events when the voice provides
 *                them, otherwise from a learned characters-per-second estimate.
 *
 * Timing modes for the gaps between utterances:
 * - 'pause'   : gapMs of silence after an utterance has finished.
 * - 'cadence' : the next utterance starts gapMs after the previous one *started*.
 */
import type { ContinuousPause, DeliveryMode, SpeechToken, TimingMode } from '@/types';
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
  delivery?: DeliveryMode;
  continuousPause?: ContinuousPause;
  /** Read before every gap so [ ] adjustments apply from the next utterance. */
  getTiming: () => Timing;
  /** A token started (or is estimated to have started). `atMs` is relative to dictation start. */
  onTokenStart?: (index: number, atMs: number) => void;
  onTokenEnd?: (index: number, atMs: number) => void;
  /** A timed wait of `waitMs` began after token `index`. */
  onGap?: (index: number, waitMs: number) => void;
  onDone?: (atMs: number) => void;
}

export interface SpeakerDiagnostics {
  /** Measured delay between speak() and the audio starting, smoothed. */
  startLatencyMs: number | null;
  /** Measured speaking speed normalised to rate 1, smoothed. */
  msPerCharAtRate1: number | null;
}

/** Separator between spelling tokens in continuous delivery. */
export const CONTINUOUS_SEPARATORS: Record<ContinuousPause, string> = { none: ' ', short: ', ', long: '. ' };
/** Separator used where the target has a space (postcode halves). */
const SPACE_SEPARATOR = '. ';
/** Keep utterances short: Chrome cuts off long ones. */
const MAX_SEGMENT_CHARS = 120;
const DEFAULT_MS_PER_CHAR = 70;

export interface SegmentPart {
  /** Token index this part speaks. */
  token: number;
  /** Character offset of the token's text inside the segment text. */
  offset: number;
}

/** One utterance to speak. */
export interface Segment {
  text: string;
  parts: SegmentPart[];
  /** Multiplier of gapMs for the wait after this utterance. */
  pauseAfter: number;
  /** Multiplier of the speech rate for this utterance. */
  rateFactor: number;
  /** Pause-only segment (a pause token with nothing before it). */
  silent?: boolean;
  /** Index of the pause token whose pause follows this segment, for display. */
  pauseToken?: number;
}

/** Group tokens into utterances according to the delivery mode. */
export function buildSegments(tokens: SpeechToken[], delivery: DeliveryMode, pause: ContinuousPause): Segment[] {
  const segments: Segment[] = [];
  const attachPause = (tokenIndex: number, multiplier: number) => {
    const prev = segments[segments.length - 1];
    if (prev && !prev.silent) {
      prev.pauseAfter = multiplier;
      prev.pauseToken = tokenIndex;
    } else {
      segments.push({ text: '', parts: [], pauseAfter: multiplier, rateFactor: 1, silent: true, pauseToken: tokenIndex });
    }
  };

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.silent) {
      attachPause(i, tok.pauseAfter ?? 1);
      i++;
      continue;
    }
    if (delivery === 'continuous' && tok.chars !== '') {
      const parts: SegmentPart[] = [];
      let text = '';
      let pauseAfter = 1;
      let j = i;
      while (j < tokens.length) {
        const t = tokens[j];
        if (t.silent) {
          // A space inside the spelling becomes a sentence-style pause inside the same utterance,
          // as long as spelling continues after it.
          const next = tokens[j + 1];
          if (parts.length === 0 || !next || next.silent || next.chars === '') break;
          text = text.trimEnd() + SPACE_SEPARATOR;
          parts.push({ token: j, offset: text.length });
          j++;
          continue;
        }
        if (t.chars === '') break;
        if (parts.length && text.length + t.text.length > MAX_SEGMENT_CHARS) break;
        if (parts.length && !text.endsWith(' ')) text += CONTINUOUS_SEPARATORS[pause];
        parts.push({ token: j, offset: text.length });
        text += t.text;
        pauseAfter = t.pauseAfter ?? 1;
        j++;
      }
      segments.push({ text, parts, pauseAfter, rateFactor: 1 });
      i = j;
      continue;
    }
    segments.push({ text: tok.text, parts: [{ token: i, offset: 0 }], pauseAfter: tok.pauseAfter ?? 1, rateFactor: tok.rateFactor ?? 1 });
    i++;
  }
  return segments;
}

/** Index of the last part whose text starts at or before `charIndex`, or -1. */
export function partIndexForChar(parts: SegmentPart[], charIndex: number): number {
  let k = -1;
  for (let p = 0; p < parts.length; p++) {
    if (parts[p].offset <= charIndex) k = p;
    else break;
  }
  return k;
}

/**
 * Chrome sometimes never fires `onend`; this bounds how long we wait for an utterance.
 * Roughly the expected spoken length plus a margin.
 */
export function fallbackTimeoutMs(text: string, rate = 1): number {
  return Math.max(1000, Math.round((300 + 150 * text.length) / Math.max(0.5, rate)));
}

/** How long to wait before the next utterance, given when the previous one started and ended. */
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
  private latencyMs: number | null = null;
  private msPerChar: number | null = null;

  get active(): boolean {
    return this.running;
  }

  get diagnostics(): SpeakerDiagnostics {
    return { startLatencyMs: this.latencyMs, msPerCharAtRate1: this.msPerChar };
  }

  /** Milliseconds since the current (or last) dictation started. */
  now(): number {
    return typeof performance !== 'undefined' ? performance.now() - this.startedAt : 0;
  }

  private noteLatency(sample: number): void {
    if (sample < 0 || sample > 5000) return;
    this.latencyMs = this.latencyMs === null ? sample : this.latencyMs * 0.7 + sample * 0.3;
  }

  private noteDuration(chars: number, durationMs: number, rate: number): void {
    if (chars < 4 || durationMs <= 0) return;
    const perChar = (durationMs / chars) * rate;
    this.msPerChar = this.msPerChar === null ? perChar : this.msPerChar * 0.7 + perChar * 0.3;
  }

  speak(req: SpeakRequest): void {
    this.cancel();
    if (!speechAvailable()) return;
    const gen = ++this.generation;
    this.running = true;
    this.startedAt = performance.now();
    const segments = buildSegments(req.tokens, req.delivery ?? 'token', req.continuousPause ?? 'short');
    const alive = () => gen === this.generation;
    const later = (fn: () => void, ms: number) => {
      this.timer = setTimeout(
        () => {
          if (alive()) fn();
        },
        Math.max(0, ms),
      );
    };

    const scheduleNext = (si: number, startedAtMs: number, endedAtMs: number) => {
      const seg = segments[si];
      if (si + 1 >= segments.length) {
        // Nothing follows the last utterance: report done at once, the trainer owns the closing window.
        step(si + 1);
        return;
      }
      if (seg.pauseToken !== undefined) req.onTokenStart?.(seg.pauseToken, this.now());
      const wanted = gapWaitMs(req.getTiming(), seg.pauseAfter, startedAtMs, endedAtMs);
      // Call speak() early by the engine's measured start latency so the heard silence matches.
      const wait = Math.max(0, wanted - (this.latencyMs ?? 0));
      const lastToken = seg.parts.length ? seg.parts[seg.parts.length - 1].token : (seg.pauseToken ?? 0);
      req.onGap?.(lastToken, wait);
      later(() => step(si + 1), wait);
    };

    const step = (si: number): void => {
      if (!alive()) return;
      if (si >= segments.length) {
        this.running = false;
        req.onDone?.(this.now());
        return;
      }
      const seg = segments[si];

      if (seg.silent) {
        req.onTokenStart?.(seg.pauseToken ?? 0, this.now());
        const wait = seg.pauseAfter * req.getTiming().gapMs;
        req.onGap?.(seg.pauseToken ?? 0, wait);
        later(() => step(si + 1), wait);
        return;
      }

      const u = new SpeechSynthesisUtterance(seg.text);
      const rate = Math.min(10, Math.max(0.1, req.rate * seg.rateFactor));
      if (req.voice) u.voice = req.voice;
      u.lang = req.voice?.lang || req.lang;
      u.rate = rate;
      u.pitch = 1;

      const spokenAt = this.now();
      let startedAtMs = -1;
      let ended = false;
      let boundariesSeen = false;
      const startedParts = new Set<number>();
      const estimateTimers: ReturnType<typeof setTimeout>[] = [];

      const fireUpTo = (k: number, t: number) => {
        for (let p = 0; p <= k && p < seg.parts.length; p++) {
          if (startedParts.has(p)) continue;
          startedParts.add(p);
          req.onTokenStart?.(seg.parts[p].token, t);
        }
      };
      const clearEstimates = () => {
        estimateTimers.forEach(clearTimeout);
        estimateTimers.length = 0;
      };
      const markStart = () => {
        if (startedAtMs >= 0 || !alive()) return;
        startedAtMs = this.now();
        this.noteLatency(startedAtMs - spokenAt);
        fireUpTo(0, startedAtMs);
        // Without boundary events, estimate when each later token starts from the learned pace.
        const perChar = (this.msPerChar ?? DEFAULT_MS_PER_CHAR) / Math.max(0.5, rate);
        for (let p = 1; p < seg.parts.length; p++) {
          const at = seg.parts[p].offset * perChar;
          estimateTimers.push(
            setTimeout(() => {
              if (alive() && !boundariesSeen && !ended) fireUpTo(p, this.now());
            }, at),
          );
        }
      };
      const finish = () => {
        if (ended || !alive()) return;
        ended = true;
        markStart();
        clearTimeout(startFallback);
        clearTimeout(endFallback);
        clearEstimates();
        const endedAtMs = this.now();
        this.noteDuration(seg.text.length, endedAtMs - startedAtMs, rate);
        fireUpTo(seg.parts.length - 1, endedAtMs);
        req.onTokenEnd?.(seg.parts[seg.parts.length - 1].token, endedAtMs);
        scheduleNext(si, startedAtMs, endedAtMs);
      };

      u.onstart = markStart;
      u.onend = finish;
      u.onerror = (e: SpeechSynthesisErrorEvent) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        finish();
      };
      u.onboundary = (e: SpeechSynthesisEvent) => {
        if (!alive() || ended) return;
        markStart();
        if (!boundariesSeen) {
          boundariesSeen = true;
          clearEstimates();
        }
        const k = partIndexForChar(seg.parts, e.charIndex);
        if (k >= 0) fireUpTo(k, this.now());
      };
      // Network voices can take well over half a second to start; only give up on `onstart` late.
      const startFallback = setTimeout(markStart, 1500);
      const endFallback = setTimeout(finish, fallbackTimeoutMs(seg.text, rate));
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
