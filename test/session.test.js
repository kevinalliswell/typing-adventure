import test from "node:test";
import assert from "node:assert/strict";

import {
  SESSION_GATES,
  getSessionProgress,
  shouldShowTargetHint,
} from "../src/session.js";
import { DIFFICULTIES } from "../src/engine.js";

function runState(overrides = {}) {
  return {
    correct: 0,
    total: 0,
    completedPrompts: 0,
    completedGates: 0,
    consecutiveErrors: 0,
    ...overrides,
  };
}

test("three gates increase correct-key, station, and accuracy requirements", () => {
  assert.deepEqual(
    SESSION_GATES.map(({ minCorrect, minStations }) => [minCorrect, minStations]),
    [[12, 2], [36, 6], [60, 10]],
  );

  const warmup = getSessionProgress(
    runState({ correct: 12, total: 15, completedPrompts: 2 }),
    DIFFICULTIES.gentle,
  );
  assert.equal(warmup.completedGates, 1);
  assert.equal(warmup.complete, false);

  const challenge = getSessionProgress(
    runState({ correct: 60, total: 69, completedPrompts: 10 }),
    DIFFICULTIES.gentle,
  );
  assert.equal(challenge.completedGates, 3);
  assert.equal(challenge.complete, true);
});

test("final gate uses the selected difficulty accuracy target", () => {
  const run = runState({ correct: 60, total: 65, completedPrompts: 10 });

  assert.equal(getSessionProgress(run, DIFFICULTIES.gentle).complete, true);
  assert.equal(getSessionProgress(run, DIFFICULTIES.explorer).complete, true);
  assert.equal(getSessionProgress(run, DIFFICULTIES.rocket).complete, false);
});

test("hints become scarcer by gate and return after repeated errors", () => {
  assert.equal(shouldShowTargetHint(DIFFICULTIES.rocket, 0, 0), true);
  assert.equal(shouldShowTargetHint(DIFFICULTIES.gentle, 1, 0), true);
  assert.equal(shouldShowTargetHint(DIFFICULTIES.explorer, 1, 0), false);
  assert.equal(shouldShowTargetHint(DIFFICULTIES.explorer, 1, 2), true);
  assert.equal(shouldShowTargetHint(DIFFICULTIES.rocket, 2, 2), false);
  assert.equal(shouldShowTargetHint(DIFFICULTIES.rocket, 2, 3), true);
});

test("a cleared gate never regresses after later mistakes", () => {
  const progress = getSessionProgress(
    runState({ correct: 12, total: 16, completedPrompts: 2, completedGates: 1 }),
    DIFFICULTIES.gentle,
  );

  assert.equal(progress.completedGates, 1);
  assert.equal(progress.gate.id, "mission");
});
