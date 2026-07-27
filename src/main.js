import {
  DIFFICULTIES,
  MAX_SESSION_SECONDS,
  REST_SECONDS,
  SESSION_PLANS,
  buildStagePlan,
  choosePrompt,
  completeSession,
  getDailyPlan,
  getLesson,
  isCountedSession,
  normalizeKey,
  recordKey,
} from "./engine.js";
import { createBalloonRound, shootBalloon, updateBalloonRound } from "./balloon-game.js";
import { isCorrectInput, isIgnoredKey, requiresShift } from "./input.js";
import { SoundBoard } from "./audio.js";
import { loadProfile, saveProfile } from "./storage.js";
import { formatTime, renderBalloonArena, renderHome, renderKeyboard, renderPractice, renderResult, renderTarget } from "./ui.js";
import "./styles.css";

const DRAFT_KEY = "typing-adventure:session-draft";
const DRAFT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const app = document.querySelector("#app");
let profile = loadProfile();
let screen = "home";
let run = null;
let timerHandle = null;
let balloonFrameHandle = null;
let balloonLastFrame = 0;
const sound = new SoundBoard(profile.audio);

function render() {
  if (screen === "home") app.innerHTML = renderHome(profile);
  if (screen === "practice" && run) app.innerHTML = renderPractice(profile, run);
  if (screen === "result" && run?.result) {
    app.innerHTML = renderResult(profile, run.result);
    const actions = app.querySelector(".dialog-actions");
    if (actions && !actions.querySelector('[data-action="continue"]')) {
      const continueButton = document.createElement("button");
      continueButton.className = "primary-action";
      continueButton.type = "button";
      continueButton.dataset.action = "continue";
      continueButton.textContent = "继续下一站";
      actions.prepend(continueButton);
    }
  }
}

function focusCapture() {
  document.querySelector("#keyboard-capture")?.focus();
}

function currentStage() {
  return run?.stages[run.stageIndex];
}

function isBalloonActivity() {
  return run?.activity.id === "balloon-defense";
}

function nextPrompt() {
  const stage = currentStage();
  if (stage.type === "warmup") return stage.prompts[run.stageProgress % stage.prompts.length];
  return choosePrompt(run.lesson, profile, run.promptIndex);
}

function startBalloonMode() {
  if (!run || !isBalloonActivity() || run.resting || run.paused) return;
  const keys = run.lesson.activeKeys.filter((key) => /^[a-z]$/.test(key));
  run.balloonRound = createBalloonRound(keys);
  balloonLastFrame = performance.now();
  updateBalloonView();
  balloonFrameHandle = window.requestAnimationFrame(balloonFrame);
}

function stopBalloonMode() {
  if (balloonFrameHandle !== null) window.cancelAnimationFrame(balloonFrameHandle);
  balloonFrameHandle = null;
  balloonLastFrame = 0;
  if (run) run.balloonRound = null;
}

function balloonFrame(now) {
  if (!run || screen !== "practice" || run.paused || run.resting || !isBalloonActivity()) {
    balloonFrameHandle = null;
    return;
  }
  const elapsed = Math.min(0.12, Math.max(0, (now - balloonLastFrame) / 1000));
  balloonLastFrame = now;
  run.balloonRound = updateBalloonRound(run.balloonRound, elapsed);
  updateBalloonView();
  balloonFrameHandle = window.requestAnimationFrame(balloonFrame);
}

function updateBalloonView() {
  const arena = document.querySelector("#balloon-arena");
  if (arena && run?.balloonRound) arena.innerHTML = renderBalloonArena(run.balloonRound);
}

