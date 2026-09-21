'use client';

import type { ReactNode } from 'react';
import {
  CONCRETE_CONTENT_TYPES,
  CONTENT_TYPES,
  PRESETS,
  type ConcreteContentType,
  type ContentType,
  type GroupingMode,
  type Preset,
  type SurnameFlavour,
  type ZeroStyle,
} from '@/types';
import { CONTENT_TYPE_LABELS } from '@/lib/generators';
import { formatGap, GAP_DEFAULT, GAP_MAX, GAP_MIN, GAP_STEP } from '@/lib/scoring/adaptive';
import { PronunciationEditor } from './PronunciationEditor';
import { useTrainer } from './SettingsProvider';
import { VoicePicker } from './VoicePicker';

export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  voices: SpeechSynthesisVoice[];
  onTestVoice: (voice: SpeechSynthesisVoice | null) => void;
  onClearHistory: () => void;
  onExport: () => void;
}

const control =
  'rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800';
const button =
  'rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>
        {label}
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}

function Select<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select className={`${control} max-w-[200px]`} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Range({
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <span className="flex items-center gap-2">
      <input type="range" className="w-32 accent-blue-600" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="w-14 text-right font-mono text-xs tabular-nums">{format(value)}</span>
    </span>
  );
}

/** Side drawer with every control from §10 of the specification. */
export function SettingsPanel({ open, onClose, voices, onTestVoice, onClearHistory, onExport }: SettingsPanelProps) {
  const { settings, updateSettings, resetSettings } = useTrainer();
  if (!open) return null;

  const toggleMixed = (type: ConcreteContentType, on: boolean) => {
    const next = on ? [...new Set([...settings.mixedTypes, type])] : settings.mixedTypes.filter((t) => t !== type);
    updateSettings({ mixedTypes: next.length ? next : [type] });
  };

  return (
    <div className="fixed inset-0 z-50" data-no-refocus>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="drawer-in absolute inset-y-0 right-0 flex w-[360px] max-w-full flex-col gap-6 overflow-y-auto border-l border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button type="button" className={button} onClick={onClose}>
            Close (Esc)
          </button>
        </header>

        <Group title="Content">
          <Row label="Content type">
            <Select<ContentType>
              value={settings.contentType}
              options={CONTENT_TYPES.map((t) => ({ value: t, label: CONTENT_TYPE_LABELS[t] }))}
              onChange={(contentType) => updateSettings({ contentType })}
            />
          </Row>
          {settings.contentType === 'mixed' && (
            <div className="grid grid-cols-2 gap-1 pl-2 text-sm">
              {CONCRETE_CONTENT_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2">
                  <Toggle checked={settings.mixedTypes.includes(t)} onChange={(on) => toggleMixed(t, on)} />
                  {CONTENT_TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          )}
          <Row label="Difficulty preset">
            <Select<Preset> value={settings.preset} options={PRESETS.map((p) => ({ value: p, label: p }))} onChange={(preset) => updateSettings({ preset })} />
          </Row>
          <Row label="Surname flavour">
            <Select<SurnameFlavour>
              value={settings.surnameFlavour}
              options={[
                { value: 'british', label: 'British' },
                { value: 'american', label: 'American' },
                { value: 'both', label: 'both' },
              ]}
              onChange={(surnameFlavour) => updateSettings({ surnameFlavour })}
            />
          </Row>
          <Row label="Read whole word first" hint="surnames only">
            <Toggle checked={settings.readWholeFirst} onChange={(readWholeFirst) => updateSettings({ readWholeFirst })} />
          </Row>
          <Row label="Announce type" hint="“postcode:” before spelling">
            <Toggle checked={settings.announceType} onChange={(announceType) => updateSettings({ announceType })} />
          </Row>
        </Group>

        <Group title="Speech">
          <VoicePicker
            voices={voices}
            voiceURI={settings.voiceURI}
            locale={settings.locale}
            onVoiceChange={(voiceURI) => updateSettings({ voiceURI })}
            onLocaleChange={(locale) => updateSettings({ locale })}
            onTest={onTestVoice}
          />
          <Row label="Random accent each item" hint="a different English voice per item">
            <Toggle checked={settings.randomAccent} onChange={(randomAccent) => updateSettings({ randomAccent })} />
          </Row>
          <Row label="Speech rate">
            <Range value={settings.rate} min={0.7} max={1.3} step={0.05} format={(v) => v.toFixed(2)} onChange={(rate) => updateSettings({ rate })} />
          </Row>
          <Row label="Zero style">
            <Select<ZeroStyle>
              value={settings.zeroStyle}
              options={[
                { value: 'oh', label: 'oh' },
                { value: 'zero', label: 'zero' },
                { value: 'random', label: 'random' },
              ]}
              onChange={(zeroStyle) => updateSettings({ zeroStyle })}
            />
          </Row>
          <Row label="Grouping" hint="“double L” / “triple 7”">
            <Select<GroupingMode>
              value={settings.grouping}
              options={[
                { value: 'never', label: 'never' },
                { value: 'always', label: 'always' },
                { value: 'random', label: 'random' },
              ]}
              onChange={(grouping) => updateSettings({ grouping })}
            />
          </Row>
        </Group>

        <Group title="Timing">
          <Row label="Gap between characters" hint="[ and ] adjust it any time">
            <Range value={settings.gapMs} min={GAP_MIN} max={GAP_MAX} step={GAP_STEP} format={formatGap} onChange={(gapMs) => updateSettings({ gapMs })} />
          </Row>
          <Row label="Adaptive speed">
            <Toggle checked={settings.adaptive} onChange={(adaptive) => updateSettings({ adaptive })} />
          </Row>
          <Row label="Auto-submit silence" hint="after dictation ends">
            <Range
              value={settings.autoSubmitSilenceMs}
              min={500}
              max={3000}
              step={100}
              format={(v) => `${(v / 1000).toFixed(1)} s`}
              onChange={(autoSubmitSilenceMs) => updateSettings({ autoSubmitSilenceMs })}
            />
          </Row>
        </Group>

        <Group title="Feedback">
          <Row label="Live token boxes" hint="show and colour tokens while dictating">
            <Toggle checked={settings.liveFeedback} onChange={(liveFeedback) => updateSettings({ liveFeedback })} />
          </Row>
          <Row label="Allow one replay" hint="Tab or Ctrl+R while dictating">
            <Toggle checked={settings.allowReplay} onChange={(allowReplay) => updateSettings({ allowReplay })} />
          </Row>
          <Row label="Ding on correct">
            <Toggle checked={settings.ding} onChange={(ding) => updateSettings({ ding })} />
          </Row>
        </Group>

        <Group title="Scoring">
          <Row label="Ignore spaces" hint="postcode space optional">
            <Toggle checked={settings.ignoreSpaces} onChange={(ignoreSpaces) => updateSettings({ ignoreSpaces })} />
          </Row>
        </Group>

        <details className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-zinc-500">Advanced</summary>
          <div className="mt-3 flex flex-col gap-4">
            <div>
              <h4 className="mb-2 text-sm">Pronunciation map</h4>
              <PronunciationEditor overrides={settings.pronunciationOverrides} onChange={(pronunciationOverrides) => updateSettings({ pronunciationOverrides })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={button} onClick={() => updateSettings({ gapMs: GAP_DEFAULT })}>
                Reset speed to default
              </button>
              <button type="button" className={button} onClick={onExport}>
                Export JSON
              </button>
              <button type="button" className={`${button} text-red-700 dark:text-red-400`} onClick={onClearHistory}>
                Clear history
              </button>
              <button type="button" className={`${button} text-red-700 dark:text-red-400`} onClick={resetSettings}>
                Reset all settings
              </button>
            </div>
          </div>
        </details>
      </aside>
    </div>
  );
}
