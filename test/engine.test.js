import test from "node:test";
import assert from "node:assert/strict";

import {
  COURSE,
  DIFFICULTIES,
  ACTIVITIES,
  SESSION_PLANS,
  buildStagePlan,
  buildWarmupPrompts,
  choosePrompt,
  completeSession,
  createProfile,
  getActivity,
  getDailyPlan,
  getLesson,
  getPromptKeys,
  getWeakestKey,
  isCountedSession,
  isHintVisible,
  recordKey,
} from "../src/engine.js";

const FULL_RESULT = { accuracy: 0.95, elapsedSeconds: 900, completedStages: 4, totalStages: 4 };

test("the summer course has 42 daily lessons with two sessions per day", () => {
  assert.equal(COURSE.length, 42);
  assert.equal(getDailyPlan(createProfile()).dayNumber, 1);
  assert.equal(getDailyPlan(createProfile()).sessionNumber, 1);

  const afterOneSession = completeSession(createProfile(), FULL_RESULT);
  assert.equal(getDailyPlan(afterOneSession).dayNumber, 1);
  assert.equal(getDailyPlan(afterOneSession).sessionNumber, 2);

  const afterTwoSessions = completeSession(afterOneSession, FULL_RESULT);
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

test("every prompt only uses keys unlocked for its lesson", () => {
  for (const lesson of COURSE) {
    for (const prompt of lesson.prompts) {
      const missingKeys = getPromptKeys(prompt).filter((key) => !lesson.activeKeys.includes(key));
      assert.deepEqual(
        missingKeys,
        [],
        `Day ${lesson.dayNumber} (${lesson.title}) prompt ${JSON.stringify(prompt)} uses locked keys: ${missingKeys.join(", ")}`,
      );
    }
  }
});

test("uppercase prompts explicitly require shift", () => {
  assert.deepEqual(getPromptKeys("I Am"), ["shift", "i", "space", "a", "m"]);
  assert.ok(getLesson(30).activeKeys.includes("shift"));
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
});

test("a session is a warmup stage followed by rotating game stages", () => {
  const lesson = getLesson(1);
  const stages = buildStagePlan(lesson, "standard", createProfile());

  assert.equal(stages.length, SESSION_PLANS.standard.stages);
  assert.equal(stages[0].type, "warmup");
  assert.equal(stages[0].prompts.length, 3);
  assert.deepEqual(stages.slice(1).map((stage) => stage.activity.id), ["star-scout", "balloon-defense", "word-train"]);
  assert.equal(stages[2].type, "balloon");
  assert.ok(stages[2].target > stages[1].target, "balloon stage needs more hits than a typing stage needs prompts");
  assert.equal(buildStagePlan(lesson, "short", createProfile()).length, SESSION_PLANS.short.stages);
  assert.equal(buildStagePlan(lesson, "full", createProfile()).length, SESSION_PLANS.full.stages);
  assert.equal(buildStagePlan(lesson, "marathon", createProfile()).length, SESSION_PLANS.standard.stages);
});

test("warmup prompts only use keys unlocked for the lesson", () => {
  for (const lesson of COURSE) {
    for (const prompt of buildWarmupPrompts(lesson, createProfile())) {
      const missingKeys = getPromptKeys(prompt).filter((key) => !lesson.activeKeys.includes(key));
      assert.deepEqual(missingKeys, [], `Day ${lesson.dayNumber} warmup prompt ${JSON.stringify(prompt)} uses locked keys`);
    }
  }
});

test("session credit requires at least half of the stages", () => {
  assert.equal(isCountedSession(4, 4), true);
  assert.equal(isCountedSession(2, 4), true);
  assert.equal(isCountedSession(1, 4), false);
  assert.equal(isCountedSession(2, 3), true);
  assert.equal(isCountedSession(1, 3), false);
  assert.equal(isCountedSession(3, 6), true);
  assert.equal(isCountedSession(2, 6), false);
  assert.equal(isCountedSession(0, 1), false);
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
  assert.ok(DIFFICULTIES.rocket.hintAfterErrors > DIFFICULTIES.explorer.hintAfterErrors);
  assert.equal(DIFFICULTIES.gentle.hintAfterErrors, 0);
});

test("key hints follow the difficulty's error threshold", () => {
  assert.equal(isHintVisible(DIFFICULTIES.gentle, "typing", 0), true, "gentle always shows the hint");
  assert.equal(isHintVisible(DIFFICULTIES.explorer, "typing", 0), false);
  assert.equal(isHintVisible(DIFFICULTIES.explorer, "typing", 1), true);
  assert.equal(isHintVisible(DIFFICULTIES.rocket, "typing", 2), false);
  assert.equal(isHintVisible(DIFFICULTIES.rocket, "typing", 3), true, "even rocket mode rescues after repeated errors");
  assert.equal(isHintVisible(DIFFICULTIES.rocket, "warmup", 0), true, "warmup always shows the hint");
});

test("the same prompt is never served twice in a row", () => {
  const profile = createProfile();
  const lesson = getLesson(1);
  let previous = "";
  for (let offset = 0; offset < 20; offset += 1) {
    const prompt = choosePrompt(lesson, profile, offset, previous);
    assert.notEqual(prompt, previous, `offset ${offset} repeated ${JSON.stringify(prompt)}`);
    previous = prompt;
  }
});

test("stars accumulate across sessions and best score tracks formal flights", () => {
  let profile = completeSession(createProfile(), { ...FULL_RESULT, score: 300 });
  profile = completeSession(profile, { ...FULL_RESULT, score: 500 });
  profile = completeSession(profile, { accuracy: 0.7, elapsedSeconds: 120, completedStages: 1, totalStages: 4, score: 40 });

  assert.equal(profile.totalStars, 840, "warmup stars still count toward the total");
  assert.equal(profile.bestScore, 500, "best score only tracks counted sessions");
  assert.equal(profile.history.at(-1).score, 40);
});

test("badges are earned once and persist", () => {
  const first = completeSession(createProfile(), { ...FULL_RESULT, accuracy: 0.99, score: 400, completedAt: "2026-07-01T09:00:00.000Z" });
  assert.ok(first.badges["first-flight"], "first counted session earns the first badge");
  assert.ok(first.badges["sharp-eyes"], "98%+ accuracy earns the accuracy badge");
  assert.equal(first.badges["three-day-streak"], undefined);

  let streak = first;
  for (const day of ["2026-07-02", "2026-07-03"]) {
    streak = completeSession(streak, { ...FULL_RESULT, score: 400, completedAt: `${day}T09:00:00.000Z` });
  }
  assert.ok(streak.badges["three-day-streak"], "three consecutive days earn the streak badge");
  assert.ok(streak.badges["star-collector"], "1000+ total stars earn the collector badge");
  assert.equal(streak.badges["first-flight"], first.badges["first-flight"], "earned timestamps do not change");
});

test("course progress stops at the final session", () => {
  const completed = { ...createProfile(), completedSessions: 84 };
  const plan = getDailyPlan(completed);
  const next = completeSession(completed, { ...FULL_RESULT, accuracy: 1 });

  assert.equal(plan.dayNumber, 42);
  assert.equal(plan.sessionNumber, 2);
  assert.equal(next.completedSessions, 84);
});