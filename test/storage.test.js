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
  const profile = { ...createProfile(), completedSessions: 3, difficultyId: "explorer", sessionMinutes: 15 };

  assert.equal(saveProfile(profile, storage), true);
  assert.equal(storage.getItem(STORAGE_KEY) !== null, true);
  assert.equal(loadProfile(storage).completedSessions, 3);
  assert.equal(loadProfile(storage).difficultyId, "explorer");
  assert.equal(loadProfile(storage).sessionMinutes, 15);
  assert.equal(loadProfile(storage).audio.effectsEnabled, true);
  assert.equal(loadProfile(storage).audio.voiceEnabled, false);
});

test("corrupt or oversized storage data falls back to safe bounded values", () => {
  const storage = memoryStorage(JSON.stringify({
    completedSessions: 9999,
    difficultyId: "hacker",
    sessionMinutes: 20,
    keyStats: { f: { hits: 4, errors: -8 } },
    history: Array.from({ length: 200 }, () => ({ accuracy: 2 })),
  }));

  const profile = loadProfile(storage);
  assert.equal(profile.completedSessions, 84);
  assert.equal(profile.difficultyId, "gentle");
  assert.equal(profile.sessionMinutes, 5);
  assert.deepEqual(profile.keyStats.f, { hits: 4, errors: 0 });
  assert.equal(profile.history.length, 84);
});

test("profiles without a duration migrate to five minutes without truncating legacy history", () => {
  const storage = memoryStorage(JSON.stringify({
    totalSeconds: 1200,
    history: [{ dayNumber: 1, sessionNumber: 1, accuracy: 0.9, elapsedSeconds: 1200 }],
  }));

  const profile = loadProfile(storage);

  assert.equal(profile.sessionMinutes, 5);
  assert.equal(profile.totalSeconds, 1200);
  assert.equal(profile.history[0].elapsedSeconds, 1200);
});

test("invalid JSON does not prevent a new child from starting", () => {
  const storage = memoryStorage("{not-json");
  const profile = loadProfile(storage);

  assert.equal(profile.completedSessions, 0);
  assert.equal(clearProfile(storage), true);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});
