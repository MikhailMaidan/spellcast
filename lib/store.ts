/**
 * Tiny persistent stores read through useSyncExternalStore. The server snapshot is the
 * default value, so server-rendered HTML and the first client render match; the stored
 * value takes over right after hydration without a mismatch.
 */
import { useSyncExternalStore } from 'react';
import type { Session, Settings } from '@/types';
import { sanitiseSession } from './session';
import { DEFAULT_SETTINGS, sanitiseSettings } from './settings';
import { LEGACY_SETTINGS_KEYS, loadJSON, saveJSON, STORAGE_KEYS } from './storage';

export interface PersistentStore<T> {
  get(): T;
  getServer(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createPersistentStore<T>(
  key: string,
  serverValue: T,
  sanitise: (raw: unknown) => T,
  load: () => unknown = () => loadJSON<unknown>(key, undefined),
): PersistentStore<T> {
  let value: T | undefined;
  const listeners = new Set<() => void>();
  const ensure = (): T => {
    if (value === undefined) value = sanitise(load());
    return value;
  };
  return {
    get: ensure,
    getServer: () => serverValue,
    set(next) {
      const prev = ensure();
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      if (Object.is(v, prev)) return;
      value = v;
      saveJSON(key, v);
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useStore<T>(store: PersistentStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}

const noop = () => () => {};
/** false during server render and hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

const SERVER_SESSION: Session = { id: 'pending', startedAt: 0, attempts: [], settingsSnapshot: DEFAULT_SETTINGS };

/** Current settings, or the previous version's settings minus the fields whose defaults changed. */
function loadSettingsRaw(): unknown {
  const current = loadJSON<unknown>(STORAGE_KEYS.settings, undefined);
  if (current !== undefined) return current;
  for (const key of LEGACY_SETTINGS_KEYS) {
    const legacy = loadJSON<Record<string, unknown> | undefined>(key, undefined);
    if (legacy && typeof legacy === 'object') {
      const migrated = { ...legacy };
      delete migrated.delivery;
      delete migrated.continuousPause;
      return migrated;
    }
  }
  return undefined;
}

export const settingsStore = createPersistentStore<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS, sanitiseSettings, loadSettingsRaw);
export const sessionStore = createPersistentStore<Session>(STORAGE_KEYS.session, SERVER_SESSION, (raw) =>
  sanitiseSession(raw, settingsStore.get()),
);
