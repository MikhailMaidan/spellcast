/**
 * Shared domain types for the IELTS Listening Spelling Trainer.
 * Everything here is plain data so it can be persisted to localStorage as JSON.
 */

export type ContentType = 'surname' | 'ukPostcode' | 'usZip' | 'alnum' | 'mixed';
export type ConcreteContentType = Exclude<ContentType, 'mixed'>;
export type Preset = 'easy' | 'medium' | 'hard';
export type GroupingMode = 'never' | 'always' | 'random';
export type ZeroStyle = 'oh' | 'zero' | 'random';
export type SurnameFlavour = 'british' | 'american' | 'both';
export type Locale = 'en-GB' | 'en-US' | 'en-AU' | 'en-IE' | 'en-IN' | 'en-ZA' | 'any';
/** Which column of the pronunciation table (§6.2) is used for spoken letters. */
export type PronunciationColumn = 'gb' | 'us';
/**
 * How gapMs is applied: 'pause' = silence after each token ends;
 * 'cadence' = interval between one token's start and the next token's start
 * (the token's own audio counts towards it, so engine latency is absorbed).
 */
export type TimingMode = 'pause' | 'cadence';
/**
 * How tokens reach the synthesiser. 'token' = one utterance per token with timed gaps
 * (precise, but every utterance pays the engine's start-up latency). 'continuous' = the
 * whole spelling is one utterance at the voice's natural pace; speech rate is the speed control.
 */
export type DeliveryMode = 'token' | 'continuous';
/** Separator between letters in continuous delivery: nothing, a comma, or a full stop. */
export type ContinuousPause = 'none' | 'short' | 'long';
/**
 * How letters are handed to the synthesiser: 'plain' sends the letter itself ("A", "B"),
 * which most voices read naturally; 'spelled' uses the spelled-out map ("ay", "bee") for
 * voices that misread bare letters.
 */
export type LetterStyle = 'plain' | 'spelled';

export const CONCRETE_CONTENT_TYPES: readonly ConcreteContentType[] = ['surname', 'ukPostcode', 'usZip', 'alnum'];
export const CONTENT_TYPES: readonly ContentType[] = [...CONCRETE_CONTENT_TYPES, 'mixed'];
export const PRESETS: readonly Preset[] = ['easy', 'medium', 'hard'];
export const LOCALES: readonly Locale[] = ['en-GB', 'en-US', 'en-AU', 'en-IE', 'en-IN', 'en-ZA', 'any'];

export interface Settings {
  contentType: ContentType;
  /** Types that take part in mixed mode (checkboxes in settings). */
  mixedTypes: ConcreteContentType[];
  preset: Preset;
  surnameFlavour: SurnameFlavour;
  /** Gap between characters in ms, 0..2000 in 10 ms steps (meaning depends on timingMode). */
  gapMs: number;
  timingMode: TimingMode;
  delivery: DeliveryMode;
  continuousPause: ContinuousPause;
  /** Auto-adjust gapMs after each item. */
  adaptive: boolean;
  /** Silence after the last keystroke (once dictation has ended) before the attempt auto-submits, 500..3000 ms. */
  autoSubmitSilenceMs: number;
  /** How long the item stays open after the last token has been spoken, 500..10000 ms. */
  endGraceMs: number;
  /** "double L" / "triple 7" grouping. */
  grouping: GroupingMode;
  zeroStyle: ZeroStyle;
  /** SpeechSynthesisVoice.voiceURI; null = default voice for the locale. */
  voiceURI: string | null;
  locale: Locale;
  /** Pick a different English voice for every item. */
  randomAccent: boolean;
  /** SpeechSynthesisUtterance.rate, 0.7..1.3. */
  rate: number;
  /** Say "surname" / "postcode" before spelling. */
  announceType: boolean;
  /** Say the whole word once before spelling (surnames only). */
  readWholeFirst: boolean;
  /** Speech rate for that whole-word reading, independent of the letter rate, 0.5..1.5. */
  wholeWordRate: number;
  /** Replay key repeats the item once, counted in stats. */
  allowReplay: boolean;
  /** Colour the token boxes while dictating. */
  liveFeedback: boolean;
  /** Always false in v1; kept for future use. */
  caseSensitive: false;
  /** Postcode space optional in scoring. */
  ignoreSpaces: boolean;
  /** Short "ding" on a correct item. */
  ding: boolean;
  letterStyle: LetterStyle;
  /** Pronunciation overrides keyed `${column}:${CHAR}`, e.g. "gb:L" -> "ell". */
  pronunciationOverrides: Record<string, string>;
  /** Interface size as a multiple of the base size; null = automatic from the screen width. */
  uiScale: number | null;
}

export interface SpeechToken {
  /** What is spoken, e.g. "double el", "ay", "seven". Pause tokens use "<pause 1.5x>". */
  text: string;
  /** The characters the token represents, e.g. "LL", "A", "7". Empty for announcements. */
  chars: string;
  /** Multiplier of gapMs for the pause that follows this token (default 1). */
  pauseAfter?: number;
  /** True for pause-only tokens: nothing is spoken, only the pause is applied. */
  silent?: boolean;
  /** Multiplier applied to the speech rate for this token. */
  rateFactor?: number;
  /** Absolute speech rate for this token, overriding the base rate (the whole word is read slowly). */
  rate?: number;
  /** Floor in ms for the pause after this token, whatever the gap setting (intro, postcode halves). */
  minPauseAfterMs?: number;
}

export interface Item {
  id: string;
  /** RNG seed so the item can be regenerated exactly. */
  seed: number;
  contentType: ConcreteContentType;
  /** Canonical string, e.g. "SW1A 2AA". */
  target: string;
  /** What will actually be spoken, in order. */
  tokens: SpeechToken[];
  createdAt: number;
  /** Language tag of the voice that dictated the item. */
  voiceLang: string;
  /** Voice used for the item so a retry can reuse it. */
  voiceURI: string | null;
}

/** The parts of an item that are worth keeping with an attempt. */
export type ItemSnapshot = Pick<Item, 'seed' | 'contentType' | 'target' | 'tokens'>;

export interface Attempt {
  itemId: string;
  item: ItemSnapshot;
  typed: string;
  correct: boolean;
  /** 0..1, correct characters / target length. */
  charAccuracy: number;
  /** Wrong + missing + extra characters. */
  errors: number;
  /** Gap used for this item. */
  gapMs: number;
  replays: number;
  /** ms offset of each character-inserting keystroke from dictation start. */
  keystrokeTimes: number[];
  /** The character each keystroke inserted (parallel to keystrokeTimes). */
  keystrokeChars: string[];
  /** ms offset at which each token started (parallel to item.tokens; null if unknown). */
  tokenStartTimes: (number | null)[];
  /** ms offset at which the last token finished. */
  dictationEndedAt: number;
  /** At least one keystroke landed after the next token had started. */
  lagged: boolean;
  finishedAt: number;
}

export interface Session {
  id: string;
  startedAt: number;
  attempts: Attempt[];
  settingsSnapshot: Settings;
}
