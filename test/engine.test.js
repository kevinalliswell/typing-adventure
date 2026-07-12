import test from "node:test";
import assert from "node:assert/strict";

import {
  COURSE,
  DIFFICULTIES,
  ACTIVITIES,
  choosePrompt,
  completeSession,
  createProfile,
  getActivity,
  getActivityForPrompt,
  getDailyPlan,
  getLesson,
  getWeakestKey,
  recordKey,
} from "../src/engine.js";

test("the summer course has 42 daily lessons with two sessions per day", () => {
  assert.equal(COURSE.length, 42);
  assert.equal(getDailyPlan(createProfile()).dayNumber, 1);
  assert.equal(getDailyPlan(createProfile()).sessionNumber, 1);

  const afterOneSession = completeSession(createProfile(), {
    accuracy: 0.95,
    elapsedSeconds: 1200,
  });
  assert.equal(getDailyPlan(afterOneSession).dayNumber, 1);
  assert.equal(getDailyPlan(afterOneSession).sessionNumber, 2);

  const afterTwoSessions = completeSession(afterOneSession, {
    accuracy: 0.95,
    elapsedSeconds: 1200,
  });
  assert.equal(getDailyPlan(afterTwoSessions).dayNumber, 2);
  assert.equal(getDailyPlan(afterTwoSessions).sessionNumber, 1);
});

test("course keys unlock in a gentle home-row to full-keyboard progression", () => {
  const first = getLesson(1);
  const homeRow = getLesson(7);
  const upperRow = getLesson(14);
  const fullAlphabet = getLesson(21);
  const punctuation = getLesson(35);

  assert.deepEqual(first.newKeys, ["f", "j"]);
  assert.ok(homeRow.activeKeys.includes("a"));
  assert.ok(homeRow.activeKeys.includes(";"));
  assert.ok(upperRow.activeKeys.includes("q"));
  assert.ok(fullAlphabet.activeKeys.includes("z"));
  assert.ok(punctuation.activeKeys.includes("space"));
  assert.equal(getLesson(42).phase, "celebration");
});

test("a mistyped key becomes the next adaptive focus", () => {
  let profile = createProfile();
  profile = recordKey(profile, "f", true);
  profile = recordKey(profile, "j", true);
  profile = recordKey(profile, "f", false);

  assert.equal(getWeakestKey(profile, ["f", "j"]), "f");
});

test("prompt selection rotates matching drills instead of repeating the first one", () => {
  const profile = createProfile();
  const lesson = getLesson(1);

  assert.equal(choosePrompt(lesson, profile, 0), "fj");
  assert.equal(choosePrompt(lesson, profile, 1), "jf");
  assert.notEqual(choosePrompt(lesson, profile, 2), choosePrompt(lesson, profile, 0));
});

test("practice activities rotate through five short game modes", () => {
  assert.equal(ACTIVITIES.length, 5);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((index) => getActivity(index).id),
    ["star-scout", "balloon-defense", "word-train", "code-lock", "rocket-dash", "star-scout"],
  );
  assert.equal(getActivityForPrompt(0).id, "star-scout");
  assert.equal(getActivityForPrompt(2).id, "star-scout");
  assert.equal(getActivityForPrompt(3).id, "balloon-defense");
  assert.equal(getActivityForPrompt(6).id, "word-train");
  assert.equal(getActivityForPrompt(12).id, "rocket-dash");
});

test("recordKey normalizes letters and tracks accuracy without negative counts", () => {
  let profile = createProfile();
  profile = recordKey(profile, "F", true);
  profile = recordKey(profile, "f", false);
  profile = recordKey(profile, "", false);

  assert.deepEqual(profile.keyStats.f, { hits: 1, errors: 1 });
  assert.deepEqual(profile.keyStats[""], undefined);
});

test("difficulty presets give children a clear pressure curve", () => {
  assert.equal(DIFFICULTIES.gentle.hints, true);
  assert.equal(DIFFICULTIES.explorer.hints, true);
  assert.equal(DIFFICULTIES.rocket.hints, false);
  assert.ok(DIFFICULTIES.rocket.targetAccuracy > DIFFICULTIES.gentle.targetAccuracy);
});

test("course progress stops at the final session", () => {
  const completed = { ...createProfile(), completedSessions: 84 };
  const plan = getDailyPlan(completed);
  const next = completeSession(completed, { accuracy: 1, elapsedSeconds: 1200 });

  assert.equal(plan.dayNumber, 42);
  assert.equal(plan.sessionNumber, 2);
  assert.equal(next.completedSessions, 84);
});
