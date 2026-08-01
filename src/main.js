import {
  DIFFICULTIES,
  chooseActivityPrompt,
  completeSession,
  getDailyPlan,
  getActivityForPrompt,
  getLesson,
  getSessionSeconds,
  normalizeKey,
  normalizeSessionMinutes,
  recordKey,
} from "./engine.js";
import { getSessionProgress, shouldShowTargetHint } from "./session.js";
import { BALLOON_HITS_PER_STATION, advanceBalloonStation, createBalloonRound, shootBalloon, updateBalloonRound } from "./balloon-game.js";
import { isCorrectInput, isIgnoredKey, requiresShift } from "./input.js";
import { SoundBoard } from "./audio.js";
import { loadProfile, saveProfile } from "./storage.js";
import { formatTime, renderActivityScene, renderBalloonArena, renderHome, renderKeyboard, renderPractice, renderResult, renderTarget } from "./ui.js";
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
let parentSettingsOpen = false;
let pendingSessionMinutes = profile.sessionMinutes;
const sound = new SoundBoard(profile.audio);

function render() {
  if (screen === "home") app.innerHTML = renderHome(profile, { parentSettingsOpen, pendingSessionMinutes });
  if (screen === "practice" && run) app.innerHTML = renderPractice(profile, run);
  if (screen === "result" && run?.result) app.innerHTML = renderResult(profile, run.result);
}

function focusCapture() {
  document.querySelector("#keyboard-capture")?.focus();
}

function isBalloonActivity() {
  return run?.activity.id === "balloon-defense";
}

function startBalloonMode() {
  if (!run || !isBalloonActivity()) return;
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
  if (!run || screen !== "practice" || run.paused || !isBalloonActivity()) {
    balloonFrameHandle = null;
    return;
  }
  const elapsed = Math.min(0.12, Math.max(0, (now - balloonLastFrame) / 1000));
  balloonLastFrame = now;
  run.balloonRound = updateBalloonRound(run.balloonRound, elapsed);
  const missedKeys = run.balloonRound.recentMisses ?? [];
  if (missedKeys.length > 0) {
    for (const key of missedKeys) {
      run.total += 1;
      run.errors += 1;
      run.consecutiveErrors += 1;
      profile = recordKey(profile, key, false);
    }
    saveProfile(profile);
    run.streak = 0;
    run.lastFeedback = "wrong";
    run.feedbackText = `漏掉 ${missedKeys.length} 颗气球，稳稳瞄准下一颗`;
    run.announcement = "有气球漏掉了，再试一次";
    sound.wrong();
    refreshRunProgress();
    updatePracticeView();
  } else {
    updateBalloonView();
  }
  balloonFrameHandle = window.requestAnimationFrame(balloonFrame);
}

function updateBalloonView() {
  const arena = document.querySelector("#balloon-arena");
  if (arena && run?.balloonRound) arena.innerHTML = renderBalloonArena(run.balloonRound, run.balloonStationHits);
}

function setActivity(nextActivity) {
  if (!run || run.activity.id === nextActivity.id) return;
  const wasBalloon = isBalloonActivity();
  run.activity = nextActivity;
  if (nextActivity.id === "balloon-defense") startBalloonMode();
  else if (wasBalloon) stopBalloonMode();
}

function createRun(plan, { countsTowardProgress = true } = {}) {
  const activity = getActivityForPrompt(0);
  const sessionSeconds = getSessionSeconds(profile.sessionMinutes);
  const nextRun = {
    plan,
    originalPlan: {
      dayNumber: plan.dayNumber,
      sessionNumber: plan.sessionNumber,
    },
    countsTowardProgress,
    lesson: plan.lesson,
    difficultyId: profile.difficultyId,
    prompt: chooseActivityPrompt(plan.lesson, profile, activity, 0),
    promptIndex: 0,
    activity,
    completedPrompts: 0,
    balloonStationHits: 0,
    typed: "",
    correct: 0,
    errors: 0,
    total: 0,
    streak: 0,
    consecutiveErrors: 0,
    completedGates: 0,
    score: 0,
    sessionSeconds,
    remainingSeconds: sessionSeconds,
    lastFeedback: "ready",
    feedbackText: "星语已经准备好",
    lastPressed: "",
    announcement: `${plan.lesson.title}，第 ${plan.sessionNumber} 次练习开始`,
    paused: false,
  };
  nextRun.progress = getSessionProgress(nextRun, DIFFICULTIES[nextRun.difficultyId]);
  return nextRun;
}

