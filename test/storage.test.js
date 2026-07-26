import test from "node:test";
import assert from "node:assert/strict";

import { clearProfile, loadProfile, saveProfile, STORAGE_KEY } from "../src/storage.js";
import { createProfile } from "../src/engine.js";

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem() { return value; },
    setItem(_key, next) { value = next; },
    removeItem() { value = null; },
  };
}

test("profile round-trips through local storage", () => {
  const storage = memoryStorage();
  const profile = { ...createProfile(), completedSessions: 3, difficultyId: "explorer", sessionPlanId: "full" };

  assert.equal(saveProfile(profile, storage), true);
  assert.equal(storage.getItem(STORAGE_KEY) !== null, true);
  assert.equal(loadProfile(storage).completedSessions, 3);
  assert.equal(loadProfile(storage).difficultyId, "explorer");
  assert.equal(loadProfile(storage).sessionPlanId, "full");
  assert.equal(loadProfile(storage).audio.effectsEnabled, true);
  assert.equal(loadProfile(storage).audio.voiceEnabled, false);
});

test("history keeps stage counts and the counted flag", () => {
  const storage = memoryStorage(JSON.stringify({
    history: [
      { dayNumber: 1, sessionNumber: 1, accuracy: 0.9, elapsedSeconds: 600, completedStages: 4, totalStages: 4, counted: true },
      { dayNumber: 1, sessionNumber: 2, accuracy: 0.7, elapsedSeconds: 120, completedStages: 1, totalStages: 4, counted: false },
      { dayNumber: 2, sessionNumber: 1, accuracy: 0.8, elapsedSeconds: 900 },
    ],
  }));

  const history = loadProfile(storage).history;
  assert.equal(history[0].counted, true);
  assert.equal(history[1].counted, false);
  assert.equal(history[1].completedStages, 1);
  assert.equal(history[2].counted, true, "legacy entries without the flag stay counted");
});

test("corrupt or oversized storage data falls back to safe bounded values", () => {
  const storage = memoryStorage(JSON.stringify({
    completedSessions: 9999,
    difficultyId: "hacker",
    sessionPlanId: "marathon",
    keyStats: { f: { hits: 4, errors: -8 } },
    history: Array.from({ length: 200 }, () => ({ accuracy: 2 })),
  }));

  const profile = loadProfile(storage);
  assert.equal(profile.completedSessions, 84);
  assert.equal(profile.difficultyId, "gentle");
  assert.equal(profile.sessionPlanId, "standard");
  assert.deepEqual(profile.keyStats.f, { hits: 4, errors: 0 });
  assert.equal(profile.history.length, 120);
});

test("invalid JSON does not prevent a new child from starting", () => {
  const storage = memoryStorage("{not-json");
  const profile = loadProfile(storage);

  assert.equal(profile.completedSessions, 0);
  assert.equal(clearProfile(storage), true);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});