function createRun(plan, { countsTowardProgress = true } = {}) {
  const sessionPlanId = Object.hasOwn(SESSION_PLANS, profile.sessionPlanId) ? profile.sessionPlanId : "standard";
  const stages = buildStagePlan(plan.lesson, sessionPlanId, profile);
  return {
    plan,
    originalPlan: {
      dayNumber: plan.dayNumber,
      sessionNumber: plan.sessionNumber,
    },
    countsTowardProgress,
    lesson: plan.lesson,
    difficultyId: profile.difficultyId,
    sessionPlanId,
    stages,
    stageIndex: 0,
    stageProgress: 0,
    completedStages: 0,
    resting: false,
    restRemaining: 0,
    activity: stages[0].activity,
    prompt: stages[0].prompts[0],
    promptIndex: 0,
    typed: "",
    correct: 0,
    errors: 0,
    total: 0,
    streak: 0,
    score: 0,
    elapsedSeconds: 0,
    lastFeedback: "ready",
    feedbackText: "先热热身，唤醒小手",
    lastPressed: "",
    announcement: `${plan.lesson.title}，第 ${plan.sessionNumber} 次练习开始，先热身`,
    paused: false,
  };
}

function startPractice(planOverride = null, options = {}) {
  clearTimer();
  clearDraft();
  sound.update(profile.audio);
  sound.unlock();
  const plan = planOverride ?? getDailyPlan(profile);
  run = createRun(plan, options);
  screen = "practice";
  render();
  focusCapture();
  sound.station();
  sound.speak(`第 ${plan.dayNumber} 天，${plan.lesson.title}，先热身`);
  saveDraft();
  timerHandle = window.setInterval(tick, 1000);
}

function tick() {
  if (!run || run.paused || screen !== "practice") return;
  if (run.resting) {
    run.restRemaining = Math.max(0, run.restRemaining - 1);
    setText("#rest-countdown", String(run.restRemaining));
    if (run.restRemaining <= 0) {
      endRest();
      return;
    }
    saveDraft();
    return;
  }
  run.elapsedSeconds += 1;
  const timer = document.querySelector("#timer-value");
  if (timer) timer.textContent = formatTime(run.elapsedSeconds);
  saveDraft();
  if (run.elapsedSeconds >= MAX_SESSION_SECONDS) finishPractice({ allowEmpty: true });
}