function refreshRunProgress({ announce = true } = {}) {
  if (!run) return null;
  const previousGates = run.completedGates;
  const progress = getSessionProgress(run, DIFFICULTIES[run.difficultyId]);
  run.progress = progress;
  run.completedGates = Math.max(previousGates, progress.completedGates);
  if (announce && run.completedGates > previousGates && !progress.complete) {
    run.feedbackText = `${progress.gate.name}解锁，难度升一级！`;
    run.announcement = `${progress.gate.name}开始`;
    sound.station();
    sound.speak(`${progress.gate.name}开始`);
  }
  return progress;
}

function startPractice(planOverride = null, options = {}) {
  clearTimer();
  clearDraft();
  parentSettingsOpen = false;
  sound.update(profile.audio);
  sound.unlock();
  const plan = planOverride ?? getDailyPlan(profile);
  run = createRun(plan, options);
  screen = "practice";
  render();
  focusCapture();
  sound.station();
  sound.speak(`第 ${plan.dayNumber} 天，${plan.lesson.title}`);
  saveDraft();
  timerHandle = window.setInterval(tick, 1000);
}

function tick() {
  if (!run || run.paused || screen !== "practice") return;
  run.remainingSeconds = Math.max(0, run.remainingSeconds - 1);
  const timer = document.querySelector("#timer-value");
  if (timer) timer.textContent = formatTime(run.remainingSeconds);
  saveDraft();
  if (run.remainingSeconds <= 0) finishPractice({ allowEmpty: true, timedOut: true });
}

