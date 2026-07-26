import test from "node:test";
import assert from "node:assert/strict";

import { completeSession, createProfile } from "../src/engine.js";

test("finishing every stage counts a full session", () => {
  const profile = completeSession(createProfile(), {
    accuracy: 0.9,
    elapsedSeconds: 900,
    completedStages: 4,
    totalStages: 4,
    completedAt: "2026-07-26T00:00:00.000Z",
  });

  assert.equal(profile.completedSessions, 1);
  assert.equal(profile.totalSeconds, 900);
  assert.equal(profile.history.length, 1);
  assert.equal(profile.history[0].counted, true);
  assert.equal(profile.history[0].completedStages, 4);
  assert.equal(profile.history[0].totalStages, 4);
});

test("finishing at least half of the stages still earns the session", () => {
  const profile = completeSession(createProfile(), {
    accuracy: 0.85,
    elapsedSeconds: 420,
    completedStages: 2,
    totalStages: 4,
  });

  assert.equal(profile.completedSessions, 1);
  assert.equal(profile.history[0].counted, true);
});

test("stopping before half of the stages records a warmup without credit", () => {
  const profile = completeSession(createProfile(), {
    accuracy: 0.8,
    elapsedSeconds: 300,
    completedStages: 1,
    totalStages: 4,
  });

  assert.equal(profile.completedSessions, 0);
  assert.equal(profile.totalSeconds, 300);
  assert.equal(profile.history.length, 1);
  assert.equal(profile.history[0].counted, false);
  assert.equal(profile.history[0].completedStages, 1);
});

test("a result without stage information is stored but never counted", () => {
  const profile = completeSession(createProfile(), {
    accuracy: 0,
    elapsedSeconds: 1200,
    completedAt: "2026-07-13T00:00:00.000Z",
  });

  assert.equal(profile.completedSessions, 0);
  assert.equal(profile.totalSeconds, 1200);
  assert.equal(profile.history[0].accuracy, 0);
  assert.equal(profile.history[0].counted, false);
});
