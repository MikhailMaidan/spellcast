/**
 * generate(contentType, preset, rng) -> target string, and createItem(seed, settings) -> Item.
 * Everything is derived from the seed, so an item can be regenerated exactly for "retry".
 */
import {
  CONCRETE_CONTENT_TYPES,
  type ConcreteContentType,
  type ContentType,
  type Item,
  type Preset,
  type PronunciationColumn,
  type Settings,
  type SurnameFlavour,
} from '@/types';
import { deriveSeed, mulberry32, pick, type Rng } from '../rng';
import { tokenize } from '../speech/tokenizer';
import { generateAlnum } from './alnum';
import { generateSurname } from './surname';
import { generateUkPostcode } from './ukPostcode';
import { generateUsZip } from './usZip';

/** Spoken before the spelling when announceType is on, as one natural sentence. */
export const ANNOUNCEMENTS: Record<ConcreteContentType, string> = {
  surname: 'The surname is',
  ukPostcode: 'The postcode is',
  usZip: 'The zip code is',
  alnum: 'The reference is',
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  surname: 'Surname',
  ukPostcode: 'UK postcode',
  usZip: 'US ZIP',
  alnum: 'Reference code',
  mixed: 'Mixed',
};

export interface GenerateOptions {
  surnameFlavour?: SurnameFlavour;
}

export function generateTarget(type: ConcreteContentType, preset: Preset, rng: Rng, opts: GenerateOptions = {}): string {
  switch (type) {
    case 'surname':
      return generateSurname(rng, preset, opts.surnameFlavour ?? 'both');
    case 'ukPostcode':
      return generateUkPostcode(rng, preset);
    case 'usZip':
      return generateUsZip(rng, preset);
    case 'alnum':
      return generateAlnum(rng, preset);
  }
}

/** Mixed mode draws from the enabled types with equal weight. */
export function resolveContentType(settings: Pick<Settings, 'contentType' | 'mixedTypes'>, rng: Rng): ConcreteContentType {
  if (settings.contentType !== 'mixed') return settings.contentType;
  const pool = settings.mixedTypes.length ? settings.mixedTypes : CONCRETE_CONTENT_TYPES;
  return pick(rng, pool);
}

export interface CreateItemParams {
  seed: number;
  settings: Settings;
  /** Pronunciation column of the voice that will speak the item. */
  column?: PronunciationColumn;
  voiceLang?: string;
  voiceURI?: string | null;
  now?: number;
}

const TOKENIZER_SALT = 0x5bd1e995;

function makeId(seed: number, now: number): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${now.toString(36)}-${seed.toString(36)}`;
}

/** Build a complete item. Target and tokens depend only on (seed, settings, column). */
export function createItem({ seed, settings, column = 'gb', voiceLang = '', voiceURI = null, now }: CreateItemParams): Item {
  const rng = mulberry32(seed);
  const contentType = resolveContentType(settings, rng);
  const target = generateTarget(contentType, settings.preset, rng, { surnameFlavour: settings.surnameFlavour });
  const tokens = tokenize(target, {
    grouping: settings.grouping,
    zeroStyle: settings.zeroStyle,
    column,
    rng: mulberry32(deriveSeed(seed, TOKENIZER_SALT)),
    overrides: settings.pronunciationOverrides,
    letterStyle: settings.letterStyle,
    announce: settings.announceType ? ANNOUNCEMENTS[contentType] : undefined,
    readWholeFirst: contentType === 'surname' && settings.readWholeFirst,
  });
  const createdAt = now ?? Date.now();
  return { id: makeId(seed, createdAt), seed, contentType, target, tokens, createdAt, voiceLang, voiceURI };
}
