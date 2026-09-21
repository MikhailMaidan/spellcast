'use client';

import { defaultSpokenForm, overrideKey, PRONOUNCEABLE_CHARS } from '@/lib/speech/pronounce';
import type { PronunciationColumn } from '@/types';

export interface PronunciationEditorProps {
  overrides: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

const COLUMNS: { key: PronunciationColumn; label: string }[] = [
  { key: 'gb', label: 'en-GB' },
  { key: 'us', label: 'en-US' },
];

/** Editable spoken-form table (§6.2). Empty cells fall back to the built-in map. */
export function PronunciationEditor({ overrides, onChange }: PronunciationEditorProps) {
  const setCell = (column: PronunciationColumn, ch: string, value: string) => {
    const key = overrideKey(column, ch);
    const next = { ...overrides };
    if (value.trim()) next[key] = value;
    else delete next[key];
    onChange(next);
  };
  const count = Object.keys(overrides).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{count ? `${count} override${count === 1 ? '' : 's'}` : 'Using the built-in map'}</span>
        {count > 0 && (
          <button type="button" className="underline" onClick={() => onChange({})}>
            clear overrides
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-zinc-500">
          <tr>
            <th className="py-1 font-normal">char</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="py-1 font-normal">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PRONOUNCEABLE_CHARS.map((ch) => (
            <tr key={ch} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-0.5 font-mono">{ch}</td>
              {COLUMNS.map((c) => (
                <td key={c.key} className="py-0.5 pr-1">
                  <input
                    type="text"
                    value={overrides[overrideKey(c.key, ch)] ?? ''}
                    placeholder={defaultSpokenForm(ch, c.key)}
                    onChange={(e) => setCell(c.key, ch, e.target.value)}
                    className="w-full rounded border border-zinc-300 bg-white px-1.5 py-0.5 font-mono text-xs placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-zinc-500">An override for 0 replaces both “oh” and “zero”; leave it empty to keep the zero-style setting.</p>
    </div>
  );
}
