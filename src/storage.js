import {
  COURSE_DAYS,
  DIFFICULTIES,
  HISTORY_LIMIT,
  MAX_SESSION_SECONDS,
  SESSION_PLANS,
  SESSIONS_PER_DAY,
  createProfile,
} from "./engine.js";
import { normalizeAudioSettings } from "./audio.js";

export const LEGACY_PROFILE_KEY = "typing-adventure:profile";
export const ROSTER_KEY = "typing-adventure:profiles";
export const PROFILE_KEY_PREFIX = "typing-adventure:profile:";
export const DRAFT_KEY_PREFIX = "typing-adventure:draft:";
export const MAX_PROFILES = 8;
export const DEFAULT_PROFILE_NAME = "小星探";
export const PROFILE_AVATARS = Object.freeze(["🚀", "🌟", "🐱", "🐶", "🦊", "🐼", "🦄", "🐸"]);

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
  return history.slice(-HISTORY_LIMIT).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const totalStages = finiteInteger(entry.totalStages, 0, 12);
    return [{
      dayNumber: finiteInteger(entry.dayNumber, 1, COURSE_DAYS) || 1,
      sessionNumber: finiteInteger(entry.sessionNumber, 1, SESSIONS_PER_DAY) || 1,
      accuracy: Math.min(1, Math.max(0, Number(entry.accuracy) || 0)),
      elapsedSeconds: Math.min(MAX_SESSION_SECONDS, Math.max(0, Number(entry.elapsedSeconds) || 0)),
      completedAt: typeof entry.completedAt === "string" ? entry.completedAt.slice(0, 40) : null,
      completedStages: finiteInteger(entry.completedStages, 0, totalStages || 12),
      totalStages,
      counted: entry.counted === undefined ? true : entry.counted === true,
    }];
  });
}

export function sanitizeProfile(value) {
  const profile = createProfile();
  if (!value || typeof value !== "object" || Array.isArray(value)) return profile;
  const difficultyId = Object.hasOwn(DIFFICULTIES, value.difficultyId) ? value.difficultyId : profile.difficultyId;
  const sessionPlanId = Object.hasOwn(SESSION_PLANS, value.sessionPlanId) ? value.sessionPlanId : profile.sessionPlanId;
  return {
    ...profile,
    version: 1,
    completedSessions: finiteInteger(value.completedSessions, 0, MAX_SESSIONS),
    totalSeconds: Math.min(MAX_SESSIONS * MAX_SESSION_SECONDS, Math.max(0, Number(value.totalSeconds) || 0)),
    difficultyId,
    sessionPlanId,
    audio: normalizeAudioSettings(value.audio),
    keyStats: sanitizeKeyStats(value.keyStats),
    history: sanitizeHistory(value.history),
  };
}

export function generateProfileId(now = Date.now, random = Math.random) {
  const suffix = Math.floor(random() * 36 ** 4).toString(36).padStart(4, "0");
  return `p${now().toString(36)}${suffix}`;
}

function sanitizeRosterEntry(value) {
  if (!value || typeof value !== "object") return null;
  const id = typeof value.id === "string" && /^[\w-]{1,40}$/.test(value.id) ? value.id : null;
  if (!id) return null;
  const name = typeof value.name === "string" && value.name.trim() ? value.name.trim().slice(0, 12) : DEFAULT_PROFILE_NAME;
  const avatar = typeof value.avatar === "string" && value.avatar && [...value.avatar].length <= 2 ? value.avatar : PROFILE_AVATARS[0];
  const createdAt = typeof value.createdAt === "string" ? value.createdAt.slice(0, 40) : null;
  return { id, name, avatar, createdAt };
}

export function sanitizeRoster(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { version: 1, activeId: null, profiles: [] };
  }
  const seen = new Set();
  const profiles = (Array.isArray(value.profiles) ? value.profiles : []).flatMap((entry) => {
    const clean = sanitizeRosterEntry(entry);
    if (!clean || seen.has(clean.id)) return [];
    seen.add(clean.id);
    return [clean];
  }).slice(0, MAX_PROFILES);
  const activeId = profiles.some((profile) => profile.id === value.activeId)
    ? value.activeId
    : (profiles[0]?.id ?? null);
  return { version: 1, activeId, profiles };
}