function updatePracticeView() {
  if (!run || screen !== "practice") return;
  const stage = currentStage();
  const expected = run.prompt[run.typed.length] ?? "";
  const balloonActive = isBalloonActivity();
  const accuracy = run.total === 0 ? "--" : `${Math.round((run.correct / run.total) * 100)}%`;
  const targetPanel = document.querySelector("#typing-target-panel");
  const arena = document.querySelector("#balloon-arena");
  if (targetPanel) targetPanel.hidden = balloonActive;
  if (arena) arena.hidden = !balloonActive;
  if (balloonActive) updateBalloonView();
  const target = document.querySelector("#target-sequence");
  if (target) target.innerHTML = renderTarget(run.prompt, run.typed, run.lastFeedback);
  const keyboard = document.querySelector("#keyboard-container");
  if (keyboard) keyboard.innerHTML = renderKeyboard(run.lesson, profile, balloonActive ? "" : expected, run.lastPressed);
  setText("#accuracy-value", accuracy);
  setText("#streak-value", `${run.streak} 次`);
  setText("#score-value", String(run.score));
  setText("#target-chip", balloonActive ? "发射" : normalizeKey(expected) === "space" ? "space" : expected || "完成");
  setText("#keyboard-note", balloonActive
    ? "按字母键发射能量弹"
    : stage.type === "warmup"
      ? "热身：跟着亮起来的键就好"
      : DIFFICULTIES[run.difficultyId].hints ? "目标键会亮起来" : "跟着目标，自己寻找");
  setText("#feedback-line", run.feedbackText);
  const activityBanner = document.querySelector("#activity-banner");
  if (activityBanner) activityBanner.className = `activity-banner activity-banner--${run.activity.id}`;
  setText("#activity-icon", run.activity.icon);
  setText("#activity-title", run.activity.title);
  setText("#activity-hint", run.activity.hint);
  setText("#activity-count", `本关 ${run.stageProgress} / ${stage.target}`);
  setText("#stage-pill", `第 ${run.stageIndex + 1} / ${run.stages.length} 关`);
  const feedback = document.querySelector("#feedback-line");
  if (feedback) feedback.className = `feedback-line feedback-line--${run.lastFeedback}`;
  const finish = document.querySelector('[data-action="finish"]');
  if (finish) finish.disabled = run.total === 0;
  const fill = document.querySelector("#track-fill");
  const planet = document.querySelector("#track-planet");
  const fraction = Math.min(1, (run.completedStages + Math.min(1, run.stageProgress / stage.target)) / run.stages.length);
  setText("#track-label", `${run.completedStages} / ${run.stages.length} 关`);
  if (fill) fill.style.width = `${fraction * 100}%`;
  if (planet) planet.style.left = `${Math.min(94, 4 + fraction * 90)}%`;
  setText("#screen-announcer", run.announcement);
  run.lastPressed = "";
  saveDraft();
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

function acceptKey(event) {
  if (!run || screen !== "practice" || run.paused || run.resting) return;
  if (isBalloonActivity()) {
    handleBalloonInput(event);
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey || isIgnoredKey(event.key)) return;
  const expected = run.prompt[run.typed.length];
  if (!expected) return;
  const actual = event.key;
  const expectedIsUppercase = requiresShift(expected);
  const isCorrect = isCorrectInput(expected, actual);
  const expectedKey = normalizeKey(expected);
  if (!expectedKey) return;
  event.preventDefault();
  run.total += 1;
  profile = recordKey(profile, expectedKey, isCorrect);
  if (expectedIsUppercase) profile = recordKey(profile, "shift", isCorrect);
  run.lastPressed = normalizeKey(actual);
  if (isCorrect) {
    sound.correct();
    run.typed += expected;
    run.correct += 1;
    run.streak += 1;
    run.score += 10 + Math.min(20, run.streak);
    run.lastFeedback = "correct";
    run.feedbackText = run.streak >= 5 ? "连成一条星河！" : "漂亮！继续前进";
    run.announcement = "正确";
    if (run.typed.length >= run.prompt.length) {
      finishPrompt();
      return;
    }
  } else {
    sound.wrong();
    run.errors += 1;
    if (currentStage().type !== "warmup") run.streak = 0;
    run.lastFeedback = "wrong";
    run.feedbackText = `再找找：${expected === " " ? "space" : expected}`;
    run.announcement = "再试一次";
  }
  updatePracticeView();
}

function finishPrompt() {
  run.stageProgress += 1;
  run.promptIndex += 1;
  run.typed = "";
  if (run.stageProgress >= currentStage().target) {
    completeStage();
    return;
  }
  run.prompt = nextPrompt();
  run.feedbackText = "星语通过，下一条来了";
  run.announcement = "星语通过";
  sound.station();
  updatePracticeView();
}

function completeStage() {
  const finishedStage = currentStage();
  run.completedStages += 1;
  run.stageProgress = 0;
  run.typed = "";
  if (finishedStage.type === "balloon") stopBalloonMode();
  if (run.completedStages >= run.stages.length) {
    finishPractice({ allowEmpty: true });
    return;
  }
  run.stageIndex += 1;
  const stage = currentStage();
  run.activity = stage.activity;
  run.prompt = nextPrompt();
  run.lastFeedback = "correct";
  sound.complete();
  if (run.completedStages % 2 === 0) {
    startRest();
    return;
  }
  run.feedbackText = `小关完成！下一关：${stage.activity.title}`;
  run.announcement = `第 ${run.completedStages} 关完成，进入${stage.activity.title}`;
  sound.speak(`${stage.activity.title}，${stage.activity.hint}`);
  render();
  focusCapture();
  if (isBalloonActivity()) startBalloonMode();
  saveDraft();
}

function startRest() {
  run.resting = true;
  run.restRemaining = REST_SECONDS;
  run.feedbackText = "小关完成！休息一下";
  run.announcement = `第 ${run.completedStages} 关完成，休息 ${REST_SECONDS} 秒`;
  sound.speak("伸伸小手，休息一下");
  render();
  document.querySelector('[data-action="skip-rest"]')?.focus();
  saveDraft();
}

function endRest() {
  if (!run || !run.resting) return;
  run.resting = false;
  run.restRemaining = 0;
  const stage = currentStage();
  run.feedbackText = `继续出发！这一关：${stage.activity.title}`;
  run.announcement = `休息结束，进入${stage.activity.title}`;
  sound.station();
  sound.speak(`${stage.activity.title}，${stage.activity.hint}`);
  render();
  focusCapture();
  if (isBalloonActivity()) startBalloonMode();
  saveDraft();
}

function handleBalloonInput(event) {
  if (!run || !run.balloonRound || event.metaKey || event.ctrlKey || event.altKey || isIgnoredKey(event.key)) return;
  const key = normalizeKey(event.key);
  if (!/^[a-z]$/.test(key) || run.balloonRound.balloons.length === 0) return;
  event.preventDefault();
  const result = shootBalloon(run.balloonRound, key);
  run.lastPressed = key;
  run.total += 1;
  profile = recordKey(profile, key, result.shot);
  if (result.shot) {
    run.balloonRound = result.round;
    run.correct += 1;
    run.streak += 1;
    run.score += 15;
    run.lastFeedback = "correct";
    run.feedbackText = "命中！气球爆开了";
    run.announcement = "命中气球";
    sound.launch();
    sound.explode();
    run.stageProgress += 1;
    if (run.stageProgress >= currentStage().target) {
      completeStage();
      return;
    }
  } else {
    run.errors += 1;
    run.streak = 0;
    run.lastFeedback = "wrong";
    run.feedbackText = "这颗字母没有气球，再瞄准看看";
    run.announcement = "没有命中，再试一次";
    sound.wrong();
  }
  updatePracticeView();
}

function pausePractice() {
  if (!run || screen !== "practice" || run.paused || run.resting) return;
  run.paused = true;
  stopBalloonMode();
  run.announcement = "练习已暂停";
  saveDraft();
  render();
  document.querySelector('[data-action="resume"]')?.focus();
}

function resumePractice() {
  if (!run || screen !== "practice" || !run.paused) return;
  run.paused = false;
  run.lastFeedback = "ready";
  run.feedbackText = "星语继续前进";
  if (isBalloonActivity()) startBalloonMode();
  sound.station();
  sound.speak("继续飞行");
  render();
  focusCapture();
  saveDraft();
}

function recordRunToProfile() {
  profile = completeSession(profile, {
    accuracy: run.total === 0 ? 0 : run.correct / run.total,
    elapsedSeconds: run.elapsedSeconds,
    completedAt: new Date().toISOString(),
    completedStages: run.completedStages,
    totalStages: run.stages.length,
  });
  saveProfile(profile);
}

function finishPractice({ allowEmpty = false } = {}) {
  if (!run || screen !== "practice" || (!allowEmpty && run.total === 0)) return;
  clearTimer();
  stopBalloonMode();
  clearDraft();
  const accuracy = run.total === 0 ? 0 : run.correct / run.total;
  const totalStages = run.stages.length;
  const counted = run.total > 0 && isCountedSession(run.completedStages, totalStages);
  if (run.countsTowardProgress && run.total > 0) recordRunToProfile();
  sound.complete();
  sound.speak(run.total === 0
    ? "本次还没有输入，可以重新开始"
    : counted
      ? accuracy >= 0.92 ? "漂亮的降落" : "探险完成"
      : "热身完成，下次接着飞");
  run.result = {
    accuracy,
    score: run.score,
    correct: run.correct,
    errors: run.errors,
    empty: run.total === 0,
    counted,
    completedStages: run.completedStages,
    totalStages,
    elapsedSeconds: run.elapsedSeconds,
    originalPlan: run.originalPlan,
  };
  run.resting = false;
  screen = "result";
  render();
  document.querySelector('[data-action="continue"]')?.focus();
}

function retryCompletedSession() {
  if (!run?.result?.originalPlan) return;
  const { dayNumber, sessionNumber } = run.result.originalPlan;
  startPractice({
    dayNumber,
    sessionNumber,
    totalSessions: 84,
    lesson: getLesson(dayNumber),
  }, { countsTowardProgress: false });
}

function continueToNextSession() {
  startPractice();
}

function clearTimer() {
  if (timerHandle) window.clearInterval(timerHandle);
  timerHandle = null;
}

function hasMeaningfulProgress() {
  return Boolean(run && (run.total > 0 || run.elapsedSeconds > 10));
}

function goHome({ force = false } = {}) {
  if (!force && screen === "practice" && hasMeaningfulProgress()) {
    const willRecord = run.countsTowardProgress && run.total > 0;
    const message = willRecord
      ? "要提前结束这次探险吗？已完成的小关和练习时间会被记录。"
      : "本次探险还没有完成。确定退出并放弃当前进度吗？";
    if (!window.confirm(message)) {
      focusCapture();
      return;
    }
    if (willRecord) recordRunToProfile();
  }
  clearTimer();
  stopBalloonMode();
  clearDraft();
  screen = "home";
  run = null;
  render();
}

function updateDifficulty(id) {
  if (!Object.hasOwn(DIFFICULTIES, id)) return;
  profile = { ...profile, difficultyId: id };
  saveProfile(profile);
  render();
  document.querySelector(`[data-difficulty="${id}"]`)?.focus();
}

function updateSessionPlan(id) {
  if (!Object.hasOwn(SESSION_PLANS, id)) return;
  profile = { ...profile, sessionPlanId: id };
  saveProfile(profile);
  render();
  document.querySelector(`[data-plan="${id}"]`)?.focus();
}

function toggleAudioSetting(setting) {
  const audio = { ...profile.audio, [setting]: !profile.audio[setting] };
  profile = { ...profile, audio };
  sound.update(audio);
  saveProfile(profile);
  if (audio[setting]) {
    sound.unlock();
    if (setting === "voiceEnabled") sound.speak("配音已打开");
    else sound.correct();
  } else if (setting === "voiceEnabled") {
    sound.stopVoice();
  }
  render();
  if (screen === "practice") focusCapture();
}

function saveDraft() {
  if (!run || screen !== "practice") return;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
      version: 2,
      savedAt: Date.now(),
      plan: run.originalPlan,
      countsTowardProgress: run.countsTowardProgress,
      state: {
        difficultyId: run.difficultyId,
        sessionPlanId: run.sessionPlanId,
        stageIndex: run.stageIndex,
        stageProgress: run.stageProgress,
        completedStages: run.completedStages,
        prompt: run.prompt,
        promptIndex: run.promptIndex,
        typed: run.typed,
        correct: run.correct,
        errors: run.errors,
        total: run.total,
        streak: run.streak,
        score: run.score,
        elapsedSeconds: run.elapsedSeconds,
        lastFeedback: run.lastFeedback,
        feedbackText: run.feedbackText,
        announcement: run.announcement,
      },
    }));
  } catch {
    // 浏览器禁用会话存储时，练习仍可继续。
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // 忽略存储不可用。
  }
}

