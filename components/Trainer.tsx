'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Attempt, Item, Session, Settings } from '@/types';
import { playDing } from '@/lib/audio';
import { CONTENT_TYPE_LABELS, createItem } from '@/lib/generators';
import { randomSeed } from '@/lib/rng';
import {
  adaptGap,
  adaptRate,
  clampGap,
  clampRate,
  GAP_KEY_FINE_STEP,
  GAP_KEY_STEP,
  RATE_KEY_FINE_STEP,
  RATE_KEY_STEP,
  type AdaptiveResult,
} from '@/lib/scoring/adaptive';
import { diffStrings, normaliseForScoring } from '@/lib/scoring/diff';
import { analyseKeystrokes, computeSessionStats, type SessionStats } from '@/lib/scoring/stats';
import { exportSessionJSON } from '@/lib/session';
import { columnForLang } from '@/lib/speech/pronounce';
import { Speaker } from '@/lib/speech/speaker';
import { speechAvailable } from '@/lib/speech/support';
import { tokenize } from '@/lib/speech/tokenizer';
import { useVoices } from '@/lib/speech/useVoices';
import { langForLocale, pickRandomEnglishVoice, resolveVoice } from '@/lib/speech/voices';
import { GapTimerBar, type GapRun } from './GapTimerBar';
import { ResultsView, type ResultState } from './ResultsView';
import { SessionSummary } from './SessionSummary';
import { SettingsPanel } from './SettingsPanel';
import { useTrainer } from './SettingsProvider';
import { StatsBar } from './StatsBar';
import { TokenRow } from './TokenRow';
import { TrainerInput } from './TrainerInput';

type Phase = 'ready' | 'dictating' | 'result';

interface Keystroke {
  t: number;
  ch: string;
}