export function loadRoster(storage = globalThis.localStorage) {
  if (!storage) return sanitizeRoster(null);
  try {
    return sanitizeRoster(JSON.parse(storage.getItem(ROSTER_KEY) ?? "null"));
  } catch {
    return sanitizeRoster(null);
  }
}

export function saveRoster(roster, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(ROSTER_KEY, JSON.stringify(sanitizeRoster(roster)));
    return true;
  } catch {
    return false;
  }
}

export function profileStorageKey(id) {
  return `${PROFILE_KEY_PREFIX}${id}`;
}

export function draftStorageKey(id) {
  return `${DRAFT_KEY_PREFIX}${id}`;
}

export function loadProfileData(id, storage = globalThis.localStorage) {
  const fallback = createProfile();
  if (!storage || !id) return fallback;
  try {
    const raw = storage.getItem(profileStorageKey(id));
    return raw ? sanitizeProfile(JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

export function saveProfileData(id, profile, storage = globalThis.localStorage) {
  if (!storage || !id) return false;
  try {
    storage.setItem(profileStorageKey(id), JSON.stringify(sanitizeProfile(profile)));
    return true;
  } catch {
    return false;
  }
}

export function clearProfileData(id, storage = globalThis.localStorage) {
  try {
    storage?.removeItem(profileStorageKey(id));
  } catch {
    return false;
  }
  return true;
}

// 首次启动或旧版本升级时保证有可用的花名册：
// 没有任何档案时创建默认探险家，并把旧版单档案数据迁移到新键下。
export function ensureRoster(storage = globalThis.localStorage) {
  const roster = loadRoster(storage);
  if (roster.profiles.length > 0) return roster;
  const entry = {
    id: generateProfileId(),
    name: DEFAULT_PROFILE_NAME,
    avatar: PROFILE_AVATARS[0],
    createdAt: new Date().toISOString(),
  };
  if (storage) {
    try {
      const legacyRaw = storage.getItem(LEGACY_PROFILE_KEY);
      if (legacyRaw) {
        storage.setItem(profileStorageKey(entry.id), JSON.stringify(sanitizeProfile(JSON.parse(legacyRaw))));
        storage.removeItem(LEGACY_PROFILE_KEY);
      }
    } catch {
      // 迁移失败时按全新档案继续，不阻塞开始练习。
    }
  }
  const next = { version: 1, activeId: entry.id, profiles: [entry] };
  saveRoster(next, storage);
  return next;
}

export function addProfile(roster, { name, avatar } = {}, storage = globalThis.localStorage) {
  const clean = sanitizeRoster(roster);
  if (clean.profiles.length >= MAX_PROFILES) return { roster: clean, profile: null };
  const entry = sanitizeRosterEntry({
    id: generateProfileId(),
    name,
    avatar,
    createdAt: new Date().toISOString(),
  });
  const next = { version: 1, activeId: entry.id, profiles: [...clean.profiles, entry] };
  saveRoster(next, storage);
  saveProfileData(entry.id, createProfile(), storage);
  return { roster: next, profile: entry };
}

export function setActiveProfile(roster, id, storage = globalThis.localStorage) {
  const clean = sanitizeRoster(roster);
  if (!clean.profiles.some((profile) => profile.id === id)) return clean;
  const next = { ...clean, activeId: id };
  saveRoster(next, storage);
  return next;
}

export function loadDraftData(id, storage = globalThis.localStorage) {
  if (!storage || !id) return null;
  try {
    const value = JSON.parse(storage.getItem(draftStorageKey(id)) ?? "null");
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveDraftData(id, draft, storage = globalThis.localStorage) {
  if (!storage || !id) return false;
  try {
    storage.setItem(draftStorageKey(id), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraftData(id, storage = globalThis.localStorage) {
  try {
    storage?.removeItem(draftStorageKey(id));
  } catch {
    return false;
  }
  return true;
}