function restoreDraft() {
  let draft;
  try {
    draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null");
  } catch {
    clearDraft();
    return false;
  }
  if (!draft || draft.version !== 2 || Date.now() - Number(draft.savedAt) > DRAFT_MAX_AGE_MS) {
    clearDraft();
    return false;
  }
  const dayNumber = Math.min(42, Math.max(1, Number(draft.plan?.dayNumber) || 1));
  const sessionNumber = Math.min(2, Math.max(1, Number(draft.plan?.sessionNumber) || 1));
  if (!window.confirm(`发现第 ${dayNumber} 天第 ${sessionNumber} 次未完成的探险，是否继续？`)) {
    clearDraft();
    return false;
  }
  const lesson = getLesson(dayNumber);
  const plan = { dayNumber, sessionNumber, totalSessions: 84, lesson };
  const state = draft.state ?? {};
  const sessionPlanId = Object.hasOwn(SESSION_PLANS, state.sessionPlanId) ? state.sessionPlanId : profile.sessionPlanId;
  const stages = buildStagePlan(lesson, sessionPlanId, profile);
  const stageIndex = Math.min(stages.length - 1, Math.max(0, Math.floor(Number(state.stageIndex) || 0)));
  const stage = stages[stageIndex];
  const stageProgress = Math.min(stage.target - 1, Math.max(0, Math.floor(Number(state.stageProgress) || 0)));
  const completedStages = Math.min(stageIndex, Math.max(0, Math.floor(Number(state.completedStages) || 0)));
  const fallbackPrompt = stage.type === "warmup"
    ? stage.prompts[stageProgress % stage.prompts.length]
    : choosePrompt(lesson, profile, Math.max(0, Number(state.promptIndex) || 0));
  const prompt = typeof state.prompt === "string" && state.prompt ? state.prompt : fallbackPrompt;
  const typed = typeof state.typed === "string" && state.typed.length < prompt.length ? state.typed : "";
  run = {
    plan,
    originalPlan: { dayNumber, sessionNumber },
    countsTowardProgress: Boolean(draft.countsTowardProgress),
    lesson,
    difficultyId: Object.hasOwn(DIFFICULTIES, state.difficultyId) ? state.difficultyId : profile.difficultyId,
    sessionPlanId,
    stages,
    stageIndex,
    stageProgress,
    completedStages,
    resting: false,
    restRemaining: 0,
    activity: stage.activity,
    prompt,
    promptIndex: Math.max(0, Number(state.promptIndex) || 0),
    typed,
    correct: Math.max(0, Number(state.correct) || 0),
    errors: Math.max(0, Number(state.errors) || 0),
    total: Math.max(0, Number(state.total) || 0),
    streak: Math.max(0, Number(state.streak) || 0),
    score: Math.max(0, Number(state.score) || 0),
    elapsedSeconds: Math.min(MAX_SESSION_SECONDS, Math.max(0, Number(state.elapsedSeconds) || 0)),
    lastFeedback: typeof state.lastFeedback === "string" ? state.lastFeedback : "ready",
    feedbackText: typeof state.feedbackText === "string" ? state.feedbackText : "星语继续前进",
    lastPressed: "",
    announcement: typeof state.announcement === "string" ? state.announcement : "继续未完成的探险",
    paused: false,
  };
  screen = "practice";
  render();
  focusCapture();
  if (isBalloonActivity()) startBalloonMode();
  timerHandle = window.setInterval(tick, 1000);
  saveDraft();
  return true;
}

app.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "start") startPractice();
  if (action === "pause") pausePractice();
  if (action === "resume") resumePractice();
  if (action === "skip-rest") endRest();
  if (action === "finish") finishPractice();
  if (action === "home") goHome();
  if (action === "retry") retryCompletedSession();
  if (action === "continue") continueToNextSession();
  if (action === "difficulty") updateDifficulty(event.target.closest("[data-difficulty]").dataset.difficulty);
  if (action === "session-plan") updateSessionPlan(event.target.closest("[data-plan]").dataset.plan);
  if (action === "toggle-effects") toggleAudioSetting("effectsEnabled");
  if (action === "toggle-voice") toggleAudioSetting("voiceEnabled");
});

window.addEventListener("keydown", acceptKey);
window.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "practice" && run && !run.paused && !run.resting) pausePractice();
});
window.addEventListener("beforeunload", (event) => {
  if (screen === "practice" && hasMeaningfulProgress()) {
    saveDraft();
    event.preventDefault();
    event.returnValue = "";
  }
});

render();
restoreDraft();