/** Everything the keyboard and speaker callbacks need, kept fresh after every render. */
interface Latest {
  phase: Phase;
  item: Item | null;
  typed: string;
  dictationDone: boolean;
  replays: number;
  drawerOpen: boolean;
  statsOpen: boolean;
  settings: Settings;
  session: Session;
  voices: SpeechSynthesisVoice[];
  voice: SpeechSynthesisVoice | null;
  stats: SessionStats;
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function chooseVoice(
  settings: Settings,
  voices: SpeechSynthesisVoice[],
  keepURI: string | null | undefined,
  previous: SpeechSynthesisVoice | null,
): SpeechSynthesisVoice | null {
  if (keepURI) {
    const kept = voices.find((v) => v.voiceURI === keepURI);
    if (kept) return kept;
  }
  if (settings.randomAccent) {
    const random = pickRandomEnglishVoice(voices, previous?.voiceURI ?? null);
    if (random) return random;
  }
  return resolveVoice(voices, settings).voice;
}

/** The single training screen: Ready -> Dictating -> Result, fully keyboard driven. */
export default function Trainer() {
  const { settings, updateSettings, session, addAttempt, clearSession, hydrated } = useTrainer();
  const voices = useVoices();

  const [phase, setPhase] = useState<Phase>('ready');
  const [item, setItem] = useState<Item | null>(null);
  const [typed, setTyped] = useState('');
  const [currentToken, setCurrentToken] = useState(-1);
  const [dictationDone, setDictationDone] = useState(false);
  const [replays, setReplays] = useState(0);
  const [result, setResult] = useState<ResultState | null>(null);
  const [gapRun, setGapRun] = useState<GapRun | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  const stats = useMemo(() => computeSessionStats(session, settings.ignoreSpaces), [session, settings.ignoreSpaces]);

  const speakerRef = useRef<Speaker | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keystrokesRef = useRef<Keystroke[]>([]);
  const tokenStartsRef = useRef<(number | null)[]>([]);
  const dictationEndRef = useRef(0);
  const gapSeqRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Latest>({ phase, item, typed, dictationDone, replays, drawerOpen, statsOpen, settings, session, voices, voice, stats });

  // Declared first so every later effect and every handler sees this render's values.
  useEffect(() => {
    latest.current = { phase, item, typed, dictationDone, replays, drawerOpen, statsOpen, settings, session, voices, voice, stats };
  });

  const getSpeaker = useCallback((): Speaker => {
    if (!speakerRef.current) speakerRef.current = new Speaker();
    return speakerRef.current;
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  /** Read fresh for every gap so [ ] { } and drawer changes apply from the next token. */
  const getTiming = useCallback(() => ({ gapMs: latest.current.settings.gapMs, mode: latest.current.settings.timingMode }), []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const runSpeech = useCallback(
    (it: Item, v: SpeechSynthesisVoice | null, lang: string) => {
      tokenStartsRef.current = [];
      getSpeaker().speak({
        tokens: it.tokens,
        voice: v,
        lang,
        rate: latest.current.settings.rate,
        delivery: latest.current.settings.delivery,
        continuousPause: latest.current.settings.continuousPause,
        getTiming,
        onTokenStart: (i, t) => {
          tokenStartsRef.current[i] = t;
          setCurrentToken(i);
          setGapRun(null);
        },
        onGap: (_i, ms) => setGapRun({ id: ++gapSeqRef.current, ms }),
        onDone: (t) => {
          dictationEndRef.current = t;
          setCurrentToken(-1);
          setGapRun(null);
          setDictationDone(true);
        },
      });
    },
    [getSpeaker, getTiming],
  );

  const startItem = useCallback(
    (seed?: number, keepVoiceURI?: string | null) => {
      const { settings: s, voices: vs, voice: previous } = latest.current;
      getSpeaker().cancel();
      const v = chooseVoice(s, vs, keepVoiceURI, previous);
      const lang = v?.lang || langForLocale(s.locale);
      const newItem = createItem({
        seed: seed ?? randomSeed(),
        settings: s,
        column: columnForLang(lang),
        voiceLang: lang,
        voiceURI: v?.voiceURI ?? null,
      });
      keystrokesRef.current = [];
      tokenStartsRef.current = [];
      dictationEndRef.current = 0;
      setVoice(v);
      setItem(newItem);
      setTyped('');
      setCurrentToken(-1);
      setDictationDone(false);
      setReplays(0);
      setResult(null);
      setGapRun(null);
      setPhase('dictating');
      runSpeech(newItem, v, lang);
      focusInput();
    },
    [focusInput, getSpeaker, runSpeech],
  );

  const submit = useCallback(() => {
    const st = latest.current;
    if (st.phase !== 'dictating' || !st.item) return;
    const speaker = getSpeaker();
    const endedAt = st.dictationDone ? dictationEndRef.current : speaker.now();
    speaker.cancel();

    const s = st.settings;
    const it = st.item;
    const diff = diffStrings(it.target, st.typed, { ignoreSpaces: s.ignoreSpaces });
    const keystrokeTimes = keystrokesRef.current.map((k) => k.t);
    const keystrokeChars = keystrokesRef.current.map((k) => k.ch);
    const tokenStartTimes = it.tokens.map((_, i) => tokenStartsRef.current[i] ?? null);
    const lag = analyseKeystrokes({
      tokens: it.tokens,
      keystrokeTimes,
      keystrokeChars,
      tokenStartTimes,
      dictationEndedAt: endedAt,
      gapMs: s.gapMs,
      ignoreSpaces: s.ignoreSpaces,
    });
    const streak = diff.correct ? st.stats.currentStreak + 1 : 0;

    const attempt: Attempt = {
      itemId: it.id,
      item: { seed: it.seed, contentType: it.contentType, target: it.target, tokens: it.tokens },
      typed: st.typed,
      correct: diff.correct,
      charAccuracy: diff.charAccuracy,
      errors: diff.errors,
      gapMs: s.gapMs,
      replays: st.replays,
      keystrokeTimes,
      keystrokeChars,
      tokenStartTimes,
      dictationEndedAt: endedAt,
      lagged: lag.lagged,
      finishedAt: Date.now(),
    };

    let adaptation: AdaptiveResult | null = null;
    if (s.adaptive) {
      const outcome = { correct: diff.correct, errors: diff.errors, replays: st.replays, lagged: lag.lagged, streak };
      adaptation = s.delivery === 'continuous' ? adaptRate(outcome, s.rate) : adaptGap(outcome, s.gapMs);
      if (adaptation.kind === 'gap' && adaptation.next !== s.gapMs) updateSettings({ gapMs: adaptation.next });
      if (adaptation.kind === 'rate' && adaptation.next !== s.rate) updateSettings({ rate: adaptation.next });
    }
    addAttempt(attempt);
    if (diff.correct && s.ding) playDing();

    setResult({ attempt, diff, adaptation, lag });
    setCurrentToken(-1);
    setGapRun(null);
    setPhase('result');
  }, [addAttempt, getSpeaker, updateSettings]);

  const abort = useCallback(() => {
    getSpeaker().cancel();
    setPhase('ready');
    setItem(null);
    setTyped('');
    setCurrentToken(-1);
    setGapRun(null);
    setDictationDone(false);
    setResult(null);
    focusInput();
  }, [focusInput, getSpeaker]);

  const replay = useCallback(() => {
    const st = latest.current;
    if (st.phase !== 'dictating' || !st.item || !st.settings.allowReplay || st.replays >= 1) return;
    keystrokesRef.current = [];
    dictationEndRef.current = 0;
    setReplays((r) => r + 1);
    setDictationDone(false);
    runSpeech(st.item, st.voice, st.item.voiceLang);
  }, [runSpeech]);

  const retry = useCallback(() => {
    const st = latest.current;
    if (st.item) startItem(st.item.seed, st.item.voiceURI);
  }, [startItem]);

  const listenAgain = useCallback(() => {
    const st = latest.current;
    if (st.phase !== 'result' || !st.item) return;
    getSpeaker().speak({
      tokens: st.item.tokens,
      voice: st.voice,
      lang: st.item.voiceLang,
      rate: st.settings.rate,
      delivery: st.settings.delivery,
      continuousPause: st.settings.continuousPause,
      getTiming,
      onTokenStart: (i) => setCurrentToken(i),
      onDone: () => setCurrentToken(-1),
    });
  }, [getSpeaker, getTiming]);

  /** [ and { = faster, ] and } = slower: the gap in token delivery, the speech rate in continuous delivery. */
  const adjustSpeed = useCallback(
    (direction: 1 | -1, fine: boolean) => {
      const s = latest.current.settings;
      if (s.delivery === 'continuous') {
        updateSettings({ rate: clampRate(s.rate - direction * (fine ? RATE_KEY_FINE_STEP : RATE_KEY_STEP)) });
      } else {
        updateSettings({ gapMs: clampGap(s.gapMs + direction * (fine ? GAP_KEY_FINE_STEP : GAP_KEY_STEP)) });
      }
    },
    [updateSettings],
  );

  const openSettings = useCallback(() => {
    if (latest.current.phase === 'dictating') abort();
    setStatsOpen(false);
    setDrawerOpen(true);
  }, [abort]);

  const openStats = useCallback(() => {
    if (latest.current.phase === 'dictating') abort();
    setDrawerOpen(false);
    setStatsOpen(true);
  }, [abort]);

  const closeOverlays = useCallback(() => {
    setDrawerOpen(false);
    setStatsOpen(false);
    getSpeaker().cancel();
    setCurrentToken(-1);
    focusInput();
  }, [focusInput, getSpeaker]);

  const handleInput = useCallback(
    (value: string, inserted: string | null) => {
      if (latest.current.phase !== 'dictating') return;
      if (inserted) {
        const t = getSpeaker().now();
        for (const ch of inserted) keystrokesRef.current.push({ t, ch });
      }
      setTyped(value);
    },
    [getSpeaker],
  );

  const testVoice = useCallback(
    (v: SpeechSynthesisVoice | null) => {
      const s = latest.current.settings;
      const chosen = v ?? resolveVoice(latest.current.voices, { voiceURI: null, locale: s.locale }).voice;
      const lang = chosen?.lang || langForLocale(s.locale);
      const tokens = tokenize('JZ0 7LL', {
        grouping: 'always',
        zeroStyle: 'oh',
        column: columnForLang(lang),
        overrides: s.pronunciationOverrides,
        letterStyle: s.letterStyle,
        announce: 'The reference is',
      });
      getSpeaker().speak({ tokens, voice: chosen, lang, rate: s.rate, delivery: s.delivery, continuousPause: s.continuousPause, getTiming });
    },
    [getSpeaker, getTiming],
  );

  const exportJSON = useCallback(() => {
    downloadText(exportSessionJSON(latest.current.session), `spellcast-session-${new Date().toISOString().slice(0, 10)}.json`);
    showToast('Session exported.');
  }, [showToast]);

  const clearHistory = useCallback(() => {
    if (!window.confirm('Clear all session history? This cannot be undone.')) return;
    clearSession();
    showToast('History cleared.');
  }, [clearSession, showToast]);

  // Auto-submit: as soon as the typed length matches once dictation has finished, or after a silence.
  useEffect(() => {
    if (phase !== 'dictating' || !dictationDone || !item) return;
    const targetLen = normaliseForScoring(item.target, settings.ignoreSpaces).length;
    const typedLen = normaliseForScoring(typed, settings.ignoreSpaces).length;
    const timer = setTimeout(submit, typedLen >= targetLen ? 0 : settings.autoSubmitSilenceMs);
    return () => clearTimeout(timer);
  }, [phase, dictationDone, item, typed, settings.ignoreSpaces, settings.autoSubmitSilenceMs, submit]);

  // Keyboard flow (§8).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = latest.current;
      const key = e.key;

      if (st.drawerOpen || st.statsOpen) {
        if (key === 'Escape') {
          e.preventDefault();
          closeOverlays();
        }
        return;
      }
      if (key === '[' || key === ']' || key === '{' || key === '}') {
        e.preventDefault();
        const fine = key === '{' || key === '}';
        adjustSpeed(key === '[' || key === '{' ? -1 : 1, fine);
        return;
      }
      if (key === 'Escape') {
        if (st.phase !== 'ready') {
          e.preventDefault();
          abort();
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if (st.phase === 'dictating' && (key === 'r' || key === 'R') && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          replay();
        }
        return;
      }

      if (st.phase === 'ready') {
        if (key === ' ' || key === 'Enter') {
          e.preventDefault();
          startItem();
        } else if (key === 's' || key === 'S') {
          e.preventDefault();
          openSettings();
        } else if (key === 't' || key === 'T') {
          e.preventDefault();
          openStats();
        }
        return;
      }

      if (st.phase === 'dictating') {
        if (key === 'Enter') {
          e.preventDefault();
          submit();
        } else if (key === 'Tab') {
          e.preventDefault();
          replay();
        }
        return;
      }

      // result
      if (key === ' ' || key === 'Enter') {
        e.preventDefault();
        startItem();
      } else if (key === 'Backspace') {
        e.preventDefault();
        retry();
      } else if (key === 's' || key === 'S') {
        e.preventDefault();
        openSettings();
      } else if (key === 't' || key === 'T') {
        e.preventDefault();
        openStats();
      } else if (key === 'r' || key === 'R') {
        e.preventDefault();
        listenAgain();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abort, adjustSpeed, closeOverlays, listenAgain, openSettings, openStats, replay, retry, startItem, submit]);

  // Focus management: the input regains focus on every state change and on any click on the page.
  useEffect(() => {
    if (phase !== 'result') inputRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('[data-no-refocus]') || target.closest('input, textarea, select, button, a, details')) return;
      if (latest.current.drawerOpen || latest.current.statsOpen) return;
      inputRef.current?.focus();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(
    () => () => {
      speakerRef.current?.cancel();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    [],
  );

  if (!hydrated) {
    return <div className="min-h-screen" aria-busy="true" />;
  }

  const speechOk = speechAvailable();
  const savedVoiceMissing = voices.length > 0 && !!settings.voiceURI && !voices.some((v) => v.voiceURI === settings.voiceURI);
  const fallbackVoice = savedVoiceMissing ? resolveVoice(voices, settings).voice : null;
  const canReplay = settings.allowReplay && replays < 1;
  const heading = phase === 'ready' || !item ? 'ready' : CONTENT_TYPE_LABELS[item.contentType].toLowerCase();

  const hint =
    phase === 'ready'
      ? 'Space / Enter start · S settings · T stats · [ ] { } speed'
      : phase === 'dictating'
        ? `Enter submit${canReplay ? ' · Tab replay' : ''} · Esc abort · [ ] { } speed`
        : 'Enter / Space next · Backspace retry same item · R listen again · S settings · T stats';

  return (
    <div className="flex min-h-screen flex-col">
      <StatsBar
        stats={stats}
        gapMs={settings.gapMs}
        rate={settings.rate}
        delivery={settings.delivery}
        timingMode={settings.timingMode}
        onOpenSettings={openSettings}
        onOpenStats={openStats}
      />

      {!speechOk && (
        <div className="bg-amber-100 px-6 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Speech synthesis is not available in this browser. Desktop Chrome is recommended.
        </div>
      )}
      {savedVoiceMissing && (
        <div className="bg-amber-50 px-6 py-2 text-center text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Saved voice not found on this device; using {fallbackVoice ? fallbackVoice.name : 'the browser default'}.{' '}
          <button type="button" className="underline" data-no-refocus onClick={() => updateSettings({ voiceURI: fallbackVoice?.voiceURI ?? null })}>
            keep this voice
          </button>
        </div>
      )}
      {toast && (
        <div className="bg-zinc-900 px-6 py-2 text-center text-sm text-white dark:bg-zinc-100 dark:text-zinc-900" role="status">
          {toast}
        </div>
      )}

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-8 px-6 py-12">
        <div className="text-center text-xs uppercase tracking-[0.3em] text-zinc-500">
          {heading}
          {voice && phase !== 'ready' && (
            <span className="ml-3 normal-case tracking-normal text-zinc-400">
              {voice.name} · {voice.lang}
            </span>
          )}
        </div>

        {phase !== 'result' && (
          <div className="flex flex-col gap-4">
            <TrainerInput ref={inputRef} value={typed} onInput={handleInput} readOnly={phase === 'ready'} />
            <GapTimerBar run={gapRun} />
            {phase === 'ready' ? (
              <p className="text-center text-sm text-zinc-500">Press Space or Enter to start</p>
            ) : (
              item && (
                <TokenRow
                  tokens={item.tokens}
                  current={currentToken}
                  typed={settings.liveFeedback ? typed : null}
                  ignoreSpaces={settings.ignoreSpaces}
                  showText={settings.liveFeedback}
                />
              )
            )}
          </div>
        )}

        {phase === 'result' && result && item && <ResultsView item={item} result={result} currentToken={currentToken} />}

        <p className="mt-auto text-center text-xs text-zinc-500">{hint}</p>
      </main>

      <SettingsPanel
        open={drawerOpen}
        onClose={closeOverlays}
        voices={voices}
        onTestVoice={testVoice}
        onClearHistory={clearHistory}
        onExport={exportJSON}
      />
      <SessionSummary open={statsOpen} stats={stats} session={session} gapMs={settings.gapMs} onClose={closeOverlays} onClear={clearHistory} onExport={exportJSON} />
    </div>
  );
}
