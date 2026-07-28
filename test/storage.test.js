import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PROFILE_NAME,
  LEGACY_PROFILE_KEY,
  MAX_PROFILES,
  ROSTER_KEY,
  addProfile,
  clearDraftData,
  ensureRoster,
  loadDraftData,
  loadProfileData,
  loadRoster,
  profileStorageKey,
  saveDraftData,
  saveProfileData,
  sanitizeRoster,
  setActiveProfile,
} from "../src/storage.js";
import { createProfile } from "../src/engine.js";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

test("first launch creates a default explorer roster", () => {
  const storage = memoryStorage();
  const roster = ensureRoster(storage);

  assert.equal(roster.profiles.length, 1);
  assert.equal(roster.profiles[0].name, DEFAULT_PROFILE_NAME);
  assert.equal(roster.activeId, roster.profiles[0].id);
  assert.equal(loadRoster(storage).profiles.length, 1);
});

test("legacy single-profile data migrates into the first explorer", () => {
  const storage = memoryStorage({
    [LEGACY_PROFILE_KEY]: JSON.stringify({ ...createProfile(), completedSessions: 5, difficultyId: "rocket" }),
  });
  const roster = ensureRoster(storage);
  const migrated = loadProfileData(roster.activeId, storage);

  assert.equal(migrated.completedSessions, 5);
  assert.equal(migrated.difficultyId, "rocket");
  assert.equal(storage.getItem(LEGACY_PROFILE_KEY), null, "legacy key is removed after migration");
});

test("an existing roster is not recreated on later launches", () => {
  const storage = memoryStorage();
  const first = ensureRoster(storage);
  const second = ensureRoster(storage);

  assert.equal(second.activeId, first.activeId);
  assert.equal(second.profiles.length, 1);
});

test("profiles keep progress, key stats and settings separate", () => {
  const storage = memoryStorage();
  const roster = ensureRoster(storage);
  const { roster: withSecond, profile: second } = addProfile(roster, { name: "小宇", avatar: "🐱" }, storage);

  saveProfileData(roster.activeId, { ...createProfile(), completedSessions: 10, keyStats: { f: { hits: 9, errors: 1 } } }, storage);
  saveProfileData(second.id, { ...createProfile(), completedSessions: 2, difficultyId: "explorer" }, storage);

  const firstData = loadProfileData(roster.activeId, storage);
  const secondData = loadProfileData(second.id, storage);
  assert.equal(firstData.completedSessions, 10);
  assert.deepEqual(firstData.keyStats.f, { hits: 9, errors: 1 });
  assert.equal(secondData.completedSessions, 2);
  assert.equal(secondData.difficultyId, "explorer");
  assert.deepEqual(secondData.keyStats, {});
  assert.equal(withSecond.activeId, second.id, "a new explorer becomes active");
});

test("switching the active explorer persists in the roster", () => {
  const storage = memoryStorage();
  const roster = ensureRoster(storage);
  const { roster: withSecond, profile: second } = addProfile(roster, { name: "小宇" }, storage);

  const switched = setActiveProfile(withSecond, roster.activeId, storage);
  assert.equal(switched.activeId, roster.activeId);
  assert.equal(loadRoster(storage).activeId, roster.activeId);
  assert.equal(setActiveProfile(switched, "missing-id", storage).activeId, roster.activeId);
  assert.equal(switched.profiles.some((entry) => entry.id === second.id), true);
});

test("the roster refuses more than the maximum number of explorers", () => {
  const storage = memoryStorage();
  let roster = ensureRoster(storage);
  for (let index = 1; index < MAX_PROFILES; index += 1) {
    roster = addProfile(roster, { name: `探险家${index}` }, storage).roster;
  }

  const overflow = addProfile(roster, { name: "多余" }, storage);
  assert.equal(roster.profiles.length, MAX_PROFILES);
  assert.equal(overflow.profile, null);
  assert.equal(overflow.roster.profiles.length, MAX_PROFILES);
});

