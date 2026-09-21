'use client';

import { memo, type ChangeEvent, type Ref } from 'react';

export interface TrainerInputProps {
  ref?: Ref<HTMLInputElement>;
  value: string;
  /** `inserted` is the text a keystroke added (null for deletions and other edits). */
  onInput: (value: string, inserted: string | null) => void;
  readOnly?: boolean;
}

/**
 * The large monospace input. Kept in its own memoised component so typing never waits
 * on the rest of the page; the value is uppercased for display only.
 */
function TrainerInputBase({ ref, value, onInput, readOnly = false }: TrainerInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    const native = e.nativeEvent as Partial<InputEvent>;
    let inserted: string | null = null;
    if (typeof native.inputType === 'string' && native.inputType.startsWith('insert')) {
      inserted = native.data ?? (next.length > value.length ? next.slice(value.length) : null);
    }
    onInput(next, inserted);
  };

  return (
    <input
      ref={ref}
      type="text"
      value={value}
      onChange={handleChange}
      readOnly={readOnly}
      autoFocus
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      aria-label="Type what you hear"
      className="w-full rounded-xl border-2 border-zinc-300 bg-white px-5 py-4 text-center font-mono text-[2.5rem] uppercase leading-none tracking-[0.15em] text-zinc-900 outline-none transition-colors focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-blue-400"
    />
  );
}

export const TrainerInput = memo(TrainerInputBase);
