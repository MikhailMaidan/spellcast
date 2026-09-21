'use client';

import { useState } from 'react';
import { LOCALES, type Locale } from '@/types';
import { groupVoices, voiceLabel } from '@/lib/speech/voices';

export interface VoicePickerProps {
  voices: SpeechSynthesisVoice[];
  voiceURI: string | null;
  locale: Locale;
  onVoiceChange: (voiceURI: string | null) => void;
  onLocaleChange: (locale: Locale) => void;
  /** Speak a sample spelling with the given voice (null = default for the locale). */
  onTest: (voice: SpeechSynthesisVoice | null) => void;
}

const control =
  'w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800';

/** Runtime voice enumeration grouped by accent, with a test button. */
export function VoicePicker({ voices, voiceURI, locale, onVoiceChange, onLocaleChange, onTest }: VoicePickerProps) {
  const [includeNonEnglish, setIncludeNonEnglish] = useState(false);
  const groups = groupVoices(voices, includeNonEnglish);
  const selected = voiceURI ? (voices.find((v) => v.voiceURI === voiceURI) ?? null) : null;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Locale</span>
        <select className={`${control} max-w-[200px]`} value={locale} onChange={(e) => onLocaleChange(e.target.value as Locale)}>
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {l === 'any' ? 'any English' : l}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Voice</span>
        <select className={control} value={voiceURI ?? ''} onChange={(e) => onVoiceChange(e.target.value || null)}>
          <option value="">Default for locale</option>
          {groups.map((g) => (
            <optgroup key={g.key} label={g.label}>
              {g.voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {voiceLabel(v)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={includeNonEnglish} onChange={(e) => setIncludeNonEnglish(e.target.checked)} />
          show non-English voices
        </label>
        <button
          type="button"
          onClick={() => onTest(selected)}
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          ▶ Test voice
        </button>
      </div>

      {voices.length === 0 && <p className="text-xs text-amber-700 dark:text-amber-400">The browser has not reported any voices yet.</p>}
      {voiceURI && !selected && voices.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">The saved voice is not available on this device; a fallback is used.</p>
      )}
    </div>
  );
}
