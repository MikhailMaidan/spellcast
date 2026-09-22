'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { Attempt, Session, Settings } from '@/types';
import { appendAttempt, newSession } from '@/lib/session';
import { DEFAULT_SETTINGS, sanitiseSettings } from '@/lib/settings';
import { sessionStore, settingsStore, useHydrated, useStore } from '@/lib/store';

export interface TrainerContextValue {
  settings: Settings;
  session: Session;
  /** False until the client has taken over from server-rendered HTML. */
  hydrated: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  addAttempt: (attempt: Attempt) => void;
  clearSession: () => void;
}

const TrainerContext = createContext<TrainerContextValue | null>(null);

/** Provides persisted settings and the current session to the whole app. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useStore(settingsStore);
  const session = useStore(sessionStore);
  const hydrated = useHydrated();

  // The whole layout is rem-based, so the root font size scales the interface uniformly.
  // null leaves the stylesheet's screen-width-based default in place.
  useEffect(() => {
    document.documentElement.style.fontSize = settings.uiScale === null ? '' : `${16 * settings.uiScale}px`;
  }, [settings.uiScale]);

  const value = useMemo<TrainerContextValue>(
    () => ({
      settings,
      session,
      hydrated,
      updateSettings: (patch) => settingsStore.set((prev) => sanitiseSettings({ ...prev, ...patch })),
      resetSettings: () => settingsStore.set({ ...DEFAULT_SETTINGS }),
      addAttempt: (attempt) => sessionStore.set((prev) => appendAttempt(prev, attempt)),
      clearSession: () => sessionStore.set(newSession(settingsStore.get())),
    }),
    [settings, session, hydrated],
  );

  return <TrainerContext.Provider value={value}>{children}</TrainerContext.Provider>;
}

export function useTrainer(): TrainerContextValue {
  const ctx = useContext(TrainerContext);
  if (!ctx) throw new Error('useTrainer must be used inside <SettingsProvider>');
  return ctx;
}
