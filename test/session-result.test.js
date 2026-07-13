import test from "node:test";
import assert from "node:assert/strict";

import { completeSession, createProfile } from "../src/engine.js";

test("a timed session with zero input stores a safe zero-accuracy result", () => {
  const profile = completeSession(createProfile(), {
    accuracy: 0,
    elapsedSeconds: 1200,
    completedAt: "2026-07-13T00:00:00.000Z",
  });

  assert.equal(profile.completedSessions, 1);
  assert.equal(profile.totalSeconds, 1200);
  assert.equal(profile.history[0].accuracy, 0);
  assert.equal(profile.history[0].elapsedSeconds, 1200);
});