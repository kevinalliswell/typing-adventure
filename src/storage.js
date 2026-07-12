import { COURSE_DAYS, DIFFICULTIES, SESSIONS_PER_DAY, createProfile } from "./engine.js";
import { normalizeAudioSettings } from "./audio.js";

export const STORAGE_KEY = "typing-adventure:profile";
const MAX_SESSIONS = COURSE_DAYS * SESSIONS_PER_DAY;

function finiteInteger(value, fallback = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(0, Math.floor(number)));
}

function sanitizeKeyStats(stats) {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) return {};
  return Object.fromEntries(Object.entries(stats).slice(0, 80).flatMap(([key, value]) => {
    if (typeof key !== "string" || key.length > 8 || !value || typeof value !== "object") return [];
    return [[key, {
      hits: finiteInteger(value.hits),
      errors: finiteInteger(value.errors),
    }]];
  }));
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-MAX_SESSIONS).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    return [{
      dayNumber: finiteInteger(entry.dayNumber, 1, COURSE_DAYS) || 1,
      sessionNumber: finiteInteger(entry.sessionNumber, 1, SESSIONS_PER_DAY) || 1,
      accuracy: Math.min(1, Math.max(0, Number(entry.accuracy) || 0)),
      elapsedSeconds: Math.min(20 * 60, Math.max(0, Number(entry.elapsedSeconds) || 0)),
      completedAt: typeof entry.completedAt === "string" ? entry.completedAt.slice(0, 40) : null,
    }];
  });
}

export function sanitizeProfile(value) {
  const profile = createProfile();
  if (!value || typeof value !== "object" || Array.isArray(value)) return profile;
  const difficultyId = Object.hasOwn(DIFFICULTIES, value.difficultyId) ? value.difficultyId : profile.difficultyId;
  return {
    ...profile,
    version: 1,
    completedSessions: finiteInteger(value.completedSessions, 0, MAX_SESSIONS),
    totalSeconds: Math.min(MAX_SESSIONS * 20 * 60, Math.max(0, Number(value.totalSeconds) || 0)),
    difficultyId,
    audio: normalizeAudioSettings(value.audio),
    keyStats: sanitizeKeyStats(value.keyStats),
    history: sanitizeHistory(value.history),
  };
}

export function loadProfile(storage = globalThis.localStorage) {
  const fallback = createProfile();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? sanitizeProfile(JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

export function saveProfile(profile, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProfile(profile)));
    return true;
  } catch {
    return false;
  }
}

export function clearProfile(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    return false;
  }
  return true;
}