test("a corrupt roster falls back without blocking play", () => {
  const storage = memoryStorage({ [ROSTER_KEY]: "{broken" });
  const roster = ensureRoster(storage);

  assert.equal(roster.profiles.length, 1);
  assert.equal(sanitizeRoster([1, 2, 3]).profiles.length, 0);
  assert.equal(sanitizeRoster({ activeId: "ghost", profiles: [{ id: "a b c" }] }).profiles.length, 0);
});

test("profile data round-trips and sanitizes under its own key", () => {
  const storage = memoryStorage();
  const saved = saveProfileData("kid-1", { ...createProfile(), completedSessions: 3, sessionPlanId: "full" }, storage);

  assert.equal(saved, true);
  assert.notEqual(storage.getItem(profileStorageKey("kid-1")), null);
  assert.equal(loadProfileData("kid-1", storage).completedSessions, 3);
  assert.equal(loadProfileData("kid-1", storage).sessionPlanId, "full");
  assert.equal(loadProfileData("other", storage).completedSessions, 0, "unknown ids start fresh");
});

test("corrupt or oversized profile data falls back to safe bounded values", () => {
  const storage = memoryStorage({
    [profileStorageKey("kid-1")]: JSON.stringify({
      completedSessions: 9999,
      difficultyId: "hacker",
      sessionPlanId: "marathon",
      keyStats: { f: { hits: 4, errors: -8 } },
      history: Array.from({ length: 200 }, () => ({ accuracy: 2 })),
    }),
  });

  const profile = loadProfileData("kid-1", storage);
  assert.equal(profile.completedSessions, 84);
  assert.equal(profile.difficultyId, "gentle");
  assert.equal(profile.sessionPlanId, "standard");
  assert.deepEqual(profile.keyStats.f, { hits: 4, errors: 0 });
  assert.equal(profile.history.length, 120);
});

test("history keeps stage counts and the counted flag", () => {
  const storage = memoryStorage({
    [profileStorageKey("kid-1")]: JSON.stringify({
      history: [
        { dayNumber: 1, sessionNumber: 1, accuracy: 0.9, elapsedSeconds: 600, completedStages: 4, totalStages: 4, counted: true },
        { dayNumber: 1, sessionNumber: 2, accuracy: 0.7, elapsedSeconds: 120, completedStages: 1, totalStages: 4, counted: false },
        { dayNumber: 2, sessionNumber: 1, accuracy: 0.8, elapsedSeconds: 900 },
      ],
    }),
  });

  const history = loadProfileData("kid-1", storage).history;
  assert.equal(history[0].counted, true);
  assert.equal(history[1].counted, false);
  assert.equal(history[1].completedStages, 1);
  assert.equal(history[2].counted, true, "legacy entries without the flag stay counted");
});

test("drafts round-trip per explorer and survive corruption safely", () => {
  const storage = memoryStorage();
  const draft = { version: 2, savedAt: 123, plan: { dayNumber: 3, sessionNumber: 1 }, state: { score: 45 } };

  assert.equal(saveDraftData("kid-1", draft, storage), true);
  assert.deepEqual(loadDraftData("kid-1", storage), draft);
  assert.equal(loadDraftData("kid-2", storage), null, "drafts do not leak between explorers");

  storage.setItem("typing-adventure:draft:kid-1", "{broken");
  assert.equal(loadDraftData("kid-1", storage), null);
  assert.equal(clearDraftData("kid-1", storage), true);
  assert.equal(storage.getItem("typing-adventure:draft:kid-1"), null);
});

test("a missing storage backend never blocks play", () => {
  assert.equal(loadProfileData("kid-1", null).completedSessions, 0);
  assert.equal(saveProfileData("kid-1", createProfile(), null), false);
  assert.equal(loadRoster(null).profiles.length, 0);
  assert.equal(loadDraftData("kid-1", null), null);
});
