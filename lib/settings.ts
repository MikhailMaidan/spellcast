import {
  CONCRETE_CONTENT_TYPES,
  CONTENT_TYPES,
  LOCALES,
  PRESETS,
  type ConcreteContentType,
  type Settings,
} from '@/types';
import { clampGap, GAP_DEFAULT } from './scoring/adaptive';

/** SpeechSynthesisUtterance.rate range exposed in settings. */
export const RATE_MIN = 0.5;
export const RATE_MAX = 2;
export const RATE_STEP = 0.05;

export const DEFAULT_SETTINGS: Settings = {
  contentType: 'mixed',
  mixedTypes: [...CONCRETE_CONTENT_TYPES],
  preset: 'medium',
  surnameFlavour: 'both',
  gapMs: GAP_DEFAULT,
  timingMode: 'pause',
  adaptive: true,
  autoSubmitSilenceMs: 1500,
  grouping: 'random',
  zeroStyle: 'random',
  voiceURI: null,
  locale: 'en-GB',
  randomAccent: false,
  rate: 1,
  announceType: true,
  readWholeFirst: true,
  allowReplay: true,
  liveFeedback: false,
  caseSensitive: false,
  ignoreSpaces: true,
  ding: false,
  pronunciationOverrides: {},
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function num(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Merge whatever was persisted with the defaults, validating every field. */
export function sanitiseSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;

  const mixed = Array.isArray(r.mixedTypes)
    ? CONCRETE_CONTENT_TYPES.filter((t) => (r.mixedTypes as unknown[]).includes(t))
    : d.mixedTypes;

  const overrides: Record<string, string> = {};
  if (r.pronunciationOverrides && typeof r.pronunciationOverrides === 'object') {
    for (const [k, v] of Object.entries(r.pronunciationOverrides as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) overrides[k] = v.trim();
    }
  }

  return {
    contentType: oneOf(r.contentType, CONTENT_TYPES, d.contentType),
    mixedTypes: mixed.length ? (mixed as ConcreteContentType[]) : [...d.mixedTypes],
    preset: oneOf(r.preset, PRESETS, d.preset),
    surnameFlavour: oneOf(r.surnameFlavour, ['british', 'american', 'both'] as const, d.surnameFlavour),
    gapMs: clampGap(num(r.gapMs, 0, 10000, d.gapMs)),
    timingMode: oneOf(r.timingMode, ['pause', 'cadence'] as const, d.timingMode),
    adaptive: bool(r.adaptive, d.adaptive),
    autoSubmitSilenceMs: num(r.autoSubmitSilenceMs, 500, 3000, d.autoSubmitSilenceMs),
    grouping: oneOf(r.grouping, ['never', 'always', 'random'] as const, d.grouping),
    zeroStyle: oneOf(r.zeroStyle, ['oh', 'zero', 'random'] as const, d.zeroStyle),
    voiceURI: typeof r.voiceURI === 'string' && r.voiceURI ? r.voiceURI : null,
    locale: oneOf(r.locale, LOCALES, d.locale),
    randomAccent: bool(r.randomAccent, d.randomAccent),
    rate: num(r.rate, RATE_MIN, RATE_MAX, d.rate),
    announceType: bool(r.announceType, d.announceType),
    readWholeFirst: bool(r.readWholeFirst, d.readWholeFirst),
    allowReplay: bool(r.allowReplay, d.allowReplay),
    liveFeedback: bool(r.liveFeedback, d.liveFeedback),
    caseSensitive: false,
    ignoreSpaces: bool(r.ignoreSpaces, d.ignoreSpaces),
    ding: bool(r.ding, d.ding),
    pronunciationOverrides: overrides,
  };
}
