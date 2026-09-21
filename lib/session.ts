import type { Attempt, Session, Settings } from '@/types';
import { sanitiseSettings } from './settings';

/** Keep the persisted session bounded. */
export const MAX_ATTEMPTS = 500;

function makeSessionId(now: number): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `s-${now.toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function newSession(settings: Settings, now = Date.now()): Session {
  return { id: makeSessionId(now), startedAt: now, attempts: [], settingsSnapshot: settings };
}

function looksLikeAttempt(raw: unknown): raw is Attempt {
  if (!raw || typeof raw !== 'object') return false;
  const a = raw as Record<string, unknown>;
  const item = a.item as Record<string, unknown> | undefined;
  return (
    typeof a.typed === 'string' &&
    typeof a.correct === 'boolean' &&
    typeof a.gapMs === 'number' &&
    !!item &&
    typeof item.target === 'string' &&
    Array.isArray(item.tokens) &&
    typeof item.contentType === 'string'
  );
}

/** Validate a persisted session; start a fresh one when it is missing or malformed. */
export function sanitiseSession(raw: unknown, settings: Settings): Session {
  if (!raw || typeof raw !== 'object') return newSession(settings);
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id === 'pending' || typeof r.startedAt !== 'number' || !Array.isArray(r.attempts)) {
    return newSession(settings);
  }
  const attempts = (r.attempts as unknown[]).filter(looksLikeAttempt).map((a) => ({
    ...a,
    keystrokeTimes: Array.isArray(a.keystrokeTimes) ? a.keystrokeTimes : [],
    keystrokeChars: Array.isArray(a.keystrokeChars) ? a.keystrokeChars : [],
    tokenStartTimes: Array.isArray(a.tokenStartTimes) ? a.tokenStartTimes : [],
    replays: typeof a.replays === 'number' ? a.replays : 0,
    errors: typeof a.errors === 'number' ? a.errors : 0,
    lagged: typeof a.lagged === 'boolean' ? a.lagged : false,
  }));
  return {
    id: r.id,
    startedAt: r.startedAt,
    attempts: attempts.slice(-MAX_ATTEMPTS),
    settingsSnapshot: sanitiseSettings(r.settingsSnapshot),
  };
}

export function appendAttempt(session: Session, attempt: Attempt): Session {
  const attempts = [...session.attempts, attempt];
  return { ...session, attempts: attempts.length > MAX_ATTEMPTS ? attempts.slice(-MAX_ATTEMPTS) : attempts };
}

export function exportSessionJSON(session: Session): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), session }, null, 2);
}
