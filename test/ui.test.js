import test from "node:test";
import assert from "node:assert/strict";

import { createProfile, getActivityForPrompt, getDailyPlan } from "../src/engine.js";
import { renderKeyboard, renderPractice, renderResult } from "../src/ui.js";

function practiceRun(profile, overrides = {}) {
  const plan = getDailyPlan(profile);
  return {
    plan,
    lesson: plan.lesson,
    difficultyId: profile.difficultyId,
    prompt: "fjfjfj",
    typed: "",
    activity: getActivityForPrompt(0),
    completedPrompts: 0,
    correct: 0,
    errors: 0,
    total: 0,
    streak: 0,
    consecutiveErrors: 0,
    completedGates: 0,
    score: 0,
    remainingSeconds: 1200,
    lastFeedback: "ready",
    feedbackText: "准备",
    lastPressed: "",
    announcement: "开始",
    paused: false,
    ...overrides,
  };
}

test("the on-screen keyboard renders taught home-row and punctuation keys", () => {
  const profile = createProfile();
  const lesson = {
    activeKeys: ["g", "h", ",", ".", "/", "1", "shift"],
  };
  const html = renderKeyboard(lesson, profile, "?", "");

  for (const key of ["g", "h", ",", ".", "/"]) {
    assert.match(html, new RegExp(`data-key="${key.replace("/", "\\/")}"`));
  }
  assert.match(html, />\/ \?</);
  assert.match(html, />1 !</);
  assert.match(html, /data-key="shift"[^>]*is-target|class="[^"]*is-target[^"]*"[^>]*data-key="shift"/);
});

test("rocket challenge hides the target key until the error threshold", () => {
  const profile = { ...createProfile(), difficultyId: "rocket" };
  const run = practiceRun(profile, {
    completedPrompts: 8,
    correct: 50,
    total: 52,
    completedGates: 2,
    activity: getActivityForPrompt(8),
  });
  const hidden = renderPractice(profile, run);
  const revealed = renderPractice(profile, { ...run, consecutiveErrors: 3 });

  assert.doesNotMatch(hidden, /class="keyboard-key[^"]*is-target/);
  assert.match(revealed, /class="keyboard-key[^"]*is-target/);
  assert.match(hidden, /id="gate-name"[^>]*>冲刺关</);
});

test("each non-balloon activity renders a distinct stage class", () => {
  const profile = createProfile();
  for (const completedPrompts of [0, 4, 6, 8]) {
    const activity = getActivityForPrompt(completedPrompts);
    const html = renderPractice(profile, practiceRun(profile, { activity, completedPrompts }));
    assert.match(html, new RegExp(`activity-stage--${activity.id}`));
  }
});

test("result page separates an incomplete attempt from formal completion", () => {
  const profile = createProfile();
  const baseResult = {
    accuracy: 0.9,
    score: 100,
    correct: 54,
    errors: 6,
    originalPlan: { dayNumber: 1, sessionNumber: 1 },
  };
  const incomplete = renderResult(profile, { ...baseResult, completed: false, timedOut: false });
  const completed = renderResult(profile, { ...baseResult, completed: true, timedOut: false });

  assert.match(incomplete, /本次练习已保存/);
  assert.match(incomplete, /课程进度没有推进/);
  assert.doesNotMatch(incomplete, /data-action="continue"/);
  assert.match(completed, /三关完成/);
  assert.match(completed, /data-action="continue"/);
});
