'use client';

import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import { CONCRETE_CONTENT_TYPES, PRESETS, type ConcreteContentType, type Preset } from '@/types';
import { useTrainer } from '@/components/SettingsProvider';
import { VoicePicker } from '@/components/VoicePicker';
import { CONTENT_TYPE_LABELS, createItem } from '@/lib/generators';
import { columnForLang, defaultSpokenForm, PRONOUNCEABLE_CHARS } from '@/lib/speech/pronounce';
import { Speaker, type SpeakerDiagnostics } from '@/lib/speech/speaker';
import { tokenize } from '@/lib/speech/tokenizer';
import { useVoices } from '@/lib/speech/useVoices';
import { langForLocale, resolveVoice } from '@/lib/speech/voices';

const ITEMS_PER_CELL = 20;

const button =
  'rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800';

/** Debug page: 20 generated items per type and preset with their token lists, plus a "speak anything" tool. */
export default function DebugPage() {
  const { settings, updateSettings, hydrated } = useTrainer();
  const voices = useVoices();
  const [text, setText] = useState('SW1A 0AA');
  const [batch, setBatch] = useState(0);
  const [speaking, setSpeaking] = useState(-1);
  const [diag, setDiag] = useState<SpeakerDiagnostics | null>(null);
  const speakerRef = useRef<Speaker | null>(null);

  const getSpeaker = useCallback(() => {
    if (!speakerRef.current) speakerRef.current = new Speaker();
    return speakerRef.current;
  }, []);

  const resolved = resolveVoice(voices, settings);
  const lang = resolved.voice?.lang || langForLocale(settings.locale);
  const column = columnForLang(lang);

  const cells = useMemo(() => {
    const out: { type: ConcreteContentType; preset: Preset; items: ReturnType<typeof createItem>[] }[] = [];
    CONCRETE_CONTENT_TYPES.forEach((type, ti) => {
      PRESETS.forEach((preset, pi) => {
        const items = [];
        for (let i = 0; i < ITEMS_PER_CELL; i++) {
          const seed = batch * 100000 + ti * 10000 + pi * 1000 + i + 1;
          items.push(createItem({ seed, settings: { ...settings, contentType: type, preset }, column, now: 0 }));
        }
        out.push({ type, preset, items });
      });
    });
    return out;
  }, [settings, column, batch]);

  const previewTokens = useMemo(
    () => tokenize(text, { grouping: settings.grouping, zeroStyle: settings.zeroStyle, column, overrides: settings.pronunciationOverrides }),
    [text, settings.grouping, settings.zeroStyle, settings.pronunciationOverrides, column],
  );

  const speak = () => {
    getSpeaker().speak({
      tokens: previewTokens,
      voice: resolved.voice,
      lang,
      rate: settings.rate,
      delivery: settings.delivery,
      continuousPause: settings.continuousPause,
      getTiming: () => ({ gapMs: settings.gapMs, mode: settings.timingMode }),
      onTokenStart: (i) => setSpeaking(i),
      onDone: () => {
        setSpeaking(-1);
        setDiag(getSpeaker().diagnostics);
      },
    });
  };
  const stop = () => {
    getSpeaker().cancel();
    setSpeaking(-1);
  };

  const testVoice = (v: SpeechSynthesisVoice | null) => {
    const chosen = v ?? resolveVoice(voices, { voiceURI: null, locale: settings.locale }).voice;
    const l = chosen?.lang || langForLocale(settings.locale);
    getSpeaker().speak({
      tokens: tokenize('JZ0 7LL', { grouping: 'always', zeroStyle: 'oh', column: columnForLang(l), overrides: settings.pronunciationOverrides }),
      voice: chosen,
      lang: l,
      rate: settings.rate,
      delivery: settings.delivery,
      continuousPause: settings.continuousPause,
      getTiming: () => ({ gapMs: settings.gapMs, mode: settings.timingMode }),
    });
  };

  if (!hydrated) return <div className="min-h-screen" aria-busy="true" />;

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Debug: generators, tokens and speech</h1>
        <Link href="/" className="text-sm underline">
          ← back to the trainer
        </Link>
      </header>

      <section className="grid gap-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Speak any string letter by letter</h2>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-lg uppercase tracking-widest dark:border-zinc-700 dark:bg-zinc-800"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={button} onClick={speak}>
              ▶ Speak
            </button>
            <button type="button" className={button} onClick={stop}>
              ■ Stop
            </button>
            <span className="text-xs text-zinc-500">
              delivery {settings.delivery} · {settings.timingMode === 'cadence' ? 'cadence' : 'gap'} {settings.gapMs} ms · rate {settings.rate.toFixed(2)} · grouping {settings.grouping} · zero {settings.zeroStyle} · column {column}
            </span>
          </div>
          <p className="flex flex-wrap gap-1 font-mono text-sm">
            {previewTokens.map((t, i) => (
              <span key={i} className={`rounded border px-1.5 py-0.5 ${i === speaking ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-zinc-300 dark:border-zinc-700'} ${t.silent ? 'opacity-50' : ''}`}>
                {t.text}
              </span>
            ))}
          </p>
          {diag && (
            <p className="text-xs text-zinc-500">
              measured: voice start latency ≈ {Math.round(diag.startLatencyMs ?? 0)} ms · ≈ {Math.round(diag.msPerCharAtRate1 ?? 0)} ms per character at rate 1
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Voice</h2>
          <VoicePicker
            voices={voices}
            voiceURI={settings.voiceURI}
            locale={settings.locale}
            onVoiceChange={(voiceURI) => updateSettings({ voiceURI })}
            onLocaleChange={(locale) => updateSettings({ locale })}
            onTest={testVoice}
          />
          <p className="text-xs text-zinc-500">
            Using: {resolved.voice ? `${resolved.voice.name} (${resolved.voice.lang}, ${resolved.level})` : 'browser default'} · {voices.length} voices reported
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            {ITEMS_PER_CELL} items per type and preset (seeded batch {batch})
          </h2>
          <button type="button" className={button} onClick={() => setBatch((b) => b + 1)}>
            Next batch
          </button>
        </div>
        {cells.map(({ type, preset, items }) => (
          <details key={`${type}-${preset}`} className="rounded-lg border border-zinc-200 dark:border-zinc-800" open={preset === 'medium'}>
            <summary className="cursor-pointer px-4 py-2 text-sm">
              <span className="font-medium">{CONTENT_TYPE_LABELS[type]}</span> · {preset}
            </summary>
            <table className="w-full text-sm">
              <tbody>
                {items.map((it) => (
                  <tr key={it.seed} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="w-10 px-4 py-1 text-xs text-zinc-400">{it.seed % 1000}</td>
                    <td className="w-48 px-2 py-1 font-mono">{it.target}</td>
                    <td className="px-2 py-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">{it.tokens.map((t) => t.text).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Pronunciation map (built-in)</h2>
        <p className="flex flex-wrap gap-1 font-mono text-xs">
          {PRONOUNCEABLE_CHARS.map((ch) => (
            <span key={ch} className="rounded border border-zinc-200 px-1.5 py-0.5 dark:border-zinc-800">
              {ch} → {defaultSpokenForm(ch, 'gb')}
              {defaultSpokenForm(ch, 'us') !== defaultSpokenForm(ch, 'gb') ? ` / ${defaultSpokenForm(ch, 'us')} (US)` : ''}
            </span>
          ))}
        </p>
      </section>
    </div>
  );
}
