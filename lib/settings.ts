import {
  CONCRETE_CONTENT_TYPES,
  CONTENT_TYPES,
  LOCALES,
  PRESETS,
  type ConcreteContentType,
  type Settings,
} from '@/types';
import { clampGap, clampRate, GAP_DEFAULT, RATE_DEFAULT } from './scoring/adaptive';

export const DEFAULT_SETTINGS: Settings = {
  contentType: 'mixed',
  mixedTypes: [...CONCRETE_CONTENT_TYPES],
  preset: 'medium',
  surnameFlavour: 'both',
  gapMs: GAP_DEFAULT,
  timingMode: 'pause',
  delivery: 'token',
  continuousPause: 'short',
  adaptive: true,
  autoSubmitSilenceMs: 1500,
  endGraceMs: 2000,
  grouping: 'random',
  zeroStyle: 'random',
  voiceURI: null,
  locale: 'en-GB',
  randomAccent: false,
  rate: RATE_DEFAULT,
  announceType: true,
  readWholeFirst: true,
  allowReplay: true,
  liveFeedback: false,
  caseSensitive: false,
  ignoreSpaces: true,
  ding: false,
  letterStyle: 'plain',
  pronunciationOverrides: {},
  uiScale: null,
};

export const UI_SCALE_MIN = 0.75;
export const UI_SCALE_MAX = 2.5;

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
    delivery: oneOf(r.delivery, ['token', 'continuous'] as const, d.delivery),
    continuousPause: oneOf(r.continuousPause, ['none', 'short', 'long'] as const, d.continuousPause),
    adaptive: bool(r.adaptive, d.adaptive),
    autoSubmitSilenceMs: num(r.autoSubmitSilenceMs, 500, 3000, d.autoSubmitSilenceMs),
    endGraceMs: num(r.endGraceMs, 500, 10000, d.endGraceMs),
    grouping: oneOf(r.grouping, ['never', 'always', 'random'] as const, d.grouping),
    zeroStyle: oneOf(r.zeroStyle, ['oh', 'zero', 'random'] as const, d.zeroStyle),
    voiceURI: typeof r.voiceURI === 'string' && r.voiceURI ? r.voiceURI : null,
    locale: oneOf(r.locale, LOCALES, d.locale),
    randomAccent: bool(r.randomAccent, d.randomAccent),
    rate: clampRate(num(r.rate, 0, 10, d.rate)),
    announceType: bool(r.announceType, d.announceType),
    readWholeFirst: bool(r.readWholeFirst, d.readWholeFirst),
    allowReplay: bool(r.allowReplay, d.allowReplay),
    liveFeedback: bool(r.liveFeedback, d.liveFeedback),
    caseSensitive: false,
    ignoreSpaces: bool(r.ignoreSpaces, d.ignoreSpaces),
    ding: bool(r.ding, d.ding),
    letterStyle: oneOf(r.letterStyle, ['plain', 'spelled'] as const, d.letterStyle),
    pronunciationOverrides: overrides,
    uiScale: typeof r.uiScale === 'number' && Number.isFinite(r.uiScale) ? Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, r.uiScale)) : null,
  };
}
