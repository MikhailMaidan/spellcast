/**
 * Typed localStorage wrapper. Every access is wrapped in try/catch and falls back
 * to an in-memory map so the app keeps working in private mode or when storage is blocked.
 */

const memory = new Map<string, string>();

export const STORAGE_KEYS = {
  settings: 'spellcast.settings.v3',
  session: 'spellcast.session.v1',
} as const;

/** Older settings keys, newest first, read once when the current key is empty. */
export const LEGACY_SETTINGS_KEYS = ['spellcast.settings.v2', 'spellcast.settings.v1'] as const;

function readRaw(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const v = window.localStorage.getItem(key);
      if (v !== null) return v;
    }
  } catch {
    /* fall through to memory */
  }
  return memory.get(key) ?? null;
}

function writeRaw(key: string, value: string): boolean {
  memory.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return true;
    }
  } catch {
    /* memory copy already written */
  }
  return false;
}

export function loadJSON<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Returns true when the value reached localStorage (false = memory only). */
export function saveJSON(key: string, value: unknown): boolean {
  try {
    return writeRaw(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  memory.delete(key);
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
