/** Voice enumeration, grouping and fallback selection (§6.4). */
import type { Locale, Settings } from '@/types';
import { speechAvailable } from './support';

export const KNOWN_LOCALES = ['en-GB', 'en-US', 'en-AU', 'en-IE', 'en-IN', 'en-ZA'] as const;

const LOCALE_LABELS: Record<string, string> = {
  'en-GB': 'British',
  'en-US': 'American',
  'en-AU': 'Australian',
  'en-IE': 'Irish',
  'en-IN': 'Indian',
  'en-ZA': 'South African',
  'en-other': 'Other English',
  other: 'Non-English',
};

/** "en_gb" / "en-gb" -> "en-GB". */
export function normaliseLang(lang: string | null | undefined): string {
  const parts = (lang ?? '').replace('_', '-').split('-');
  if (!parts[0]) return '';
  const [language, region] = parts;
  return region ? `${language.toLowerCase()}-${region.toUpperCase()}` : language.toLowerCase();
}

export function isEnglish(voice: SpeechSynthesisVoice): boolean {
  return normaliseLang(voice.lang).startsWith('en');
}

export function isNetworkVoice(voice: SpeechSynthesisVoice): boolean {
  return !voice.localService;
}

export function voiceLabel(voice: SpeechSynthesisVoice): string {
  return `${voice.name} (${isNetworkVoice(voice) ? 'network' : 'local'})`;
}

export function getVoicesNow(): SpeechSynthesisVoice[] {
  if (!speechAvailable()) return [];
  try {
    return sortVoices(window.speechSynthesis.getVoices() ?? []);
  } catch {
    return [];
  }
}

function sortVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return [...voices].sort((a, b) => {
    const ea = isEnglish(a) ? 0 : 1;
    const eb = isEnglish(b) ? 0 : 1;
    if (ea !== eb) return ea - eb;
    const la = normaliseLang(a.lang);
    const lb = normaliseLang(b.lang);
    if (la !== lb) return la.localeCompare(lb);
    if (a.default !== b.default) return a.default ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Deliver the voice list now (if available), on `voiceschanged`, and by polling up to
 * ten times at 100 ms - in Chrome the list is empty on the first call.
 */
export function subscribeVoices(cb: (voices: SpeechSynthesisVoice[]) => void): () => void {
  if (!speechAvailable()) return () => {};
  let disposed = false;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const deliver = (): boolean => {
    if (disposed) return true;
    const v = getVoicesNow();
    if (v.length) {
      cb(v);
      return true;
    }
    return false;
  };
  const retry = () => {
    if (disposed || deliver()) return;
    if (++attempts < 10) timer = setTimeout(retry, 100);
  };
  const onChanged = () => {
    deliver();
  };

  window.speechSynthesis.addEventListener('voiceschanged', onChanged);
  retry();
  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    window.speechSynthesis.removeEventListener('voiceschanged', onChanged);
  };
}

export interface VoiceGroup {
  key: string;
  label: string;
  voices: SpeechSynthesisVoice[];
}

/** Group by language tag: the known English locales, then other English, then (optionally) the rest. */
export function groupVoices(voices: SpeechSynthesisVoice[], includeNonEnglish = false): VoiceGroup[] {
  const buckets = new Map<string, SpeechSynthesisVoice[]>();
  for (const v of voices) {
    const lang = normaliseLang(v.lang);
    const key = (KNOWN_LOCALES as readonly string[]).includes(lang) ? lang : isEnglish(v) ? 'en-other' : 'other';
    if (key === 'other' && !includeNonEnglish) continue;
    const list = buckets.get(key) ?? [];
    list.push(v);
    buckets.set(key, list);
  }
  const order = [...KNOWN_LOCALES, 'en-other', 'other'];
  return order
    .filter((k) => buckets.has(k))
    .map((key) => ({ key, label: `${LOCALE_LABELS[key]} (${key === 'en-other' ? 'en-*' : key === 'other' ? 'hidden by default' : key})`, voices: buckets.get(key)! }));
}

export type VoiceResolutionLevel = 'exact' | 'locale' | 'english' | 'none';

/** Stored voice -> first voice of the stored locale -> any English voice -> browser default. */
export function resolveVoice(
  voices: SpeechSynthesisVoice[],
  settings: Pick<Settings, 'voiceURI' | 'locale'>,
): { voice: SpeechSynthesisVoice | null; level: VoiceResolutionLevel } {
  if (settings.voiceURI) {
    const exact = voices.find((v) => v.voiceURI === settings.voiceURI);
    if (exact) return { voice: exact, level: 'exact' };
  }
  if (settings.locale !== 'any') {
    const byLocale = voices.find((v) => normaliseLang(v.lang) === settings.locale);
    if (byLocale) return { voice: byLocale, level: 'locale' };
  }
  const english = voices.find(isEnglish);
  if (english) return { voice: english, level: 'english' };
  return { voice: null, level: 'none' };
}

/** A random English voice, avoiding `exceptURI` when there is a choice. */
export function pickRandomEnglishVoice(
  voices: SpeechSynthesisVoice[],
  exceptURI: string | null = null,
  random: () => number = Math.random,
): SpeechSynthesisVoice | null {
  let pool = voices.filter(isEnglish);
  if (pool.length > 1 && exceptURI) pool = pool.filter((v) => v.voiceURI !== exceptURI);
  if (!pool.length) return null;
  return pool[Math.floor(random() * pool.length)];
}

export function langForLocale(locale: Locale): string {
  return locale === 'any' ? 'en-GB' : locale;
}