function updatePracticeView() {
  if (!run || screen !== "practice") return;
  const expected = run.prompt[run.typed.length] ?? "";
  const balloonActive = isBalloonActivity();
  const progress = refreshRunProgress({ announce: false });
  const showTargetHint = shouldShowTargetHint(
    DIFFICULTIES[run.difficultyId],
    progress?.gateIndex,
    run.consecutiveErrors,
  );
  const accuracy = run.total === 0 ? "--" : `${Math.round((run.correct / run.total) * 100)}%`;
  const targetPanel = document.querySelector("#typing-target-panel");
  const arena = document.querySelector("#balloon-arena");
  if (targetPanel) {
    targetPanel.hidden = balloonActive;
    targetPanel.className = `target-panel activity-stage activity-stage--${run.activity.id}`;
  }
  if (arena) arena.hidden = !balloonActive;
  if (balloonActive) updateBalloonView();
  const target = document.querySelector("#target-sequence");
  if (target) target.innerHTML = renderTarget(run.prompt, run.typed, run.lastFeedback);
  const activityScene = document.querySelector("#activity-scene");
  if (activityScene) activityScene.outerHTML = renderActivityScene(run.activity, run);
  const keyboard = document.querySelector("#keyboard-container");
  if (keyboard) keyboard.innerHTML = renderKeyboard(
    run.lesson,
    profile,
    balloonActive || !showTargetHint ? "" : expected,
    run.lastPressed,
  );
  setText("#accuracy-value", accuracy);
  setText("#streak-value", `${run.streak} 次`);
  setText("#score-value", String(run.score));
  setText("#target-chip", balloonActive ? "发射" : showTargetHint ? normalizeKey(expected) === "space" ? "space" : expected || "完成" : "自己找");
  setText("#keyboard-note", balloonActive ? "按字母键发射能量弹" : showTargetHint ? "目标键会亮起来" : "这一关不亮键，连续出错后会提示");
  setText("#feedback-line", run.feedbackText);
  const activityBanner = document.querySelector("#activity-banner");
  if (activityBanner) activityBanner.className = `activity-banner activity-banner--${run.activity.id}`;
  setText("#activity-icon", run.activity.icon);
  setText("#activity-title", run.activity.title);
  setText("#activity-hint", run.activity.hint);
  setText("#activity-count", balloonActive
    ? `第 ${run.completedPrompts + 1} 站 · ${run.balloonStationHits} / ${BALLOON_HITS_PER_STATION}`
    : `第 ${run.completedPrompts + 1} 站`);
  const feedback = document.querySelector("#feedback-line");
  if (feedback) feedback.className = `feedback-line feedback-line--${run.lastFeedback}`;
  const finish = document.querySelector('[data-action="finish"]');
  if (finish) finish.disabled = run.total === 0;
  const fill = document.querySelector("#track-fill");
  const planet = document.querySelector("#track-planet");
  setText("#track-label", `${run.completedPrompts} / 10 小站`);
  const percent = Math.min(100, (run.completedPrompts / 10) * 100);
  if (fill) fill.style.width = `${percent}%`;
  if (planet) planet.style.left = `${Math.min(94, 4 + (run.completedPrompts / 10) * 90)}%`;
  setText("#gate-name", progress?.complete ? "三关完成" : progress?.gate.name ?? "热身关");
  setText("#gate-correct", `${run.correct} / ${progress?.gate.minCorrect ?? 60}`);
  setText("#gate-accuracy", `${Math.round((progress?.accuracy ?? 0) * 100)}% / ${Math.round((progress?.targetAccuracy ?? 0.8) * 100)}%`);
  setText("#gate-stations", `${run.completedPrompts} / ${progress?.gate.minStations ?? 10}`);
  setText("#screen-announcer", run.announcement);
  run.lastPressed = "";
  saveDraft();
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

function acceptKey(event) {
  if (!run || screen !== "practice" || run.paused) return;
  if (event.target?.closest?.("button")) return;
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
  saveProfile(profile);
  run.lastPressed = normalizeKey(actual);
  if (isCorrect) {
    sound.correct();
    run.typed += expected;
    run.correct += 1;
    run.streak += 1;
    run.consecutiveErrors = 0;
    run.score += 10 + Math.min(20, run.streak);
    run.lastFeedback = "correct";
    run.feedbackText = run.streak >= 5 ? "连成一条星河！" : "漂亮！继续前进";
    if (run.typed.length >= run.prompt.length) {
      run.completedPrompts += 1;
      run.promptIndex += 1;
      setActivity(getActivityForPrompt(run.completedPrompts));
      run.prompt = chooseActivityPrompt(run.lesson, profile, run.activity, run.promptIndex);
      run.typed = "";
      run.feedbackText = run.completedPrompts % 4 === 0 ? "小站到站，伸伸小手再出发" : "小站通过，下一关更有挑战";
      run.announcement = `${run.activity.title}，${run.activity.hint}`;
      sound.station();
      if (run.completedPrompts % 4 === 0) sound.speak("小站到站，伸伸小手再出发");
      else if (run.completedPrompts % 3 === 0) sound.speak(`${run.activity.title}，${run.activity.hint}`);
    }
  } else {
    sound.wrong();
    run.errors += 1;
    run.streak = 0;
    run.consecutiveErrors += 1;
    run.lastFeedback = "wrong";
    run.feedbackText = `再找找：${expected === " " ? "space" : expected}`;
  }
  run.announcement = run.lastFeedback === "correct" ? "正确" : "再试一次";
  const progress = refreshRunProgress();
  if (progress?.complete) {
    finishPractice({ completed: true });
    return;
  }
  updatePracticeView();
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
  saveProfile(profile);
  if (result.shot) {
    run.balloonRound = result.round;
    const stationProgress = advanceBalloonStation(run.balloonStationHits);
    run.balloonStationHits = stationProgress.hits;
    run.correct += 1;
    run.streak += 1;
    run.consecutiveErrors = 0;
    run.score += 15;
    run.lastFeedback = "correct";
    sound.launch();
    sound.explode();
    if (stationProgress.complete) {
      run.completedPrompts += 1;
      run.promptIndex += 1;
      setActivity(getActivityForPrompt(run.completedPrompts));
      run.prompt = chooseActivityPrompt(run.lesson, profile, run.activity, run.promptIndex);
      run.feedbackText = isBalloonActivity() ? "气球小站通过，继续守住下一波" : "气球防线完成，下一站出发";
      sound.station();
      if (run.completedPrompts % 4 === 0) sound.speak("小站到站，伸伸小手再出发");
      else if (run.completedPrompts % 3 === 0) sound.speak(`${run.activity.title}，${run.activity.hint}`);
      run.announcement = "气球小站通过";
    } else {
      run.feedbackText = `命中！本小站 ${run.balloonStationHits} / ${BALLOON_HITS_PER_STATION}`;
      run.announcement = `命中气球，本小站 ${run.balloonStationHits} / ${BALLOON_HITS_PER_STATION}`;
    }
  } else {
    run.errors += 1;
    run.streak = 0;
    run.consecutiveErrors += 1;
    run.lastFeedback = "wrong";
    run.feedbackText = "这颗字母没有气球，再瞄准看看";
    run.announcement = "没有命中，再试一次";
    sound.wrong();
  }
  const progress = refreshRunProgress();
  if (progress?.complete) {
    finishPractice({ completed: true });
    return;
  }
  updatePracticeView();
}

function pausePractice() {
  if (!run || screen !== "practice" || run.paused) return;
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

function finishPractice({ allowEmpty = false, completed = false, timedOut = false } = {}) {
  if (!run || screen !== "practice" || (!allowEmpty && run.total === 0)) return;
  clearTimer();
  stopBalloonMode();
  clearDraft();
  const accuracy = run.total === 0 ? 0 : run.correct / run.total;
  if (completed && run.countsTowardProgress) {
    profile = completeSession(profile, {
      completed: true,
      accuracy,
      elapsedSeconds: run.sessionSeconds - run.remainingSeconds,
      completedAt: new Date().toISOString(),
    });
  }
  saveProfile(profile);
  if (completed) sound.complete();
  else sound.station();
  sound.speak(completed ? "三关完成，漂亮的降落" : timedOut ? "时间到，这次先保存练习" : "这次练习已保存，下次继续挑战");
  run.result = {
    completed,
    timedOut,
    accuracy,
    score: run.score,
    correct: run.correct,
    errors: run.errors,
    empty: run.total === 0,
    originalPlan: run.originalPlan,
  };
  screen = "result";
  render();
  document.querySelector(run.result.completed ? '[data-action="continue"]' : '[data-action="retry"]')?.focus();
}

function retryCompletedSession() {
  if (!run?.result?.originalPlan) return;
  const { dayNumber, sessionNumber } = run.result.originalPlan;
  startPractice({
    dayNumber,
    sessionNumber,
    totalSessions: 84,
    lesson: getLesson(dayNumber),
  }, { countsTowardProgress: !run.result.completed });
}

function continueToNextSession() {
  if (!run?.result?.completed) return;
  startPractice();
}

function clearTimer() {
  if (timerHandle) window.clearInterval(timerHandle);
  timerHandle = null;
}

function hasMeaningfulProgress() {
  return Boolean(run && (run.total > 0 || run.remainingSeconds < run.sessionSeconds - 10));
}

function goHome({ force = false } = {}) {
  if (!force && screen === "practice" && hasMeaningfulProgress()) {
    const shouldLeave = window.confirm("本次闯关还没有完成。已练习的键位数据会保存，但课程进度不会推进。确定退出吗？");
    if (!shouldLeave) {
      focusCapture();
      return;
    }
  }
  if (screen === "practice" && run) saveProfile(profile);
  clearTimer();
  stopBalloonMode();
  clearDraft();
  screen = "home";
  run = null;
  parentSettingsOpen = false;
  render();
}

function focusPendingDuration() {
  document.querySelector(`[data-session-minutes="${pendingSessionMinutes}"]`)?.focus();
}

function openParentSettings() {
  if (screen !== "home") return;
  pendingSessionMinutes = normalizeSessionMinutes(profile.sessionMinutes);
  parentSettingsOpen = true;
  render();
  focusPendingDuration();
}

function selectSessionDuration(value) {
  if (!parentSettingsOpen) return;
  pendingSessionMinutes = normalizeSessionMinutes(value);
  render();
  focusPendingDuration();
}

function closeParentSettings() {
  if (!parentSettingsOpen) return;
  parentSettingsOpen = false;
  pendingSessionMinutes = profile.sessionMinutes;
  render();
  document.querySelector('[data-action="open-parent-settings"]')?.focus();
}

function saveParentSettings() {
  if (!parentSettingsOpen) return;
  profile = { ...profile, sessionMinutes: normalizeSessionMinutes(pendingSessionMinutes) };
  saveProfile(profile);
  closeParentSettings();
}

function trapParentSettingsFocus(event) {
  if (event.key !== "Tab") return;
  const dialog = document.querySelector("[data-parent-settings-dialog]");
  const focusable = [...(dialog?.querySelectorAll("button:not(:disabled)") ?? [])];
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function updateDifficulty(id) {
  if (!Object.hasOwn(DIFFICULTIES, id)) return;
  profile = { ...profile, difficultyId: id };
  saveProfile(profile);
  render();
  document.querySelector(`[data-difficulty="${id}"]`)?.focus();
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
      version: 1,
      savedAt: Date.now(),
      plan: run.originalPlan,
      countsTowardProgress: run.countsTowardProgress,
      state: {
        difficultyId: run.difficultyId,
        prompt: run.prompt,
        promptIndex: run.promptIndex,
        activityIndex: run.completedPrompts,
        completedPrompts: run.completedPrompts,
        balloonStationHits: run.balloonStationHits,
        typed: run.typed,
        correct: run.correct,
        errors: run.errors,
        total: run.total,
        streak: run.streak,
        consecutiveErrors: run.consecutiveErrors,
        completedGates: run.completedGates,
        score: run.score,
        sessionSeconds: run.sessionSeconds,
        remainingSeconds: run.remainingSeconds,
        lastFeedback: run.lastFeedback,
        feedbackText: run.feedbackText,
        announcement: run.announcement,
        paused: true,
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
  if (!draft || draft.version !== 1 || Date.now() - Number(draft.savedAt) > DRAFT_MAX_AGE_MS) {
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
  const baseRun = createRun(plan, { countsTowardProgress: Boolean(draft.countsTowardProgress) });
  const state = draft.state ?? {};
  const sessionSeconds = state.sessionSeconds === undefined
    ? baseRun.sessionSeconds
    : getSessionSeconds(Number(state.sessionSeconds) / 60);
  const savedRemainingSeconds = Number(state.remainingSeconds);
  run = {
    ...baseRun,
    difficultyId: Object.hasOwn(DIFFICULTIES, state.difficultyId) ? state.difficultyId : baseRun.difficultyId,
    prompt: typeof state.prompt === "string" && state.prompt ? state.prompt : baseRun.prompt,
    promptIndex: Math.max(0, Number(state.promptIndex) || 0),
    activity: getActivityForPrompt(Math.max(0, Number(state.activityIndex) || 0)),
    completedPrompts: Math.max(0, Number(state.completedPrompts) || 0),
    balloonStationHits: Math.min(BALLOON_HITS_PER_STATION - 1, Math.max(0, Number(state.balloonStationHits) || 0)),
    typed: typeof state.typed === "string" ? state.typed : "",
    correct: Math.max(0, Number(state.correct) || 0),
    errors: Math.max(0, Number(state.errors) || 0),
    total: Math.max(0, Number(state.total) || 0),
    streak: Math.max(0, Number(state.streak) || 0),
    consecutiveErrors: Math.max(0, Number(state.consecutiveErrors) || 0),
    completedGates: Math.max(0, Math.min(3, Number(state.completedGates) || 0)),
    score: Math.max(0, Number(state.score) || 0),
    sessionSeconds,
    remainingSeconds: Math.min(sessionSeconds, Math.max(0, Number.isFinite(savedRemainingSeconds) ? savedRemainingSeconds : sessionSeconds)),
    lastFeedback: typeof state.lastFeedback === "string" ? state.lastFeedback : "ready",
    feedbackText: typeof state.feedbackText === "string" ? state.feedbackText : "星语继续前进",
    announcement: typeof state.announcement === "string" ? state.announcement : "继续未完成的探险",
    paused: false,
  };
  refreshRunProgress({ announce: false });
  screen = "practice";
  render();
  focusCapture();
  if (isBalloonActivity()) startBalloonMode();
  timerHandle = window.setInterval(tick, 1000);
  saveDraft();
  return true;
}

app.addEventListener("click", (event) => {
  const actionElement = event.target.closest("[data-action]");
  const action = actionElement?.dataset.action;
  if (!action) return;
  if (action === "start") startPractice();
  if (action === "pause") pausePractice();
  if (action === "resume") resumePractice();
  if (action === "finish") finishPractice();
  if (action === "home") goHome();
  if (action === "retry") retryCompletedSession();
  if (action === "continue") continueToNextSession();
  if (action === "difficulty") updateDifficulty(event.target.closest("[data-difficulty]").dataset.difficulty);
  if (action === "open-parent-settings") openParentSettings();
  if (action === "select-session-duration") selectSessionDuration(actionElement.dataset.sessionMinutes);
  if (action === "save-parent-settings") saveParentSettings();
  if (action === "cancel-parent-settings") closeParentSettings();
  if (action === "toggle-effects") toggleAudioSetting("effectsEnabled");
  if (action === "toggle-voice") toggleAudioSetting("voiceEnabled");
});

window.addEventListener("keydown", (event) => {
  if (parentSettingsOpen) {
    if (event.key === "Escape") closeParentSettings();
    else trapParentSettingsFocus(event);
    return;
  }
  acceptKey(event);
});
window.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "practice" && run && !run.paused) pausePractice();
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
